import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth, type UserRole } from '@/context/AuthContext';
import {
  Terminal,
  RotateCcw,
  Sparkles,
  Users,
  ShieldAlert,
  Bot,
  Database,
  Play,
  Pause,
  Search,
  Trophy,
  ArrowRight,
  RefreshCw,
  FileCheck2,
  Flame,
  LayoutGrid,
  Maximize2,
  Check,
  X,
  ExternalLink,
  Crown,
  Medal,
  UserCheck,
  Zap,
  Activity,
  FastForward,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ExpandableIconTabs, type ExpandableTabItem } from '@/components/ui/expandable-icon-tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

import {
  injectCleanSlate,
  injectVerificationQueue,
  injectLiveHalftimeMatch,
  injectCompletedChampionship,
  injectSuperDemo,
  type ScenarioResult,
} from '@/lib/devScenarios';

import {
  PRESET_PERSONAS,
  type DevPersona,
} from '@/lib/devPersonas';

import {
  hostSingleTournament,
  hostAllBallgamesCircuit,
  OFFICIAL_BALLGAMES,
  SPORT_VENUES,
} from '@/lib/devHosting';

import {
  generateFakerUsers,
  generateClearanceQueueBatch,
} from '@/lib/devFaker';

import {
  simulateSportPlay,
  fastForwardToClutch,
  concludeMatchWithStars,
} from '@/lib/devSimulator';

import { getSportScoringProfile } from '@/lib/sportScoringRules';

type DatabaseUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_verified: boolean | null;
  college_id: string | null;
  student_number?: string | null;
  employee_id?: string | null;
  department?: string | null;
  program?: string | null;
  year_level?: string | null;
  created_at?: string;
};

type ActiveMatch = {
  id: string;
  round: string;
  status: string;
  team_a_score: number;
  team_b_score: number;
  team_a_id?: string;
  team_b_id?: string;
  next_match_id?: string | null;
  loser_next_match_id?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament: { name: string; sport: string } | null;
};

type TableMetrics = {
  tournaments: number;
  matches: number;
  teams: number;
  users: number;
  verificationDocs: number;
  events: number;
  stars: number;
};

export const DevSandbox = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    user,
    role,
    impersonatedPersona,
    impersonatePersona,
    clearImpersonation,
    isImpersonating,
    refetchProfile,
  } = useAuth();

  // Active Tab from URL query param or default to 'scenarios'
  const initialTab = searchParams.get('tab') || 'scenarios';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // Expandable Icon Tabs Config (Rule #2 Guardrail Compliant)
  const devTabs: ExpandableTabItem[] = useMemo(() => [
    { id: 'scenarios', label: 'Demo Scenarios', icon: Sparkles },
    { id: 'impersonate', label: '1-Tap Impersonate', icon: UserCheck, count: PRESET_PERSONAS.length },
    { id: 'hosting', label: 'Rapid Hosting', icon: Zap },
    { id: 'faker', label: 'Faker & Clearance', icon: Users },
    { id: 'bot', label: 'Score Simulator', icon: Bot },
    { id: 'metrics', label: 'Health & Dual Wipe', icon: Database },
    { id: 'checklist', label: 'Defense Script', icon: Activity },
  ], []);

  // Loading States
  const [isScenarioLoading, setIsScenarioLoading] = useState(false);
  const [loadingScenarioName, setLoadingScenarioName] = useState('');
  const [lastInjectedMatchId, setLastInjectedMatchId] = useState<string | null>(null);

  // Users Management & Faker State
  const [userList, setUserList] = useState<DatabaseUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Faker Generator Form State
  const [fakerRole, setFakerRole] = useState<UserRole | 'mixed'>('mixed');
  const [fakerCount, setFakerCount] = useState<number>(6);
  const [fakerConfidence, setFakerConfidence] = useState<'high' | 'medium' | 'low' | 'mixed'>('mixed');
  const [fakerWithDocs, setFakerWithDocs] = useState<boolean>(true);
  const [isGeneratingFaker, setIsGeneratingFaker] = useState(false);

  // Rapid Hosting Form State
  const [hostSport, setHostSport] = useState<string>('Basketball');
  const [hostDivision, setHostDivision] = useState<'Binturungan' | 'Inter-Collegiate' | 'Friendly'>('Inter-Collegiate');
  const [hostTeamCount, setHostTeamCount] = useState<4 | 8>(4);
  const [isHostingLoading, setIsHostingLoading] = useState(false);

  // Live Match Simulator State
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [isAutoPlayRunning, setIsAutoPlayRunning] = useState(false);
  const [isSimulatorBusy, setIsSimulatorBusy] = useState(false);

  // Hard Reset Confirmation Modal State
  const [isHardResetModalOpen, setIsHardResetModalOpen] = useState(false);
  const [hardResetConfirmText, setHardResetConfirmText] = useState('');
  const [isHardResetExecuting, setIsHardResetExecuting] = useState(false);

  // Database Metrics
  const [metrics, setMetrics] = useState<TableMetrics>({
    tournaments: 0,
    matches: 0,
    teams: 0,
    users: 0,
    verificationDocs: 0,
    events: 0,
    stars: 0,
  });

  // Fetch Users Ledger (merging DB records with authentic preset personas)
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_verified, college_id, student_number, employee_id, department, program, year_level, created_at')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      const dbUsers = Array.isArray(data) ? (data as DatabaseUser[]) : [];
      const combined = [...dbUsers];

      // Merge preset personas so the ledger is never empty even if unauthenticated
      PRESET_PERSONAS.forEach((p) => {
        if (!combined.some((u) => u.id === p.id)) {
          combined.push({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            role: p.role,
            is_verified: p.is_verified,
            college_id: p.college_id || null,
            student_number: p.student_number || null,
            employee_id: p.employee_id || null,
            department: p.department || null,
            program: p.program || null,
            year_level: p.year_level || null,
          });
        }
      });

      setUserList(combined);
    } catch (err: unknown) {
      toast.error('Failed to load users ledger: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Fetch Active Matches
  const fetchActiveMatches = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('matches')
        .select(`
          id, round, status, team_a_score, team_b_score,
          team_a_id, team_b_id, next_match_id, loser_next_match_id,
          team_a:team_a_id(name),
          team_b:team_b_id(name),
          tournament:tournament_id(name, sport)
        `)
        .order('match_time', { ascending: false })
        .limit(12);

      const matches = (data as unknown as ActiveMatch[]) || [];
      setActiveMatches(matches);
      if (matches.length > 0 && !selectedMatchId) {
        setSelectedMatchId(matches[0].id);
      }
    } catch {
      // non-fatal
    }
  }, [selectedMatchId]);

  // Fetch Table Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const [
        { count: tCount },
        { count: mCount },
        { count: tmCount },
        { count: uCount },
        { count: vCount },
        { count: eCount },
        { count: sCount },
      ] = await Promise.all([
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }),
        supabase.from('match_events').select('*', { count: 'exact', head: true }),
        supabase.from('player_stars').select('*', { count: 'exact', head: true }),
      ]);

      setMetrics({
        tournaments: tCount || 0,
        matches: mCount || 0,
        teams: tmCount || 0,
        users: uCount || 0,
        verificationDocs: vCount || 0,
        events: eCount || 0,
        stars: sCount || 0,
      });
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!mounted) return;
      await fetchUsers();
      await fetchActiveMatches();
      await fetchMetrics();
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchUsers, fetchActiveMatches, fetchMetrics]);

  // Current Selected Match
  const currentMatch = useMemo(() => {
    return activeMatches.find((m) => m.id === selectedMatchId) || activeMatches[0] || null;
  }, [activeMatches, selectedMatchId]);

  const currentSport = currentMatch?.tournament?.sport || 'Basketball';
  const currentSportProfile = useMemo(() => {
    return getSportScoringProfile(currentSport);
  }, [currentSport]);

  // Scenario Execution Handler
  const handleRunScenario = async (
    scenarioName: string,
    executor: (client: typeof supabase) => Promise<ScenarioResult>
  ) => {
    setIsScenarioLoading(true);
    setLoadingScenarioName(scenarioName);
    try {
      const res = await executor(supabase);
      if (res.success) {
        toast.success(res.message);
        if (res.liveMatchId) {
          setLastInjectedMatchId(res.liveMatchId);
          setSelectedMatchId(res.liveMatchId);
        }
        await Promise.all([fetchActiveMatches(), fetchMetrics(), fetchUsers()]);
      } else {
        toast.error('Scenario Failed: ' + (res.error || res.message));
      }
    } catch (err: unknown) {
      toast.error('Unexpected error executing scenario: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsScenarioLoading(false);
      setLoadingScenarioName('');
    }
  };

  // Safe Clean Slate (Prunes [DEV] Records Safely)
  const handleSafeCleanSlate = async () => {
    await handleRunScenario('Safe Clean Slate', (client) =>
      injectCleanSlate(client, { mode: 'safe_dev_only' })
    );
  };

  // Hard Reset Execution
  const handleExecuteHardReset = async () => {
    if (hardResetConfirmText.trim().toUpperCase() !== 'RESET') {
      toast.error('Please type "RESET" exactly to confirm database wipe.');
      return;
    }
    setIsHardResetExecuting(true);
    try {
      const res = await injectCleanSlate(supabase, { mode: 'hard_reset' });
      if (res.success) {
        toast.success(res.message);
        setIsHardResetModalOpen(false);
        setHardResetConfirmText('');
        await Promise.all([fetchActiveMatches(), fetchMetrics(), fetchUsers()]);
      } else {
        toast.error('Hard Reset Failed: ' + (res.error || res.message));
      }
    } catch (err: unknown) {
      toast.error('Unexpected error during hard reset: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsHardResetExecuting(false);
    }
  };

  // Rapid Hosting Single Tournament
  const handleHostTournament = async () => {
    setIsHostingLoading(true);
    try {
      const res = await hostSingleTournament(supabase, {
        sport: hostSport,
        division: hostDivision,
        teamCount: hostTeamCount,
      });

      if (res.success) {
        toast.success(res.message);
        if (res.liveMatchId) {
          setLastInjectedMatchId(res.liveMatchId);
          setSelectedMatchId(res.liveMatchId);
        }
        await Promise.all([fetchActiveMatches(), fetchMetrics()]);
      } else {
        toast.error('Hosting Failed: ' + (res.error || res.message));
      }
    } catch (err: unknown) {
      toast.error('Error hosting tournament: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsHostingLoading(false);
    }
  };

  // Batch Host All 9 Ballgames Circuit
  const handleBatchHostAll = async () => {
    setIsHostingLoading(true);
    try {
      const res = await hostAllBallgamesCircuit(supabase, hostDivision);
      if (res.success) {
        toast.success(res.message);
        await Promise.all([fetchActiveMatches(), fetchMetrics()]);
      } else {
        toast.error('Batch Hosting Failed: ' + (res.error || res.message));
      }
    } catch (err: unknown) {
      toast.error('Error in batch hosting: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsHostingLoading(false);
    }
  };

  // Faker Users Generator Handler
  const handleGenerateFakers = async () => {
    setIsGeneratingFaker(true);
    try {
      const res = await generateFakerUsers(supabase, {
        role: fakerRole,
        count: fakerCount,
        confidencePreset: fakerConfidence,
        autoGenerateClearanceDocs: fakerWithDocs,
      });

      if (res.success) {
        toast.success(res.message);
        await Promise.all([fetchUsers(), fetchMetrics()]);
      } else {
        toast.error('Faker Generation Failed: ' + (res.error || res.message));
      }
    } catch (err: unknown) {
      toast.error('Error generating faker users: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingFaker(false);
    }
  };

  // Quick 1-Tap Clearance Queue Preset
  const handleGenerateClearanceQueueBatch = async () => {
    setIsGeneratingFaker(true);
    try {
      const res = await generateClearanceQueueBatch(supabase);
      if (res.success) {
        toast.success(res.message);
        await Promise.all([fetchUsers(), fetchMetrics()]);
      } else {
        toast.error('Clearance Batch Failed: ' + (res.error || res.message));
      }
    } catch (err: unknown) {
      toast.error('Error generating clearance queue: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingFaker(false);
    }
  };

  // Change Role in Database Handler
  const handleUpdateRole = async (targetUserId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', targetUserId);
      if (error) throw error;
      toast.success(`User role updated to ${newRole}`);
      await fetchUsers();
      if (targetUserId === user?.id && refetchProfile) {
        await refetchProfile();
      }
    } catch (err: unknown) {
      toast.error('Failed to change role: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Toggle Verification Handler
  const handleToggleVerification = async (targetUserId: string, currentStatus: boolean | null) => {
    try {
      const nextStatus = !currentStatus;
      const { error } = await supabase.from('users').update({ is_verified: nextStatus }).eq('id', targetUserId);
      if (error) throw error;
      toast.success(`Verification status updated to ${nextStatus ? 'Verified' : 'Unverified'}`);
      await fetchUsers();
    } catch (err: unknown) {
      toast.error('Failed to toggle verification: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Clear Login Lockout Handler
  const handleClearLockout = () => {
    localStorage.removeItem('login_lockout_until');
    localStorage.removeItem('login_attempts');
    toast.success('Local login lockout timers and failed attempt counters cleared!');
  };

  // Simulate Sport Play
  const handleSimulateSportPlay = async (team: 'team_a' | 'team_b', points: number, label: string) => {
    if (!selectedMatchId) {
      toast.error('Please select an active match first');
      return;
    }
    setIsSimulatorBusy(true);
    try {
      const res = await simulateSportPlay(supabase, selectedMatchId, team, points, label, currentSport);
      if (res.success) {
        const teamName = team === 'team_a' ? currentMatch?.team_a?.name || 'Team A' : currentMatch?.team_b?.name || 'Team B';
        toast.success(`+${points} ${currentSportProfile.pointUnit} for ${teamName} (${label})`);
        await fetchActiveMatches();
      } else {
        toast.error('Simulation error: ' + res.error);
      }
    } finally {
      setIsSimulatorBusy(false);
    }
  };

  // Fast-Forward to Clutch Moments
  const handleFastForward = async (moment: 'tied' | 'match_point' | 'halftime') => {
    if (!selectedMatchId) {
      toast.error('Please select an active match first');
      return;
    }
    setIsSimulatorBusy(true);
    try {
      const res = await fastForwardToClutch(supabase, selectedMatchId, moment);
      if (res.success) {
        toast.success(res.message);
        await fetchActiveMatches();
      } else {
        toast.error('Fast-Forward Error: ' + res.error);
      }
    } finally {
      setIsSimulatorBusy(false);
    }
  };

  // Conclude Match with Stars
  const handleConcludeMatch = async (winner: 'team_a' | 'team_b' = 'team_a') => {
    if (!selectedMatchId) {
      toast.error('Please select an active match first');
      return;
    }
    setIsSimulatorBusy(true);
    try {
      const res = await concludeMatchWithStars(supabase, selectedMatchId, winner);
      if (res.success) {
        toast.success(res.message);
        await Promise.all([fetchActiveMatches(), fetchMetrics()]);
      } else {
        toast.error('Conclude Match Error: ' + res.error);
      }
    } finally {
      setIsSimulatorBusy(false);
    }
  };

  // Auto-Play Bot Effect (Sport-Aware)
  useEffect(() => {
    if (!isAutoPlayRunning || !selectedMatchId) return;

    const interval = setInterval(async () => {
      const targetMatch = activeMatches.find((m) => m.id === selectedMatchId);
      if (!targetMatch) return;

      const sportProfile = getSportScoringProfile(targetMatch.tournament?.sport);
      const randomTeam = Math.random() > 0.5 ? 'team_a' : 'team_b';
      const availableActions = sportProfile.actions.length > 0
        ? sportProfile.actions
        : [{ label: '+1', sublabel: 'Point', points: 1, actionType: 'Point', description: 'Point' }];
      const chosen = availableActions[Math.floor(Math.random() * availableActions.length)];

      await simulateSportPlay(
        supabase,
        selectedMatchId,
        randomTeam,
        chosen.points,
        chosen.sublabel,
        sportProfile.sport
      );
      fetchActiveMatches();
    }, 5500);

    return () => clearInterval(interval);
  }, [isAutoPlayRunning, selectedMatchId, activeMatches, fetchActiveMatches]);

  // Filtered Users Ledger
  const safeUserList = Array.isArray(userList) ? userList : [];
  const filteredUsers = safeUserList.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      (u.full_name?.toLowerCase().includes(q) ?? false) ||
      (u.email?.toLowerCase().includes(q) ?? false) ||
      (u.role?.toLowerCase().includes(q) ?? false) ||
      (u.student_number?.toLowerCase().includes(q) ?? false) ||
      (u.employee_id?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 relative w-full pb-10">
      {/* Top Header Command Strip - Curved Hero Banner */}
      <div className="bg-slate-950 text-white py-5 md:py-8 px-5 md:px-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden group flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Terminal className="size-4 md:size-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase">
              Developer Command Deck
            </span>
            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase tracking-wider ml-1">
              Sandbox v2.0
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none mb-2 md:mb-3">
            DEVELOPER & CAPSTONE <span className="text-orange-500">COMMAND DECK</span>
          </h1>
          <p className="text-slate-400 font-medium text-xs md:text-sm leading-relaxed max-w-2xl opacity-90">
            Centralized orchestration hub for thesis defense scenarios, 1-click persona impersonation, rapid 9-ballgame tournament hosting, role-adaptive faker generation, and sport-aware score simulation.
          </p>
        </div>

        {/* Header Navigation Shortcuts */}
        <div className="relative z-10 shrink-0 flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => navigate('/explorer')}
            variant="ghost"
            className="h-11 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
          >
            <Trophy className="size-4 text-orange-400" />
            <span>Match Center</span>
          </Button>
          <Button
            onClick={() => navigate('/ranking')}
            variant="ghost"
            className="h-11 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
          >
            <Medal className="size-4 text-amber-400" />
            <span>Leaderboard</span>
          </Button>
          <Button
            onClick={handleClearLockout}
            variant="ghost"
            className="h-11 border border-orange-500/40 hover:border-orange-500 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 hover:text-white font-black gap-2 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-sm"
            title="Reset 5-minute lockout timer from failed logins"
          >
            <ShieldAlert className="size-4 text-orange-400" />
            <span>Reset Lockout</span>
          </Button>
        </div>

        {/* Subtle Ambient Glow */}
        <div className="absolute -right-20 -top-20 size-[28rem] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none group-hover:bg-orange-500/20 transition-all duration-1000" />
      </div>

      {/* Main Workbench Tabs - Expandable Icon Tabs (AGENTS.md Rule #2 Anti-Truncation) */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="w-full overflow-x-auto pb-1 scrollbar-hide">
          <ExpandableIconTabs
            tabs={devTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            ariaLabel="Developer Workbench Tabs"
            className="w-full sm:w-auto"
          />
        </div>

        {/* TAB 1: CAPSTONE DEFENSE SHOWCASE SCENARIOS */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Scenario 1: Clean Season Slate (Safe Prune vs Hard Reset) */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase px-2.5 py-0.5">
                    DUAL WIPE CONTROLS
                  </Badge>
                  <RotateCcw className="size-4 text-slate-400" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Safe Clean Slate & Dual Wipe
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Safely prunes all [DEV] mock tournaments, matches, teams, and faker clearance documents while preserving real accounts, colleges, and production tournaments.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-2.5">
                <Button
                  onClick={handleSafeCleanSlate}
                  disabled={isScenarioLoading}
                  className="w-full bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-200 dark:bg-slate-800 dark:hover:bg-orange-950/40 dark:text-slate-200 dark:hover:text-orange-400 dark:border-slate-700 font-black text-xs uppercase tracking-wider rounded-xl h-11 transition-all shadow-sm cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Safe Clean Slate' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Clean Slate (Safe - Prune [DEV] Mock Data)'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsHardResetModalOpen(true)}
                  className="w-full border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-black uppercase h-10 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="size-3.5" />
                  <span>Hard Reset Database (Double-Confirmed Wipe)</span>
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 2: Clearance Review Queue */}
            <Card className="bg-white dark:bg-slate-900 border border-emerald-500/25 hover:border-emerald-500/40 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                    PRESET 1 • CLEARANCE REVIEW QUEUE
                  </Badge>
                  <FileCheck2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Recruitment & COR Verification Queue
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Populates the Admin Clearance queue with sample pending Certificate of Registration (COR) uploads with OCR confidence scores (95%, 80%, 45%) ready for admin approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-2.5">
                <Button
                  onClick={() => handleRunScenario('Verification Queue', injectVerificationQueue)}
                  disabled={isScenarioLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl h-11 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Verification Queue' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Clearance Review Queue'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/verifications')}
                  className="w-full text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 h-9 rounded-xl transition-colors cursor-pointer gap-1.5 flex items-center justify-center"
                >
                  <span>Open Verifications Desk</span>
                  <ExternalLink className="size-3.5" />
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 3: Courtside Halftime Thriller */}
            <Card className="bg-white dark:bg-slate-900 border-2 border-orange-500/30 hover:border-orange-500/50 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                    PRESET 2 • COURTSIDE HALFTIME THRILLER
                  </Badge>
                  <Flame className="size-4 text-orange-500" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Courtside Halftime Thriller
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Injects 4 campus squads, active bracket tree, and an ongoing Semifinals basketball clash (CAS Titans 68 vs CBA Wolves 65) ready for facilitator kiosk scoring and stadium broadcast.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-2.5">
                <Button
                  onClick={() => handleRunScenario('Live Halftime Match', injectLiveHalftimeMatch)}
                  disabled={isScenarioLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl h-11 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Live Halftime Match' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Courtside Halftime Thriller'
                  )}
                </Button>
                {lastInjectedMatchId && (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/match/${lastInjectedMatchId}/kiosk`)}
                      className="border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-xs font-black uppercase h-9 rounded-xl gap-1.5 transition-colors cursor-pointer"
                    >
                      <LayoutGrid className="size-3.5" />
                      <span>Launch Kiosk</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/match/${lastInjectedMatchId}/display`)}
                      className="border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-xs font-black uppercase h-9 rounded-xl gap-1.5 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="size-3.5" />
                      <span>Stadium Jumbotron</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scenario 4: Championship Sunday */}
            <Card className="bg-white dark:bg-slate-900 border border-amber-500/25 hover:border-amber-500/50 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                    PRESET 3 • CHAMPIONSHIP SUNDAY
                  </Badge>
                  <Trophy className="size-4 text-amber-500" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Championship Sunday & Medal Podium
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Fast-forwards tournament to completion: CAS Titans crowned Champions (Gold), CIT Knights (Silver), CBA Wolves (Bronze), and awards MVP Stars for the `/ranking` podium showcase.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-2.5">
                <Button
                  onClick={() => handleRunScenario('Championship', injectCompletedChampionship)}
                  disabled={isScenarioLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl h-11 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Championship' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Championship Sunday'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/ranking')}
                  className="w-full text-xs font-bold uppercase text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 h-9 rounded-xl transition-colors cursor-pointer gap-1.5 flex items-center justify-center"
                >
                  <span>Open Medal Leaderboards</span>
                  <ExternalLink className="size-3.5" />
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 5: Multi-Ballgame Binturungan Olympiad */}
            <Card className="md:col-span-2 bg-gradient-to-br from-orange-500/[0.04] to-amber-500/[0.06] dark:from-orange-500/[0.07] dark:to-amber-500/[0.05] bg-white dark:bg-slate-900 border-2 border-orange-500/40 hover:border-orange-500/70 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-xl transition-all">
              <CardHeader className="p-6 md:p-8 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500 text-white font-black text-[10px] uppercase px-3 py-1 rounded-md shadow-sm">
                      PRESET 4 • MULTI-BALLGAME BINTURUNGAN
                    </Badge>
                    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                      ALL 9 BALLGAMES • ALL COLLEGES
                    </Badge>
                  </div>
                  <Crown className="size-5 text-amber-500 animate-pulse" />
                </div>
                <CardTitle className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Multi-Ballgame Binturungan Olympiad
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-2 max-w-4xl">
                  Generates simultaneous multi-sport events across campus: all 9 official disciplines (Basketball, Volleyball, Soccer, Futsal, Sepak Takraw, Baseball, Softball, Pickleball, Table Tennis) with Phase 1 Elimination fixtures and Phase 2 Playoff Knockout Brackets (Quarterfinals, Semifinals, Bronze, Finals). Every squad features authentic starting lineups, bench substitutes, jerseys (#1 to #99), and assigned coaches.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-8 pt-0 space-y-4">
                <Button
                  onClick={() => handleRunScenario('Grand Binturungan Olympiad', injectSuperDemo)}
                  disabled={isScenarioLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl h-14 shadow-xl shadow-orange-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isScenarioLoading && loadingScenarioName === 'Grand Binturungan Olympiad' ? (
                    <RefreshCw className="size-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Inject Multi-Ballgame Binturungan Olympiad</span>
                    </>
                  )}
                </Button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/explorer')}
                    className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-black uppercase h-10 rounded-xl gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trophy className="size-3.5 text-orange-500" />
                    <span>Inspect Match Center Brackets</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/ranking')}
                    className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-black uppercase h-10 rounded-xl gap-1.5 transition-colors cursor-pointer"
                  >
                    <Medal className="size-3.5 text-amber-500" />
                    <span>View University Medal Standings</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => lastInjectedMatchId ? navigate(`/match/${lastInjectedMatchId}/kiosk`) : navigate('/explorer')}
                    className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-black uppercase h-10 rounded-xl gap-1.5 transition-colors cursor-pointer"
                  >
                    <LayoutGrid className="size-3.5 text-emerald-500" />
                    <span>Launch Courtside Matchroom</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: 1-CLICK INSTANT PERSONA IMPERSONATION SWITCHER */}
        <TabsContent value="impersonate" className="space-y-6">
          {/* Active Impersonation Status Bar */}
          <Card className="bg-slate-900 text-white border border-white/10 rounded-2xl md:rounded-3xl p-6 shadow-md overflow-hidden relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    Active Authentication State
                  </span>
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">
                  {isImpersonating && impersonatedPersona
                    ? `Impersonating: ${impersonatedPersona.full_name}`
                    : `Current Authenticated User: ${user?.email || 'Spectator / Dev Mode'}`}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {isImpersonating && impersonatedPersona
                    ? `Role: ${impersonatedPersona.role} • ${impersonatedPersona.persona_label} • ${impersonatedPersona.department || impersonatedPersona.college_name || 'PSU Main'}`
                    : `Active Role: ${role || 'dev'} • Synchronized with AuthContext permissions`}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {isImpersonating && (
                  <>
                    <Button
                      onClick={() => {
                        if (role === 'coach') navigate('/coach');
                        else if (role === 'super_admin') navigate('/admin');
                        else if (role === 'facilitator') navigate('/explorer');
                        else navigate('/player');
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider h-10 px-4 rounded-xl cursor-pointer"
                    >
                      Jump to Role View
                    </Button>
                    <Button
                      onClick={clearImpersonation}
                      variant="outline"
                      className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 font-black text-xs uppercase tracking-wider h-10 px-4 rounded-xl cursor-pointer"
                    >
                      Exit Impersonation
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Preset Personas Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Sparkles className="size-4 text-orange-500" />
              <span>Authentic PSU Persona Switcher (1-Tap Instant Impersonation)</span>
            </h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRESET_PERSONAS.map((persona) => {
                const isActivePersona = impersonatedPersona?.id === persona.id;
                return (
                  <Card
                    key={persona.id}
                    className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                      isActivePersona
                        ? 'border-2 border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 shadow-orange-500/10'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 border ${persona.badge_color}`}>
                          {persona.role}
                        </Badge>
                        {isActivePersona && (
                          <Badge className="bg-orange-500 text-white text-[8px] font-black uppercase px-1.5 py-0">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-black uppercase text-slate-900 dark:text-white leading-tight">
                        {persona.full_name}
                      </CardTitle>
                      <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 block mt-0.5">
                        {persona.persona_label}
                      </span>
                      <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 leading-relaxed">
                        {persona.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <Button
                        aria-label={`Impersonate ${persona.full_name}`}
                        onClick={() => impersonatePersona(persona)}
                        className={`w-full text-xs font-black uppercase tracking-wider h-10 rounded-xl transition-all cursor-pointer ${
                          isActivePersona
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-900 hover:bg-orange-500 text-white dark:bg-slate-800 dark:hover:bg-orange-500'
                        }`}
                      >
                        {isActivePersona ? (
                          <>
                            <CheckCircle2 className="size-3.5 mr-1" />
                            <span>Currently Active</span>
                          </>
                        ) : (
                          <span>Impersonate Persona</span>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: RAPID MULTI-BALLGAME TOURNAMENT HOSTING ENGINE */}
        <TabsContent value="hosting" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Rapid Hosting Configurator */}
            <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl md:rounded-3xl shadow-sm">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase">
                    R1 ENGINE
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Rapid Multi-Ballgame Tournament Hosting Engine
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                  1-click batch hosting for any of the 9 official PSU ballgames with automated collegiate & cluster squads, assigned coaches, seedings, and single-elimination bracket trees with campus venues.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-2 space-y-5">
                {/* Sport Selector (Strict 9 Ballgames Scope) */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    1. Select Official PSU Ballgame Discipline:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OFFICIAL_BALLGAMES.map((sp) => {
                      const isSelected = hostSport === sp;
                      return (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => setHostSport(sp)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-orange-500 text-white border-orange-500 font-black shadow-md shadow-orange-500/20'
                              : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:border-orange-400'
                          }`}
                        >
                          <div className="text-xs uppercase">{sp}</div>
                          <div className="text-[10px] opacity-75 truncate mt-0.5">
                            {SPORT_VENUES[sp]?.[0]?.split('-')?.[0]?.trim() || 'PSU Gym'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Division Tag & Bracket Size */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      2. Division / Category Tag:
                    </label>
                    <select
                      value={hostDivision}
                      onChange={(e) => setHostDivision(e.target.value as any)}
                      className="w-full h-11 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:border-orange-500"
                    >
                      <option value="Inter-Collegiate">Inter-Collegiate (Colleges: CAS, CBA, CEAT, etc.)</option>
                      <option value="Binturungan">Binturungan (Tribes: Apolaki, Libulan, Tala, etc.)</option>
                      <option value="Friendly">Friendly (Faculty, Staff & Alumni Squads)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      3. Playoff Bracket Tree Size:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHostTeamCount(4)}
                        className={`h-11 rounded-xl border text-xs font-black uppercase transition-all cursor-pointer ${
                          hostTeamCount === 4
                            ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                            : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-400'
                        }`}
                      >
                        4 Teams (Semis + Bronze)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHostTeamCount(8)}
                        className={`h-11 rounded-xl border text-xs font-black uppercase transition-all cursor-pointer ${
                          hostTeamCount === 8
                            ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                            : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-400'
                        }`}
                      >
                        8 Teams (Quarterfinals)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Host Single Action */}
                <Button
                  onClick={handleHostTournament}
                  disabled={isHostingLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider h-12 rounded-xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
                >
                  {isHostingLoading ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <span>Host {hostSport} Tournament ({hostDivision} • {hostTeamCount} Teams)</span>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Right: Master 9-Ballgame Circuit Batch Hosting */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-white/10 rounded-2xl md:rounded-3xl shadow-lg p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5">
                    MASTER BATCH
                  </Badge>
                  <Crown className="size-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tight text-white">
                    Host Full 9-Ballgame Circuit
                  </h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed mt-1.5">
                    1-click batch engine that simultaneously creates tournaments for all 9 official PSU ballgame disciplines with collegiate squads, assigned coaches, and synchronized brackets.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs text-slate-300">
                  <div className="font-bold text-white text-[11px] uppercase tracking-wider">
                    Official Disciplines Included:
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    1. Basketball • 2. Volleyball • 3. Soccer • 4. Futsal • 5. Sepak Takraw • 6. Baseball • 7. Softball • 8. Pickleball • 9. Table Tennis
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  onClick={handleBatchHostAll}
                  disabled={isHostingLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs uppercase tracking-wider h-12 rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
                >
                  {isHostingLoading ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <span>Batch Host All 9 Ballgames</span>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: ROLE-ADAPTIVE FAKER USER & CLEARANCE QUEUE GENERATOR */}
        <TabsContent value="faker" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Faker Controls Card */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl md:rounded-3xl shadow-sm">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase">
                    R2 GENERATOR
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Role-Adaptive Faker User Generator
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                  Batch generate realistic PSU personas across all 5 roles with Student Numbers (2024-8-XXXX) and Employee IDs (EMP-2024-XXXX).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-2 space-y-4">
                {/* Role Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Target Persona Role:
                  </label>
                  <select
                    value={fakerRole}
                    onChange={(e) => setFakerRole(e.target.value as any)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:border-orange-500"
                  >
                    <option value="mixed">Mixed Cohort (Students, Faculty, Staff, Coaches, Facilitators)</option>
                    <option value="player_student">Student Athletes (2024-8-XXXX)</option>
                    <option value="player_faculty">Faculty Athletes (EMP-2024-XXXX)</option>
                    <option value="player_staff">Staff Athletes (EMP-2024-XXXX)</option>
                    <option value="coach">Athletic Coaches</option>
                    <option value="facilitator">Courtside Facilitators / Officials</option>
                  </select>
                </div>

                {/* Batch Count */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Batch Count:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 8, 12, 20].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFakerCount(c)}
                        className={`h-10 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          fakerCount === c
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        +{c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* OCR Confidence Score Preset */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    OCR Match Confidence Score Preset:
                  </label>
                  <select
                    value={fakerConfidence}
                    onChange={(e) => setFakerConfidence(e.target.value as any)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:border-orange-500"
                  >
                    <option value="mixed">Mixed OCR Scores (95% High, 80% Med, 45% Low)</option>
                    <option value="high">High Match Confidence (95%)</option>
                    <option value="medium">Medium Match Confidence (80%)</option>
                    <option value="low">Low Mismatch Flag (45%)</option>
                  </select>
                </div>

                {/* Toggle Auto-Generate Clearance Documents */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Generate Mock Clearance Docs:
                    <span className="block text-[10px] text-slate-500 font-normal">COR PDFs & Employee IDs in Queue</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={fakerWithDocs}
                    onChange={(e) => setFakerWithDocs(e.target.checked)}
                    className="size-4 accent-orange-500 cursor-pointer"
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleGenerateFakers}
                    disabled={isGeneratingFaker}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider h-11 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isGeneratingFaker ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <span>Generate {fakerCount} Personas</span>
                    )}
                  </Button>

                  <Button
                    onClick={handleGenerateClearanceQueueBatch}
                    disabled={isGeneratingFaker}
                    variant="outline"
                    className="w-full border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-black text-xs uppercase tracking-wider h-10 rounded-xl cursor-pointer"
                  >
                    <span>1-Tap Clearance Review Batch (8 Mock Docs)</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Users Ledger Table */}
            <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="p-6 md:p-7 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                      Live User Ledger & 1-Tap Impersonate
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                      Change roles, toggle clearance verification, or immediately impersonate any ledger profile.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search name, ID, role..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10 h-10 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/80 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] font-black bg-slate-50/70 dark:bg-slate-900/50">
                    <tr>
                      <th className="py-2.5 px-3">Persona / ID</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Clearance</th>
                      <th className="py-2.5 px-3 text-right">Quick Impersonate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-orange-500" />
                          <span>Loading accounts ledger...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No users match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.slice(0, 15).map((u) => {
                        const isCurrentActive = impersonatedPersona?.id === u.id || (user?.id === u.id && !isImpersonating);
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{u.full_name || 'Anonymous User'}</span>
                                {isCurrentActive && (
                                  <Badge className="bg-orange-500 text-white text-[8px] px-1 py-0">
                                    YOU
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {u.student_number || u.employee_id || u.email || 'No ID'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[11px] font-bold rounded-lg px-2 py-1 cursor-pointer focus:border-orange-500"
                              >
                                <option value="super_admin">super_admin</option>
                                <option value="dev">dev</option>
                                <option value="facilitator">facilitator</option>
                                <option value="coach">coach</option>
                                <option value="player_student">player_student</option>
                                <option value="player_faculty">player_faculty</option>
                                <option value="player_staff">player_staff</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => handleToggleVerification(u.id, u.is_verified)}
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1 cursor-pointer ${
                                  u.is_verified
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                                }`}
                              >
                                {u.is_verified ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                                <span>{u.is_verified ? 'Verified' : 'Pending'}</span>
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const customPersona: DevPersona = {
                                    id: u.id,
                                    full_name: u.full_name || 'Ledger User',
                                    email: u.email || 'user@psu.palawan.edu.ph',
                                    role: u.role,
                                    is_verified: !!u.is_verified,
                                    college_id: u.college_id,
                                    student_number: u.student_number,
                                    employee_id: u.employee_id,
                                    department: u.department,
                                    program: u.program,
                                    year_level: u.year_level,
                                    persona_label: `${u.role.replace('player_', '')} Persona`,
                                    description: `Live ledger persona for ${u.full_name}`,
                                    badge_color: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
                                  };
                                  impersonatePersona(customPersona);
                                }}
                                className="h-7 text-[10px] font-bold uppercase rounded-lg border-slate-200 dark:border-white/10 hover:border-orange-500 hover:text-orange-600"
                              >
                                Impersonate
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 5: SPORT-AWARE LIVE SCORE SIMULATION & FAST-FORWARD ENGINE */}
        <TabsContent value="bot" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl md:rounded-3xl shadow-sm">
            <CardHeader className="p-6 md:p-7 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase">
                      R4 SIMULATOR
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    Sport-Aware Score Simulation & Fast-Forward Engine
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                    Respects authentic scoring rules across ballgame disciplines (Basketball quarters, Volleyball sets to 25, Soccer goals/halves, Sepak Takraw sets to 21, Table Tennis to 11).
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsAutoPlayRunning(!isAutoPlayRunning)}
                  className={`h-11 px-6 rounded-xl font-black text-xs uppercase tracking-wider gap-2 shadow-md transition-all cursor-pointer ${
                    isAutoPlayRunning
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25'
                  }`}
                >
                  {isAutoPlayRunning ? (
                    <>
                      <Pause className="size-4" />
                      <span>Pause Auto-Bot</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      <span>Start Auto-Play Bot (5.5s Tick)</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 md:p-7 pt-2 space-y-6">
              {/* Select Active Match */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Select Target Match to Simulate:
                </label>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeMatches.map((m) => {
                    const isSelected = selectedMatchId === m.id;
                    const sportLabel = m.tournament?.sport || 'Ball Game';
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMatchId(m.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-500/10 dark:bg-orange-500/15 border-2 border-orange-500 text-slate-900 dark:text-white shadow-md shadow-orange-500/10'
                            : 'bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1.5">
                          <span className="text-orange-600 dark:text-orange-400">{sportLabel} • {m.round}</span>
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[8px] h-3.5 px-1 font-bold">{m.status}</Badge>
                        </div>
                        <div className="text-sm font-black uppercase text-slate-900 dark:text-white truncate">
                          {m.team_a?.name || 'Team A'} ({m.team_a_score}) vs {m.team_b?.name || 'Team B'} ({m.team_b_score})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Match Simulation Deck */}
              {currentMatch && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase">
                          {currentSport} PROFILE
                        </Badge>
                        <span className="text-xs font-bold text-slate-500">
                          Unit: {currentSportProfile.pointUnit} • Active Periods: {currentSportProfile.periods.join(', ')}
                        </span>
                      </div>
                      <h4 className="text-base font-black uppercase text-slate-900 dark:text-white mt-1">
                        {currentMatch.team_a?.name || 'Team A'} ({currentMatch.team_a_score}) vs {currentMatch.team_b?.name || 'Team B'} ({currentMatch.team_b_score})
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/match/${currentMatch.id}/display`)}
                        className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 h-8 rounded-xl gap-1.5 flex items-center"
                      >
                        <span>Focus View</span>
                        <ExternalLink className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/match/${currentMatch.id}/kiosk`)}
                        className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 h-8 rounded-xl gap-1.5 flex items-center"
                      >
                        <span>Courtside Kiosk</span>
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Section 1: Sport-Specific Single-Play Buttons */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      Single-Play Step Injection ({currentSport}):
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Team A Actions */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-black uppercase text-orange-600 dark:text-orange-400 truncate">
                          {currentMatch.team_a?.name || 'Team A'} (+Score)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {currentSportProfile.actions.map((act, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              disabled={isSimulatorBusy}
                              onClick={() => handleSimulateSportPlay('team_a', act.points, act.sublabel)}
                              className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase h-9 rounded-lg px-3 cursor-pointer"
                            >
                              +{act.points} {act.sublabel}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Team B Actions */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-black uppercase text-cyan-600 dark:text-cyan-400 truncate">
                          {currentMatch.team_b?.name || 'Team B'} (+Score)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {currentSportProfile.actions.map((act, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              disabled={isSimulatorBusy}
                              onClick={() => handleSimulateSportPlay('team_b', act.points, act.sublabel)}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs uppercase h-9 rounded-lg px-3 cursor-pointer"
                            >
                              +{act.points} {act.sublabel}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Fast-Forward to Clutch Moments */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      Fast-Forward Clutch Moments:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <Button
                        variant="outline"
                        disabled={isSimulatorBusy}
                        onClick={() => handleFastForward('tied')}
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:border-orange-500 text-slate-800 dark:text-slate-200 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FastForward className="size-4 text-orange-500" />
                        <span>Clutch Tied Game</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSimulatorBusy}
                        onClick={() => handleFastForward('match_point')}
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:border-amber-500 text-slate-800 dark:text-slate-200 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="size-4 text-amber-500" />
                        <span>Match Point Lead</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSimulatorBusy}
                        onClick={() => handleFastForward('halftime')}
                        className="h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:border-blue-500 text-slate-800 dark:text-slate-200 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Activity className="size-4 text-blue-500" />
                        <span>Halftime Interval</span>
                      </Button>
                    </div>
                  </div>

                  {/* Section 3: Full Game Completion with Box Score & Stars */}
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      Match Conclusion & Bracket Advancement:
                    </span>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Button
                        disabled={isSimulatorBusy}
                        onClick={() => handleConcludeMatch('team_a')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase h-11 rounded-xl transition-all cursor-pointer"
                      >
                        Conclude Match: {currentMatch.team_a?.name || 'Team A'} Wins + MVP Stars
                      </Button>
                      <Button
                        disabled={isSimulatorBusy}
                        onClick={() => handleConcludeMatch('team_b')}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase h-11 rounded-xl transition-all cursor-pointer"
                      >
                        Conclude Match: {currentMatch.team_b?.name || 'Team B'} Wins + MVP Stars
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: DATABASE HEALTH & DUAL WIPE CONTROLS */}
        <TabsContent value="metrics" className="space-y-6">
          {/* Table Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Tournaments', val: metrics.tournaments },
              { label: 'Matches', val: metrics.matches },
              { label: 'Teams', val: metrics.teams },
              { label: 'Users', val: metrics.users },
              { label: 'COR Docs', val: metrics.verificationDocs },
              { label: 'Events', val: metrics.events },
              { label: 'MVP Stars', val: metrics.stars },
            ].map((m, idx) => (
              <Card key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-center rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  {m.label}
                </span>
                <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                  {m.val}
                </span>
              </Card>
            ))}
          </div>

          {/* Dual Wipe & Maintenance Controls */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl md:rounded-3xl shadow-sm">
            <CardHeader className="p-6 md:p-7 pb-4">
              <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                Database Hygiene & Dual Wipe Controls
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Execute safe scoped maintenance actions or double-confirmed hard reset wipes for test lifecycle control.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-7 pt-0 space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Button
                  onClick={async () => {
                    try {
                      await (supabase.rpc as any)('reset_login_rate_limit');
                      localStorage.removeItem('login_lockout_until');
                      localStorage.removeItem('login_attempts');
                      Object.keys(localStorage).forEach((k) => {
                        if (k.startsWith('psu_lockout_') || k.startsWith('psu_attempts_')) {
                          localStorage.removeItem(k);
                        }
                      });
                      toast.success('Login rate limits and account lockouts cleared.');
                    } catch (err: any) {
                      toast.error('Failed to clear rate limits: ' + (err.message || 'Unknown error'));
                    }
                  }}
                  variant="outline"
                  className="h-12 rounded-xl border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 font-bold text-xs uppercase cursor-pointer"
                >
                  Reset Rate Limits
                </Button>
                <Button
                  onClick={async () => {
                    await supabase.from('matches').update({ active_scorekeeper_id: null, lease_expires_at: null }).neq('id', '00000000-0000-0000-0000-000000000000');
                    toast.success('All active facilitator console leases cleared.');
                  }}
                  variant="outline"
                  className="h-12 rounded-xl border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white font-bold text-xs uppercase cursor-pointer"
                >
                  Clear Stale Leases
                </Button>
                <Button
                  onClick={async () => {
                    await supabase.from('tournaments').delete().eq('is_deleted', true);
                    toast.success('Soft-deleted recovery pool purged.');
                    fetchMetrics();
                  }}
                  variant="outline"
                  className="h-12 rounded-xl border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white font-bold text-xs uppercase cursor-pointer"
                >
                  Purge Soft-Deleted
                </Button>
                <Button
                  onClick={handleSafeCleanSlate}
                  variant="outline"
                  className="h-12 rounded-xl border border-orange-500/30 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/20 font-black text-xs uppercase cursor-pointer"
                >
                  Clean Slate (Safe Scoped)
                </Button>
                <Button
                  onClick={() => setIsHardResetModalOpen(true)}
                  className="h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase cursor-pointer shadow-md"
                >
                  Hard Reset (Complete Wipe)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: CAPSTONE DEFENSE WALKTHROUGH SCRIPT */}
        <TabsContent value="checklist" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl md:rounded-3xl shadow-sm">
            <CardHeader className="p-6 md:p-7 pb-4">
              <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                Capstone Defense Presentation Sequence
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Step-by-step walkthrough script for the academic panel evaluation with 1-click launch triggers for each system component.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-7 pt-0 space-y-4">
              {[
                {
                  step: '01',
                  title: 'Athlete Eligibility & COR Verification Engine',
                  desc: 'Demonstrate athlete Certificate of Registration upload, in-browser PDF.js Canvas viewer, corporate student email regex validation, and administrative approval decisions.',
                  url: '/admin/verifications',
                  btn: 'Open Verifications Desk',
                },
                {
                  step: '02',
                  title: 'Dual-Mode Tournament & Bracket Generator',
                  desc: 'Showcase multi-sport collegiate tournaments, automatic single-elimination bracket calculation, and automated 3rd-place (Bronze medal) bracket linking.',
                  url: '/admin/tournaments',
                  btn: 'Open Tournament Arena',
                },
                {
                  step: '03',
                  title: 'Coach Squad Roster & Game-Day Lineups',
                  desc: 'Present coach team invitations, starting lineup selection (Starters vs Bench), uniform jersey assignments, and game-day availability checks.',
                  url: '/coach/teams',
                  btn: 'Open Coach Roster Deck',
                },
                {
                  step: '04',
                  title: 'Tactile Courtside Facilitator Kiosk Mode',
                  desc: 'Demonstrate the Stream Deck style courtside scoring console on mobile/tablet viewports, zero-scroll snapping, 2-tap subs, master clock auto-pause on timeout, and audio sirens.',
                  url: lastInjectedMatchId ? `/match/${lastInjectedMatchId}/kiosk` : '/explorer',
                  btn: 'Launch Courtside Kiosk',
                },
                {
                  step: '05',
                  title: 'Big-Screen Stadium Jumbotron Focus View',
                  desc: 'Showcase edge-to-edge arena display with Screen Wake Lock API, live momentum runs (6-0 RUN alerts), full timeout broadcast countdown overlay, and lower-third substitution banners.',
                  url: lastInjectedMatchId ? `/match/${lastInjectedMatchId}/display` : '/explorer',
                  btn: 'Launch Stadium Jumbotron',
                },
                {
                  step: '06',
                  title: 'College Standings & Gamified MVP Star Accolades',
                  desc: 'Conclude with university medal leaderboards (Gold, Silver, Bronze tallies), cumulative collegiate points, and per-match Red Stars vs tournament Gold Star honors.',
                  url: '/ranking',
                  btn: 'Open Medal Leaderboard',
                },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 hover:border-orange-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <span className="size-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                      {s.step}
                    </span>
                    <div>
                      <h4 className="text-sm sm:text-base font-black uppercase text-slate-900 dark:text-white mb-0.5">{s.title}</h4>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-2xl leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(s.url)}
                    className="bg-white hover:bg-orange-500 hover:text-white text-slate-800 border border-slate-200 hover:border-orange-500 dark:bg-slate-800 dark:hover:bg-orange-500 dark:text-slate-100 dark:border-slate-700 font-black text-xs uppercase tracking-wider h-11 px-5 rounded-xl shrink-0 transition-all gap-2 cursor-pointer shadow-sm"
                  >
                    <span>{s.btn}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Double-Confirmation Modal for Hard Reset */}
      <Dialog open={isHardResetModalOpen} onOpenChange={setIsHardResetModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
              <AlertTriangle className="size-5" />
              <DialogTitle className="text-lg font-black uppercase italic tracking-tight">
                Hard Reset Database Confirmation
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              This action will completely wipe all test tournaments, match fixtures, player stars, commentary logs, and mock clearance files. Colleges and root accounts are preserved. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Type <span className="font-mono text-rose-600 dark:text-rose-400 font-black">RESET</span> below to confirm:
            </p>
            <Input
              value={hardResetConfirmText}
              onChange={(e) => setHardResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="h-11 font-mono uppercase text-center tracking-widest bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-rose-500 text-sm font-bold"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsHardResetModalOpen(false);
                setHardResetConfirmText('');
              }}
              className="rounded-xl text-xs font-bold uppercase cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={hardResetConfirmText.trim().toUpperCase() !== 'RESET' || isHardResetExecuting}
              onClick={handleExecuteHardReset}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
            >
              {isHardResetExecuting ? <RefreshCw className="size-4 animate-spin" /> : 'Confirm Full Wipe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
