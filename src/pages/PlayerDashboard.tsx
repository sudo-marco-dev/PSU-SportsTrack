import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
const VerificationUpload = lazy(() =>
  import('@/components/auth/VerificationUpload').then((m) => ({ default: m.VerificationUpload }))
);
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Activity, Trophy, Clock, Star, User, CalendarDays, Dumbbell, Swords, MapPin, XCircle, CheckCircle2, Zap, ArrowRight } from 'lucide-react';

type RosterInvite = {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  jersey_number?: number | null;
  position?: string | null;
  is_captain?: boolean;
  is_starter?: boolean;
  availability_status?: string | null;
  teams: {
    id?: string;
    name: string;
    tournaments: {
      id?: string;
      name: string;
      sport?: string;
    } | { id?: string; name: string; sport?: string }[] | null;
  } | { id?: string; name: string; tournaments: any }[] | null;
};

type LiveMatch = {
  id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  round: string;
  venue?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
};

type PlayerStar = {
  id: string;
  star_type: 'Red' | 'Gold';
  match_id: string | null;
  tournament_id: string | null;
  created_at: string;
  matches: { round: string } | null;
  tournaments: { name: string } | null;
};

export const PlayerDashboard = () => {
  const { isVerified, user, isDev, isSuperAdmin, isFacilitator, isCoach, isPlayer } = useAuth();
  const navigate = useNavigate();
  const [hasPendingDocuments, setHasPendingDocuments] = useState(false);
  const [latestDoc, setLatestDoc] = useState<{
    id: string;
    status: string;
    rejection_reason?: string | null;
    confidence_score?: number | null;
    extracted_full_name?: string | null;
  } | null>(null);
  const [invites, setInvites] = useState<RosterInvite[]>([]);
  const [myTeams, setMyTeams] = useState<RosterInvite[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [draftTournaments, setDraftTournaments] = useState<any[]>([]);
  const [stars, setStars] = useState<PlayerStar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);

  useEffect(() => {
    if (isDev) {
      navigate('/dev', { replace: true });
    } else if (isSuperAdmin) {
      navigate('/admin', { replace: true });
    } else if (isCoach) {
      navigate('/coach', { replace: true });
    } else if (isFacilitator) {
      navigate('/explorer', { replace: true });
    }
  }, [isDev, isSuperAdmin, isFacilitator, isCoach, navigate]);

  useEffect(() => {
    if (user && isPlayer && !isVerified) {
      supabase
        .from('verification_documents')
        .select('id, status, rejection_reason, confidence_score, extracted_full_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setLatestDoc(data);
            setHasPendingDocuments(data.status === 'Pending');
          } else {
            setLatestDoc(null);
            setHasPendingDocuments(false);
          }
        });
    }

    if (!isSuperAdmin && !isCoach) {
      fetchDashboardData();
    }
  }, [user, isPlayer, isVerified, isSuperAdmin, isCoach]);

  useEffect(() => {
    const matchSubscription = supabase
      .channel('dashboard-live-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setLiveMatches((prev) => 
              prev.map(match => 
                match.id === payload.new.id 
                  ? { 
                      ...match, 
                      status: payload.new.status, 
                      team_a_score: payload.new.team_a_score, 
                      team_b_score: payload.new.team_b_score 
                    } 
                  : match
              )
            );
          } else {
            fetchDashboardData(); 
          }
        }
      )
      .subscribe();

    // Realtime subscription for Coach Roster Updates & Invites
    const rosterSubscription = user?.id
      ? supabase
          .channel(`player_roster_${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'team_roster',
              filter: `player_id=eq.${user.id}`,
            },
            (payload) => {
              fetchDashboardData();
              if (payload.eventType === 'UPDATE') {
                const updated = payload.new as any;
                if (updated.availability_status) {
                  const statusName = String(updated.availability_status).toUpperCase();
                  toast.info(`Coach updated your team game-day status: ${statusName}`);
                }
              }
            }
          )
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(matchSubscription);
      if (rosterSubscription) {
        supabase.removeChannel(rosterSubscription);
      }
    };
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // Fetch Roster Data only if logged in
    if (user?.id) {
      const { data: rosterData } = await supabase
        .from('team_roster')
        .select('id, status, jersey_number, position, is_captain, is_starter, availability_status, teams(id, name, status, is_deleted, tournaments(id, name, sport, status, is_deleted))')
        .eq('player_id', user.id);

      if (rosterData) {
        const formattedRoster = ((rosterData as unknown) as RosterInvite[]).filter((i: any) => {
          const teamObj = Array.isArray(i.teams) ? i.teams[0] : i.teams;
          if (!teamObj || teamObj.is_deleted || teamObj.status === 'Rejected') return false;
          const tourneyObj = Array.isArray(teamObj.tournaments) ? teamObj.tournaments[0] : teamObj.tournaments;
          if (tourneyObj?.is_deleted) return false;
          return true;
        });
        setInvites(formattedRoster.filter((i) => i.status === 'Pending'));
        setMyTeams(formattedRoster.filter((i) => i.status === 'Approved'));
      }

      // Fetch MVP Stars
      const { data: starsData } = await supabase
        .from('player_stars')
        .select('*, matches(round), tournaments(name)')
        .eq('player_id', user.id);
      
      if (starsData) {
        setStars(starsData as unknown as PlayerStar[]);
      }
    } else {
      setInvites([]);
      setMyTeams([]);
      setStars([]);
    }

    // Fetch Live/Upcoming Matches (Public)
    const { data: matchData } = await supabase
      .from('matches')
      .select('id, team_a_score, team_b_score, status, round, venue, team_a:team_a_id(name), team_b:team_b_id(name)')
      .in('status', ['Scheduled', 'Ongoing'])
      .order('status', { ascending: false });

    if (matchData) {
      setLiveMatches(matchData as unknown as LiveMatch[]);
    }

    // Fetch Draft / Coming Soon Tournaments (Public)
    const { data: draftData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'Draft')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false });

    if (draftData) {
      setDraftTournaments(draftData);
    }

    setIsLoading(false);
  };

  const handleRosterAction = async (inviteId: string, newStatus: 'Approved' | 'Rejected') => {
    if (newStatus === 'Approved' && user?.id) {
      const targetInvite = invites.find((i) => i.id === inviteId);
      const targetTeam = Array.isArray(targetInvite?.teams) ? targetInvite?.teams[0] : targetInvite?.teams;
      const targetTourney = Array.isArray(targetTeam?.tournaments) ? targetTeam?.tournaments[0] : targetTeam?.tournaments;
      const targetSport = targetTourney?.sport;

      if (targetSport) {
        const alreadyApprovedInSport = myTeams.some((m) => {
          const tObj: any = Array.isArray(m.teams) ? m.teams[0] : m.teams;
          const trObj: any = Array.isArray(tObj?.tournaments) ? tObj?.tournaments[0] : tObj?.tournaments;
          return trObj?.sport === targetSport && trObj?.status !== 'Completed' && !trObj?.is_deleted;
        });

        if (alreadyApprovedInSport) {
          toast.error(`You are already an approved player on an active ${targetSport} squad.`);
          return;
        }
      }
    }

    const { error } = await supabase
      .from('team_roster')
      .update({ status: newStatus })
      .eq('id', inviteId);

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      if (newStatus === 'Approved') {
        const targetInvite = invites.find((i) => i.id === inviteId);
        const targetTeam = Array.isArray(targetInvite?.teams) ? targetInvite?.teams[0] : targetInvite?.teams;
        const targetTourney = Array.isArray(targetTeam?.tournaments) ? targetTeam?.tournaments[0] : targetTeam?.tournaments;
        const targetSport = targetTourney?.sport;
        if (targetSport) {
          const competingInviteIds = invites
            .filter((i) => {
              if (i.id === inviteId) return false;
              const tObj = Array.isArray(i.teams) ? i.teams[0] : i.teams;
              const trObj = Array.isArray(tObj?.tournaments) ? tObj?.tournaments[0] : tObj?.tournaments;
              return trObj?.sport === targetSport;
            })
            .map((i) => i.id);
          if (competingInviteIds.length > 0) {
            await supabase.from('team_roster').update({ status: 'Rejected' }).in('id', competingInviteIds);
          }
        }
      }
      toast.success(`Invite ${newStatus === 'Approved' ? 'accepted' : 'declined'}.`);
      fetchDashboardData();
    }
  };

  if (isSuperAdmin || isCoach || isFacilitator || isDev) {
    return null;
  }

  if (user && isPlayer && !isVerified) {
    if (hasPendingDocuments) {
      return (
        <div className="flex flex-col items-center justify-center py-14 sm:py-20 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="size-16 bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center">
            <Clock className="size-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic">
              Clearance <span className="text-orange-500">In Progress</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 font-medium text-sm leading-relaxed">
              Your Certificate of Registration has been parsed and submitted for clearance. You will gain full tournament eligibility once an administrator confirms your credentials.
            </p>
          </div>
          {latestDoc?.confidence_score !== undefined && latestDoc?.confidence_score !== null && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Parsed Match Confidence: <strong className="text-orange-500">{latestDoc.confidence_score}%</strong></span>
            </div>
          )}
        </div>
      );
    }

    if (latestDoc?.status === 'Rejected') {
      return (
        <div className="max-w-2xl mx-auto space-y-6 p-4">
          {/* Rejection Alert Card */}
          <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 text-slate-900 dark:text-white shadow-xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500 text-white rounded-2xl shrink-0 shadow-md shadow-red-500/20">
                <XCircle className="size-7" />
              </div>
              <div className="space-y-1">
                <Badge className="bg-red-500 text-white font-black text-[10px] uppercase tracking-wider">
                  Action Required • Re-Verification
                </Badge>
                <h2 className="text-2xl font-black italic uppercase tracking-tight text-red-600 dark:text-red-400">
                  Verification Clearance Rejected
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Your submitted Certificate of Registration could not be approved by the athletics administration.
                </p>
              </div>
            </div>

            {/* Rejection Reason from Admin */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/20 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 block">
                Official Administrator Reason
              </span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {latestDoc.rejection_reason || 'Document could not be verified by administration.'}
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please download your official digital PDF copy directly from the{' '}
              <a
                href="https://oes.psu.palawan.edu.ph/aims/students/"
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 dark:text-orange-400 font-bold underline hover:text-orange-700"
              >
                PSU Student Portal (AIMS)
              </a>{' '}
              and re-submit below.
            </p>
          </div>

          {/* Re-Upload Form */}
          <Suspense fallback={<div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">Loading document verification module...</div>}>
            <VerificationUpload
              onUploadSuccess={() => {
                setHasPendingDocuments(true);
                setLatestDoc((prev) => prev ? { ...prev, status: 'Pending' } : null);
              }}
            />
          </Suspense>
        </div>
      );
    }

    return (
      <div className="p-4">
        <Suspense fallback={<div className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">Loading document verification module...</div>}>
          <VerificationUpload
            onUploadSuccess={() => {
              setHasPendingDocuments(true);
              setLatestDoc({ id: 'new', status: 'Pending' });
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[50vh] w-full gap-4 animate-in fade-in duration-300">
        <div className="animate-spin rounded-full h-11 w-11 border-3 border-orange-500/20 border-t-orange-500" />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Loading Sports Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Banner */}
      <div className="bg-slate-950 py-5 md:py-8 px-5 md:px-10 rounded-2xl md:rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
              <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                {user ? 'Athlete Hub' : 'Official Portal'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none text-white">
              {user ? 'PLAYER ' : 'SPORTS '}<span className="text-orange-500">HUB</span>
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium mt-2 max-w-md">
              {user 
                ? 'Track your progress, accept team invitations, and follow live university matches.'
                : 'Explore live university matches, upcoming tournaments, and official PSU sports action.'}
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Stars</p>
                <div className="flex items-center gap-1.5">
                  <Star className="size-3 text-orange-500 fill-orange-500" />
                  <p className="text-lg md:text-xl font-black tabular-nums text-white leading-none">{stars.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-orange-500/10 to-transparent -skew-x-12 translate-x-32" />
      </div>

      {/* MVP Stars / Achievements Preview (Only visible when logged in) */}
      {user && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
              <Trophy className="size-5 text-orange-500" /> My Achievements
            </h2>
          </div>
          <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/10 overflow-hidden shadow-xl rounded-2xl md:rounded-[2rem]">
            <CardContent className="p-4 md:p-8">
              {stars.length === 0 ? (
                <div className="text-center py-8 space-y-3 opacity-50">
                  <div className="flex justify-center gap-3">
                    <Star className="size-7 text-slate-200 dark:text-slate-700" />
                    <Star className="size-9 text-slate-300 dark:text-slate-600 -translate-y-2" />
                    <Star className="size-7 text-slate-200 dark:text-slate-700" />
                  </div>
                  <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400">Trophy Case Empty</p>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 p-4 md:p-6 rounded-xl md:rounded-[1.5rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group hover:border-orange-500/30 transition-all duration-300">
                    <div className={`p-4 md:p-5 rounded-2xl shadow-lg shrink-0 ${
                      stars[0].star_type === 'Red' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      <Star className={`size-8 md:size-10 ${stars[0].star_type === 'Red' ? 'fill-white' : 'fill-white'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Latest Honor</span>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      </div>
                      <p className="font-black text-xl md:text-2xl uppercase italic tracking-tight leading-none mb-1 text-slate-900 dark:text-white">
                        {stars[0].star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                      </p>
                      <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 truncate">
                        {stars[0].tournaments?.name}
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <Badge variant="outline" className="font-black uppercase tracking-widest border-2 px-3 py-1 text-[10px] border-slate-200 dark:border-white/10">{new Date(stars[0].created_at).toLocaleDateString()}</Badge>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full h-12 md:h-14 border-2 border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-200 font-black uppercase italic tracking-widest text-xs md:text-sm hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all rounded-xl md:rounded-2xl group shadow-sm"
                    onClick={() => navigate('/profile')}
                  >
                    <span className="group-hover:translate-x-1 transition-transform inline-block mr-2">View Full Trophy Room</span>
                    <Trophy className="size-4 opacity-50" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Coming Soon • Upcoming Tournaments Banner */}
      {draftTournaments.length > 0 && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="size-4 md:size-5 text-orange-500" /> Coming Soon • Upcoming Events
              </h2>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[9px] md:text-[10px] uppercase tracking-wider border border-orange-500/20">
              Draft & Recruitment Phase
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draftTournaments.map((t) => (
              <div 
                key={t.id}
                onClick={() => setSelectedTournament(t)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-orange-500 hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider">
                    {t.sport}
                  </span>
                  <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </div>
                <h4 className="font-black text-base uppercase italic tracking-tight text-slate-900 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                  {t.name}
                </h4>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span>Kickoff: {new Date(t.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="text-orange-600 dark:text-orange-400 font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    <span>View Details</span>
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live & Upcoming Games Section */}
      <section className="space-y-4">
        <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="size-5 text-primary" /> Live & Upcoming Games
        </h2>
        {liveMatches.length === 0 ? (
          <Card className="p-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl md:rounded-3xl text-center bg-white/50 dark:bg-slate-900/30">
            <Activity className="size-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">No Active Fixtures</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no live or upcoming scheduled matches right now. Check back when tournament rounds begin.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveMatches.map((match, index) => (
              <Card 
                key={match.id} 
                className={`group transition-all duration-300 border-2 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 fill-mode-both bg-white dark:bg-slate-900 ${
                  match.status === 'Ongoing' ? 'border-orange-500 shadow-xl shadow-orange-500/10' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Badge 
                      variant={match.status === 'Ongoing' ? 'destructive' : 'secondary'} 
                      className={`font-black uppercase text-[10px] tracking-widest gap-1.5 px-2.5 py-0.5 rounded-full ${match.status === 'Ongoing' ? 'bg-red-600 hover:bg-red-600 text-white shadow-sm' : ''}`}
                    >
                      {match.status === 'Ongoing' && (
                        <span className="relative flex size-1.5">
                          <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full size-1.5 bg-white"></span>
                        </span>
                      )}
                      {match.status === 'Ongoing' ? 'LIVE NOW' : match.status}
                    </Badge>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{match.round}</span>
                  </div>
                  <CardTitle className="text-lg mt-2 flex items-center justify-between font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    <span className="truncate">{match.team_a?.name || 'TBD'}</span>
                    <span className="text-slate-300 dark:text-slate-600 text-xs mx-2">VS</span>
                    <span className="truncate">{match.team_b?.name || 'BYE'}</span>
                  </CardTitle>
                  {match.venue && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                      <MapPin className="size-3 text-orange-500 shrink-0" />
                      <span className="truncate">{match.venue}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {match.status === 'Ongoing' && (
                    <div className="flex justify-center items-center gap-6 bg-slate-950 text-white py-3 rounded-xl font-mono text-2xl font-black tabular-nums shadow-inner">
                      <span className="text-orange-500 tabular-nums">{match.team_a_score}</span>
                      <span className="opacity-20">:</span>
                      <span className="text-orange-500 tabular-nums">{match.team_b_score}</span>
                    </div>
                  )}
                  {match.status === 'Scheduled' && (
                    <div className="flex justify-center items-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest py-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                      <Clock className="size-3" /> <span>Pre-Match Warmup</span>
                    </div>
                  )}
                  <Button 
                    className="w-full gap-2 font-black uppercase italic tracking-widest h-11 rounded-xl" 
                    variant={match.status === 'Ongoing' ? 'default' : 'outline'}
                    onClick={() => navigate(`/match/${match.id}`)}
                  >
                    Watch Live Tracker
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pending Invites Section (Only visible when logged in) */}
      {user && invites.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
            Active Team Invites
            <Badge variant="destructive">{invites.length}</Badge>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {invites.map((invite, index) => (
              <Card 
                key={invite.id} 
                className="group border-2 border-orange-200 dark:border-orange-500/30 bg-orange-50/30 dark:bg-orange-500/10 overflow-hidden rounded-2xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="h-1 w-full bg-orange-500" />
                <CardHeader>
                  <CardTitle className="font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    {Array.isArray(invite.teams) ? invite.teams[0]?.name : invite.teams?.name ?? 'Unknown Team'}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {(() => {
                      const team = Array.isArray(invite.teams) ? invite.teams[0] : invite.teams;
                      return Array.isArray(team?.tournaments) ? team?.tournaments[0]?.name : team?.tournaments?.name ?? 'Unknown Tournament';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button 
                    className="flex-1 font-black uppercase italic tracking-widest h-10 rounded-xl" 
                    onClick={() => handleRosterAction(invite.id, 'Approved')}
                  >
                    Join Team
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 font-black uppercase italic tracking-widest h-10 rounded-xl border-2 border-slate-200 dark:border-white/10" 
                    onClick={() => handleRosterAction(invite.id, 'Rejected')}
                  >
                    Decline
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Teams Section (Only visible when logged in) */}
      {user && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">My Teams</h2>
          {myTeams.length === 0 ? (
            <Card className="p-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl md:rounded-3xl text-center bg-white/50 dark:bg-slate-900/30">
              <Dumbbell className="size-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">No Team Roster Membership</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                You are not currently enrolled in any athletic rosters. Invitations from team coaches will appear above.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTeams.map((roster, index) => {
                const team = Array.isArray(roster.teams) ? roster.teams[0] : roster.teams;
                const tourney = Array.isArray(team?.tournaments) ? team?.tournaments[0] : team?.tournaments;
                const availability = roster.availability_status || 'active';

                return (
                  <Card 
                    key={roster.id} 
                    className="group border-2 border-slate-100 hover:border-orange-500/30 transition-all rounded-2xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both bg-white dark:bg-slate-900 shadow-sm"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-orange-500 border-orange-500/30">
                          {tourney?.sport || 'Basketball'}
                        </Badge>
                        {/* Game-day status projection badge */}
                        {availability === 'active' && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Roster
                          </Badge>
                        )}
                        {availability === 'benched' && (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider gap-1">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Benched
                          </Badge>
                        )}
                        {availability === 'injured' && (
                          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[9px] font-black uppercase tracking-wider gap-1">
                            <span className="size-1.5 rounded-full bg-red-500" />
                            Injured Reserve
                          </Badge>
                        )}
                        {availability === 'excused' && (
                          <Badge className="bg-slate-100 dark:bg-white/10 text-slate-500 border-none text-[9px] font-black uppercase tracking-wider gap-1">
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            Excused
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="font-black uppercase italic tracking-tight text-lg mt-1">
                        {team?.name ?? 'Unknown Team'}
                      </CardTitle>
                      <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {tourney?.name ?? 'Official Tournament'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Player Roster Credentials Pill Box */}
                      <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center text-xs">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Jersey</span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {roster.jersey_number !== null && roster.jersey_number !== undefined ? `#${roster.jersey_number}` : '--'}
                          </span>
                        </div>
                        <div className="flex flex-col border-x border-slate-200 dark:border-white/10">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Position</span>
                          <span className="font-black text-slate-900 dark:text-white truncate px-1">
                            {roster.position || 'Player'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Role</span>
                          <span className="font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
                            {roster.is_starter ? (
                              <>
                                <Zap className="size-3 fill-emerald-500 text-emerald-500" />
                                <span>Starter</span>
                              </>
                            ) : (
                              'Bench'
                            )}
                          </span>
                        </div>
                      </div>

                      {roster.is_captain && (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                          <Star className="size-3.5 fill-amber-500" />
                          <span>Official Team Captain</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Coming Soon Tournament Detail Dialog */}
      <Dialog open={!!selectedTournament} onOpenChange={(open) => { if (!open) setSelectedTournament(null); }}>
        <DialogContent className="sm:max-w-lg">
          {selectedTournament && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider">
                    {selectedTournament.sport}
                  </span>
                  <Badge variant="secondary" className="font-black uppercase text-[9px] tracking-widest">
                    {selectedTournament.status}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tight">
                  {selectedTournament.name}
                </DialogTitle>
                <DialogDescription>
                  This tournament is currently in the recruitment phase. Teams are being assembled — stay tuned for the official kickoff!
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {/* Sport */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                    <Dumbbell className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sport</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedTournament.sport}</p>
                  </div>
                </div>

                {/* Format / Type */}
                {selectedTournament.type && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                      <Swords className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Format</p>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedTournament.type}</p>
                    </div>
                  </div>
                )}

                {/* Start Date */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {new Date(selectedTournament.start_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* End Date */}
                {selectedTournament.end_date && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                    <div className="p-2 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      <CalendarDays className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</p>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {new Date(selectedTournament.end_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  className="w-full font-black uppercase italic tracking-widest h-11 rounded-xl"
                  onClick={() => {
                    setSelectedTournament(null);
                    navigate('/matches');
                  }}
                >
                  Go to Match Arena
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
