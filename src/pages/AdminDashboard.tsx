import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trophy,
  Activity,
  ShieldAlert,
  Users,
  Plus,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  History,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FacilitatorManagementModal } from '@/components/admin/FacilitatorManagementModal';
import { getSportIcon } from '@/lib/sportIcons';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    tournaments: 0,
    liveMatches: 0,
    pendingVerifications: 0,
    totalPlayers: 0
  });
  const [verificationBreakdown, setVerificationBreakdown] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [recentMatches, setRecentMatches] = useState<{
    id: string; status: string; team_a_score?: number; team_b_score?: number; team1_score?: number; team2_score?: number;
    tournament: { name: string } | null;
    team1: { name: string } | null;
    team2: { name: string } | null;
  }[]>([]);
  const [draftTournaments, setDraftTournaments] = useState<{
    id: string; name: string; status: string; created_at: string; sport?: string; start_date?: string;
  }[]>([]);
  const [recoverableCount, setRecoverableCount] = useState(0);
  const [facilitatorsCount, setFacilitatorsCount] = useState(0);
  const [isFacilitatorModalOpen, setIsFacilitatorModalOpen] = useState(false);

  const fetchStats = async () => {
    try {
      const [
        { count: tournamentCount },
        { count: liveCount },
        { count: pendingCount },
        { count: approvedCount },
        { count: rejectedCount },
        { count: playerCount },
        { data: draftData },
        { count: deletedTournCount },
        { count: deletedTeamCount },
        { count: deletedUserCount },
        { count: faciCount }
      ] = await Promise.all([
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).in('status', ['Active', 'Ongoing']).or('is_deleted.is.null,is_deleted.eq.false'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).in('status', ['Ongoing', 'Live']),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'Rejected'),
        supabase.from('users').select('*', { count: 'exact', head: true }).in('role', ['player_student', 'player_faculty', 'player_staff', 'Player']),
        supabase.from('tournaments').select('*').eq('status', 'Draft').or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: false }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('is_deleted', true),
        supabase.from('teams').select('*', { count: 'exact', head: true }).eq('is_deleted', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'soft_deleted'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'facilitator').neq('account_status', 'soft_deleted')
      ]);

      const totalVerifications = (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0);

      setStats({
        tournaments: tournamentCount || 0,
        liveMatches: liveCount || 0,
        pendingVerifications: pendingCount || 0,
        totalPlayers: playerCount || 0
      });

      setRecoverableCount((deletedTournCount || 0) + (deletedTeamCount || 0) + (deletedUserCount || 0));
      setFacilitatorsCount(faciCount || 0);
      setDraftTournaments((draftData || []) as typeof draftTournaments);

      setVerificationBreakdown({
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        total: totalVerifications || 1
      });

      const { data: matches } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          team_a_score,
          team_b_score,
          tournament:tournament_id(name),
          team1:team_a_id(name),
          team2:team_b_id(name)
        `)
        .eq('status', 'Completed')
        .order('updated_at', { ascending: false })
        .limit(4);

      const formattedMatches = (matches || []).map((m: any) => ({
        id: m.id,
        status: m.status,
        team_a_score: m.team_a_score,
        team_b_score: m.team_b_score,
        tournament: Array.isArray(m.tournament) ? m.tournament[0] : m.tournament,
        team1: Array.isArray(m.team1) ? m.team1[0] : m.team1,
        team2: Array.isArray(m.team2) ? m.team2[0] : m.team2,
      }));

      setRecentMatches(formattedMatches);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    {
      label: 'Active Events',
      value: stats.tournaments,
      icon: Trophy,
      color: 'text-orange-600',
      bg: 'bg-orange-500/10',
      trend: '+2 this week'
    },
    {
      label: 'Live Matches',
      value: stats.liveMatches,
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      trend: 'Real-time'
    },
    {
      label: 'Pending Clearance',
      value: stats.pendingVerifications,
      icon: ShieldAlert,
      color: 'text-rose-600',
      bg: 'bg-rose-500/10',
      trend: 'Action Required'
    },
    {
      label: 'Total Athletes',
      value: stats.totalPlayers,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-500/10',
      trend: 'Registered'
    }
  ];

  const getPercentage = (value: number) => (value / verificationBreakdown.total) * 100;

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 pb-6">
        <SkeletonCard variant="admin-dashboard" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative max-w-[1400px] mx-auto px-4 pb-6">
      {/* Subtle Grain Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.01] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      {/* Header - Simplified & Production Ready */}
      <div className="bg-slate-950 text-white py-5 md:py-8 px-5 md:px-12 rounded-2xl md:rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
            SYSTEM <span className="text-orange-500">OVERVIEW</span>
          </h1>
          <p className="text-slate-400 font-medium text-sm tracking-wide mt-2 max-w-2xl">
            Institutional Orchestration Hub. Monitor tournament lifecycle, user eligibility, and live match execution.
          </p>
        </div>

        <div className="relative z-10 shrink-0 flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setIsFacilitatorModalOpen(true)}
            variant="ghost"
            className="h-11 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-5 rounded-xl text-xs uppercase tracking-wider group cursor-pointer"
          >
            <ShieldCheck className="size-4 text-orange-400 group-hover:scale-110 transition-transform" />
            <span className="text-white group-hover:text-white">Match Facilitators</span>
            {facilitatorsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black shadow-sm">
                {facilitatorsCount}
              </span>
            )}
          </Button>

          <Button
            onClick={() => navigate('/admin/recovery')}
            variant="ghost"
            className="h-11 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-5 rounded-xl text-xs uppercase tracking-wider group cursor-pointer"
          >
            <RotateCcw className="size-4 text-orange-400 group-hover:rotate-[-45deg] transition-transform" />
            <span className="text-white group-hover:text-white">Recovery Center</span>
            {recoverableCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black shadow-sm">
                {recoverableCount}
              </span>
            )}
          </Button>
        </div>

        {/* Abstract Background Element */}
        <div className="absolute -right-20 -top-20 size-[30rem] bg-orange-500/10 rounded-full blur-[120px] group-hover:bg-orange-500/20 transition-all duration-1000" />
      </div>

      {/* Coming Soon / Draft Events Showcase Banner */}
      {draftTournaments.length > 0 && (
        <div className="bg-slate-950 border border-white/5 rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 relative overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 mb-4 md:mb-6">
            <div className="flex items-start md:items-center gap-3">
              <div className="p-2.5 md:p-3 bg-orange-500 rounded-xl md:rounded-2xl text-white shadow-lg shadow-orange-500/30 shrink-0">
                <Trophy className="size-5 md:size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest animate-pulse">
                    Coming Soon
                  </span>
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {draftTournaments.length} Event{draftTournaments.length > 1 ? 's' : ''} Open
                  </span>
                </div>
                <h3 className="text-lg md:text-2xl font-black italic uppercase tracking-tight text-white mt-1">
                  Upcoming Tournament Arena Pipeline
                </h3>
              </div>
            </div>
            <Button
              onClick={() => navigate('/admin/tournaments')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-[10px] md:text-xs h-10 md:h-11 px-4 md:px-6 rounded-xl shadow-lg shadow-orange-500/20 shrink-0 self-stretch md:self-auto gap-2 w-full md:w-auto"
            >
              Review & Setup Brackets <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Draft Tournament Horizontal Scroller / Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-3.5 relative z-10">
            {draftTournaments.slice(0, 8).map((t) => {
              const SportIcon = (getSportIcon(t.sport || t.name)) as any;
              return (
              <div
                key={t.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/50 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5">
                      <SportIcon className="size-3" />
                      {t.sport}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Draft
                    </span>
                  </div>
                  <h4 className="font-black text-sm uppercase italic tracking-tight text-white line-clamp-2 group-hover:text-orange-500 transition-colors">
                    {t.name}
                  </h4>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Kickoff: {new Date(t.start_date || t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span className="text-orange-500 font-bold">Awaiting Teams</span>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Stats Grid - Responsive 2x2 on mobile, 4 on desktop with no label clipping */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 relative z-10">
        {statCards.map((stat, idx) => (
          <Card key={stat.label} className="group hover:border-orange-500/30 transition-all duration-300 shadow-sm hover:shadow-xl rounded-2xl md:rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 75}ms` }}>
            <CardContent className="p-3.5 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`p-2 sm:p-3 ${stat.bg} rounded-xl group-hover:scale-105 transition-transform shrink-0`}>
                  <stat.icon className={`size-4.5 sm:size-6 ${stat.color}`} />
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-white/5 px-2.5 py-1 rounded-full">
                  <TrendingUp className="size-2.5 text-orange-500" />
                  {stat.trend}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">
                  {stat.label}
                </p>
                <p className="text-2xl sm:text-4xl font-black italic tracking-tighter tabular-nums text-slate-900 dark:text-white mt-1 leading-none">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verification Breakdown - Tailwind Visual Chart */}
      <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 overflow-hidden relative z-10">
        <CardContent className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="min-w-0">
              <h3 className="text-base md:text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Verifications Breakdown</h3>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-slate-500 mt-1 truncate">User eligibility & security clearance</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black italic tabular-nums text-slate-900 dark:text-white leading-none">{verificationBreakdown.total}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Audited</p>
            </div>
          </div>

          {/* Stacked Progress Bar */}
          <div className="h-4 md:h-6 w-full flex rounded-full overflow-hidden bg-slate-100 dark:bg-white/5 mb-6 md:mb-8 border border-slate-200 dark:border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <div
              style={{ width: `${getPercentage(verificationBreakdown.approved)}%` }}
              className="h-full bg-emerald-500 transition-all duration-1000 ease-out relative group"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div
              style={{ width: `${getPercentage(verificationBreakdown.pending)}%` }}
              className="h-full bg-orange-500 transition-all duration-1000 ease-out relative group"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div
              style={{ width: `${getPercentage(verificationBreakdown.rejected)}%` }}
              className="h-full bg-rose-500 transition-all duration-1000 ease-out relative group"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-3 md:gap-8">
            <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-4 bg-slate-50 dark:bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="size-3 md:size-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
              <div className="text-center sm:text-left">
                <p className="text-base md:text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{verificationBreakdown.approved}</p>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Approved</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-4 bg-slate-50 dark:bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="size-3 md:size-4 rounded-full bg-orange-500 shadow-lg shadow-orange-500/20" />
              <div className="text-center sm:text-left">
                <p className="text-base md:text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{verificationBreakdown.pending}</p>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Pending</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-4 bg-slate-50 dark:bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="size-3 md:size-4 rounded-full bg-rose-500 shadow-lg shadow-rose-500/20" />
              <div className="text-center sm:text-left">
                <p className="text-base md:text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{verificationBreakdown.rejected}</p>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Rejected</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capstone Showcase Demo Tool - Only visible to SuperAdmin */}
      <div className="grid lg:grid-cols-3 gap-8 relative z-10">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Quick Operations</h2>
            <Button
              onClick={() => navigate('/profile')}
              variant="ghost"
              className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 rounded-xl"
            >
              Settings
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('/admin/tournaments')}
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-xl group-hover:bg-orange-500 transition-colors">
                  <Plus className="size-5 text-orange-500 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none mb-1">Create Event</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">New Tournament</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
            </Button>

            <Button
              onClick={() => navigate('/admin/verifications')}
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500 transition-colors">
                  <ShieldCheck className="size-5 text-blue-500 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none mb-1">Review Files</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stats.pendingVerifications} Pending Review</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </Button>

            <Button
              onClick={() => navigate('/explorer')}
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500 transition-colors">
                  <Activity className="size-5 text-emerald-500 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none mb-1">Live Center</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Monitoring</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </Button>

            <Button
              onClick={() => navigate('/admin/audit-logs')}
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500 transition-colors">
                  <History className="size-5 text-purple-500 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none mb-1">System Logs</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Audit Trail</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Recent Activity</h2>
          </div>

          <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-4">
            {recentMatches.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">No recent match data</p>
              </div>
            ) : (
              recentMatches.map((match) => {
                const SportIcon = (getSportIcon(match.tournament?.name)) as any;
                return (
                <div key={match.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors">
                      <SportIcon className="size-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-0.5">{match.tournament?.name}</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {match.team1?.name} <span className="opacity-40 italic">vs</span> {match.team2?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter tabular-nums">
                      {match.team_a_score ?? 0} - {match.team_b_score ?? 0}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Final</p>
                  </div>
                </div>
              );
              })
            )}
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/audit-logs')}
              className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer"
            >
              Full Activity Log
            </Button>
          </div>
        </div>
      </div>

      <FacilitatorManagementModal
        open={isFacilitatorModalOpen}
        onOpenChange={setIsFacilitatorModalOpen}
        onUpdated={fetchStats}
      />
    </div>
  );
};
