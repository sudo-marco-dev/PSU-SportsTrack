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
  Maximize2
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
    fetchUsers();
    fetchActiveMatches();
    fetchMetrics();
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
    <div className="min-h-screen bg-[#020617] text-white p-4 sm:p-8 space-y-8 select-none">
      {/* Top Header Command Strip */}
      <header className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="size-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Terminal className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400 block">
                PSU SPORTSTRACK CAPSTONE ARCHITECTURE
              </span>
              <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white">
                Developer & Capstone Command Deck
              </h1>
            </div>
            <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
              DEV SANDBOX
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-medium">
            Centralized orchestration hub for thesis defense scenarios, live WebSocket match simulation, rapid role impersonation, database inspection, and instant test state injection.
          </p>
        </div>

        {/* Header Navigation Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider gap-1.5"
          >
            <span>Admin Center</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/explorer')}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider gap-1.5"
          >
            <span>Match Center</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLockout}
            className="rounded-xl border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider gap-1.5"
            title="Reset 5-minute lockout timer from failed logins"
          >
            <ShieldAlert className="size-3.5" />
            <span>Reset Lockout</span>
          </Button>
        </div>
      </header>

      {/* Main Workbench Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-900 border border-white/10 p-1 rounded-2xl flex flex-wrap h-auto gap-1">
          <TabsTrigger
            value="scenarios"
            className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 gap-2 h-10 px-4"
          >
            <Sparkles className="size-3.5" />
            <span>Demo Scenarios</span>
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 gap-2 h-10 px-4"
          >
            <Users className="size-3.5" />
            <span>User & Stats Manager</span>
          </TabsTrigger>
          <TabsTrigger
            value="bot"
            className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 gap-2 h-10 px-4"
          >
            <Bot className="size-3.5" />
            <span>Live Match Bot Simulator</span>
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 gap-2 h-10 px-4"
          >
            <Database className="size-3.5" />
            <span>Database & Health</span>
          </TabsTrigger>
          <TabsTrigger
            value="checklist"
            className="rounded-xl font-bold text-xs uppercase tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 gap-2 h-10 px-4"
          >
            <FileCheck2 className="size-3.5" />
            <span>Capstone Defense Script</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DEMO SCENARIOS */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Scenario 1: Fresh Slate */}
            <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-slate-800 text-slate-300 border-white/10 text-[9px] font-black uppercase">
                    SCENARIO A
                  </Badge>
                  <RotateCcw className="size-4 text-slate-500" />
                </div>
                <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                  Clean Season Slate
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Wipes all test tournaments, matches, teams, and temporary records. Keeps campus colleges, clusters, and user accounts clean and ready for a fresh semester setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <Button
                  onClick={() => handleRunScenario('Clean Slate', injectCleanSlate)}
                  disabled={isScenarioLoading}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl h-11"
                >
                  {isScenarioLoading && loadingScenarioName === 'Clean Slate' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    'Inject Clean Slate'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 2: Verification Queue */}
            <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] font-black uppercase">
                    SCENARIO B
                  </Badge>
                  <FileCheck2 className="size-4 text-blue-400" />
                </div>
                <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                  Recruitment & COR Verification Queue
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Creates draft tournaments, teams, and populates the Admin Clearance queue with sample pending Certificate of Registration (COR) uploads with OCR confidence scores (95%, 80%, 45%).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-2">
                <Button
                  onClick={() => handleRunScenario('Verification Queue', injectVerificationQueue)}
                  disabled={isScenarioLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl h-11"
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
                  className="w-full text-[11px] font-bold uppercase text-blue-400 hover:text-blue-300 h-8"
                >
                  Open Verifications Desk ↗
                </Button>
              </CardContent>
            </Card>

            {/* Scenario 3: Live Halftime Match */}
            <Card className="bg-slate-900/90 border-orange-500/30 text-white rounded-2xl relative overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.1)] flex flex-col justify-between">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-orange-500 text-slate-950 font-black text-[9px] uppercase">
                    SCENARIO C • PRIMARY DEFENSE
                  </Badge>
                  <Flame className="size-4 text-orange-400 animate-pulse" />
                </div>
                <CardTitle className="text-lg font-black uppercase italic tracking-tight text-white">
                  Active Tournament & Live Halftime Match
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Injects the 4 campus squads, active bracket tree, and an ongoing Semifinals game (CAS Titans 68 vs CBA Wolves 65) with live commentary, master clock, fouls, and bronze playoff link.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-2">
                <Button
                  onClick={() => handleRunScenario('Live Halftime Match', injectLiveHalftimeMatch)}
                  disabled={isScenarioLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl h-11 shadow-lg shadow-orange-500/25"
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
                      className="border-orange-500/40 text-orange-400 bg-orange-500/10 text-[10px] font-black uppercase h-8 rounded-lg gap-1"
                    >
                      <LayoutGrid className="size-3" />
                      <span>Launch Kiosk Deck</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/match/${lastInjectedMatchId}/display`)}
                      className="border-orange-500/40 text-orange-400 bg-orange-500/10 text-[10px] font-black uppercase h-8 rounded-lg gap-1"
                    >
                      <Maximize2 className="size-3" />
                      <span>Launch Focus View</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scenario 4: Completed Championship */}
            <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl relative overflow-hidden flex flex-col justify-between">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] font-black uppercase">
                    SCENARIO D
                  </Badge>
                  <Trophy className="size-4 text-amber-400" />
                </div>
                <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                  Completed Championship & Medal Podium
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Fast-forwards tournament to completion: CAS Titans crowned Champions (Gold), CIT Knights (Silver), CBA Wolves (Bronze), and awards MVP Gold & Red Stars for the `/ranking` podium showcase.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-2">
                <Button
                  onClick={() => handleRunScenario('Championship', injectCompletedChampionship)}
                  disabled={isScenarioLoading}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl h-11"
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
                  className="w-full text-[11px] font-bold uppercase text-amber-400 hover:text-amber-300 h-8"
                >
                  Open College Medal Standings ↗
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: USER & STATS MANAGER */}
        <TabsContent value="users" className="space-y-6">
          <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl">
            <CardHeader className="p-6 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                    User Accounts & Role Permissions Ledger
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Instantly change user roles, toggle verification clearance, and modify stats without database queries.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    placeholder="Search name, email, or role..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 bg-slate-950 border-white/10 text-white text-xs rounded-xl"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-3 px-3">Athlete / Official</th>
                      <th className="py-3 px-3">Email Address</th>
                      <th className="py-3 px-3">Active Role</th>
                      <th className="py-3 px-3">Verification</th>
                      <th className="py-3 px-3 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
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
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{u.full_name || 'Anonymous User'}</span>
                              {u.id === user?.id && (
                                <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] px-1 py-0">
                                  YOU
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            {u.email || 'No email attached'}
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                              className="bg-slate-950 border border-white/15 text-white text-[11px] font-bold rounded-lg px-2 py-1 cursor-pointer focus:border-orange-500"
                            >
                              <option value="super_admin">super_admin</option>
                              <option value="dev">dev</option>
                              <option value="facilitator">facilitator</option>
                              <option value="coach">coach</option>
                              <option value="player_student">player_student</option>
                              <option value="player_faculty">player_faculty</option>
                            </select>
                          </td>
                          <td className="py-3 px-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleVerification(u.id, u.is_verified)}
                              className={`h-7 px-2 text-[10px] font-black uppercase rounded-lg border ${
                                u.is_verified
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
                              }`}
                            >
                              {u.is_verified ? 'Verified ✓' : 'Unverified ✗'}
                            </Button>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateRole(u.id, 'facilitator')}
                              className="h-7 px-2.5 text-[10px] font-bold uppercase rounded-lg border-white/10 hover:border-orange-500 text-slate-300"
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
          <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl">
            <CardHeader className="p-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                    Live Match Event Bot & WebSocket Pulse Generator
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Remotely stream live scoring events and commentary into active matches to demonstrate real-time synchronization on the Focus View and Kiosk screens.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsAutoPlayRunning(!isAutoPlayRunning)}
                  className={`h-11 px-5 rounded-xl font-black text-xs uppercase tracking-wider gap-2 ${
                    isAutoPlayRunning
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
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
            <CardContent className="p-6 pt-2 space-y-6">
              {/* Select Match */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Select Target Match to Simulate:
                </label>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeMatches.map((m) => {
                    const isSelected = selectedMatchId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMatchId(m.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-500/15 border-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                          <span className="text-orange-400">{m.tournament?.sport || 'Game'} • {m.round}</span>
                          <Badge className="bg-red-500/20 text-red-400 text-[8px] h-3.5 px-1">{m.status}</Badge>
                        </div>
                        <div className="text-sm font-black uppercase text-white truncate">
                          {m.team_a?.name || 'Team A'} ({m.team_a_score}) vs {m.team_b?.name || 'Team B'} ({m.team_b_score})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bot Simulation Actions */}
              {selectedMatchId && (
                <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Manual Play-by-Play Event Injection:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/match/${selectedMatchId}/display`)}
                        className="text-[10px] font-bold uppercase text-orange-400 h-7"
                      >
                        Open Focus View ↗
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/match/${selectedMatchId}/kiosk`)}
                        className="text-[10px] font-bold uppercase text-orange-400 h-7"
                      >
                        Open Kiosk ↗
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button
                      onClick={() => handleSimulatePlay('team_a', 2, 'Mid-range Jumper')}
                      className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-xs uppercase h-10 rounded-xl"
                    >
                      +2 Pts Team A
                    </Button>
                    <Button
                      onClick={() => handleSimulatePlay('team_a', 3, 'Corner 3-Pointer')}
                      className="bg-orange-500/25 hover:bg-orange-500/35 text-orange-200 border border-orange-500/50 font-black text-xs uppercase h-10 rounded-xl"
                    >
                      +3 Pts Team A
                    </Button>
                    <Button
                      onClick={() => handleSimulatePlay('team_b', 2, 'Driving Layup')}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs uppercase h-10 rounded-xl"
                    >
                      +2 Pts Team B
                    </Button>
                    <Button
                      onClick={() => handleSimulatePlay('team_b', 3, 'Clutch Triple')}
                      className="bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-500/50 font-black text-xs uppercase h-10 rounded-xl"
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
              <Card key={idx} className="bg-slate-900 border-white/10 text-white rounded-xl p-3 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  {m.label}
                </span>
                <span className="text-2xl font-black tabular-nums text-orange-400">
                  {m.val}
                </span>
              </Card>
            ))}
          </div>

          {/* Database Maintenance Actions */}
          <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                Database Hygiene & Sandbox Maintenance
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Execute safe maintenance actions to maintain clean relational integrity during testing.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Button
                  onClick={async () => {
                    await supabase.from('matches').update({ active_scorekeeper_id: null, lease_expires_at: null }).neq('id', '00000000-0000-0000-0000-000000000000');
                    toast.success('All active facilitator console leases cleared.');
                  }}
                  variant="outline"
                  className="h-11 rounded-xl border-white/10 hover:border-white/20 font-bold text-xs uppercase"
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
                  className="h-11 rounded-xl border-white/10 hover:border-white/20 font-bold text-xs uppercase"
                >
                  Purge Soft-Deleted
                </Button>
                <Button
                  onClick={() => {
                    fetchMetrics();
                    toast.success('Database table counts refreshed.');
                  }}
                  variant="outline"
                  className="h-11 rounded-xl border-orange-500/40 text-orange-400 bg-orange-500/10 font-black text-xs uppercase"
                >
                  Refresh Table Counts
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: CAPSTONE DEFENSE SCRIPT */}
        <TabsContent value="checklist" className="space-y-6">
          <Card className="bg-slate-900/90 border-white/10 text-white rounded-2xl">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">
                Capstone Defense Presentation Sequence
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Step-by-step walkthrough script for the academic panel evaluation with 1-click launch triggers for each system component.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
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
                  desc: 'Showcase edge-to-edge arena display with Screen Wake Lock API, live momentum runs (🔥 6-0 RUN), full timeout broadcast countdown overlay, and lower-third substitution banners.',
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
                  className="p-4 rounded-xl bg-slate-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-orange-500/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="size-8 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      {s.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-black uppercase text-white mb-0.5">{s.title}</h4>
                      <p className="text-xs text-slate-400 font-medium max-w-2xl">{s.desc}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(s.url)}
                    className="bg-slate-800 hover:bg-orange-500 hover:text-slate-950 text-white font-bold text-xs uppercase tracking-wider h-10 px-4 rounded-xl shrink-0 transition-all gap-1.5"
                  >
                    <span>{s.btn}</span>
                    <ArrowRight className="size-3.5" />
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
