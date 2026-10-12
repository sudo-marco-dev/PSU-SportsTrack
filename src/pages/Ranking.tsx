import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Filter, Sparkles, Shield, RotateCcw, Search, CheckCircle2 } from 'lucide-react';

interface RankedTeam {
  key: string;
  teamName: string;
  sport: string;
  category: string;
  tournaments: string[];
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  championships: number;
  runnerUps: number;
  bronzeFinishes: number;
  goldStars: number;
}

export const Ranking = () => {
  // Filter States
  const [tournamentType, setTournamentType] = useState<string>('all');
  const [sportCategory, setSportCategory] = useState<string>('all');
  const [winMetric, setWinMetric] = useState<string>('overall_wins');
  const [academicYear, setAcademicYear] = useState<string>('current');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Supabase Datasets
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [stars, setStars] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch all relevant athletic datasets
  useEffect(() => {
    fetchRankingDatasets();
  }, []);

  const fetchRankingDatasets = async () => {
    setIsLoading(true);
    try {
      const [tRes, tmRes, mRes, sRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, sport, type, status, start_date, end_date')
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase
          .from('teams')
          .select('id, name, tournament_id, status')
          .eq('status', 'Approved')
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase
          .from('matches')
          .select('id, tournament_id, round, status, team_a_id, team_b_id, team_a_score, team_b_score, match_time, venue, team_a:team_a_id(name), team_b:team_b_id(name)'),
        supabase
          .from('player_stars')
          .select('id, player_id, tournament_id, star_type')
      ]);

      if (tRes.data) setTournaments(tRes.data);
      if (tmRes.data) setTeams(tmRes.data);
      if (mRes.data) {
        setMatches(mRes.data.map(m => ({
          ...m,
          team_a_name: Array.isArray(m.team_a) ? m.team_a[0]?.name : (m.team_a as any)?.name,
          team_b_name: Array.isArray(m.team_b) ? m.team_b[0]?.name : (m.team_b as any)?.name
        })));
      }
      if (sRes.data) setStars(sRes.data);
    } catch (err) {
      console.error('Error fetching leaderboard datasets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setTournamentType('all');
    setSportCategory('all');
    setWinMetric('overall_wins');
    setAcademicYear('current');
    setSearchQuery('');
  };

  // 1. Filter Tournaments based on active controls
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      // Tournament Category filter
      if (tournamentType !== 'all') {
        const tType = (t.type || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        const target = tournamentType.toLowerCase();
        if (!tType.includes(target) && !tName.includes(target)) {
          return false;
        }
      }

      // Sport Discipline filter
      if (sportCategory !== 'all') {
        const tSport = (t.sport || '').toLowerCase();
        const target = sportCategory.toLowerCase();
        if (tSport !== target) {
          return false;
        }
      }

      // Academic Period filter
      if (academicYear === 'current') {
        const is2026 = (t.start_date && t.start_date.includes('2026')) || (t.name && t.name.includes('2026'));
        if (!is2026) return false;
      } else if (academicYear === '2025') {
        const is2025 = (t.start_date && t.start_date.includes('2025')) || (t.name && t.name.includes('2025'));
        if (!is2025) return false;
      } else if (academicYear === '2024') {
        const is2024 = (t.start_date && t.start_date.includes('2024')) || (t.name && t.name.includes('2024'));
        if (!is2024) return false;
      }

      return true;
    });
  }, [tournaments, tournamentType, sportCategory, academicYear]);

  // 2. Compute live team standings across filtered tournaments
  const rankedTeams = useMemo<RankedTeam[]>(() => {
    if (filteredTournaments.length === 0) return [];

    const tournMap = new Map(filteredTournaments.map(t => [t.id, t]));
    const tournIds = new Set(filteredTournaments.map(t => t.id));

    const relevantMatches = matches.filter(m => tournIds.has(m.tournament_id));
    const relevantTeams = teams.filter(t => tournIds.has(t.tournament_id));

    // Map crowned champions and runner-ups per tournament
    const tournChampions = new Map<string, string>(); // tournId -> champion teamId
    const tournRunnerUps = new Map<string, string>(); // tournId -> runner-up teamId
    const tournBronze = new Map<string, string>(); // tournId -> bronze teamId

    filteredTournaments.forEach(tourn => {
      const tourMatches = relevantMatches.filter(m => m.tournament_id === tourn.id);
      if (tourMatches.length === 0) return;

      // Detect Finals match
      const finalsMatch = tourMatches.find(m => {
        const r = (m.round || '').toLowerCase();
        return (r.includes('final') && !r.includes('semi') && !r.includes('quarter') && !r.includes('bronze') && !r.includes('3rd'))
          || (!m.next_match_id && tourMatches.length > 0 && tourMatches.every(tm => tm.status === 'Completed'));
      });

      if (finalsMatch && (finalsMatch.status === 'Completed' || (finalsMatch.team_a_score || 0) > 0 || (finalsMatch.team_b_score || 0) > 0)) {
        const scoreA = finalsMatch.team_a_score || 0;
        const scoreB = finalsMatch.team_b_score || 0;
        const winnerId = scoreA >= scoreB ? finalsMatch.team_a_id : finalsMatch.team_b_id;
        const loserId = scoreA >= scoreB ? finalsMatch.team_b_id : finalsMatch.team_a_id;
        if (winnerId) tournChampions.set(tourn.id, winnerId);
        if (loserId) tournRunnerUps.set(tourn.id, loserId);
      }

      // Detect Bronze match
      const bronzeMatch = tourMatches.find(m => {
        const r = (m.round || '').toLowerCase();
        return r.includes('bronze') || r.includes('3rd');
      });

      if (bronzeMatch && (bronzeMatch.status === 'Completed' || (bronzeMatch.team_a_score || 0) > 0 || (bronzeMatch.team_b_score || 0) > 0)) {
        const scoreA = bronzeMatch.team_a_score || 0;
        const scoreB = bronzeMatch.team_b_score || 0;
        const winnerId = scoreA >= scoreB ? bronzeMatch.team_a_id : bronzeMatch.team_b_id;
        if (winnerId) tournBronze.set(tourn.id, winnerId);
      }
    });

    // MVP Gold Stars count per tournament
    const tournGoldStars = new Map<string, number>();
    stars.filter(s => s.star_type === 'Gold').forEach(s => {
      if (s.tournament_id) {
        tournGoldStars.set(s.tournament_id, (tournGoldStars.get(s.tournament_id) || 0) + 1);
      }
    });

    // Aggregate squads by normalized name + sport
    const teamStatsMap = new Map<string, RankedTeam>();

    relevantTeams.forEach(t => {
      const tourn = tournMap.get(t.tournament_id);
      const sport = tourn?.sport || 'General';
      const category = tourn?.type || 'Binturungan';
      const key = `${t.name.trim().toLowerCase()}__${sport.toLowerCase()}`;

      if (!teamStatsMap.has(key)) {
        teamStatsMap.set(key, {
          key,
          teamName: t.name.trim(),
          sport,
          category,
          tournaments: tourn?.name ? [tourn.name] : [],
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointDiff: 0,
          championships: 0,
          runnerUps: 0,
          bronzeFinishes: 0,
          goldStars: 0,
        });
      } else {
        const existing = teamStatsMap.get(key)!;
        if (tourn?.name && !existing.tournaments.includes(tourn.name)) {
          existing.tournaments.push(tourn.name);
        }
      }

      const squad = teamStatsMap.get(key)!;
      if (tournChampions.get(t.tournament_id) === t.id) {
        squad.championships += 1;
      }
      if (tournRunnerUps.get(t.tournament_id) === t.id) {
        squad.runnerUps += 1;
      }
      if (tournBronze.get(t.tournament_id) === t.id) {
        squad.bronzeFinishes += 1;
      }
    });

    // Ensure teams appearing in relevant matches are included in teamStatsMap
    relevantMatches.forEach(m => {
      const tourn = tournMap.get(m.tournament_id);
      const sport = tourn?.sport || 'General';
      const category = tourn?.type || 'Binturungan';

      const teamAObj = relevantTeams.find(t => t.id === m.team_a_id);
      const teamBObj = relevantTeams.find(t => t.id === m.team_b_id);
      const nameA = m.team_a_name || teamAObj?.name;
      const nameB = m.team_b_name || teamBObj?.name;

      if (nameA && nameA !== 'BYE' && nameA !== 'TBD') {
        const keyA = `${nameA.trim().toLowerCase()}__${sport.toLowerCase()}`;
        if (!teamStatsMap.has(keyA)) {
          teamStatsMap.set(keyA, {
            key: keyA,
            teamName: nameA.trim(),
            sport,
            category,
            tournaments: tourn?.name ? [tourn.name] : [],
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            pointDiff: 0,
            championships: 0,
            runnerUps: 0,
            bronzeFinishes: 0,
            goldStars: 0,
          });
        }
      }

      if (nameB && nameB !== 'BYE' && nameB !== 'TBD') {
        const keyB = `${nameB.trim().toLowerCase()}__${sport.toLowerCase()}`;
        if (!teamStatsMap.has(keyB)) {
          teamStatsMap.set(keyB, {
            key: keyB,
            teamName: nameB.trim(),
            sport,
            category,
            tournaments: tourn?.name ? [tourn.name] : [],
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            pointDiff: 0,
            championships: 0,
            runnerUps: 0,
            bronzeFinishes: 0,
            goldStars: 0,
          });
        }
      }
    });

    // Process all match results
    relevantMatches.forEach(m => {
      if (m.status === 'Completed' || (m.team_a_score || 0) > 0 || (m.team_b_score || 0) > 0) {
        const scoreA = m.team_a_score || 0;
        const scoreB = m.team_b_score || 0;
        const tourn = tournMap.get(m.tournament_id);
        const sport = tourn?.sport || 'General';

        const teamAObj = relevantTeams.find(t => t.id === m.team_a_id);
        const teamBObj = relevantTeams.find(t => t.id === m.team_b_id);
        const nameA = m.team_a_name || teamAObj?.name;
        const nameB = m.team_b_name || teamBObj?.name;

        if (nameA && nameA !== 'BYE' && nameA !== 'TBD') {
          const keyA = `${nameA.trim().toLowerCase()}__${sport.toLowerCase()}`;
          const statA = teamStatsMap.get(keyA);
          if (statA) {
            statA.matchesPlayed += 1;
            statA.pointsFor += scoreA;
            statA.pointsAgainst += scoreB;
            if (scoreA > scoreB) statA.wins += 1;
            else if (scoreA < scoreB) statA.losses += 1;
          }
        }

        if (nameB && nameB !== 'BYE' && nameB !== 'TBD') {
          const keyB = `${nameB.trim().toLowerCase()}__${sport.toLowerCase()}`;
          const statB = teamStatsMap.get(keyB);
          if (statB) {
            statB.matchesPlayed += 1;
            statB.pointsFor += scoreB;
            statB.pointsAgainst += scoreA;
            if (scoreB > scoreA) statB.wins += 1;
            else if (scoreB < scoreA) statB.losses += 1;
          }
        }
      }
    });

    // Calculate rates and differentials
    const allList = Array.from(teamStatsMap.values()).map(t => {
      const pointDiff = t.pointsFor - t.pointsAgainst;
      const winRate = t.matchesPlayed > 0 ? (t.wins / t.matchesPlayed) * 100 : 0;
      return {
        ...t,
        pointDiff,
        winRate,
      };
    });

    // Filter by search query
    const filtered = allList.filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.teamName.toLowerCase().includes(q) || 
             t.sport.toLowerCase().includes(q) || 
             t.category.toLowerCase().includes(q);
    });

    // Sort according to active Ranking Criterion
    filtered.sort((a, b) => {
      if (winMetric === 'overall_wins') {
        if (b.championships !== a.championships) return b.championships - a.championships;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        return b.pointsFor - a.pointsFor;
      } else if (winMetric === 'most_wins') {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.championships !== a.championships) return b.championships - a.championships;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        return b.pointsFor - a.pointsFor;
      } else if (winMetric === 'win_rate') {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.championships !== a.championships) return b.championships - a.championships;
        return b.pointDiff - a.pointDiff;
      } else if (winMetric === 'mvp_stars') {
        if (b.goldStars !== a.goldStars) return b.goldStars - a.goldStars;
        if (b.championships !== a.championships) return b.championships - a.championships;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDiff - a.pointDiff;
      }
      return 0;
    });

    return filtered;
  }, [filteredTournaments, matches, teams, stars, winMetric, searchQuery]);

  const championTeam = rankedTeams[0];
  const silverTeam = rankedTeams[1];
  const bronzeTeam = rankedTeams[2];

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="bg-slate-950 text-white py-5 md:py-8 px-5 md:px-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Medal className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase">
              Official Leaderboard & Standings
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none mb-2 md:mb-3">
            LEADERBOARD <span className="text-orange-500">& RANKINGS</span>
          </h1>
          <p className="text-slate-400 font-medium text-xs md:text-sm leading-relaxed max-w-2xl opacity-90">
            Institutional sports performance standings, championship tier lists, and athlete win analytics across PSU sports tournaments.
          </p>
        </div>
        <div className="absolute -right-16 -top-16 size-80 bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
        <Trophy className="absolute -bottom-10 -right-8 size-52 text-white/5 rotate-12 group-hover:rotate-6 transition-all duration-700 pointer-events-none" />
      </div>

      {/* Filter Control Section - Clean & Formal Enterprise Styling */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
        {/* Filter Toolbar Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Filter className="size-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Standing Filters
            </h3>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              Select parameters to refine leaderboard view
            </span>
          </div>

          <div className="flex items-center gap-3">
            {(tournamentType !== 'all' || sportCategory !== 'all' || winMetric !== 'overall_wins' || academicYear !== 'current' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-3 text-xs font-semibold text-slate-500 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg gap-1.5 transition-colors"
              >
                <RotateCcw className="size-3" />
                Reset Defaults
              </Button>
            )}
          </div>
        </div>

        {/* Filter Input Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Tournament Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Tournament Category
              </label>
              <Select value={tournamentType} onValueChange={(v) => v && setTournamentType(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="All Tournaments" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all" className="text-xs font-medium">All Competitions</SelectItem>
                  <SelectItem value="Binturungan" className="text-xs font-medium">Binturungan</SelectItem>
                  <SelectItem value="STRASUC" className="text-xs font-medium">STRASUC</SelectItem>
                  <SelectItem value="Faculty and Staff Friendly Games" className="text-xs font-medium">Faculty & Staff Friendly Games</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Sport Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Sport Discipline
              </label>
              <Select value={sportCategory} onValueChange={(v) => v && setSportCategory(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="All Sports" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all" className="text-xs font-medium">All Sports</SelectItem>
                  <SelectItem value="Basketball" className="text-xs font-medium">Basketball</SelectItem>
                  <SelectItem value="Volleyball" className="text-xs font-medium">Volleyball</SelectItem>
                  <SelectItem value="Soccer" className="text-xs font-medium">Soccer / Football</SelectItem>
                  <SelectItem value="Sepak Takraw" className="text-xs font-medium">Sepak Takraw</SelectItem>
                  <SelectItem value="Baseball" className="text-xs font-medium">Baseball</SelectItem>
                  <SelectItem value="Softball" className="text-xs font-medium">Softball</SelectItem>
                  <SelectItem value="Pickleball" className="text-xs font-medium">Pickleball</SelectItem>
                  <SelectItem value="Table Tennis" className="text-xs font-medium">Table Tennis</SelectItem>
                  <SelectItem value="Futsal" className="text-xs font-medium">Futsal</SelectItem>
                  <SelectItem value="Chess" className="text-xs font-medium">Chess</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Win Metric */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Ranking Criterion
              </label>
              <Select value={winMetric} onValueChange={(v) => v && setWinMetric(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="Championships" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="overall_wins" className="text-xs font-medium">Overall Championships (1st Place)</SelectItem>
                  <SelectItem value="most_wins" className="text-xs font-medium">Most Match Wins</SelectItem>
                  <SelectItem value="win_rate" className="text-xs font-medium">Win Ratio Percentage (%)</SelectItem>
                  <SelectItem value="mvp_stars" className="text-xs font-medium">MVP Gold Stars Awarded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Competition Year */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Academic Period
              </label>
              <Select value={academicYear} onValueChange={(v) => v && setAcademicYear(v)}>
                <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="Current Season" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="current" className="text-xs font-medium">Current Season (2026)</SelectItem>
                  <SelectItem value="2025" className="text-xs font-medium">Academic Year 2025</SelectItem>
                  <SelectItem value="2024" className="text-xs font-medium">Academic Year 2024</SelectItem>
                  <SelectItem value="all_time" className="text-xs font-medium">All-Time Cumulative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filter Chips & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">Active Criteria:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                {tournamentType === 'all' ? 'All Competitions' : tournamentType}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                {sportCategory === 'all' ? 'All Sports' : sportCategory}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                {winMetric === 'overall_wins' ? 'Overall Championships' : winMetric === 'most_wins' ? 'Most Match Wins' : winMetric === 'win_rate' ? 'Win Ratio (%)' : 'MVP Gold Stars'}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                {academicYear === 'current' ? 'Current Season (2026)' : academicYear === 'all_time' ? 'All-Time' : `AY ${academicYear}`}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search squad name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-visible:ring-1 focus-visible:ring-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Podium Showcase Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        {/* Rank 2 - Silver Tier */}
        <Card className="rounded-[2.5rem] border-2 border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/90 backdrop-blur-sm p-6 text-center relative overflow-hidden order-2 md:order-1 shadow-md hover:border-slate-400 transition-all">
          <div className="size-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4 text-slate-400 font-black tabular-nums text-2xl shadow-inner">
            2
          </div>
          <div className="flex justify-center mb-1">
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-slate-300 dark:border-slate-700 px-2.5 py-0.5">
              Silver Tier • Runner-Up
            </Badge>
          </div>
          <h4 className="font-black italic uppercase tracking-tight text-xl text-slate-900 dark:text-white truncate">
            {silverTeam?.teamName || 'Silver Spot Open'}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
            {silverTeam ? `${silverTeam.sport} • ${silverTeam.category}` : 'Runner-Up Standings'}
          </p>

          <div className="mt-5 py-4 border-t border-dashed border-slate-200 dark:border-white/10">
            {silverTeam ? (
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>{silverTeam.wins}W - {silverTeam.losses}L</span>
                <span>•</span>
                <span>{silverTeam.winRate.toFixed(0)}% Win</span>
                <span>•</span>
                <span className={silverTeam.pointDiff >= 0 ? 'text-emerald-500' : 'text-slate-400'}>
                  {silverTeam.pointDiff >= 0 ? `+${silverTeam.pointDiff}` : silverTeam.pointDiff} Diff
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-400 italic">Standings compiling...</span>
            )}
          </div>
        </Card>

        {/* Rank 1 - Champion Tier (Gold) */}
        <Card className="rounded-2xl md:rounded-[2.5rem] border-2 border-orange-500 bg-white dark:bg-slate-900 p-6 md:p-8 text-center relative overflow-hidden shadow-2xl shadow-orange-500/15 order-1 md:order-2 scale-100 md:scale-105 border-t-4 border-t-orange-500">
          <div className="size-16 md:size-20 rounded-2xl md:rounded-3xl bg-orange-500 flex items-center justify-center mx-auto mb-4 text-white font-black tabular-nums text-2xl md:text-3xl shadow-xl shadow-orange-500/30">
            <Trophy className="size-8 md:size-10 text-white" />
          </div>
          <div className="flex justify-center mb-2">
            <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 shadow-sm">
              Top Seed • Official Champion
            </Badge>
          </div>
          <h4 className="font-black italic uppercase tracking-tight text-2xl md:text-3xl text-slate-900 dark:text-white truncate">
            {championTeam?.teamName || 'Champion Tier'}
          </h4>
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-0.5 truncate">
            {championTeam ? `${championTeam.sport} • ${championTeam.category}` : 'First Place Leaderboard'}
          </p>

          <div className="mt-5 py-4 border-t border-dashed border-orange-200 dark:border-orange-500/20">
            {championTeam ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {championTeam.championships > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5">
                      <Trophy className="size-3 mr-1 inline" />
                      {championTeam.championships} {championTeam.championships === 1 ? 'Title' : 'Titles'}
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-orange-500/30 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5">
                    {championTeam.wins}W - {championTeam.losses}L Record
                  </Badge>
                </div>
                <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span>{championTeam.winRate.toFixed(0)}% Win Rate</span>
                  <span>•</span>
                  <span>{championTeam.pointsFor} PF</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{championTeam.pointDiff} Diff
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-xs font-bold text-orange-500/80 italic">Awaiting tournament match dataset</span>
            )}
          </div>
        </Card>

        {/* Rank 3 - Bronze Tier */}
        <Card className="rounded-[2.5rem] border-2 border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/90 backdrop-blur-sm p-6 text-center relative overflow-hidden order-3 shadow-md hover:border-amber-700/40 transition-all">
          <div className="size-16 rounded-2xl bg-amber-700/10 dark:bg-amber-500/10 border border-amber-700/20 dark:border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-700 dark:text-amber-500 font-black tabular-nums text-2xl shadow-inner">
            3
          </div>
          <div className="flex justify-center mb-1">
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-500 border-amber-700/30 dark:border-amber-500/30 px-2.5 py-0.5">
              Bronze Tier • 3rd Place
            </Badge>
          </div>
          <h4 className="font-black italic uppercase tracking-tight text-xl text-slate-900 dark:text-white truncate">
            {bronzeTeam?.teamName || (rankedTeams.length <= 2 && rankedTeams.length > 0 ? 'Spot Open (2-Team Division)' : 'Bronze Spot Open')}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
            {bronzeTeam ? `${bronzeTeam.sport} • ${bronzeTeam.category}` : '3rd Place Standings'}
          </p>

          <div className="mt-5 py-4 border-t border-dashed border-slate-200 dark:border-white/10">
            {bronzeTeam ? (
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>{bronzeTeam.wins}W - {bronzeTeam.losses}L</span>
                <span>•</span>
                <span>{bronzeTeam.winRate.toFixed(0)}% Win</span>
                <span>•</span>
                <span className={bronzeTeam.pointDiff >= 0 ? 'text-emerald-500' : 'text-slate-400'}>
                  {bronzeTeam.pointDiff >= 0 ? `+${bronzeTeam.pointDiff}` : bronzeTeam.pointDiff} Diff
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-400 italic">
                {rankedTeams.length <= 2 && rankedTeams.length > 0 ? 'Requires 3+ teams in bracket' : 'Standings compiling...'}
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Official PSU Standings & Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Trophy className="size-4 text-orange-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Official Athletic Leaderboard
            </h3>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs text-slate-500 font-normal">
              {rankedTeams.length} {rankedTeams.length === 1 ? 'Squad Ranked' : 'Squads Ranked'}
            </span>
          </div>

          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-500/10">
            {winMetric === 'overall_wins' ? 'Sorted by Gold Championships' : winMetric === 'most_wins' ? 'Sorted by Total Wins' : winMetric === 'win_rate' ? 'Sorted by Win Ratio' : 'Sorted by MVP Gold Stars'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading live rankings...</p>
          </div>
        ) : rankedTeams.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="size-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto text-orange-500 mb-3">
              <Shield className="size-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-tight">
              No Standings Records Found
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              No tournament teams match the active criteria. Adjust filters or reset to view all university athletic standings.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800"
            >
              <RotateCcw className="size-3.5" />
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Rank</th>
                  <th className="py-3.5 px-4">Squad / Program</th>
                  <th className="py-3.5 px-4">Discipline</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-3 text-center">MP</th>
                  <th className="py-3.5 px-3 text-center">W</th>
                  <th className="py-3.5 px-3 text-center">L</th>
                  <th className="py-3.5 px-4 text-center">Win %</th>
                  <th className="py-3.5 px-4 text-center">PF - PA</th>
                  <th className="py-3.5 px-4 text-center">Diff</th>
                  <th className="py-3.5 px-4 text-center">Titles</th>
                  <th className="py-3.5 px-6 text-right">Standing Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rankedTeams.map((team, idx) => {
                  const rank = idx + 1;
                  return (
                    <tr
                      key={team.key}
                      className={`transition-colors ${
                        rank === 1
                          ? 'bg-orange-50/40 dark:bg-orange-500/5 font-semibold'
                          : rank === 2
                          ? 'bg-slate-50/40 dark:bg-slate-800/20'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-4 px-6 font-black">
                        <div className="flex items-center gap-2">
                          {rank === 1 ? (
                            <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-lg gap-1 shadow-sm">
                              <Trophy className="size-3" /> #1 Gold
                            </Badge>
                          ) : rank === 2 ? (
                            <Badge className="bg-slate-400 hover:bg-slate-400 text-white font-black text-[10px] px-2.5 py-0.5 rounded-lg gap-1">
                              <Medal className="size-3" /> #2 Silver
                            </Badge>
                          ) : rank === 3 ? (
                            <Badge className="bg-amber-700 hover:bg-amber-700 text-white font-black text-[10px] px-2.5 py-0.5 rounded-lg gap-1">
                              <Medal className="size-3" /> #3 Bronze
                            </Badge>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                              #{rank}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white text-sm">
                            {team.teamName}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 truncate max-w-[220px]">
                            {team.tournaments.join(', ') || 'PSU Athletic League'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                          {team.sport}
                        </Badge>
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {team.category}
                        </span>
                      </td>

                      <td className="py-4 px-3 text-center font-bold text-slate-600 dark:text-slate-300">
                        {team.matchesPlayed}
                      </td>

                      <td className="py-4 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                        {team.wins}
                      </td>

                      <td className="py-4 px-3 text-center font-black text-slate-400">
                        {team.losses}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-200">
                        {team.winRate.toFixed(1)}%
                      </td>

                      <td className="py-4 px-4 text-center font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {team.pointsFor} - {team.pointsAgainst}
                      </td>

                      <td className="py-4 px-4 text-center font-black">
                        <span className={team.pointDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : team.pointDiff < 0 ? 'text-rose-500' : 'text-slate-400'}>
                          {team.pointDiff > 0 ? `+${team.pointDiff}` : team.pointDiff}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {team.championships > 0 ? (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
                            <Trophy className="size-3" />
                            {team.championships} {team.championships === 1 ? 'Gold' : 'Golds'}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 font-bold">-</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        {rank === 1 ? (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black text-[9px] uppercase tracking-wider">
                            Champion Tier
                          </Badge>
                        ) : rank === 2 ? (
                          <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 font-black text-[9px] uppercase tracking-wider">
                            Silver Tier
                          </Badge>
                        ) : rank === 3 ? (
                          <Badge className="bg-amber-700/10 text-amber-700 dark:text-amber-500 border border-amber-700/20 font-black text-[9px] uppercase tracking-wider">
                            Bronze Tier
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 font-bold text-[9px] uppercase">
                            Contender
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info Callout */}
      <Card className="border border-slate-200/80 dark:border-white/10 rounded-2xl py-5 px-6 bg-slate-50/50 dark:bg-slate-900/30 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Official University Athletic Records
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Rankings synchronize automatically upon tournament match finalization and administrative championship seals.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold shrink-0">
          <CheckCircle2 className="size-4 text-emerald-500" />
          <span className="text-[11px]">Real-Time Sync Active</span>
        </div>
      </Card>
    </div>
  );
};

