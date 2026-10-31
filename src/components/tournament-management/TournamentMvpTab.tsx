import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Trophy,
  Star,
  Search,
  Zap,
  Flame,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRightLeft,
  Trash2,
  Users,
} from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { getSportIcon } from '@/lib/sportIcons';
import { BALLGAMES_LIST, type Tournament } from './types';
import { TournamentGoldStarModal, type TournamentGoldStarCandidate } from './TournamentGoldStarModal';
import { AdminGoldStarOverrideModal } from './AdminGoldStarOverrideModal';

interface TournamentMvpTabProps {
  tournaments: Tournament[];
}

interface GoldStarRecord {
  id: string;
  tournament_id: string;
  player_id: string;
  winner_name: string;
  justification?: string | null;
  override_reason?: string | null;
  created_at: string;
  awarded_by?: string;
}

export const TournamentMvpTab: React.FC<TournamentMvpTabProps> = ({ tournaments }) => {
  // Navigation & Filter State
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'crowned'>('all');

  // Master Gold Stars Cache across all tournaments
  const [goldStarsMap, setGoldStarsMap] = useState<Record<string, GoldStarRecord>>({});
  const [isLoadingGoldStars, setIsLoadingGoldStars] = useState<boolean>(true);

  // Selected Tournament Data
  const [candidates, setCandidates] = useState<TournamentGoldStarCandidate[]>([]);
  const [championTeamName, setChampionTeamName] = useState<string | null>(null);
  const [isLoadingTournamentData, setIsLoadingTournamentData] = useState<boolean>(false);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState<string>('');

  // Modals State
  const [activeNominationCandidate, setActiveNominationCandidate] = useState<TournamentGoldStarCandidate | null>(null);
  const [isNominationModalOpen, setIsNominationModalOpen] = useState<boolean>(false);
  const [isSubmittingNomination, setIsSubmittingNomination] = useState<boolean>(false);

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);

  // 1. Initial Batch Fetch: Load all Gold Stars for all tournaments at once
  const fetchAllGoldStars = useCallback(async () => {
    setIsLoadingGoldStars(true);
    try {
      const { data, error } = await supabase
        .from('player_stars')
        .select('id, tournament_id, player_id, users:player_id(full_name), justification, override_reason, created_at, awarded_by')
        .eq('star_type', 'Gold');

      if (error) throw error;

      const map: Record<string, GoldStarRecord> = {};
      if (data) {
        for (const star of data as any[]) {
          const uObj = star.users;
          const winnerName = Array.isArray(uObj) ? uObj[0]?.full_name : uObj?.full_name;
          map[star.tournament_id] = {
            id: star.id,
            tournament_id: star.tournament_id,
            player_id: star.player_id,
            winner_name: winnerName || 'Awarded Athlete',
            justification: star.justification,
            override_reason: star.override_reason,
            created_at: star.created_at,
            awarded_by: star.awarded_by,
          };
        }
      }
      setGoldStarsMap(map);
    } catch (err: any) {
      console.error('Failed to load tournament gold stars:', err);
    } finally {
      setIsLoadingGoldStars(false);
    }
  }, []);

  useEffect(() => {
    fetchAllGoldStars();
  }, [fetchAllGoldStars]);

  // Set default tournament when list loads
  useEffect(() => {
    if (tournaments.length === 0) {
      setSelectedTournamentId('');
      return;
    }
    // If current selected tournament is still valid, keep it
    if (selectedTournamentId && tournaments.some((t) => t.id === selectedTournamentId)) {
      return;
    }
    // Otherwise pick the first pending tournament, or first overall
    const firstPending = tournaments.find((t) => !goldStarsMap[t.id]);
    setSelectedTournamentId(firstPending ? firstPending.id : tournaments[0].id);
  }, [tournaments, goldStarsMap, selectedTournamentId]);

  // 2. Fetch Selected Tournament Data & Candidates
  useEffect(() => {
    if (!selectedTournamentId) {
      setCandidates([]);
      setChampionTeamName(null);
      return;
    }

    let isCancelled = false;

    const fetchTournamentContenders = async () => {
      setIsLoadingTournamentData(true);
      try {
        // Parallel fetch: teams, completed finals match, rosters, player stats, match red stars
        const [
          { data: teamsData },
          { data: matchesData },
          { data: redStarsData },
        ] = await Promise.all([
          supabase
            .from('teams')
            .select('id, name, college_id, colleges(name, short_name), status')
            .eq('tournament_id', selectedTournamentId)
            .eq('status', 'Approved')
            .or('is_deleted.is.null,is_deleted.eq.false'),
          supabase
            .from('matches')
            .select('id, round, status, winner_id, team_a_id, team_b_id, team_a_score, team_b_score')
            .eq('tournament_id', selectedTournamentId),
          supabase
            .from('player_stars')
            .select('id, player_id, match_id')
            .eq('tournament_id', selectedTournamentId)
            .eq('star_type', 'Red'),
        ]);

        if (isCancelled) return;

        const teamIds = (teamsData || []).map((t) => t.id);
        const teamMap = new Map<string, any>((teamsData || []).map((t) => [t.id, t]));

        // Determine Champion squad (from completed finals match or highest win count)
        const finalsMatch = (matchesData || []).find(
          (m) => m.round === 'Finals' && m.status === 'Completed' && m.winner_id
        );
        let champId = finalsMatch?.winner_id || null;
        let champName = champId ? teamMap.get(champId)?.name || 'Champion Team' : null;
        setChampionTeamName(champName);

        if (teamIds.length === 0) {
          setCandidates([]);
          return;
        }

        // Fetch rosters and stats
        const matchIds = (matchesData || []).map((m) => m.id);
        const [{ data: rosterData }, { data: statsData }] = await Promise.all([
          supabase
            .from('team_roster')
            .select('id, team_id, player_id, jersey_number, position, is_starter, status, users(full_name)')
            .in('team_id', teamIds)
            .eq('status', 'Approved'),
          matchIds.length > 0
            ? supabase
                .from('match_player_stats')
                .select('match_id, player_id, points')
                .in('match_id', matchIds)
            : Promise.resolve({ data: [] }),
        ]);

        if (isCancelled) return;

        // Group player stats
        const playerPointsMap = new Map<string, { totalPoints: number; matchesSet: Set<string> }>();
        for (const stat of (statsData || []) as any[]) {
          if (!stat.player_id) continue;
          const cur = playerPointsMap.get(stat.player_id) || { totalPoints: 0, matchesSet: new Set<string>() };
          cur.totalPoints += Number(stat.points || 0);
          if (stat.match_id) cur.matchesSet.add(stat.match_id);
          playerPointsMap.set(stat.player_id, cur);
        }

        // Count match red stars per player
        const redStarsCountMap = new Map<string, number>();
        for (const star of (redStarsData || []) as any[]) {
          if (!star.player_id) continue;
          redStarsCountMap.set(star.player_id, (redStarsCountMap.get(star.player_id) || 0) + 1);
        }

        // Map candidates
        const rawCandidates: TournamentGoldStarCandidate[] = [];
        const seenPlayerIds = new Set<string>();

        for (const r of (rosterData || []) as any[]) {
          if (!r.player_id || seenPlayerIds.has(r.player_id)) continue;
          seenPlayerIds.add(r.player_id);

          const team = teamMap.get(r.team_id);
          const uObj = r.users;
          const pName = Array.isArray(uObj) ? uObj[0]?.full_name : uObj?.full_name || 'Contender Athlete';
          const statRec = playerPointsMap.get(r.player_id);
          const points = statRec?.totalPoints || 0;
          const gamesPlayed = statRec?.matchesSet.size || (matchesData && matchesData.length > 0 ? 1 : 0);
          const ppg = gamesPlayed > 0 ? Number((points / gamesPlayed).toFixed(1)) : 0;
          const redStarsCount = redStarsCountMap.get(r.player_id) || 0;
          const isChampion = Boolean(champId && r.team_id === champId);

          rawCandidates.push({
            playerId: r.player_id,
            name: pName,
            jerseyNumber: r.jersey_number,
            position: r.position,
            teamId: r.team_id,
            teamName: team?.name || 'Tournament Squad',
            collegeName: team?.colleges?.name || null,
            points,
            gamesPlayed,
            ppg,
            redStarsCount,
            isChampion,
            squadFinish: isChampion ? '1st Place Champion' : 'Podium / Contender',
          });
        }

        // Multi-Factor Standout Contender Ranking formula:
        // Priority 1: Champion squad
        // Priority 2: Red Stars count (descending)
        // Priority 3: Total points (descending)
        rawCandidates.sort((a, b) => {
          if (a.isChampion !== b.isChampion) {
            return a.isChampion ? -1 : 1;
          }
          if (b.redStarsCount !== a.redStarsCount) {
            return b.redStarsCount - a.redStarsCount;
          }
          return b.points - a.points;
        });

        setCandidates(rawCandidates);
      } catch (err: any) {
        console.error('Failed to load tournament candidates:', err);
        toast.error('Failed to load tournament athlete performance stats.');
      } finally {
        if (!isCancelled) {
          setIsLoadingTournamentData(false);
        }
      }
    };

    fetchTournamentContenders();

    return () => {
      isCancelled = true;
    };
  }, [selectedTournamentId]);

  // 3. Filtered Tournaments for the Master Sidebar
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const isCrowned = Boolean(goldStarsMap[t.id]);

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesSport = t.sport.toLowerCase().includes(q);
        const winnerName = goldStarsMap[t.id]?.winner_name?.toLowerCase() || '';
        const matchesWinner = winnerName.includes(q);
        if (!matchesName && !matchesSport && !matchesWinner) return false;
      }

      // Sport Filter
      if (sportFilter !== 'all') {
        if (t.sport.toLowerCase() !== sportFilter.toLowerCase()) return false;
      }

      // Status Filter
      if (statusFilter === 'pending' && isCrowned) return false;
      if (statusFilter === 'crowned' && !isCrowned) return false;

      return true;
    });
  }, [tournaments, goldStarsMap, searchQuery, sportFilter, statusFilter]);

  // Overall Hall of Fame Progress Metrics
  const totalTournaments = tournaments.length;
  const crownedCount = tournaments.filter((t) => Boolean(goldStarsMap[t.id])).length;
  const pendingCount = totalTournaments - crownedCount;
  const progressPercentage = totalTournaments > 0 ? Math.round((crownedCount / totalTournaments) * 100) : 0;

  // Selected Tournament Object & Crowned Record
  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId) || null;
  const selectedCrownedStar = selectedTournamentId ? goldStarsMap[selectedTournamentId] : null;

  // Standout Top 3 Spotlight Contenders
  const top3Contenders = useMemo(() => {
    return candidates.slice(0, 3);
  }, [candidates]);

  // Searchable Full Candidate Directory
  const filteredCandidates = useMemo(() => {
    if (!candidateSearchQuery.trim()) return candidates;
    const q = candidateSearchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.teamName.toLowerCase().includes(q) ||
        (c.jerseyNumber && String(c.jerseyNumber).includes(q))
    );
  }, [candidates, candidateSearchQuery]);

  // Quick Jump: Advance to Next Pending Tournament
  const handleQuickJumpNextPending = useCallback(() => {
    const nextPending = tournaments.find((t) => !goldStarsMap[t.id]);
    if (nextPending) {
      setSelectedTournamentId(nextPending.id);
      toast.info(`Switched to pending: ${nextPending.name}`);
    } else {
      toast.success('All tournaments have been crowned with Tournament MVPs! 👑');
    }
  }, [tournaments, goldStarsMap]);

  // Nomination Action Handler
  const handleNominateCandidate = (cand: TournamentGoldStarCandidate) => {
    setActiveNominationCandidate(cand);
    setIsNominationModalOpen(true);
  };

  // Commit Nomination & Auto-Advance
  const handleConfirmAward = async (justification?: string) => {
    if (!selectedTournament || !activeNominationCandidate) return;

    setIsSubmittingNomination(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newStar, error } = await supabase
        .from('player_stars')
        .insert({
          player_id: activeNominationCandidate.playerId,
          star_type: 'Gold',
          tournament_id: selectedTournament.id,
          awarded_by: user?.id || null,
          justification: justification || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('A Tournament MVP has already been inducted for this tournament.');
          return;
        }
        throw error;
      }

      await logAudit({
        action: 'AWARD_STAR',
        entity_type: 'player_stars',
        entity_id: activeNominationCandidate.playerId,
        details: `Awarded Tournament MVP Gold Star to ${activeNominationCandidate.name} (${activeNominationCandidate.teamName}) in "${selectedTournament.name}"`,
      });

      toast.success(`👑 ${activeNominationCandidate.name} crowned Tournament MVP!`);

      // Update local state immediately
      const updatedMap = {
        ...goldStarsMap,
        [selectedTournament.id]: {
          id: newStar.id,
          tournament_id: selectedTournament.id,
          player_id: activeNominationCandidate.playerId,
          winner_name: activeNominationCandidate.name,
          justification: justification || null,
          created_at: newStar.created_at || new Date().toISOString(),
          awarded_by: user?.id,
        },
      };
      setGoldStarsMap(updatedMap);
      setIsNominationModalOpen(false);

      // Auto-advance to next pending tournament
      const nextPending = tournaments.find(
        (t) => t.id !== selectedTournament.id && !updatedMap[t.id]
      );
      if (nextPending) {
        setSelectedTournamentId(nextPending.id);
        toast.info(`⚡ Auto-advancing to: ${nextPending.name}`);
      }
    } catch (err: any) {
      toast.error('Failed to award Tournament MVP: ' + err.message);
    } finally {
      setIsSubmittingNomination(false);
    }
  };

  // Reassign or Revoke Success Handler
  const handleOverrideSuccess = (result: { reassignedPlayerName?: string; revoked?: boolean }) => {
    if (!selectedTournamentId) return;

    if (result.revoked) {
      setGoldStarsMap((prev) => {
        const copy = { ...prev };
        delete copy[selectedTournamentId];
        return copy;
      });
    } else if (result.reassignedPlayerName) {
      setGoldStarsMap((prev) => {
        const cur = prev[selectedTournamentId];
        if (!cur) return prev;
        return {
          ...prev,
          [selectedTournamentId]: {
            ...cur,
            winner_name: result.reassignedPlayerName!,
          },
        };
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* MASTER-DETAIL COMMAND CENTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT MASTER COLUMN (Sidebar Directory) ================= */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Progress Header Card */}
          <div className="p-5 bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Trophy className="size-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase italic tracking-tight text-white">
                    Hall of Fame Queue
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {crownedCount} of {totalTournaments} Crowned • {progressPercentage}%
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono font-black">
                {pendingCount} Pending
              </Badge>
            </div>

            {/* Progress Meter Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Quick Jump Action */}
            <Button
              data-testid="quick-jump-pending-btn"
              onClick={handleQuickJumpNextPending}
              disabled={pendingCount === 0}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-black text-xs uppercase tracking-wider rounded-xl gap-2 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <Zap className="size-4 fill-amber-400" />
              {pendingCount > 0 ? '⚡ Quick Jump: Next Pending Arena' : 'All Arenas Crowned'}
            </Button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                data-testid="tournament-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search arena or athlete..."
                className="bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs pl-9 h-10 rounded-xl focus-visible:ring-amber-500"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({totalTournaments})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('crowned')}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'crowned'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Crowned ({crownedCount})
              </button>
            </div>

            {/* Sport Category Filter Pills (9 PSU ballgames only) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSportFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                  sportFilter === 'all'
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-300'
                }`}
              >
                All Sports
              </button>
              {BALLGAMES_LIST.map((sp) => {
                const IconComponent = sp.icon;
                const isSelected = sportFilter.toLowerCase() === sp.name.toLowerCase();
                return (
                  <button
                    key={sp.name}
                    type="button"
                    onClick={() => setSportFilter(isSelected ? 'all' : sp.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <IconComponent className="size-3" />
                    <span>{sp.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tournament Cards Scrollable List */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {isLoadingGoldStars ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 text-xs">
                Loading tournament queue...
              </div>
            ) : filteredTournaments.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 text-xs">
                No matching tournaments found.
              </div>
            ) : (
              filteredTournaments.map((t) => {
                const isSelected = t.id === selectedTournamentId;
                const crowned = goldStarsMap[t.id];
                const SportIcon = getSportIcon(t.sport);

                return (
                  <div
                    key={t.id}
                    data-testid={`tournament-card-${t.id}`}
                    onClick={() => setSelectedTournamentId(t.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                        : 'bg-slate-950/80 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                            crowned
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                          }`}
                        >
                          <SportIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-xs text-white truncate tracking-tight">
                            {t.name}
                          </h4>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-semibold text-slate-300">{t.sport}</span>
                            <span>•</span>
                            <span>{t.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {crowned ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider px-2 py-0.5">
                            👑 {crowned.winner_name.split(' ')[0]}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT DETAIL WORKSPACE (Command Deck) ================= */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {!selectedTournament ? (
            <div className="p-16 text-center rounded-3xl bg-slate-950 border border-slate-800 text-slate-500 space-y-3">
              <Trophy className="size-12 mx-auto text-slate-600 opacity-40" />
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">
                Select a Tournament Arena
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select an arena from the master queue on the left to evaluate standout contenders and induct the official Tournament MVP.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* ARENA HEADER BANNER */}
              <div className="p-6 bg-slate-950 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {(() => {
                      const SportIcon = getSportIcon(selectedTournament.sport);
                      return (
                        <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          <SportIcon className="size-6" />
                        </div>
                      );
                    })()}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-900 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                          {selectedTournament.sport}
                        </Badge>
                        <Badge className="bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                          {selectedTournament.status}
                        </Badge>
                      </div>
                      <h2 className="text-xl font-black italic uppercase tracking-tight text-white mt-1">
                        {selectedTournament.name}
                      </h2>
                    </div>
                  </div>

                  {/* Crowned / Pending Status Indicator */}
                  <div className="shrink-0">
                    {selectedCrownedStar ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        Crowned Hall of Fame
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5">
                        <Sparkles className="size-3.5" />
                        Pending Gold Star
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Champion Squad Banner */}
                {championTeamName ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Trophy className="size-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                        1st Place Champion: <strong className="text-white underline">{championTeamName}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest hidden sm:inline">
                      Official Tournament Winner
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
                    <AlertCircle className="size-4 text-slate-500 shrink-0" />
                    <span>Tournament in progress or finals pending • Evaluating overall candidate performance</span>
                  </div>
                )}
              </div>

              {/* IF CROWNED: COLOSSAL HALL OF FAME CERTIFICATE CARD */}
              {selectedCrownedStar && (
                <div
                  data-testid="crowned-hof-banner"
                  className="p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/30 shadow-2xl relative overflow-hidden space-y-6"
                >
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="size-16 rounded-3xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/20 shrink-0">
                          <Trophy className="size-9" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
                            Official Tournament MVP
                          </div>
                          <h3 className="text-3xl font-black uppercase italic tracking-tight text-white mt-0.5">
                            {selectedCrownedStar.winner_name}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium mt-1">
                            Inducted on {new Date(selectedCrownedStar.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Administrative Governance Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          data-testid="reassign-mvp-btn"
                          variant="outline"
                          onClick={() => setIsOverrideModalOpen(true)}
                          className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold uppercase rounded-xl h-10 px-3.5 gap-2 cursor-pointer"
                        >
                          <ArrowRightLeft className="size-3.5 text-amber-400" />
                          Reassign
                        </Button>
                        <Button
                          data-testid="revoke-mvp-btn"
                          variant="outline"
                          onClick={() => setIsOverrideModalOpen(true)}
                          className="bg-slate-900 border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-bold uppercase rounded-xl h-10 px-3.5 gap-2 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          Revoke
                        </Button>
                      </div>
                    </div>

                    {/* Citation / Justification Note */}
                    {selectedCrownedStar.justification && (
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 italic leading-relaxed">
                        "{selectedCrownedStar.justification}"
                      </div>
                    )}
                  </div>
                  <Star className="absolute -bottom-8 -right-8 size-48 text-amber-500/5 rotate-12 pointer-events-none" />
                </div>
              )}

              {/* TOP 3 STANDOUT CONTENDERS SPOTLIGHT (If Pending MVP) */}
              {!selectedCrownedStar && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="size-4 text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                        Top Contenders Spotlight
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Ranked by Champion finish + Red Stars + PTS
                    </span>
                  </div>

                  {isLoadingTournamentData ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 text-xs">
                      Loading tournament contenders...
                    </div>
                  ) : top3Contenders.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 text-xs">
                      No candidate rosters or stats recorded for this tournament arena yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {top3Contenders.map((cand, idx) => {
                        const isTopContender = idx === 0;
                        return (
                          <div
                            key={cand.playerId}
                            data-testid={`spotlight-card-${idx}`}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                              isTopContender
                                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-amber-500/40 shadow-lg shadow-amber-500/5'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Header Badges */}
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 ${
                                    isTopContender
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {isTopContender ? '⭐ #1 Contender' : `#${idx + 1} Standout`}
                                </Badge>
                                {cand.isChampion && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5">
                                    🏆 Champ
                                  </Badge>
                                )}
                              </div>

                              {/* Athlete Details */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                                    {cand.jerseyNumber ? `#${cand.jerseyNumber}` : '—'}
                                  </span>
                                  <h4 className="font-black text-sm text-white truncate tracking-tight">
                                    {cand.name}
                                  </h4>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                                  {cand.teamName}
                                </p>
                              </div>

                              {/* Performance Stats */}
                              <div className="grid grid-cols-3 gap-1 py-1.5 border-y border-slate-800/80 text-center">
                                <div>
                                  <div className="text-[9px] uppercase font-bold text-slate-500">Points</div>
                                  <div className="text-xs font-black text-white">{cand.points}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase font-bold text-slate-500">PPG</div>
                                  <div className="text-xs font-black text-amber-400">{cand.ppg}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase font-bold text-slate-500">Red Stars</div>
                                  <div className="text-xs font-black text-red-400 flex items-center justify-center gap-0.5">
                                    <Star className="size-2.5 fill-red-500 text-red-500" />
                                    {cand.redStarsCount}x
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Nominate Action */}
                            <Button
                              data-testid={`nominate-spotlight-${idx}`}
                              onClick={() => handleNominateCandidate(cand)}
                              className={`w-full h-9 mt-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                                isTopContender
                                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                                  : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              <Star className="size-3.5 mr-1 fill-current" />
                              Nominate Gold Star
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* FULL SEARCHABLE CANDIDATE DIRECTORY TABLE */}
              <div className="p-5 bg-slate-950 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-slate-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                      All Tournament Contenders ({filteredCandidates.length})
                    </h3>
                  </div>
                  {/* Candidate Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="size-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      data-testid="candidate-search-input"
                      value={candidateSearchQuery}
                      onChange={(e) => setCandidateSearchQuery(e.target.value)}
                      placeholder="Filter candidate roster..."
                      className="bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs pl-8 h-9 rounded-xl focus-visible:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Contenders Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Athlete</th>
                        <th className="py-2.5 px-3">Squad</th>
                        <th className="py-2.5 px-3 text-center">PTS</th>
                        <th className="py-2.5 px-3 text-center">PPG</th>
                        <th className="py-2.5 px-3 text-center">Match MVPs</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredCandidates.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                            No contenders match search filter.
                          </td>
                        </tr>
                      ) : (
                        filteredCandidates.map((cand) => (
                          <tr
                            key={cand.playerId}
                            className="hover:bg-slate-900/50 transition-colors"
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                                  {cand.jerseyNumber ? `#${cand.jerseyNumber}` : '—'}
                                </span>
                                <span className="font-bold text-white tracking-tight">
                                  {cand.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-300 font-medium truncate max-w-[140px]">
                                  {cand.teamName}
                                </span>
                                {cand.isChampion && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase px-1 py-0">
                                    Champ
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                              {cand.points}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-amber-400">
                              {cand.ppg}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {cand.redStarsCount > 0 ? (
                                <span className="text-red-400 font-bold inline-flex items-center gap-1">
                                  <Star className="size-3 fill-red-500 text-red-500" />
                                  {cand.redStarsCount}x
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                data-testid={`nominate-candidate-${cand.playerId}`}
                                size="sm"
                                onClick={() => handleNominateCandidate(cand)}
                                disabled={Boolean(selectedCrownedStar)}
                                className="h-7 px-2.5 text-[10px] font-bold uppercase rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/20 disabled:opacity-30 cursor-pointer"
                              >
                                Nominate
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION / INDUCTION MODAL */}
      <TournamentGoldStarModal
        open={isNominationModalOpen}
        onOpenChange={setIsNominationModalOpen}
        tournamentName={selectedTournament?.name || 'Tournament'}
        candidate={activeNominationCandidate}
        isSubmitting={isSubmittingNomination}
        onConfirmAward={handleConfirmAward}
      />

      {/* REASSIGN / REVOKE OVERRIDE MODAL */}
      {selectedTournament && selectedCrownedStar && (
        <AdminGoldStarOverrideModal
          open={isOverrideModalOpen}
          onOpenChange={setIsOverrideModalOpen}
          starId={selectedCrownedStar.id}
          tournamentId={selectedTournament.id}
          tournamentName={selectedTournament.name}
          currentWinnerName={selectedCrownedStar.winner_name}
          currentWinnerPlayerId={selectedCrownedStar.player_id}
          currentWinnerJustification={selectedCrownedStar.justification}
          candidates={candidates}
          onSuccess={handleOverrideSuccess}
        />
      )}
    </div>
  );
};
