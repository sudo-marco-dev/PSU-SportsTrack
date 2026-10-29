import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
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
import { Activity, Trophy, Clock, Star, User, CalendarDays, Dumbbell, Swords, MapPin, XCircle, CheckCircle2, Zap, ArrowRight, Layers, Sparkles, ShieldCheck, Users, Mail, ChevronRight } from 'lucide-react';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { getSportIcon, resolveSportName } from '@/lib/sportIcons';
import { formatYearLevel } from '@/lib/formatYearLevel';

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
  tournament?: { id: string; name: string; sport: string; type?: string | null } | null;
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
  const { isVerified, user, isDev, isAdmin, isFacilitator, isCoach, isPlayer, isStaffAthlete, isFacultyAthlete, isStudentAthlete, profile, canAccessFriendlyGames } = useAuth();
  const navigate = useNavigate();
  const isStaffOrFaculty = Boolean(isStaffAthlete || isFacultyAthlete || profile?.role === 'player_staff' || profile?.role === 'player_faculty');
  const isStudent = Boolean(isStudentAthlete || profile?.role === 'player_student');

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
  const [divisionFilter, setDivisionFilter] = useState<'all' | 'friendly' | 'binturungan' | 'collegiate'>('all');
  const hasInitializedDivisionRef = useRef(false);

  useEffect(() => {
    if (isStaffOrFaculty && !hasInitializedDivisionRef.current) {
      hasInitializedDivisionRef.current = true;
      setDivisionFilter('friendly');
    } else if (!canAccessFriendlyGames && divisionFilter === 'friendly') {
      setDivisionFilter('all');
    }
  }, [isStaffOrFaculty, canAccessFriendlyGames, divisionFilter]);

  const isFriendlyTourn = (tourn?: { type?: string | null; name?: string | null } | null): boolean => {
    if (!tourn) return false;
    const tType = (tourn.type || '').toLowerCase();
    const tName = (tourn.name || '').toLowerCase();
    return (
      tType.includes('friendly') ||
      tType.includes('staff') ||
      tType.includes('faculty') ||
      tType.includes('scrimmage') ||
      tName.includes('friendly') ||
      tName.includes('staff') ||
      tName.includes('faculty') ||
      tName.includes('scrimmage')
    );
  };

  const visibleDraftTournaments = useMemo(() => {
    let list = [...draftTournaments];

    // Completely hide friendly tournaments from public visitors, students, and coaches
    if (!canAccessFriendlyGames) {
      list = list.filter((t) => !isFriendlyTourn(t));
    } else if (divisionFilter === 'friendly') {
      list = list.filter((t) => isFriendlyTourn(t));
    } else if (divisionFilter === 'binturungan') {
      list = list.filter((t) => (t.type || '').toLowerCase().includes('binturungan') || (t.name || '').toLowerCase().includes('binturungan'));
    } else if (divisionFilter === 'collegiate') {
      list = list.filter((t) => (t.type || '').toLowerCase().includes('colleg') || (t.name || '').toLowerCase().includes('colleg'));
    }

    list.sort((a, b) => {
      const aFriendly = isFriendlyTourn(a);
      const bFriendly = isFriendlyTourn(b);
      if (isStaffOrFaculty) {
        if (aFriendly && !bFriendly) return -1;
        if (!aFriendly && bFriendly) return 1;
      } else {
        if (!aFriendly && bFriendly) return -1;
        if (aFriendly && !bFriendly) return 1;
      }
      return new Date(b.created_at || b.start_date).getTime() - new Date(a.created_at || a.start_date).getTime();
    });

    return list;
  }, [draftTournaments, isStudent, isStaffOrFaculty, canAccessFriendlyGames, divisionFilter]);

  const sortedLiveMatches = useMemo(() => {
    let list = [...liveMatches];
    if (canAccessFriendlyGames) {
      if (divisionFilter === 'friendly') {
        const friendlyMatches = list.filter((m) => isFriendlyTourn(m.tournament));
        if (friendlyMatches.length > 0) list = friendlyMatches;
      } else if (divisionFilter === 'binturungan') {
        list = list.filter((m) => (m.tournament?.type || '').toLowerCase().includes('binturungan') || (m.tournament?.name || '').toLowerCase().includes('binturungan'));
      } else if (divisionFilter === 'collegiate') {
        list = list.filter((m) => (m.tournament?.type || '').toLowerCase().includes('colleg') || (m.tournament?.name || '').toLowerCase().includes('colleg'));
      }
    } else {
      // Avoid exposing faculty/staff friendly games to students, coaches, or public visitors
      list = list.filter((m) => !isFriendlyTourn(m.tournament));
    }

    list.sort((a, b) => {
      // 1. Ongoing live matches always come first
      if (a.status === 'Ongoing' && b.status !== 'Ongoing') return -1;
      if (b.status === 'Ongoing' && a.status !== 'Ongoing') return 1;

      const aFriendly = isFriendlyTourn(a.tournament);
      const bFriendly = isFriendlyTourn(b.tournament);
      if (isStaffOrFaculty) {
        if (aFriendly && !bFriendly) return -1;
        if (!aFriendly && bFriendly) return 1;
      } else {
        if (!aFriendly && bFriendly) return -1;
        if (aFriendly && !bFriendly) return 1;
      }
      return 0;
    });
    return list;
  }, [liveMatches, isStaffOrFaculty, isStudent, canAccessFriendlyGames, divisionFilter]);

  useEffect(() => {
    if (isDev) {
      navigate('/dev', { replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else if (isCoach) {
      navigate('/coach', { replace: true });
    } else if (isFacilitator) {
      navigate('/explorer', { replace: true });
    }
  }, [isDev, isAdmin, isFacilitator, isCoach, navigate]);

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

    if (!isAdmin && !isCoach) {
      fetchDashboardData();
    }
  }, [user, isPlayer, isVerified, isAdmin, isCoach]);

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
      .select('id, team_a_score, team_b_score, status, round, venue, team_a:team_a_id(name), team_b:team_b_id(name), tournament:tournament_id(id, name, sport, type)')
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

  if (isAdmin || isCoach || isFacilitator || isDev) {
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
              {isStaffOrFaculty
                ? 'Your official PSU Employee ID has been submitted for clearance. You will gain full tournament eligibility once an administrator confirms your employment credentials.'
                : 'Your Certificate of Registration has been parsed and submitted for clearance. You will gain full tournament eligibility once an administrator confirms your credentials.'}
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
          <div className="p-4 sm:p-6 rounded-3xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 text-slate-900 dark:text-white shadow-xl space-y-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 bg-red-500 text-white rounded-2xl shrink-0 mt-0.5 shadow-md shadow-red-500/20">
                <XCircle className="size-6 sm:size-7" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <Badge className="bg-red-500 text-white font-black text-[10px] uppercase tracking-wider mb-0.5">
                  Action Required • Re-Verification
                </Badge>
                <h2 className="text-lg sm:text-2xl font-black italic uppercase tracking-tight text-red-600 dark:text-red-400 break-words leading-tight">
                  Verification Clearance Rejected
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {isStaffOrFaculty
                    ? 'Your submitted PSU Employee ID could not be approved by the athletics administration.'
                    : 'Your submitted Certificate of Registration could not be approved by the athletics administration.'}
                </p>
              </div>
            </div>

            {/* Rejection Reason from Admin */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/20 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 block">
                Official Administrator Reason
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug break-words [overflow-wrap:anywhere]">
                {latestDoc.rejection_reason || 'Document could not be verified by administration.'}
              </p>
            </div>

            {isStaffOrFaculty ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Please ensure your uploaded photo clearly displays your full name, employee number, and department, then re-submit below.
              </p>
            ) : (
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
            )}
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
    return <SkeletonCard variant="dashboard" className="my-2" />;
  }

  return (
    <div className="space-y-8 md:space-y-10">
      {/* 1. ATHLETE COMMAND CENTER HERO HEADER */}
      <div className="bg-slate-950 text-white rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-64 sm:size-80 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5 sm:space-y-6">
          {/* Athlete Profile Summary Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-black italic text-xl shadow-lg shadow-orange-500/20 shrink-0 border border-orange-400/30">
                {(profile?.full_name || user?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-orange-400 font-black text-[10px] tracking-[0.2em] uppercase">
                    {user ? 'Athlete Command Center' : 'Official Portal'}
                  </span>
                  {user && isVerified && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="size-3 text-emerald-400" />
                      Verified Athlete
                    </span>
                  )}
                  {user && !isVerified && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Clock className="size-3 text-amber-400" />
                      Clearance Pending
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-tighter uppercase leading-none text-white pr-3 break-words">
                  {profile?.full_name || (user ? 'COLLEGIATE ATHLETE' : 'PSU SPORTS HUB')}
                </h1>
                <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-slate-400 font-medium text-xs">
                  {profile?.college_name && (
                    <span className="text-slate-300 font-bold">{profile.college_name}</span>
                  )}
                  {profile?.program && (
                    <span className="text-slate-400">• {profile.program}</span>
                  )}
                  {profile?.year_level && (
                    <span className="text-orange-400 font-bold">• {formatYearLevel(profile.year_level)}</span>
                  )}
                  {profile?.primary_position && (
                    <span className="text-slate-300">• {profile.primary_position}</span>
                  )}
                </div>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-2 self-start md:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="bg-white/5 border-white/10 hover:bg-orange-500 hover:border-orange-500 text-white font-bold uppercase text-[10px] tracking-widest h-9 px-3.5 rounded-xl transition-all cursor-pointer"
                >
                  <User className="size-3.5 mr-1.5" />
                  Edit Athlete Profile
                </Button>
              </div>
            )}
          </div>

          {/* 4 Quick KPI Summary Tiles */}
          {user && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
              {/* Tile 1: Active Squads */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Active Squads</span>
                  <Users className="size-4 text-orange-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black italic tabular-nums text-white leading-none">
                  {myTeams.length}
                </p>
                <p className="text-[10px] text-slate-500 truncate">Approved team rosters</p>
              </div>

              {/* Tile 2: Pending Invites */}
              <div className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border backdrop-blur-md space-y-1 transition-all ${
                invites.length > 0
                  ? 'bg-orange-500/15 border-orange-500/40 shadow-lg shadow-orange-500/10'
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Pending Invites</span>
                  <Mail className={`size-4 ${invites.length > 0 ? 'text-orange-400 animate-bounce' : 'text-slate-400'}`} />
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-xl sm:text-2xl font-black italic tabular-nums leading-none ${
                    invites.length > 0 ? 'text-orange-400' : 'text-white'
                  }`}>
                    {invites.length}
                  </p>
                  {invites.length > 0 && (
                    <span className="size-2 rounded-full bg-orange-400 animate-ping" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  {invites.length > 0 ? 'Action required below' : 'All invites processed'}
                </p>
              </div>

              {/* Tile 3: MVP Honors */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">MVP Stars</span>
                  <Star className="size-4 text-amber-400 fill-amber-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black italic tabular-nums text-white leading-none">
                  {stars.length}
                </p>
                <p className="text-[10px] text-slate-500 truncate">Match & Tourney MVPs</p>
              </div>

              {/* Tile 4: Active Arena Fixtures */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Arena Fixtures</span>
                  <Activity className="size-4 text-rose-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black italic tabular-nums text-white leading-none">
                  {sortedLiveMatches.length}
                </p>
                <p className="text-[10px] text-slate-500 truncate">Live & upcoming matches</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. IMMEDIATE ACTION: PENDING TEAM INVITATIONS (PINNED AT TOP IF PRESENT) */}
      {user && invites.length > 0 && (
        <section className="space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-500 animate-ping" />
              <h2 className="text-base sm:text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="size-4 text-orange-500" /> Coach Roster Invitations
              </h2>
            </div>
            <Badge className="bg-orange-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              {invites.length} Action Needed
            </Badge>
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {invites.map((invite, index) => {
              const team = Array.isArray(invite.teams) ? invite.teams[0] : invite.teams;
              const tourney = Array.isArray(team?.tournaments) ? team?.tournaments[0] : team?.tournaments;
              const sportName = tourney?.sport || 'Ballgame';
              const SportIcon = getSportIcon(sportName);

              return (
                <Card 
                  key={invite.id} 
                  className="group border-2 border-orange-500/40 bg-orange-500/5 dark:bg-orange-500/10 overflow-hidden rounded-2xl shadow-md animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 to-amber-500" />
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase tracking-wider">
                        <SportIcon className="size-3 text-orange-500" />
                        <span>{sportName}</span>
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                        Roster Invite
                      </span>
                    </div>
                    <CardTitle className="font-black uppercase italic tracking-tight text-lg text-slate-900 dark:text-white break-words line-clamp-1">
                      {team?.name ?? 'Unknown Squad'}
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
                      {tourney?.name ?? 'Collegiate Tournament'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-orange-500/20 text-center text-xs">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Position</span>
                        <span className="font-black text-slate-800 dark:text-slate-200 truncate">
                          {invite.position || 'Open'}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-slate-200 dark:border-white/10">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Assigned Jersey</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">
                          {invite.jersey_number !== null && invite.jersey_number !== undefined ? `#${invite.jersey_number}` : 'TBD'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        size="sm"
                        className="h-10 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black uppercase italic tracking-wider text-[11px] rounded-xl shadow-sm gap-1.5 cursor-pointer transition-all" 
                        onClick={() => handleRosterAction(invite.id, 'Approved')}
                      >
                        <CheckCircle2 className="size-3.5" /> Accept
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-10 font-black uppercase italic tracking-wider text-[11px] rounded-xl text-red-500 border border-red-500/30 hover:bg-red-500/10 active:scale-95 gap-1.5 cursor-pointer transition-all" 
                        onClick={() => handleRosterAction(invite.id, 'Rejected')}
                      >
                        <XCircle className="size-3.5" /> Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. MY ACTIVE SQUADS & ROSTERS SECTION */}
      {user && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg sm:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="size-5 text-orange-500" /> My Active Squads ({myTeams.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/matches')}
              className="text-orange-500 hover:text-orange-600 font-bold uppercase text-[10px] tracking-widest gap-1 p-0 h-auto cursor-pointer"
            >
              <span>Match Center</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {myTeams.length === 0 ? (
            <Card className="p-8 sm:p-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl md:rounded-3xl text-center bg-white/50 dark:bg-slate-900/30 space-y-3">
              <Dumbbell className="size-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <div>
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">No Active Team Roster Membership</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  You are not currently enrolled in any athletic rosters. Invitations from campus coaches will appear in your Command Center above.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {myTeams.map((roster, index) => {
                const team = Array.isArray(roster.teams) ? roster.teams[0] : roster.teams;
                const tourney = Array.isArray(team?.tournaments) ? team?.tournaments[0] : team?.tournaments;
                const availability = roster.availability_status || 'active';
                const sportName = tourney?.sport || 'Basketball';
                const SportIcon = getSportIcon(sportName);

                return (
                  <Card 
                    key={roster.id} 
                    className="group border border-slate-200/80 dark:border-white/10 hover:border-orange-500/50 transition-all rounded-2xl md:rounded-3xl animate-in fade-in slide-in-from-bottom-3 fill-mode-both bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl overflow-hidden"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-wider">
                          <SportIcon className="size-3.5 text-orange-500" />
                          <span>{sportName}</span>
                        </span>

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

                      <CardTitle className="font-black uppercase italic tracking-tight text-xl group-hover:text-orange-500 transition-colors text-slate-900 dark:text-white truncate pr-2">
                        {team?.name ?? 'Unknown Team'}
                      </CardTitle>
                      <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                        {tourney?.name ?? 'Official Tournament'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 pt-0 space-y-3.5">
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

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-10 rounded-xl font-black uppercase tracking-wider text-[10px] text-slate-700 dark:text-slate-200 hover:text-orange-500 hover:border-orange-500/40 gap-1.5 cursor-pointer"
                        onClick={() => navigate('/matches')}
                      >
                        <Trophy className="size-3.5 text-orange-500" />
                        <span>Follow Squad in Match Center</span>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. MY ACHIEVEMENTS & TROPHY ROOM */}
      {user && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg sm:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="size-5 text-orange-500" /> My Achievements ({stars.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/profile')}
              className="text-orange-500 hover:text-orange-600 font-bold uppercase text-[10px] tracking-widest gap-1 p-0 h-auto cursor-pointer"
            >
              <span>View Full Trophy Room</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-md rounded-2xl md:rounded-[2rem]">
            <CardContent className="p-4 md:p-6">
              {stars.length === 0 ? (
                <div className="text-center py-8 space-y-3 opacity-60">
                  <div className="flex justify-center gap-3">
                    <Star className="size-6 text-slate-300 dark:text-slate-700" />
                    <Star className="size-8 text-slate-400 dark:text-slate-600 -translate-y-1.5" />
                    <Star className="size-6 text-slate-300 dark:text-slate-700" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Trophy Case Awaiting First Medal</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Standout performances recognized by match scorekeepers and tournament directors will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group hover:border-orange-500/30 transition-all duration-300">
                    <div className={`p-4 rounded-2xl shadow-lg shrink-0 ${
                      stars[0].star_type === 'Red' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      <Star className="size-7 fill-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500">Latest Honor</span>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      </div>
                      <p className="font-black text-xl uppercase italic tracking-tight leading-none mb-1 text-slate-900 dark:text-white">
                        {stars[0].star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 truncate">
                        {stars[0].tournaments?.name || 'PSU Championship Arena'}
                      </p>
                    </div>
                    <div className="hidden sm:block shrink-0">
                      <Badge variant="outline" className="font-black uppercase tracking-widest px-3 py-1 text-[10px] border-slate-200 dark:border-white/10">
                        {new Date(stars[0].created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Coming Soon • Upcoming Tournaments Banner */}
      {/* Coming Soon • Upcoming Tournaments Banner */}
      {draftTournaments.length > 0 && (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
              <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2 pr-2">
                <Clock className="size-4 md:size-5 text-orange-500" /> Coming Soon • Upcoming Events
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[9px] md:text-[10px] uppercase tracking-wider border border-orange-500/20">
                Draft & Recruitment Phase
              </span>
            </div>
          </div>

          {/* Role-Specific Division Switcher for Staff, Faculty & Admins */}
          {canAccessFriendlyGames ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 hidden sm:inline">
                  Tournament Division:
                </span>
                <button
                  type="button"
                  onClick={() => setDivisionFilter('friendly')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    divisionFilter === 'friendly'
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
                  }`}
                >
                  <Sparkles className="size-3" />
                  <span>Friendly Games (Staff & Faculty)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDivisionFilter('binturungan')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    divisionFilter === 'binturungan'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-orange-500 hover:bg-orange-500/10'
                  }`}
                >
                  <Trophy className="size-3" />
                  <span>Binturungan (Tribal Fest)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDivisionFilter('collegiate')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    divisionFilter === 'collegiate'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-orange-500 hover:bg-orange-500/10'
                  }`}
                >
                  <Layers className="size-3" />
                  <span>Inter-Collegiate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDivisionFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    divisionFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>All Divisions</span>
                </button>
              </div>
              <span className="text-[10px] font-bold text-slate-400 px-2 italic">
                Viewing enabled for PSU Binturungan & Collegiate Tournaments
              </span>
            </div>
          ) : isStudent ? (
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-bold uppercase text-[10px] tracking-wider">
                <Trophy className="size-3.5" /> Official Student Division Events (Binturungan & Inter-Collegiate)
              </span>
              <span className="text-[10px] text-slate-400">Staff & Faculty games filtered to prevent overcrowding</span>
            </div>
          ) : null}

          {visibleDraftTournaments.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center bg-slate-50/50 dark:bg-slate-900/40">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                No draft tournaments found in this division.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleDraftTournaments.map((t) => {
                const isFriendly = isFriendlyTourn(t);
                return (
                  <div 
                    key={t.id}
                    onClick={() => setSelectedTournament(t)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-orange-500 hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {t.sport && (() => {
                          const DraftSportIcon = getSportIcon(t.sport);
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider shadow-sm">
                              <DraftSportIcon className="size-3 text-white shrink-0" />
                              <span>{t.sport}</span>
                            </span>
                          );
                        })()}
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                          isFriendly 
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                            : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {isFriendly ? 'Faculty & Staff Friendly' : (t.type || 'Binturungan')}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-full shrink-0">
                        Coming Soon
                      </span>
                    </div>
                    <h4 className="font-black text-base uppercase italic tracking-tight text-slate-900 dark:text-white break-words line-clamp-2 leading-snug group-hover:text-orange-500 transition-colors">
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
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Live & Upcoming Games Section */}
      <section className="space-y-4">
        <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2 pr-2">
          <Activity className="size-5 text-primary" /> Live & Upcoming Games
        </h2>
        {sortedLiveMatches.length === 0 ? (
          <Card className="p-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl md:rounded-3xl text-center bg-white/50 dark:bg-slate-900/30">
            <Activity className="size-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">No Active Fixtures</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              There are no live or upcoming scheduled matches right now. Check back when tournament rounds begin.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedLiveMatches.map((match, index) => {
              const isMatchFriendly = isFriendlyTourn(match.tournament);
              const sportName = resolveSportName(match.tournament?.sport, match.tournament?.name);
              const SportIcon = getSportIcon(sportName || match.tournament?.name);
              return (
              <Card 
                key={match.id} 
                className={`group transition-all duration-300 border-2 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 fill-mode-both bg-white dark:bg-slate-900 ${
                  match.status === 'Ongoing' ? 'border-orange-500 shadow-xl shadow-orange-500/10' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                      {sportName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-orange-500 text-white font-bold text-[9px] uppercase tracking-wider shadow-sm shrink-0">
                          <SportIcon className="size-3 text-white shrink-0" />
                          <span>{sportName}</span>
                        </span>
                      )}
                      {match.tournament?.type && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isMatchFriendly
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                        }`}>
                          {isMatchFriendly ? 'Friendly' : match.tournament.type}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic shrink-0 pr-1.5">{match.round}</span>
                  </div>
                  <CardTitle className="text-base sm:text-lg mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 font-black uppercase italic tracking-tight text-slate-900 dark:text-white pr-2">
                    <span className="break-words line-clamp-2 leading-snug pr-1">{match.team_a?.name || 'TBD'}</span>
                    <span className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider self-center sm:self-auto shrink-0 py-0.5 sm:py-0 px-1">VS</span>
                    <span className="break-words line-clamp-2 leading-snug text-left sm:text-right pr-1">{match.team_b?.name || 'BYE'}</span>
                  </CardTitle>
                  {match.venue && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-0">
                      <MapPin className="size-3 text-orange-500 shrink-0" />
                      <span className="break-words line-clamp-1">{match.venue}</span>
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
              );
            })}
          </div>
        )}
      </section>

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
