import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Sparkles, Shield, RotateCcw, Search, CheckCircle2, GraduationCap, Users, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { type ExpandableTabItem } from '@/components/ui/expandable-icon-tabs';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

interface CollegeEntity {
  id: string;
  college_name: string;
}

interface ClusterEntity {
  id: string;
  name: string;
  description: string;
  college_codes?: string[];
}

interface RankedEntity {
  key: string;
  id?: string;
  name: string;
  code?: string;
  subtitle?: string;
  type: 'college' | 'cluster' | 'squad';
  clusterName?: string;
  collegeName?: string;
  memberColleges?: string[];
  sport?: string;
  category?: string;
  tournaments: string[];
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  championships: number; // Gold
  runnerUps: number;     // Silver
  bronzeFinishes: number;// Bronze
  goldStars: number;
  squadCount?: number;
  disciplines?: string[];
}

export const Ranking = () => {
  // Standing View Mode: College vs Cluster vs Squad
  const [standingView, setStandingView] = useState<'college' | 'cluster' | 'squad'>('college');

  // Mobile UX States: Collapsible Filter & Expanded Table Row
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

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
  const [colleges, setColleges] = useState<CollegeEntity[]>([]);
  const [clusters, setClusters] = useState<ClusterEntity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch all relevant athletic datasets
  useEffect(() => {
    fetchRankingDatasets();
  }, []);

  const fetchRankingDatasets = async () => {
    setIsLoading(true);
    try {
      const [tRes, tmRes, mRes, sRes, colRes, clRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, sport, type, status, start_date, end_date')
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase
          .from('teams')
          .select('id, name, tournament_id, status, affiliation_type, college_id, cluster_id, colleges:college_id(id, college_name), clusters:cluster_id(id, name, description)')
          .eq('status', 'Approved')
          .or('is_deleted.is.null,is_deleted.eq.false'),
        supabase
          .from('matches')
          .select('id, tournament_id, round, status, team_a_id, team_b_id, team_a_score, team_b_score, match_time, venue, team_a:team_a_id(name), team_b:team_b_id(name)'),
        supabase
          .from('player_stars')
          .select('id, player_id, tournament_id, star_type'),
        supabase
          .from('colleges')
          .select('id, college_name'),
        supabase
          .from('clusters')
          .select('id, name, description, college_codes')
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
      if (colRes.data) setColleges(colRes.data);
      if (clRes.data) setClusters(clRes.data);
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
    setStandingView('college');
  };

  // Helper: Extract abbreviation code from full college title
  const extractCollegeCode = (name: string): string => {
    const match = name.match(/\(([^)]+)\)/);
    if (match) return match[1].trim();
    return name.trim();
  };

  // Helper: Extract human readable short department title
  const getCollegeShortName = (name: string): string => {
    return name.replace(/\s*\([^)]*\)/g, '').replace(/^College of\s+/i, '').replace(/^School of\s+/i, '').trim();
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

  // 2. Compute dynamic standings: College, Cluster / Tribe, or Squad
  const rankedEntities = useMemo<RankedEntity[]>(() => {
    if (filteredTournaments.length === 0) return [];

    const tournMap = new Map(filteredTournaments.map(t => [t.id, t]));
    const tournIds = new Set(filteredTournaments.map(t => t.id));

    const relevantMatches = matches.filter(m => tournIds.has(m.tournament_id));
    const relevantTeams = teams.filter(t => tournIds.has(t.tournament_id));

    const collegesMap = new Map(colleges.map(c => [c.id, c]));
    const clustersMap = new Map(clusters.map(cl => [cl.id, cl]));
    const teamsMap = new Map(teams.map(tm => [tm.id, tm]));

    // Helper: Resolve College for any team record
    const getTeamCollege = (team: any): CollegeEntity | null => {
      if (!team) return null;
      if (team.college_id && collegesMap.has(team.college_id)) {
        return collegesMap.get(team.college_id)!;
      }
      const tName = (team.name || '').toLowerCase();
      for (const col of colleges) {
        const code = extractCollegeCode(col.college_name).toLowerCase();
        if (tName.includes(code)) return col;
      }
      return null;
    };

    // Helper: Resolve Cluster / Tribe for any team or college record
    const getTeamCluster = (team: any, teamCollege?: CollegeEntity | null): ClusterEntity | null => {
      if (team?.cluster_id && clustersMap.has(team.cluster_id)) {
        return clustersMap.get(team.cluster_id)!;
      }
      const col = teamCollege || getTeamCollege(team);
      if (col) {
        const code = extractCollegeCode(col.college_name);
        const matched = clusters.find(cl => cl.college_codes && cl.college_codes.includes(code));
        if (matched) return matched;
      }
      return null;
    };

    // Map crowned champions, runner-ups, and bronze finishes per tournament
    const tournChampions = new Map<string, string>(); // tournId -> champion teamId
    const tournRunnerUps = new Map<string, string>(); // tournId -> runner-up teamId
    const tournBronze = new Map<string, string>();    // tournId -> bronze teamId

    filteredTournaments.forEach(tourn => {
      const tourMatches = relevantMatches.filter(m => m.tournament_id === tourn.id);
      if (tourMatches.length === 0) return;

      const isRoundRobinOnly = tourMatches.every(
        m => (m.round || '').toLowerCase().includes('round robin') && !m.next_match_id
      );

      if (isRoundRobinOnly) {
        if (tourMatches.every(m => m.status === 'Completed')) {
          const rrStats = new Map<string, { wins: number; pf: number; pa: number }>();
          tourMatches.forEach(m => {
            if (m.team_a_id && !rrStats.has(m.team_a_id)) rrStats.set(m.team_a_id, { wins: 0, pf: 0, pa: 0 });
            if (m.team_b_id && !rrStats.has(m.team_b_id)) rrStats.set(m.team_b_id, { wins: 0, pf: 0, pa: 0 });
            const sA = m.team_a_score || 0;
            const sB = m.team_b_score || 0;
            const tA = m.team_a_id ? rrStats.get(m.team_a_id) : undefined;
            const tB = m.team_b_id ? rrStats.get(m.team_b_id) : undefined;
            if (tA) {
              tA.pf += sA;
              tA.pa += sB;
              if (sA > sB) tA.wins += 1;
            }
            if (tB) {
              tB.pf += sB;
              tB.pa += sA;
              if (sB > sA) tB.wins += 1;
            }
          });
          const sortedRR = Array.from(rrStats.entries()).sort((a, b) => {
            if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
            const diffA = a[1].pf - a[1].pa;
            const diffB = b[1].pf - b[1].pa;
            if (diffB !== diffA) return diffB - diffA;
            return b[1].pf - a[1].pf;
          });
          if (sortedRR[0]?.[0]) tournChampions.set(tourn.id, sortedRR[0][0]);
          if (sortedRR[1]?.[0]) tournRunnerUps.set(tourn.id, sortedRR[1][0]);
          if (sortedRR[2]?.[0]) tournBronze.set(tourn.id, sortedRR[2][0]);
        }
        return;
      }

      // Detect Finals match (Grand Finals for Double Elim, or Finals for Single Elim)
      const finalsMatch = tourMatches.find(m => {
        const r = (m.round || '').toLowerCase();
        return (
          r.includes('grand final') ||
          (r.includes('final') &&
            !r.includes('semi') &&
            !r.includes('quarter') &&
            !r.includes('bronze') &&
            !r.includes('3rd') &&
            !r.includes('upper') &&
            !r.includes('lower'))
        );
      });

      if (finalsMatch && (finalsMatch.status === 'Completed' || (finalsMatch.team_a_score || 0) > 0 || (finalsMatch.team_b_score || 0) > 0)) {
        const scoreA = finalsMatch.team_a_score || 0;
        const scoreB = finalsMatch.team_b_score || 0;
        const winnerId = scoreA >= scoreB ? finalsMatch.team_a_id : finalsMatch.team_b_id;
        const loserId = scoreA >= scoreB ? finalsMatch.team_b_id : finalsMatch.team_a_id;
        if (winnerId) tournChampions.set(tourn.id, winnerId);
        if (loserId) tournRunnerUps.set(tourn.id, loserId);
      }

      // Detect Bronze match (3rd Place Playoff winner OR Lower Finals loser in Double Elim)
      const bronzeMatch = tourMatches.find(m => {
        const r = (m.round || '').toLowerCase();
        return r.includes('bronze') || r.includes('3rd') || r.includes('lower final');
      });

      if (bronzeMatch && (bronzeMatch.status === 'Completed' || (bronzeMatch.team_a_score || 0) > 0 || (bronzeMatch.team_b_score || 0) > 0)) {
        const scoreA = bronzeMatch.team_a_score || 0;
        const scoreB = bronzeMatch.team_b_score || 0;
        const isLowerFinal = (bronzeMatch.round || '').toLowerCase().includes('lower final');
        const bronzeTeamId = isLowerFinal
          ? (scoreA >= scoreB ? bronzeMatch.team_b_id : bronzeMatch.team_a_id)
          : (scoreA >= scoreB ? bronzeMatch.team_a_id : bronzeMatch.team_b_id);
        if (bronzeTeamId) tournBronze.set(tourn.id, bronzeTeamId);
      }
    });

    // Sort comparator
    const sortEntities = (list: RankedEntity[]) => {
      return list.sort((a, b) => {
        if (winMetric === 'overall_wins') {
          if (b.championships !== a.championships) return b.championships - a.championships;
          if (b.runnerUps !== a.runnerUps) return b.runnerUps - a.runnerUps;
          if (b.bronzeFinishes !== a.bronzeFinishes) return b.bronzeFinishes - a.bronzeFinishes;
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
    };

    // =========================================================================
    // OPTION 1: COLLEGE STANDINGS
    // =========================================================================
    if (standingView === 'college') {
      const collegeStats = new Map<string, RankedEntity>();

      colleges.forEach(col => {
        const code = extractCollegeCode(col.college_name);
        const cluster = getTeamCluster(null, col);
        collegeStats.set(col.id, {
          key: col.id,
          id: col.id,
          name: col.college_name,
          code,
          subtitle: getCollegeShortName(col.college_name),
          type: 'college',
          clusterName: cluster?.name,
          tournaments: [],
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
          squadCount: 0,
          disciplines: []
        });
      });

      // Populate participating squads and tournaments
      relevantTeams.forEach(t => {
        const col = getTeamCollege(t);
        if (col && collegeStats.has(col.id)) {
          const stat = collegeStats.get(col.id)!;
          stat.squadCount = (stat.squadCount || 0) + 1;
          const tourn = tournMap.get(t.tournament_id);
          if (tourn?.name && !stat.tournaments.includes(tourn.name)) {
            stat.tournaments.push(tourn.name);
          }
          if (tourn?.sport && !stat.disciplines?.includes(tourn.sport)) {
            stat.disciplines?.push(tourn.sport);
          }
        }
      });

      // Medals from Tournament podium finishes
      filteredTournaments.forEach(tourn => {
        const champId = tournChampions.get(tourn.id);
        if (champId) {
          const champTeam = teamsMap.get(champId);
          const col = getTeamCollege(champTeam);
          if (col && collegeStats.has(col.id)) {
            collegeStats.get(col.id)!.championships += 1;
          }
        }
        const runnerUpId = tournRunnerUps.get(tourn.id);
        if (runnerUpId) {
          const runnerTeam = teamsMap.get(runnerUpId);
          const col = getTeamCollege(runnerTeam);
          if (col && collegeStats.has(col.id)) {
            collegeStats.get(col.id)!.runnerUps += 1;
          }
        }
        const bronzeId = tournBronze.get(tourn.id);
        if (bronzeId) {
          const bronzeTeam = teamsMap.get(bronzeId);
          const col = getTeamCollege(bronzeTeam);
          if (col && collegeStats.has(col.id)) {
            collegeStats.get(col.id)!.bronzeFinishes += 1;
          }
        }
      });

      // Process match scores and records
      relevantMatches.forEach(m => {
        if (m.status === 'Completed' || (m.team_a_score || 0) > 0 || (m.team_b_score || 0) > 0) {
          const scoreA = m.team_a_score || 0;
          const scoreB = m.team_b_score || 0;

          const teamA = teamsMap.get(m.team_a_id) || { name: m.team_a_name };
          const teamB = teamsMap.get(m.team_b_id) || { name: m.team_b_name };

          const colA = getTeamCollege(teamA);
          const colB = getTeamCollege(teamB);

          if (colA && collegeStats.has(colA.id)) {
            const statA = collegeStats.get(colA.id)!;
            statA.matchesPlayed += 1;
            statA.pointsFor += scoreA;
            statA.pointsAgainst += scoreB;
            if (scoreA > scoreB) statA.wins += 1;
            else if (scoreA < scoreB) statA.losses += 1;
          }

          if (colB && collegeStats.has(colB.id)) {
            const statB = collegeStats.get(colB.id)!;
            statB.matchesPlayed += 1;
            statB.pointsFor += scoreB;
            statB.pointsAgainst += scoreA;
            if (scoreB > scoreA) statB.wins += 1;
            else if (scoreB < scoreA) statB.losses += 1;
          }
        }
      });

      let results = Array.from(collegeStats.values()).map(c => ({
        ...c,
        pointDiff: c.pointsFor - c.pointsAgainst,
        winRate: c.matchesPlayed > 0 ? (c.wins / c.matchesPlayed) * 100 : 0
      }));

      // If sport filter is active, only show colleges active in that sport
      if (sportCategory !== 'all') {
        results = results.filter(c => c.matchesPlayed > 0 || c.championships > 0 || (c.squadCount || 0) > 0);
      }

      // Search filter
      const filtered = results.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) ||
               (c.code && c.code.toLowerCase().includes(q)) ||
               (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
               (c.clusterName && c.clusterName.toLowerCase().includes(q));
      });

      return sortEntities(filtered);
    }

    // =========================================================================
    // OPTION 2: CLUSTER / TRIBE STANDINGS
    // =========================================================================
    if (standingView === 'cluster') {
      const clusterStats = new Map<string, RankedEntity>();

      clusters.forEach(cl => {
        clusterStats.set(cl.id, {
          key: cl.id,
          id: cl.id,
          name: cl.name,
          subtitle: cl.description,
          type: 'cluster',
          memberColleges: cl.college_codes || [],
          tournaments: [],
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
          squadCount: 0,
          disciplines: []
        });
      });

      // Count squads per tribe
      relevantTeams.forEach(t => {
        const col = getTeamCollege(t);
        const cluster = getTeamCluster(t, col);
        if (cluster && clusterStats.has(cluster.id)) {
          const stat = clusterStats.get(cluster.id)!;
          stat.squadCount = (stat.squadCount || 0) + 1;
          const tourn = tournMap.get(t.tournament_id);
          if (tourn?.name && !stat.tournaments.includes(tourn.name)) {
            stat.tournaments.push(tourn.name);
          }
          if (tourn?.sport && !stat.disciplines?.includes(tourn.sport)) {
            stat.disciplines?.push(tourn.sport);
          }
        }
      });

      // Medals from Tournament podium finishes
      filteredTournaments.forEach(tourn => {
        const champId = tournChampions.get(tourn.id);
        if (champId) {
          const champTeam = teamsMap.get(champId);
          const col = getTeamCollege(champTeam);
          const cluster = getTeamCluster(champTeam, col);
          if (cluster && clusterStats.has(cluster.id)) {
            clusterStats.get(cluster.id)!.championships += 1;
          }
        }
        const runnerUpId = tournRunnerUps.get(tourn.id);
        if (runnerUpId) {
          const runnerTeam = teamsMap.get(runnerUpId);
          const col = getTeamCollege(runnerTeam);
          const cluster = getTeamCluster(runnerTeam, col);
          if (cluster && clusterStats.has(cluster.id)) {
            clusterStats.get(cluster.id)!.runnerUps += 1;
          }
        }
        const bronzeId = tournBronze.get(tourn.id);
        if (bronzeId) {
          const bronzeTeam = teamsMap.get(bronzeId);
          const col = getTeamCollege(bronzeTeam);
          const cluster = getTeamCluster(bronzeTeam, col);
          if (cluster && clusterStats.has(cluster.id)) {
            clusterStats.get(cluster.id)!.bronzeFinishes += 1;
          }
        }
      });

      // Process match scores and records
      relevantMatches.forEach(m => {
        if (m.status === 'Completed' || (m.team_a_score || 0) > 0 || (m.team_b_score || 0) > 0) {
          const scoreA = m.team_a_score || 0;
          const scoreB = m.team_b_score || 0;

          const teamA = teamsMap.get(m.team_a_id) || { name: m.team_a_name };
          const teamB = teamsMap.get(m.team_b_id) || { name: m.team_b_name };

          const colA = getTeamCollege(teamA);
          const colB = getTeamCollege(teamB);

          const clA = getTeamCluster(teamA, colA);
          const clB = getTeamCluster(teamB, colB);

          if (clA && clusterStats.has(clA.id)) {
            const statA = clusterStats.get(clA.id)!;
            statA.matchesPlayed += 1;
            statA.pointsFor += scoreA;
            statA.pointsAgainst += scoreB;
            if (scoreA > scoreB) statA.wins += 1;
            else if (scoreA < scoreB) statA.losses += 1;
          }

          if (clB && clusterStats.has(clB.id)) {
            const statB = clusterStats.get(clB.id)!;
            statB.matchesPlayed += 1;
            statB.pointsFor += scoreB;
            statB.pointsAgainst += scoreA;
            if (scoreB > scoreA) statB.wins += 1;
            else if (scoreB < scoreA) statB.losses += 1;
          }
        }
      });

      const results = Array.from(clusterStats.values()).map(c => ({
        ...c,
        pointDiff: c.pointsFor - c.pointsAgainst,
        winRate: c.matchesPlayed > 0 ? (c.wins / c.matchesPlayed) * 100 : 0
      }));

      // Search filter
      const filtered = results.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) ||
               (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
               (c.memberColleges && c.memberColleges.some(m => m.toLowerCase().includes(q)));
      });

      return sortEntities(filtered);
    }

    // =========================================================================
    // OPTION 3: SQUAD STANDINGS (INDIVIDUAL TEAMS)
    // =========================================================================
    const teamStatsMap = new Map<string, RankedEntity>();

    relevantTeams.forEach(t => {
      const tourn = tournMap.get(t.tournament_id);
      const sport = tourn?.sport || 'General';
      const category = tourn?.type || 'Binturungan';
      const key = `${t.name.trim().toLowerCase()}__${sport.toLowerCase()}`;

      const col = getTeamCollege(t);
      const cluster = getTeamCluster(t, col);

      if (!teamStatsMap.has(key)) {
        teamStatsMap.set(key, {
          key,
          id: t.id,
          name: t.name.trim(),
          sport,
          category,
          type: 'squad',
          code: col ? extractCollegeCode(col.college_name) : undefined,
          collegeName: col?.college_name,
          clusterName: cluster?.name,
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

    // Ensure teams appearing in matches are tracked
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
          const colA = getTeamCollege(teamAObj);
          const clA = getTeamCluster(teamAObj, colA);
          teamStatsMap.set(keyA, {
            key: keyA,
            name: nameA.trim(),
            sport,
            category,
            type: 'squad',
            code: colA ? extractCollegeCode(colA.college_name) : undefined,
            collegeName: colA?.college_name,
            clusterName: clA?.name,
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
          const colB = getTeamCollege(teamBObj);
          const clB = getTeamCluster(teamBObj, colB);
          teamStatsMap.set(keyB, {
            key: keyB,
            name: nameB.trim(),
            sport,
            category,
            type: 'squad',
            code: colB ? extractCollegeCode(colB.college_name) : undefined,
            collegeName: colB?.college_name,
            clusterName: clB?.name,
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

    // Process squad matches
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

    const allList = Array.from(teamStatsMap.values()).map(t => {
      const pointDiff = t.pointsFor - t.pointsAgainst;
      const winRate = t.matchesPlayed > 0 ? (t.wins / t.matchesPlayed) * 100 : 0;
      return {
        ...t,
        pointDiff,
        winRate,
      };
    });

    const filtered = allList.filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || 
             (t.code && t.code.toLowerCase().includes(q)) ||
             (t.clusterName && t.clusterName.toLowerCase().includes(q)) ||
             (t.sport && t.sport.toLowerCase().includes(q)) || 
             (t.category && t.category.toLowerCase().includes(q));
    });

    return sortEntities(filtered);
  }, [filteredTournaments, matches, teams, stars, colleges, clusters, winMetric, searchQuery, standingView]);

  const championEntity = rankedEntities[0];
  const silverEntity = rankedEntities[1];
  const bronzeEntity = rankedEntities[2];

  const standingTabs: ExpandableTabItem[] = [
    {
      id: 'college',
      label: 'College Standings',
      shortLabel: 'Colleges',
      icon: GraduationCap,
      count: colleges.length > 0 ? colleges.length : undefined,
    },
    {
      id: 'cluster',
      label: 'Cluster / Tribe Standings',
      shortLabel: 'Tribes',
      icon: Users,
      count: clusters.length > 0 ? clusters.length : undefined,
    },
    {
      id: 'squad',
      label: 'Squad Standings',
      shortLabel: 'Squads',
      icon: Shield,
      count: teams.length > 0 ? teams.length : undefined,
    },
  ];

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (tournamentType !== 'all') count++;
    if (sportCategory !== 'all') count++;
    if (winMetric !== 'overall_wins') count++;
    if (academicYear !== 'current') count++;
    return count;
  }, [tournamentType, sportCategory, winMetric, academicYear]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 w-full min-w-0 max-w-full overflow-x-hidden animate-in fade-in duration-500">
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
            Institutional sports performance standings, championship tier lists, and authentic Palawan State University Binturungan festival leaderboards.
          </p>
        </div>
        <div className="absolute -right-16 -top-16 size-80 bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
        <Trophy className="absolute -bottom-10 -right-8 size-52 text-white/5 rotate-12 group-hover:rotate-6 transition-all duration-700 pointer-events-none" />
      </div>

      {/* Standings View Format Selector: Balanced Centered Control */}
      <div className="flex justify-center w-full">
        <div className="w-full sm:w-auto p-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {standingTabs.map((tab) => {
              const isActive = standingView === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStandingView(tab.id as any)}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-tight italic transition-all cursor-pointer min-w-0 ${
                    isActive
                      ? 'flex-1 sm:flex-initial bg-orange-500 text-white shadow-md shadow-orange-500/25'
                      : 'shrink-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`size-4 sm:size-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className={`truncate ${isActive ? 'inline' : 'hidden sm:inline'}`}>{tab.shortLabel || tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Control Section: Collapsible Drawer on Mobile */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
        {/* Main Filter Action Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={standingView === 'college' ? 'Search college or code...' : standingView === 'cluster' ? 'Search tribe or campus...' : 'Search squad name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-visible:ring-1 focus-visible:ring-orange-500 w-full font-medium"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`h-9 px-3 rounded-xl text-xs font-bold gap-1.5 cursor-pointer transition-all ${
                isFiltersExpanded || activeFiltersCount > 0
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal className="size-3.5 text-orange-500" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[9px] font-black leading-none">
                  {activeFiltersCount}
                </span>
              )}
              {isFiltersExpanded ? <ChevronUp className="size-3 text-slate-400 ml-0.5 hidden sm:block" /> : <ChevronDown className="size-3 text-slate-400 ml-0.5 hidden sm:block" />}
            </Button>

            {(activeFiltersCount > 0 || searchQuery || standingView !== 'college') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 text-xs font-semibold text-slate-500 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl gap-1 transition-colors cursor-pointer"
                title="Reset Defaults"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Criteria Chips Preview (Shown only when non-default filters or search are active) */}
        {(activeFiltersCount > 0 || searchQuery) && (
          <div className="px-3 sm:px-4 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-[10px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] shrink-0">Filtered By:</span>
            {tournamentType !== 'all' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/30 shrink-0">
                {tournamentType}
              </span>
            )}
            {sportCategory !== 'all' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/30 shrink-0">
                {sportCategory}
              </span>
            )}
            {winMetric !== 'overall_wins' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/30 shrink-0">
                {winMetric === 'most_wins' ? 'Wins' : winMetric === 'win_rate' ? 'Win %' : 'Stars'}
              </span>
            )}
            {academicYear !== 'current' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-500/30 shrink-0">
                {academicYear === 'all_time' ? 'All-Time' : `AY ${academicYear}`}
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                "{searchQuery}"
              </span>
            )}
          </div>
        )}

        {/* Collapsible Filter Dropdowns (Visible when expanded or on lg: screens) */}
        <div className={`p-3.5 sm:p-5 ${isFiltersExpanded ? 'block' : 'hidden lg:block'} transition-all duration-300 border-t border-slate-100 dark:border-slate-800`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Tournament Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Tournament Category
              </label>
              <Select value={tournamentType} onValueChange={(v) => v && setTournamentType(v)}>
                <SelectTrigger className="h-9 sm:h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
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
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Ballgame Discipline
              </label>
              <Select value={sportCategory} onValueChange={(v) => v && setSportCategory(v)}>
                <SelectTrigger className="h-9 sm:h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
                  <SelectValue placeholder="All Ballgames" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value="all" className="text-xs font-medium">All Ballgames</SelectItem>
                  <SelectItem value="Basketball" className="text-xs font-medium">Basketball</SelectItem>
                  <SelectItem value="Volleyball" className="text-xs font-medium">Volleyball</SelectItem>
                  <SelectItem value="Soccer" className="text-xs font-medium">Soccer / Football</SelectItem>
                  <SelectItem value="Sepak Takraw" className="text-xs font-medium">Sepak Takraw</SelectItem>
                  <SelectItem value="Baseball" className="text-xs font-medium">Baseball</SelectItem>
                  <SelectItem value="Softball" className="text-xs font-medium">Softball</SelectItem>
                  <SelectItem value="Pickleball" className="text-xs font-medium">Pickleball</SelectItem>
                  <SelectItem value="Table Tennis" className="text-xs font-medium">Table Tennis</SelectItem>
                  <SelectItem value="Futsal" className="text-xs font-medium">Futsal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Win Metric */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Ranking Criterion
              </label>
              <Select value={winMetric} onValueChange={(v) => v && setWinMetric(v)}>
                <SelectTrigger className="h-9 sm:h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
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
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Academic Period
              </label>
              <Select value={academicYear} onValueChange={(v) => v && setAcademicYear(v)}>
                <SelectTrigger className="h-9 sm:h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-none hover:border-slate-300 dark:hover:border-slate-700 focus:ring-1 focus:ring-slate-400 transition-colors">
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
        </div>
      </div>

      {/* Podium Showcase Section */}
      {isLoading ? (
        <SkeletonCard variant="podium" />
      ) : (
        <>
          {/* MOBILE PODIUM (< md): Compact #1 Spotlight + #2 & #3 Side-by-Side (Fits in ~190px total!) */}
      <div className="md:hidden space-y-2.5">
        {/* #1 Champion Spotlight Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border-2 border-orange-500 p-3.5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/30">
              <Trophy className="size-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[8px] font-black uppercase tracking-wider">
                  #1 Champion
                </span>
                {championEntity?.code && (
                  <span className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[9px] font-black">
                    {championEntity.code}
                  </span>
                )}
              </div>
              <h4 className="font-black italic uppercase tracking-tight text-base sm:text-lg text-slate-900 dark:text-white leading-snug break-words mt-0.5">
                {championEntity?.name || 'Champion Tier'}
              </h4>
              <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider truncate">
                {championEntity
                  ? (standingView === 'college' ? `Tribe: ${championEntity.clusterName || 'PSU Binturungan'}` : standingView === 'cluster' ? (championEntity.subtitle || 'Binturungan Tribe') : `${championEntity.sport} • ${championEntity.category}`)
                  : 'Leaderboard Leader'}
              </p>
            </div>
          </div>
          {championEntity && (
            <div className="mt-2.5 pt-2 border-t border-orange-500/20 flex items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300 flex-wrap gap-1">
              <span className="text-orange-600 dark:text-orange-400 font-black">
                {championEntity.championships > 0 ? `${championEntity.championships} Gold Title${championEntity.championships > 1 ? 's' : ''}` : `${championEntity.wins}W - ${championEntity.losses}L`}
              </span>
              <span>{championEntity.winRate.toFixed(0)}% Win</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                {championEntity.pointDiff >= 0 ? `+${championEntity.pointDiff}` : championEntity.pointDiff} Diff
              </span>
            </div>
          )}
        </div>

        {/* #2 Silver and #3 Bronze: Side-by-Side in 2-Columns */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* #2 Silver Card */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-2.5 text-center flex flex-col justify-between">
            <div>
              <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black uppercase">
                #2 Silver
              </span>
              <h5 className="font-black italic uppercase text-xs text-slate-900 dark:text-white truncate mt-1 leading-tight" title={silverEntity?.name}>
                {silverEntity?.code || silverEntity?.name || 'Silver'}
              </h5>
              <p className="text-[9px] text-slate-400 truncate mt-0.5">
                {silverEntity?.name}
              </p>
            </div>
            {silverEntity && (
              <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 text-[9px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-around">
                <span>{silverEntity.wins}W - {silverEntity.losses}L</span>
                <span className={silverEntity.pointDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                  {silverEntity.pointDiff >= 0 ? `+${silverEntity.pointDiff}` : silverEntity.pointDiff}
                </span>
              </div>
            )}
          </div>

          {/* #3 Bronze Card */}
          <div className="rounded-xl border border-amber-700/30 dark:border-amber-500/30 bg-white dark:bg-slate-900 p-2.5 text-center flex flex-col justify-between">
            <div>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-500 text-[8px] font-black uppercase">
                #3 Bronze
              </span>
              <h5 className="font-black italic uppercase text-xs text-slate-900 dark:text-white truncate mt-1 leading-tight" title={bronzeEntity?.name}>
                {bronzeEntity?.code || bronzeEntity?.name || 'Bronze'}
              </h5>
              <p className="text-[9px] text-slate-400 truncate mt-0.5">
                {bronzeEntity?.name}
              </p>
            </div>
            {bronzeEntity && (
              <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 text-[9px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-around">
                <span>{bronzeEntity.wins}W - {bronzeEntity.losses}L</span>
                <span className={bronzeEntity.pointDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                  {bronzeEntity.pointDiff >= 0 ? `+${bronzeEntity.pointDiff}` : bronzeEntity.pointDiff}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP PODIUM (md:grid): Standard 3-column classic podium */}
      <div className="hidden md:grid md:grid-cols-3 gap-6 items-end">
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
            {silverEntity?.name || 'Silver Spot Open'}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
            {silverEntity
              ? (standingView === 'college' ? `Tribe: ${silverEntity.clusterName || 'Affiliated'}` : standingView === 'cluster' ? (silverEntity.subtitle || 'Binturungan Tribe') : `${silverEntity.sport} • ${silverEntity.category}`)
              : 'Runner-Up Standings'}
          </p>

          <div className="mt-5 py-4 border-t border-dashed border-slate-200 dark:border-white/10">
            {silverEntity ? (
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>{silverEntity.wins}W - {silverEntity.losses}L</span>
                <span>•</span>
                <span>{silverEntity.winRate.toFixed(0)}% Win</span>
                <span>•</span>
                <span className={silverEntity.pointDiff >= 0 ? 'text-emerald-500' : 'text-slate-400'}>
                  {silverEntity.pointDiff >= 0 ? `+${silverEntity.pointDiff}` : silverEntity.pointDiff} Diff
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
              {standingView === 'college' ? 'Top Seed • College Champion' : standingView === 'cluster' ? 'Top Seed • Binturungan Tribe Champion' : 'Top Seed • Official Squad Champion'}
            </Badge>
          </div>
          <h4 className="font-black italic uppercase tracking-tight text-2xl md:text-3xl text-slate-900 dark:text-white truncate">
            {championEntity?.name || 'Champion Tier'}
          </h4>
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-0.5 truncate">
            {championEntity
              ? (standingView === 'college' ? `Designated Tribe: ${championEntity.clusterName || 'Authentic Binturungan'}` : standingView === 'cluster' ? (championEntity.subtitle || 'Palawan State University Tribe') : `${championEntity.sport} • ${championEntity.category}`)
              : 'First Place Leaderboard'}
          </p>

          <div className="mt-5 py-4 border-t border-dashed border-orange-200 dark:border-orange-500/20">
            {championEntity ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {championEntity.championships > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5">
                      <Trophy className="size-3 mr-1 inline" />
                      {championEntity.championships} {championEntity.championships === 1 ? 'Gold Title' : 'Gold Titles'}
                    </Badge>
                  )}
                  {championEntity.runnerUps > 0 && (
                    <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                      <Medal className="size-3 mr-1 inline text-slate-400" />
                      {championEntity.runnerUps} Silver
                    </Badge>
                  )}
                  {championEntity.bronzeFinishes > 0 && (
                    <Badge variant="outline" className="border-amber-700/30 text-amber-700 dark:text-amber-500 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                      <Medal className="size-3 mr-1 inline text-amber-700" />
                      {championEntity.bronzeFinishes} Bronze
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-orange-500/30 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5">
                    {championEntity.wins}W - {championEntity.losses}L Record
                  </Badge>
                </div>
                <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span>{championEntity.winRate.toFixed(0)}% Win Rate</span>
                  <span>•</span>
                  <span>{championEntity.pointsFor} PF</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{championEntity.pointDiff} Diff
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
            {bronzeEntity?.name || (rankedEntities.length <= 2 && rankedEntities.length > 0 ? 'Spot Open' : 'Bronze Spot Open')}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
            {bronzeEntity
              ? (standingView === 'college' ? `Tribe: ${bronzeEntity.clusterName || 'Affiliated'}` : standingView === 'cluster' ? (bronzeEntity.subtitle || 'Binturungan Tribe') : `${bronzeEntity.sport} • ${bronzeEntity.category}`)
              : '3rd Place Standings'}
          </p>

          <div className="mt-5 py-4 border-t border-dashed border-slate-200 dark:border-white/10">
            {bronzeEntity ? (
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>{bronzeEntity.wins}W - {bronzeEntity.losses}L</span>
                <span>•</span>
                <span>{bronzeEntity.winRate.toFixed(0)}% Win</span>
                <span>•</span>
                <span className={bronzeEntity.pointDiff >= 0 ? 'text-emerald-500' : 'text-slate-400'}>
                  {bronzeEntity.pointDiff >= 0 ? `+${bronzeEntity.pointDiff}` : bronzeEntity.pointDiff} Diff
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-400 italic">
                {rankedEntities.length <= 2 && rankedEntities.length > 0 ? 'Requires 3+ participants' : 'Standings compiling...'}
              </span>
            )}
          </div>
        </Card>
      </div>
      </>
      )}

      {/* Official PSU Standings & Leaderboard Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Trophy className="size-4 text-orange-500 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {standingView === 'college'
                ? 'Official Palawan State University College Standings'
                : standingView === 'cluster'
                ? 'Official PSU Binturungan Tribe Standings'
                : 'Official Athletic Squad Leaderboard'}
            </h3>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <span className="text-xs text-slate-500 font-normal">
              {rankedEntities.length} {standingView === 'college' ? (rankedEntities.length === 1 ? 'College Ranked' : 'Colleges Ranked') : standingView === 'cluster' ? (rankedEntities.length === 1 ? 'Tribe Ranked' : 'Tribes Ranked') : (rankedEntities.length === 1 ? 'Squad Ranked' : 'Squads Ranked')}
            </span>
          </div>

          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-500/10 self-start sm:self-auto">
            {winMetric === 'overall_wins' ? 'Sorted by Gold Championships' : winMetric === 'most_wins' ? 'Sorted by Total Wins' : winMetric === 'win_rate' ? 'Sorted by Win Ratio' : 'Sorted by MVP Gold Stars'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-4 sm:p-6">
            <SkeletonCard variant="row" count={5} />
          </div>
        ) : rankedEntities.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="size-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto text-orange-500 mb-3">
              <Shield className="size-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-tight">
              No Standings Records Found
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              No records match the active criteria. Adjust filters or reset to view all university athletic standings.
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
          <>
            {/* MOBILE STANDINGS LIST (< md): 100% responsive, zero horizontal scroll, tap to expand details */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {rankedEntities.map((item, idx) => {
                const rank = idx + 1;
                const isExpanded = expandedRowKey === item.key;

                return (
                  <div
                    key={item.key}
                    style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                    onClick={() => setExpandedRowKey(isExpanded ? null : item.key)}
                    className={`p-3 transition-colors cursor-pointer select-none animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both ${
                      rank === 1
                        ? 'bg-orange-50/40 dark:bg-orange-500/5'
                        : rank === 2
                        ? 'bg-slate-50/40 dark:bg-slate-800/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Rank Badge */}
                        <span
                          className={`size-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                            rank === 1
                              ? 'bg-amber-500 text-white'
                              : rank === 2
                              ? 'bg-slate-400 text-white'
                              : rank === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]'
                          }`}
                        >
                          {rank}
                        </span>

                        {/* Name + Code + Affiliation */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black italic uppercase text-xs text-slate-900 dark:text-white truncate">
                              {item.name}
                            </span>
                            {item.code && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black shrink-0">
                                {item.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.clusterName && (
                              <span className="text-orange-600 dark:text-orange-400 font-bold truncate">
                                {item.clusterName}
                              </span>
                            )}
                            {item.clusterName && item.sport && <span>•</span>}
                            {item.sport && <span className="truncate">{item.sport}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Primary Stats on Right */}
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <div className="text-right">
                          <p className="font-black text-xs text-slate-900 dark:text-white tabular-nums">
                            {item.wins}W - {item.losses}L
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                            {item.winRate.toFixed(0)}% • <span className={item.pointDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>{item.pointDiff >= 0 ? `+${item.pointDiff}` : item.pointDiff}</span>
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="size-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="size-3.5 text-slate-400 shrink-0" />}
                      </div>
                    </div>

                    {/* Inline Drawer of Details (When Tapped) */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-white/5 space-y-2 text-[11px] animate-in fade-in duration-200">
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Played</p>
                            <p className="font-black text-slate-900 dark:text-white">{item.matchesPlayed} GP</p>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Points (PF-PA)</p>
                            <p className="font-black text-slate-900 dark:text-white font-mono text-[10px]">{item.pointsFor} - {item.pointsAgainst}</p>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Medals</p>
                            <p className="font-black text-amber-600 dark:text-amber-400">
                              {item.championships > 0 ? `${item.championships}G ` : ''}
                              {item.runnerUps > 0 ? `${item.runnerUps}S ` : ''}
                              {item.bronzeFinishes > 0 ? `${item.bronzeFinishes}B` : ''}
                              {item.championships === 0 && item.runnerUps === 0 && item.bronzeFinishes === 0 && '-'}
                            </p>
                          </div>
                        </div>
                        {item.tournaments.length > 0 && (
                          <p className="text-[10px] text-slate-400 truncate">
                            <strong className="text-slate-600 dark:text-slate-300">Tournaments:</strong> {item.tournaments.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP STANDINGS TABLE (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-6">Rank</th>
                    {standingView === 'college' ? (
                      <>
                        <th className="py-3.5 px-4">College / Academic Unit</th>
                        <th className="py-3.5 px-4">Binturungan Tribe</th>
                      </>
                    ) : standingView === 'cluster' ? (
                      <>
                        <th className="py-3.5 px-4">Binturungan Cluster / Tribe</th>
                        <th className="py-3.5 px-4">Represented Units / Campuses</th>
                        <th className="py-3.5 px-3 text-center">Squads</th>
                      </>
                    ) : (
                      <>
                        <th className="py-3.5 px-4">Squad / Program</th>
                        <th className="py-3.5 px-4">Affiliation</th>
                        <th className="py-3.5 px-4">Discipline</th>
                      </>
                    )}
                    <th className="py-3.5 px-3 text-center">MP</th>
                    <th className="py-3.5 px-3 text-center">W</th>
                    <th className="py-3.5 px-3 text-center">L</th>
                    <th className="py-3.5 px-4 text-center">Win %</th>
                    <th className="py-3.5 px-4 text-center">PF - PA</th>
                    <th className="py-3.5 px-4 text-center">Diff</th>
                    <th className="py-3.5 px-4 text-center">Medals</th>
                    <th className="py-3.5 px-6 text-right">Standing Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rankedEntities.map((item, idx) => {
                    const rank = idx + 1;
                    return (
                      <tr
                        key={item.key}
                        style={{ animationDelay: `${Math.min(idx * 25, 200)}ms` }}
                        className={`transition-colors animate-in fade-in slide-in-from-bottom-1 duration-150 fill-mode-both ${
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

                        {/* Dynamic Columns based on Standing View */}
                        {standingView === 'college' ? (
                          <>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white text-sm">
                                    {item.name}
                                  </span>
                                  {item.code && (
                                    <Badge variant="outline" className="text-[10px] font-black border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                                      {item.code}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 truncate max-w-sm">
                                  {item.tournaments.join(', ') || 'Palawan State University Sports League'}
                                </span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              {item.clusterName ? (
                                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 gap-1 inline-flex items-center">
                                  <Users className="size-2.5" />
                                  {item.clusterName}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-xs font-semibold">-</span>
                              )}
                            </td>
                          </>
                        ) : standingView === 'cluster' ? (
                          <>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white text-sm">
                                  {item.name}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 truncate max-w-md">
                                  {item.subtitle || 'Palawan State University Binturungan Tribe'}
                                </span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                                {item.memberColleges && item.memberColleges.length > 0 ? (
                                  item.memberColleges.map((code) => (
                                    <Badge key={code} variant="secondary" className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                                      {code}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400">All Campuses</span>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-3 text-center font-bold text-slate-600 dark:text-slate-300">
                              {item.squadCount || 0}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white text-sm">
                                  {item.name}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 truncate max-w-[220px]">
                                  {item.tournaments.join(', ') || 'PSU Athletic League'}
                                </span>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5">
                                {item.code && (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                    {item.code}
                                  </Badge>
                                )}
                                {item.clusterName && (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20">
                                    {item.clusterName}
                                  </Badge>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                {item.sport}
                              </Badge>
                            </td>
                          </>
                        )}

                        <td className="py-4 px-3 text-center font-bold text-slate-600 dark:text-slate-300">
                          {item.matchesPlayed}
                        </td>

                        <td className="py-4 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                          {item.wins}
                        </td>

                        <td className="py-4 px-3 text-center font-black text-slate-400">
                          {item.losses}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-200">
                          {item.winRate.toFixed(1)}%
                        </td>

                        <td className="py-4 px-4 text-center font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {item.pointsFor} - {item.pointsAgainst}
                        </td>

                        <td className="py-4 px-4 text-center font-black">
                          <span className={item.pointDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : item.pointDiff < 0 ? 'text-rose-500' : 'text-slate-400'}>
                            {item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
                          </span>
                        </td>

                        {/* Medals Column */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {item.championships > 0 && (
                              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-black text-[10px] px-1.5 py-0.5 gap-0.5">
                                <Trophy className="size-2.5" />
                                {item.championships}G
                              </Badge>
                            )}
                            {item.runnerUps > 0 && (
                              <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] px-1.5 py-0.5 gap-0.5">
                                <Medal className="size-2.5 text-slate-400" />
                                {item.runnerUps}S
                              </Badge>
                            )}
                            {item.bronzeFinishes > 0 && (
                              <Badge variant="outline" className="border-amber-700/30 text-amber-700 dark:text-amber-500 font-bold text-[10px] px-1.5 py-0.5 gap-0.5">
                                <Medal className="size-2.5 text-amber-700" />
                                {item.bronzeFinishes}B
                              </Badge>
                            )}
                            {item.championships === 0 && item.runnerUps === 0 && item.bronzeFinishes === 0 && (
                              <span className="text-slate-400 font-bold text-xs">-</span>
                            )}
                          </div>
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
          </>
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
