import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Globe, 
  Clock, 
  History, 
  MapPin, 
  Search, 
  ChevronRight, 
  Trophy, 
  RotateCcw,
  Layers,
  Lock,
  CheckCircle2,
  Crown,
  Sparkles,
  ArrowRight
} from 'lucide-react';

type Tournament = {
  id: string;
  name: string;
  sport?: string | null;
  status: string;
  start_date: string;
  end_date?: string | null;
};

type Match = {
  id: string;
  tournament_id: string;
  team_a_score: number;
  team_b_score: number;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  round: string;
  match_time: string;
  venue?: string | null;
  tournament?: Tournament | null;
  team_a: { name: string; sport?: string | null } | null;
  team_b: { name: string; sport?: string | null } | null;
  next_match_id?: string | null;
};

const SPORT_ICONS: Record<string, string> = {
  Basketball: '🏀',
  Volleyball: '🏐',
  Soccer: '⚽',
  Football: '⚽',
  Badminton: '🏸',
  Baseball: '⚾',
  Futsal: '🥅',
  'Table Tennis': '🏓',
  Esports: '🎮',
  Chess: '♟️',
  Swimming: '🏊',
  Athletics: '🏃',
};

const getSportIcon = (sportName: string) => {
  if (!sportName) return '🏆';
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (sportName.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🏆';
};

const extractSportName = (match: Match, tourMap: Map<string, Tournament>): string => {
  const tour = tourMap.get(match.tournament_id);
  if (tour?.sport) return tour.sport;
  if (match.team_a?.sport) return match.team_a.sport;
  if (match.team_b?.sport) return match.team_b.sport;
  
  if (tour?.name) {
    for (const sportKey of Object.keys(SPORT_ICONS)) {
      if (tour.name.toLowerCase().includes(sportKey.toLowerCase())) {
        return sportKey;
      }
    }
  }
  return 'General Sports';
};

const isPlayoffRound = (roundName: string): boolean => {
  if (!roundName) return false;
  const r = roundName.toLowerCase();
  return (
    r.includes('final') || 
    r.includes('semi') || 
    r.includes('quarter') || 
    r.includes('playoff') || 
    r.includes('bracket') ||
    r.includes('championship')
  );
};

export const TournamentExplorer = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | 'all'>('all');
  const [selectedSport, setSelectedSport] = useState<string | 'all'>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activePhase, setActivePhase] = useState<'elimination' | 'playoffs'>('elimination');
  const [mobilePlayoffStage, setMobilePlayoffStage] = useState<'all' | 'quarters' | 'semis' | 'finals'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchExplorerData();
  }, []);

  const fetchExplorerData = async () => {
    setIsLoading(true);
    try {
      const [tournamentsRes, matchesRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, sport, status, start_date, end_date')
          .order('start_date', { ascending: false }),
        supabase
          .from('matches')
          .select('*, tournament:tournament_id(id, name, sport, status, start_date), team_a:team_a_id(name, sport), team_b:team_b_id(name, sport)')
          .order('match_time', { ascending: true })
      ]);

      if (tournamentsRes.error) throw tournamentsRes.error;
      if (matchesRes.error) throw matchesRes.error;

      setTournaments(tournamentsRes.data || []);
      setMatches((matchesRes.data as unknown) as Match[] || []);
    } catch (error: any) {
      console.error('Error fetching explorer data:', error);
      toast.error('Failed to load match center data');
    } finally {
      setIsLoading(false);
    }
  };

  const tourMap = useMemo(() => {
    const map = new Map<string, Tournament>();
    tournaments.forEach(t => map.set(t.id, t));
    return map;
  }, [tournaments]);

  // Matches for the selected tournament
  const matchesForTournament = useMemo(() => {
    if (selectedTournamentId === 'all') return matches;
    return matches.filter(m => m.tournament_id === selectedTournamentId);
  }, [matches, selectedTournamentId]);

  // Available sports for the selected tournament
  const availableSports = useMemo(() => {
    const sportCounts = new Map<string, number>();
    
    matchesForTournament.forEach(m => {
      const sportName = extractSportName(m, tourMap);
      sportCounts.set(sportName, (sportCounts.get(sportName) || 0) + 1);
    });

    if (selectedTournamentId !== 'all') {
      const tour = tourMap.get(selectedTournamentId);
      if (tour?.sport && !sportCounts.has(tour.sport)) {
        sportCounts.set(tour.sport, 0);
      }
    } else {
      tournaments.forEach(t => {
        if (t.sport && !sportCounts.has(t.sport)) {
          sportCounts.set(t.sport, sportCounts.get(t.sport) || 0);
        }
      });
    }

    return Array.from(sportCounts.entries()).map(([name, count]) => ({
      name,
      count,
      icon: getSportIcon(name)
    })).sort((a, b) => b.count - a.count);
  }, [matchesForTournament, selectedTournamentId, tourMap, tournaments]);

  // Reset selected sport if no longer valid
  useEffect(() => {
    if (selectedSport !== 'all') {
      const exists = availableSports.some(s => s.name === selectedSport);
      if (!exists) setSelectedSport('all');
    }
  }, [selectedTournamentId, availableSports, selectedSport]);

  // Separate matches into Elimination matches vs Playoff matches
  const { eliminationMatches, playoffMatches, hasPlayoffs, isEliminationComplete } = useMemo(() => {
    // Filter by sport if selected
    const sportFiltered = matchesForTournament.filter(m => {
      if (selectedSport === 'all') return true;
      return extractSportName(m, tourMap) === selectedSport;
    });

    const elim: Match[] = [];
    const play: Match[] = [];

    sportFiltered.forEach(m => {
      if (isPlayoffRound(m.round) || m.next_match_id) {
        play.push(m);
      } else {
        elim.push(m);
      }
    });

    const hasPlayoffMatches = play.length > 0;
    const isElimFinished = hasPlayoffMatches || (elim.length > 0 && elim.every(m => m.status === 'Completed'));

    return {
      eliminationMatches: elim,
      playoffMatches: play,
      hasPlayoffs: hasPlayoffMatches,
      isEliminationComplete: isElimFinished
    };
  }, [matchesForTournament, selectedSport, tourMap]);

  // Filter elimination matches based on stage and search query
  const filteredEliminationMatches = useMemo(() => {
    return eliminationMatches.filter(m => {
      if (selectedRound !== 'all') {
        if (m.round?.toLowerCase() !== selectedRound.toLowerCase()) return false;
      }
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const teamA = m.team_a?.name?.toLowerCase() || '';
        const teamB = m.team_b?.name?.toLowerCase() || '';
        const venue = m.venue?.toLowerCase() || '';
        if (!teamA.includes(query) && !teamB.includes(query) && !venue.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [eliminationMatches, selectedRound, searchQuery]);

  // Live / Upcoming vs History for Elimination view
  const elimLiveAndUpcoming = useMemo(() => {
    return filteredEliminationMatches.filter(m => m.status === 'Scheduled' || m.status === 'Ongoing');
  }, [filteredEliminationMatches]);

  const elimHistory = useMemo(() => {
    return filteredEliminationMatches.filter(m => m.status === 'Completed').sort((a, b) => 
      new Date(b.match_time).getTime() - new Date(a.match_time).getTime()
    );
  }, [filteredEliminationMatches]);

  // Playoff Bracket rounds grouping
  const playoffRoundsGrouped = useMemo(() => {
    const quarters: Match[] = [];
    const semis: Match[] = [];
    const finals: Match[] = [];
    const others: Match[] = [];

    playoffMatches.forEach(m => {
      const r = (m.round || '').toLowerCase();
      if (r.includes('quarter')) quarters.push(m);
      else if (r.includes('semi')) semis.push(m);
      else if (r.includes('final') || r.includes('championship')) finals.push(m);
      else others.push(m);
    });

    return { quarters, semis, finals, others };
  }, [playoffMatches]);

  // Identify Champion if Finals match is completed
  const championTeam = useMemo(() => {
    const completedFinal = playoffRoundsGrouped.finals.find(m => m.status === 'Completed');
    if (!completedFinal) return null;
    if (completedFinal.team_a_score > completedFinal.team_b_score) {
      return completedFinal.team_a?.name || null;
    } else if (completedFinal.team_b_score > completedFinal.team_a_score) {
      return completedFinal.team_b?.name || null;
    }
    return null;
  }, [playoffRoundsGrouped.finals]);

  // Available Rounds for stage filter dropdown
  const availableRounds = useMemo(() => {
    const roundsSet = new Set<string>();
    eliminationMatches.forEach(m => {
      if (m.round) roundsSet.add(m.round);
    });
    return Array.from(roundsSet);
  }, [eliminationMatches]);

  const groupMatchesByDate = (matchList: Match[]) => {
    const groups: { [key: string]: Match[] } = {};
    matchList.forEach(match => {
      const date = match.match_time 
        ? new Date(match.match_time).toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          }).toUpperCase()
        : 'DATE TBD';
      if (!groups[date]) groups[date] = [];
      groups[date].push(match);
    });
    return groups;
  };

  const liveGroups = useMemo(() => groupMatchesByDate(elimLiveAndUpcoming), [elimLiveAndUpcoming]);
  const historyGroups = useMemo(() => groupMatchesByDate(elimHistory), [elimHistory]);

  const selectedTourObj = tournaments.find(t => t.id === selectedTournamentId);
  const isSelectedDraft = selectedTourObj?.status === 'Draft';

  const handleResetFilters = () => {
    setSelectedTournamentId('all');
    setSelectedSport('all');
    setSelectedRound('all');
    setSearchQuery('');
    setActivePhase('elimination');
    setMobilePlayoffStage('all');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] w-full gap-4">
        <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-t-2 border-b-2 border-orange-500"></div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-[11px]">Loading Match Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-500 max-w-full overflow-hidden">
      {/* Hero Header & Breadcrumb Trail */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-slate-950 text-white py-5 sm:py-6 md:py-10 px-4 sm:px-6 md:px-12 shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 sm:size-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 sm:space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
            <button 
              onClick={() => { setSelectedTournamentId('all'); setSelectedSport('all'); }}
              className="hover:text-orange-400 flex items-center gap-1 transition-colors"
            >
              <Globe className="size-3 sm:size-3.5 text-orange-500" />
              <span>Match Center</span>
            </button>
            <ChevronRight className="size-3 text-slate-600" />
            <button 
              onClick={() => setSelectedSport('all')}
              className={`hover:text-orange-400 transition-colors truncate max-w-[140px] sm:max-w-none ${selectedTournamentId !== 'all' ? 'text-slate-200' : 'text-slate-500'}`}
            >
              {selectedTournamentId === 'all' ? 'All Tournaments' : selectedTourObj?.name}
            </button>
            {selectedSport !== 'all' && (
              <>
                <ChevronRight className="size-3 text-slate-600" />
                <span className="text-orange-500 font-black flex items-center gap-1 truncate max-w-[100px] sm:max-w-none">
                  <span>{getSportIcon(selectedSport)}</span>
                  <span className="truncate">{selectedSport}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
                MATCH <span className="text-orange-500">CENTER</span>
              </h1>
              <p className="text-slate-400 font-medium text-xs md:text-sm tracking-wide mt-1.5 sm:mt-2 max-w-2xl opacity-90 leading-relaxed">
                Hierarchical tournament exploration. Select a tournament, choose your sport discipline, and toggle between Phase 1 Elimination and Phase 2 Playoff Brackets.
              </p>
            </div>

            {(selectedTournamentId !== 'all' || selectedSport !== 'all' || selectedRound !== 'all' || searchQuery !== '' || activePhase !== 'elimination') && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleResetFilters}
                className="self-start md:self-auto bg-white/5 border-white/10 hover:bg-orange-500 hover:border-orange-500 text-white font-bold uppercase text-[10px] tracking-widest h-9 px-3.5 sm:px-4 rounded-xl transition-all"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1: Tournament Selector Cards */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-orange-500/20">
              1
            </div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
              Select Tournament <span className="text-slate-400 text-[10px] sm:text-xs font-medium">({tournaments.length})</span>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Global View Card */}
          <button
            type="button"
            onClick={() => setSelectedTournamentId('all')}
            className={`text-left p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between ${
              selectedTournamentId === 'all'
                ? 'bg-slate-950 text-white border-orange-500 shadow-xl shadow-slate-950/20 scale-[1.01]'
                : 'bg-white border-slate-200/80 hover:border-orange-500/40 hover:bg-slate-50 text-slate-800 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md ${
                selectedTournamentId === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                Global Feed
              </span>
              <Globe className={`size-3.5 sm:size-4 ${selectedTournamentId === 'all' ? 'text-orange-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <h3 className="font-black italic uppercase tracking-tight text-sm sm:text-base mb-0.5">
                All Tournaments
              </h3>
              <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${selectedTournamentId === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
                {matches.length} Matches Tracked
              </p>
            </div>
          </button>

          {/* Tournament Cards */}
          {tournaments.map((t) => {
            const isSelected = selectedTournamentId === t.id;
            const isDraft = t.status === 'Draft';
            const tourMatchesCount = matches.filter(m => m.tournament_id === t.id).length;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTournamentId(t.id)}
                className={`text-left p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-950 text-white border-orange-500 shadow-xl shadow-slate-950/20 scale-[1.01]'
                    : 'bg-white border-slate-200/80 hover:border-orange-500/40 hover:bg-slate-50 text-slate-800 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5 sm:mb-3 gap-2">
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md truncate max-w-[120px] ${
                    isDraft 
                      ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20' 
                      : isSelected 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {isDraft ? 'Coming Soon' : t.status || 'Active'}
                  </span>
                  <Trophy className={`size-3.5 sm:size-4 shrink-0 ${isSelected ? 'text-orange-500' : 'text-slate-400'}`} />
                </div>

                <div>
                  <h3 className="font-black italic uppercase tracking-tight text-sm sm:text-base mb-0.5 truncate">
                    {t.name}
                  </h3>
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-wider opacity-75">
                    <span>{isDraft ? 'Registration Open' : `${tourMatchesCount} Games`}</span>
                    <span>{t.start_date ? new Date(t.start_date).getFullYear() : ''}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Sport Discipline Selector Tabs */}
      <div className="space-y-2.5 sm:space-y-3 bg-slate-900/5 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl md:rounded-[2rem]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-orange-500/20">
              2
            </div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              Select Sport Discipline <span className="text-slate-400 text-[10px] sm:text-xs font-medium">({availableSports.length})</span>
            </h2>
          </div>
          {selectedSport !== 'all' && (
            <button
              onClick={() => setSelectedSport('all')}
              className="text-[10px] sm:text-xs font-bold text-orange-500 hover:text-orange-600 uppercase tracking-widest"
            >
              Show All →
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {/* All Sports Pill */}
          <button
            type="button"
            onClick={() => setSelectedSport('all')}
            className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black uppercase italic tracking-tight transition-all duration-300 flex items-center gap-1.5 shrink-0 border ${
              selectedSport === 'all'
                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 scale-[1.02]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-500/40'
            }`}
          >
            <span>🏆</span>
            <span>All Sports</span>
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold ${
              selectedSport === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {matchesForTournament.length}
            </span>
          </button>

          {/* Individual Sport Pills */}
          {availableSports.map((sport) => {
            const isSelected = selectedSport === sport.name;
            return (
              <button
                key={sport.name}
                type="button"
                onClick={() => setSelectedSport(sport.name)}
                className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black uppercase italic tracking-tight transition-all duration-300 flex items-center gap-1.5 shrink-0 border ${
                  isSelected
                    ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 scale-[1.02]'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-500/40'
                }`}
              >
                <span>{sport.icon}</span>
                <span>{sport.name}</span>
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {sport.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 3: Tournament Phase Switcher Toggle (Phase 1 Elimination vs Phase 2 Playoff Bracketing) */}
      <div className="space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <div className="size-6 sm:size-7 rounded-lg sm:rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-orange-500/20">
              3
            </div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              Competition Phase Mode
            </h2>
          </div>

          {/* Phase Switcher Toggle Bar (Mobile Responsive) */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 p-1.5 bg-slate-950 text-white rounded-2xl border border-white/10 shadow-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActivePhase('elimination')}
              className={`w-full sm:w-auto py-2.5 px-4 sm:px-5 rounded-xl font-black uppercase italic tracking-tight text-xs transition-all duration-300 flex items-center justify-center gap-2 ${
                activePhase === 'elimination'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="size-3.5" />
              <span>Phase 1 • Elimination</span>
              {isEliminationComplete && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase border border-emerald-500/30">
                  Finished
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActivePhase('playoffs')}
              className={`w-full sm:w-auto py-2.5 px-4 sm:px-5 rounded-xl font-black uppercase italic tracking-tight text-xs transition-all duration-300 flex items-center justify-center gap-2 ${
                activePhase === 'playoffs'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {hasPlayoffs ? <Trophy className="size-3.5 text-yellow-400" /> : <Lock className="size-3.5 text-slate-500" />}
              <span>Phase 2 • Playoff Bracket</span>
              {!hasPlayoffs && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold text-[9px] uppercase border border-slate-700">
                  Locked
                </span>
              )}
            </button>
          </div>
        </div>

        {/* PHASE 1: ELIMINATION ROUND VIEW */}
        {activePhase === 'elimination' && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
            {/* Elimination Finished Banner Notice */}
            {isEliminationComplete && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-950 border border-emerald-500/30 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="size-9 sm:size-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <CheckCircle2 className="size-5 sm:size-6" />
                  </div>
                  <div>
                    <h4 className="font-black italic uppercase tracking-tight text-xs sm:text-sm text-emerald-400 flex items-center gap-2">
                      Elimination Round Finished
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5">
                      Phase 1 matches have concluded. Qualified squads have advanced to the Phase 2 Playoff Bracket.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setActivePhase('playoffs')}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-wider h-10 px-4 sm:px-5 rounded-xl shrink-0 shadow-md shadow-orange-500/20 w-full md:w-auto"
                >
                  View Playoff Bracket 🏆 →
                </Button>
              </div>
            )}

            {/* Filter Controls Toolbar */}
            <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[2rem] p-3.5 sm:p-5 shadow-sm space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Search Team / Venue */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Search teams or venue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 sm:h-11 rounded-xl bg-slate-50 border-slate-200 font-medium text-xs text-slate-800 focus:bg-white transition-all w-full"
                  />
                </div>

                {/* Stage / Round Dropdown Filter */}
                {availableRounds.length > 0 && (
                  <div className="w-full lg:w-56">
                    <Select value={selectedRound} onValueChange={setSelectedRound}>
                      <SelectTrigger className="h-10 sm:h-11 rounded-xl border-slate-200 bg-slate-50 font-bold text-xs uppercase tracking-wider text-slate-700">
                        <SelectValue placeholder="All Elimination Stages" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold uppercase text-xs">
                        <SelectItem value="all">All Elimination Stages</SelectItem>
                        {availableRounds.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs for Live/Upcoming vs Match History */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6 sm:space-y-8">
              <div className="sticky top-0 z-20 pb-2 bg-slate-50/80 backdrop-blur-md">
                <TabsList className="p-1 h-11 sm:h-13 bg-slate-950/5 border border-slate-200/50 backdrop-blur-xl rounded-xl md:rounded-2xl w-full flex items-stretch">
                  <TabsTrigger 
                    value="live" 
                    className="flex-1 px-2 sm:px-6 font-black uppercase italic tracking-tight text-[11px] sm:text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-lg rounded-lg md:rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-2"
                  >
                    <Clock className="size-3.5 md:size-4" /> Scheduled ({elimLiveAndUpcoming.length})
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="history" 
                    className="flex-1 px-2 sm:px-6 font-black uppercase italic tracking-tight text-[11px] sm:text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-lg rounded-lg md:rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-2"
                  >
                    <History className="size-3.5 md:size-4" /> History ({elimHistory.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="live" className="outline-none mt-0 space-y-8 sm:space-y-12">
                {(() => {
                  if (isSelectedDraft) {
                    return (
                      <Card className="border-2 border-dashed border-orange-500/30 py-12 sm:py-16 px-6 text-center bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent rounded-2xl sm:rounded-[2.5rem]">
                        <div className="size-14 sm:size-16 rounded-2xl sm:rounded-3xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-4 border border-orange-500/20 shadow-lg shadow-orange-500/10">
                          <Clock className="size-7 sm:size-8 animate-pulse" />
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest mb-3">
                          Draft Phase • Recruitment Open
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 mb-2">
                          {selectedTourObj?.name}
                        </h3>
                        <p className="text-slate-500 font-medium text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
                          This tournament is currently in the <strong>Draft Phase</strong>. Coaches are actively forming squads. Schedules will broadcast upon activation.
                        </p>
                      </Card>
                    );
                  }

                  if (Object.keys(liveGroups).length === 0) {
                    return (
                      <Card className="border-dashed border-2 py-16 sm:py-20 text-center bg-slate-50/50 rounded-2xl sm:rounded-[2rem]">
                        <Clock className="size-10 sm:size-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium italic text-xs sm:text-sm">No live or scheduled elimination matches for this selection.</p>
                      </Card>
                    );
                  }

                  return (
                    <>
                      {Object.entries(liveGroups).map(([date, dateMatches]) => (
                        <div key={date} className="relative border-l-2 border-slate-200 pl-4 sm:pl-6 ml-2 sm:ml-3 mb-6 sm:mb-8 space-y-3 sm:space-y-4">
                          <div className="absolute -left-[9px] sm:-left-[11px] top-0 bg-orange-500 size-4 sm:size-5 rounded-full border-4 border-slate-50 flex items-center justify-center"></div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest pt-0.5 mb-4 flex items-center gap-2 sm:gap-3">
                            {date}
                            <span className="h-px flex-1 bg-slate-100" />
                          </h4>
                          
                          <div className="space-y-3">
                            {dateMatches.map((match) => {
                              const sportName = extractSportName(match, tourMap);
                              const sportIcon = getSportIcon(sportName);

                              return (
                                <div key={match.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 hover:shadow-md transition-all gap-3">
                                  {/* Status / Time / Venue */}
                                  <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1.5 w-full sm:w-48">
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                      {match.status === 'Ongoing' ? (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500 text-white rounded-md animate-pulse">
                                          <span className="flex size-1.5 rounded-full bg-white animate-ping" />
                                          <span className="text-[9px] font-black uppercase tracking-widest">LIVE</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 border border-slate-200/80 rounded-md">
                                          <Clock className="size-3 text-slate-400" />
                                          <span className="text-slate-700 font-bold text-[11px] tabular-nums">
                                            {match.match_time ? new Date(match.match_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                          </span>
                                        </div>
                                      )}
                                      <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 font-black text-[9px] uppercase border border-orange-500/20">
                                        {sportIcon} {sportName}
                                      </span>
                                    </div>

                                    {match.venue && (
                                      <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">
                                        <MapPin className="size-3 text-orange-500 shrink-0" />
                                        <span className="truncate max-w-[120px] sm:max-w-none">{match.venue}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Matchup Scoreboard */}
                                  <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 flex-1 my-1 sm:my-0 bg-slate-50/80 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
                                    <div className="flex-1 text-left sm:text-right truncate">
                                      <span className="text-sm sm:text-base font-black text-slate-900 uppercase italic tracking-tight truncate block">{match.team_a?.name || 'TBD'}</span>
                                    </div>
                                    <div className="px-3 py-1 bg-slate-950 text-white rounded-xl flex items-center gap-2 sm:gap-3 shadow-md">
                                      <span className="text-base sm:text-lg font-black text-orange-500 tabular-nums">{match.team_a_score || 0}</span>
                                      <span className="text-[9px] font-black text-slate-400 italic">VS</span>
                                      <span className="text-base sm:text-lg font-black text-orange-500 tabular-nums">{match.team_b_score || 0}</span>
                                    </div>
                                    <div className="flex-1 text-right sm:text-left truncate">
                                      <span className="text-sm sm:text-base font-black text-slate-900 uppercase italic tracking-tight truncate block">{match.team_b?.name || 'TBD'}</span>
                                    </div>
                                  </div>

                                  {/* Action */}
                                  <div className="w-full sm:w-auto">
                                    <Button 
                                      variant="outline" 
                                      className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50 font-black uppercase italic tracking-widest text-[10px] h-10 px-5 rounded-xl transition-all"
                                      onClick={() => navigate(`/match/${match.id}`)}
                                    >
                                      Matchroom →
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="history" className="outline-none mt-0 space-y-8 sm:space-y-12">
                {Object.keys(historyGroups).length === 0 ? (
                  <Card className="border-dashed border-2 py-16 sm:py-20 text-center bg-slate-50/50 rounded-2xl sm:rounded-[2rem]">
                    <History className="size-10 sm:size-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium italic text-xs sm:text-sm">No elimination match history found for this selection.</p>
                  </Card>
                ) : (
                  Object.entries(historyGroups).map(([date, dateMatches]) => (
                    <div key={date} className="relative border-l-2 border-slate-100 pl-4 sm:pl-6 ml-2 sm:ml-3 mb-6 sm:mb-8 space-y-3 sm:space-y-4">
                      <div className="absolute -left-[9px] sm:-left-[11px] top-0 bg-slate-400 size-4 sm:size-5 rounded-full border-4 border-slate-50 flex items-center justify-center"></div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest pt-0.5 mb-4 flex items-center gap-2 sm:gap-3">
                        {date}
                        <span className="h-px flex-1 bg-slate-100" />
                      </h4>
                      
                      <div className="space-y-3">
                        {dateMatches.map((match) => {
                          const sportName = extractSportName(match, tourMap);
                          const sportIcon = getSportIcon(sportName);

                          return (
                            <div key={match.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white border border-slate-100 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 hover:shadow-sm transition-all gap-3 opacity-90 hover:opacity-100">
                              {/* Status / Final */}
                              <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1.5 w-full sm:w-48">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-500 font-black uppercase tracking-widest text-[9px] px-2 py-0.5 bg-slate-100 rounded-md">FINAL</span>
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-black text-[9px] uppercase">
                                    {sportIcon} {sportName}
                                  </span>
                                </div>
                                {match.round && (
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                    Stage: {match.round}
                                  </p>
                                )}
                              </div>

                              {/* Matchup with Final Score */}
                              <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 flex-1 my-1 sm:my-0 bg-slate-50/80 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
                                <div className="flex-1 text-left sm:text-right truncate">
                                  <span className={`text-sm sm:text-base font-black uppercase italic tracking-tight truncate block ${(match.team_a_score || 0) > (match.team_b_score || 0) ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {match.team_a?.name || 'TBD'}
                                  </span>
                                </div>
                                <div className="px-3.5 py-1.5 bg-slate-950 text-white rounded-xl flex items-center gap-3 shadow-md">
                                  <span className={`text-base sm:text-xl font-black tabular-nums ${(match.team_a_score || 0) > (match.team_b_score || 0) ? 'text-orange-500' : 'text-white/40'}`}>
                                    {match.team_a_score || 0}
                                  </span>
                                  <div className="h-3 w-px bg-white/10" />
                                  <span className={`text-base sm:text-xl font-black tabular-nums ${(match.team_b_score || 0) > (match.team_a_score || 0) ? 'text-orange-500' : 'text-white/40'}`}>
                                    {match.team_b_score || 0}
                                  </span>
                                </div>
                                <div className="flex-1 text-right sm:text-left truncate">
                                  <span className={`text-sm sm:text-base font-black uppercase italic tracking-tight truncate block ${(match.team_b_score || 0) > (match.team_a_score || 0) ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {match.team_b?.name || 'TBD'}
                                  </span>
                                </div>
                              </div>

                              {/* Action */}
                              <div className="w-full sm:w-auto">
                                <Button 
                                  variant="ghost" 
                                  className="w-full sm:w-auto text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-black uppercase italic tracking-widest text-[10px] h-10 px-5 rounded-xl transition-all"
                                  onClick={() => navigate(`/match/${match.id}`)}
                                >
                                  Details
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* PHASE 2: PLAYOFF BRACKET VIEW */}
        {activePhase === 'playoffs' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {!hasPlayoffs ? (
              /* LOCKED STATE CARD */
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-800 py-12 sm:py-16 px-6 text-center bg-slate-950 text-white rounded-2xl sm:rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 sm:size-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 max-w-lg mx-auto space-y-3.5 sm:space-y-4">
                  <div className="size-14 sm:size-16 rounded-2xl sm:rounded-3xl bg-slate-900 text-orange-500 flex items-center justify-center mx-auto border border-white/10 shadow-xl">
                    <Lock className="size-7 sm:size-8 animate-pulse text-orange-500" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-orange-500/30">
                    🔒 Phase 2 Locked • Playoffs Pending
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white">
                    Playoff Bracket Unlocks After Elimination Round
                  </h3>
                  <p className="text-slate-400 font-medium text-xs leading-relaxed">
                    This competition is currently in Phase 1 (Elimination Round). Once regular round matches conclude, qualified squads will be seeded into the Playoff Knockout Bracket.
                  </p>
                  <div className="pt-2 flex justify-center">
                    <Button
                      onClick={() => setActivePhase('elimination')}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-wider h-10 sm:h-11 px-5 sm:px-6 rounded-xl shadow-lg shadow-orange-500/20 transition-all w-full sm:w-auto"
                    >
                      ← Back to Elimination Matches
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              /* ACTIVE PLAYOFF BRACKET VIEW */
              <div className="space-y-6 sm:space-y-8">
                {/* Champion Banner if Champion exists */}
                {championTeam && (
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 sm:p-8 shadow-2xl border border-amber-300/30 text-center animate-in zoom-in-95 duration-700">
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <div className="size-12 sm:size-14 rounded-2xl bg-white/20 backdrop-blur-md text-yellow-300 flex items-center justify-center border border-white/30 shadow-lg">
                        <Crown className="size-7 sm:size-8 animate-bounce" />
                      </div>
                      <span className="px-3 py-1 rounded-full bg-black/20 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                        Official Champion • Phase 2 Winner
                      </span>
                      <h2 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none drop-shadow-md">
                        {championTeam}
                      </h2>
                      <p className="text-white/90 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-0.5">
                        🏆 Tournament Championship Winner
                      </p>
                    </div>
                  </div>
                )}

                {/* Mobile Round Segment Selector Bar (Visible on mobile/tablet) */}
                <div className="md:hidden space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                    <span>Mobile Round Filter</span>
                    <span className="text-orange-500">Tap round to focus</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/10 overflow-x-auto scrollbar-hide">
                    <button
                      type="button"
                      onClick={() => setMobilePlayoffStage('all')}
                      className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                        mobilePlayoffStage === 'all' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All Rounds
                    </button>
                    {playoffRoundsGrouped.quarters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobilePlayoffStage('quarters')}
                        className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                          mobilePlayoffStage === 'quarters' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Quarters ({playoffRoundsGrouped.quarters.length})
                      </button>
                    )}
                    {playoffRoundsGrouped.semis.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobilePlayoffStage('semis')}
                        className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                          mobilePlayoffStage === 'semis' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Semis ({playoffRoundsGrouped.semis.length})
                      </button>
                    )}
                    {playoffRoundsGrouped.finals.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobilePlayoffStage('finals')}
                        className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                          mobilePlayoffStage === 'finals' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Finals 🏆
                      </button>
                    )}
                  </div>
                </div>

                {/* Interactive Bracket Tree Container */}
                <div className="bg-slate-950 text-white border border-white/10 rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-2xl overflow-x-auto relative">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-5">
                    <div className="flex items-center gap-2">
                      <Trophy className="size-4 sm:size-5 text-orange-500" />
                      <h3 className="font-black italic uppercase tracking-tight text-base sm:text-lg text-white">
                        Knockout Bracket Arena
                      </h3>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 hidden sm:inline-block">
                      Single Elimination Format
                    </span>
                  </div>

                  {/* Swipe hint for narrow touchscreens */}
                  <div className="md:hidden flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                    <ArrowRight className="size-3 text-orange-500 animate-pulse" />
                    <span>Swipe horizontally or select round filter above</span>
                  </div>

                  {/* Bracket Columns */}
                  <div className="flex items-stretch gap-4 sm:gap-6 md:gap-12 min-w-[300px] md:min-w-[700px] justify-between">
                    {/* Quarter-Finals Column */}
                    {playoffRoundsGrouped.quarters.length > 0 && (mobilePlayoffStage === 'all' || mobilePlayoffStage === 'quarters') && (
                      <div className="flex-1 flex flex-col justify-around gap-4 sm:gap-6 min-w-[260px] sm:min-w-0">
                        <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-orange-500 pb-2 border-b border-white/10">
                          Quarter-Finals ({playoffRoundsGrouped.quarters.length})
                        </div>
                        {playoffRoundsGrouped.quarters.map(match => (
                          <BracketMatchCard key={match.id} match={match} onNavigate={() => navigate(`/match/${match.id}`)} />
                        ))}
                      </div>
                    )}

                    {/* Semi-Finals Column */}
                    {playoffRoundsGrouped.semis.length > 0 && (mobilePlayoffStage === 'all' || mobilePlayoffStage === 'semis') && (
                      <div className="flex-1 flex flex-col justify-around gap-4 sm:gap-6 min-w-[260px] sm:min-w-0">
                        <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-orange-500 pb-2 border-b border-white/10">
                          Semi-Finals ({playoffRoundsGrouped.semis.length})
                        </div>
                        {playoffRoundsGrouped.semis.map(match => (
                          <BracketMatchCard key={match.id} match={match} onNavigate={() => navigate(`/match/${match.id}`)} />
                        ))}
                      </div>
                    )}

                    {/* Finals & Championship Column */}
                    {playoffRoundsGrouped.finals.length > 0 && (mobilePlayoffStage === 'all' || mobilePlayoffStage === 'finals') && (
                      <div className="flex-1 flex flex-col justify-center gap-4 sm:gap-6 min-w-[260px] sm:min-w-0">
                        <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-yellow-400 pb-2 border-b border-yellow-400/30 flex items-center justify-center gap-1.5">
                          <Crown className="size-3.5 text-yellow-400" />
                          <span>Championship Final</span>
                        </div>
                        {playoffRoundsGrouped.finals.map(match => (
                          <BracketMatchCard key={match.id} match={match} isFinals onNavigate={() => navigate(`/match/${match.id}`)} />
                        ))}
                      </div>
                    )}

                    {/* Additional Playoff Matches (if uncategorized) */}
                    {playoffRoundsGrouped.others.length > 0 && mobilePlayoffStage === 'all' && (
                      <div className="flex-1 flex flex-col justify-around gap-4 sm:gap-6 min-w-[260px] sm:min-w-0">
                        <div className="text-center font-black uppercase italic tracking-widest text-[11px] text-slate-400 pb-2 border-b border-white/10">
                          Playoff Matches
                        </div>
                        {playoffRoundsGrouped.others.map(match => (
                          <BracketMatchCard key={match.id} match={match} onNavigate={() => navigate(`/match/${match.id}`)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Bracket Match Card Helper Component
const BracketMatchCard = ({ match, isFinals = false, onNavigate }: { match: Match; isFinals?: boolean; onNavigate: () => void }) => {
  const isTeamAWinner = match.status === 'Completed' && match.team_a_score > match.team_b_score;
  const isTeamBWinner = match.status === 'Completed' && match.team_b_score > match.team_a_score;

  return (
    <div 
      onClick={onNavigate}
      className={`rounded-xl sm:rounded-2xl border transition-all duration-300 p-3 sm:p-4 cursor-pointer relative group overflow-hidden ${
        isFinals 
          ? 'bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-950 border-amber-500/50 shadow-xl shadow-amber-500/10 hover:border-amber-400' 
          : 'bg-slate-900 border-white/10 hover:border-orange-500/50 hover:bg-slate-850'
      }`}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-white/5 pb-1.5 sm:pb-2">
        <span className="text-orange-400 flex items-center gap-1 truncate max-w-[140px]">
          {match.round || 'Playoff Node'}
        </span>
        {match.status === 'Ongoing' ? (
          <span className="text-red-400 font-bold animate-pulse flex items-center gap-1 shrink-0">
            <span className="size-1.5 rounded-full bg-red-400 animate-ping" /> LIVE
          </span>
        ) : match.status === 'Completed' ? (
          <span className="text-emerald-400 font-bold shrink-0">FINAL</span>
        ) : (
          <span className="text-slate-500 shrink-0">UPCOMING</span>
        )}
      </div>

      {/* Team A Slot */}
      <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl mb-1 sm:mb-1.5 transition-colors ${
        isTeamAWinner ? 'bg-amber-500/20 text-white font-black border border-amber-500/30' : 'bg-white/5 text-slate-300'
      }`}>
        <div className="flex items-center gap-1.5 truncate">
          {isTeamAWinner && <Crown className="size-3.5 text-yellow-400 shrink-0" />}
          <span className="text-xs uppercase italic font-black truncate">{match.team_a?.name || 'TBD'}</span>
        </div>
        <span className={`text-xs sm:text-sm font-black tabular-nums shrink-0 ml-2 ${isTeamAWinner ? 'text-amber-400' : 'text-slate-400'}`}>
          {match.team_a_score || 0}
        </span>
      </div>

      {/* Team B Slot */}
      <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors ${
        isTeamBWinner ? 'bg-amber-500/20 text-white font-black border border-amber-500/30' : 'bg-white/5 text-slate-300'
      }`}>
        <div className="flex items-center gap-1.5 truncate">
          {isTeamBWinner && <Crown className="size-3.5 text-yellow-400 shrink-0" />}
          <span className="text-xs uppercase italic font-black truncate">{match.team_b?.name || 'TBD'}</span>
        </div>
        <span className={`text-xs sm:text-sm font-black tabular-nums shrink-0 ml-2 ${isTeamBWinner ? 'text-amber-400' : 'text-slate-400'}`}>
          {match.team_b_score || 0}
        </span>
      </div>

      <div className="mt-2 text-right">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-orange-400 transition-colors">
          Matchroom Details →
        </span>
      </div>
    </div>
  );
};
