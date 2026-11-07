/**
 * Dedicated Voice Query & Omni-Search Hub
 * PSU SportsTrack - Multimodal Public Access Interface
 * 
 * Receives voice & text queries (?q=...&type=...), executes multi-entity database
 * searches across matches, athletes, colleges, star leaderboards, and sport schedules,
 * providing structured result cards and verified navigation links with zero 404 errors.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Mic,
  MicOff,
  Trophy,
  Calendar,
  Users,
  GraduationCap,
  Star,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  X,
  Sparkles,
  MapPin,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

interface MatchItem {
  id: string;
  status: string;
  round?: string;
  venue?: string;
  match_time?: string;
  team_a_score?: number;
  team_b_score?: number;
  team_a?: { name: string } | null;
  team_b?: { name: string } | null;
  tournament?: { name: string; sport: string } | null;
}

interface PlayerItem {
  id: string;
  full_name: string;
  role?: string;
  is_verified?: boolean;
  primary_position?: string;
  college?: { college_name: string } | null;
}

interface CollegeItem {
  id: string;
  college_name: string;
  cluster?: { id: string; name: string; color?: string } | null;
}

interface StarItem {
  id: string;
  name: string;
  college: string;
  gold: number;
  red: number;
  totalScore: number;
}

interface ScheduleItem {
  id: string;
  name: string;
  sport: string;
  type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

type CategoryTab = 'all' | 'matches' | 'players' | 'colleges' | 'rankings' | 'schedules';

export const VoiceQuerySearch: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlQuery = searchParams.get('q') || '';
  const urlType = searchParams.get('type') || 'all';

  const [inputVal, setInputVal] = useState(urlQuery);
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);

  // Entities
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [colleges, setColleges] = useState<CollegeItem[]>([]);
  const [stars, setStars] = useState<StarItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  // Sync tab with URL parameter
  useEffect(() => {
    if (urlType) {
      const normalized = urlType.toLowerCase();
      if (['all', 'matches', 'players', 'colleges', 'rankings', 'schedules'].includes(normalized)) {
        setActiveTab(normalized as CategoryTab);
      } else if (normalized === 'match_search' || normalized === 'upcoming_games') {
        setActiveTab('matches');
      } else if (normalized === 'player_search') {
        setActiveTab('players');
      } else if (normalized === 'college_search') {
        setActiveTab('colleges');
      } else if (normalized === 'highest_stars') {
        setActiveTab('rankings');
      } else if (normalized === 'sport_schedule') {
        setActiveTab('schedules');
      }
    }
  }, [urlType]);

  // Sync input value with URL query
  useEffect(() => {
    setInputVal(urlQuery);
  }, [urlQuery]);

  // Multi-entity Database Query Execution
  const executeSearch = useCallback(async (queryTerm: string) => {
    setLoading(true);
    const term = queryTerm.trim();

    try {
      // 1. Matches Query
      let matchQuery = supabase
        .from('matches')
        .select(`
          id,
          status,
          round,
          venue,
          match_time,
          team_a_score,
          team_b_score,
          team_a:teams!matches_team_a_id_fkey(name),
          team_b:teams!matches_team_b_id_fkey(name),
          tournament:tournaments!matches_tournament_id_fkey(name, sport)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      // 2. Players Query
      let playerQuery = supabase
        .from('users')
        .select(`
          id,
          full_name,
          role,
          is_verified,
          primary_position,
          college:colleges!users_college_id_fkey(college_name)
        `)
        .in('role', ['player_student', 'player_faculty', 'player_staff', 'Player', 'coach'])
        .limit(20);

      if (term) {
        playerQuery = playerQuery.ilike('full_name', `%${term}%`);
      }

      // 3. Colleges Query
      let collegeQuery = supabase
        .from('colleges')
        .select('id, college_name')
        .order('college_name')
        .limit(20);

      if (term && term.toLowerCase() !== 'colleges' && term.toLowerCase() !== 'college') {
        if (term.toUpperCase() === 'CET') {
          collegeQuery = collegeQuery.or('college_name.ilike.%CET%,college_name.ilike.%CEAT%');
        } else if (term.toUpperCase() === 'CCJ') {
          collegeQuery = collegeQuery.or('college_name.ilike.%CCJ%,college_name.ilike.%CCJE%');
        } else {
          collegeQuery = collegeQuery.ilike('college_name', `%${term}%`);
        }
      }

      // Query clusters in parallel for in-memory mapping
      const clusterQuery = supabase
        .from('clusters')
        .select('id, name, color, college_codes');

      // 4. Highest Stars Query
      const starQuery = supabase
        .from('player_stars')
        .select(`
          id,
          star_type,
          user:users!player_stars_player_id_fkey(
            id,
            full_name,
            college:colleges!users_college_id_fkey(college_name)
          )
        `)
        .limit(100);

      // 5. Schedules & Tournaments Query
      let scheduleQuery = supabase
        .from('tournaments')
        .select('id, name, sport, type, status, start_date, end_date')
        .order('start_date', { ascending: false })
        .limit(20);

      if (term) {
        scheduleQuery = scheduleQuery.or(`name.ilike.%${term}%,sport.ilike.%${term}%`);
      }

      // Execute in parallel
      const [mRes, pRes, cRes, sRes, schedRes, clRes] = await Promise.allSettled([
        matchQuery,
        playerQuery,
        collegeQuery,
        starQuery,
        scheduleQuery,
        clusterQuery,
      ]);

      // Process Matches
      if (mRes.status === 'fulfilled' && mRes.value.data) {
        let mData = mRes.value.data as unknown as MatchItem[];
        if (term) {
          const lowerTerm = term.toLowerCase();
          mData = mData.filter((m) => {
            const teamA = m.team_a?.name?.toLowerCase() || '';
            const teamB = m.team_b?.name?.toLowerCase() || '';
            const tournName = m.tournament?.name?.toLowerCase() || '';
            const sport = m.tournament?.sport?.toLowerCase() || '';
            const venue = m.venue?.toLowerCase() || '';
            const round = m.round?.toLowerCase() || '';
            return (
              teamA.includes(lowerTerm) ||
              teamB.includes(lowerTerm) ||
              tournName.includes(lowerTerm) ||
              sport.includes(lowerTerm) ||
              venue.includes(lowerTerm) ||
              round.includes(lowerTerm)
            );
          });
        }
        setMatches(mData);
      } else {
        setMatches([]);
      }

      // Process Players
      if (pRes.status === 'fulfilled' && pRes.value.data) {
        setPlayers(pRes.value.data as unknown as PlayerItem[]);
      } else {
        setPlayers([]);
      }

      // Process Colleges
      if (cRes.status === 'fulfilled' && cRes.value.data) {
        const rawColleges = cRes.value.data as { id: string; college_name: string }[];
        const rawClusters = clRes.status === 'fulfilled' && clRes.value.data ? (clRes.value.data as any[]) : [];
        const mappedColleges: CollegeItem[] = rawColleges.map((c) => {
          const codeMatch = c.college_name.match(/\(([^)]+)\)/);
          const code = codeMatch ? codeMatch[1].trim().toUpperCase() : '';
          const matched = rawClusters.find((cl: any) => cl.college_codes && cl.college_codes.includes(code));
          return {
            id: c.id,
            college_name: c.college_name,
            cluster: matched ? { id: matched.id, name: matched.name, color: matched.color } : null,
          };
        });
        setColleges(mappedColleges);
      } else {
        setColleges([]);
      }

      // Process Stars
      if (sRes.status === 'fulfilled' && sRes.value.data) {
        const starRows = sRes.value.data as any[];
        const map = new Map<string, { id: string; name: string; college: string; gold: number; red: number }>();
        starRows.forEach((row) => {
          const u = row.user;
          if (!u) return;
          const entry = map.get(u.id) || {
            id: u.id,
            name: u.full_name || 'Athlete',
            college: u.college?.college_name || 'PSU Collegiate Unit',
            gold: 0,
            red: 0,
          };
          if (row.star_type === 'Gold') entry.gold += 1;
          else entry.red += 1;
          map.set(u.id, entry);
        });

        let starList: StarItem[] = Array.from(map.values()).map((p) => ({
          ...p,
          totalScore: p.gold * 3 + p.red,
        }));

        if (term) {
          const lowerTerm = term.toLowerCase();
          starList = starList.filter(
            (p) => p.name.toLowerCase().includes(lowerTerm) || p.college.toLowerCase().includes(lowerTerm)
          );
        }

        starList.sort((a, b) => b.totalScore - a.totalScore);
        setStars(starList);
      } else {
        setStars([]);
      }

      // Process Schedules
      if (schedRes.status === 'fulfilled' && schedRes.value.data) {
        setSchedules(schedRes.value.data as unknown as ScheduleItem[]);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.warn('[VoiceQuerySearch] Query error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger query on URL parameter change
  useEffect(() => {
    executeSearch(urlQuery);
  }, [urlQuery, executeSearch]);

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (inputVal.trim()) {
      newParams.set('q', inputVal.trim());
    } else {
      newParams.delete('q');
    }
    if (activeTab !== 'all') {
      newParams.set('type', activeTab);
    }
    setSearchParams(newParams);
  };

  // Change Category Tab
  const handleTabChange = (tab: CategoryTab) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'all') {
      newParams.delete('type');
    } else {
      newParams.set('type', tab);
    }
    setSearchParams(newParams);
  };

  // Quick Suggestion Trigger
  const handleQuickSearch = (keyword: string, tab?: CategoryTab) => {
    setInputVal(keyword);
    const newParams = new URLSearchParams();
    newParams.set('q', keyword);
    if (tab && tab !== 'all') {
      newParams.set('type', tab);
    }
    setSearchParams(newParams);
  };

  // Web Speech Recognition for in-page microphone
  const toggleSpeechRecognition = () => {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Speech Recognition is not supported on this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputVal(transcript);
        if (event.results[0].isFinal) {
          setIsListening(false);
          const newParams = new URLSearchParams(searchParams);
          newParams.set('q', transcript.trim());
          setSearchParams(newParams);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Aggregate Counts
  const totalCount = matches.length + players.length + colleges.length + stars.length + schedules.length;

  // Filtered views based on activeTab
  const showMatches = activeTab === 'all' || activeTab === 'matches';
  const showPlayers = activeTab === 'all' || activeTab === 'players';
  const showColleges = activeTab === 'all' || activeTab === 'colleges';
  const showStars = activeTab === 'all' || activeTab === 'rankings';
  const showSchedules = activeTab === 'all' || activeTab === 'schedules';

  const hasAnyResults = totalCount > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20" data-testid="page-voice-query-search">
      {/* Search Header Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/15 via-slate-900/60 to-slate-950 border-b border-white/10 px-4 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Eyebrow & Title */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[11px] font-black uppercase tracking-widest">
              <Sparkles className="size-3 text-amber-400" /> Omni Voice & Entity Search
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">PSU SportsTrack Multimodal Hub</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tight uppercase text-white mb-3">
            Voice Query <span className="text-primary">Search Hub</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl mb-6">
            Search scheduled games, collegiate athletes, college standings, star leaderboards, and tournament schedules across Palawan State University.
          </p>

          {/* Interactive Search Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 bg-slate-900/90 border-2 border-white/20 focus-within:border-primary rounded-2xl p-1.5 shadow-2xl transition-all"
          >
            <div className="pl-3 text-slate-400">
              <Search className="size-5" />
            </div>

            <input
              type="text"
              data-testid="input-voice-search-page"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder='Speak or type: "Upcoming matches", "Basketball schedule", "Dela Cruz", "CET"...'
              className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            />

            {inputVal && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInputVal('');
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('q');
                  setSearchParams(newParams);
                }}
                className="size-8 p-0 text-slate-400 hover:text-white rounded-full"
                title="Clear query"
              >
                <X className="size-4" />
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSpeechRecognition}
              data-testid="btn-voice-search-mic"
              className={`size-10 p-0 rounded-xl border border-white/20 transition-all ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse border-red-500'
                  : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'
              }`}
              title={isListening ? 'Stop Voice Listening' : 'Speak to Search'}
            >
              {isListening ? <MicOff className="size-4 text-white" /> : <Mic className="size-4" />}
            </Button>

            <Button
              type="submit"
              data-testid="btn-voice-search-submit"
              className="bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase px-5 h-10 rounded-xl"
            >
              Search
            </Button>
          </form>

          {/* Popular Query Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-500 mr-1">Try:</span>
            <button
              type="button"
              onClick={() => handleQuickSearch('upcoming games', 'matches')}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs transition-colors"
            >
              Upcoming games
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch('basketball', 'schedules')}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs transition-colors"
            >
              Basketball schedule
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch('highest stars', 'rankings')}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs transition-colors"
            >
              Highest stars
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch('volleyball', 'schedules')}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs transition-colors"
            >
              Volleyball
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch('college', 'colleges')}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs transition-colors"
            >
              Colleges
            </button>
          </div>
        </div>
      </section>

      {/* Main Results View */}
      <main className="max-w-5xl mx-auto px-4 mt-6">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 border-b border-white/10 no-scrollbar">
          <Button
            size="sm"
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => handleTabChange('all')}
            data-testid="tab-filter-all"
            className={`text-xs font-bold gap-1.5 rounded-xl h-8 px-3.5 ${
              activeTab === 'all' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <Layers className="size-3.5" /> All
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white">
              {totalCount}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'matches' ? 'default' : 'outline'}
            onClick={() => handleTabChange('matches')}
            data-testid="tab-filter-matches"
            className={`text-xs font-bold gap-1.5 rounded-xl h-8 px-3.5 ${
              activeTab === 'matches' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <Activity className="size-3.5" /> Matches & Games
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white">
              {matches.length}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'players' ? 'default' : 'outline'}
            onClick={() => handleTabChange('players')}
            data-testid="tab-filter-players"
            className={`text-xs font-bold gap-1.5 rounded-xl h-8 px-3.5 ${
              activeTab === 'players' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <Users className="size-3.5" /> Athletes
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white">
              {players.length}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'colleges' ? 'default' : 'outline'}
            onClick={() => handleTabChange('colleges')}
            data-testid="tab-filter-colleges"
            className={`text-xs font-bold gap-1.5 rounded-xl h-8 px-3.5 ${
              activeTab === 'colleges' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <GraduationCap className="size-3.5" /> Colleges
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white">
              {colleges.length}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'rankings' ? 'default' : 'outline'}
            onClick={() => handleTabChange('rankings')}
            data-testid="tab-filter-rankings"
            className={`text-xs font-bold gap-1.5 rounded-xl h-8 px-3.5 ${
              activeTab === 'rankings' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <Trophy className="size-3.5 text-amber-400" /> Star Leaders & MVP
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white">
              {stars.length}
            </Badge>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'schedules' ? 'default' : 'outline'}
            onClick={() => handleTabChange('schedules')}
            data-testid="tab-filter-schedules"
            className={`text-xs font-bold gap-1.5 rounded-xl h-8 px-3.5 ${
              activeTab === 'schedules' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <Calendar className="size-3.5" /> Schedules
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white">
              {schedules.length}
            </Badge>
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="size-8 mx-auto animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-slate-200">Querying university athletic databases...</p>
            <p className="text-xs text-slate-500 mt-1">Searching matches, athletes, standings, and tournaments</p>
          </div>
        )}

        {/* Empty State: Zero Results */}
        {!loading && !hasAnyResults && (
          <div className="py-16 px-4 text-center border border-white/10 rounded-2xl bg-white/5 max-w-xl mx-auto my-8">
            <div className="size-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search className="size-8" />
            </div>
            <h2 className="text-xl font-black uppercase text-white mb-2">No Matching Records Found</h2>
            <p className="text-sm text-slate-400 mb-6">
              {urlQuery
                ? `No athletic records, fixtures, athletes, or colleges matched "${urlQuery}".`
                : 'No records available in this category.'}
            </p>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Suggested searches:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSearch('upcoming games', 'matches')}
                  className="text-xs bg-white/5 border-white/15 text-slate-300 rounded-lg hover:bg-white/15"
                >
                  Upcoming Games
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSearch('basketball', 'schedules')}
                  className="text-xs bg-white/5 border-white/15 text-slate-300 rounded-lg hover:bg-white/15"
                >
                  Basketball Schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSearch('highest stars', 'rankings')}
                  className="text-xs bg-white/5 border-white/15 text-slate-300 rounded-lg hover:bg-white/15"
                >
                  MVP Star Leaders
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickSearch('', 'all')}
                  className="text-xs bg-primary/20 border-primary/40 text-primary rounded-lg hover:bg-primary/30"
                >
                  Reset All Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Results Sections */}
        {!loading && hasAnyResults && (
          <div className="space-y-10">
            {/* Section 1: Matches & Fixtures */}
            {showMatches && matches.length > 0 && (
              <section className="space-y-4" data-testid="section-matches-results">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-primary" />
                    <h2 className="text-lg font-black uppercase tracking-wide text-white">
                      Matches & Fixtures ({matches.length})
                    </h2>
                  </div>
                  <Link
                    to="/explorer"
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View Fixture Center <ChevronRight className="size-3.5" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {matches.map((m) => (
                    <Card
                      key={m.id}
                      className="bg-slate-900/80 border-white/10 hover:border-primary/40 transition-all rounded-xl overflow-hidden"
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-bold border-primary/40 text-primary"
                            >
                              {m.tournament?.sport || 'Sport'}
                            </Badge>
                            <Badge
                              className={`text-[10px] font-bold ${
                                m.status === 'Ongoing'
                                  ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                                  : m.status === 'Finished'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-white/10 text-slate-300 border-white/20'
                              }`}
                            >
                              {m.status || 'Scheduled'}
                            </Badge>
                          </div>

                          <p className="font-black text-base text-white mb-1">
                            {m.team_a?.name || 'TBD'} vs {m.team_b?.name || 'TBD'}
                          </p>

                          {(m.team_a_score !== undefined || m.team_b_score !== undefined) && (
                            <p className="text-sm font-black text-amber-400 mb-2">
                              {m.team_a_score ?? 0} — {m.team_b_score ?? 0}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-3">
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3 text-slate-500" /> {m.venue || 'Main Gymnasium'}
                            </span>
                            {m.round && <span>• {m.round}</span>}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate(`/match/${m.id}`)}
                          data-testid={`btn-view-match-${m.id}`}
                          className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/40 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                        >
                          View Match Details <ArrowRight className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Section 2: Players & Athletes */}
            {showPlayers && players.length > 0 && (
              <section className="space-y-4" data-testid="section-players-results">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-emerald-400" />
                    <h2 className="text-lg font-black uppercase tracking-wide text-white">
                      Athletes & Players ({players.length})
                    </h2>
                  </div>
                  <Link
                    to="/athletics"
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    View Scouting Hub <ChevronRight className="size-3.5" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((p) => (
                    <Card
                      key={p.id}
                      className="bg-slate-900/80 border-white/10 hover:border-emerald-500/40 transition-all rounded-xl"
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-black text-sm">
                              {p.full_name?.charAt(0) || 'A'}
                            </div>
                            <div>
                              <p className="font-black text-sm text-white">{p.full_name}</p>
                              <p className="text-xs text-slate-400">
                                {p.college?.college_name || 'PSU Student Athlete'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mb-3">
                            {p.primary_position && (
                              <Badge variant="outline" className="text-[10px] border-white/20 text-slate-300">
                                {p.primary_position}
                              </Badge>
                            )}
                            {p.is_verified && (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                                Verified Athlete
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate('/athletics')}
                          data-testid={`btn-scout-player-${p.id}`}
                          className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                        >
                          Scout Athlete <ArrowRight className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Section 3: Colleges & Campuses */}
            {showColleges && colleges.length > 0 && (
              <section className="space-y-4" data-testid="section-colleges-results">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-5 text-sky-400" />
                    <h2 className="text-lg font-black uppercase tracking-wide text-white">
                      Colleges & Campuses ({colleges.length})
                    </h2>
                  </div>
                  <Link
                    to="/ranking"
                    className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
                  >
                    View College Standings <ChevronRight className="size-3.5" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {colleges.map((c) => (
                    <Card
                      key={c.id}
                      className="bg-slate-900/80 border-white/10 hover:border-sky-500/40 transition-all rounded-xl"
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="size-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300">
                              <GraduationCap className="size-4" />
                            </div>
                            <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-300 font-mono">
                              {c.cluster?.name || 'Academic Unit'}
                            </Badge>
                          </div>

                          <h3 className="font-black text-sm text-white mb-2">{c.college_name}</h3>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate('/ranking')}
                          data-testid={`btn-view-college-${c.id}`}
                          className="w-full bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                        >
                          View Standings <ArrowRight className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Section 4: Star Leaderboard & MVP Standouts */}
            {showStars && stars.length > 0 && (
              <section className="space-y-4" data-testid="section-stars-results">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-5 text-amber-400" />
                    <h2 className="text-lg font-black uppercase tracking-wide text-white">
                      Star Leaders & MVP ({stars.length})
                    </h2>
                  </div>
                  <Link
                    to="/ranking"
                    className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                  >
                    Full Star Leaderboard <ChevronRight className="size-3.5" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {stars.map((athlete, idx) => (
                    <Card
                      key={athlete.id}
                      className="bg-slate-900/80 border-white/10 hover:border-amber-500/40 transition-all rounded-xl"
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-black text-amber-400 text-sm">#{idx + 1} MVP Rank</span>
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1">
                                <Star className="size-3 fill-amber-400" /> {athlete.gold}
                              </Badge>
                              <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs font-bold gap-1">
                                <Star className="size-3 fill-red-400" /> {athlete.red}
                              </Badge>
                            </div>
                          </div>

                          <h3 className="font-black text-sm text-white">{athlete.name}</h3>
                          <p className="text-xs text-slate-400 mb-3">{athlete.college}</p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate('/ranking')}
                          data-testid={`btn-view-leaderboard-${athlete.id}`}
                          className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                        >
                          View Leaderboard <ArrowRight className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Section 5: Sport Schedules & Tournaments */}
            {showSchedules && schedules.length > 0 && (
              <section className="space-y-4" data-testid="section-schedules-results">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-primary" />
                    <h2 className="text-lg font-black uppercase tracking-wide text-white">
                      Sport Schedules & Brackets ({schedules.length})
                    </h2>
                  </div>
                  <Link
                    to="/explorer"
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Open Tournament Explorer <ChevronRight className="size-3.5" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {schedules.map((tourn) => (
                    <Card
                      key={tourn.id}
                      className="bg-slate-900/80 border-white/10 hover:border-primary/40 transition-all rounded-xl"
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-bold border-primary/50 text-primary"
                            >
                              {tourn.sport || 'Sports Category'}
                            </Badge>
                            <Badge
                              className={`text-[10px] font-bold ${
                                tourn.status === 'Ongoing'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-white/10 text-slate-300 border-white/20'
                              }`}
                            >
                              {tourn.status || 'Active'}
                            </Badge>
                          </div>

                          <h3 className="font-black text-base text-white mb-1">{tourn.name}</h3>

                          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                            <Calendar className="size-3 text-slate-500" />
                            <span>
                              {tourn.start_date ? new Date(tourn.start_date).toLocaleDateString() : 'Active Season'}
                              {tourn.end_date && ` - ${new Date(tourn.end_date).toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate('/explorer')}
                          data-testid={`btn-open-schedule-${tourn.id}`}
                          className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                        >
                          Open Bracket Schedule <ExternalLink className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default VoiceQuerySearch;
