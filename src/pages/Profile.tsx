import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { VerificationUpload } from '@/components/auth/VerificationUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Trophy, 
  Star, 
  Award, 
  ShieldCheck, 
  Clock, 
  Loader2, 
  CheckCircle2, 
  Mail, 
  Shield,
  LogOut,
  ChevronRight,
  ClipboardList,
  Users,
  Settings,
  GraduationCap,
  XCircle,
  Check,
  UserX,
  BellOff,
  Bell,
  Building
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type PlayerStar = {
  id: string;
  star_type: 'Red' | 'Gold';
  match_id: string | null;
  tournament_id: string | null;
  created_at: string;
  matches: { round: string } | null;
  tournaments: { name: string } | null;
};

type College = {
  id: string;
  college_name: string;
};

type PendingInvitation = {
  id: string;
  status: string;
  created_at: string;
  teams: {
    id: string;
    name: string;
    coach_id: string;
    tournaments: {
      name: string;
      sport: string;
    } | null;
    users: {
      full_name: string;
    } | null;
  } | null;
};

export const Profile = () => {
  const { user, role, isVerified, isSuperAdmin, isCoach, isPlayer, isFacilitator, isFacultyAthlete, profile, signOut, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [stars, setStars] = useState<PlayerStar[]>([]);
  const [isLoadingStars, setIsLoadingStars] = useState(true);
  const [hasPendingDoc, setHasPendingDoc] = useState(false);
  const [showSignOutPrompt, setShowSignOutPrompt] = useState(false);

  // College Selection State
  const [collegesList, setCollegesList] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('');
  const [isSavingCollege, setIsSavingCollege] = useState(false);

  // Coach Team Invitations State for Player
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [isAcceptingInvites, setIsAcceptingInvites] = useState(true);

  // Admin stats
  const [adminStats, setAdminStats] = useState({
    pendingVerifications: 0,
    activeTournaments: 0,
    auditLogsCount: 0,
    totalTeams: 0
  });

  // Coach stats
  const [coachStats, setCoachStats] = useState({
    myTeamsCount: 0,
    enrolledAthletes: 0
  });

  useEffect(() => {
    fetchColleges();
    if (user) {
      if (isPlayer) {
        fetchStars();
        checkVerificationStatus();
        fetchPendingInvitations();
      } else if (isSuperAdmin) {
        fetchAdminStats();
      } else if (isCoach) {
        fetchCoachStats();
      }
    }
    setIsLoadingStars(false);
  }, [user, role, isPlayer, isSuperAdmin, isCoach]);

  const fetchColleges = async () => {
    const { data } = await supabase.from('colleges').select('id, college_name').order('college_name');
    if (data) setCollegesList(data);
  };

  const checkVerificationStatus = async () => {
    if (!user || isVerified) return;
    const { data } = await supabase
      .from('verification_documents')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'Pending');
    if (data && data.length > 0) {
      setHasPendingDoc(true);
    }
  };

  const fetchStars = async () => {
    try {
      setIsLoadingStars(true);
      const { data: starsData, error } = await supabase
        .from('player_stars')
        .select('*, matches(round), tournaments(name)')
        .eq('player_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (starsData) {
        setStars(starsData as unknown as PlayerStar[]);
      }
    } catch (error) {
      console.error('Error fetching player stars:', error);
    } finally {
      setIsLoadingStars(false);
    }
  };

  const fetchPendingInvitations = async () => {
    try {
      setIsLoadingInvitations(true);
      const { data, error } = await supabase
        .from('team_roster')
        .select(`
          id,
          status,
          created_at,
          teams (
            id,
            name,
            coach_id,
            tournaments (
              name,
              sport
            ),
            users:coach_id (
              full_name
            )
          )
        `)
        .eq('player_id', user?.id)
        .eq('status', 'Pending');

      if (error) {
        console.error('Error fetching team invitations:', error);
      } else if (data) {
        setInvitations(data as unknown as PendingInvitation[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching invitations:', err);
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string, teamName: string) => {
    try {
      const { error } = await supabase
        .from('team_roster')
        .update({ status: 'Approved' })
        .eq('id', invitationId);

      if (error) {
        toast.error('Failed to accept invitation: ' + error.message);
      } else {
        toast.success(`You have joined ${teamName}!`);
        fetchPendingInvitations();
      }
    } catch (err) {
      toast.error('An error occurred accepting the invitation.');
    }
  };

  const handleDeclineInvitation = async (invitationId: string, teamName: string) => {
    try {
      const { error } = await supabase
        .from('team_roster')
        .update({ status: 'Rejected' })
        .eq('id', invitationId);

      if (error) {
        toast.error('Failed to decline invitation: ' + error.message);
      } else {
        toast.info(`Invitation to join ${teamName} declined (Off Invitation).`);
        fetchPendingInvitations();
      }
    } catch (err) {
      toast.error('An error occurred declining the invitation.');
    }
  };

  const handleSaveCollege = async () => {
    if (!selectedCollegeId) {
      toast.error('Please select a college department first.');
      return;
    }

    setIsSavingCollege(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ college_id: selectedCollegeId })
        .eq('id', user?.id);

      if (error) {
        toast.error('Failed to update college department: ' + error.message);
      } else {
        toast.success('College department saved successfully!');
        if (refetchProfile) await refetchProfile();
      }
    } catch (err) {
      toast.error('An unexpected error occurred saving your college.');
    } finally {
      setIsSavingCollege(false);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const [verifRes, tournRes, auditRes, teamsRes] = await Promise.all([
        supabase.from('verification_documents').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('tournaments').select('id', { count: 'exact', head: true }).neq('status', 'Completed'),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
        supabase.from('teams').select('id', { count: 'exact', head: true })
      ]);

      setAdminStats({
        pendingVerifications: verifRes.count || 0,
        activeTournaments: tournRes.count || 0,
        auditLogsCount: auditRes.count || 0,
        totalTeams: teamsRes.count || 0
      });
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const fetchCoachStats = async () => {
    try {
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id')
        .eq('coach_id', user?.id);

      if (teamsData) {
        const teamIds = teamsData.map(t => t.id);
        let athleteCount = 0;
        if (teamIds.length > 0) {
          const { count } = await supabase
            .from('team_roster')
            .select('id', { count: 'exact', head: true })
            .in('team_id', teamIds);
          athleteCount = count || 0;
        }

        setCoachStats({
          myTeamsCount: teamsData.length,
          enrolledAthletes: athleteCount
        });
      }
    } catch (err) {
      console.error('Error fetching coach stats:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. ADMIN ROLE PROFILE VIEW */}
      {/* ========================================================================= */}
      {isSuperAdmin ? (
        <div className="space-y-6">
          {/* Admin Hero Header */}
          <div className="bg-slate-950 py-5 sm:py-6 px-5 sm:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="size-14 sm:size-16 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20 shrink-0">
                  <ShieldCheck className="size-8 sm:size-9" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[10px] tracking-wider">
                      SYSTEM EXECUTIVE • ADMIN
                    </Badge>
                    <Badge className="bg-white/10 text-slate-300 border-white/10 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <GraduationCap className="size-3 text-orange-400" />
                      {profile?.college_name || 'PSU Main Campus'}
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Full Superuser Access
                    </Badge>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-white leading-tight">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  <p className="text-slate-400 font-normal text-xs mt-0.5 flex items-center gap-1.5">
                    <Mail className="size-3 text-slate-500" /> {user?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => navigate('/admin')}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98]"
                >
                  <Settings className="size-3.5 mr-1.5" />
                  Command Center
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSignOutPrompt(true)}
                  className="border-white/10 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-slate-300 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
                >
                  <LogOut className="size-3.5 mr-1.5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Admin Command Shortcuts Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card 
              className="border border-slate-200 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group"
              onClick={() => navigate('/admin/tournaments')}
            >
              <CardHeader className="p-5 pb-2">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 size-fit mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                  <Trophy className="size-5" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-center justify-between">
                  Tournaments Arena
                  <ChevronRight className="size-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                </CardTitle>
                <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  Match Slotting & Result Approvals
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-xs text-slate-500 font-normal">
                  Create tournaments, manage match venue dates, and confirm game winners to advance bracket trees.
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Events</span>
                  <span className="text-sm font-bold text-slate-900">{adminStats.activeTournaments}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="border border-slate-200 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group"
              onClick={() => navigate('/admin/verifications')}
            >
              <CardHeader className="p-5 pb-2">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 size-fit mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                  <ShieldCheck className="size-5" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-center justify-between">
                  System Verifications
                  <ChevronRight className="size-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                </CardTitle>
                <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  Athlete Eligibility Approvals
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-xs text-slate-500 font-normal">
                  Inspect submitted student IDs, verify enrollment status, and authorize athletes for tournament participation.
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
                  <Badge className="bg-orange-500 text-white font-bold text-xs">
                    {adminStats.pendingVerifications} Pending
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="border border-slate-200 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group"
              onClick={() => navigate('/admin/audit-logs')}
            >
              <CardHeader className="p-5 pb-2">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 size-fit mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                  <ClipboardList className="size-5" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-center justify-between">
                  System Audit Logs
                  <ChevronRight className="size-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                </CardTitle>
                <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  Platform Security Log
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-xs text-slate-500 font-normal">
                  Review complete administrative action logs, match score changes, and system access records.
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Recorded Logs</span>
                  <span className="text-sm font-bold text-slate-900">{adminStats.auditLogsCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Credentials & Scope Details */}
          <Card className="border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <Shield className="size-5 text-orange-500" /> Executive Security Credentials
              </CardTitle>
              <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                Official Administrative Privileges Overview
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 grid gap-3 md:grid-cols-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                <p className="font-bold text-slate-900 text-sm truncate">{user?.email}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">College / Unit Affiliation</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <GraduationCap className="size-3.5 text-orange-500" />
                  <span className="font-bold text-slate-900 text-sm">{profile?.college_name || 'PSU Main Administration'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Institution</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building className="size-3.5 text-orange-500" />
                  <span className="font-bold text-slate-900 text-sm uppercase">Palawan State University</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : isCoach ? (
        /* ========================================================================= */
        /* 2. COACH ROLE PROFILE VIEW */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Coach Hero Header */}
          <div className="bg-slate-950 py-5 sm:py-6 px-5 sm:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="size-14 sm:size-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20 shrink-0">
                  <Users className="size-8 sm:size-9" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[10px] tracking-wider">
                      ATHLETIC STAFF • LEAD COACH
                    </Badge>
                    <Badge className="bg-white/10 text-slate-300 border-white/10 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <GraduationCap className="size-3 text-orange-400" />
                      {profile?.college_name || 'PSU Athletic Division'}
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Official PSU Coach
                    </Badge>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-white leading-tight">
                    Coach {profile?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  <p className="text-slate-400 font-normal text-xs mt-0.5 flex items-center gap-1.5">
                    <Mail className="size-3 text-slate-500" /> {user?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => navigate('/coach/teams')}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98]"
                >
                  <Users className="size-3.5 mr-1.5" />
                  Manage Teams
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSignOutPrompt(true)}
                  className="border-white/10 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-slate-300 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
                >
                  <LogOut className="size-3.5 mr-1.5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Coach Management Hub */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card 
              className="border border-slate-200 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group p-5 sm:p-6"
              onClick={() => navigate('/coach/teams')}
            >
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <Users className="size-6" />
                </div>
                <ChevronRight className="size-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
              </div>
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Roster Management</span>
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900">
                  My Teams &amp; Roster Applications
                </h3>
                <p className="text-xs text-slate-500 font-normal">
                  Register new athletic teams, manage team player rosters, and submit tournament roster entries.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">Enrolled Squads</span>
                <span className="text-slate-900 font-bold">{coachStats.myTeamsCount} Active Teams</span>
              </div>
            </Card>

            <Card className="border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900">Coaching Credentials</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PSU Athletics Division</p>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{user?.email}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">College Department</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{profile?.college_name || 'Unassigned College'}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. PLAYER / ATHLETE ROLE PROFILE VIEW (DEFAULT) */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Player Hero Header */}
          <div className="bg-slate-950 py-5 sm:py-6 px-5 sm:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="size-14 sm:size-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-orange-500/20 shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[10px] tracking-wider">
                      STUDENT ATHLETE
                    </Badge>
                    <Badge className="bg-white/10 text-slate-300 border-white/10 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <GraduationCap className="size-3 text-orange-400" />
                      {profile?.college_name || 'Unassigned College'}
                    </Badge>
                    {isVerified ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Verified Athlete
                      </Badge>
                    ) : hasPendingDoc ? (
                      <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 border-amber-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <Clock className="size-3" /> Review Pending
                      </Badge>
                    ) : null}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-white leading-tight">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  <p className="text-slate-400 font-normal text-xs mt-0.5 flex items-center gap-1.5">
                    <Mail className="size-3 text-slate-500" /> {user?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3.5 py-1.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MVP Trophies</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="size-3.5 text-orange-500 fill-orange-500" />
                    <span className="text-lg font-bold text-white">{stars.length}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowSignOutPrompt(true)}
                  className="border-white/10 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-slate-300 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
                >
                  <LogOut className="size-3.5 mr-1.5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Coach Invitations Banner (If Player has pending invitations) */}
          {invitations.length > 0 && (
            <Card className="border border-orange-500/30 bg-orange-500/5 rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-orange-500 text-white shrink-0 shadow-md shadow-orange-500/20">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500 text-white font-bold text-[10px] uppercase tracking-wider">
                        {invitations.length} Pending Coach Invite{invitations.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 mt-1">
                      Team Join Invitations Received
                    </h3>
                    <p className="text-xs text-slate-600 font-normal mt-0.5">
                      Coaches have invited you to join their official PSU tournament squads. You can accept or decline (&quot;Off Invitation&quot;).
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3.5 rounded-xl bg-white border border-orange-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm uppercase">{inv.teams?.name || 'Tournament Team'}</span>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-orange-600 border-orange-200">
                          {inv.teams?.tournaments?.sport || 'PSU Sport'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-normal">
                        Coach: <span className="text-slate-800 font-semibold">{inv.teams?.users?.full_name || 'Athletic Coach'}</span> • Event: {inv.teams?.tournaments?.name || 'Tournament'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineInvitation(inv.id, inv.teams?.name || 'team')}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold text-xs h-9 px-3 rounded-lg gap-1.5"
                      >
                        <XCircle className="size-3.5" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvitation(inv.id, inv.teams?.name || 'team')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-3 rounded-lg gap-1.5 shadow-sm"
                      >
                        <Check className="size-3.5" />
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Player Tabs */}
          <Tabs defaultValue="achievements" className="w-full space-y-4">
            <TabsList className="p-1 h-11 bg-slate-950/5 border border-slate-200/60 rounded-xl w-full sm:w-auto max-w-lg flex items-stretch">
              <TabsTrigger
                value="achievements"
                className="flex-1 font-bold uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Trophy className="size-3.5 text-orange-500" /> Achievements
              </TabsTrigger>
              <TabsTrigger
                value="invitations"
                className="flex-1 font-bold uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Users className="size-3.5 text-orange-500" /> Team Invites ({invitations.length})
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="flex-1 font-bold uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <User className="size-3.5 text-orange-500" /> Account &amp; College
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Achievements & Trophy Case */}
            <TabsContent value="achievements" className="outline-none space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <Trophy className="size-5 text-orange-500" /> Trophy Case &amp; Honors
                  </h2>
                  <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider mt-0.5">
                    Official PSU Athlete Achievements
                  </p>
                </div>
              </div>

              {isLoadingStars ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="size-8 text-orange-500 animate-spin" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Trophy Case...</p>
                </div>
              ) : stars.length === 0 ? (
                /* Compact, Purposeful Empty State Card */
                <Card className="border border-dashed bg-slate-50/50 py-8 px-6 text-center rounded-2xl border-slate-200 max-w-lg mx-auto shadow-sm">
                  <CardContent className="space-y-3 p-0">
                    <div className="flex justify-center items-center gap-2 opacity-40">
                      <Star className="size-4 text-slate-400" />
                      <div className="size-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <Star className="size-4 fill-orange-500" />
                      </div>
                      <Star className="size-4 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold uppercase tracking-tight text-slate-700">Empty Trophy Case</h3>
                      <p className="text-slate-500 font-normal max-w-sm mx-auto text-xs leading-relaxed">
                        Compete in official PSU matches and tournaments to earn MVP distinction stars and expand your trophy showcase.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stars.map((star, index) => (
                    <Card 
                      key={star.id || index} 
                      className="group hover:shadow-lg transition-all duration-300 border border-slate-200 hover:border-orange-500/30 overflow-hidden rounded-2xl"
                    >
                      <div className={`h-1.5 ${star.star_type === 'Red' ? 'bg-red-500' : 'bg-orange-500'}`} />
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-xl shadow-md ${
                            star.star_type === 'Red' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                          } group-hover:scale-105 transition-all duration-300`}>
                            <Star className="size-6 fill-white" />
                          </div>
                          <Award className="size-6 text-slate-300 group-hover:text-orange-400 transition-colors" />
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Honored Distinction</span>
                          <h3 className="text-lg font-bold uppercase tracking-tight leading-none text-slate-900 group-hover:text-orange-600 transition-colors">
                            {star.star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate mt-1">
                            {star.tournaments?.name || 'Official Tournament'}
                          </p>
                          {star.star_type === 'Red' && (
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none font-bold uppercase tracking-wider text-[9px] mt-1">
                              {star.matches?.round || 'Round Completed'}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Awarded</span>
                          <span className="text-slate-600">
                            {star.created_at ? new Date(star.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Coach Team Invitations */}
            <TabsContent value="invitations" className="outline-none space-y-4">
              <Card className="border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 flex items-center gap-2">
                      <Users className="size-5 text-orange-500" /> Coach Team Invitations
                    </h3>
                    <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider mt-0.5">
                      Manage Squad Invites &amp; Invitation Mode
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant={isAcceptingInvites ? "outline" : "secondary"}
                      onClick={() => {
                        const newStatus = !isAcceptingInvites;
                        setIsAcceptingInvites(newStatus);
                        toast.info(newStatus ? 'Team invitations enabled.' : 'Team invitations turned OFF.');
                      }}
                      className="font-bold uppercase text-xs h-9 rounded-xl gap-1.5"
                    >
                      {isAcceptingInvites ? (
                        <>
                          <Bell className="size-3.5 text-emerald-500" />
                          Invitations ON
                        </>
                      ) : (
                        <>
                          <BellOff className="size-3.5 text-amber-500" />
                          Off Invitations Mode
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  {isLoadingInvitations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-6 text-orange-500 animate-spin" />
                    </div>
                  ) : invitations.length === 0 ? (
                    <div className="text-center py-8 px-4 space-y-2 max-w-sm mx-auto">
                      <UserX className="size-8 text-slate-300 mx-auto" />
                      <h4 className="text-base font-bold uppercase text-slate-600">No Pending Invitations</h4>
                      <p className="text-xs text-slate-500 font-normal leading-relaxed">
                        When coaches invite you to join their official PSU athletic teams, invites will appear here for you to accept or decline.
                      </p>
                    </div>
                  ) : (
                    invitations.map((inv) => (
                      <div key={inv.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Coach Invite</span>
                          <h4 className="text-base font-bold uppercase tracking-tight text-slate-900">{inv.teams?.name || 'Tournament Team'}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 font-normal">
                            Coach: <span className="text-slate-800 font-semibold">{inv.teams?.users?.full_name || 'Athletic Coach'}</span> • Sport: {inv.teams?.tournaments?.sport || 'PSU Sport'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineInvitation(inv.id, inv.teams?.name || 'team')}
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold text-xs h-9 px-3 rounded-lg gap-1.5"
                          >
                            <XCircle className="size-3.5" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAcceptInvitation(inv.id, inv.teams?.name || 'team')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-3 rounded-lg gap-1.5 shadow-sm"
                          >
                            <Check className="size-3.5" />
                            Accept
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* Tab 3: Account Details, College & Verification */}
            <TabsContent value="account" className="outline-none space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Account Information Card & College Department Selector */}
                <Card className="border border-slate-200 rounded-2xl shadow-sm">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                      <User className="size-4 sm:size-5 text-orange-500" /> Personal &amp; College Details
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      Registered Credentials &amp; College Department
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">{user?.email}</p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Type / Role</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Shield className="size-3.5 text-orange-500" />
                        <span className="font-bold text-slate-900 text-xs sm:text-sm uppercase">
                          {isSuperAdmin ? 'Super Admin' : isFacilitator ? 'Facilitator' : isCoach ? 'Coach' : isFacultyAthlete ? 'Faculty Athlete' : 'Student Athlete'}
                        </span>
                      </div>
                    </div>

                    {/* College Department Selector / Display */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <GraduationCap className="size-3.5 text-orange-500" /> PSU College Department
                      </p>
                      {profile?.college_name ? (
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">{profile.college_name}</span>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 border-emerald-200">
                            Assigned
                          </Badge>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-0.5">
                          <Select 
                            value={selectedCollegeId} 
                            onValueChange={(val: string | null) => setSelectedCollegeId(val || '')}
                          >
                            <SelectTrigger className="w-full bg-white border-slate-200 rounded-xl text-xs font-medium h-10">
                              <SelectValue placeholder="Select your PSU College Department..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 rounded-xl">
                              {collegesList.map((col) => (
                                <SelectItem key={col.id} value={col.id} className="text-xs font-medium">
                                  {col.college_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            disabled={isSavingCollege || !selectedCollegeId}
                            onClick={handleSaveCollege}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-9 rounded-xl"
                          >
                            {isSavingCollege ? 'Saving...' : 'Save College Department'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Athlete Dashboard Link</p>
                      <Button 
                        variant="outline" 
                        className="w-full mt-1.5 font-semibold uppercase text-xs h-9 rounded-xl justify-between"
                        onClick={() => navigate('/player')}
                      >
                        <span>Open Athlete Dashboard</span>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Verification Status Card */}
                <Card className="border border-slate-200 rounded-2xl shadow-sm">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                      <ShieldCheck className="size-4 sm:size-5 text-orange-500" /> Eligibility Verification
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      PSU Athlete Authorization Status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-3">
                    {isVerified ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
                            <CheckCircle2 className="size-5" />
                          </div>
                          <div>
                            <h4 className="font-bold uppercase tracking-tight text-sm">Fully Verified Athlete</h4>
                            <p className="text-xs text-emerald-700 font-normal">Your PSU student athlete status is active and verified.</p>
                          </div>
                        </div>
                      </div>
                    ) : hasPendingDoc ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-amber-500 text-white rounded-lg">
                            <Clock className="size-5 animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-bold uppercase tracking-tight text-sm">Documents Under Review</h4>
                            <p className="text-xs text-amber-700 font-normal">Your submitted verification files are being reviewed by administrators.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-900">
                          <p className="text-xs font-normal">
                            Verification is required for players to join team rosters and participate in official PSU tournaments.
                          </p>
                        </div>
                        <VerificationUpload onUploadSuccess={() => setHasPendingDoc(true)} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Sign Out Confirmation Dialog */}
      <Dialog open={showSignOutPrompt} onOpenChange={setShowSignOutPrompt}>
        <DialogContent className="max-w-sm rounded-2xl p-6 border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
              Sign <span className="text-orange-500">Out</span>
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-2">
              Are you sure you want to sign out of PSU SportsTrack?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button variant="ghost" onClick={() => setShowSignOutPrompt(false)} className="h-11 rounded-xl font-bold uppercase tracking-wider text-xs">
              Cancel
            </Button>
            <Button 
              className="h-11 flex-1 bg-destructive hover:bg-destructive/90 text-white rounded-xl font-bold uppercase tracking-wider"
              onClick={() => {
                setShowSignOutPrompt(false);
                handleSignOut();
              }}
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
