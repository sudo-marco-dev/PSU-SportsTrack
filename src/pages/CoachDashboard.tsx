import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Users,
  UserPlus,
  Clock,
  ArrowUpRight,
  Activity,
  Trophy,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

const VerificationUpload = lazy(() =>
  import('@/components/auth/VerificationUpload').then((m) => ({ default: m.VerificationUpload }))
);

type Stats = {
  activeTeams: number;
  totalRoster: number;
  pendingInvites: number;
  upcomingMatches: number;
};

export const CoachDashboard = () => {
  const { user, isVerified } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    activeTeams: 0,
    totalRoster: 0,
    pendingInvites: 0,
    upcomingMatches: 0
  });
  const [draftTournaments, setDraftTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [latestDoc, setLatestDoc] = useState<{ id: string; status: string; rejection_reason?: string | null } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchAnalytics();
      if (!isVerified) {
        fetchVerificationStatus();
      }
    }
  }, [user, isVerified]);

  const fetchVerificationStatus = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('verification_documents')
        .select('id, status, rejection_reason')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setLatestDoc(data);
      } else {
        setLatestDoc(null);
      }
    } catch (e) {
      console.warn('Error fetching verification status:', e);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Coach's Active / Non-Deleted Teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, status, is_deleted, tournaments(status, is_deleted)')
        .eq('coach_id', user?.id)
        .neq('status', 'Rejected')
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (teamsError) throw teamsError;
      const validTeams = (teams || []).filter((t: any) => {
        const tourney = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
        return !tourney?.is_deleted && tourney?.status !== 'Completed';
      });
      const teamIds = validTeams.map(t => t.id);

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
        .or('is_deleted.is.null,is_deleted.eq.false')
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

  if (isLoading) {
    return <SkeletonCard variant="dashboard" className="my-2" />;
  }

  return (
    <div className="space-y-8 pb-4">
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
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
                PERFORMANCE <span className="text-orange-500">OVERVIEW</span>
              </h1>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Coaching Clearance & Verification Status Section for Unverified Coaches */}
      {!isVerified && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          {latestDoc?.status === 'Pending' ? (
            <div className="p-5 md:p-6 rounded-2xl md:rounded-[2rem] bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-xl backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 shrink-0">
                    <Clock className="size-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-amber-500 text-white font-black text-[9px] uppercase tracking-widest">
                        Clearance Pending
                      </Badge>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider">
                        Awaiting Administrative Review
                      </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                      Coaching Credentials Under Review
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Your Coach / Employee ID photo has been received and is queued for sports office clearance. Team registration and roster management will be automatically unlocked upon administrative approval.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : latestDoc?.status === 'Rejected' ? (
            <div className="p-5 md:p-6 rounded-2xl md:rounded-[2rem] bg-red-500/10 border-2 border-red-500/30 text-red-950 dark:text-red-200 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/30 shrink-0">
                  <AlertTriangle className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-red-500 text-white font-black text-[9px] uppercase tracking-widest">
                      Action Required
                    </Badge>
                    <span className="text-[10px] text-red-700 dark:text-red-300 font-bold uppercase tracking-wider">
                      Clearance Rejected
                    </span>
                  </div>
                  <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                    Coaching Clearance Was Not Approved
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    Reason: <strong className="text-red-600 dark:text-red-400">{latestDoc.rejection_reason || 'Document could not be verified by administration.'}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Please upload a clearer, official photo of your Palawan State University Coach or Employee ID card below to re-submit.
                  </p>
                </div>
              </div>
              <Suspense fallback={<div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">Loading document verification module...</div>}>
                <VerificationUpload onUploadSuccess={() => fetchVerificationStatus()} />
              </Suspense>
            </div>
          ) : (
            <div className="p-5 md:p-6 rounded-2xl md:rounded-[2rem] bg-orange-500/10 border-2 border-orange-500/30 text-slate-900 dark:text-white shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/30 shrink-0">
                  <ShieldAlert className="size-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-orange-500 text-white font-black text-[9px] uppercase tracking-widest">
                      Unverified Account
                    </Badge>
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                      Coaching Verification Required
                    </span>
                  </div>
                  <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tight">
                    Submit Coach ID to Unlock Team Management
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Welcome to PSU SportsTrack! To prevent unauthorized roster and team manipulation, university athletic regulations require coach verification. Please submit a photo of your official PSU Coach or Employee ID card below.
                  </p>
                </div>
              </div>
              <Suspense fallback={<div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">Loading document verification module...</div>}>
                <VerificationUpload onUploadSuccess={() => fetchVerificationStatus()} />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* Coming Soon Tournaments / Registration Banner */}
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
                    Draft Tournament Phase
                  </span>
                </div>
                <h3 className="text-lg md:text-2xl font-black italic uppercase tracking-tight text-white mt-1">
                  Enrolling Teams for Events
                </h3>
              </div>
            </div>
            <Button
              onClick={() => {
                if (!isVerified) {
                  toast.error('Coach verification required before applying or managing teams.');
                  return;
                }
                navigate('/coach/teams');
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-[10px] md:text-xs h-10 md:h-11 px-4 md:px-6 rounded-xl shadow-lg shadow-orange-500/20 shrink-0 self-stretch md:self-auto gap-2 w-full md:w-auto"
            >
              {isVerified ? (
                <>Apply Your Team Now <ChevronRight className="size-4" /></>
              ) : (
                <><Lock className="size-3.5" /> Verification Required</>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10">
            {draftTournaments.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-orange-500/50 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 font-bold text-[9px] uppercase tracking-wider">
                      {t.sport}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                      Apply Open
                    </span>
                  </div>
                  <h4 className="font-black text-sm uppercase italic tracking-tight text-white line-clamp-2 group-hover:text-orange-500 transition-colors">
                    {t.name}
                  </h4>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Starts: {new Date(t.start_date || t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <button 
                    onClick={() => {
                      if (!isVerified) {
                        toast.error('Coach verification required before enrolling teams.');
                        return;
                      }
                      navigate('/coach/teams');
                    }}
                    className="text-orange-400 hover:text-orange-300 font-black uppercase tracking-wider cursor-pointer transition-all hover:translate-x-0.5 active:scale-95 duration-150 inline-flex items-center gap-1"
                  >
                    <span>{isVerified ? 'Enroll' : 'Locked'}</span>
                    {isVerified ? <ArrowRight className="size-3" /> : <Lock className="size-2.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Grid - Mobile-First 2x2 Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
        {/* Active Teams */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3.5 sm:p-5 md:p-8">
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate">Current Reach</p>
              <CardTitle className="text-xs sm:text-base md:text-lg font-black uppercase italic tracking-tight truncate">Active Teams</CardTitle>
            </div>
            <div className="p-2 sm:p-2.5 md:p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl md:rounded-2xl shrink-0">
              <Users className="size-4 sm:size-5 md:size-6 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? <span className="inline-block h-8 w-12 sm:h-10 sm:w-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : stats.activeTeams}
              </span>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-[9px] sm:text-xs uppercase tracking-widest bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg">
                <ArrowUpRight className="size-2.5 sm:size-3" />
                Live
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs font-bold mt-2 md:mt-4 uppercase tracking-widest opacity-60 hidden sm:block">Squads currently enrolled in active tournaments</p>
          </CardContent>
        </Card>

        {/* Total Roster */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3.5 sm:p-5 md:p-8">
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate">Personnel</p>
              <CardTitle className="text-xs sm:text-base md:text-lg font-black uppercase italic tracking-tight truncate">Roster Size</CardTitle>
            </div>
            <div className="p-2 sm:p-2.5 md:p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl md:rounded-2xl shrink-0">
              <UserPlus className="size-4 sm:size-5 md:size-6 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? <span className="inline-block h-8 w-12 sm:h-10 sm:w-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : stats.totalRoster}
              </span>
              <div className="text-slate-400 font-bold text-[9px] sm:text-xs uppercase tracking-widest">Approved</div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs font-bold mt-2 md:mt-4 uppercase tracking-widest opacity-60 hidden sm:block">Verified athletes actively assigned to your teams</p>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3.5 sm:p-5 md:p-8">
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate">Recruitment</p>
              <CardTitle className="text-xs sm:text-base md:text-lg font-black uppercase italic tracking-tight truncate">Pending Invites</CardTitle>
            </div>
            <div className="p-2 sm:p-2.5 md:p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl md:rounded-2xl shrink-0">
              <Clock className="size-4 sm:size-5 md:size-6 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? <span className="inline-block h-8 w-12 sm:h-10 sm:w-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : stats.pendingInvites}
              </span>
              <div className="text-amber-500 font-bold text-[9px] sm:text-xs uppercase tracking-widest bg-amber-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg">Action Req.</div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs font-bold mt-2 md:mt-4 uppercase tracking-widest opacity-60 hidden sm:block">Athletes awaiting roster verification or acceptance</p>
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3.5 sm:p-5 md:p-8">
            <div className="space-y-0.5 sm:space-y-1 min-w-0">
              <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate">Execution</p>
              <CardTitle className="text-xs sm:text-base md:text-lg font-black uppercase italic tracking-tight truncate">Upcoming Matches</CardTitle>
            </div>
            <div className="p-2 sm:p-2.5 md:p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl md:rounded-2xl shrink-0">
              <Activity className="size-4 sm:size-5 md:size-6 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 md:p-8 pt-0">
            <div className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                {isLoading ? <span className="inline-block h-8 w-12 sm:h-10 sm:w-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : stats.upcomingMatches}
              </span>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-[9px] sm:text-xs uppercase tracking-widest bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg">
                <ArrowUpRight className="size-2.5 sm:size-3" />
                Tracked
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-xs font-bold mt-2 md:mt-4 uppercase tracking-widest opacity-60 hidden sm:block">Matches involving your teams scheduled for today</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
