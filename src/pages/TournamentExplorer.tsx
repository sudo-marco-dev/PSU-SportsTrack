import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Trophy, Crown, ArrowLeft, Lock, ListOrdered, Filter, X, Layers } from 'lucide-react';
import { SPORT_ICONS, getSportIcon } from '@/lib/sportIcons';
import { MatchCenterHeader } from '@/components/match-center/MatchCenterHeader';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { MatchCenterToolbar, type MatchCenterPhase } from '@/components/match-center/MatchCenterToolbar';
import { KnockoutBracketTree, type DoubleEliminationGroups } from '@/components/match-center/KnockoutBracketTree';
import { MatchScheduleList } from '@/components/match-center/MatchScheduleList';
import { type Match, type Tournament, type TeamAffiliation, getAffiliationBadge } from '@/components/match-center/types';

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
  return 'General Ball Games';
};

const isPlayoffRound = (roundName: string): boolean => {
  if (!roundName) return false;
  const r = roundName.toLowerCase();
  if (r.includes('round robin') || r.includes('elimination')) return false;
  return (
    r.includes('final') ||
    r.includes('semi') ||
    r.includes('quarter') ||
    r.includes('upper') ||
    r.includes('lower') ||
    r.includes('grand') ||
    r.includes('playoff') ||
    r.includes('bracket') ||
    r.includes('championship') ||
    r.includes('3rd') ||
    r.includes('bronze')
  );
};

export const TournamentExplorer = () => {
  const navigate = useNavigate();
  const { isStaffAthlete, isFacultyAthlete, isStudentAthlete, profile } = useAuth();
  const isStaffOrFaculty = Boolean(isStaffAthlete || isFacultyAthlete || profile?.role === 'player_staff' || profile?.role === 'player_faculty');
  const isStudent = Boolean(isStudentAthlete || profile?.role === 'player_student');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsMap, setTeamsMap] = useState<Map<string, TeamAffiliation>>(new Map());
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | 'all'>('all');
  const [selectedBracketTournId, setSelectedBracketTournId] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userPhaseOverride, setUserPhaseOverride] = useState<MatchCenterPhase | null>(null);
  const [elimTab, setElimTab] = useState<'live' | 'history'>('live');
  const [mobilePlayoffStage, setMobilePlayoffStage] = useState<'all' | 'quarters' | 'semis' | 'finals'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isStaffOrFaculty) {
      setCategoryFilter('friendly');
    }
  }, [isStaffOrFaculty]);

  const fetchExplorerData = async () => {
    try {
      const [tournamentsRes, matchesRes, teamsRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, sport, type, status, start_date, end_date')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('start_date', { ascending: false }),
        supabase
          .from('matches')
          .select(
            '*, tournament:tournament_id(id, name, sport, type, status, start_date, is_deleted), team_a:team_a_id(name), team_b:team_b_id(name)'
          )
          .order('match_time', { ascending: true }),
        supabase
          .from('teams')
          .select('id, name, affiliation_type, college_id, cluster_id, colleges(college_name), clusters(name)')
      ]);

      if (tournamentsRes.error) throw tournamentsRes.error;
      if (matchesRes.error) throw matchesRes.error;

      const validTournaments = tournamentsRes.data || [];
      const validMatches = (((matchesRes.data as unknown) as Match[]) || []).filter(
        (m) => !m.tournament?.is_deleted
      );

      const tMap = new Map<string, TeamAffiliation>();
      (teamsRes.data || []).forEach((t: any) => {
        tMap.set(t.id, t);
      });

      setTournaments(validTournaments);
      setMatches(validMatches);
      setTeamsMap(tMap);
    } catch (error: unknown) {
      console.error('Error fetching explorer data:', error);
      toast.error('Failed to load match center data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExplorerData();

    // Realtime listener for match scores and updates
    const channel = supabase
      .channel('match-center-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setMatches((prev) =>
              prev.map((m) =>
                m.id === payload.new.id
                  ? {
                      ...m,
                      status: payload.new.status,
                      team_a_score: payload.new.team_a_score,
                      team_b_score: payload.new.team_b_score,
                      team_a_id: payload.new.team_a_id,
                      team_b_id: payload.new.team_b_id,
                      next_match_id: payload.new.next_match_id,
                      loser_next_match_id: payload.new.loser_next_match_id,
                    }
                  : m
              )
            );
          } else {
            fetchExplorerData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const tourMap = useMemo(() => {
    const map = new Map<string, Tournament>();
    tournaments.forEach((t) => map.set(t.id, t));
    return map;
  }, [tournaments]);

  // Global list of available sports computed from all matches and tournaments
  const allSports = useMemo(() => {
    const sportCounts = new Map<string, number>();

    matches.forEach((m) => {
      const sportName = extractSportName(m, tourMap);
      sportCounts.set(sportName, (sportCounts.get(sportName) || 0) + 1);
    });

    tournaments.forEach((t) => {
      if (t.sport && !sportCounts.has(t.sport)) {
        sportCounts.set(t.sport, 0);
      }
    });

    return Array.from(sportCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        icon: getSportIcon(name)
      }))
      .sort((a, b) => b.count - a.count);
  }, [matches, tourMap, tournaments]);

  const isFriendlyTourn = (tourn?: { type?: string | null; name?: string | null } | null): boolean => {
    if (!tourn) return false;
    const tType = (tourn.type || '').toLowerCase();
    const tName = (tourn.name || '').toLowerCase();
    return tType.includes('friendly') || tType.includes('staff') || tName.includes('friendly') || tName.includes('staff');
  };

  // Tournaments applicable to the currently selected sport
  const tournamentsForSport = useMemo(() => {
    let list = tournaments;
    if (selectedSport !== 'all') {
      list = list.filter((t) => {
        if (t.sport && t.sport.toLowerCase() === selectedSport.toLowerCase()) return true;
        return matches.some(
          (m) =>
            m.tournament_id === t.id &&
            extractSportName(m, tourMap).toLowerCase() === selectedSport.toLowerCase()
        );
      });
    }

    if (categoryFilter === 'friendly') {
      list = list.filter((t) => isFriendlyTourn(t));
    } else if (categoryFilter === 'binturungan') {
      list = list.filter(
        (t) =>
          (t.type || '').toLowerCase().includes('binturungan') ||
          (t.name || '').toLowerCase().includes('binturungan')
      );
    } else if (categoryFilter === 'collegiate') {
      list = list.filter(
        (t) =>
          (t.type || '').toLowerCase().includes('colleg') ||
          (t.name || '').toLowerCase().includes('colleg')
      );
    }

    // Sort by role relevance: staff/faculty see friendly games first; students see championships first
    return [...list].sort((a, b) => {
      const aFriendly = isFriendlyTourn(a);
      const bFriendly = isFriendlyTourn(b);
      if (isStaffOrFaculty) {
        if (aFriendly && !bFriendly) return -1;
        if (!aFriendly && bFriendly) return 1;
      } else if (isStudent) {
        if (!aFriendly && bFriendly) return -1;
        if (aFriendly && !bFriendly) return 1;
      }
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    });
  }, [tournaments, selectedSport, matches, tourMap, categoryFilter, isStaffOrFaculty, isStudent]);

  // Tournaments in the current sport that possess playoff matches
  const bracketEligibleTournaments = useMemo(() => {
    const tourIdsWithPlayoffs = new Set<string>();
    matches.forEach((m) => {
      if (isPlayoffRound(m.round) || m.next_match_id) {
        tourIdsWithPlayoffs.add(m.tournament_id);
      }
    });
    return tournamentsForSport.filter((t) => tourIdsWithPlayoffs.has(t.id));
  }, [matches, tournamentsForSport]);

  // The tournament whose playoff tree is currently active
  const activeBracketTournamentId = useMemo(() => {
    if (selectedTournamentId !== 'all') return selectedTournamentId;
    if (selectedBracketTournId && bracketEligibleTournaments.some((t) => t.id === selectedBracketTournId)) {
      return selectedBracketTournId;
    }
    return bracketEligibleTournaments[0]?.id || null;
  }, [selectedTournamentId, selectedBracketTournId, bracketEligibleTournaments]);

  // Synchronize sport selection
  const handleSelectSport = (sport: string) => {
    setSelectedSport(sport);
    setSelectedRound('all');
    setUserPhaseOverride(null);
    setSelectedBracketTournId(null);
    if (sport === 'all') {
      setSelectedTournamentId('all');
      return;
    }
    if (selectedTournamentId !== 'all') {
      const currentTour = tourMap.get(selectedTournamentId);
      if (currentTour?.sport && currentTour.sport.toLowerCase() !== sport.toLowerCase()) {
        setSelectedTournamentId('all');
      }
    }
  };

  // Synchronize tournament selection
  const handleSelectTournament = (tourId: string) => {
    setSelectedTournamentId(tourId);
    setSelectedRound('all');
    setSelectedBracketTournId(tourId === 'all' ? null : tourId);
    setUserPhaseOverride(null);
    if (tourId === 'all') return;
    const tour = tourMap.get(tourId);
    if (tour?.sport) {
      setSelectedSport(tour.sport);
    }
  };

  // Elimination / Round Robin matches filtered by sport & selected tournament
  const eliminationMatches = useMemo(() => {
    let list = matches.filter((m) => {
      if (isPlayoffRound(m.round) || m.next_match_id) return false;
      if (selectedTournamentId !== 'all' && m.tournament_id !== selectedTournamentId) return false;
      if (selectedSport !== 'all') {
        const sportName = extractSportName(m, tourMap);
        if (sportName.toLowerCase() !== selectedSport.toLowerCase()) return false;
      }
      if (categoryFilter === 'friendly') {
        return isFriendlyTourn(m.tournament);
      }
      if (categoryFilter === 'binturungan') {
        return (
          (m.tournament?.type || '').toLowerCase().includes('binturungan') ||
          (m.tournament?.name || '').toLowerCase().includes('binturungan')
        );
      }
      if (categoryFilter === 'collegiate') {
        return (
          (m.tournament?.type || '').toLowerCase().includes('colleg') ||
          (m.tournament?.name || '').toLowerCase().includes('colleg')
        );
      }
      return true;
    });

    list.sort((a, b) => {
      const aFriendly = isFriendlyTourn(a.tournament);
      const bFriendly = isFriendlyTourn(b.tournament);
      if (isStaffOrFaculty) {
        if (aFriendly && !bFriendly) return -1;
        if (!aFriendly && bFriendly) return 1;
      } else {
        if (!aFriendly && bFriendly) return -1;
        if (aFriendly && !bFriendly) return 1;
      }
      return new Date(a.match_time).getTime() - new Date(b.match_time).getTime();
    });

    return list;
  }, [matches, selectedTournamentId, selectedSport, tourMap, categoryFilter, isStaffOrFaculty, isStudent]);

  // Playoff matches scoped to the active bracket tournament
  const playoffMatches = useMemo(() => {
    if (!activeBracketTournamentId) return [];
    return matches.filter(
      (m) =>
        m.tournament_id === activeBracketTournamentId &&
        (isPlayoffRound(m.round) || m.next_match_id)
    );
  }, [matches, activeBracketTournamentId]);

  const hasPlayoffs = playoffMatches.length > 0;

  // Detect if the active tournament is Round Robin Only (all matches are Round Robin and no playoff tree)
  const isRoundRobinOnlyTournament = useMemo(() => {
    if (eliminationMatches.length === 0 || hasPlayoffs) return false;
    return eliminationMatches.every((m) => (m.round || '').toLowerCase().includes('round robin'));
  }, [eliminationMatches, hasPlayoffs]);

  // Compute Standings Leaderboard for Phase 1 / Round Robin matches
  const phase1Standings = useMemo(() => {
    const stats = new Map<
      string,
      {
        teamId: string;
        teamName: string;
        gp: number;
        wins: number;
        losses: number;
        pf: number;
        pa: number;
      }
    >();

    eliminationMatches.forEach((m) => {
      if (m.team_a_id && m.team_a?.name && !stats.has(m.team_a_id)) {
        stats.set(m.team_a_id, {
          teamId: m.team_a_id,
          teamName: m.team_a.name,
          gp: 0,
          wins: 0,
          losses: 0,
          pf: 0,
          pa: 0,
        });
      }
      if (m.team_b_id && m.team_b?.name && !stats.has(m.team_b_id)) {
        stats.set(m.team_b_id, {
          teamId: m.team_b_id,
          teamName: m.team_b.name,
          gp: 0,
          wins: 0,
          losses: 0,
          pf: 0,
          pa: 0,
        });
      }

      const sA = m.team_a_score || 0;
      const sB = m.team_b_score || 0;
      if (m.status === 'Completed' || sA > 0 || sB > 0) {
        const tA = m.team_a_id ? stats.get(m.team_a_id) : undefined;
        const tB = m.team_b_id ? stats.get(m.team_b_id) : undefined;
        if (tA) {
          tA.gp += 1;
          tA.pf += sA;
          tA.pa += sB;
          if (sA > sB) tA.wins += 1;
          else if (sA < sB) tA.losses += 1;
        }
        if (tB) {
          tB.gp += 1;
          tB.pf += sB;
          tB.pa += sA;
          if (sB > sA) tB.wins += 1;
          else if (sB < sA) tB.losses += 1;
        }
      }
    });

    return Array.from(stats.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const diffA = a.pf - a.pa;
      const diffB = b.pf - b.pa;
      if (diffB !== diffA) return diffB - diffA;
      return b.pf - a.pf;
    });
  }, [eliminationMatches]);

  // Filter elimination matches based on search query and optional stage filter
  const filteredEliminationMatches = useMemo(() => {
    return eliminationMatches.filter((m) => {
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

  // Live / Scheduled vs History (Ongoing live games pinned at top, then upcoming chronological)
  const elimLiveAndUpcoming = useMemo(() => {
    return filteredEliminationMatches
      .filter((m) => m.status === 'Scheduled' || m.status === 'Ongoing')
      .sort((a, b) => {
        // 1. Ongoing live matches always come first
        if (a.status === 'Ongoing' && b.status !== 'Ongoing') return -1;
        if (b.status === 'Ongoing' && a.status !== 'Ongoing') return 1;

        // 2. Upcoming matches sorted by scheduled time ascending (earliest first)
        const timeA = a.match_time ? new Date(a.match_time).getTime() : Infinity;
        const timeB = b.match_time ? new Date(b.match_time).getTime() : Infinity;
        return timeA - timeB;
      });
  }, [filteredEliminationMatches]);

  const elimHistory = useMemo(() => {
    return filteredEliminationMatches
      .filter((m) => m.status === 'Completed')
      .sort((a, b) => new Date(b.match_time).getTime() - new Date(a.match_time).getTime());
  }, [filteredEliminationMatches]);

  // Playoff Bracket rounds grouping (Single Elimination)
  const playoffRoundsGrouped = useMemo(() => {
    const quarters: Match[] = [];
    const semis: Match[] = [];
    const finals: Match[] = [];
    const bronze: Match[] = [];
    const others: Match[] = [];

    playoffMatches.forEach((m) => {
      const r = (m.round || '').toLowerCase();
      if (r.includes('3rd') || r.includes('bronze') || r.includes('consolation')) {
        bronze.push(m);
      } else if (r.includes('quarter') || r === 'round 1') {
        quarters.push(m);
      } else if (r.includes('semi')) {
        semis.push(m);
      } else if (r.includes('final') || r.includes('championship')) {
        finals.push(m);
      } else {
        others.push(m);
      }
    });

    return { quarters, semis, finals, bronze, others };
  }, [playoffMatches]);

  // Double Elimination grouping (Upper Bracket, Lower Bracket, Grand Finals)
  const doubleElimGrouped = useMemo<DoubleEliminationGroups>(() => {
    const isDoubleElimination = playoffMatches.some((m) => {
      const r = (m.round || '').toLowerCase();
      return r.includes('upper') || r.includes('lower') || r.includes('grand final');
    });

    const upperQuarters: Match[] = [];
    const upperSemis: Match[] = [];
    const upperFinals: Match[] = [];
    const lowerR1: Match[] = [];
    const lowerR2: Match[] = [];
    const lowerSemis: Match[] = [];
    const lowerFinals: Match[] = [];
    const grandFinals: Match[] = [];

    if (isDoubleElimination) {
      playoffMatches.forEach((m) => {
        const r = (m.round || '').toLowerCase();
        if (r.includes('grand final')) {
          grandFinals.push(m);
        } else if (r.includes('upper') && r.includes('quarter')) {
          upperQuarters.push(m);
        } else if (r.includes('upper') && r.includes('semi')) {
          upperSemis.push(m);
        } else if (r.includes('upper') && r.includes('final')) {
          upperFinals.push(m);
        } else if (r.includes('lower') && r.includes('1')) {
          lowerR1.push(m);
        } else if (r.includes('lower') && r.includes('2')) {
          lowerR2.push(m);
        } else if (r.includes('lower') && r.includes('semi')) {
          lowerSemis.push(m);
        } else if (r.includes('lower') && r.includes('final')) {
          lowerFinals.push(m);
        }
      });
    }

    return {
      isDoubleElimination,
      upperQuarters,
      upperSemis,
      upperFinals,
      lowerR1,
      lowerR2,
      lowerSemis,
      lowerFinals,
      grandFinals,
    };
  }, [playoffMatches]);

  // Order quarters and semis into tournament seed pairs for accurate tree alignment
  const orderedPlayoffs = useMemo(() => {
    const rawQuarters = [...playoffRoundsGrouped.quarters];
    const rawSemis = [...playoffRoundsGrouped.semis];
    const rawFinals = [...playoffRoundsGrouped.finals];

    let pairedQuarters = rawQuarters;
    if (rawQuarters.length === 4 && rawSemis.length >= 2) {
      const sf1 = rawSemis[0];
      const sf2 = rawSemis[1];
      const p1 = rawQuarters.filter((q) => q.next_match_id === sf1.id);
      const p2 = rawQuarters.filter((q) => q.next_match_id === sf2.id);
      if (p1.length === 2 && p2.length === 2) {
        pairedQuarters = [
          ...p1.sort((a, _b) => (a.next_match_slot === 'team_a' ? -1 : 1)),
          ...p2.sort((a, _b) => (a.next_match_slot === 'team_a' ? -1 : 1))
        ];
      }
    }

    const pairedSemis = rawSemis.sort((a, _b) => (a.next_match_slot === 'team_a' ? -1 : 1));

    return {
      quarters: pairedQuarters,
      semis: pairedSemis,
      finals: rawFinals,
      bronze: playoffRoundsGrouped.bronze
    };
  }, [playoffRoundsGrouped]);

  // Elimination completion status: True ONLY when all elimination fixtures have completed
  const isEliminationComplete = useMemo(() => {
    if (eliminationMatches.length === 0) return false;
    return eliminationMatches.every((m) => m.status === 'Completed');
  }, [eliminationMatches]);

  // Identify Champion and its designated College or Cluster/Tribe (supports Single, Double, and Round Robin Only)
  const championDetails = useMemo(() => {
    // 1. Check Round Robin Only Champion (Most Wins when all Round Robin matches are completed)
    if (isRoundRobinOnlyTournament && isEliminationComplete && phase1Standings.length > 0) {
      const topTeam = phase1Standings[0];
      const aff = getAffiliationBadge(topTeam.teamId, topTeam.teamName, teamsMap);
      return {
        teamName: topTeam.teamName,
        title: aff ? aff.fullName : topTeam.teamName,
        badge: aff ? aff.badge : null,
        type: aff ? aff.type : 'squad',
        record: `${topTeam.wins}W - ${topTeam.losses}L`,
      };
    }

    // 2. Check Double Elimination Grand Finals or Single Elimination Finals
    const targetFinalsList = doubleElimGrouped.isDoubleElimination
      ? doubleElimGrouped.grandFinals
      : playoffRoundsGrouped.finals;

    const completedFinal = targetFinalsList.find((m) => m.status === 'Completed');
    if (!completedFinal) return null;
    let winningTeamId: string | null = null;
    let winningTeamName: string | null = null;
    if (completedFinal.team_a_score > completedFinal.team_b_score) {
      winningTeamId = completedFinal.team_a_id || null;
      winningTeamName = completedFinal.team_a?.name || null;
    } else if (completedFinal.team_b_score > completedFinal.team_a_score) {
      winningTeamId = completedFinal.team_b_id || null;
      winningTeamName = completedFinal.team_b?.name || null;
    }
    if (!winningTeamName) return null;

    const aff = getAffiliationBadge(winningTeamId, winningTeamName, teamsMap);
    return {
      teamName: winningTeamName,
      title: aff ? aff.fullName : winningTeamName,
      badge: aff ? aff.badge : null,
      type: aff ? aff.type : 'squad',
      record: null,
    };
  }, [
    isRoundRobinOnlyTournament,
    isEliminationComplete,
    phase1Standings,
    doubleElimGrouped,
    playoffRoundsGrouped.finals,
    teamsMap,
  ]);

  // Available elimination rounds for filter dropdown
  const availableRounds = useMemo(() => {
    const roundsSet = new Set<string>();
    eliminationMatches.forEach((m) => {
      if (m.round) roundsSet.add(m.round);
    });
    return Array.from(roundsSet);
  }, [eliminationMatches]);

  // Auto-reset stage filter if the selected round is no longer present in available rounds
  useEffect(() => {
    if (selectedRound !== 'all' && !availableRounds.includes(selectedRound)) {
      setSelectedRound('all');
    }
  }, [availableRounds, selectedRound]);

  // Live and total match counts
  const liveMatchesCount = useMemo(() => {
    return matches.filter((m) => m.status === 'Ongoing').length;
  }, [matches]);

  // Active Phase: smart-defaults to playoffs if a tournament has ONLY playoffs, or if eliminations have concluded (and playoffs exist); otherwise defaults to elimination
  const activePhase: MatchCenterPhase =
    userPhaseOverride ??
    (eliminationMatches.length === 0 && hasPlayoffs
      ? 'playoffs'
      : isEliminationComplete && hasPlayoffs
      ? 'playoffs'
      : 'elimination');

  const selectedTourObj = tournaments.find((t) => t.id === selectedTournamentId);
  const isSelectedDraft = selectedTourObj?.status === 'Draft';

  const defaultCategory = isStaffOrFaculty ? 'friendly' : 'all';
  const hasActiveFilters =
    selectedTournamentId !== 'all' ||
    selectedSport !== 'all' ||
    selectedRound !== 'all' ||
    searchQuery.trim() !== '' ||
    categoryFilter !== defaultCategory;

  const handleResetFilters = () => {
    setSelectedTournamentId('all');
    setSelectedSport('all');
    setSelectedRound('all');
    setCategoryFilter(defaultCategory);
    setSearchQuery('');
    setUserPhaseOverride(null);
    setMobilePlayoffStage('all');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10 w-full min-w-0 max-w-full">
        <SkeletonCard variant="match-center" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-10 w-full min-w-0 max-w-full overflow-x-hidden animate-in fade-in duration-300">
      {/* 1. UNIFIED MATCH CENTER COMMAND HEADER */}
      <MatchCenterHeader
        selectedSport={selectedSport}
        onSelectSport={handleSelectSport}
        allSports={allSports}
        totalMatchesCount={matches.length}
        liveMatchesCount={liveMatchesCount}
        selectedTournamentName={selectedTourObj?.name}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />

      {/* 2. UNIFIED CONTROLS TOOLBAR WITH PHASE SWITCHER */}
      <MatchCenterToolbar
        tournaments={tournamentsForSport}
        selectedTournamentId={selectedTournamentId}
        onSelectTournament={handleSelectTournament}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activePhase={activePhase}
        setActivePhase={(phase) => setUserPhaseOverride(phase)}
        hasPlayoffs={hasPlayoffs}
        isEliminationComplete={isEliminationComplete}
        elimMatchesCount={eliminationMatches.length}
        playoffMatchesCount={playoffMatches.length}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {/* 3. DRAFT TOURNAMENT NOTICE */}
      {isSelectedDraft && (
        <Card className="border border-orange-500/30 bg-orange-500/10 p-5 rounded-2xl text-center space-y-2">
          <div className="size-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center mx-auto border border-orange-500/30">
            <Clock className="size-5" />
          </div>
          <h3 className="font-black italic uppercase tracking-tight text-sm text-orange-500">
            Tournament In Draft • Registration Open
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {selectedTourObj?.name} is currently recruiting campus squads. Bracket matchups and scheduling will appear once tournament directors publish the bracket.
          </p>
        </Card>
      )}

      {/* 4. CONTENT STAGE */}
      {activePhase === 'playoffs' ? (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
          {!hasPlayoffs ? (
            isRoundRobinOnlyTournament ? (
              /* Round Robin Only Notice & Standings Podium */
              <Card className="border-2 border-orange-500/30 py-10 sm:py-12 px-6 text-center bg-slate-950 text-white rounded-2xl sm:rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 sm:size-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 max-w-xl mx-auto space-y-4">
                  <div className="size-14 sm:size-16 rounded-2xl sm:rounded-3xl bg-slate-900 text-orange-500 flex items-center justify-center mx-auto border border-white/10 shadow-xl">
                    <ListOrdered className="size-7 sm:size-8 text-orange-500" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                    <Trophy className="size-3 text-emerald-400" />
                    <span>Round Robin Only Format • Standings Championship</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white">
                    Champion Crowned by Most Wins (No Knockout Tree)
                  </h3>
                  <p className="text-slate-400 font-medium text-xs leading-relaxed">
                    This tournament uses the <strong className="text-white">Round Robin Only</strong> league format. Every squad plays each other, and the team with the most wins (and highest point differential) is crowned Official Champion directly without proceeding to a knockout bracket.
                  </p>
                  <div className="pt-2 flex justify-center">
                    <Button
                      onClick={() => setUserPhaseOverride('elimination')}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-wider h-10 sm:h-11 px-5 sm:px-6 rounded-xl shadow-lg shadow-orange-500/20 transition-all w-full sm:w-auto inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>View Round Robin Standings & Fixtures</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              /* Playoff Locked / Awaiting Progression Notice */
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-800 py-12 sm:py-16 px-6 text-center bg-slate-950 text-white rounded-2xl sm:rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 sm:size-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 max-w-lg mx-auto space-y-3.5 sm:space-y-4">
                  <div className="size-14 sm:size-16 rounded-2xl sm:rounded-3xl bg-slate-900 text-orange-500 flex items-center justify-center mx-auto border border-white/10 shadow-xl">
                    <Lock className="size-7 sm:size-8 animate-pulse text-orange-500" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-orange-500/30">
                    <Lock className="size-3 text-orange-400" />
                    <span>Phase 2 Pending • Elimination Stage In Progress</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white">
                    Playoff Bracket Unlocks After Elimination Round
                  </h3>
                  <p className="text-slate-400 font-medium text-xs leading-relaxed">
                    Phase 1 elimination fixtures are currently underway. Once regular fixtures conclude, qualified squads advance to the Playoff Bracket.
                  </p>
                  <div className="pt-2 flex justify-center">
                    <Button
                      onClick={() => setUserPhaseOverride('elimination')}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-wider h-10 sm:h-11 px-5 sm:px-6 rounded-xl shadow-lg shadow-orange-500/20 transition-all w-full sm:w-auto inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Back to Phase 1 Elimination</span>
                    </Button>
                  </div>
                </div>
              </Card>
            )
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {/* Multi-tournament bracket switcher (if sport has multiple bracket tournaments) */}
              {bracketEligibleTournaments.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 border border-white/10 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-orange-500 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest text-white">
                      Knockout Tournament:
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                    {bracketEligibleTournaments.map((t) => {
                      const isCurrent = activeBracketTournamentId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedBracketTournId(t.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 scale-[1.02]'
                              : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Champion Banner (Grand Visual Highlight of the Bracket) */}
              {championDetails && (
                <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-4 sm:p-7 shadow-2xl border border-amber-300/30 text-center animate-in zoom-in-95 duration-500">
                  <div className="relative z-10 flex flex-col items-center gap-2 min-w-0">
                    <div className="size-12 sm:size-14 rounded-2xl bg-white/20 backdrop-blur-md text-yellow-300 flex items-center justify-center border border-white/30 shadow-lg shrink-0">
                      <Crown className="size-7 sm:size-8 animate-bounce" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-black/20 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest max-w-full whitespace-normal leading-snug">
                      {championDetails.type === 'cluster'
                        ? 'Official Binturungan Tribe Champion'
                        : 'Official Collegiate Champion • Gold Medalist'}
                    </span>
                    <h2 className="text-xl sm:text-3xl md:text-5xl font-black italic tracking-tight uppercase leading-tight drop-shadow-md break-words max-w-full">
                      {championDetails.title}
                    </h2>
                    <p className="text-white/90 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-0.5 inline-flex flex-wrap items-center justify-center gap-1.5">
                      <Trophy className="size-3.5 text-yellow-200 shrink-0" />
                      <span>{championDetails.teamName} • Palawan State University</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Knockout Bracket Arena (Single or Double Elimination) */}
              <KnockoutBracketTree
                playoffs={orderedPlayoffs}
                doubleElim={doubleElimGrouped}
                searchQuery={searchQuery}
                mobileStage={mobilePlayoffStage}
                setMobileStage={setMobilePlayoffStage}
                teamsMap={teamsMap}
                onNavigateMatch={(id) => navigate(`/match/${id}`)}
              />
            </div>
          )}
        </div>
      ) : (
        /* Phase 1: Elimination / Round Robin Stage View */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Champion Banner for Round Robin Only Mode */}
          {isRoundRobinOnlyTournament && championDetails && (
            <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-4 sm:p-7 shadow-2xl border border-amber-300/30 text-center animate-in zoom-in-95 duration-500">
              <div className="relative z-10 flex flex-col items-center gap-2 min-w-0">
                <div className="size-12 sm:size-14 rounded-2xl bg-white/20 backdrop-blur-md text-yellow-300 flex items-center justify-center border border-white/30 shadow-lg shrink-0">
                  <Crown className="size-7 sm:size-8 animate-bounce" />
                </div>
                <span className="px-3 py-1 rounded-full bg-black/20 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest max-w-full whitespace-normal leading-snug">
                  Round Robin Official Champion • Ranked #1 by Most Wins ({championDetails.record})
                </span>
                <h2 className="text-xl sm:text-3xl md:text-5xl font-black italic tracking-tight uppercase leading-tight drop-shadow-md break-words max-w-full">
                  {championDetails.title}
                </h2>
                <p className="text-white/90 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-0.5 inline-flex flex-wrap items-center justify-center gap-1.5">
                  <Trophy className="size-3.5 text-yellow-200 shrink-0" />
                  <span>{championDetails.teamName} • Palawan State University</span>
                </p>
              </div>
            </div>
          )}

          {/* Elimination Concluded Banner Notice (when Phase 2 Playoffs exist) */}
          {isEliminationComplete && hasPlayoffs && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-emerald-500/30 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="size-9 sm:size-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <Trophy className="size-5 sm:size-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-black italic uppercase tracking-tight text-xs sm:text-sm text-emerald-400 flex items-center gap-2">
                    Phase 1 Elimination Concluded
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5">
                    Preliminary fixtures have concluded. Top qualifying squads have advanced to the Phase 2 Playoff Knockout Bracket.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setUserPhaseOverride('playoffs')}
                className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-wider h-10 px-4 sm:px-5 rounded-xl shrink-0 shadow-md shadow-orange-500/20 w-full md:w-auto inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>View Playoff Bracket</span>
                <Trophy className="size-3.5" />
              </Button>
            </div>
          )}

          {/* Live Round Robin / Phase 1 Standings Table (when a specific tournament is selected or Round Robin matches exist) */}
          {selectedTournamentId !== 'all' && phase1Standings.length > 0 && (
            <Card className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ListOrdered className="size-4 text-orange-500" />
                  <h4 className="text-xs sm:text-sm font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    {isRoundRobinOnlyTournament
                      ? 'Round Robin Championship Standings (Most Wins)'
                      : 'Phase 1 Elimination Pool Standings'}
                  </h4>
                </div>
                <Badge variant="outline" className="text-[9px] font-black uppercase border-orange-500/30 text-orange-500">
                  {isRoundRobinOnlyTournament
                    ? 'Rank #1 Wins Championship'
                    : 'Ranked by Wins & Point Differential'}
                </Badge>
              </div>
              {/* Mobile View: Standings Cards (md:hidden) */}
              <div className="md:hidden space-y-2">
                {phase1Standings.map((st, idx) => {
                  const diff = st.pf - st.pa;
                  return (
                    <div
                      key={`mob-stand-${st.teamId}`}
                      className={`p-3 rounded-xl border transition-all ${
                        idx === 0
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`size-6 rounded-md font-black text-xs flex items-center justify-center shrink-0 ${
                              idx === 0
                                ? 'bg-amber-500 text-white'
                                : idx === 1
                                ? 'bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <span className="font-black italic uppercase text-xs text-slate-900 dark:text-white truncate">
                            {st.teamName}
                          </span>
                          {idx === 0 && isRoundRobinOnlyTournament && isEliminationComplete && (
                            <Badge className="bg-amber-500 text-white text-[8px] font-black uppercase px-1.5 py-0 shrink-0">
                              Champion
                            </Badge>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                            {st.wins}W - {st.losses}L
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white/60 dark:bg-black/20 p-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                        <div>
                          <span className="text-[8px] font-bold uppercase text-slate-400">Games</span>
                          <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{st.gp} GP</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold uppercase text-slate-400">PF - PA</span>
                          <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{st.pf} - {st.pa}</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold uppercase text-slate-400">Diff</span>
                          <p className={`font-mono font-bold ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Table (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-3">Rank</th>
                      <th className="py-2 px-3">Squad</th>
                      <th className="py-2 px-3 text-center">GP</th>
                      <th className="py-2 px-3 text-center">W - L</th>
                      <th className="py-2 px-3 text-center">PF</th>
                      <th className="py-2 px-3 text-center">PA</th>
                      <th className="py-2 pl-3 text-right">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                    {phase1Standings.map((st, idx) => {
                      const diff = st.pf - st.pa;
                      return (
                        <tr
                          key={st.teamId}
                          className={
                            idx === 0
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/5'
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          <td className="py-2.5 pr-3 font-black">#{idx + 1}</td>
                          <td className="py-2.5 px-3 font-black uppercase italic">
                            {st.teamName}
                            {idx === 0 && isRoundRobinOnlyTournament && isEliminationComplete && (
                              <Badge className="ml-2 bg-amber-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                                Champion
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums">{st.gp}</td>
                          <td className="py-2.5 px-3 text-center tabular-nums font-black">
                            {st.wins} - {st.losses}
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums text-slate-500">{st.pf}</td>
                          <td className="py-2.5 px-3 text-center tabular-nums text-slate-500">{st.pa}</td>
                          <td className="py-2.5 pl-3 text-right tabular-nums">
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Unified Elimination Toolbar: Sub-tabs (Upcoming & Live vs Results) + Stage Filter */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl md:rounded-[2rem] p-2.5 sm:p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            {/* Left: Elimination Sub-Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-white/5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setElimTab('live')}
                className={`py-2 px-2.5 sm:px-4 rounded-lg font-black uppercase italic text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 flex-1 sm:flex-initial ${
                  elimTab === 'live'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="size-3.5 shrink-0" />
                <span className="sm:hidden">Upcoming</span>
                <span className="hidden sm:inline">Upcoming &amp; Live</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 leading-none ${
                    elimTab === 'live'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {elimLiveAndUpcoming.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setElimTab('history')}
                className={`py-2 px-2.5 sm:px-4 rounded-lg font-black uppercase italic text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 flex-1 sm:flex-initial ${
                  elimTab === 'history'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Trophy className="size-3.5 shrink-0" />
                <span className="sm:hidden">Results</span>
                <span className="hidden sm:inline">Match Results</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 leading-none ${
                    elimTab === 'history'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {elimHistory.length}
                </span>
              </button>
            </div>

            {/* Right: Stage Filter Dropdown */}
            {availableRounds.length > 0 ? (
              <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end px-1 sm:px-0">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                  <Filter className="size-3.5 text-orange-500" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                    Stage Filter:
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 sm:w-56 sm:flex-initial min-w-0">
                  <Select
                    value={selectedRound}
                    onValueChange={(val: string | null) => setSelectedRound(val || 'all')}
                  >
                    <SelectTrigger className="w-full h-9 sm:h-10 rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <SelectValue placeholder="All Stages">
                        {selectedRound === 'all' ? 'All Stages' : selectedRound}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-bold uppercase text-xs">
                      <SelectItem value="all">All Stages</SelectItem>
                      {availableRounds.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRound !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedRound('all')}
                      className="size-8 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Clear stage filter"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider px-2">
                <Layers className="size-3.5 text-orange-500" />
                <span>
                  {elimTab === 'live' ? elimLiveAndUpcoming.length : elimHistory.length}{' '}
                  {elimTab === 'live' ? 'Upcoming & Live Fixtures' : 'Results Recorded'}
                </span>
              </div>
            )}
          </div>

          {/* Fixtures Timeline */}
          <MatchScheduleList
            matches={elimTab === 'live' ? elimLiveAndUpcoming : elimHistory}
            isResultsMode={elimTab === 'history'}
            tourMap={tourMap}
            teamsMap={teamsMap}
            onNavigateMatch={(id) => navigate(`/match/${id}`)}
          />
        </div>
      )}
    </div>
  );
};
