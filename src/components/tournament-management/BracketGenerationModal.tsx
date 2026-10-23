import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trophy, 
  Shuffle, 
  LayoutGrid, 
  CheckCircle2, 
  RotateCcw, 
  ChevronRight, 
  MapPin, 
  CalendarDays, 
  ArrowLeft, 
  Lightbulb, 
  Users,
  GitFork,
  ListOrdered,
  Layers,
  ArrowLeftRight,
  Pencil,
  Save,
  X,
  Clock
} from 'lucide-react';
import { logAudit } from '@/lib/audit';
import type { Tournament, ProposedMatch, ApprovedTeam, TournamentStanding, BracketFormatType } from './types';

interface BracketGenerationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
  onMatchesUpdated: () => void;
  onOpenConclude: (tournament: Tournament, championName: string | null) => void;
}

const pad = (n: number) => n.toString().padStart(2, '0');
const formatLocalDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const toDateTimeLocalValue = (isoOrStr?: string | null): string => {
  if (!isoOrStr) return '';
  try {
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return '';
    return formatLocalDateTime(d);
  } catch {
    return '';
  }
};

export const BracketGenerationModal: React.FC<BracketGenerationModalProps> = ({
  isOpen,
  onOpenChange,
  tournament,
  onMatchesUpdated,
  onOpenConclude,
}) => {
  const navigate = useNavigate();
  const [approvedTeams, setApprovedTeams] = useState<ApprovedTeam[]>([]);
  const [existingMatches, setExistingMatches] = useState<any[]>([]);
  const [isLoadingBracket, setIsLoadingBracket] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedBracketType, setSelectedBracketType] = useState<BracketFormatType>('single');
  const [proposedMatches, setProposedMatches] = useState<ProposedMatch[]>([]);
  const [isResetBracketDialogOpen, setIsResetBracketDialogOpen] = useState(false);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [isReopeningTournament, setIsReopeningTournament] = useState(false);

  // Mode flags for Reseeding & Phase 1 -> Phase 2 progression
  const [isReseedingMode, setIsReseedingMode] = useState(false);
  const [isAppendingPhase2, setIsAppendingPhase2] = useState(false);

  // Inline editing state for already-published matches
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editMatchForm, setEditMatchForm] = useState<{
    team_a_id: string;
    team_b_id: string;
    venue: string;
    match_time: string;
  }>({
    team_a_id: '',
    team_b_id: '',
    venue: '',
    match_time: '',
  });
  const [isSavingMatchEdit, setIsSavingMatchEdit] = useState(false);

  const fetchBracketData = async (tournamentId: string) => {
    setIsLoadingBracket(true);
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .eq('status', 'Approved');

    if (teamsData) setApprovedTeams(teamsData);

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
      .eq('tournament_id', tournamentId)
      .order('match_time', { ascending: true, nullsFirst: false });

    if (matchesData) {
      setExistingMatches(
        matchesData.map((m) => ({
          ...m,
          team_a_name: Array.isArray(m.team_a)
            ? m.team_a[0]?.name
            : (m.team_a as any)?.name ?? (m.team_a_id ? 'Unknown Team' : 'TBD'),
          team_b_name: Array.isArray(m.team_b)
            ? m.team_b[0]?.name
            : (m.team_b as any)?.name ?? (m.status === 'Completed' && m.team_a_id && !m.team_b_id ? 'BYE' : 'TBD'),
        }))
      );
    }
    setIsLoadingBracket(false);
  };

  useEffect(() => {
    if (isOpen && tournament) {
      setWizardStep(1);
      setProposedMatches([]);
      setIsReseedingMode(false);
      setIsAppendingPhase2(false);
      setEditingMatchId(null);
      fetchBracketData(tournament.id);
    }
  }, [isOpen, tournament]);

  // Detect active format of existing published matches
  const publishedFormatInfo = useMemo(() => {
    if (existingMatches.length === 0) return { mode: 'none' as const, label: 'Unseeded' };
    const rounds = existingMatches.map((m) => (m.round || '').toLowerCase());
    const hasDouble = rounds.some((r) => r.includes('upper') || r.includes('lower') || r.includes('grand final'));
    if (hasDouble) return { mode: 'double' as const, label: 'Double Elimination (Upper & Lower Bracket)' };

    const isRoundRobinOnly = existingMatches.every(
      (m) => (m.round || '').toLowerCase().includes('round robin') && !m.next_match_id
    );
    if (isRoundRobinOnly) return { mode: 'round_robin_only' as const, label: 'Round Robin Only (Most Wins Championship)' };

    const hasEliminationPools = rounds.some((r) => r.includes('elimination') || r.includes('pool'));
    const hasPlayoffTree = existingMatches.some(
      (m) =>
        Boolean(m.next_match_id) ||
        (m.round || '').toLowerCase().includes('final') ||
        (m.round || '').toLowerCase().includes('semi') ||
        (m.round || '').toLowerCase().includes('quarter')
    );

    if (hasEliminationPools && !hasPlayoffTree) {
      return { mode: 'phase1_only' as const, label: 'Phase 1 • Round Robin Elimination (Phase 2 Pending)' };
    }
    if (hasEliminationPools && hasPlayoffTree) {
      return { mode: 'hybrid_complete' as const, label: 'Phase 1 Elimination + Phase 2 Playoff Tree' };
    }
    return { mode: 'single' as const, label: 'Single Elimination Knockout Tree' };
  }, [existingMatches]);

  const allMatchesCompleted = useMemo(() => {
    if (existingMatches.length === 0) return false;
    return existingMatches.every((m) => m.status === 'Completed');
  }, [existingMatches]);

  const tournamentStandings = useMemo<TournamentStanding[]>(() => {
    if (!tournament) return [];
    const statsMap = new Map<string, TournamentStanding>();

    approvedTeams.forEach((t) => {
      statsMap.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    });

    existingMatches.forEach((m) => {
      if (m.team_a_id && !statsMap.has(m.team_a_id) && m.team_a_name !== 'BYE' && m.team_a_name !== 'TBD') {
        statsMap.set(m.team_a_id, {
          teamId: m.team_a_id,
          teamName: m.team_a_name,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        });
      }
      if (m.team_b_id && !statsMap.has(m.team_b_id) && m.team_b_name !== 'BYE' && m.team_b_name !== 'TBD') {
        statsMap.set(m.team_b_id, {
          teamId: m.team_b_id,
          teamName: m.team_b_name,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        });
      }
    });

    existingMatches.forEach((match) => {
      const scoreA = match.team_a_score || 0;
      const scoreB = match.team_b_score || 0;
      const isBye = !match.team_b_id || match.team_b_name === 'BYE';
      const isPlayed = (match.status === 'Completed' || scoreA > 0 || scoreB > 0) && !isBye;

      if (isPlayed) {
        const tA = match.team_a_id ? statsMap.get(match.team_a_id) : undefined;
        const tB = match.team_b_id ? statsMap.get(match.team_b_id) : undefined;

        if (tA && match.team_a_name !== 'BYE' && match.team_a_name !== 'TBD') {
          tA.matchesPlayed += 1;
          tA.pointsFor += scoreA;
          tA.pointsAgainst += scoreB;
          if (scoreA > scoreB) tA.wins += 1;
          else if (scoreA < scoreB) tA.losses += 1;
        }

        if (tB && match.team_b_name !== 'BYE' && match.team_b_name !== 'TBD') {
          tB.matchesPlayed += 1;
          tB.pointsFor += scoreB;
          tB.pointsAgainst += scoreA;
          if (scoreB > scoreA) tB.wins += 1;
          else if (scoreB < scoreA) tB.losses += 1;
        }

        // Only assign knockout stage medals if not Round Robin Only
        if (publishedFormatInfo.mode !== 'round_robin_only' && publishedFormatInfo.mode !== 'phase1_only') {
          const roundLower = (match.round || '').toLowerCase();
          const isWinnerA = scoreA >= scoreB;
          const winnerId = isWinnerA ? match.team_a_id : match.team_b_id;
          const loserId = isWinnerA ? match.team_b_id : match.team_a_id;

          const isGrandOrMainFinal =
            roundLower.includes('grand final') ||
            (roundLower.includes('final') &&
              !roundLower.includes('semi') &&
              !roundLower.includes('quarter') &&
              !roundLower.includes('bronze') &&
              !roundLower.includes('3rd') &&
              !roundLower.includes('upper') &&
              !roundLower.includes('lower'));

          const isBronzeOrLowerFinal =
            roundLower.includes('bronze') ||
            roundLower.includes('3rd') ||
            roundLower.includes('lower final');

          if (isGrandOrMainFinal && match.status === 'Completed') {
            if (winnerId && statsMap.has(winnerId)) {
              const winner = statsMap.get(winnerId)!;
              winner.finalRank = 1;
              winner.stage = 'Tournament Champion';
              winner.medal = 'gold';
            }
            if (loserId && statsMap.has(loserId)) {
              const loser = statsMap.get(loserId)!;
              loser.finalRank = 2;
              loser.stage = 'Grand Finalist';
              loser.medal = 'silver';
            }
          } else if (isBronzeOrLowerFinal && match.status === 'Completed') {
            if (roundLower.includes('lower final')) {
              // In Double Elimination, the loser of Lower Finals finishes 3rd Place (Bronze)
              if (loserId && statsMap.has(loserId)) {
                const loser = statsMap.get(loserId)!;
                loser.finalRank = 3;
                loser.stage = 'Bronze Medalist (Lower Finals)';
                loser.medal = 'bronze';
              }
            } else {
              // In Single Elimination 3rd Place Playoff, winner gets Bronze, loser gets 4th
              if (winnerId && statsMap.has(winnerId)) {
                const winner = statsMap.get(winnerId)!;
                winner.finalRank = 3;
                winner.stage = 'Bronze Medalist';
                winner.medal = 'bronze';
              }
              if (loserId && statsMap.has(loserId)) {
                const loser = statsMap.get(loserId)!;
                loser.finalRank = 4;
                loser.stage = '4th Place Playoff';
                loser.medal = 'elimination';
              }
            }
          }
        }
      }
    });

    const list = Array.from(statsMap.values());
    list.sort((a, b) => {
      if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank;
      if (a.finalRank && !b.finalRank) return -1;
      if (!a.finalRank && b.finalRank) return 1;
      if (b.wins !== a.wins) return b.wins - a.wins;
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      if (diffB !== diffA) return diffB - diffA;
      return b.pointsFor - a.pointsFor;
    });

    return list.map((item, idx) => {
      const calculatedRank = item.finalRank || idx + 1;
      let medal: TournamentStanding['medal'] = item.medal;
      let stage = item.stage;

      if (calculatedRank === 1) {
        medal = 'gold';
        stage =
          stage ||
          (publishedFormatInfo.mode === 'round_robin_only'
            ? 'Round Robin Champion (Most Wins)'
            : 'Tournament Champion');
      } else if (calculatedRank === 2) {
        medal = 'silver';
        stage =
          stage ||
          (publishedFormatInfo.mode === 'round_robin_only'
            ? '2nd Place Standings'
            : 'Grand Finalist');
      } else if (calculatedRank === 3) {
        medal = 'bronze';
        stage =
          stage ||
          (publishedFormatInfo.mode === 'round_robin_only'
            ? '3rd Place Standings'
            : 'Bronze Medalist');
      } else {
        stage = stage || `${calculatedRank}th Place Placement`;
      }

      return {
        ...item,
        finalRank: calculatedRank,
        medal,
        stage,
      };
    });
  }, [tournament, approvedTeams, existingMatches, publishedFormatInfo.mode]);

  const championName = useMemo(() => {
    if (existingMatches.length === 0) return null;

    // For Round Robin Only mode: once all matches are completed, #1 team with most wins is Champion
    if (publishedFormatInfo.mode === 'round_robin_only') {
      if (!allMatchesCompleted) return null;
      return tournamentStandings[0]?.teamName || null;
    }

    // For Phase 1 Only mode: champion is not crowned until Phase 2 playoffs are generated and completed
    if (publishedFormatInfo.mode === 'phase1_only') {
      return null;
    }

    const finalMatch = existingMatches.find((m) => {
      const roundLower = (m.round || '').toLowerCase();
      return (
        roundLower.includes('grand final') ||
        (roundLower.includes('final') &&
          !roundLower.includes('semi') &&
          !roundLower.includes('quarter') &&
          !roundLower.includes('bronze') &&
          !roundLower.includes('3rd') &&
          !roundLower.includes('upper') &&
          !roundLower.includes('lower'))
      );
    });

    if (!finalMatch || finalMatch.status !== 'Completed') return null;
    const scoreA = finalMatch.team_a_score || 0;
    const scoreB = finalMatch.team_b_score || 0;
    return scoreA >= scoreB ? finalMatch.team_a_name : finalMatch.team_b_name;
  }, [existingMatches, publishedFormatInfo.mode, allMatchesCompleted, tournamentStandings]);

  const getBracketRecommendation = (teamCount: number) => {
    if (teamCount < 2) {
      return {
        type: 'single' as BracketFormatType,
        title: 'Need at least 2 teams',
        reason: 'Recruit and approve more teams during the draft phase to generate a bracket.',
      };
    }
    if (teamCount <= 4) {
      return {
        type: 'round_robin_only' as BracketFormatType,
        title: 'Round Robin or Double Elimination Recommended',
        reason: `With ${teamCount} teams, Round Robin Only crowns the team with the most wins, or Double Elimination gives every squad a 2-loss lifeline.`,
      };
    }
    return {
      type: 'single' as BracketFormatType,
      title: 'Single or Double Elimination Recommended',
      reason: `Optimal for ${teamCount} teams. Use Single Elimination for a fast knockout tree or Double Elimination for Upper & Lower Bracket progression.`,
    };
  };

  /**
   * Recalculates automatic BYE advancements in Single or Double Elimination proposed matches
   * whenever opening-round seeds are generated, swapped, or edited by the admin.
   */
  const recalculateBracketProgression = (matches: ProposedMatch[]): ProposedMatch[] => {
    const updated = matches.map((m) => ({ ...m }));
    const byLocalId = new Map<string, ProposedMatch>();
    updated.forEach((m) => byLocalId.set(m.local_id, m));

    // Reset downstream slots that are fed by editable opening matches
    updated.forEach((m) => {
      if (m.is_editable_seed) {
        if (m.next_match_local_id) {
          const nextM = byLocalId.get(m.next_match_local_id);
          if (nextM) {
            if (m.next_match_slot === 'team_a') {
              nextM.team_a_id = null;
              nextM.team_a_name = 'TBD';
            } else if (m.next_match_slot === 'team_b') {
              nextM.team_b_id = null;
              nextM.team_b_name = 'TBD';
            }
          }
        }
        if (m.loser_next_match_local_id) {
          const loserM = byLocalId.get(m.loser_next_match_local_id);
          if (loserM) {
            if (m.loser_next_match_slot === 'team_a') {
              loserM.team_a_id = null;
              loserM.team_a_name = 'TBD (UB Loser)';
            } else if (m.loser_next_match_slot === 'team_b') {
              loserM.team_b_id = null;
              loserM.team_b_name = 'TBD (UB Loser)';
            }
          }
        }
      }
    });

    // Propagate BYEs from opening matches
    updated.forEach((m) => {
      if (!m.is_editable_seed) return;
      const isABye = !m.team_a_id || m.team_a_name === 'BYE';
      const isBBye = !m.team_b_id || m.team_b_name === 'BYE';

      if (isABye && !isBBye) {
        m.team_a_id = m.team_b_id;
        m.team_a_name = m.team_b_name;
        m.team_b_id = null;
        m.team_b_name = 'BYE';
      } else if (!isABye && isBBye) {
        m.team_b_id = null;
        m.team_b_name = 'BYE';
      }

      if (m.team_a_id && m.team_b_name === 'BYE') {
        // Advance Winner to Next Upper/Main Match
        if (m.next_match_local_id) {
          const nextM = byLocalId.get(m.next_match_local_id);
          if (nextM) {
            if (m.next_match_slot === 'team_a') {
              nextM.team_a_id = m.team_a_id;
              nextM.team_a_name = m.team_a_name;
            } else {
              nextM.team_b_id = m.team_a_id;
              nextM.team_b_name = m.team_a_name;
            }
          }
        }
        // Mark Loser slot in Lower Bracket as BYE
        if (m.loser_next_match_local_id) {
          const loserM = byLocalId.get(m.loser_next_match_local_id);
          if (loserM) {
            if (m.loser_next_match_slot === 'team_a') {
              loserM.team_a_id = null;
              loserM.team_a_name = 'BYE';
            } else {
              loserM.team_b_id = null;
              loserM.team_b_name = 'BYE';
            }
          }
        }
      }
    });

    return updated;
  };

  /**
   * Builds Single Elimination Knockout Tree for a given list of teams
   */
  const buildSingleEliminationMatches = (
    teamsList: ApprovedTeam[],
    baseDate: Date,
    defaultVenue: string
  ): ProposedMatch[] => {
    const N = teamsList.length;
    const totalRounds = Math.ceil(Math.log2(N));
    const bracketSize = Math.pow(2, totalRounds);
    const numRound1Matches = bracketSize / 2;
    const matchesByRound: { [r: number]: ProposedMatch[] } = {};

    const getRoundLabel = (r: number) => {
      if (r === totalRounds) return 'Finals';
      if (r === totalRounds - 1) return 'Semifinals';
      if (r === totalRounds - 2) return 'Quarterfinals';
      return `Round ${r}`;
    };

    for (let r = 1; r <= totalRounds; r++) {
      matchesByRound[r] = [];
      const numMatches = Math.pow(2, totalRounds - r);
      for (let j = 0; j < numMatches; j++) {
        const matchDate = new Date(baseDate);
        matchDate.setDate(matchDate.getDate() + (r - 1));
        matchDate.setHours(matchDate.getHours() + j * 2);

        matchesByRound[r].push({
          team_a_id: null,
          team_a_name: 'TBD',
          team_b_id: null,
          team_b_name: 'TBD',
          round: getRoundLabel(r),
          match_time: formatLocalDateTime(matchDate),
          venue: defaultVenue,
          local_id: `${r}-${j}`,
          is_editable_seed: r === 1,
          bracket_section: r === totalRounds ? 'finals' : 'upper',
        });
      }
    }

    // Distribute teams evenly across Round 1 matches so every match has Team A, and remaining slots get Team B or BYE
    const round1Matches = matchesByRound[1];
    for (let j = 0; j < numRound1Matches; j++) {
      const teamA = teamsList[j];
      if (teamA) {
        round1Matches[j].team_a_id = teamA.id;
        round1Matches[j].team_a_name = teamA.name;
      }
      const teamB = teamsList[j + numRound1Matches];
      if (teamB) {
        round1Matches[j].team_b_id = teamB.id;
        round1Matches[j].team_b_name = teamB.name;
      } else {
        round1Matches[j].team_b_id = null;
        round1Matches[j].team_b_name = 'BYE';
      }
    }

    // Link progression between rounds
    for (let r = 1; r < totalRounds; r++) {
      const currentRoundMatches = matchesByRound[r];
      for (let j = 0; j < currentRoundMatches.length; j++) {
        const parentIdx = Math.floor(j / 2);
        const parentSlot = j % 2 === 0 ? 'team_a' : 'team_b';
        currentRoundMatches[j].next_match_local_id = `${r + 1}-${parentIdx}`;
        currentRoundMatches[j].next_match_slot = parentSlot;
      }
    }

    // Add 3rd Place Playoff if Semifinals exist
    let bronzeMatch: ProposedMatch | null = null;
    if (totalRounds >= 2) {
      const semiMatches = matchesByRound[totalRounds - 1];
      if (semiMatches && semiMatches.length === 2) {
        const finalsDate = new Date(baseDate);
        finalsDate.setDate(finalsDate.getDate() + (totalRounds - 1));
        const bronzeDate = new Date(finalsDate);
        bronzeDate.setHours(Math.max(8, bronzeDate.getHours() - 2));

        bronzeMatch = {
          team_a_id: null,
          team_a_name: 'TBD (SF 1 Loser)',
          team_b_id: null,
          team_b_name: 'TBD (SF 2 Loser)',
          round: '3rd Place Playoff',
          match_time: formatLocalDateTime(bronzeDate),
          venue: defaultVenue,
          local_id: 'bronze-0',
          is_editable_seed: false,
          bracket_section: 'finals',
        };

        semiMatches[0].loser_next_match_local_id = 'bronze-0';
        semiMatches[0].loser_next_match_slot = 'team_a';
        semiMatches[1].loser_next_match_local_id = 'bronze-0';
        semiMatches[1].loser_next_match_slot = 'team_b';
      }
    }

    const flatProposed: ProposedMatch[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      flatProposed.push(...matchesByRound[r]);
    }
    if (bronzeMatch) flatProposed.push(bronzeMatch);

    return recalculateBracketProgression(flatProposed);
  };

  /**
   * Builds Double Elimination Bracket (Upper Bracket + Lower/Losers Bracket + Grand Finals)
   */
  const buildDoubleEliminationMatches = (
    teamsList: ApprovedTeam[],
    baseDate: Date,
    defaultVenue: string
  ): ProposedMatch[] => {
    const N = teamsList.length;
    const makeTime = (dayOffset: number, hourOffset: number) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(d.getHours() + hourOffset);
      return formatLocalDateTime(d);
    };

    // Case A: 2 Teams Double Elimination
    if (N === 2) {
      const m: ProposedMatch[] = [
        {
          team_a_id: teamsList[0].id,
          team_a_name: teamsList[0].name,
          team_b_id: teamsList[1].id,
          team_b_name: teamsList[1].name,
          round: 'Upper Finals',
          match_time: makeTime(0, 0),
          venue: defaultVenue,
          local_id: 'ub-1-0',
          next_match_local_id: 'gf-0',
          next_match_slot: 'team_a',
          loser_next_match_local_id: 'lb-1-0',
          loser_next_match_slot: 'team_a',
          is_editable_seed: true,
          bracket_section: 'upper',
        },
        {
          team_a_id: null,
          team_a_name: 'TBD (Upper Finals Loser)',
          team_b_id: null,
          team_b_name: 'BYE',
          round: 'Lower Finals',
          match_time: makeTime(1, 0),
          venue: defaultVenue,
          local_id: 'lb-1-0',
          next_match_local_id: 'gf-0',
          next_match_slot: 'team_b',
          is_editable_seed: false,
          bracket_section: 'lower',
        },
        {
          team_a_id: null,
          team_a_name: 'TBD (Upper Bracket Winner)',
          team_b_id: null,
          team_b_name: 'TBD (Lower Bracket Winner)',
          round: 'Grand Finals',
          match_time: makeTime(2, 0),
          venue: defaultVenue,
          local_id: 'gf-0',
          is_editable_seed: false,
          bracket_section: 'finals',
        },
      ];
      return recalculateBracketProgression(m);
    }

    // Case B: 3 to 4 Teams Double Elimination (4-Slot Upper & Lower Bracket)
    if (N <= 4) {
      const ub1A = teamsList[0];
      const ub2A = teamsList[1];
      const ub1B = teamsList[2] || null;
      const ub2B = teamsList[3] || null;

      const m: ProposedMatch[] = [
        // Upper Semifinals
        {
          team_a_id: ub1A.id,
          team_a_name: ub1A.name,
          team_b_id: ub1B ? ub1B.id : null,
          team_b_name: ub1B ? ub1B.name : 'BYE',
          round: 'Upper Semifinals',
          match_time: makeTime(0, 0),
          venue: defaultVenue,
          local_id: 'ub-1-0',
          next_match_local_id: 'ub-2-0',
          next_match_slot: 'team_a',
          loser_next_match_local_id: 'lb-1-0',
          loser_next_match_slot: 'team_a',
          is_editable_seed: true,
          bracket_section: 'upper',
        },
        {
          team_a_id: ub2A.id,
          team_a_name: ub2A.name,
          team_b_id: ub2B ? ub2B.id : null,
          team_b_name: ub2B ? ub2B.name : 'BYE',
          round: 'Upper Semifinals',
          match_time: makeTime(0, 2),
          venue: defaultVenue,
          local_id: 'ub-1-1',
          next_match_local_id: 'ub-2-0',
          next_match_slot: 'team_b',
          loser_next_match_local_id: 'lb-1-0',
          loser_next_match_slot: 'team_b',
          is_editable_seed: true,
          bracket_section: 'upper',
        },
        // Upper Finals
        {
          team_a_id: null,
          team_a_name: 'TBD',
          team_b_id: null,
          team_b_name: 'TBD',
          round: 'Upper Finals',
          match_time: makeTime(1, 0),
          venue: defaultVenue,
          local_id: 'ub-2-0',
          next_match_local_id: 'gf-0',
          next_match_slot: 'team_a',
          loser_next_match_local_id: 'lb-2-0',
          loser_next_match_slot: 'team_a',
          is_editable_seed: false,
          bracket_section: 'upper',
        },
        // Lower Round 1 (Losers of Upper Semis)
        {
          team_a_id: null,
          team_a_name: 'TBD (UB SF1 Loser)',
          team_b_id: null,
          team_b_name: 'TBD (UB SF2 Loser)',
          round: 'Lower Round 1',
          match_time: makeTime(1, 2),
          venue: defaultVenue,
          local_id: 'lb-1-0',
          next_match_local_id: 'lb-2-0',
          next_match_slot: 'team_b',
          is_editable_seed: false,
          bracket_section: 'lower',
        },
        // Lower Finals (Upper Finals Loser vs Lower Round 1 Winner)
        {
          team_a_id: null,
          team_a_name: 'TBD (Upper Finals Loser)',
          team_b_id: null,
          team_b_name: 'TBD (Lower R1 Winner)',
          round: 'Lower Finals',
          match_time: makeTime(2, 0),
          venue: defaultVenue,
          local_id: 'lb-2-0',
          next_match_local_id: 'gf-0',
          next_match_slot: 'team_b',
          is_editable_seed: false,
          bracket_section: 'lower',
        },
        // Grand Finals
        {
          team_a_id: null,
          team_a_name: 'TBD (Upper Bracket Winner)',
          team_b_id: null,
          team_b_name: 'TBD (Lower Bracket Winner)',
          round: 'Grand Finals',
          match_time: makeTime(3, 0),
          venue: defaultVenue,
          local_id: 'gf-0',
          is_editable_seed: false,
          bracket_section: 'finals',
        },
      ];
      return recalculateBracketProgression(m);
    }

    // Case C: 5 to 8+ Teams Double Elimination (8-Slot Upper & Lower Bracket)
    const cappedTeams = teamsList.slice(0, 8);
    const ubQF: ProposedMatch[] = [];
    for (let j = 0; j < 4; j++) {
      const tA = cappedTeams[j];
      const tB = cappedTeams[j + 4] || null;
      ubQF.push({
        team_a_id: tA ? tA.id : null,
        team_a_name: tA ? tA.name : 'TBD',
        team_b_id: tB ? tB.id : null,
        team_b_name: tB ? tB.name : 'BYE',
        round: 'Upper Quarterfinals',
        match_time: makeTime(0, j * 2),
        venue: defaultVenue,
        local_id: `ub-1-${j}`,
        next_match_local_id: `ub-2-${Math.floor(j / 2)}`,
        next_match_slot: j % 2 === 0 ? 'team_a' : 'team_b',
        loser_next_match_local_id: `lb-1-${Math.floor(j / 2)}`,
        loser_next_match_slot: j % 2 === 0 ? 'team_a' : 'team_b',
        is_editable_seed: true,
        bracket_section: 'upper',
      });
    }

    const ubSF: ProposedMatch[] = [
      {
        team_a_id: null,
        team_a_name: 'TBD',
        team_b_id: null,
        team_b_name: 'TBD',
        round: 'Upper Semifinals',
        match_time: makeTime(1, 0),
        venue: defaultVenue,
        local_id: 'ub-2-0',
        next_match_local_id: 'ub-3-0',
        next_match_slot: 'team_a',
        loser_next_match_local_id: 'lb-2-0',
        loser_next_match_slot: 'team_a',
        is_editable_seed: false,
        bracket_section: 'upper',
      },
      {
        team_a_id: null,
        team_a_name: 'TBD',
        team_b_id: null,
        team_b_name: 'TBD',
        round: 'Upper Semifinals',
        match_time: makeTime(1, 2),
        venue: defaultVenue,
        local_id: 'ub-2-1',
        next_match_local_id: 'ub-3-0',
        next_match_slot: 'team_b',
        loser_next_match_local_id: 'lb-2-1',
        loser_next_match_slot: 'team_a',
        is_editable_seed: false,
        bracket_section: 'upper',
      },
    ];

    const ubFinals: ProposedMatch = {
      team_a_id: null,
      team_a_name: 'TBD',
      team_b_id: null,
      team_b_name: 'TBD',
      round: 'Upper Finals',
      match_time: makeTime(2, 0),
      venue: defaultVenue,
      local_id: 'ub-3-0',
      next_match_local_id: 'gf-0',
      next_match_slot: 'team_a',
      loser_next_match_local_id: 'lb-4-0',
      loser_next_match_slot: 'team_a',
      is_editable_seed: false,
      bracket_section: 'upper',
    };

    const lbR1: ProposedMatch[] = [
      {
        team_a_id: null,
        team_a_name: 'TBD (UB QF1 Loser)',
        team_b_id: null,
        team_b_name: 'TBD (UB QF2 Loser)',
        round: 'Lower Round 1',
        match_time: makeTime(1, 4),
        venue: defaultVenue,
        local_id: 'lb-1-0',
        next_match_local_id: 'lb-2-0',
        next_match_slot: 'team_b',
        is_editable_seed: false,
        bracket_section: 'lower',
      },
      {
        team_a_id: null,
        team_a_name: 'TBD (UB QF3 Loser)',
        team_b_id: null,
        team_b_name: 'TBD (UB QF4 Loser)',
        round: 'Lower Round 1',
        match_time: makeTime(1, 6),
        venue: defaultVenue,
        local_id: 'lb-1-1',
        next_match_local_id: 'lb-2-1',
        next_match_slot: 'team_b',
        is_editable_seed: false,
        bracket_section: 'lower',
      },
    ];

    const lbR2: ProposedMatch[] = [
      {
        team_a_id: null,
        team_a_name: 'TBD (UB SF1 Loser)',
        team_b_id: null,
        team_b_name: 'TBD (LB R1 Winner)',
        round: 'Lower Round 2',
        match_time: makeTime(2, 2),
        venue: defaultVenue,
        local_id: 'lb-2-0',
        next_match_local_id: 'lb-3-0',
        next_match_slot: 'team_a',
        is_editable_seed: false,
        bracket_section: 'lower',
      },
      {
        team_a_id: null,
        team_a_name: 'TBD (UB SF2 Loser)',
        team_b_id: null,
        team_b_name: 'TBD (LB R1 Winner)',
        round: 'Lower Round 2',
        match_time: makeTime(2, 4),
        venue: defaultVenue,
        local_id: 'lb-2-1',
        next_match_local_id: 'lb-3-0',
        next_match_slot: 'team_b',
        is_editable_seed: false,
        bracket_section: 'lower',
      },
    ];

    const lbSF: ProposedMatch = {
      team_a_id: null,
      team_a_name: 'TBD (LB R2-1 Winner)',
      team_b_id: null,
      team_b_name: 'TBD (LB R2-2 Winner)',
      round: 'Lower Semifinals',
      match_time: makeTime(3, 0),
      venue: defaultVenue,
      local_id: 'lb-3-0',
      next_match_local_id: 'lb-4-0',
      next_match_slot: 'team_b',
      is_editable_seed: false,
      bracket_section: 'lower',
    };

    const lbFinals: ProposedMatch = {
      team_a_id: null,
      team_a_name: 'TBD (Upper Finals Loser)',
      team_b_id: null,
      team_b_name: 'TBD (Lower SF Winner)',
      round: 'Lower Finals',
      match_time: makeTime(3, 2),
      venue: defaultVenue,
      local_id: 'lb-4-0',
      next_match_local_id: 'gf-0',
      next_match_slot: 'team_b',
      is_editable_seed: false,
      bracket_section: 'lower',
    };

    const grandFinals: ProposedMatch = {
      team_a_id: null,
      team_a_name: 'TBD (Upper Bracket Winner)',
      team_b_id: null,
      team_b_name: 'TBD (Lower Bracket Winner)',
      round: 'Grand Finals',
      match_time: makeTime(4, 0),
      venue: defaultVenue,
      local_id: 'gf-0',
      is_editable_seed: false,
      bracket_section: 'finals',
    };

    return recalculateBracketProgression([
      ...ubQF,
      ...ubSF,
      ubFinals,
      ...lbR1,
      ...lbR2,
      lbSF,
      lbFinals,
      grandFinals,
    ]);
  };

  /**
   * Builds Round Robin Circle Fixtures (for Round Robin Only OR Phase 1 Elimination)
   */
  const buildRoundRobinMatches = (
    teamsList: ApprovedTeam[],
    baseDate: Date,
    defaultVenue: string,
    roundPrefix: 'Round Robin' | 'Elimination'
  ): ProposedMatch[] => {
    const pool: (ApprovedTeam | null)[] = [...teamsList];
    if (pool.length % 2 !== 0) {
      pool.push(null); // Dummy slot for odd team count
    }

    const numTeams = pool.length;
    const numRounds = numTeams - 1;
    const half = numTeams / 2;
    const fixtures: ProposedMatch[] = [];
    let matchCounter = 0;

    for (let r = 0; r < numRounds; r++) {
      for (let i = 0; i < half; i++) {
        const tA = pool[i];
        const tB = pool[numTeams - 1 - i];
        if (tA && tB) {
          const matchDate = new Date(baseDate);
          matchDate.setDate(matchDate.getDate() + r);
          matchDate.setHours(matchDate.getHours() + i * 2);

          fixtures.push({
            team_a_id: tA.id,
            team_a_name: tA.name,
            team_b_id: tB.id,
            team_b_name: tB.name,
            round: `${roundPrefix} - Round ${r + 1}`,
            match_time: formatLocalDateTime(matchDate),
            venue: defaultVenue,
            local_id: `rr-${r + 1}-${matchCounter++}`,
            is_editable_seed: true,
            bracket_section: 'pool',
          });
        }
      }
      // Rotate circle (keep index 0 fixed)
      const last = pool.pop()!;
      pool.splice(1, 0, last);
    }

    return fixtures;
  };

  const generateSeededMatches = () => {
    if (approvedTeams.length < 2) {
      toast.error('Need at least 2 approved teams to generate a bracket.');
      return;
    }

    const shuffled = [...approvedTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const baseDate = tournament?.start_date ? new Date(tournament.start_date + 'T09:00') : new Date();
    const defaultVenue = tournament?.sport ? `PSU ${tournament.sport} Court 1` : 'PSU Main Gymnasium';

    let generated: ProposedMatch[] = [];

    if (selectedBracketType === 'single') {
      generated = buildSingleEliminationMatches(shuffled, baseDate, defaultVenue);
      toast.success(`Generated Single Elimination bracket (${generated.length} matches). You can customize seeds, venues, and times below.`);
    } else if (selectedBracketType === 'double') {
      generated = buildDoubleEliminationMatches(shuffled, baseDate, defaultVenue);
      toast.success(`Generated Double Elimination Upper & Lower brackets (${generated.length} matches). Review seeds & schedule below.`);
    } else if (selectedBracketType === 'round_robin_only') {
      generated = buildRoundRobinMatches(shuffled, baseDate, defaultVenue, 'Round Robin');
      toast.success(`Generated Round Robin Only schedule (${generated.length} matches). Champion will be crowned by Most Wins!`);
    } else if (selectedBracketType === 'round_robin_playoffs') {
      generated = buildRoundRobinMatches(shuffled, baseDate, defaultVenue, 'Elimination');
      toast.success(`Generated Phase 1 Round Robin Elimination (${generated.length} matches). Top teams will advance to Phase 2 Playoffs.`);
    }

    setIsAppendingPhase2(false);
    setProposedMatches(generated);
    setWizardStep(2);
  };

  /**
   * Generates Phase 2 Single Elimination Playoff Bracket from top Phase 1 standings
   * (#1 vs #4, #2 vs #3) without deleting Phase 1 match history.
   */
  const handleGeneratePhase2FromStandings = () => {
    if (tournamentStandings.length < 2) {
      toast.error('Need at least 2 ranked teams from Phase 1 to generate Phase 2 playoffs.');
      return;
    }

    const topCount = tournamentStandings.length >= 4 ? 4 : 2;
    const qualified = tournamentStandings.slice(0, topCount);

    // Seed #1 vs #4 and #2 vs #3 so they are placed into Match 0 and Match 1
    let seededTeams: ApprovedTeam[] = [];
    if (topCount === 4) {
      // buildSingleEliminationMatches pairs index j with index j + numRound1Matches (j + 2)
      // So Match 0 gets [0] vs [2] (#1 vs #4), Match 1 gets [1] vs [3] (#2 vs #3)
      seededTeams = [
        { id: qualified[0].teamId, name: qualified[0].teamName }, // Seed #1 (Match 0 Team A)
        { id: qualified[1].teamId, name: qualified[1].teamName }, // Seed #2 (Match 1 Team A)
        { id: qualified[3].teamId, name: qualified[3].teamName }, // Seed #4 (Match 0 Team B)
        { id: qualified[2].teamId, name: qualified[2].teamName }, // Seed #3 (Match 1 Team B)
      ];
    } else {
      seededTeams = qualified.map((q) => ({ id: q.teamId, name: q.teamName }));
    }

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 1);
    baseDate.setHours(9, 0, 0, 0);
    const defaultVenue = tournament?.sport ? `PSU ${tournament.sport} Court 1` : 'PSU Main Gymnasium';

    const phase2Matches = buildSingleEliminationMatches(seededTeams, baseDate, defaultVenue);
    setIsAppendingPhase2(true);
    setProposedMatches(phase2Matches);
    setWizardStep(2);
    toast.success(`Seeded Top ${topCount} squads (#1 vs #4, #2 vs #3) into Phase 2 Playoff Bracket!`);
  };

  /**
   * Shuffles the seeds in Step 2 WITHOUT wiping user-edited venues and match_time values!
   */
  const handleReshuffleSeedsKeepSchedule = () => {
    const shuffled = [...approvedTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const baseDate = tournament?.start_date ? new Date(tournament.start_date + 'T09:00') : new Date();
    const defaultVenue = tournament?.sport ? `PSU ${tournament.sport} Court 1` : 'PSU Main Gymnasium';

    let fresh: ProposedMatch[] = [];
    if (selectedBracketType === 'single' || isAppendingPhase2) {
      fresh = buildSingleEliminationMatches(shuffled, baseDate, defaultVenue);
    } else if (selectedBracketType === 'double') {
      fresh = buildDoubleEliminationMatches(shuffled, baseDate, defaultVenue);
    } else if (selectedBracketType === 'round_robin_only') {
      fresh = buildRoundRobinMatches(shuffled, baseDate, defaultVenue, 'Round Robin');
    } else {
      fresh = buildRoundRobinMatches(shuffled, baseDate, defaultVenue, 'Elimination');
    }

    // Preserve existing edited venue & match_time by index
    const merged = fresh.map((m, idx) => ({
      ...m,
      venue: proposedMatches[idx]?.venue ?? m.venue,
      match_time: proposedMatches[idx]?.match_time ?? m.match_time,
    }));

    setProposedMatches(merged);
    toast.info('Re-shuffled team seeds while preserving your custom dates, times, and venues!');
  };

  /**
   * Handles changing Team A or Team B in Step 2, automatically swapping if the chosen team
   * was already placed in another opening-round slot of a knockout bracket.
   */
  const handleSelectProposedTeam = (matchIdx: number, slot: 'team_a' | 'team_b', newTeamId: string) => {
    setProposedMatches((prev) => {
      const updated = prev.map((m) => ({ ...m }));
      const targetMatch = updated[matchIdx];
      if (!targetMatch) return prev;

      const isKnockout =
        selectedBracketType === 'single' || selectedBracketType === 'double' || isAppendingPhase2;

      const newTeamObj =
        newTeamId === 'BYE'
          ? { id: null, name: 'BYE' }
          : approvedTeams.find((t) => t.id === newTeamId) || null;

      if (!newTeamObj) return prev;

      const oldTeamId = slot === 'team_a' ? targetMatch.team_a_id : targetMatch.team_b_id;
      const oldTeamName = slot === 'team_a' ? targetMatch.team_a_name : targetMatch.team_b_name;

      // If knockout bracket and newTeamId is already in another editable seed slot, swap them!
      if (isKnockout && newTeamObj.id) {
        for (let i = 0; i < updated.length; i++) {
          if (!updated[i].is_editable_seed) continue;
          if (i === matchIdx) {
            const otherSlot = slot === 'team_a' ? 'team_b' : 'team_a';
            const otherId = otherSlot === 'team_a' ? updated[i].team_a_id : updated[i].team_b_id;
            if (otherId === newTeamObj.id) {
              if (otherSlot === 'team_a') {
                updated[i].team_a_id = oldTeamId;
                updated[i].team_a_name = oldTeamName;
              } else {
                updated[i].team_b_id = oldTeamId;
                updated[i].team_b_name = oldTeamName;
              }
            }
          } else {
            if (updated[i].team_a_id === newTeamObj.id) {
              updated[i].team_a_id = oldTeamId;
              updated[i].team_a_name = oldTeamName;
            } else if (updated[i].team_b_id === newTeamObj.id) {
              updated[i].team_b_id = oldTeamId;
              updated[i].team_b_name = oldTeamName;
            }
          }
        }
      }

      if (slot === 'team_a') {
        targetMatch.team_a_id = newTeamObj.id;
        targetMatch.team_a_name = newTeamObj.name;
      } else {
        targetMatch.team_b_id = newTeamObj.id;
        targetMatch.team_b_name = newTeamObj.name;
      }

      return isKnockout ? recalculateBracketProgression(updated) : updated;
    });
  };

  /**
   * 1-Click Swap Team A and Team B inside a Step 2 match
   */
  const handleSwapProposedMatchTeams = (matchIdx: number) => {
    setProposedMatches((prev) => {
      const updated = prev.map((m, i) => {
        if (i !== matchIdx) return { ...m };
        if (m.team_b_name === 'BYE') return { ...m };
        return {
          ...m,
          team_a_id: m.team_b_id,
          team_a_name: m.team_b_name,
          team_b_id: m.team_a_id,
          team_b_name: m.team_a_name,
        };
      });
      const isKnockout =
        selectedBracketType === 'single' || selectedBracketType === 'double' || isAppendingPhase2;
      return isKnockout ? recalculateBracketProgression(updated) : updated;
    });
  };

  const handlePublishBracket = async () => {
    if (!tournament || proposedMatches.length === 0) return;
    setIsPublishing(true);

    try {
      // Only wipe existing matches if we are NOT appending Phase 2 Playoffs to completed Phase 1 pools
      if (!isAppendingPhase2) {
        // Safely break self-referencing foreign keys first before deleting matches
        await supabase
          .from('matches')
          .update({ next_match_id: null, loser_next_match_id: null })
          .eq('tournament_id', tournament.id);

        const { error: cleanupErr } = await supabase
          .from('matches')
          .delete()
          .eq('tournament_id', tournament.id);

        if (cleanupErr) console.warn('Cleaned up previous matches:', cleanupErr);
      }

      const payload = proposedMatches.map((m) => {
        const isByeMatch = Boolean(m.team_a_id && m.team_b_name === 'BYE');
        return {
          tournament_id: tournament.id,
          team_a_id: m.team_a_id,
          team_b_id: m.team_b_id,
          round: m.round,
          status: isByeMatch ? ('Completed' as const) : ('Scheduled' as const),
          team_a_score: isByeMatch ? 1 : 0,
          team_b_score: 0,
          match_time: m.match_time ? new Date(m.match_time).toISOString() : null,
          venue: m.venue || 'PSU Main Gymnasium',
        };
      });

      const { data: insertedData, error: insertError } = await supabase
        .from('matches')
        .insert(payload)
        .select();

      if (insertError) throw insertError;

      const localIdToDbId: { [localId: string]: string } = {};
      insertedData.forEach((dbMatch: any, idx: number) => {
        const localMatch = proposedMatches[idx];
        localIdToDbId[localMatch.local_id] = dbMatch.id;
      });

      const updates = proposedMatches
        .filter((m) => m.next_match_local_id || m.loser_next_match_local_id)
        .map(async (m) => {
          const dbId = localIdToDbId[m.local_id];
          const nextDbId = m.next_match_local_id ? localIdToDbId[m.next_match_local_id] : null;
          const loserDbId = m.loser_next_match_local_id ? localIdToDbId[m.loser_next_match_local_id] : null;

          const updatePayload: any = {};
          if (nextDbId) {
            updatePayload.next_match_id = nextDbId;
            updatePayload.next_match_slot = m.next_match_slot;
          }
          if (loserDbId) {
            updatePayload.loser_next_match_id = loserDbId;
            updatePayload.loser_next_match_slot = m.loser_next_match_slot;
          }

          return supabase.from('matches').update(updatePayload).eq('id', dbId);
        });

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      await supabase
        .from('tournaments')
        .update({ status: 'Active' })
        .eq('id', tournament.id);

      toast.success(
        isAppendingPhase2
          ? `Published Phase 2 Playoff Bracket (${proposedMatches.length} matches)!`
          : `Published full bracket (${proposedMatches.length} matches) and set tournament to ACTIVE!`
      );

      logAudit({
        action: 'GENERATE_BRACKET',
        entity_type: 'matches',
        entity_id: tournament.id,
        details: `Published ${proposedMatches.length} matches (${isAppendingPhase2 ? 'Phase 2 Playoffs' : selectedBracketType}) for tournament: ${tournament.name}`,
      });

      setProposedMatches([]);
      setIsReseedingMode(false);
      setIsAppendingPhase2(false);
      setWizardStep(1);
      onOpenChange(false);
      onMatchesUpdated();
    } catch (err: any) {
      toast.error('Failed to publish bracket: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  /**
   * Advances both Winner (to next_match_id) AND Loser (to loser_next_match_id for Double Elimination / 3rd Place)
   */
  const handleConfirmMatchWinner = async (match: any) => {
    const isTeamAWinner = (match.team_a_score || 0) >= (match.team_b_score || 0);
    const winnerId = isTeamAWinner ? match.team_a_id : match.team_b_id;
    const winnerName = isTeamAWinner ? match.team_a_name : match.team_b_name;
    const loserId = isTeamAWinner ? match.team_b_id : match.team_a_id;
    const loserName = isTeamAWinner ? match.team_b_name : match.team_a_name;

    if (!winnerId || winnerName === 'TBD' || winnerName === 'BYE') {
      toast.error('Cannot determine a valid winning team for this match.');
      return;
    }

    try {
      // 1. Advance Winner
      if (match.next_match_id) {
        let nextMatchField: 'team_a_id' | 'team_b_id' = 'team_a_id';
        if (match.next_match_slot === 'team_a' || match.next_match_slot === 'team_b') {
          nextMatchField = match.next_match_slot === 'team_a' ? 'team_a_id' : 'team_b_id';
        } else {
          const targetNext = existingMatches.find((m) => m.id === match.next_match_id);
          const feeders = existingMatches.filter((m) => m.next_match_id === match.next_match_id);
          if (targetNext && (targetNext.team_a_id === match.team_a_id || targetNext.team_a_id === match.team_b_id)) {
            nextMatchField = 'team_a_id';
          } else if (targetNext && (targetNext.team_b_id === match.team_a_id || targetNext.team_b_id === match.team_b_id)) {
            nextMatchField = 'team_b_id';
          } else if (feeders.length >= 2) {
            const idx = feeders.findIndex((f) => f.id === match.id);
            nextMatchField = idx === 1 ? 'team_b_id' : 'team_a_id';
          } else if (targetNext) {
            nextMatchField = !targetNext.team_a_id ? 'team_a_id' : 'team_b_id';
          }
        }
        const { error } = await supabase
          .from('matches')
          .update({ [nextMatchField]: winnerId })
          .eq('id', match.next_match_id);

        if (error) throw error;
      }

      // 2. Advance Loser to Lower Bracket or 3rd Place Playoff if linked
      if (match.loser_next_match_id && loserId && loserName !== 'BYE' && loserName !== 'TBD') {
        let loserField: 'team_a_id' | 'team_b_id' = 'team_a_id';
        if (match.loser_next_match_slot === 'team_a' || match.loser_next_match_slot === 'team_b') {
          loserField = match.loser_next_match_slot === 'team_a' ? 'team_a_id' : 'team_b_id';
        } else {
          const targetLoserNext = existingMatches.find((m) => m.id === match.loser_next_match_id);
          const loserFeeders = existingMatches.filter((m) => m.loser_next_match_id === match.loser_next_match_id);
          if (targetLoserNext && (targetLoserNext.team_a_id === match.team_a_id || targetLoserNext.team_a_id === match.team_b_id)) {
            loserField = 'team_a_id';
          } else if (targetLoserNext && (targetLoserNext.team_b_id === match.team_a_id || targetLoserNext.team_b_id === match.team_b_id)) {
            loserField = 'team_b_id';
          } else if (loserFeeders.length >= 2) {
            const idx = loserFeeders.findIndex((f) => f.id === match.id);
            loserField = idx === 1 ? 'team_b_id' : 'team_a_id';
          } else if (targetLoserNext) {
            loserField = !targetLoserNext.team_a_id ? 'team_a_id' : 'team_b_id';
          }
        }
        const { error: loserErr } = await supabase
          .from('matches')
          .update({ [loserField]: loserId })
          .eq('id', match.loser_next_match_id);

        if (loserErr) throw loserErr;
        toast.success(`Result confirmed! ${winnerName} advances, and ${loserName} moves to ${
          publishedFormatInfo.mode === 'double' ? 'the Lower Bracket' : 'the 3rd Place Playoff'
        }.`);
      } else {
        toast.success(`Match result confirmed! ${winnerName} has advanced to the next round.`);
      }

      if (tournament) fetchBracketData(tournament.id);
    } catch (err: any) {
      toast.error('Failed to confirm winner: ' + err.message);
    }
  };

  /**
   * Starts inline editing for an already-published match (Date, Time, Venue, and Teams if Scheduled)
   */
  const startEditingPublishedMatch = (match: any) => {
    setEditingMatchId(match.id);
    setEditMatchForm({
      team_a_id: match.team_a_id || 'TBD',
      team_b_id: match.team_b_id || (match.team_b_name === 'BYE' ? 'BYE' : 'TBD'),
      venue: match.venue || '',
      match_time: toDateTimeLocalValue(match.match_time),
    });
  };

  const handleSavePublishedMatchEdit = async (match: any) => {
    if (!tournament) return;
    setIsSavingMatchEdit(true);
    try {
      const updatePayload: any = {
        venue: editMatchForm.venue.trim() || 'PSU Main Gymnasium',
        match_time: editMatchForm.match_time ? new Date(editMatchForm.match_time).toISOString() : null,
      };

      if (match.status === 'Scheduled') {
        updatePayload.team_a_id =
          editMatchForm.team_a_id === 'TBD' || editMatchForm.team_a_id === 'BYE'
            ? null
            : editMatchForm.team_a_id;
        updatePayload.team_b_id =
          editMatchForm.team_b_id === 'TBD' || editMatchForm.team_b_id === 'BYE'
            ? null
            : editMatchForm.team_b_id;
      }

      const { error } = await supabase.from('matches').update(updatePayload).eq('id', match.id);
      if (error) throw error;

      toast.success(`Updated match schedule & details for ${match.round}.`);
      setEditingMatchId(null);
      await fetchBracketData(tournament.id);
      onMatchesUpdated();
    } catch (err: any) {
      toast.error('Failed to update match: ' + err.message);
    } finally {
      setIsSavingMatchEdit(false);
    }
  };

  const handleReopen = async () => {
    if (!tournament) return;
    setIsReopeningTournament(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'Active' })
        .eq('id', tournament.id);

      if (error) throw error;

      toast.success(`"${tournament.name}" reopened to Active status.`);
      setIsReopenDialogOpen(false);
      onMatchesUpdated();
    } catch (err: any) {
      toast.error('Failed to reopen tournament: ' + err.message);
    } finally {
      setIsReopeningTournament(false);
    }
  };

  const showStep1FormatSelector = existingMatches.length === 0 || isReseedingMode;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          onOpenChange(open);
          if (!open) {
            setWizardStep(1);
            setProposedMatches([]);
            setIsReseedingMode(false);
            setIsAppendingPhase2(false);
            setEditingMatchId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl overflow-y-auto max-h-[88dvh] rounded-[2rem] border-slate-200 dark:border-white/10 p-0 bg-white dark:bg-slate-950">
          {/* Header */}
          <div className="bg-slate-950 text-white px-8 py-6 rounded-t-[2rem] relative overflow-hidden">
            <div className="absolute -right-16 -top-16 size-64 bg-orange-500/10 rounded-full blur-[80px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                {tournament?.status === 'Completed' ? (
                  <>
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 font-bold text-[10px] tracking-[0.2em] uppercase">Tournament Concluded & Sealed</span>
                  </>
                ) : (
                  <>
                    <Shuffle className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-500 font-bold text-[10px] tracking-[0.2em] uppercase">Tournament Bracket & Seeding Center</span>
                  </>
                )}
              </div>
              <DialogHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="text-2xl font-black uppercase italic tracking-tight text-white">{tournament?.name}</DialogTitle>
                  <Badge className={`${
                    tournament?.status === 'Completed'
                      ? 'bg-emerald-600 text-white'
                      : tournament?.status === 'Active'
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/10 text-white'
                  } text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full`}>
                    {tournament?.status}
                  </Badge>
                  {existingMatches.length > 0 && !isReseedingMode && (
                    <Badge variant="outline" className="border-orange-500/40 text-orange-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                      {publishedFormatInfo.label}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-slate-400 text-xs font-medium mt-1">
                  {tournament?.status === 'Completed'
                    ? 'Official results are sealed. Champion is crowned and standings are archived.'
                    : wizardStep === 1 
                    ? 'Step 1: Select tournament format, manage live fixtures, or advance rounds.' 
                    : 'Step 2: Customize team seeds (VS matchups), set venues & dates/times, then publish.'}
                </DialogDescription>
              </DialogHeader>

              {tournament?.status !== 'Completed' && (
                <div className="flex items-center gap-3 mt-4">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${wizardStep === 1 ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
                    1. Format & Overview
                  </div>
                  <div className="h-px w-6 bg-white/20" />
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${wizardStep === 2 ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
                    2. Seeds & Schedule
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {isLoadingBracket ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500" />
                <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading bracket data...</p>
              </div>
            ) : wizardStep === 1 ? (
              <div className="space-y-6">
                {/* Champion Banner if Completed */}
                {tournament?.status === 'Completed' && (
                  <div className="p-6 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border-2 border-amber-500/30 flex items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center gap-4">
                      <div className="size-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                        <Trophy className="size-7" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                          Tournament Concluded • Official Champion
                        </span>
                        <h3 className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white mt-0.5">
                          {championName || tournamentStandings[0]?.teamName || 'Champion Crowned'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                          This tournament has concluded. Bracket generation is locked to preserve official athletic records.
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 shrink-0 hidden sm:inline-flex items-center gap-1.5">
                      <Trophy className="size-3" /> Gold Champion
                    </Badge>
                  </div>
                )}

                {/* Show Official Podium if Completed or All matches done (except Phase 1 waiting for Phase 2) */}
                {!isReseedingMode &&
                  publishedFormatInfo.mode !== 'phase1_only' &&
                  (tournament?.status === 'Completed' || (allMatchesCompleted && existingMatches.length > 0)) && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        {/* 2nd Place */}
                        <div className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col items-center text-center order-2 md:order-1 relative overflow-hidden shadow-sm">
                          <div className="size-14 rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 font-black text-xl mb-3 shadow-inner">
                            2
                          </div>
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-slate-500 border-slate-300 dark:border-slate-700 mb-2">
                            Silver Medal • Runner-Up
                          </Badge>
                          <h4 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white truncate max-w-full">
                            {tournamentStandings[1]?.teamName || 'Runner-Up TBD'}
                          </h4>
                          {publishedFormatInfo.mode === 'round_robin_only' && tournamentStandings[1] && (
                            <span className="text-[10px] font-bold text-slate-400 mt-1">
                              {tournamentStandings[1].wins}W - {tournamentStandings[1].losses}L (Diff: {tournamentStandings[1].pointsFor - tournamentStandings[1].pointsAgainst})
                            </span>
                          )}
                        </div>

                        {/* 1st Place */}
                        <div className="p-6 rounded-2xl border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-500/10 flex flex-col items-center text-center order-1 md:order-2 shadow-xl shadow-amber-500/10 relative overflow-hidden scale-100 md:scale-105 border-t-4">
                          <div className="size-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-2xl mb-3 shadow-lg shadow-amber-500/30">
                            <Trophy className="size-8" />
                          </div>
                          <Badge className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-0.5 mb-2 shadow-sm">
                            {publishedFormatInfo.mode === 'round_robin_only' ? 'Gold Champion • Most Wins' : 'Gold Champion • 1st Place'}
                          </Badge>
                          <h4 className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white truncate max-w-full">
                            {tournamentStandings[0]?.teamName || championName || 'Champion Crowned'}
                          </h4>
                          {publishedFormatInfo.mode === 'round_robin_only' && tournamentStandings[0] && (
                            <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 mt-1">
                              {tournamentStandings[0].wins}W - {tournamentStandings[0].losses}L (Diff: {tournamentStandings[0].pointsFor - tournamentStandings[0].pointsAgainst})
                            </span>
                          )}
                        </div>

                        {/* 3rd Place */}
                        <div className="p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col items-center text-center order-3 relative overflow-hidden shadow-sm">
                          <div className="size-14 rounded-2xl bg-amber-700/10 dark:bg-amber-500/10 border border-amber-700/20 dark:border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-500 font-black text-xl mb-3 shadow-inner">
                            3
                          </div>
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500 border-amber-700/30 dark:border-amber-500/30 mb-2">
                            Bronze Medal • 3rd Place
                          </Badge>
                          <h4 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white truncate max-w-full">
                            {tournamentStandings[2]?.teamName || (tournamentStandings.length <= 2 ? 'No 3rd Place' : 'Bronze TBD')}
                          </h4>
                          {publishedFormatInfo.mode === 'round_robin_only' && tournamentStandings[2] && (
                            <span className="text-[10px] font-bold text-slate-400 mt-1">
                              {tournamentStandings[2].wins}W - {tournamentStandings[2].losses}L (Diff: {tournamentStandings[2].pointsFor - tournamentStandings[2].pointsAgainst})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Phase 1 Elimination Complete -> Trigger Phase 2 Playoff Bracket Banner */}
                {!isReseedingMode && publishedFormatInfo.mode === 'phase1_only' && allMatchesCompleted && (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                        Phase 1 Elimination Complete • Ready for Phase 2
                      </span>
                      <h4 className="text-lg font-black uppercase italic text-slate-900 dark:text-white">
                        Advance Top Squads to Phase 2 Playoff Tree
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        All Phase 1 pool fixtures are complete. Seed the top-ranking teams (#1 vs #4, #2 vs #3) into the Single Elimination Playoff Bracket while preserving Phase 1 results.
                      </p>
                    </div>
                    <Button
                      onClick={handleGeneratePhase2FromStandings}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase italic text-xs tracking-wider h-11 px-5 rounded-xl shrink-0 gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                    >
                      <Trophy className="size-4" />
                      Generate Phase 2 Playoffs
                    </Button>
                  </div>
                )}

                {/* Show Seeding Recommendation & 4 Format Cards if no matches exist yet OR when in Reseed Mode */}
                {showStep1FormatSelector && (
                  <>
                    {isReseedingMode && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                            Reseed & Format Reconfiguration Mode
                          </span>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                            Choose your desired tournament format below, then proceed to Step 2 to customize team matchups (`VS`), dates, and venues before publishing.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsReseedingMode(false)}
                          className="h-8 text-[10px] font-black uppercase tracking-wider shrink-0 cursor-pointer"
                        >
                          Cancel Reset
                        </Button>
                      </div>
                    )}

                    {(() => {
                      const rec = getBracketRecommendation(approvedTeams.length);
                      return (
                        <div className="p-5 rounded-2xl bg-orange-500/5 dark:bg-slate-900 border border-orange-500/30 flex items-start gap-4 shadow-sm">
                          <div className="p-3 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-500/20 shrink-0">
                            <Lightbulb className="size-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">System Recommendation</span>
                              <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
                                {approvedTeams.length} Teams Ready
                              </Badge>
                            </div>
                            <h4 className="font-black italic uppercase text-lg text-slate-900 dark:text-white mt-0.5">
                              {rec.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                              {rec.reason}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4-Card Format Selector Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Single Elimination */}
                      <button
                        type="button"
                        onClick={() => setSelectedBracketType('single')}
                        className={`p-5 rounded-2xl border-2 text-left relative transition-all duration-150 cursor-pointer ${
                          selectedBracketType === 'single'
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 shadow-md shadow-orange-500/10'
                            : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {selectedBracketType === 'single' && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-5 text-orange-500" />
                          </div>
                        )}
                        <LayoutGrid className="size-7 text-orange-500 mb-2.5" />
                        <div className="flex items-center gap-2">
                          <h4 className="font-black uppercase italic tracking-tight text-base text-slate-900 dark:text-white">
                            Single Elimination
                          </h4>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-500/30 text-orange-500">
                            Knockout Tree
                          </Badge>
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">
                          Direct knockout bracket tree (Quarters → Semis → 3rd Place & Finals). Loser is eliminated, winners advance.
                        </p>
                      </button>

                      {/* 2. Double Elimination (Upper + Lower Bracket) */}
                      <button
                        type="button"
                        onClick={() => setSelectedBracketType('double')}
                        className={`p-5 rounded-2xl border-2 text-left relative transition-all duration-150 cursor-pointer ${
                          selectedBracketType === 'double'
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 shadow-md shadow-orange-500/10'
                            : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {selectedBracketType === 'double' && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-5 text-orange-500" />
                          </div>
                        )}
                        <GitFork className="size-7 text-orange-500 mb-2.5" />
                        <div className="flex items-center gap-2">
                          <h4 className="font-black uppercase italic tracking-tight text-base text-slate-900 dark:text-white">
                            Double Elimination
                          </h4>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-500/30 text-orange-500">
                            Upper + Lower Bracket
                          </Badge>
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">
                          Features an Upper Bracket (Winners) and Lower Bracket (Losers). Teams drop to the Lower Bracket on their first loss and battle back to the Grand Finals.
                        </p>
                      </button>

                      {/* 3. Round Robin ONLY (Most Wins = Champion) */}
                      <button
                        type="button"
                        onClick={() => setSelectedBracketType('round_robin_only')}
                        className={`p-5 rounded-2xl border-2 text-left relative transition-all duration-150 cursor-pointer ${
                          selectedBracketType === 'round_robin_only'
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 shadow-md shadow-orange-500/10'
                            : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {selectedBracketType === 'round_robin_only' && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-5 text-orange-500" />
                          </div>
                        )}
                        <ListOrdered className="size-7 text-orange-500 mb-2.5" />
                        <div className="flex items-center gap-2">
                          <h4 className="font-black uppercase italic tracking-tight text-base text-slate-900 dark:text-white">
                            Round Robin Only
                          </h4>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            Most Wins = Champion
                          </Badge>
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">
                          Every squad plays each other once. Does NOT proceed to a bracket tree—ranks teams by Most Wins (and point diff) to crown the Champion directly.
                        </p>
                      </button>

                      {/* 4. Round Robin + Playoffs (Phase 1 -> Phase 2) */}
                      <button
                        type="button"
                        onClick={() => setSelectedBracketType('round_robin_playoffs')}
                        className={`p-5 rounded-2xl border-2 text-left relative transition-all duration-150 cursor-pointer ${
                          selectedBracketType === 'round_robin_playoffs'
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 shadow-md shadow-orange-500/10'
                            : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {selectedBracketType === 'round_robin_playoffs' && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-5 text-orange-500" />
                          </div>
                        )}
                        <Layers className="size-7 text-orange-500 mb-2.5" />
                        <div className="flex items-center gap-2">
                          <h4 className="font-black uppercase italic tracking-tight text-base text-slate-900 dark:text-white">
                            Round Robin + Playoffs
                          </h4>
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-500/30 text-orange-500">
                            Phase 1 → Phase 2
                          </Badge>
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">
                          Phase 1 Round Robin Elimination pools followed by a Phase 2 Single Elimination Playoff Tree for the top-standing teams.
                        </p>
                      </button>
                    </div>

                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-100 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Approved Teams for This Event</p>
                          <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums">{approvedTeams.length}</span>
                            <span className="text-sm font-bold text-slate-400">teams ready</span>
                          </div>
                        </div>
                        <Users className="size-12 text-slate-200 dark:text-white/10" />
                      </div>
                    </div>
                  </>
                )}

                {/* Live Standings Leaderboard for Round Robin Only or Phase 1 Pools */}
                {!showStep1FormatSelector &&
                  (publishedFormatInfo.mode === 'round_robin_only' ||
                    publishedFormatInfo.mode === 'phase1_only' ||
                    publishedFormatInfo.mode === 'hybrid_complete') && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-1.5">
                          <ListOrdered className="size-3.5" />
                          {publishedFormatInfo.mode === 'round_robin_only'
                            ? 'Round Robin Championship Standings (Ranked by Most Wins)'
                            : 'Phase 1 Pool Standings'}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-black uppercase">
                          Tiebreaker: Win Count → Point Diff → Points For
                        </Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-wider text-slate-400">
                              <th className="py-2 pr-2">Rank</th>
                              <th className="py-2 px-2">Squad</th>
                              <th className="py-2 px-2 text-center">GP</th>
                              <th className="py-2 px-2 text-center">W - L</th>
                              <th className="py-2 px-2 text-center">PF</th>
                              <th className="py-2 px-2 text-center">PA</th>
                              <th className="py-2 pl-2 text-right">Diff</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold">
                            {tournamentStandings.map((st, idx) => {
                              const diff = st.pointsFor - st.pointsAgainst;
                              return (
                                <tr key={st.teamId} className={idx === 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                                  <td className="py-2 pr-2 font-black">#{idx + 1}</td>
                                  <td className="py-2 px-2 font-black uppercase italic truncate max-w-[180px]">
                                    {st.teamName}
                                    {idx === 0 && publishedFormatInfo.mode === 'round_robin_only' && allMatchesCompleted && (
                                      <Badge className="ml-2 bg-amber-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                                        Champion
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-center tabular-nums">{st.matchesPlayed}</td>
                                  <td className="py-2 px-2 text-center tabular-nums font-black">{st.wins} - {st.losses}</td>
                                  <td className="py-2 px-2 text-center tabular-nums text-slate-500">{st.pointsFor}</td>
                                  <td className="py-2 px-2 text-center tabular-nums text-slate-500">{st.pointsAgainst}</td>
                                  <td className="py-2 pl-2 text-right tabular-nums">{diff > 0 ? `+${diff}` : diff}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Published Matches Preview + In-Place Editor */}
                {!showStep1FormatSelector && existingMatches.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white flex items-center gap-2">
                        Bracket & Schedule Matches ({existingMatches.length})
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">
                        Click <strong className="text-orange-500">Edit</strong> on any match to adjust its Date, Time, Venue, or Teams
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                      {existingMatches.map((match) => {
                        const isCompleted = match.status === 'Completed';
                        const isTeamAWinner = (match.team_a_score || 0) >= (match.team_b_score || 0);
                        const winnerName = isTeamAWinner ? match.team_a_name : match.team_b_name;
                        const isEditingThis = editingMatchId === match.id;
                        const formattedDate = match.match_time
                          ? new Date(match.match_time).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Time TBD';

                        return (
                          <div
                            key={match.id}
                            className={`p-4 bg-white dark:bg-slate-900 border-2 rounded-2xl space-y-3 transition-all shadow-sm ${
                              isEditingThis
                                ? 'border-orange-500 ring-2 ring-orange-500/20 md:col-span-2'
                                : 'border-slate-100 dark:border-white/5 hover:border-orange-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px] font-black text-slate-500 dark:text-slate-300">
                                  {match.round}
                                </Badge>
                                <Badge
                                  className={`text-[8px] font-black uppercase ${
                                    match.status === 'Completed'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : match.status === 'Ongoing'
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {match.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3 text-orange-500" /> {formattedDate}
                                </span>
                                {match.venue && (
                                  <span className="truncate max-w-[130px] flex items-center gap-1">
                                    <MapPin className="size-3 text-orange-500" /> {match.venue}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isEditingThis ? (
                              /* In-Place Editor for Published Match */
                              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/10">
                                {match.status === 'Scheduled' ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                                    <div>
                                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                        Team A (Seed / Slot 1)
                                      </label>
                                      <Select
                                        value={editMatchForm.team_a_id}
                                        onValueChange={(val) =>
                                          setEditMatchForm((prev) => ({ ...prev, team_a_id: val || 'TBD' }))
                                        }
                                      >
                                        <SelectTrigger className="h-9 rounded-lg bg-white dark:bg-slate-900 font-bold text-xs">
                                          <SelectValue placeholder="Select Team A" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl font-bold text-xs">
                                          <SelectItem value="TBD">TBD (Unassigned)</SelectItem>
                                          {approvedTeams.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                              {t.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setEditMatchForm((prev) => ({
                                          ...prev,
                                          team_a_id: prev.team_b_id,
                                          team_b_id: prev.team_a_id,
                                        }))
                                      }
                                      className="mt-4 h-9 px-2.5 rounded-lg border-orange-500/30 text-orange-500 hover:bg-orange-500/10 cursor-pointer"
                                      title="Swap Team A & Team B"
                                    >
                                      <ArrowLeftRight className="size-3.5" />
                                    </Button>

                                    <div>
                                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                        Team B (Seed / Slot 2)
                                      </label>
                                      <Select
                                        value={editMatchForm.team_b_id}
                                        onValueChange={(val) =>
                                          setEditMatchForm((prev) => ({ ...prev, team_b_id: val || 'TBD' }))
                                        }
                                      >
                                        <SelectTrigger className="h-9 rounded-lg bg-white dark:bg-slate-900 font-bold text-xs">
                                          <SelectValue placeholder="Select Team B" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl font-bold text-xs">
                                          <SelectItem value="TBD">TBD (Unassigned)</SelectItem>
                                          {approvedTeams.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                              {t.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400 italic">
                                    Match is {match.status.toLowerCase()} — team slots are locked, but Venue and Date/Time can be updated below.
                                  </p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
                                      <MapPin className="size-3 text-orange-500" /> Place / Venue
                                    </label>
                                    <Input
                                      type="text"
                                      value={editMatchForm.venue}
                                      onChange={(e) =>
                                        setEditMatchForm((prev) => ({ ...prev, venue: e.target.value }))
                                      }
                                      className="h-9 rounded-lg text-xs font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
                                      <CalendarDays className="size-3 text-orange-500" /> Date & Time
                                    </label>
                                    <Input
                                      type="datetime-local"
                                      value={editMatchForm.match_time}
                                      onChange={(e) =>
                                        setEditMatchForm((prev) => ({ ...prev, match_time: e.target.value }))
                                      }
                                      className="h-9 rounded-lg text-xs font-bold"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingMatchId(null)}
                                    disabled={isSavingMatchEdit}
                                    className="h-8 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                                  >
                                    <X className="size-3 mr-1" /> Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleSavePublishedMatchEdit(match)}
                                    disabled={isSavingMatchEdit}
                                    className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg gap-1 cursor-pointer"
                                  >
                                    <Save className="size-3" />
                                    {isSavingMatchEdit ? 'Saving...' : 'Save Match'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                                  <span className="font-black text-xs uppercase italic truncate flex-1 text-right">
                                    {match.team_a_name}
                                  </span>
                                  <div className="flex items-center gap-1.5 px-3 py-1 mx-2 bg-white dark:bg-slate-950 rounded-lg border font-mono font-black text-xs shrink-0">
                                    <span>{match.team_a_score || 0}</span>
                                    <span>-</span>
                                    <span>{match.team_b_score || 0}</span>
                                  </div>
                                  <span className="font-black text-xs uppercase italic truncate flex-1">
                                    {match.team_b_name}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5 gap-2">
                                  <div className="flex items-center gap-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 p-0 cursor-pointer"
                                      onClick={() => navigate(`/match/${match.id}`)}
                                    >
                                      Matchroom <ChevronRight className="size-3 ml-0.5" />
                                    </Button>

                                    {tournament?.status !== 'Completed' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-600 p-0 gap-1 cursor-pointer"
                                        onClick={() => startEditingPublishedMatch(match)}
                                      >
                                        <Pencil className="size-3" /> Edit
                                      </Button>
                                    )}
                                  </div>

                                  {isCompleted && (match.next_match_id || match.loser_next_match_id) && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleConfirmMatchWinner(match)}
                                      className="h-8 bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md gap-1 cursor-pointer"
                                    >
                                      <CheckCircle2 className="size-3.5" />
                                      Advance {winnerName}
                                    </Button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Step 2: Interactive Seeding (VS Matchups) & Schedule Configuration */
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">
                      Step 2 • Custom Seeding (`VS` Slots) & Schedule Configuration
                    </span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                      Use the team dropdowns or swap button (`⇄`) to edit seeds, and set the Venue and Date & Time for each match.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 h-8 border border-orange-300 dark:border-orange-500/30 inline-flex items-center gap-1 cursor-pointer"
                      onClick={handleReshuffleSeedsKeepSchedule}
                    >
                      <Shuffle className="size-3" />
                      <span>Shuffle Seeds</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 h-8 border border-slate-300 dark:border-white/10 inline-flex items-center gap-1 cursor-pointer"
                      onClick={() => {
                        setWizardStep(1);
                        setProposedMatches([]);
                        if (existingMatches.length > 0 && !isAppendingPhase2) {
                          setIsReseedingMode(true);
                        }
                        setIsAppendingPhase2(false);
                      }}
                    >
                      <ArrowLeft className="size-3" />
                      <span>Change Format</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {proposedMatches.map((match, idx) => {
                    const isKnockout =
                      selectedBracketType === 'single' || selectedBracketType === 'double' || isAppendingPhase2;

                    return (
                      <div
                        key={match.local_id || idx}
                        className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl hover:border-orange-500/30 transition-all shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center size-6 rounded-full bg-orange-500 text-white text-[10px] font-black">
                              {idx + 1}
                            </span>
                            <Badge variant="outline" className="font-black uppercase tracking-wider text-[9px] border-slate-200 dark:border-white/10">
                              {match.round}
                            </Badge>
                            {match.bracket_section === 'upper' && selectedBracketType === 'double' && (
                              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase">
                                Upper Bracket
                              </Badge>
                            )}
                            {match.bracket_section === 'lower' && (
                              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase">
                                Lower / Losers Bracket
                              </Badge>
                            )}
                            {match.is_editable_seed && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                • Editable Seed Matchup
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
                          {/* Team A VS Team B Section */}
                          {match.is_editable_seed ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0 bg-slate-50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10">
                              <div className="flex-1 min-w-0">
                                <Select
                                  value={match.team_a_id || 'BYE'}
                                  onValueChange={(val) => {
                                    if (val) handleSelectProposedTeam(idx, 'team_a', val);
                                  }}
                                >
                                  <SelectTrigger className="h-9 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 font-black uppercase italic text-xs">
                                    <SelectValue placeholder="Select Team A" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl font-bold text-xs">
                                    {approvedTeams.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSwapProposedMatchTeams(idx)}
                                className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 font-black text-[10px] uppercase italic inline-flex items-center justify-center gap-1 shrink-0 transition-colors cursor-pointer"
                                title="Swap Team A & Team B"
                              >
                                <ArrowLeftRight className="size-3" />
                                <span>VS</span>
                              </button>

                              <div className="flex-1 min-w-0">
                                <Select
                                  value={match.team_b_id || 'BYE'}
                                  onValueChange={(val) => {
                                    if (val) handleSelectProposedTeam(idx, 'team_b', val);
                                  }}
                                >
                                  <SelectTrigger className="h-9 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 font-black uppercase italic text-xs">
                                    <SelectValue placeholder="Select Team B" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl font-bold text-xs">
                                    {approvedTeams.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                    {isKnockout && <SelectItem value="BYE">BYE (Auto-Advance)</SelectItem>}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 flex-1 min-w-0 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white uppercase italic tracking-tight truncate flex-1 text-right">
                                {match.team_a_name}
                              </span>
                              <span className="text-[10px] font-black text-orange-500 italic px-2 bg-orange-500/10 py-0.5 rounded-full">
                                VS
                              </span>
                              <span className="font-black text-xs sm:text-sm uppercase italic tracking-tight truncate flex-1 text-slate-900 dark:text-white">
                                {match.team_b_name}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                            <div className="flex flex-col gap-1 w-full sm:w-48 shrink-0">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                <MapPin className="size-3 text-orange-500" /> Place / Venue
                              </label>
                              <Input
                                type="text"
                                value={match.venue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProposedMatches((prev) =>
                                    prev.map((m, i) => (i === idx ? { ...m, venue: val } : m))
                                  );
                                }}
                                className="h-10 px-3 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold"
                              />
                            </div>

                            <div className="flex flex-col gap-1 w-full sm:w-48 shrink-0">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                <CalendarDays className="size-3 text-orange-500" /> Date & Time
                              </label>
                              <Input
                                type="datetime-local"
                                value={match.match_time}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setProposedMatches((prev) =>
                                    prev.map((m, i) => (i === idx ? { ...m, match_time: val } : m))
                                  );
                                }}
                                className="h-10 px-3 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-8 py-5 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] rounded-b-[2rem] gap-3">
            {tournament?.status === 'Completed' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                  <Trophy className="size-4 text-amber-500" />
                  <span>Tournament Concluded • {championName ? `Champion: ${championName}` : 'Results Sealed'}</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReopenDialogOpen(true)}
                    className="h-11 px-4 text-xs font-bold text-slate-500 hover:text-slate-900 border-slate-200 dark:border-white/10 rounded-xl cursor-pointer"
                  >
                    <RotateCcw className="size-3.5 mr-1" /> Reopen Tournament
                  </Button>
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-wider text-xs cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : !showStep1FormatSelector && wizardStep === 1 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="h-11 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsResetBracketDialogOpen(true)}
                    className="h-11 border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 hover:border-red-500/30 rounded-xl font-black uppercase tracking-wider text-[10px] gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset & Reseed
                  </Button>
                </div>

                {publishedFormatInfo.mode !== 'phase1_only' && (allMatchesCompleted || championName) && (
                  <Button
                    onClick={() => {
                      if (tournament) onOpenConclude(tournament, championName);
                    }}
                    className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase italic tracking-wider shadow-lg shadow-emerald-600/20 gap-2 w-full sm:w-auto cursor-pointer"
                  >
                    <Trophy className="size-4" />
                    Conclude Tournament
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (isReseedingMode && wizardStep === 1) {
                      setIsReseedingMode(false);
                    } else {
                      onOpenChange(false);
                    }
                  }}
                  className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                >
                  {isReseedingMode && wizardStep === 1 ? 'Back to Matches' : 'Cancel'}
                </Button>
                {wizardStep === 1 ? (
                  <Button
                    onClick={generateSeededMatches}
                    disabled={approvedTeams.length < 2}
                    className="h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-[0.1em] shadow-lg shadow-orange-500/20 gap-2 cursor-pointer"
                  >
                    <Shuffle className="size-4" />
                    Configure Seeds & Schedule (Step 2)
                  </Button>
                ) : (
                  <Button
                    onClick={handlePublishBracket}
                    disabled={isPublishing || proposedMatches.length === 0}
                    className="h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-[0.1em] shadow-lg shadow-orange-500/20 gap-2 cursor-pointer"
                  >
                    {isPublishing ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" /> : <CheckCircle2 className="size-4" />}
                    {isPublishing
                      ? 'Publishing...'
                      : isAppendingPhase2
                      ? `Publish Phase 2 Playoffs (${proposedMatches.length} Matches)`
                      : `Publish ${proposedMatches.length} Matches`}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Bracket Confirmation */}
      <Dialog open={isResetBracketDialogOpen} onOpenChange={setIsResetBracketDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic">Reconfigure Format & Reseed?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This will take you to Step 1 where you can switch formats (Single Elimination, Double Elimination, Round Robin Only, or Hybrid) and customize team seeds (`VS` slots). Existing matches are only replaced once you click Publish in Step 2.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsResetBracketDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold cursor-pointer"
              onClick={() => {
                setIsResetBracketDialogOpen(false);
                setIsReseedingMode(true);
                setWizardStep(1);
                setProposedMatches([]);
              }}
            >
              Choose Format & Reseed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Tournament Confirmation */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic">Reopen Tournament to Active?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This unlocks the tournament bracket for score adjustments and resumption of athletic fixtures.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsReopenDialogOpen(false)} disabled={isReopeningTournament}>
              Cancel
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold" onClick={handleReopen} disabled={isReopeningTournament}>
              {isReopeningTournament ? 'Reopening...' : 'Reopen Tournament'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
