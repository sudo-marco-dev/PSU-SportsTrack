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
  History
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard = () => {
  const navigate = useNavigate();
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
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch counts in parallel
      const [
        { count: tournamentCount },
        { count: liveCount },
        { count: pendingCount },
        { count: approvedCount },
        { count: rejectedCount },
        { count: playerCount }
      ] = await Promise.all([
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'Live'),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'Rejected'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'Player')
      ]);

      const totalVerifications = (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0);

      setStats({
        tournaments: tournamentCount || 0,
        liveMatches: liveCount || 0,
        pendingVerifications: pendingCount || 0,
        totalPlayers: playerCount || 0
      });

      setVerificationBreakdown({
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        total: totalVerifications || 1 // Avoid division by zero
      });

      // Fetch recent completed matches
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          *,
          tournament:tournaments(name),
          team1:teams!team1_id(name),
          team2:teams!team2_id(name)
        `)
        .eq('status', 'Completed')
        .order('updated_at', { ascending: false })
        .limit(4);

      setRecentMatches(matches || []);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

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

  return (
    <div className="space-y-6 relative min-h-screen max-w-[1400px] mx-auto px-4 pb-12">
      {/* Subtle Grain Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.01] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      {/* Header - Simplified & Production Ready */}
      <div className="bg-slate-950 text-white py-6 md:py-8 px-8 md:px-12 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Command Center
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
            SYSTEM <span className="text-orange-500">OVERVIEW</span>
          </h1>
          <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl">
            Institutional Orchestration Hub. Monitor tournament lifecycle, user eligibility, and live match execution.
          </p>
        </div>
        
        {/* Abstract Background Element */}
        <div className="absolute -right-20 -top-20 size-[30rem] bg-orange-500/10 rounded-full blur-[120px] group-hover:bg-orange-500/20 transition-all duration-1000" />
      </div>

      {/* Stats Grid - 2x2 Refactored for Density */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 relative z-10">
        {statCards.map((stat, idx) => (
          <Card key={stat.label} className="group hover:border-orange-500/30 transition-all duration-500 shadow-sm hover:shadow-xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 75}ms` }}>
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-5">
                  <div className={`p-4 ${stat.bg} rounded-2xl group-hover:scale-105 transition-transform duration-500`}>
                    <stat.icon className={`size-7 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1 leading-none">{stat.label}</p>
                    <p className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none">{stat.value}</p>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-full">
                    <TrendingUp className="size-3 text-orange-500" />
                    {stat.trend}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verification Breakdown - Tailwind Visual Chart */}
      <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 overflow-hidden relative z-10">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">System Verifications Breakdown</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Audit of user eligibility and institutional security clearance</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black italic text-slate-900 dark:text-white leading-none">{verificationBreakdown.total}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Audited</p>
            </div>
          </div>

          {/* Stacked Progress Bar */}
          <div className="h-6 w-full flex rounded-full overflow-hidden bg-slate-100 dark:bg-white/5 mb-8 border border-slate-200 dark:border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="size-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{verificationBreakdown.approved}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Approved</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="size-4 rounded-full bg-orange-500 shadow-lg shadow-orange-500/20" />
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{verificationBreakdown.pending}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Pending</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
              <div className="size-4 rounded-full bg-rose-500 shadow-lg shadow-rose-500/20" />
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{verificationBreakdown.rejected}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Rejected</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-8 relative z-10">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Quick Operations</h2>
            <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-orange-500">Settings</Button>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <Button 
              onClick={() => navigate('/admin/tournaments')}
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all"
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
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all"
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
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all"
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
              className="h-20 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 rounded-3xl flex items-center justify-between px-6 group transition-all"
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
              recentMatches.map((match) => (
                <div key={match.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 group-hover:text-orange-500 transition-colors">
                      <Trophy className="size-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-0.5">{match.tournament?.name}</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {match.team1?.name} <span className="opacity-40 italic">vs</span> {match.team2?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                      {match.team1_score} - {match.team2_score}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Final</p>
                  </div>
                </div>
              ))
            )}
            <Button variant="ghost" className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-orange-500 hover:bg-orange-500/5 transition-all">
              Full Activity Log
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
