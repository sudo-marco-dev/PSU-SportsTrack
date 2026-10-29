import React, { useState, useEffect, useMemo, useCallback, createElement } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatRole, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  UserCheck,
  Search,
  Users,
  CalendarClock,
  Zap,
  Loader2,
  Sparkles,
  AlertTriangle,
  UserX,
  X
} from 'lucide-react';
import { getSportIcon } from '@/lib/sportIcons';
import type { Tournament } from './types';

export interface FacilitatorsTabProps {
  tournaments: Tournament[];
  onUpdated?: () => void;
}

interface CertifiedOfficial {
  id: string;
  full_name: string;
  role: string;
  is_facilitator?: boolean;
  college_id?: string | null;
  colleges?: { college_name: string } | null;
  assigned_count?: number;
}

interface CandidateUser {
  id: string;
  full_name: string;
  role: string;
  college_id?: string | null;
  student_number?: string | null;
  colleges?: { college_name: string } | null;
}

interface MatchItem {
  id: string;
  tournament_id: string;
  round: string;
  venue?: string | null;
  match_time?: string | null;
  status: string;
  team_a_id?: string | null;
  team_b_id?: string | null;
  designated_facilitator_id?: string | null;
  team_a?: { id: string; name: string; college_id?: string | null; colleges?: { college_name: string } | null } | null;
  team_b?: { id: string; name: string; college_id?: string | null; colleges?: { college_name: string } | null } | null;
  designated_facilitator?: { id: string; full_name: string } | null;
}

export const FacilitatorsTab: React.FC<FacilitatorsTabProps> = ({
  tournaments,
  onUpdated
}) => {
  // Sub-view Toggle
  const [activeSubView, setActiveSubView] = useState<'assignments' | 'roster'>('assignments');

  // Datasets
  const [officials, setOfficials] = useState<CertifiedOfficial[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoadingOfficials, setIsLoadingOfficials] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  // Filters for Match Assignment Board
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    tournaments[0]?.id || ''
  );
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');

  // Candidate Search State for Inline Recruitment
  const [recruitSearchQuery, setRecruitSearchQuery] = useState('');
  const [candidateResults, setCandidateResults] = useState<CandidateUser[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [isCertifyingId, setIsCertifyingId] = useState<string | null>(null);

  // Revocation Confirmation State
  const [revokingOfficial, setRevokingOfficial] = useState<CertifiedOfficial | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Bulk Assignment Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkOfficialId, setBulkOfficialId] = useState<string>('');
  const [bulkTargetRound, setBulkTargetRound] = useState<string>('all');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Update selected tournament if initial list arrives
  useEffect(() => {
    if (!selectedTournamentId && tournaments.length > 0) {
      setSelectedTournamentId(tournaments[0].id);
    }
  }, [tournaments, selectedTournamentId]);

  // Fetch all certified officials and their assigned match counts
  const fetchOfficials = useCallback(async () => {
    setIsLoadingOfficials(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role, is_facilitator, college_id, colleges(college_name)')
        .or('is_facilitator.eq.true,role.eq.facilitator')
        .neq('account_status', 'soft_deleted')
        .order('full_name', { ascending: true });

      if (error) throw error;

      // Get count of designated matches per official
      const { data: matchCounts } = await supabase
        .from('matches')
        .select('designated_facilitator_id')
        .not('designated_facilitator_id', 'is', null);

      const countMap: Record<string, number> = {};
      (matchCounts || []).forEach((m: any) => {
        if (m.designated_facilitator_id) {
          countMap[m.designated_facilitator_id] = (countMap[m.designated_facilitator_id] || 0) + 1;
        }
      });

      const formatted: CertifiedOfficial[] = (data || []).map((u: any) => ({
        ...u,
        colleges: Array.isArray(u.colleges) ? u.colleges[0] : u.colleges,
        assigned_count: countMap[u.id] || 0
      }));

      setOfficials(formatted);
    } catch (err: any) {
      console.error('Failed to load officials:', err);
      toast.error('Failed to load officials: ' + err.message);
    } finally {
      setIsLoadingOfficials(false);
    }
  }, []);

  // Fetch matches for the selected tournament
  const fetchTournamentMatches = useCallback(async (tournId: string) => {
    if (!tournId) return;
    setIsLoadingMatches(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, tournament_id, round, venue, match_time, status,
          team_a_id, team_b_id, designated_facilitator_id,
          team_a:team_a_id(id, name, college_id, colleges(college_name)),
          team_b:team_b_id(id, name, college_id, colleges(college_name)),
          designated_facilitator:designated_facilitator_id(id, full_name)
        `)
        .eq('tournament_id', tournId)
        .order('round', { ascending: true })
        .order('match_time', { ascending: true });

      if (error) throw error;

      const formatted: MatchItem[] = (data || []).map((m: any) => ({
        ...m,
        team_a: m.team_a ? {
          ...m.team_a,
          colleges: Array.isArray(m.team_a.colleges) ? m.team_a.colleges[0] : m.team_a.colleges
        } : null,
        team_b: m.team_b ? {
          ...m.team_b,
          colleges: Array.isArray(m.team_b.colleges) ? m.team_b.colleges[0] : m.team_b.colleges
        } : null,
        designated_facilitator: Array.isArray(m.designated_facilitator)
          ? m.designated_facilitator[0]
          : m.designated_facilitator
      }));

      setMatches(formatted);
    } catch (err: any) {
      console.error('Failed to load matches:', err);
      toast.error('Failed to load matches: ' + err.message);
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficials();
  }, [fetchOfficials]);

  useEffect(() => {
    if (selectedTournamentId) {
      fetchTournamentMatches(selectedTournamentId);
    }
  }, [selectedTournamentId, fetchTournamentMatches]);

  // Inline Candidate Recruitment Search (debounced)
  useEffect(() => {
    if (!recruitSearchQuery.trim()) {
      setCandidateResults([]);
      setIsSearchingCandidates(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCandidates(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, role, college_id, student_number, colleges(college_name)')
          .neq('is_facilitator', true)
          .neq('role', 'facilitator')
          .neq('role', 'admin')
          .neq('role', 'super_admin')
          .neq('account_status', 'soft_deleted')
          .ilike('full_name', `%${recruitSearchQuery.trim()}%`)
          .limit(8);

        if (error) throw error;

        setCandidateResults((data || []).map((u: any) => ({
          ...u,
          colleges: Array.isArray(u.colleges) ? u.colleges[0] : u.colleges
        })));
      } catch (err) {
        console.warn('Candidate search error:', err);
      } finally {
        setIsSearchingCandidates(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [recruitSearchQuery]);

  // 1-Click Certify Facilitator (Preserves original base identity)
  const handleCertifyOfficial = async (candidate: CandidateUser) => {
    setIsCertifyingId(candidate.id);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_facilitator: true,
          previous_role: candidate.role
        })
        .eq('id', candidate.id);

      if (error) throw error;

      await logAudit({
        action: 'APPOINT_FACILITATOR',
        entity_type: 'users',
        entity_id: candidate.id,
        details: `Certified "${candidate.full_name}" (${formatRole(candidate.role)}) as Dual-Role Match Facilitator`
      });

      toast.success(`"${candidate.full_name}" certified as Match Official!`, {
        description: 'Authorized to preside court-side and officiate matches while keeping player identity.'
      });

      // Clear search and refresh
      setCandidateResults(prev => prev.filter(c => c.id !== candidate.id));
      await fetchOfficials();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Failed to certify official: ' + err.message);
    } finally {
      setIsCertifyingId(null);
    }
  };

  // 1-Click Revoke Facilitator Status
  const handleRevokeOfficial = async (official: CertifiedOfficial) => {
    setIsRevoking(true);
    try {
      const targetRole = official.role === 'facilitator' ? 'player_student' : official.role;
      const { error } = await supabase
        .from('users')
        .update({
          is_facilitator: false,
          role: targetRole,
          previous_role: null
        })
        .eq('id', official.id);

      if (error) throw error;

      // Also unassign from any designated matches
      await supabase
        .from('matches')
        .update({ designated_facilitator_id: null })
        .eq('designated_facilitator_id', official.id);

      await logAudit({
        action: 'REVOKE_FACILITATOR',
        entity_type: 'users',
        entity_id: official.id,
        details: `Revoked officiating certification from "${official.full_name}"`
      });

      toast.info(`Officiating privileges revoked for "${official.full_name}".`);
      setRevokingOfficial(null);
      await fetchOfficials();
      if (selectedTournamentId) {
        await fetchTournamentMatches(selectedTournamentId);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Failed to revoke official: ' + err.message);
    } finally {
      setIsRevoking(false);
    }
  };

  // 1-Click Assign / Change Designated Official for a Match
  const handleAssignMatchOfficial = async (matchId: string, officialId: string | null) => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ designated_facilitator_id: officialId })
        .eq('id', matchId);

      if (error) throw error;

      const official = officials.find(o => o.id === officialId);
      await logAudit({
        action: 'ASSIGN_MATCH_FACILITATOR',
        entity_type: 'matches',
        entity_id: matchId,
        details: officialId
          ? `Designated "${official?.full_name || 'Official'}" to match ${matchId}`
          : `Released match ${matchId} reservation to open pool`
      });

      toast.success(officialId ? `Assigned to ${official?.full_name}` : 'Match released to open pool.');
      if (selectedTournamentId) {
        await fetchTournamentMatches(selectedTournamentId);
      }
      await fetchOfficials();
    } catch (err: any) {
      toast.error('Failed to update match official: ' + err.message);
    }
  };

  // Bulk Assign Official to a Round / Tournament
  const handleBulkAssign = async () => {
    if (!selectedTournamentId || !bulkOfficialId) return;
    setIsBulkSubmitting(true);
    try {
      let query = supabase
        .from('matches')
        .update({ designated_facilitator_id: bulkOfficialId })
        .eq('tournament_id', selectedTournamentId);

      if (bulkTargetRound !== 'all') {
        query = query.eq('round', bulkTargetRound);
      }

      const { error } = await query;
      if (error) throw error;

      const official = officials.find(o => o.id === bulkOfficialId);
      await logAudit({
        action: 'BULK_ASSIGN_FACILITATOR',
        entity_type: 'tournaments',
        entity_id: selectedTournamentId,
        details: `Bulk-assigned "${official?.full_name}" to ${bulkTargetRound === 'all' ? 'all' : bulkTargetRound} matches`
      });

      toast.success(`Bulk assigned ${official?.full_name} successfully!`);
      setIsBulkModalOpen(false);
      setBulkOfficialId('');
      if (selectedTournamentId) {
        await fetchTournamentMatches(selectedTournamentId);
      }
      await fetchOfficials();
    } catch (err: any) {
      toast.error('Bulk assignment failed: ' + err.message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Helper to check if an official has a conflict of interest for a given match
  const checkOfficialConflict = (official: CertifiedOfficial | null | undefined, match: MatchItem) => {
    if (!official || !official.college_id) return null;
    const teamACollege = match.team_a?.college_id;
    const teamBCollege = match.team_b?.college_id;

    if (teamACollege && official.college_id === teamACollege) {
      return match.team_a?.colleges?.college_name || match.team_a?.name || 'Team A';
    }
    if (teamBCollege && official.college_id === teamBCollege) {
      return match.team_b?.colleges?.college_name || match.team_b?.name || 'Team B';
    }
    return null;
  };

  // Filtered Matches
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (selectedRoundFilter !== 'all' && m.round !== selectedRoundFilter) {
        return false;
      }
      if (assignmentFilter === 'unassigned' && m.designated_facilitator_id) {
        return false;
      }
      if (assignmentFilter === 'assigned' && !m.designated_facilitator_id) {
        return false;
      }
      return true;
    });
  }, [matches, selectedRoundFilter, assignmentFilter]);

  // Unique rounds for filtering
  const availableRounds = useMemo(() => {
    const rounds = Array.from(new Set(matches.map(m => m.round).filter(Boolean)));
    return rounds.sort();
  }, [matches]);

  // Active Tournament
  const currentTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];
  }, [tournaments, selectedTournamentId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Sub-View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900 border border-white/10 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <UserCheck className="size-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight flex items-center gap-2">
              Courtside Facilitator Operations Hub
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] font-black uppercase">
                {officials.length} Certified
              </Badge>
            </h2>
            <p className="text-xs text-slate-400">
              Certify dual-role officials, recruit students & staff, and assign designated facilitators to tournament matches.
            </p>
          </div>
        </div>

        {/* Sub-view Switcher Pills */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubView('assignments')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeSubView === 'assignments'
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "text-slate-400 hover:text-white"
            )}
          >
            <CalendarClock className="size-3.5" />
            Match Assignments
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('roster')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeSubView === 'roster'
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Users className="size-3.5" />
            Officials Roster & Recruitment
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: MATCH ASSIGNMENT BOARD */}
      {/* ========================================================================= */}
      {activeSubView === 'assignments' && (
        <div className="space-y-4">
          {/* Tournament & Bracket Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
              {/* Tournament Selector */}
              <div className="w-full sm:w-64">
                <Select value={selectedTournamentId} onValueChange={(val) => setSelectedTournamentId(val || '')}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10">
                    <SelectValue placeholder="Select Tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.sport})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Round Filter */}
              {availableRounds.length > 0 && (
                <div className="w-full sm:w-44">
                  <Select value={selectedRoundFilter} onValueChange={(val) => setSelectedRoundFilter(val || 'all')}>
                    <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10">
                      <SelectValue placeholder="All Rounds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bracket Rounds</SelectItem>
                      {availableRounds.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Assignment Status Filter */}
              <div className="w-full sm:w-44">
                <Select value={assignmentFilter} onValueChange={(v: any) => setAssignmentFilter(v)}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10">
                    <SelectValue placeholder="All Matches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Matches ({matches.length})</SelectItem>
                    <SelectItem value="unassigned">Needs Official ({matches.filter(m => !m.designated_facilitator_id).length})</SelectItem>
                    <SelectItem value="assigned">Assigned ({matches.filter(m => m.designated_facilitator_id).length})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk Bracket Assignment Action */}
            <Button
              size="sm"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={matches.length === 0 || officials.length === 0}
              className="h-10 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl gap-1.5 shadow-sm shadow-orange-500/20 shrink-0"
            >
              <Zap className="size-3.5" />
              Bulk Assign Round
            </Button>
          </div>

          {/* Match Assignment Cards */}
          {isLoadingMatches ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="size-8 animate-spin text-orange-500" />
              <p className="text-xs font-bold uppercase tracking-wider">Loading Tournament Schedule...</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/40">
              <CalendarClock className="size-10 text-slate-400 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                No Matches Found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                {matches.length === 0
                  ? 'This tournament has no generated matches yet. Generate brackets in the Tournaments tab to schedule fixtures.'
                  : 'No matches match your current round or assignment filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMatches.map((m) => {
                const designated = officials.find(o => o.id === m.designated_facilitator_id);
                const conflictCollege = checkOfficialConflict(designated, m);

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/90 shadow-sm hover:border-orange-500/30 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Left: Match Info & Teams */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <Badge variant="outline" className="font-bold border-slate-300 dark:border-white/10 uppercase text-[10px]">
                          {createElement(getSportIcon(currentTournament?.sport), { className: 'size-3 inline mr-1' })}
                          <span>{m.round}</span>
                        </Badge>
                        {m.venue && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            • {m.venue}
                          </span>
                        )}
                        <Badge className={cn(
                          "text-[9px] uppercase font-black",
                          m.status === 'Completed'
                            ? "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                            : m.status === 'Live' || m.status === 'Ongoing'
                            ? "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        )}>
                          {m.status}
                        </Badge>
                      </div>

                      {/* Competing Teams & Affiliations */}
                      <div className="flex items-center gap-3 text-sm font-black text-slate-900 dark:text-white flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span>{m.team_a?.name || 'Team A'}</span>
                          {m.team_a?.colleges?.college_name && (
                            <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5">
                              {m.team_a.colleges.college_name}
                            </span>
                          )}
                        </div>
                        <span className="text-orange-500 font-black italic text-xs">VS</span>
                        <div className="flex items-center gap-1.5">
                          <span>{m.team_b?.name || 'Team B'}</span>
                          {m.team_b?.colleges?.college_name && (
                            <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5">
                              {m.team_b.colleges.college_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Realtime Conflict Warning Badge */}
                      {conflictCollege && (
                        <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[11px] font-bold w-fit">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          <span>
                            Affiliation Notice: Official shares collegiate department with {conflictCollege}.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Inline Designated Official Dropdown */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <div className="w-full sm:w-60">
                        <Select
                          value={m.designated_facilitator_id || 'none'}
                          onValueChange={(val) => handleAssignMatchOfficial(m.id, val === 'none' ? null : val)}
                        >
                          <SelectTrigger className={cn(
                            "h-10 text-xs font-bold",
                            m.designated_facilitator_id
                              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
                              : "border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-slate-400"
                          )}>
                            <SelectValue placeholder="Assign Official..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-slate-400 italic">
                              Unassigned (Open Pool)
                            </SelectItem>
                            {officials.map((off) => {
                              const matchConflict = checkOfficialConflict(off, m);
                              return (
                                <SelectItem key={off.id} value={off.id}>
                                  <div className="flex items-center gap-1.5">
                                    <span>{off.full_name}</span>
                                    {matchConflict ? (
                                      <span className="text-[9px] text-amber-500 font-bold ml-1">
                                        (⚠️ {matchConflict})
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 ml-1">
                                        ({formatRole(off.role)})
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {m.designated_facilitator_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAssignMatchOfficial(m.id, null)}
                          title="Release match to open pool"
                          className="h-10 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 rounded-xl"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: OFFICIALS ROSTER & INLINE RECRUITMENT */}
      {/* ========================================================================= */}
      {activeSubView === 'roster' && (
        <div className="space-y-6">
          {/* Inline Quick-Recruit Panel */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-orange-500/20 text-white shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="size-4" />
              Instant Facilitator Recruitment Panel
            </div>
            <p className="text-xs text-slate-300">
              Search any registered student athlete, faculty athlete, or coach by name. Certify them with 1 click without affecting their athlete eligibility or team rosters.
            </p>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Type name to recruit (e.g., 'Juan', 'Santos')..."
                value={recruitSearchQuery}
                onChange={(e) => setRecruitSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-slate-950/80 border-white/10 text-white text-xs font-medium rounded-xl"
              />
              {isSearchingCandidates && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-orange-500" />
              )}
            </div>

            {/* Candidate Search Results */}
            {candidateResults.length > 0 && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-200">
                {candidateResults.map((cand) => (
                  <div
                    key={cand.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 hover:border-orange-500/40 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white truncate">{cand.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-400 border-white/10">
                          {formatRole(cand.role)}
                        </Badge>
                        <span className="text-[10px] text-slate-400 truncate">
                          {cand.colleges?.college_name || 'PSU Main'}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      disabled={isCertifyingId === cand.id}
                      onClick={() => handleCertifyOfficial(cand)}
                      className="h-8 bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] uppercase tracking-wider rounded-lg gap-1 shrink-0 shadow-sm"
                    >
                      {isCertifyingId === cand.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="size-3.5" />
                      )}
                      Certify
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Certified Officials Roster */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Certified Match Officials Roster
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                  {officials.length} Active
                </Badge>
              </h3>
            </div>

            {isLoadingOfficials ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="size-6 animate-spin text-orange-500" />
                <span className="text-xs font-bold uppercase tracking-wider">Loading Officials Roster...</span>
              </div>
            ) : officials.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
                <Users className="size-10 text-slate-400 mx-auto mb-2 opacity-50" />
                <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                  No Certified Facilitators Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Use the quick-recruit panel above to recruit and certify students or coaches as official match facilitators.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {officials.map((off) => (
                  <div
                    key={off.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between gap-3 hover:border-orange-500/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-orange-500/20">
                        {off.full_name?.charAt(0).toUpperCase() || 'O'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {off.full_name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {off.colleges?.college_name || 'Institutional Staff'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[9px] font-black uppercase">
                            Official
                          </Badge>
                          {off.role && off.role !== 'facilitator' && (
                            <Badge variant="outline" className="text-[9px] font-bold text-slate-500 dark:text-slate-400 border-slate-300 dark:border-white/10 uppercase">
                              {formatRole(off.role)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        {off.assigned_count || 0} {off.assigned_count === 1 ? 'Match' : 'Matches'} Assigned
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokingOfficial(off)}
                        className="h-7 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-2 rounded-lg"
                      >
                        <UserX className="size-3.5 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK BRACKET ASSIGNMENT MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Zap className="size-5 text-orange-500" />
              Bulk Bracket Official Assignment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Assign an official to all matches in a bracket round simultaneously.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Target Bracket Round
              </label>
              <Select value={bulkTargetRound} onValueChange={(val) => setBulkTargetRound(val || 'all')}>
                <SelectTrigger className="h-10 bg-slate-900 border-white/10 text-white font-bold">
                  <SelectValue placeholder="All Rounds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rounds in {currentTournament?.name}</SelectItem>
                  {availableRounds.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Designate Official
              </label>
              <Select value={bulkOfficialId} onValueChange={(val) => setBulkOfficialId(val || '')}>
                <SelectTrigger className="h-10 bg-slate-900 border-white/10 text-white font-bold">
                  <SelectValue placeholder="Choose Official..." />
                </SelectTrigger>
                <SelectContent>
                  {officials.map((off) => (
                    <SelectItem key={off.id} value={off.id}>
                      {off.full_name} ({formatRole(off.role)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              variant="ghost"
              onClick={() => setIsBulkModalOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              disabled={!bulkOfficialId || isBulkSubmitting}
              onClick={handleBulkAssign}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl"
            >
              {isBulkSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Zap className="size-3.5 mr-1.5" />}
              Apply Bulk Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* REVOKE OFFICIAL CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Dialog open={!!revokingOfficial} onOpenChange={(open) => !open && setRevokingOfficial(null)}>
        <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <div className="size-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-2">
              <UserX className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black uppercase tracking-tight">
              Revoke Facilitator Privileges
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-400">
              Are you sure you want to revoke officiating certification for <strong>{revokingOfficial?.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-300 text-center py-2">
            Their primary account role (<strong>{formatRole(revokingOfficial?.role || '')}</strong>) will remain completely intact, and they will be unassigned from any pending matches.
          </p>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              onClick={() => setRevokingOfficial(null)}
              className="border-white/10 text-slate-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              disabled={isRevoking}
              onClick={() => revokingOfficial && handleRevokeOfficial(revokingOfficial)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              {isRevoking ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <UserX className="size-3.5 mr-1.5" />}
              Confirm Revocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
