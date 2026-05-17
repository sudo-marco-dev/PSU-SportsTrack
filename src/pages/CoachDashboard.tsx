import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, UserPlus, Clock, ArrowUpRight, Activity } from 'lucide-react';
import { toast } from 'sonner';

type Stats = {
  activeTeams: number;
  totalRoster: number;
  pendingInvites: number;
  upcomingMatches: number;
};

export const CoachDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    activeTeams: 0,
    totalRoster: 0,
    pendingInvites: 0,
    upcomingMatches: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Coach's Teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('coach_id', user?.id);

      if (teamsError) throw teamsError;
      const teamIds = teams?.map(t => t.id) || [];

      // 2. Fetch Roster Stats
      let totalRoster = 0;
      let pendingInvites = 0;
      if (teamIds.length > 0) {
        const { data: roster, error: rosterError } = await supabase
          .from('team_roster')
          .select('status')
          .in('team_id', teamIds);

        if (rosterError) throw rosterError;
        totalRoster = roster?.filter(r => r.status === 'Approved').length || 0;
        pendingInvites = roster?.filter(r => r.status === 'Pending').length || 0;
      }

      // 3. Fetch Upcoming Matches
      let upcomingMatches = 0;
      if (teamIds.length > 0) {
        const { count, error: matchesError } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .or(`team_a_id.in.(${teamIds.join(',')}),team_b_id.in.(${teamIds.join(',')})`)
          .in('status', ['Scheduled', 'Ongoing']);

        if (matchesError) throw matchesError;
        upcomingMatches = count || 0;
      }

      setStats({
        activeTeams: teamIds.length,
        totalRoster,
        pendingInvites,
        upcomingMatches
      });
    } catch (error: any) {
      console.error('Error fetching coach analytics:', error);
      toast.error('Failed to load performance analytics');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 group-hover:rotate-6 transition-transform duration-500">
              <TrendingUp className="size-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-orange-500" />
                <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                  Coach Analytics
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
                PERFORMANCE <span className="text-orange-500">OVERVIEW</span>
              </h1>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Teams */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Reach</p>
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">Active Teams Managed</CardTitle>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-2xl">
              <Users className="size-6 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? '---' : stats.activeTeams}
              </span>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
                <ArrowUpRight className="size-3" />
                Live
              </div>
            </div>
            <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest opacity-60">Squads currently enrolled in active tournaments</p>
          </CardContent>
        </Card>

        {/* Total Roster */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personnel</p>
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">Total Roster Size</CardTitle>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl">
              <UserPlus className="size-6 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? '---' : stats.totalRoster}
              </span>
              <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">Approved</div>
            </div>
            <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest opacity-60">Verified athletes actively assigned to your teams</p>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recruitment</p>
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">Pending Invitations</CardTitle>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl">
              <Clock className="size-6 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? '---' : stats.pendingInvites}
              </span>
              <div className="text-amber-500 font-bold text-xs uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-lg">Action Req.</div>
            </div>
            <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest opacity-60">Athletes awaiting roster verification or acceptance</p>
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Execution</p>
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">Upcoming Matches</CardTitle>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
              <Activity className="size-6 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? '---' : stats.upcomingMatches}
              </span>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
                <ArrowUpRight className="size-3" />
                Tracked
              </div>
            </div>
            <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest opacity-60">Matches involving your teams scheduled for today</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
