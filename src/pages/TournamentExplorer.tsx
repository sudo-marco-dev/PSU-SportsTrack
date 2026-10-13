import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, Trophy, Crown, ArrowLeft, Lock } from 'lucide-react';
import { SPORT_ICONS, getSportIcon } from '@/lib/sportIcons';
import { MatchCenterHeader } from '@/components/match-center/MatchCenterHeader';
import { MatchCenterToolbar, type MatchCenterPhase } from '@/components/match-center/MatchCenterToolbar';
import { KnockoutBracketTree } from '@/components/match-center/KnockoutBracketTree';
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
    r.includes('championship') ||
    r.includes('3rd') ||
    r.includes('bronze')
  );
};

export const TournamentExplorer = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsMap, setTeamsMap] = useState<Map<string, TeamAffiliation>>(new Map());
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | 'all'>('all');
  const [selectedBracketTournId, setSelectedBracketTournId] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | 'all'>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userPhaseOverride, setUserPhaseOverride] = useState<MatchCenterPhase | null>(null);
  const [elimTab, setElimTab] = useState<'live' | 'history'>('live');
  const [mobilePlayoffStage, setMobilePlayoffStage] = useState<'all' | 'quarters' | 'semis' | 'finals'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchExplorerData = async () => {
    try {
      const [tournamentsRes, matchesRes, teamsRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, sport, status, start_date, end_date')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('start_date', { ascending: false }),
        supabase
          .from('matches')
          .select(
            '*, tournament:tournament_id(id, name, sport, status, start_date, is_deleted), team_a:team_a_id(name), team_b:team_b_id(name)'
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
        () => {
          fetchExplorerData();
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

  // Tournaments applicable to the currently selected sport
  const tournamentsForSport = useMemo(() => {
    if (selectedSport === 'all') return tournaments;
    return tournaments.filter((t) => {
      if (t.sport && t.sport.toLowerCase() === selectedSport.toLowerCase()) return true;
      return matches.some(
        (m) =>
          m.tournament_id === t.id &&
          extractSportName(m, tourMap).toLowerCase() === selectedSport.toLowerCase()
      );
    });
  }, [tournaments, selectedSport, matches, tourMap]);

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
    setSelectedBracketTournId(tourId === 'all' ? null : tourId);
    setUserPhaseOverride(null);
    if (tourId === 'all') return;
    const tour = tourMap.get(tourId);
    if (tour?.sport) {
      setSelectedSport(tour.sport);
    }
  };

  // Elimination matches filtered by sport & selected tournament
  const eliminationMatches = useMemo(() => {
    return matches.filter((m) => {
      if (isPlayoffRound(m.round) || m.next_match_id) return false;
      if (selectedTournamentId !== 'all' && m.tournament_id !== selectedTournamentId) return false;
      if (selectedSport !== 'all') {
        const sportName = extractSportName(m, tourMap);
        if (sportName.toLowerCase() !== selectedSport.toLowerCase()) return false;
      }
      return true;
    });
  }, [matches, selectedTournamentId, selectedSport, tourMap]);

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

  // Live / Scheduled vs History
  const elimLiveAndUpcoming = useMemo(() => {
    return filteredEliminationMatches.filter(
      (m) => m.status === 'Scheduled' || m.status === 'Ongoing'
    );
  }, [filteredEliminationMatches]);

  const elimHistory = useMemo(() => {
    return filteredEliminationMatches
      .filter((m) => m.status === 'Completed')
      .sort((a, b) => new Date(b.match_time).getTime() - new Date(a.match_time).getTime());
  }, [filteredEliminationMatches]);

  // Playoff Bracket rounds grouping
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
      } else if (r.includes('quarter')) {
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

  // Identify Champion and its designated College or Cluster/Tribe
  const championDetails = useMemo(() => {
    const completedFinal = playoffRoundsGrouped.finals.find((m) => m.status === 'Completed');
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
      type: aff ? aff.type : 'squad'
    };
  }, [playoffRoundsGrouped.finals, teamsMap]);

  // Available elimination rounds for filter dropdown
  const availableRounds = useMemo(() => {
    const roundsSet = new Set<string>();
    eliminationMatches.forEach((m) => {
      if (m.round) roundsSet.add(m.round);
    });
    return Array.from(roundsSet);
  }, [eliminationMatches]);

  // Live and total match counts
  const liveMatchesCount = useMemo(() => {
    return matches.filter((m) => m.status === 'Ongoing').length;
  }, [matches]);

  // Elimination completion status: True ONLY when all elimination fixtures have completed
  const isEliminationComplete = useMemo(() => {
    if (eliminationMatches.length === 0) return false;
    return eliminationMatches.every((m) => m.status === 'Completed');
  }, [eliminationMatches]);

  // Active Phase: smart-defaults to playoffs if a tournament has ONLY playoffs, or if eliminations have concluded; otherwise defaults to elimination
  const activePhase: MatchCenterPhase =
    userPhaseOverride ??
    (eliminationMatches.length === 0 && hasPlayoffs
      ? 'playoffs'
      : isEliminationComplete && hasPlayoffs
      ? 'playoffs'
      : 'elimination');

  const selectedTourObj = tournaments.find((t) => t.id === selectedTournamentId);
  const isSelectedDraft = selectedTourObj?.status === 'Draft';

  const hasActiveFilters =
    selectedTournamentId !== 'all' ||
    selectedSport !== 'all' ||
    selectedRound !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedTournamentId('all');
    setSelectedSport('all');
    setSelectedRound('all');
    setSearchQuery('');
    setUserPhaseOverride(null);
    setMobilePlayoffStage('all');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] w-full gap-4">
        <div className="size-10 sm:size-12 rounded-full border-3 border-orange-500/20 border-t-orange-500 animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-[11px]">
          Loading Match Center...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-10 max-w-full animate-in fade-in duration-300">
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
                  Phase 1 elimination fixtures are currently underway. Once regular fixtures conclude, qualified squads advance to the Single Elimination Playoff Bracket.
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
                <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 sm:p-7 shadow-2xl border border-amber-300/30 text-center animate-in zoom-in-95 duration-500">
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="size-12 sm:size-14 rounded-2xl bg-white/20 backdrop-blur-md text-yellow-300 flex items-center justify-center border border-white/30 shadow-lg">
                      <Crown className="size-7 sm:size-8 animate-bounce" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-black/20 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                      {championDetails.type === 'cluster'
                        ? 'Official Binturungan Tribe Champion'
                        : 'Official Collegiate Champion • Gold Medalist'}
                    </span>
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none drop-shadow-md">
                      {championDetails.title}
                    </h2>
                    <p className="text-white/90 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-0.5 inline-flex items-center gap-1.5">
                      <Trophy className="size-3.5 text-yellow-200" />
                      <span>{championDetails.teamName} • Palawan State University</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Knockout Bracket Arena */}
              <KnockoutBracketTree
                playoffs={orderedPlayoffs}
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
        /* Phase 1: Elimination Stage View */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Elimination Concluded Banner Notice */}
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

          {/* Sub-view switcher for Elimination Stage: Upcoming/Live vs Results */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setElimTab('live')}
                className={`py-1.5 px-3 rounded-lg font-black uppercase italic text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  elimTab === 'live'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="size-3.5" />
                <span>Upcoming & Live</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    elimTab === 'live' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  {elimLiveAndUpcoming.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setElimTab('history')}
                className={`py-1.5 px-3 rounded-lg font-black uppercase italic text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  elimTab === 'history'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Trophy className="size-3.5" />
                <span>Match Results</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    elimTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  {elimHistory.length}
                </span>
              </button>
            </div>
          </div>

          {/* Fixtures Timeline */}
          <MatchScheduleList
            matches={elimTab === 'live' ? elimLiveAndUpcoming : elimHistory}
            isResultsMode={elimTab === 'history'}
            tourMap={tourMap}
            teamsMap={teamsMap}
            availableRounds={availableRounds}
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
            onNavigateMatch={(id) => navigate(`/match/${id}`)}
          />
        </div>
      )}
    </div>
  );
};
