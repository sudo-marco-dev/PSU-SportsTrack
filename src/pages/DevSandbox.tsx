import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Medal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  injectCleanSlate,
  injectVerificationQueue,
  injectLiveHalftimeMatch,
  injectCompletedChampionship,
  injectSuperDemo,
  simulateNextPlay,
} from '@/lib/devScenarios';

type DatabaseUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_verified: boolean | null;
  college_id: string | null;
  created_at?: string;
};

type ActiveMatch = {
  id: string;
  round: string;
  status: string;
  team_a_score: number;
  team_b_score: number;
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
  const { user, refetchProfile } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState('scenarios');

  // Loading States
  const [isScenarioLoading, setIsScenarioLoading] = useState(false);
  const [loadingScenarioName, setLoadingScenarioName] = useState('');
  const [lastInjectedMatchId, setLastInjectedMatchId] = useState<string | null>(null);

  // Users Management State
  const [userList, setUserList] = useState<DatabaseUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Live Match Simulator State
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [isAutoPlayRunning, setIsAutoPlayRunning] = useState(false);

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

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_verified, college_id, created_at')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUserList((data as DatabaseUser[]) || []);
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
          team_a:team_a_id(name),
          team_b:team_b_id(name),
          tournament:tournament_id(name, sport)
        `)
        .order('match_time', { ascending: false })
        .limit(10);

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

  // Scenario Execution Handler
  const handleRunScenario = async (
    scenarioName: string,
    executor: (client: typeof supabase) => Promise<{ success: boolean; message: string; liveMatchId?: string; error?: string }>
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

  // Change Role Handler
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

  // Simulate Next Play in Match
  const handleSimulatePlay = async (team: 'team_a' | 'team_b', points: number, label: string) => {
    if (!selectedMatchId) {
      toast.error('Please select an active match first');
      return;
    }
    const targetMatch = activeMatches.find((m) => m.id === selectedMatchId);
    const teamName = team === 'team_a' ? targetMatch?.team_a?.name || 'Team A' : targetMatch?.team_b?.name || 'Team B';
    const description = `[Dev Bot] ${teamName} scored ${points} points (${label})!`;

    const res = await simulateNextPlay(supabase, selectedMatchId, team, points, description);
    if (res.success) {
      toast.success(`Simulated +${points} pts for ${teamName}`);
      fetchActiveMatches();
    } else {
      toast.error('Simulation error: ' + res.error);
    }
  };

  // Auto-Play Bot Effect
  useEffect(() => {
    if (!isAutoPlayRunning || !selectedMatchId) return;

    const interval = setInterval(async () => {
      const randomTeam = Math.random() > 0.5 ? 'team_a' : 'team_b';
      const pointTypes = [
        { pts: 2, label: 'Driving Layup' },
        { pts: 3, label: 'Corner 3-Pointer' },
        { pts: 1, label: 'Free Throw' },
        { pts: 2, label: 'Fastbreak Jam' },
      ];
      const selected = pointTypes[Math.floor(Math.random() * pointTypes.length)];
      const targetMatch = activeMatches.find((m) => m.id === selectedMatchId);
      const teamName = randomTeam === 'team_a' ? targetMatch?.team_a?.name || 'Team A' : targetMatch?.team_b?.name || 'Team B';
      const desc = `[Auto-Bot] ${teamName} converted a ${selected.label} (+${selected.pts} pts)!`;

      await simulateNextPlay(supabase, selectedMatchId, randomTeam, selected.pts, desc);
      fetchActiveMatches();
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlayRunning, selectedMatchId, activeMatches, fetchActiveMatches]);

  const filteredUsers = userList.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      (u.full_name?.toLowerCase().includes(q) ?? false) ||
      (u.email?.toLowerCase().includes(q) ?? false) ||
      (u.role?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 relative w-full pb-10">
      {/* Top Header Command Strip - Curved Hero Banner Matching AdminDashboard, TournamentExplorer and Ranking */}
      <div className="bg-slate-950 text-white py-5 md:py-8 px-5 md:px-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden group flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Terminal className="size-4 md:size-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase">
              Developer Command Deck
            </span>
            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase tracking-wider ml-1">
              Sandbox
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none mb-2 md:mb-3">
            DEVELOPER & CAPSTONE <span className="text-orange-500">COMMAND DECK</span>
          </h1>
          <p className="text-slate-400 font-medium text-xs md:text-sm leading-relaxed max-w-2xl opacity-90">
            Centralized orchestration hub for thesis defense scenarios, live WebSocket match simulation, user role controls, database inspection, and instant test state injection.
          </p>
        </div>

        {/* Header Navigation Shortcuts */}
        <div className="relative z-10 shrink-0 flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => navigate('/explorer')}
            variant="ghost"
            className="h-11 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-4 rounded-xl text-xs uppercase tracking-wider group cursor-pointer"
          >
            <span>Match Center</span>
          </Button>
          <Button
            onClick={() => navigate('/ranking')}
            variant="ghost"
            className="h-11 border border-white/15 hover:border-orange-500/60 bg-white/5 hover:bg-orange-500/20 text-white hover:text-white font-bold gap-2 px-4 rounded-xl text-xs uppercase tracking-wider group cursor-pointer"
          >
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

      {/* Main Workbench Tabs - Adaptive Light/Dark Theme Bar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-1.5 rounded-2xl flex flex-wrap h-auto gap-1.5 shadow-sm">
          <TabsTrigger
            value="scenarios"
            className="rounded-xl font-black text-xs uppercase tracking-wider px-4 sm:px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20"
          >
            <Sparkles className="size-4" />
            <span>Demo Scenarios</span>
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="rounded-xl font-black text-xs uppercase tracking-wider px-4 sm:px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20"
          >
            <Users className="size-4" />
            <span>User & Stats Manager</span>
          </TabsTrigger>
          <TabsTrigger
            value="bot"
            className="rounded-xl font-black text-xs uppercase tracking-wider px-4 sm:px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20"
          >
            <Bot className="size-4" />
            <span>Live Match Bot Simulator</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="rounded-xl font-black text-xs uppercase tracking-wider px-4 sm:px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20"
          >
            <Database className="size-4" />
            <span>Database & Health</span>
          </TabsTrigger>
          <TabsTrigger
            value="checklist"
            className="rounded-xl font-black text-xs uppercase tracking-wider px-4 sm:px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20"
          >
            <Trophy className="size-4" />
            <span>Capstone Defense Script</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DEMO SCENARIOS */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Scenario 1: Fresh Slate */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase px-2.5 py-0.5">
                    SCENARIO A
                  </Badge>
                  <RotateCcw className="size-4 text-slate-400" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Clean Season Slate
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Wipes all test tournaments, matches, teams, and temporary records. Keeps campus colleges, clusters, and user accounts clean and ready for a fresh semester setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0">
                <Button
                  onClick={() => handleRunScenario('Clean Slate', injectCleanSlate)}
                  disabled={isScenarioLoading}
                  className="w-full bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-200 dark:hover:text-rose-400 dark:border-slate-700 font-black text-xs uppercase tracking-wider rounded-xl h-12 transition-all shadow-sm cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Clean Slate' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Clean Slate'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 2: Verification Queue - Emerald Clearance Standard */}
            <Card className="bg-white dark:bg-slate-900 border border-emerald-500/25 hover:border-emerald-500/40 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                    SCENARIO B
                  </Badge>
                  <FileCheck2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Recruitment & COR Verification Queue
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Creates draft tournaments, teams, and populates the Admin Clearance queue with sample pending Certificate of Registration (COR) uploads with OCR confidence scores (95%, 80%, 45%).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-3">
                <Button
                  onClick={() => handleRunScenario('Verification Queue', injectVerificationQueue)}
                  disabled={isScenarioLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl h-12 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Verification Queue' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Verification Queue'
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

            {/* Scenario 3: Live Halftime Match (Primary Thesis Defense) */}
            <Card className="bg-white dark:bg-slate-900 border-2 border-orange-500/30 hover:border-orange-500/50 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                    SCENARIO C • PRIMARY DEFENSE
                  </Badge>
                  <Flame className="size-4 text-orange-500" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Active Tournament & Live Halftime Match
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Injects the 4 campus squads, active bracket tree, and an ongoing Semifinals game (CAS Titans 68 vs CBA Wolves 65) with live commentary, master clock, fouls, and bronze playoff link.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-3">
                <Button
                  onClick={() => handleRunScenario('Live Halftime Match', injectLiveHalftimeMatch)}
                  disabled={isScenarioLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl h-12 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Live Halftime Match' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Live Halftime Match (Standard Demo)'
                  )}
                </Button>
                {lastInjectedMatchId && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/match/${lastInjectedMatchId}/kiosk`)}
                      className="border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-xs font-black uppercase h-9 rounded-xl gap-1.5 transition-colors cursor-pointer"
                    >
                      <LayoutGrid className="size-3.5" />
                      <span>Launch Kiosk Deck</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/match/${lastInjectedMatchId}/display`)}
                      className="border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-xs font-black uppercase h-9 rounded-xl gap-1.5 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="size-3.5" />
                      <span>Launch Focus View</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scenario 4: Completed Championship */}
            <Card className="bg-white dark:bg-slate-900 border border-amber-500/25 hover:border-amber-500/50 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6 md:p-7 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                    SCENARIO D
                  </Badge>
                  <Trophy className="size-4 text-amber-500" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  Completed Championship & Medal Podium
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed mt-1">
                  Fast-forwards tournament to completion: CAS Titans crowned Champions (Gold), CIT Knights (Silver), CBA Wolves (Bronze), and awards MVP Gold & Red Stars for the `/ranking` podium showcase.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 md:p-7 pt-0 space-y-3">
                <Button
                  onClick={() => handleRunScenario('Championship', injectCompletedChampionship)}
                  disabled={isScenarioLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl h-12 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  {isScenarioLoading && loadingScenarioName === 'Championship' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Completed Championship'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/ranking')}
                  className="w-full text-xs font-bold uppercase text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 h-9 rounded-xl transition-colors cursor-pointer gap-1.5 flex items-center justify-center"
                >
                  <span>Open College Medal Standings</span>
                  <ExternalLink className="size-3.5" />
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 5: The Grand Binturungan Olympiad (Master Super Demo) */}
            <Card className="md:col-span-2 bg-gradient-to-br from-orange-500/[0.04] to-amber-500/[0.06] dark:from-orange-500/[0.07] dark:to-amber-500/[0.05] bg-white dark:bg-slate-900 border-2 border-orange-500/40 hover:border-orange-500/70 rounded-2xl md:rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-xl transition-all">
              <CardHeader className="p-6 md:p-8 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500 text-white font-black text-[10px] uppercase px-3 py-1 rounded-md shadow-sm">
                      SCENARIO E • MASTER SUPER DEMO
                    </Badge>
                    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5">
                      ALL 9 SPORTS • ALL 9 COLLEGES
                    </Badge>
                  </div>
                  <Crown className="size-5 text-amber-500 animate-pulse" />
                </div>
                <CardTitle className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                  The Grand Binturungan Olympiad (Master Multi-Sport Defense Simulation)
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-2 max-w-4xl">
                  Generates the comprehensive university sports festival: all 9 official disciplines (Basketball, Volleyball, Soccer, Futsal, Sepak Takraw, Baseball, Softball, Pickleball, Table Tennis), all 9 PSU colleges, authentic sport-specific player roles (starters &amp; bench subs), jerseys (#1 to #99), and coaches. Simulates a complete 8-team single elimination tournament tree (Quarterfinals, Semifinals, 3rd-Place Bronze, and Finals) crowning <strong>CEAT Red Scorpions</strong> as Gold Champion, <strong>CS Byte Titans</strong> as Silver, and <strong>CBA Golden Wolves</strong> as Bronze with official MVP Stars.
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
                      <span>Inject Grand Binturungan Olympiad (Master All-Sport Simulation)</span>
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
                    <span>Inspect Tournament Brackets</span>
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

        {/* TAB 2: USER & STATS MANAGER */}
        <TabsContent value="users" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="p-6 md:p-7 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    User Accounts & Role Permissions Ledger
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                    Instantly change user roles, toggle verification clearance, and modify stats without database queries.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search name, email, or role..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10 h-11 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white text-xs rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-7 pt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-black bg-slate-50/70 dark:bg-slate-900/50">
                    <tr>
                      <th className="py-3.5 px-4">Athlete / Official</th>
                      <th className="py-3.5 px-4">Email Address</th>
                      <th className="py-3.5 px-4">Active Role</th>
                      <th className="py-3.5 px-4">Verification</th>
                      <th className="py-3.5 px-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-orange-500" />
                          <span>Loading accounts ledger...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No users match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{u.full_name || 'Anonymous User'}</span>
                              {u.id === user?.id && (
                                <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[9px] px-1 py-0">
                                  YOU
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            {u.email || 'No email attached'}
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer focus:border-orange-500"
                            >
                              <option value="super_admin">super_admin</option>
                              <option value="dev">dev</option>
                              <option value="facilitator">facilitator</option>
                              <option value="coach">coach</option>
                              <option value="player_student">player_student</option>
                              <option value="player_faculty">player_faculty</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleVerification(u.id, u.is_verified)}
                              className={`h-7 px-2.5 text-[10px] font-black uppercase rounded-lg border gap-1 flex items-center ${
                                u.is_verified
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                            >
                              {u.is_verified ? (
                                <>
                                  <Check className="size-3 stroke-[3]" />
                                  <span>Verified</span>
                                </>
                              ) : (
                                <>
                                  <X className="size-3 stroke-[3]" />
                                  <span>Unverified</span>
                                </>
                              )}
                            </Button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateRole(u.id, 'facilitator')}
                              className="h-7 px-3 text-[10px] font-bold uppercase rounded-lg border-slate-200 dark:border-white/10 hover:border-orange-500 text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-white hover:bg-orange-50 dark:hover:bg-orange-500/10"
                            >
                              Make Faci
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: LIVE MATCH BOT SIMULATOR */}
        <TabsContent value="bot" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl md:rounded-3xl shadow-sm">
            <CardHeader className="p-6 md:p-7 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                    Live Match Event Bot & WebSocket Pulse Generator
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                    Remotely stream live scoring events and commentary into active matches to demonstrate real-time synchronization on the Focus View and Kiosk screens.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsAutoPlayRunning(!isAutoPlayRunning)}
                  className={`h-11 px-6 rounded-xl font-black text-xs uppercase tracking-wider gap-2 shadow-md transition-all ${
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
                      <span>Start Auto-Play Bot (6s Tick)</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-7 pt-2 space-y-6">
              {/* Select Match */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Select Target Match to Simulate:
                </label>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeMatches.map((m) => {
                    const isSelected = selectedMatchId === m.id;
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
                          <span className="text-orange-600 dark:text-orange-400">{m.tournament?.sport || 'Game'} • {m.round}</span>
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

              {/* Bot Simulation Actions */}
              {selectedMatchId && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Manual Play-by-Play Event Injection:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/match/${selectedMatchId}/display`)}
                        className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 h-8 rounded-xl gap-1.5 flex items-center"
                      >
                        <span>Open Focus View</span>
                        <ExternalLink className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/match/${selectedMatchId}/kiosk`)}
                        className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 h-8 rounded-xl gap-1.5 flex items-center"
                      >
                        <span>Open Kiosk</span>
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button
                      onClick={() => handleSimulatePlay('team_a', 2, 'Mid-range Jumper')}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase h-11 rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      +2 Pts Team A
                    </Button>
                    <Button
                      onClick={() => handleSimulatePlay('team_a', 3, 'Corner 3-Pointer')}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase h-11 rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      +3 Pts Team A
                    </Button>
                    <Button
                      onClick={() => handleSimulatePlay('team_b', 2, 'Driving Layup')}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs uppercase h-11 rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      +2 Pts Team B
                    </Button>
                    <Button
                      onClick={() => handleSimulatePlay('team_b', 3, 'Clutch Triple')}
                      className="bg-cyan-700 hover:bg-cyan-800 text-white font-black text-xs uppercase h-11 rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      +3 Pts Team B
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DATABASE & HEALTH */}
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

          {/* Database Maintenance Actions */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl md:rounded-3xl shadow-sm">
            <CardHeader className="p-6 md:p-7 pb-4">
              <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                Database Hygiene & Sandbox Maintenance
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                Execute safe maintenance actions to maintain clean relational integrity during testing.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-7 pt-0 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Button
                  onClick={async () => {
                    await supabase.from('matches').update({ active_scorekeeper_id: null, lease_expires_at: null }).neq('id', '00000000-0000-0000-0000-000000000000');
                    toast.success('All active facilitator console leases cleared.');
                  }}
                  variant="outline"
                  className="h-12 rounded-xl border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs uppercase cursor-pointer"
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
                  className="h-12 rounded-xl border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs uppercase cursor-pointer"
                >
                  Purge Soft-Deleted
                </Button>
                <Button
                  onClick={() => {
                    fetchMetrics();
                    toast.success('Database table counts refreshed.');
                  }}
                  variant="outline"
                  className="h-12 rounded-xl border border-orange-500/30 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/20 font-black text-xs uppercase cursor-pointer"
                >
                  Refresh Table Counts
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: CAPSTONE DEFENSE SCRIPT */}
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
    </div>
  );
};
