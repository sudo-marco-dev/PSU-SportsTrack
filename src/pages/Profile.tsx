import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ProfilePasswordChangeCard } from '@/components/profile/ProfilePasswordChangeCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ArrowRight,
  ClipboardList,
  Users,
  Settings,
  GraduationCap,
  XCircle,
  Check,
  UserX,
  BellOff,
  Bell,
  Activity,
  Target,
  Search,
  Calendar,
  FileText
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import {
  fetchPlayerTelemetry,
  getSportScoringActionCards,
  AVAILABLE_SPORTS,
  AVAILABLE_POSITIONS,
  type PlayerTelemetry,
} from '@/lib/playerStatsEngine';
import { getSportIcon } from '@/lib/sportIcons';
import { getSportScoringProfile } from '@/lib/sportScoringRules';
import { MatchBoxScoreModal } from '@/components/scouting/MatchBoxScoreModal';
import { ExpandableIconTabs } from '@/components/ui/expandable-icon-tabs';
import { formatCoachName } from '@/lib/utils';
import { formatYearLevel, parseYearLevelInt, YEAR_LEVEL_OPTIONS } from '@/lib/formatYearLevel';

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
  const { user, role, isVerified, isDev, isAdmin, isCoach, isPlayer, isFacilitator, isFacultyAthlete, profile, signOut, refetchProfile } = useAuth();
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
  const [isAcceptingInvites, setIsAcceptingInvites] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('psu_accepting_invites');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

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

  // Academic Profile State (Editable by player if parsing error)
  const [academicProfile, setAcademicProfile] = useState({
    studentNumber: '',
    program: '',
    yearLevel: '',
    age: '',
  });
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);

  // Career Telemetry & Scouting Preferences State
  const [activeProfileTab, setActiveProfileTab] = useState<string>('career');
  const [telemetry, setTelemetry] = useState<PlayerTelemetry | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [selectedCareerSport, setSelectedCareerSport] = useState<string>('All');
  const [showAllScoringActions, setShowAllScoringActions] = useState(false);
  const [selectedBoxMatchId, setSelectedBoxMatchId] = useState<string | null>(null);
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState<string>('');
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  const [latestVerificationDoc, setLatestVerificationDoc] = useState<{
    id: string;
    status: string;
    rejection_reason?: string | null;
    confidence_score?: number | null;
  } | null>(null);

  useEffect(() => {
    if (profile) {
      setAcademicProfile({
        studentNumber: profile.student_number || '',
        program: profile.program || '',
        yearLevel: profile.year_level ? String(profile.year_level) : '',
        age: profile.age ? String(profile.age) : '',
      });
      setPreferredSports(Array.isArray(profile.preferred_sports) ? profile.preferred_sports : []);
      setPrimaryPosition(profile.primary_position || '');
    }
  }, [profile]);

  useEffect(() => {
    fetchColleges();
    if (user) {
      if (isPlayer) {
        fetchStars();
        fetchAthleteTelemetryData(user.id);
        checkVerificationStatus();
        fetchPendingInvitations();
      } else if (isAdmin) {
        fetchAdminStats();
      } else if (isCoach) {
        fetchCoachStats();
      }
    }
    setIsLoadingStars(false);
  }, [user, role, isPlayer, isAdmin, isCoach]);

  const fetchAthleteTelemetryData = async (playerId: string) => {
    setIsLoadingTelemetry(true);
    try {
      const data = await fetchPlayerTelemetry(playerId);
      setTelemetry(data);
      // Default filter to the player's #1 most played sport if they have recorded games, otherwise All
      if (data.sortedSports && data.sortedSports.length > 0 && data.sortedSports[0].gamesPlayed > 0) {
        setSelectedCareerSport(data.sortedSports[0].sport);
      } else {
        setSelectedCareerSport('All');
      }
    } catch (err) {
      console.error('Error fetching player telemetry:', err);
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  const handleTogglePreferredSport = (sport: string) => {
    setPreferredSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const handleSaveAthleticPreferences = async () => {
    if (!user) return;
    setIsSavingPreferences(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          preferred_sports: preferredSports,
          primary_position: primaryPosition || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Athletic preferences saved!');
      if (refetchProfile) await refetchProfile();
    } catch (err: any) {
      toast.error('Failed to save preferences: ' + err.message);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const fetchColleges = async () => {
    const { data } = await supabase.from('colleges').select('id, college_name').order('college_name');
    if (data) setCollegesList(data);
  };

  const checkVerificationStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('verification_documents')
      .select('id, status, rejection_reason, confidence_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setLatestVerificationDoc(data);
      setHasPendingDoc(data.status === 'Pending');
    } else {
      setLatestVerificationDoc(null);
      setHasPendingDoc(false);
    }
  };

  const handleSaveAcademicProfile = async () => {
    if (!user) return;
    setIsSavingAcademic(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          student_number: academicProfile.studentNumber || null,
          program: academicProfile.program || null,
          year_level: parseYearLevelInt(academicProfile.yearLevel),
          age: academicProfile.age ? parseInt(academicProfile.age, 10) : null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Academic profile updated successfully!');
      if (refetchProfile) await refetchProfile();
    } catch (err: any) {
      toast.error('Failed to update academic profile: ' + err.message);
    } finally {
      setIsSavingAcademic(false);
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
            status,
            is_deleted,
            coach_id,
            tournaments (
              id,
              name,
              sport,
              status,
              is_deleted
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
        const validInvites = (data as any[]).filter((inv) => {
          const teamObj = Array.isArray(inv.teams) ? inv.teams[0] : inv.teams;
          if (!teamObj || teamObj.is_deleted || teamObj.status === 'Rejected') return false;
          const tourneyObj = Array.isArray(teamObj.tournaments) ? teamObj.tournaments[0] : teamObj.tournaments;
          if (tourneyObj?.is_deleted || tourneyObj?.status === 'Completed') return false;
          return true;
        });
        setInvitations(validInvites as unknown as PendingInvitation[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching invitations:', err);
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string, teamName: string) => {
    try {
      const targetInv: any = invitations.find((i) => i.id === invitationId);
      const targetTeam = Array.isArray(targetInv?.teams) ? targetInv?.teams[0] : targetInv?.teams;
      const targetTourney = Array.isArray(targetTeam?.tournaments) ? targetTeam?.tournaments[0] : targetTeam?.tournaments;
      const targetSport = targetTourney?.sport;

      if (targetSport && user?.id) {
        const { data: existingApproved } = await supabase
          .from('team_roster')
          .select('id, teams(status, is_deleted, tournaments(sport, status, is_deleted))')
          .eq('player_id', user.id)
          .eq('status', 'Approved');

        const hasConflict = (existingApproved || []).some((row: any) => {
          const tObj = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          if (!tObj || tObj.is_deleted || tObj.status === 'Rejected') return false;
          const trObj = Array.isArray(tObj.tournaments) ? tObj.tournaments[0] : tObj.tournaments;
          return trObj?.sport === targetSport && trObj?.status !== 'Completed' && !trObj?.is_deleted;
        });

        if (hasConflict) {
          toast.error(`You are already an approved roster member on an active ${targetSport} squad.`);
          return;
        }
      }

      const { error } = await supabase
        .from('team_roster')
        .update({ status: 'Approved' })
        .eq('id', invitationId);

      if (error) {
        toast.error('Failed to accept invitation: ' + error.message);
      } else {
        if (targetSport) {
          const competingIds = invitations
            .filter((i: any) => {
              if (i.id === invitationId) return false;
              const tObj = Array.isArray(i.teams) ? i.teams[0] : i.teams;
              const trObj = Array.isArray(tObj?.tournaments) ? tObj?.tournaments[0] : tObj?.tournaments;
              return trObj?.sport === targetSport;
            })
            .map((i) => i.id);
          if (competingIds.length > 0) {
            await supabase.from('team_roster').update({ status: 'Rejected' }).in('id', competingIds);
          }
        }
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
        supabase.from('tournaments').select('id', { count: 'exact', head: true }).neq('status', 'Completed').or('is_deleted.is.null,is_deleted.eq.false'),
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
        .select('id, status, is_deleted, tournaments(is_deleted)')
        .eq('coach_id', user?.id)
        .neq('status', 'Rejected')
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (teamsData) {
        const validTeams = (teamsData as any[]).filter(t => {
          const tr = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
          return !tr?.is_deleted;
        });
        const teamIds = validTeams.map(t => t.id);
        let athleteCount = 0;
        if (teamIds.length > 0) {
          const { count } = await supabase
            .from('team_roster')
            .select('id', { count: 'exact', head: true })
            .in('team_id', teamIds)
            .eq('status', 'Approved');
          athleteCount = count || 0;
        }

        setCoachStats({
          myTeamsCount: validTeams.length,
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
      {isAdmin ? (
        <div className="space-y-6">
          {/* Admin Hero Header */}
          <div className="bg-slate-950 py-5 sm:py-6 px-4 sm:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                <div className="size-12 sm:size-16 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20 shrink-0">
                  <ShieldCheck className="size-7 sm:size-9" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[10px] tracking-wider">
                      SYSTEM EXECUTIVE • ADMIN
                    </Badge>
                    <Badge className="py-1 px-2.5 h-auto rounded-lg bg-white/10 text-slate-200 border-white/10 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1.5 max-w-full whitespace-normal text-left leading-snug">
                      <GraduationCap className="size-3.5 text-orange-400 shrink-0" />
                      <span className="break-words">{profile?.college_name || 'PSU Main Campus'}</span>
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-3 shrink-0" /> Full Admin Access
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black italic tracking-tight uppercase text-white leading-tight break-words">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  <p className="text-slate-400 font-normal text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Mail className="size-3 text-slate-500 shrink-0" /> <span className="truncate">{user?.email}</span>
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
              className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group"
              onClick={() => navigate('/admin/tournaments')}
            >
              <CardHeader className="p-5 pb-2">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 size-fit mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                  <Trophy className="size-5" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-center justify-between text-slate-900 dark:text-white">
                  Tournaments Arena
                  <ChevronRight className="size-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  Match Slotting & Result Approvals
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Create tournaments, manage match venue dates, and confirm game winners to advance bracket trees.
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Events</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{adminStats.activeTournaments}</span>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group"
              onClick={() => navigate('/admin/verifications')}
            >
              <CardHeader className="p-5 pb-2">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 size-fit mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                  <ShieldCheck className="size-5" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-center justify-between text-slate-900 dark:text-white">
                  System Verifications
                  <ChevronRight className="size-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  Athlete Eligibility Approvals
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Inspect submitted student IDs, verify enrollment status, and authorize athletes for tournament participation.
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
                  <Badge className="bg-orange-500 text-white font-bold text-xs">
                    {adminStats.pendingVerifications} Pending
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group"
              onClick={() => navigate('/admin/audit-logs')}
            >
              <CardHeader className="p-5 pb-2">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 size-fit mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                  <ClipboardList className="size-5" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-center justify-between text-slate-900 dark:text-white">
                  System Audit Logs
                  <ChevronRight className="size-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  Platform Security Log
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Review complete administrative action logs, match score changes, and system access records.
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Recorded Logs</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{adminStats.auditLogsCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Credentials & Scope Details */}
          <Card className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 sm:p-6">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                <Shield className="size-5 text-orange-500" /> Executive Security Credentials
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                Official Administrative Privileges Overview
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 grid gap-3 md:grid-cols-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{user?.email}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">College / Unit Affiliation</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{profile?.college_name || 'PSU Main Administration'}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Institution</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm uppercase mt-0.5">Palawan State University</p>
              </div>
            </CardContent>
          </Card>

          {/* Admin Direct In-Profile Password Reset */}
          <ProfilePasswordChangeCard />
        </div>
      ) : isCoach ? (
        /* ========================================================================= */
        /* 2. COACH ROLE PROFILE VIEW */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Coach Hero Header */}
          <div className="bg-slate-950 py-5 sm:py-6 px-4 sm:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                <div className="size-12 sm:size-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20 shrink-0">
                  <Users className="size-7 sm:size-9" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[10px] tracking-wider">
                      ATHLETIC STAFF • LEAD COACH
                    </Badge>
                    <Badge className="py-1 px-2.5 h-auto rounded-lg bg-white/10 text-slate-200 border-white/10 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1.5 max-w-full whitespace-normal text-left leading-snug">
                      <GraduationCap className="size-3.5 text-orange-400 shrink-0" />
                      <span className="break-words">{profile?.college_name || 'PSU Athletic Division'}</span>
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-3 shrink-0" /> Official PSU Coach
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black italic tracking-tight uppercase text-white leading-tight break-words">
                    {formatCoachName(profile?.full_name || user?.email?.split('@')[0])}
                  </h1>
                  <p className="text-slate-400 font-normal text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Mail className="size-3 text-slate-500 shrink-0" /> <span className="truncate">{user?.email}</span>
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
          </div>          {/* Coach Management Hub */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0 [&>*]:min-w-0">
            <Card 
              className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group p-5 sm:p-6"
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
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                  My Teams &amp; Roster Applications
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Register new athletic teams, manage team player rosters, and submit tournament roster entries.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">Enrolled Squads</span>
                <span className="text-slate-900 dark:text-white font-bold">{coachStats.myTeamsCount} Active Teams</span>
              </div>
            </Card>

            <Card className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">Coaching Credentials</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PSU Athletics Division</p>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                  <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{user?.email}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">College Department</p>
                  <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{profile?.college_name || 'Unassigned College'}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Coach Direct In-Profile Password Reset */}
          <ProfilePasswordChangeCard />
        </div>
      ) : (isFacilitator || isDev) ? (
        /* ========================================================================= */
        /* 2B. FACILITATOR & DEVELOPER ROLE PROFILE VIEW */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="bg-slate-950 py-5 sm:py-6 px-4 sm:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                <div className="size-12 sm:size-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20 shrink-0">
                  <ShieldCheck className="size-7 sm:size-9" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[10px] tracking-wider">
                      {isDev ? 'PLATFORM ENGINEER • DEVELOPER' : 'TOURNAMENT OFFICIAL • FACILITATOR'}
                    </Badge>
                    <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-3 shrink-0" /> Authorized Official
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black italic tracking-tight uppercase text-white leading-tight break-words">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  <p className="text-slate-400 font-normal text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Mail className="size-3 text-slate-500 shrink-0" /> <span className="truncate">{user?.email}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => navigate(isDev ? '/dev' : '/explorer')}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98]"
                >
                  <Shield className="size-3.5 mr-1.5" />
                  {isDev ? 'Open Dev Sandbox' : 'Open Match Center'}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 min-w-0 [&>*]:min-w-0">
            <Card
              className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all duration-200 rounded-2xl shadow-sm cursor-pointer group p-5 sm:p-6"
              onClick={() => navigate('/explorer')}
            >
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <Trophy className="size-6" />
                </div>
                <ChevronRight className="size-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
              </div>
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Official Operations</span>
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                  Live Match Scoring &amp; Kiosk Deck
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Claim scoring console leases, operate the courtside Kiosk deck, update live match scores, and award Match MVPs.
                </p>
              </div>
            </Card>

            <Card className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">Official Credentials</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PSU Sports Governance</p>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                  <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{user?.email}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Role</p>
                  <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm uppercase">{isDev ? 'Developer' : 'Match Facilitator'}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Facilitator / Dev Direct In-Profile Password Reset */}
          <ProfilePasswordChangeCard />
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. PLAYER / ATHLETE ROLE PROFILE VIEW (DEFAULT) */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Compact Player Hero Header */}
          <div className="bg-slate-950 py-3 sm:py-5 px-3.5 sm:px-6 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-start sm:items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                <div className="size-10 sm:size-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-base sm:text-2xl shadow-lg shadow-orange-500/20 shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-1">
                    <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/20 border-orange-500/30 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider py-0 px-2">
                      {isFacultyAthlete ? 'FACULTY ATHLETE' : 'STUDENT ATHLETE'}
                    </Badge>
                    <Badge className="py-0.5 px-2 h-auto rounded-lg bg-white/10 text-slate-200 border-white/10 font-medium uppercase text-[9px] sm:text-[10px] tracking-wider flex items-center gap-1 max-w-full whitespace-normal text-left leading-snug">
                      <GraduationCap className="size-3 text-orange-400 shrink-0" />
                      <span className="break-words">{profile?.college_name || 'Unassigned College'}</span>
                    </Badge>
                    {isVerified ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 font-medium uppercase text-[9px] sm:text-[10px] tracking-wider flex items-center gap-1 py-0 px-2">
                        <CheckCircle2 className="size-3 shrink-0" /> Verified Athlete
                      </Badge>
                    ) : hasPendingDoc ? (
                      <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 border-amber-500/30 font-medium uppercase text-[9px] sm:text-[10px] tracking-wider flex items-center gap-1 py-0 px-2">
                        <Clock className="size-3 shrink-0" /> Review Pending
                      </Badge>
                    ) : null}
                  </div>
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-black italic tracking-tight uppercase text-white leading-tight break-words">
                    {profile?.full_name || user?.email?.split('@')[0]}
                  </h1>
                  <p className="text-slate-400 font-normal text-[11px] sm:text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Mail className="size-3 text-slate-500 shrink-0" /> <span className="truncate">{user?.email}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Career Score</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Activity className="size-3 text-orange-400 shrink-0" />
                    <span className="text-xs sm:text-lg font-black text-white tabular-nums">
                      {telemetry?.totalPoints ?? 0}
                    </span>
                  </div>
                </div>
                <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Games</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs sm:text-lg font-black text-emerald-400 tabular-nums">
                      {telemetry?.gamesPlayed ?? 0}
                    </span>
                  </div>
                </div>
                <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">MVP Stars</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="size-3 text-orange-500 fill-orange-500 shrink-0" />
                    <span className="text-xs sm:text-lg font-bold text-white tabular-nums">{stars.length}</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/athletics')}
                  className="col-span-2 sm:col-span-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-8 sm:h-10 px-3 sm:px-3.5 rounded-xl shadow-md shadow-orange-500/20"
                >
                  <Search className="size-3.5 mr-1 shrink-0" />
                  Athletics Hub
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSignOutPrompt(true)}
                  className="col-span-1 border-white/10 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-slate-300 font-semibold text-xs h-8 sm:h-10 px-2.5 sm:px-3 rounded-xl transition-all"
                >
                  <LogOut className="size-3.5 mr-1 shrink-0" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Coach Invitations Banner (If Player has pending invitations) */}
          {invitations.length > 0 && (
            <Card className="border border-orange-500/30 bg-orange-50/5 rounded-2xl p-5 shadow-sm relative overflow-hidden">
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
                    <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white mt-1">
                      Team Join Invitations Received
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-normal mt-0.5">
                      Coaches have invited you to join their official PSU tournament squads. You can accept or decline (&quot;Off Invitation&quot;).
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-500/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm uppercase">{inv.teams?.name || 'Tournament Team'}</span>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30">
                          {inv.teams?.tournaments?.sport || 'PSU Sport'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatCoachName(inv.teams?.users?.full_name, 'Athletic Coach')}</span> • Event: {inv.teams?.tournaments?.name || 'Tournament'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineInvitation(inv.id, inv.teams?.name || 'team')}
                        className="border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 font-semibold text-xs h-9 px-3 rounded-lg gap-1.5"
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

          {/* Player Tabs — Expandable Icon Tabs (Single sleek 44px row) */}
          <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab} className="w-full flex flex-col space-y-4 min-w-0">
            <ExpandableIconTabs
              tabs={[
                { id: 'career', label: 'Career & Games', shortLabel: 'Career', icon: Activity, count: telemetry?.gamesPlayed ?? 0 },
                { id: 'achievements', label: 'Achievements', shortLabel: 'Awards', icon: Trophy, count: stars.length },
                {
                  id: 'invitations',
                  label: 'Invites',
                  shortLabel: 'Invites',
                  icon: Users,
                  count: invitations.length,
                  badgeTone: invitations.length > 0 ? 'warning' : 'muted',
                },
                { id: 'account', label: 'Account & Prefs', shortLabel: 'Account', icon: User },
              ]}
              activeTab={activeProfileTab}
              onChange={setActiveProfileTab}
              className="w-full sm:w-fit sm:mx-auto sm:self-center"
              ariaLabel="Athlete Profile Navigation"
            />

            {/* Tab 0: Career Telemetry, Dynamic Multi-Sport Breakdown & Recorded Games Log */}
            <TabsContent value="career" className="w-full min-w-0 outline-none space-y-5">
              {isLoadingTelemetry ? (
                <div className="space-y-4 py-2">
                  <SkeletonCard variant="stat" count={4} />
                  <SkeletonCard variant="card" count={2} />
                </div>
              ) : (() => {
                // Sort all 9 official PSU sports from Most Played -> Least / Zero Played
                const orderedSports = [...(telemetry?.sortedSports || [])].sort((a, b) => {
                  if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
                  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                  if (b.activeSquadCount !== a.activeSquadCount) return b.activeSquadCount - a.activeSquadCount;
                  const aPref = preferredSports.includes(a.sport) ? 1 : 0;
                  const bPref = preferredSports.includes(b.sport) ? 1 : 0;
                  if (bPref !== aPref) return bPref - aPref;
                  return a.sport.localeCompare(b.sport);
                });

                const activeSportData =
                  selectedCareerSport !== 'All' && telemetry?.perSportTelemetry?.[selectedCareerSport]
                    ? telemetry.perSportTelemetry[selectedCareerSport]
                    : null;

                const displayGamesPlayed = activeSportData ? activeSportData.gamesPlayed : (telemetry?.gamesPlayed ?? 0);
                const displayWins = activeSportData ? activeSportData.wins : (telemetry?.wins ?? 0);
                const displayLosses = activeSportData ? activeSportData.losses : (telemetry?.losses ?? 0);
                const displayWinRate = activeSportData ? activeSportData.winRate : (telemetry?.winRate ?? 0);
                const displayTotalPoints = activeSportData ? activeSportData.totalPoints : (telemetry?.totalPoints ?? 0);
                const displayPpg = activeSportData ? activeSportData.ppg : (telemetry?.ppg ?? 0);

                const effectiveSportForRules =
                  selectedCareerSport !== 'All'
                    ? selectedCareerSport
                    : orderedSports[0]?.gamesPlayed > 0
                    ? orderedSports[0].sport
                    : preferredSports[0] || 'All';

                const sportProfile = getSportScoringProfile(
                  effectiveSportForRules !== 'All' ? effectiveSportForRules : 'Basketball'
                );
                const pointUnitLabel = selectedCareerSport !== 'All' ? sportProfile.pointUnit : 'PTS';

                const actionCards = getSportScoringActionCards(
                  selectedCareerSport,
                  activeSportData ? activeSportData.actionCounts : (telemetry?.actionCounts || {}),
                  activeSportData ? activeSportData.actionBreakdown : (telemetry?.actionBreakdown || {
                    threePointers: 0,
                    twoPointers: 0,
                    freeThrows: 0,
                    kills: 0,
                    aces: 0,
                    blocks: 0,
                    goals: 0,
                    penalties: 0,
                    homeRuns: 0,
                    runs: 0,
                    rallyPoints: 0,
                  })
                );

                // Pick the #1 highlight action card for the 4th summary stat card (never hardcoded to Basketball!)
                const topHighlightAction =
                  [...actionCards].sort((a, b) => b.totalPoints - a.totalPoints || b.count - a.count)[0] ||
                  actionCards[0] || {
                    label: 'Primary Action',
                    count: 0,
                    totalPoints: 0,
                    pointsPerAction: 1,
                  };

                const filteredGames = (telemetry?.recordedGames || []).filter(
                  (g) => selectedCareerSport === 'All' || g.sport.toLowerCase() === selectedCareerSport.toLowerCase()
                );

                const formatGameActionSummary = (g: any) => {
                  const sp = (g.sport || '').toLowerCase();
                  if (sp.includes('volleyball') || sp.includes('takraw')) {
                    return `${g.kills} Kills • ${g.aces} Aces • ${g.blocks} Blk`;
                  }
                  if (sp.includes('soccer') || sp.includes('futsal') || sp.includes('football')) {
                    return `${g.goals} Goals • ${g.penalties || 0} PK`;
                  }
                  if (sp.includes('baseball') || sp.includes('softball')) {
                    return `${g.runs || 0} Runs • ${g.homeRuns} HR`;
                  }
                  if (sp.includes('pickleball') || sp.includes('table tennis')) {
                    return `${g.rallyPoints || g.playerPoints} Rally Pts`;
                  }
                  return `${g.threePointers} 3PM • ${g.twoPointers} 2PM • ${g.freeThrows} FT`;
                };

                const visibleActionCards = showAllScoringActions
                  ? actionCards
                  : actionCards.filter(c => c.count > 0).length > 0
                  ? actionCards.filter(c => c.count > 0)
                  : actionCards.slice(0, 4);

                return (
                  <>
                    {/* Sport Filter Bar: Expandable Sport Icon Rail */}
                    <Card className="p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                            <Target className="size-4 text-orange-500 shrink-0" />
                            Sport Telemetry Filter
                          </h3>
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            Ordered automatically by your recorded games played across PSU sports
                          </p>
                        </div>
                        {orderedSports[0]?.gamesPlayed > 0 && (
                          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-black uppercase w-fit">
                            Top Sport: {orderedSports[0].sport} ({orderedSports[0].gamesPlayed} GP)
                          </Badge>
                        )}
                      </div>

                      {/* Single-Row Expandable Sport Icon Rail */}
                      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar w-full min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCareerSport('All')}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            selectedCareerSport === 'All'
                              ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                              : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-orange-500/40'
                          }`}
                        >
                          <Activity className="size-3.5 shrink-0" />
                          <span className={selectedCareerSport === 'All' ? 'inline' : 'hidden sm:inline'}>All Sports</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                              selectedCareerSport === 'All'
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {telemetry?.gamesPlayed ?? 0}
                          </span>
                        </button>

                        {orderedSports.map((spItem, idx) => {
                          const SportIcon = getSportIcon(spItem.sport);
                          const isSelected = selectedCareerSport === spItem.sport;
                          const hasPlayed = spItem.gamesPlayed > 0;
                          const isTopPlayed = idx === 0 && hasPlayed;

                          return (
                            <button
                              key={spItem.sport}
                              type="button"
                              onClick={() => setSelectedCareerSport(spItem.sport)}
                              title={`${spItem.sport} (${spItem.gamesPlayed} GP)`}
                              className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                isSelected
                                  ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                                  : hasPlayed
                                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-orange-500/30 hover:border-orange-500'
                                  : 'bg-slate-50/70 dark:bg-white/[0.03] text-slate-400 dark:text-slate-500 border-slate-200/70 dark:border-white/5 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              <SportIcon className="size-3.5 shrink-0" />
                              <span className={isSelected ? 'inline' : 'hidden sm:inline'}>{spItem.sport}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : hasPlayed
                                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                                    : 'bg-slate-200/60 dark:bg-white/5 text-slate-400'
                                }`}
                              >
                                {spItem.gamesPlayed}<span className="hidden sm:inline"> GP</span>
                              </span>
                              {isTopPlayed && !isSelected && (
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                                  #1
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Mobile & Tablet Telemetry Ribbon (< md) — Adaptive multi-device grid */}
                    <div className="md:hidden grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2 bg-slate-100/90 dark:bg-slate-950/90 border border-slate-300/80 dark:border-white/15 rounded-2xl p-2.5 shadow-sm">
                      <div className="text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10">
                        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">GP</p>
                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums leading-none">
                          {displayGamesPlayed}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-1">
                          {displayWins}W-{displayLosses}L
                        </p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10">
                        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">{pointUnitLabel}</p>
                        <p className="text-base sm:text-lg font-black text-orange-500 mt-0.5 tabular-nums leading-none">
                          {displayTotalPoints}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 truncate mt-1">Total</p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10">
                        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">AVG</p>
                        <p className="text-base sm:text-lg font-black text-cyan-600 dark:text-cyan-400 mt-0.5 tabular-nums leading-none">
                          {displayPpg}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 truncate mt-1">/ Game</p>
                      </div>
                      <div className="text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10">
                        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate" title={topHighlightAction.label}>
                          {topHighlightAction.label.split(' ')[0]}
                        </p>
                        <p className="text-base sm:text-lg font-black text-amber-500 mt-0.5 tabular-nums leading-none">
                          {topHighlightAction.count}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 truncate mt-1">
                          +{topHighlightAction.totalPoints}
                        </p>
                      </div>
                      <div className="col-span-2 xs:col-span-2 sm:col-span-1 text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10">
                        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">Squads</p>
                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums leading-none">
                          {telemetry?.activeSquads.filter((s) => s.rosterStatus === 'Approved').length ?? 0}
                        </p>
                        <p className="text-[10px] font-bold text-orange-500 truncate mt-1">
                          {primaryPosition ? primaryPosition.split(' ')[0] : 'Athlete'}
                        </p>
                      </div>
                    </div>

                    {/* Desktop Career Summary Stat Cards (>= md) */}
                    <div className="hidden md:grid md:grid-cols-5 gap-3">
                      <Card className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                          {selectedCareerSport === 'All' ? 'Games Recorded' : `${selectedCareerSport} Games`}
                        </p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white mt-1">
                          {displayGamesPlayed}
                        </p>
                        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                          {displayWins}W - {displayLosses}L ({displayWinRate}% Win)
                        </p>
                      </Card>

                      <Card className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                          Total {pointUnitLabel}
                        </p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-orange-500 mt-1">
                          {displayTotalPoints}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {selectedCareerSport === 'All' ? 'All Recorded Sports' : `${selectedCareerSport} Scoring`}
                        </p>
                      </Card>

                      <Card className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                          Scoring Avg
                        </p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-cyan-600 dark:text-cyan-400 mt-1">
                          {displayPpg}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {pointUnitLabel} Per Game
                        </p>
                      </Card>

                      <Card className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                          {topHighlightAction.label}
                        </p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-amber-500 mt-1">
                          {topHighlightAction.count}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">
                          +{topHighlightAction.totalPoints} {pointUnitLabel} Recorded
                        </p>
                      </Card>

                      <Card className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                          Active Squads
                        </p>
                        <p className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white mt-1">
                          {telemetry?.activeSquads.filter((s) => s.rosterStatus === 'Approved').length ?? 0}
                        </p>
                        <p className="text-[11px] font-bold text-orange-500 truncate mt-1">
                          {primaryPosition || 'All-Around Athlete'}
                        </p>
                      </Card>
                    </div>

                    {/* Dynamic Sport-Specific Scoring Breakdown Card */}
                    <Card className="border border-slate-200 dark:border-white/10 rounded-3xl bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            <Target className="size-5 text-orange-500 shrink-0" />
                            <span className="truncate">
                              {selectedCareerSport === 'All'
                                ? 'Multi-Sport Scoring Breakdown'
                                : `${selectedCareerSport} Scoring Breakdown`}
                            </span>
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                            {selectedCareerSport === 'All'
                              ? 'Aggregated scoring actions across all recorded PSU tournament games'
                              : `Official ${selectedCareerSport} scoring actions (${sportProfile.pointUnit})`}
                          </p>
                        </div>
                        {preferredSports.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {preferredSports.map((sp) => (
                              <Badge
                                key={sp}
                                className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-black uppercase"
                              >
                                {sp}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        {visibleActionCards.map((item, idx) => {
                          const toneClasses =
                            idx % 3 === 0
                              ? 'bg-orange-500/5 border-orange-500/20 text-orange-600 dark:text-orange-400'
                              : idx % 3 === 1
                              ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                          const badgeBg =
                            idx % 3 === 0
                              ? 'bg-orange-500 text-white'
                              : idx % 3 === 1
                              ? 'bg-cyan-600 text-white'
                              : 'bg-emerald-600 text-white';

                          return (
                            <div
                              key={`${item.actionType}-${idx}`}
                              className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border flex flex-col justify-between gap-1.5 sm:gap-3 min-w-0 ${toneClasses}`}
                            >
                              <div className="min-w-0">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest block truncate">
                                  {item.label}
                                </span>
                                <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
                                  {item.count}
                                </p>
                                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                  {item.sublabel}
                                </p>
                              </div>
                              <Badge className={`${badgeBg} font-black text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 shrink-0 w-fit`}>
                                +{item.totalPoints} {pointUnitLabel}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>

                      {actionCards.length > 4 && (
                        <div className="pt-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setShowAllScoringActions((prev) => !prev)}
                            className="text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            {showAllScoringActions
                              ? 'Collapse Zero-Count Actions'
                              : `Show All (${actionCards.length}) Scoring Types`}
                          </button>
                        </div>
                      )}
                    </Card>

                    {/* Recorded Games Match Log (Mobile-First Cards + Desktop Table) */}
                    <Card className="border border-slate-200 dark:border-white/10 rounded-3xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                      <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            <Activity className="size-5 text-orange-500 shrink-0" />
                            <span>
                              {selectedCareerSport === 'All'
                                ? 'Recorded Games & Match Box Scores'
                                : `${selectedCareerSport} Recorded Games`}
                            </span>
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                            Tap any recorded game to inspect the full Team A vs. Team B box score
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-black uppercase w-fit">
                          {filteredGames.length} {filteredGames.length === 1 ? 'Match' : 'Matches'} Logged
                        </Badge>
                      </div>

                      {filteredGames.length === 0 ? (
                        <div className="p-8 sm:p-10 text-center space-y-2">
                          <Activity className="size-8 text-slate-300 dark:text-slate-600 mx-auto" />
                          <h4 className="text-sm font-black uppercase text-slate-700 dark:text-slate-200">
                            {selectedCareerSport === 'All'
                              ? 'No Recorded Matches Yet'
                              : `No Recorded ${selectedCareerSport} Matches Yet`}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            {selectedCareerSport === 'All'
                              ? 'Once you compete in an official PSU tournament match or a scorekeeper credits your jersey on the live scoring deck, your game-by-game telemetry will appear here automatically.'
                              : `You have 0 recorded games in ${selectedCareerSport}. Select another sport filter above or switch to "All Sports".`}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Mobile Card Stack (Zero Horizontal Scrolling on Mobile) */}
                          <div className="md:hidden divide-y divide-slate-100 dark:divide-white/5">
                            {filteredGames.map((g) => (
                              <div
                                key={g.matchId}
                                onClick={() => setSelectedBoxMatchId(g.matchId)}
                                className="p-4 hover:bg-orange-500/5 active:bg-orange-500/10 transition-colors cursor-pointer space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[9px] font-black uppercase px-1.5 py-0">
                                        {g.sport}
                                      </Badge>
                                      {g.jerseyNumber && (
                                        <span className="font-mono text-[10px] font-black text-orange-500">
                                          #{g.jerseyNumber}
                                        </span>
                                      )}
                                      {g.isMatchMvp && (
                                        <Badge className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                                          MVP
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="font-black uppercase text-xs text-slate-900 dark:text-white mt-1 break-words">
                                      {g.myTeamName} vs {g.opponentTeamName}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                      {g.tournamentName} • {g.round}
                                    </p>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="text-lg font-black tabular-nums text-orange-500 block leading-none">
                                      {g.playerPoints}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase text-slate-400">
                                      {getSportScoringProfile(g.sport).pointUnit}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <Badge
                                    className={
                                      g.result === 'W'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-black text-[10px]'
                                        : g.result === 'L'
                                        ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-black text-[10px]'
                                        : 'bg-amber-500/15 text-amber-600 font-black text-[10px]'
                                    }
                                  >
                                    {g.result} ({g.myTeamScore}-{g.opponentTeamScore})
                                  </Badge>
                                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate">
                                    {formatGameActionSummary(g)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                  <th className="py-3 px-5">Matchup &amp; Tournament</th>
                                  <th className="py-3 px-3 text-center">Sport</th>
                                  <th className="py-3 px-3 text-center">Outcome</th>
                                  <th className="py-3 px-3 text-center">Scoring Action Breakdown</th>
                                  <th className="py-3 px-5 text-right">My Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredGames.map((g) => (
                                  <tr
                                    key={g.matchId}
                                    onClick={() => setSelectedBoxMatchId(g.matchId)}
                                    className="hover:bg-orange-500/5 transition-colors cursor-pointer group"
                                  >
                                    <td className="py-3.5 px-5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black uppercase text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                                          {g.myTeamName} vs {g.opponentTeamName}
                                        </span>
                                        {g.jerseyNumber && (
                                          <span className="font-mono text-[10px] font-black text-orange-500">
                                            #{g.jerseyNumber}
                                          </span>
                                        )}
                                        {g.isMatchMvp && (
                                          <Badge className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                                            Match MVP
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                                        <span>{g.tournamentName} ({g.round})</span>
                                        {g.matchTime && (
                                          <span className="inline-flex items-center gap-1">
                                            <Calendar className="size-2.5" />
                                            {new Date(g.matchTime).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-3 text-center">
                                      <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-black uppercase">
                                        {g.sport}
                                      </Badge>
                                    </td>
                                    <td className="py-3.5 px-3 text-center">
                                      <Badge
                                        className={
                                          g.result === 'W'
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-black text-[10px]'
                                            : g.result === 'L'
                                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-black text-[10px]'
                                            : 'bg-amber-500/15 text-amber-600 font-black text-[10px]'
                                        }
                                      >
                                        {g.result} ({g.myTeamScore}-{g.opponentTeamScore})
                                      </Badge>
                                    </td>
                                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                                      {formatGameActionSummary(g)}
                                    </td>
                                    <td className="py-3.5 px-5 text-right font-black text-base tabular-nums text-orange-500">
                                      {g.playerPoints}{' '}
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {getSportScoringProfile(g.sport).pointUnit}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </Card>
                  </>
                );
              })()}
            </TabsContent>

            {/* Tab 1: Achievements & Trophy Case */}
            <TabsContent value="achievements" className="w-full min-w-0 outline-none space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="size-5 text-orange-500" /> Trophy Case &amp; Honors
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider mt-0.5">
                    Official PSU Athlete Achievements
                  </p>
                </div>
              </div>

              {isLoadingStars ? (
                <div className="py-2">
                  <SkeletonCard variant="trophy-case" count={4} />
                </div>
              ) : stars.length === 0 ? (
                /* Compact, Purposeful Empty State Card */
                <Card className="border border-dashed bg-slate-50/50 dark:bg-slate-900/50 py-8 px-6 text-center rounded-2xl border-slate-200 dark:border-white/10 max-w-lg mx-auto shadow-sm">
                  <CardContent className="space-y-3 p-0">
                    <div className="flex justify-center items-center gap-2 opacity-40">
                      <Star className="size-4 text-slate-400" />
                      <div className="size-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <Star className="size-4 fill-orange-500" />
                      </div>
                      <Star className="size-4 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold uppercase tracking-tight text-slate-700 dark:text-slate-200">Empty Trophy Case</h3>
                      <p className="text-slate-500 dark:text-slate-400 font-normal max-w-sm mx-auto text-xs leading-relaxed">
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
                      className="group hover:shadow-lg transition-all duration-300 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-orange-500/30 overflow-hidden rounded-2xl"
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
                          <h3 className="text-lg font-bold uppercase tracking-tight leading-none text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors">
                            {star.star_type === 'Red' ? 'Match MVP' : 'Tournament MVP'}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate mt-1">
                            {star.tournaments?.name || 'Official Tournament'}
                          </p>
                          {star.star_type === 'Red' && (
                            <Badge className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 border-none font-bold uppercase tracking-wider text-[9px] mt-1">
                              {star.matches?.round || 'Round Completed'}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Awarded</span>
                          <span className="text-slate-600 dark:text-slate-300">
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
            <TabsContent value="invitations" className="w-full min-w-0 outline-none space-y-4">
              <Card className="border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/10">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="size-5 text-orange-500" /> Coach Team Invitations
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider mt-0.5">
                      Manage Squad Invites &amp; Invitation Mode
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      variant={isAcceptingInvites ? "outline" : "secondary"}
                      onClick={() => {
                        const newStatus = !isAcceptingInvites;
                        setIsAcceptingInvites(newStatus);
                        try {
                          localStorage.setItem('psu_accepting_invites', String(newStatus));
                        } catch {
                          // ignore storage errors
                        }
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
                    <SkeletonCard variant="row" count={3} />
                  ) : invitations.length === 0 ? (
                    <div className="text-center py-8 px-4 space-y-2 max-w-sm mx-auto">
                      <UserX className="size-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <h4 className="text-base font-bold uppercase text-slate-600 dark:text-slate-300">No Pending Invitations</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                        When coaches invite you to join their official PSU athletic teams, invites will appear here for you to accept or decline.
                      </p>
                    </div>
                  ) : (
                    invitations.map((inv) => (
                      <div key={inv.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Coach Invite</span>
                          <h4 className="text-base font-bold uppercase tracking-tight text-slate-900 dark:text-white">{inv.teams?.name || 'Tournament Team'}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                            <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatCoachName(inv.teams?.users?.full_name, 'Athletic Coach')}</span> • Sport: {inv.teams?.tournaments?.sport || 'PSU Sport'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineInvitation(inv.id, inv.teams?.name || 'team')}
                            className="border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300 font-semibold text-xs h-9 px-3 rounded-lg gap-1.5"
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
            <TabsContent value="account" className="w-full min-w-0 outline-none space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 1. Account Information Card & College Department Selector */}
                <Card className="border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader className="p-6 pb-4">
                    <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-start gap-2.5">
                      <User className="size-5 text-orange-500 shrink-0 mt-0.5" />
                      <span>Personal &amp; Campus Affiliation</span>
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      University Account Credentials
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-3.5">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Institutional Email</p>
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{user?.email}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Athlete Role</p>
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm uppercase mt-0.5">
                        {isAdmin ? 'Admin' : isFacilitator ? 'Facilitator' : isCoach ? 'Coach' : isFacultyAthlete ? 'Faculty Athlete' : 'Student Athlete'}
                      </p>
                    </div>

                    {/* College Department Selector / Display */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        PSU College Department
                      </p>
                      {profile?.college_name ? (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">{profile.college_name}</span>
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
                            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium h-11">
                              <SelectValue placeholder="Select your PSU College Department...">
                                {selectedCollegeId && collegesList.find((col) => col.id === selectedCollegeId)?.college_name}
                              </SelectValue>
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
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-10 rounded-xl"
                          >
                            {isSavingCollege ? 'Saving...' : 'Save College Department'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Athlete Dashboard Link</p>
                      <Button 
                        variant="outline" 
                        className="w-full mt-1.5 font-bold uppercase text-xs h-10 rounded-xl justify-between border-slate-200 dark:border-white/10"
                        onClick={() => navigate('/player')}
                      >
                        <span>Open Athlete Dashboard</span>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Verification Clearance Status Card */}
                <Card className="border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader className="p-6 pb-4">
                    <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight flex items-start gap-2.5">
                      <ShieldCheck className="size-5 text-orange-500 shrink-0 mt-0.5" />
                      <span>Eligibility Clearance</span>
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      PSU Athlete Official Authorization
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    {isVerified ? (
                      <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500 text-white rounded-xl">
                            <CheckCircle2 className="size-5" />
                          </div>
                          <div>
                            <h4 className="font-bold uppercase tracking-tight text-sm">Verified Athlete</h4>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-normal">
                              Your PSU student athlete status is active and approved for tournament competition.
                            </p>
                          </div>
                        </div>
                        {profile?.student_number && (
                          <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-500/20 text-xs flex justify-between">
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300">Student ID:</span>
                            <span className="font-black text-emerald-950 dark:text-white">{profile.student_number}</span>
                          </div>
                        )}
                      </div>
                    ) : hasPendingDoc ? (
                      <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500 text-white rounded-xl">
                            <Clock className="size-5 animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-bold uppercase tracking-tight text-sm">Clearance Under Review</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-normal">
                              Your submitted Certificate of Registration is awaiting administrative approval.
                            </p>
                          </div>
                        </div>
                        {latestVerificationDoc?.confidence_score !== undefined && latestVerificationDoc?.confidence_score !== null && (
                          <div className="pt-2 border-t border-amber-200/60 dark:border-amber-500/20 text-xs flex justify-between">
                            <span className="font-semibold text-amber-800 dark:text-amber-300">Parse Confidence:</span>
                            <span className="font-black text-amber-950 dark:text-white">{latestVerificationDoc.confidence_score}%</span>
                          </div>
                        )}
                      </div>
                    ) : latestVerificationDoc?.status === 'Rejected' ? (
                      <div className="space-y-4">
                        <div className="p-4 sm:p-5 rounded-2xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 text-red-950 dark:text-red-200 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-red-500 text-white rounded-xl shrink-0 mt-0.5">
                              <XCircle className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <Badge className="bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider mb-0.5">
                                Re-Verification Needed
                              </Badge>
                              <h4 className="font-bold uppercase tracking-tight text-sm text-red-600 dark:text-red-400 break-words">
                                Previous Clearance Rejected
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]">
                                Reason: <strong className="text-red-700 dark:text-red-300 font-bold break-words [overflow-wrap:anywhere]">{latestVerificationDoc.rejection_reason || 'Document could not be verified.'}</strong>
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="pt-1">
                          <Button
                            onClick={() => navigate('/player')}
                            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
                          >
                            <span>Submit Replacement Document on Dashboard</span>
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-orange-950 dark:text-orange-200 space-y-3">
                          <p className="text-xs font-normal leading-relaxed">
                            {profile?.role === 'coach'
                              ? 'Official PSU Coach / Employee ID Card photo is required for coaches to register teams and manage rosters.'
                              : profile?.role === 'player_staff' || profile?.role === 'player_faculty'
                              ? 'Official PSU Employee ID Card photo is required for faculty and staff athletes to join department rosters and enter tournament brackets.'
                              : 'Official Certificate of Registration is required for all student players to join team rosters and enter university tournament brackets.'}
                          </p>
                          <div>
                            <Button
                              onClick={() => navigate('/player')}
                              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all"
                            >
                              <span>Complete Clearance on Dashboard</span>
                              <ArrowRight className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 3. Security & Password (Direct In-Profile Reset) */}
              <ProfilePasswordChangeCard />

              {/* 3. Academic & Student Credentials (Editable for corrections) */}
              <Card className="border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="p-6 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                        Academic &amp; Enrollment Credentials
                      </CardTitle>
                      <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider mt-0.5">
                        Parsed from Certificate of Registration • Editable for Correction
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="w-fit text-[10px] font-bold uppercase tracking-wider border-orange-500/30 text-orange-600 dark:text-orange-400 shrink-0">
                      COR Data Layer
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    These academic details are automatically extracted from your official PSU Certificate of Registration. You can edit and update these details below to correct any optical document parsing errors.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="studentNumber" className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Student Number
                      </Label>
                      <Input
                        id="studentNumber"
                        placeholder="e.g. 2023-8-0284"
                        value={academicProfile.studentNumber}
                        onChange={(e) => setAcademicProfile((prev) => ({ ...prev, studentNumber: e.target.value }))}
                        className="h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="program" className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Degree Program
                      </Label>
                      <Input
                        id="program"
                        placeholder="e.g. Bachelor Of Science In Information Technology"
                        value={academicProfile.program}
                        onChange={(e) => setAcademicProfile((prev) => ({ ...prev, program: e.target.value }))}
                        className="h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="yearLevel" className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Year Level
                      </Label>
                      <Select
                        value={academicProfile.yearLevel}
                        onValueChange={(val) => setAcademicProfile((prev) => ({ ...prev, yearLevel: val || '' }))}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                          <SelectValue placeholder="Select Year Level">
                            {formatYearLevel(academicProfile.yearLevel)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {YEAR_LEVEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="age" className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Athlete Age
                      </Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="e.g. 21"
                        value={academicProfile.age}
                        onChange={(e) => setAcademicProfile((prev) => ({ ...prev, age: e.target.value }))}
                        className="h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={handleSaveAcademicProfile}
                      disabled={isSavingAcademic}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-11 px-6 rounded-xl shadow-md shadow-orange-500/20"
                    >
                      {isSavingAcademic ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" /> Saving Details...
                        </>
                      ) : (
                        'Save Academic Details'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Athletic Preferences (Preferred Sports & Primary Position) */}
              <Card className="border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="p-6 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                        Athletic &amp; Recruitment Preferences
                      </CardTitle>
                      <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider mt-0.5">
                        Visible to PSU Coaches, Scouts &amp; the Public in the Athletics Hub
                      </CardDescription>
                    </div>
                    <Badge className="w-fit bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-black uppercase shrink-0">
                      Athletics Profile
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Preferred Sports (Select all that apply)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_SPORTS.map((sport) => {
                        const isSelected = preferredSports.includes(sport);
                        const SportIcon = getSportIcon(sport);
                        return (
                          <button
                            key={sport}
                            type="button"
                            onClick={() => handleTogglePreferredSport(sport)}
                            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                                : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-orange-500/40'
                            }`}
                          >
                            <SportIcon className="size-3.5 shrink-0" />
                            <span>{sport}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-w-md">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Primary Playing Position / Specialty
                    </Label>
                    <Select
                      value={primaryPosition}
                      onValueChange={(val) => setPrimaryPosition(val || '')}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                        <SelectValue placeholder="Select Primary Position..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-64">
                        {AVAILABLE_POSITIONS.map((pos) => (
                          <SelectItem key={pos} value={pos} className="text-xs font-bold">
                            {pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <Button
                      onClick={handleSaveAthleticPreferences}
                      disabled={isSavingPreferences}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-11 px-6 rounded-xl shadow-md shadow-orange-500/20"
                    >
                      {isSavingPreferences ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" /> Saving Preferences...
                        </>
                      ) : (
                        'Save Athletic Preferences'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 4. University Legal & Governance Policies */}
              <Card className="border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="p-6 pb-3">
                  <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="size-5 text-orange-500" />
                    Legal &amp; Governance Policies
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    Official Palawan State University Sports Governance
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    PSU SportsTrack is operated under the Palawan State University Sports Department adhering to the Philippine Data Privacy Act of 2012 (RA 10173).
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/legal?tab=terms')}
                      className="text-xs font-bold rounded-xl border-slate-200 dark:border-white/10 gap-1.5"
                    >
                      <FileText className="size-3.5 text-orange-500" />
                      Terms and Conditions
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/legal?tab=privacy')}
                      className="text-xs font-bold rounded-xl border-slate-200 dark:border-white/10 gap-1.5"
                    >
                      <ShieldCheck className="size-3.5 text-emerald-500" />
                      Privacy Policy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Match Box Score Modal */}
      <MatchBoxScoreModal
        matchId={selectedBoxMatchId}
        onClose={() => setSelectedBoxMatchId(null)}
      />

      {/* Sign Out Confirmation Dialog */}
      <Dialog open={showSignOutPrompt} onOpenChange={setShowSignOutPrompt}>
        <DialogContent className="max-w-sm rounded-2xl p-6 border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
              Sign <span className="text-orange-500">Out</span>
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest mt-2">
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
