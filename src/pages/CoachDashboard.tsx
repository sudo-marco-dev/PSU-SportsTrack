import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, UserPlus, Clock, ArrowUpRight, Activity, Trophy, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type Stats = {
  activeTeams: number;
  totalRoster: number;
  pendingInvites: number;
  upcomingMatches: number;
};

export const CoachDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    activeTeams: 0,
    totalRoster: 0,
    pendingInvites: 0,
    upcomingMatches: 0
  });
  const [draftTournaments, setDraftTournaments] = useState<any[]>([]);
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

      // 4. Fetch Draft Tournaments (Coming Soon for team registration)
      const { data: draftData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'Draft')
        .order('created_at', { ascending: false });

      setDraftTournaments(draftData || []);

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
      <div className="bg-slate-950 text-white py-5 md:py-8 px-5 md:px-10 rounded-2xl md:rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="p-3 md:p-4 bg-orange-500 rounded-xl md:rounded-2xl shadow-lg shadow-orange-500/20 group-hover:rotate-6 transition-transform duration-500 shrink-0">
              <TrendingUp className="size-6 md:size-8 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <Activity className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                <span className="text-orange-500 font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase">
                  Coach Analytics
                </span>
              </div>
              <h1 className="text-2xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
                PERFORMANCE <span className="text-orange-500">OVERVIEW</span>
              </h1>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Coming Soon Tournaments / Registration Banner */}
      {draftTournaments.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-slate-900 border-2 border-orange-500/30 rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 relative overflow-hidden shadow-xl">
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
                    Draft Tournament Phase
                  </span>
                </div>
                <h3 className="text-lg md:text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white mt-1">
                  Enrolling Teams for Events
                </h3>
              </div>
            </div>
            <Button
              onClick={() => navigate('/coach/teams')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-[10px] md:text-xs h-10 md:h-11 px-4 md:px-6 rounded-xl shadow-lg shadow-orange-500/20 shrink-0 self-stretch md:self-auto gap-2 w-full md:w-auto"
            >
              Apply Your Team Now <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10">
            {draftTournaments.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/50 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-[9px] uppercase tracking-wider">
                      {t.sport}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                      Apply Open
                    </span>
                  </div>
                  <h4 className="font-black text-sm uppercase italic tracking-tight text-slate-900 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                    {t.name}
                  </h4>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>Starts: {new Date(t.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <button 
                    onClick={() => navigate('/coach/teams')} 
                    className="text-orange-500 hover:text-orange-600 font-black uppercase tracking-wider"
                  >
                    Enroll →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Teams */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-8">
            <div className="space-y-1 min-w-0">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Reach</p>
              <CardTitle className="text-base md:text-lg font-black uppercase italic tracking-tight">Active Teams</CardTitle>
            </div>
            <div className="p-2.5 md:p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl md:rounded-2xl shrink-0">
              <Users className="size-5 md:size-6 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-2 md:gap-3">
              <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
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
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-8">
            <div className="space-y-1 min-w-0">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personnel</p>
              <CardTitle className="text-base md:text-lg font-black uppercase italic tracking-tight">Roster Size</CardTitle>
            </div>
            <div className="p-2.5 md:p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl md:rounded-2xl shrink-0">
              <UserPlus className="size-5 md:size-6 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-2 md:gap-3">
              <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? '---' : stats.totalRoster}
              </span>
              <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">Approved</div>
            </div>
            <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest opacity-60">Verified athletes actively assigned to your teams</p>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-8">
            <div className="space-y-1 min-w-0">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recruitment</p>
              <CardTitle className="text-base md:text-lg font-black uppercase italic tracking-tight">Pending Invites</CardTitle>
            </div>
            <div className="p-2.5 md:p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl md:rounded-2xl shrink-0">
              <Clock className="size-5 md:size-6 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-2 md:gap-3">
              <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? '---' : stats.pendingInvites}
              </span>
              <div className="text-amber-500 font-bold text-xs uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-lg">Action Req.</div>
            </div>
            <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest opacity-60">Athletes awaiting roster verification or acceptance</p>
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-8">
            <div className="space-y-1 min-w-0">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Execution</p>
              <CardTitle className="text-base md:text-lg font-black uppercase italic tracking-tight">Upcoming Matches</CardTitle>
            </div>
            <div className="p-2.5 md:p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl md:rounded-2xl shrink-0">
              <Activity className="size-5 md:size-6 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-2 md:gap-3">
              <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
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
