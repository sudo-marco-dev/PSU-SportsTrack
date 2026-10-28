import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatRole } from '@/lib/utils';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  RotateCcw,
  Trash2,
  Trophy,
  Users,
  Search,
  History,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Clock,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Check,
  UserCheck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

type SoftDeletedTournament = {
  id: string;
  name: string;
  sport: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_name?: string | null;
  deleted_by_role?: string | null;
  teams_count?: number;
  matches_count?: number;
};

type SoftDeletedTeam = {
  id: string;
  name: string;
  status: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_name?: string | null;
  deleted_by_role?: string | null;
  tournament_id: string;
  tournaments?: {
    name: string;
    sport: string;
  } | null;
  roster_count?: number;
};

type SoftDeletedUser = {
  id: string;
  full_name: string;
  role: string;
  account_status: string;
  soft_deleted_at: string | null;
  archived_by_name?: string | null;
  archived_by_role?: string | null;
  colleges?: {
    college_name: string;
  } | null;
};

type RecoveryAuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
  admin_id: string;
  users?: {
    full_name: string;
  } | null;
};

export const AdminRecovery = () => {

  const [activeTab, setActiveTab] = useState<'tournaments' | 'teams' | 'users' | 'history'>('tournaments');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tournaments, setTournaments] = useState<SoftDeletedTournament[]>([]);
  const [teams, setTeams] = useState<SoftDeletedTeam[]>([]);
  const [users, setUsers] = useState<SoftDeletedUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<RecoveryAuditLog[]>([]);

  // Action Loading States
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Permanent Purge Confirmation Modal
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<{
    type: 'tournament' | 'team' | 'user';
    id: string;
    name: string;
    teamsCount?: number;
    matchesCount?: number;
  } | null>(null);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  // Batch Restore Confirmation
  const [batchRestoreOpen, setBatchRestoreOpen] = useState(false);
  const [isBatchRestoring, setIsBatchRestoring] = useState(false);

  const fetchRecoveryData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch soft-deleted tournaments
      const { data: tournData, error: tournErr } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (tournErr) throw tournErr;

      // 2. Fetch soft-deleted teams
      const { data: teamData, error: teamErr } = await supabase
        .from('teams')
        .select('*, tournaments(name, sport)')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (teamErr) throw teamErr;

      // 3. Fetch soft-deleted users
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('*, colleges(college_name)')
        .eq('account_status', 'soft_deleted')
        .order('soft_deleted_at', { ascending: false });

      if (userErr) throw userErr;

      // 4. Fetch recovery/deletion audit history
      const { data: auditData, error: auditErr } = await supabase
        .from('audit_logs')
        .select('*')
        .in('action', [
          'DELETE_TOURNAMENT',
          'RESTORE_TOURNAMENT',
          'PERMANENT_DELETE_TOURNAMENT',
          'REJECT_TEAM',
          'APPROVE_TEAM',
          'RESTORE_TEAM',
          'PERMANENT_DELETE_TEAM',
          'SOFT_DELETE_USER',
          'RESTORE_USER',
          'PERMANENT_DELETE_USER'
        ])
        .order('created_at', { ascending: false })
        .limit(30);

      // 5. Blame Resolution: Query audit logs to resolve who deleted items if deleted_by is null
      const tournIds = (tournData || []).map(t => t.id);
      const teamIds = (teamData || []).map(tm => tm.id);
      const userIds = (userData || []).map(u => u.id);
      const allEntityIds = [...tournIds, ...teamIds, ...userIds];

      const entityAuditBlameMap: Record<string, string> = {};
      if (allEntityIds.length > 0) {
        const { data: delAuditRows } = await supabase
          .from('audit_logs')
          .select('entity_id, admin_id, action, created_at')
          .in('entity_id', allEntityIds)
          .in('action', ['DELETE_TOURNAMENT', 'REJECT_TEAM', 'SOFT_DELETE_USER'])
          .order('created_at', { ascending: false });

        if (delAuditRows) {
          for (const row of delAuditRows) {
            if (row.entity_id && row.admin_id && !entityAuditBlameMap[row.entity_id]) {
              entityAuditBlameMap[row.entity_id] = row.admin_id;
            }
          }
        }
      }

      // Collect all admin IDs across entities and audit logs
      const adminIdsToFetch = new Set<string>();
      (tournData || []).forEach(t => {
        if (t.deleted_by) adminIdsToFetch.add(t.deleted_by);
        else if (entityAuditBlameMap[t.id]) adminIdsToFetch.add(entityAuditBlameMap[t.id]);
      });
      (teamData || []).forEach(tm => {
        if (tm.deleted_by) adminIdsToFetch.add(tm.deleted_by);
        else if (entityAuditBlameMap[tm.id]) adminIdsToFetch.add(entityAuditBlameMap[tm.id]);
      });
      (userData || []).forEach(u => {
        if (entityAuditBlameMap[u.id]) adminIdsToFetch.add(entityAuditBlameMap[u.id]);
      });
      (auditData || []).forEach(a => {
        if (a.admin_id) adminIdsToFetch.add(a.admin_id);
      });

      // Batch fetch admin profiles
      const adminProfileMap: Record<string, { full_name: string; role: string }> = {};
      const uniqueAdminIds = Array.from(adminIdsToFetch).filter(Boolean);
      if (uniqueAdminIds.length > 0) {
        const { data: adminRows } = await supabase
          .from('users')
          .select('id, full_name, role')
          .in('id', uniqueAdminIds);

        if (adminRows) {
          for (const adm of adminRows) {
            adminProfileMap[adm.id] = { full_name: adm.full_name, role: adm.role };
          }
        }
      }

      // Enrich tournaments
      const enrichedTournaments: SoftDeletedTournament[] = [];
      for (const t of (tournData || [])) {
        const [{ count: tCount }, { count: mCount }] = await Promise.all([
          supabase.from('teams').select('id', { count: 'exact', head: true }).eq('tournament_id', t.id),
          supabase.from('matches').select('id', { count: 'exact', head: true }).eq('tournament_id', t.id)
        ]);
        const adminId = t.deleted_by || entityAuditBlameMap[t.id];
        const adminInfo = adminId ? adminProfileMap[adminId] : null;

        enrichedTournaments.push({
          ...t,
          teams_count: tCount || 0,
          matches_count: mCount || 0,
          deleted_by_name: adminInfo?.full_name || (adminId ? 'Administrator' : null),
          deleted_by_role: adminInfo?.role || (adminId ? 'Admin' : null)
        });
      }
      setTournaments(enrichedTournaments);

      // Enrich teams
      const enrichedTeams: SoftDeletedTeam[] = [];
      for (const tm of (teamData || [])) {
        const { count: rCount } = await supabase
          .from('team_roster')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', tm.id);
        const adminId = tm.deleted_by || entityAuditBlameMap[tm.id];
        const adminInfo = adminId ? adminProfileMap[adminId] : null;

        enrichedTeams.push({
          ...tm,
          tournaments: Array.isArray(tm.tournaments) ? tm.tournaments[0] : tm.tournaments,
          roster_count: rCount || 0,
          deleted_by_name: adminInfo?.full_name || (adminId ? 'Administrator' : null),
          deleted_by_role: adminInfo?.role || (adminId ? 'Admin' : null)
        });
      }
      setTeams(enrichedTeams);

      // Enrich users
      setUsers((userData || []).map((u: any) => {
        const adminId = entityAuditBlameMap[u.id];
        const adminInfo = adminId ? adminProfileMap[adminId] : null;
        return {
          ...u,
          colleges: Array.isArray(u.colleges) ? u.colleges[0] : u.colleges,
          archived_by_name: adminInfo?.full_name || (adminId ? 'Administrator' : null),
          archived_by_role: adminInfo?.role || (adminId ? 'Admin' : null)
        };
      }));

      // Enrich audit logs with admin names
      if (!auditErr && auditData) {
        setAuditLogs((auditData as any[]).map(log => ({
          ...log,
          users: log.admin_id ? (adminProfileMap[log.admin_id] || { full_name: 'Administrator' }) : null
        })));
      }
    } catch (err: any) {
      console.error('Error fetching recovery records:', err);
      toast.error('Failed to load recovery archives: ' + err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecoveryData();
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchRecoveryData();
  };

  // Restore Tournament
  const handleRestoreTournament = async (t: SoftDeletedTournament) => {
    setRestoringId(t.id);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', t.id);

      if (error) throw error;

      toast.success(`"${t.name}" successfully restored!`, {
        description: 'Tournament is live and visible across all public brackets and athlete hubs.'
      });

      await logAudit({
        action: 'RESTORE_TOURNAMENT',
        entity_type: 'tournaments',
        entity_id: t.id,
        details: `Restored soft-deleted tournament "${t.name}" back to live visibility`
      });

      // Update local state optimistically
      setTournaments(prev => prev.filter(item => item.id !== t.id));
    } catch (err: any) {
      toast.error('Failed to restore tournament: ' + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  // Restore Team
  const handleRestoreTeam = async (tm: SoftDeletedTeam) => {
    setRestoringId(tm.id);
    try {
      const restoredStatus = tm.status === 'Rejected' ? 'Pending' : tm.status;
      const { error } = await supabase
        .from('teams')
        .update({
          status: restoredStatus,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', tm.id);

      if (error) throw error;

      toast.success(`Squad "${tm.name}" successfully restored!`);

      await logAudit({
        action: 'RESTORE_TEAM',
        entity_type: 'teams',
        entity_id: tm.id,
        details: `Restored soft-deleted team "${tm.name}"`
      });

      setTeams(prev => prev.filter(item => item.id !== tm.id));
    } catch (err: any) {
      toast.error('Failed to restore team: ' + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  // Restore User
  const handleRestoreUser = async (u: SoftDeletedUser) => {
    setRestoringId(u.id);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          account_status: 'active',
          soft_deleted_at: null
        })
        .eq('id', u.id);

      if (error) throw error;

      toast.success(`Account for "${u.full_name}" restored to active status.`);

      await logAudit({
        action: 'RESTORE_USER',
        entity_type: 'users',
        entity_id: u.id,
        details: `Restored soft-deleted user profile "${u.full_name}" (${u.id})`
      });

      setUsers(prev => prev.filter(item => item.id !== u.id));
    } catch (err: any) {
      toast.error('Failed to restore user: ' + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  // Batch Restore All Tournaments
  const handleBatchRestoreTournaments = async () => {
    if (tournaments.length === 0) return;
    setIsBatchRestoring(true);
    try {
      const ids = tournaments.map(t => t.id);
      const { error } = await supabase
        .from('tournaments')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null
        })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Successfully restored ${tournaments.length} tournaments!`);

      await logAudit({
        action: 'RESTORE_TOURNAMENT',
        entity_type: 'tournaments',
        details: `Batch restored ${tournaments.length} soft-deleted tournaments`
      });

      setTournaments([]);
      setBatchRestoreOpen(false);
    } catch (err: any) {
      toast.error('Failed to batch restore: ' + err.message);
    } finally {
      setIsBatchRestoring(false);
    }
  };

  // Permanent Purge Execution
  const handleConfirmPermanentPurge = async () => {
    if (!purgeTarget) return;
    if (purgeConfirmInput.trim().toUpperCase() !== 'PURGE') {
      toast.error('Please type PURGE to confirm permanent destruction.');
      return;
    }

    setIsPurging(true);
    try {
      if (purgeTarget.type === 'tournament') {
        const tournamentId = purgeTarget.id;

        // 1. Break self-referencing pointer links on matches
        try {
          await supabase
            .from('matches')
            .update({ next_match_id: null, loser_next_match_id: null })
            .eq('tournament_id', tournamentId);
        } catch {
          await supabase
            .from('matches')
            .update({ next_match_id: null })
            .eq('tournament_id', tournamentId);
        }

        // 2. Fetch match IDs to delete events and stars
        const { data: matchesData } = await supabase
          .from('matches')
          .select('id')
          .eq('tournament_id', tournamentId);

        if (matchesData && matchesData.length > 0) {
          const matchIds = matchesData.map(m => m.id);
          await supabase.from('match_events').delete().in('match_id', matchIds);
          await supabase.from('player_stars').delete().in('match_id', matchIds);
        }

        // 3. Delete player stars
        await supabase.from('player_stars').delete().eq('tournament_id', tournamentId);

        // 4. Delete matches
        await supabase.from('matches').delete().eq('tournament_id', tournamentId);

        // 5. Delete team rosters and teams
        const { data: teamsData } = await supabase.from('teams').select('id').eq('tournament_id', tournamentId);
        if (teamsData && teamsData.length > 0) {
          const teamIds = teamsData.map(t => t.id);
          await supabase.from('team_roster').delete().in('team_id', teamIds);
          await supabase.from('teams').delete().eq('tournament_id', tournamentId);
        }

        // 6. Delete tournament row
        const { error: deleteErr } = await supabase.from('tournaments').delete().eq('id', tournamentId);
        if (deleteErr) throw deleteErr;

        await logAudit({
          action: 'PERMANENT_DELETE_TOURNAMENT',
          entity_type: 'tournaments',
          entity_id: tournamentId,
          details: `Permanently purged tournament "${purgeTarget.name}" and all sub-entities`
        });

        toast.success(`"${purgeTarget.name}" has been permanently erased from the database.`);
        setTournaments(prev => prev.filter(item => item.id !== tournamentId));
      } else if (purgeTarget.type === 'team') {
        // Delete team roster first
        await supabase.from('team_roster').delete().eq('team_id', purgeTarget.id);
        const { error } = await supabase.from('teams').delete().eq('id', purgeTarget.id);
        if (error) throw error;

        await logAudit({
          action: 'PERMANENT_DELETE_TEAM',
          entity_type: 'teams',
          entity_id: purgeTarget.id,
          details: `Permanently purged squad application "${purgeTarget.name}"`
        });

        toast.success(`Squad "${purgeTarget.name}" permanently removed.`);
        setTeams(prev => prev.filter(item => item.id !== purgeTarget.id));
      }

      setPurgeModalOpen(false);
      setPurgeTarget(null);
      setPurgeConfirmInput('');
    } catch (err: any) {
      toast.error('Failed to permanently purge: ' + err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const filteredTournaments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tournaments.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.sport || '').toLowerCase().includes(q) ||
      (t.type || '').toLowerCase().includes(q)
    );
  }, [tournaments, searchQuery]);

  const filteredTeams = useMemo(() => {
    return teams.filter(tm =>
      tm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tm.tournaments?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tm.tournaments?.sport || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teams, searchQuery]);

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.colleges?.college_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(l =>
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.details || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [auditLogs, searchQuery]);

  const totalRecoverableCount = tournaments.length + teams.length + users.length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Breadcrumb & Return Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/tournaments"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Tournament Management
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="h-8 gap-2 rounded-xl text-xs font-bold border-slate-200 dark:border-white/10"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Hero Header Banner — Athletic Nocturnal Arena Aesthetic */}
      <div className="bg-slate-950 text-white py-3.5 sm:py-5 md:py-7 px-4 sm:px-6 md:px-8 rounded-2xl sm:rounded-[2rem] shadow-xl border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-500/15 via-rose-500/10 to-transparent blur-3xl rounded-full pointer-events-none -mr-20 -mt-20 group-hover:from-orange-500/25 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 blur-2xl rounded-full pointer-events-none -ml-10 -mb-10" />

        <div className="relative z-10 flex flex-row items-center justify-between gap-3 sm:gap-6">
          <div className="space-y-1 sm:space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] sm:text-xs font-black uppercase tracking-widest">
              <RotateCcw className="size-3 sm:size-3.5 animate-pulse" />
              Institutional Recovery Center
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tight leading-none">
              Data <span className="text-orange-500">Recovery</span> &amp; Vault
            </h1>
            <p className="hidden sm:block text-xs sm:text-sm text-slate-400 max-w-2xl font-medium leading-relaxed">
              Soft-deleted tournaments, squads, and records are isolated from public brackets and student explorers,
              safely preserved here. Restore any event with a single click or permanently purge when necessary.
            </p>
          </div>

          {/* Quick Stat Pill */}
          <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-2 sm:p-3.5 shrink-0 backdrop-blur-md">
            <div className="size-9 sm:size-11 rounded-lg sm:rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 font-black text-base sm:text-xl">
              {totalRecoverableCount}
            </div>
            <div className="hidden xs:block">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-bold">Recoverable</p>
              <p className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
                {tournaments.length} Evt • {teams.length} Sqd
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => setActiveTab('tournaments')}
          className={`cursor-pointer transition-all border rounded-2xl bg-white dark:bg-slate-900/60 hover:shadow-lg ${
            activeTab === 'tournaments' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-white/5'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Deleted Tournaments
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {tournaments.length}
              </p>
              <p className="text-[10px] text-orange-500 font-bold">
                {tournaments.length > 0 ? 'Click to inspect & restore' : 'Vault clean'}
              </p>
            </div>
            <div className="size-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20">
              <Trophy className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('teams')}
          className={`cursor-pointer transition-all border rounded-2xl bg-white dark:bg-slate-900/60 hover:shadow-lg ${
            activeTab === 'teams' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-white/5'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Deleted Squads
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {teams.length}
              </p>
              <p className="text-[10px] text-orange-500 font-bold">
                {teams.length > 0 ? 'Applications preserved' : 'No deleted squads'}
              </p>
            </div>
            <div className="size-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Users className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('users')}
          className={`cursor-pointer transition-all border rounded-2xl bg-white dark:bg-slate-900/60 hover:shadow-lg ${
            activeTab === 'users' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-white/5'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Archived Accounts
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {users.length}
              </p>
              <p className="text-[10px] text-emerald-500 font-bold">
                {users.length > 0 ? 'Profiles recoverable' : 'Zero archived'}
              </p>
            </div>
            <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <ShieldAlert className="size-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border rounded-2xl bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Institutional Safety
              </p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                Zero-Loss Guard Active
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Soft-deletes preserve brackets & rosters
              </p>
            </div>
            <div className="size-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/20">
              <Sparkles className="size-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          <Button
            variant={activeTab === 'tournaments' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('tournaments')}
            className={`rounded-xl text-xs font-bold gap-2 ${
              activeTab === 'tournaments' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''
            }`}
          >
            <Trophy className="size-3.5" />
            Tournaments ({tournaments.length})
          </Button>

          <Button
            variant={activeTab === 'teams' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('teams')}
            className={`rounded-xl text-xs font-bold gap-2 ${
              activeTab === 'teams' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''
            }`}
          >
            <Users className="size-3.5" />
            Squads ({teams.length})
          </Button>

          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('users')}
            className={`rounded-xl text-xs font-bold gap-2 ${
              activeTab === 'users' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''
            }`}
          >
            <ShieldAlert className="size-3.5" />
            Accounts ({users.length})
          </Button>

          <Button
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('history')}
            className={`rounded-xl text-xs font-bold gap-2 ${
              activeTab === 'history' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''
            }`}
          >
            <History className="size-3.5" />
            Audit History
          </Button>
        </div>

        {/* Search input & bulk action */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              placeholder="Search archives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10"
            />
          </div>

          {activeTab === 'tournaments' && tournaments.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchRestoreOpen(true)}
              className="h-9 text-xs font-bold rounded-xl border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 shrink-0"
            >
              <RotateCcw className="size-3.5 mr-1" />
              Restore All
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      {isLoading ? (
        <SkeletonCard variant="card" count={3} />
      ) : (
        <>
          {/* TAB 1: TOURNAMENTS */}
          {activeTab === 'tournaments' && (
            <div className="space-y-4">
              {filteredTournaments.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-white/10 p-12 text-center bg-white/40 dark:bg-slate-900/40">
                  <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mx-auto flex items-center justify-center mb-4">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    No Deleted Tournaments
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 font-medium">
                    All institutional athletic tournaments are active and healthy. When a tournament is soft-deleted,
                    it will appear here with full one-click restoration safeguards.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTournaments.map((t) => (
                    <Card
                      key={t.id}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                    >
                      <div className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase">
                                {t.sport}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">
                                {t.type}
                              </Badge>
                            </div>
                            <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white truncate" title={t.name}>
                              {t.name}
                            </h3>
                          </div>

                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase shrink-0">
                            Soft-Deleted
                          </Badge>
                        </div>

                        {/* Event Stats preserved */}
                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-white/5">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                              Preserved Squads
                            </span>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                              {t.teams_count} Teams
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                              Preserved Matches
                            </span>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                              {t.matches_count} Fixtures
                            </span>
                          </div>
                        </div>

                        {/* Deletion Metadata & Admin Blame */}
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <Clock className="size-3.5 text-slate-400 shrink-0" />
                            <span>
                              Deleted{' '}
                              {t.deleted_at
                                ? new Date(t.deleted_at).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Recently'}
                            </span>
                          </div>

                          {/* Admin Blame Accountability Badge */}
                          <div className="p-2.5 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-7 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-xs shrink-0 border border-orange-500/30">
                                {t.deleted_by_name ? t.deleted_by_name.charAt(0).toUpperCase() : 'A'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] uppercase font-black tracking-wider text-orange-600 dark:text-orange-400">
                                    Deleted By
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {t.deleted_by_name || 'System Administrator'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  Role: <span className="font-semibold text-slate-700 dark:text-slate-300">{t.deleted_by_role || 'Admin'}</span>
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[9px] uppercase font-mono tracking-wider text-orange-600 dark:text-orange-400 border-orange-500/30 shrink-0 bg-orange-500/5">
                              Blame
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPurgeTarget({
                              type: 'tournament',
                              id: t.id,
                              name: t.name,
                              teamsCount: t.teams_count,
                              matchesCount: t.matches_count
                            });
                            setPurgeConfirmInput('');
                            setPurgeModalOpen(true);
                          }}
                          className="h-8 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                        >
                          <Trash2 className="size-3 mr-1" />
                          Purge Permanently
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleRestoreTournament(t)}
                          disabled={restoringId === t.id}
                          className="h-8 px-4 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black uppercase tracking-wider rounded-xl shadow-md shadow-orange-500/20 gap-1.5 active:scale-95 transition-transform"
                        >
                          {restoringId === t.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          Restore Event
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEAMS / SQUADS */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              {filteredTeams.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-white/10 p-12 text-center bg-white/40 dark:bg-slate-900/40">
                  <div className="size-16 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 mx-auto flex items-center justify-center mb-4">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    No Deleted Squads
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 font-medium">
                    All team registration applications and collegiate squads are active. Any soft-deleted team applications
                    will be cataloged here.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTeams.map((tm) => (
                    <Card
                      key={tm.id}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase mb-1">
                            {tm.tournaments?.sport || 'Basketball'}
                          </Badge>
                          <h4 className="text-base font-black text-slate-900 dark:text-white">
                            {tm.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Tournament: {tm.tournaments?.name || 'Unknown'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase text-rose-500 border-rose-500/30">
                          Soft-Deleted
                        </Badge>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>Roster Size: <strong>{tm.roster_count} Players</strong></span>
                        <span>Original Status: <strong>{tm.status}</strong></span>
                      </div>

                      {/* Deletion Metadata & Admin Blame */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <Clock className="size-3.5 text-slate-400 shrink-0" />
                          <span>
                            Removed{' '}
                            {tm.deleted_at
                              ? new Date(tm.deleted_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Recently'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-7 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs shrink-0 border border-blue-500/30">
                              {tm.deleted_by_name ? tm.deleted_by_name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
                                  Removed By
                                </span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {tm.deleted_by_name || 'System Administrator'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                Role: <span className="font-semibold text-slate-700 dark:text-slate-300">{tm.deleted_by_role || 'Admin'}</span>
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono tracking-wider text-blue-600 dark:text-blue-400 border-blue-500/30 shrink-0 bg-blue-500/5">
                            Blame
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPurgeTarget({
                              type: 'team',
                              id: tm.id,
                              name: tm.name
                            });
                            setPurgeConfirmInput('');
                            setPurgeModalOpen(true);
                          }}
                          className="h-8 text-[11px] font-bold text-rose-600 rounded-xl"
                        >
                          <Trash2 className="size-3 mr-1" />
                          Purge
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleRestoreTeam(tm)}
                          disabled={restoringId === tm.id}
                          className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-xl gap-1.5"
                        >
                          <RotateCcw className="size-3" />
                          Restore Squad
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USER ACCOUNTS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {filteredUsers.length === 0 ? (
                <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-white/10 p-12 text-center bg-white/40 dark:bg-slate-900/40">
                  <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mx-auto flex items-center justify-center mb-4">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    No Soft-Deleted User Accounts
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 font-medium">
                    All institutional athlete, coach, and official accounts are in active standing.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map((u) => (
                    <Card
                      key={u.id}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase mb-1">
                            {formatRole(u.role)}
                          </Badge>
                          <h4 className="text-base font-black text-slate-900 dark:text-white">
                            {u.full_name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {u.colleges?.college_name || 'No College Assigned'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                          Soft-Deleted
                        </Badge>
                      </div>

                      {/* Archival & Admin Blame */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <Clock className="size-3.5 text-slate-400 shrink-0" />
                          <span>
                            Archived {u.soft_deleted_at ? new Date(u.soft_deleted_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'Recently'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 border border-emerald-500/30">
                              {u.archived_by_name ? u.archived_by_name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                                  Archived By
                                </span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {u.archived_by_name || 'System Administrator'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                Role: <span className="font-semibold text-slate-700 dark:text-slate-300">{u.archived_by_role || 'Admin'}</span>
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono tracking-wider text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0 bg-emerald-500/5">
                            Blame
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-white/5">
                        <Button
                          size="sm"
                          onClick={() => handleRestoreUser(u)}
                          disabled={restoringId === u.id}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl gap-1.5"
                        >
                          <RotateCcw className="size-3" />
                          Reactivate Account
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <Card className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Data Governance Audit Trail
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Chronological record of soft-deletions, restorations, and purges.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {filteredAuditLogs.length} Records
                </Badge>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  No recovery or deletion audit records found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5 overflow-x-auto">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-[10px] font-mono font-bold uppercase ${
                              log.action.includes('RESTORE')
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : log.action.includes('PERMANENT')
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                            }`}
                          >
                            {log.action}
                          </Badge>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {log.entity_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {log.details || 'No details provided'}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          <UserCheck className="size-3 text-orange-500 dark:text-orange-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Blame:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {log.users?.full_name || 'System Administrator'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-slate-400 block font-medium">
                          {new Date(log.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* PERMANENT PURGE CONFIRMATION MODAL */}
      <Dialog open={purgeModalOpen} onOpenChange={setPurgeModalOpen}>
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl border-rose-200 dark:border-rose-500/20 p-6 shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
                <AlertTriangle className="size-5" />
              </div>
              <DialogTitle className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                Permanent <span className="text-rose-600">Eradication</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              You are about to irreversibly destroy <strong className="text-slate-900 dark:text-white font-bold">{purgeTarget?.name}</strong>.
              {purgeTarget?.type === 'tournament' && (
                <span className="block mt-1 text-rose-600 dark:text-rose-400 font-bold">
                  Warning: All {purgeTarget.teamsCount || 0} squads, {purgeTarget.matchesCount || 0} matches, rosters, and statistics will be permanently purged from the database. This CANNOT be undone.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 p-3 bg-rose-500/5 rounded-2xl border border-rose-500/15 space-y-2">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Type <span className="font-mono font-black text-rose-700 dark:text-rose-300">PURGE</span> to confirm:
            </p>
            <Input
              placeholder="PURGE"
              value={purgeConfirmInput}
              onChange={(e) => setPurgeConfirmInput(e.target.value)}
              className="h-10 bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-500/30 rounded-xl font-mono font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <Button
              variant="ghost"
              onClick={() => {
                setPurgeModalOpen(false);
                setPurgeTarget(null);
                setPurgeConfirmInput('');
              }}
              className="h-10 rounded-xl font-bold uppercase tracking-wider text-xs"
              disabled={isPurging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPermanentPurge}
              disabled={purgeConfirmInput.trim().toUpperCase() !== 'PURGE' || isPurging}
              className="h-10 flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-rose-600/20 gap-2 transition-all active:scale-[0.98]"
            >
              {isPurging ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {isPurging ? 'Eradicating...' : 'Confirm Destruction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BATCH RESTORE CONFIRMATION MODAL */}
      <Dialog open={batchRestoreOpen} onOpenChange={setBatchRestoreOpen}>
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl border-orange-500/20 p-6 shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl border border-orange-500/20">
                <RotateCcw className="size-5" />
              </div>
              <DialogTitle className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                Restore <span className="text-orange-500">All Tournaments</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Are you sure you want to restore all <strong className="text-slate-900 dark:text-white font-bold">{tournaments.length}</strong> soft-deleted tournaments back to live status?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <Button
              variant="ghost"
              onClick={() => setBatchRestoreOpen(false)}
              className="h-10 rounded-xl font-bold uppercase tracking-wider text-xs"
              disabled={isBatchRestoring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBatchRestoreTournaments}
              disabled={isBatchRestoring}
              className="h-10 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-orange-500/20 gap-2"
            >
              {isBatchRestoring ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {isBatchRestoring ? 'Restoring...' : 'Restore All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
