import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Trophy, Users, CheckCircle2, XCircle, LayoutGrid, Shuffle, Plus, Star } from 'lucide-react';

type Tournament = {
  id: string;
  name: string;
  sport: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
};

type PendingTeam = {
  id: string;
  name: string;
  status: string;
  users: {
    full_name: string;
  } | null;
  tournaments: {
    name: string;
  } | null;
};

export const TournamentManagement = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  // Create Tournament State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    sport: '',
    type: 'Binturungan',
    start_date: '',
    end_date: '',
  });

  // Bracket Management State
  const [isBracketOpen, setIsBracketOpen] = useState(false);
  const [selectedTournamentForBracket, setSelectedTournamentForBracket] = useState<Tournament | null>(null);
  const [approvedTeams, setApprovedTeams] = useState<{id: string, name: string}[]>([]);
  const [existingMatches, setExistingMatches] = useState<any[]>([]);
  const [isLoadingBracket, setIsLoadingBracket] = useState(false);

  // MVP Awards State
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [tournamentPlayers, setTournamentPlayers] = useState<any[]>([]);
  const [selectedPlayerForGoldId, setSelectedPlayerForGoldId] = useState<string>('');
  const [isAwardingGold, setIsAwardingGold] = useState(false);

  // Manual Match Form
  const [manualMatch, setManualMatch] = useState({
    teamA: '',
    teamB: '',
    round: 'Round 1'
  });

  useEffect(() => {
    fetchTournaments();
    fetchPendingTeams();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      fetchTournamentPlayers(selectedTournamentId);
    }
  }, [selectedTournamentId]);

  const fetchTournaments = async () => {
    setIsLoadingTournaments(true);
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load tournaments: ' + error.message);
    } else {
      setTournaments(data as Tournament[]);
    }
    setIsLoadingTournaments(false);
  };

  const fetchPendingTeams = async () => {
    setIsLoadingTeams(true);
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, status, users(full_name), tournaments(name)')
      .eq('status', 'Pending');

    if (error) {
      toast.error('Failed to load pending teams: ' + error.message);
    } else {
      setPendingTeams((data as unknown) as PendingTeam[]);
    }
    setIsLoadingTeams(false);
  };

  const handleCreateTournament = async () => {
    if (!newTournament.name || !newTournament.sport || !newTournament.start_date || !newTournament.end_date) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const { error } = await supabase.from('tournaments').insert({
      ...newTournament,
      status: 'Draft',
    });

    if (error) {
      toast.error('Error creating tournament: ' + error.message);
    } else {
      toast.success('Tournament created successfully.');
      setIsCreateOpen(false);
      setNewTournament({
        name: '',
        sport: '',
        type: 'Binturungan',
        start_date: '',
        end_date: '',
      });
      fetchTournaments();
    }
  };

  const handleApproveTeam = async (teamId: string) => {
    const { error } = await supabase
      .from('teams')
      .update({ status: 'Approved' })
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to approve team: ' + error.message);
    } else {
      toast.success('Team approved successfully.');
      fetchPendingTeams();
    }
  };

  const handleRejectTeam = async (teamId: string) => {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to reject team: ' + error.message);
    } else {
      toast.success('Team application rejected and removed.');
      fetchPendingTeams();
    }
  };

  const fetchBracketData = async (tournamentId: string) => {
    setIsLoadingBracket(true);
    
    // Fetch Approved Teams
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .eq('status', 'Approved');
    
    if (teamsData) setApprovedTeams(teamsData);

    // Fetch Existing Matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (matchesData) {
      setExistingMatches(matchesData.map(m => ({
        ...m,
        team_a_name: Array.isArray(m.team_a) ? m.team_a[0]?.name : (m.team_a as any)?.name ?? 'TBD',
        team_b_name: Array.isArray(m.team_b) ? m.team_b[0]?.name : (m.team_b as any)?.name ?? 'BYE'
      })));
    }
    
    setIsLoadingBracket(false);
  };

  const fetchTournamentPlayers = async (tournamentId: string) => {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId);
    
    if (teamsData && teamsData.length > 0) {
      const teamIds = teamsData.map(t => t.id);
      const { data: playersData } = await supabase
        .from('team_roster')
        .select('player_id, users(full_name)')
        .in('team_id', teamIds)
        .eq('status', 'Approved');
      
      if (playersData) {
        const uniquePlayers = Array.from(new Map(playersData.map(p => [p.player_id, p])).values());
        setTournamentPlayers(uniquePlayers);
      }
    } else {
      setTournamentPlayers([]);
    }
  };

  const handleAwardGoldStar = async () => {
    if (!selectedTournamentId || !selectedPlayerForGoldId) {
      toast.error('Please select both a tournament and a player.');
      return;
    }

    setIsAwardingGold(true);
    const { error } = await supabase.from('player_stars').insert({
      player_id: selectedPlayerForGoldId,
      star_type: 'Gold',
      tournament_id: selectedTournamentId,
      awarded_by: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) {
      toast.error('Failed to award Tournament MVP: ' + error.message);
    } else {
      toast.success('Gold Star awarded to Tournament MVP!');
      setSelectedPlayerForGoldId('');
    }
    setIsAwardingGold(false);
  };

  const handleAutoGenerate = async () => {
    if (!selectedTournamentForBracket || approvedTeams.length < 2) {
      toast.error('Need at least 2 approved teams to generate a bracket.');
      return;
    }

    const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
    const matches = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      const teamA = shuffled[i];
      const teamB = shuffled[i + 1] || null;

      matches.push({
        tournament_id: selectedTournamentForBracket.id,
        team_a_id: teamA.id,
        team_b_id: teamB?.id || null,
        round: 'Round 1',
        status: 'Scheduled'
      });
    }

    const { error } = await supabase.from('matches').insert(matches);

    if (error) {
      toast.error('Failed to generate matches: ' + error.message);
    } else {
      toast.success(`Generated ${matches.length} matches for Round 1.`);
      fetchBracketData(selectedTournamentForBracket.id);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedTournamentForBracket || !manualMatch.teamA || !manualMatch.round) {
      toast.error('Please select at least Team A and specify the round.');
      return;
    }

    if (manualMatch.teamA === manualMatch.teamB) {
      toast.error('Team A and Team B cannot be the same.');
      return;
    }

    const { error } = await supabase.from('matches').insert({
      tournament_id: selectedTournamentForBracket.id,
      team_a_id: manualMatch.teamA,
      team_b_id: manualMatch.teamB || null,
      round: manualMatch.round,
      status: 'Scheduled'
    });

    if (error) {
      toast.error('Failed to create match: ' + error.message);
    } else {
      toast.success('Match created successfully.');
      setManualMatch({ teamA: '', teamB: '', round: 'Round 1' });
      fetchBracketData(selectedTournamentForBracket.id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight italic uppercase">TOURNAMENT <span className="text-orange-500">ARENA</span></h1>
          <p className="text-slate-400 font-bold opacity-80 uppercase text-xs tracking-widest">Institution-wide competitions and team enrollments.</p>
        </div>
        <div className="flex gap-3 relative z-10">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-black gap-2 px-8 rounded-full shadow-lg shadow-orange-500/20 uppercase italic tracking-wider transition-all hover:scale-105 active:scale-95">
                <Plus className="size-5" /> New Tournament
              </Button>
            } />
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase">Host <span className="text-orange-500">Tournament</span></DialogTitle>
                <DialogDescription className="font-medium text-slate-500">Define the rules and schedule for your upcoming event.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-black text-slate-400 tracking-widest">Event Name</Label>
                  <Input placeholder="e.g., PSU Intramurals 2024" value={newTournament.name} onChange={(e) => setNewTournament({...newTournament, name: e.target.value})} className="h-12 bg-slate-50 border-slate-200 focus:ring-orange-500 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400 tracking-widest">Sport</Label>
                    <Input placeholder="e.g., Basketball" value={newTournament.sport} onChange={(e) => setNewTournament({...newTournament, sport: e.target.value})} className="h-12 bg-slate-50 border-slate-200 focus:ring-orange-500 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400 tracking-widest">Format</Label>
                    <Select value={newTournament.type} onValueChange={(val) => setNewTournament({...newTournament, type: val ?? 'Binturungan'})}>
                      <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Binturungan">Binturungan</SelectItem>
                        <SelectItem value="STRASUC">STRASUC</SelectItem>
                        <SelectItem value="Faculty and Staff Friendly Games">Friendly Games</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400 tracking-widest">Start Date</Label>
                    <Input type="date" value={newTournament.start_date} onChange={(e) => setNewTournament({...newTournament, start_date: e.target.value})} className="h-12 bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black text-slate-400 tracking-widest">End Date</Label>
                    <Input type="date" value={newTournament.end_date} onChange={(e) => setNewTournament({...newTournament, end_date: e.target.value})} className="h-12 bg-slate-50 border-slate-200 rounded-xl" />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold uppercase tracking-tight">Cancel</Button>
                <Button onClick={handleCreateTournament} className="bg-orange-500 hover:bg-orange-600 rounded-xl px-8 font-black uppercase italic tracking-wider">Launch Tournament</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-orange-500/10 -skew-x-12 translate-x-32" />
      </div>

      <Tabs defaultValue="tournaments" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tournaments" className="flex items-center gap-2">
            <Trophy className="size-4" /> Tournaments
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <Users className="size-4" /> Team Approvals
            {pendingTeams.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 min-w-[1.2rem] flex justify-center">
                {pendingTeams.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mvp" className="flex items-center gap-2">
            <Star className="size-4" /> MVP Awards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Institutional Tournaments</h2>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger render={<Button>Create Tournament</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tournament</DialogTitle>
                  <DialogDescription>Setup a new sports competition for the university campuses.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input 
                        placeholder="Tournament Name" 
                        value={newTournament.name}
                        onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sport</label>
                      <Input 
                        placeholder="e.g. Basketball" 
                        value={newTournament.sport}
                        onChange={(e) => setNewTournament({...newTournament, sport: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tournament Type</label>
                    <Select 
                      value={newTournament.type} 
                      onValueChange={(val) => setNewTournament({...newTournament, type: val ?? 'Binturungan'})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Binturungan">Binturungan</SelectItem>
                        <SelectItem value="STRASUC">STRASUC</SelectItem>
                        <SelectItem value="Faculty and Staff Friendly Games">Faculty and Staff Friendly Games</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date</label>
                      <Input 
                        type="date" 
                        value={newTournament.start_date}
                        onChange={(e) => setNewTournament({...newTournament, start_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Date</label>
                      <Input 
                        type="date" 
                        value={newTournament.end_date}
                        onChange={(e) => setNewTournament({...newTournament, end_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTournament}>Create Tournament</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingTournaments ? (
              <p className="text-muted-foreground py-12 text-center col-span-full">Loading tournaments...</p>
            ) : tournaments.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center col-span-full border border-dashed rounded-lg">
                No tournaments found. Create one to get started.
              </p>
            ) : (
              tournaments.map((t) => (
                <Card key={t.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{t.name}</CardTitle>
                      <Badge variant={t.status === 'Completed' ? 'default' : 'secondary'}>{t.status}</Badge>
                    </div>
                    <CardDescription>{t.sport} • {t.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-4">
                      {new Date(t.start_date).toLocaleDateString()} - {new Date(t.end_date).toLocaleDateString()}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full flex items-center gap-2"
                      onClick={() => {
                        setSelectedTournamentForBracket(t);
                        setIsBracketOpen(true);
                        fetchBracketData(t.id);
                      }}
                    >
                      <LayoutGrid className="size-4" /> Manage Bracket
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Dialog open={isBracketOpen} onOpenChange={setIsBracketOpen}>
            <DialogContent className="sm:max-w-2xl lg:max-w-3xl overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Bracket Management: {selectedTournamentForBracket?.name}</DialogTitle>
                <DialogDescription>
                  Generate matches automatically or seed teams manually for this tournament.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-6">
                <Tabs defaultValue="auto" className="w-full flex flex-col gap-6 mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="auto" className="flex items-center gap-2">
                      <Shuffle className="size-4" /> Auto-Generate
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                      <Plus className="size-4" /> Manual Seeding
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="auto" className="space-y-4 p-1">
                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="py-6 text-center space-y-4">
                        <div className="text-3xl font-bold">{approvedTeams.length}</div>
                        <p className="text-sm text-muted-foreground">Approved Teams Available</p>
                        <Button 
                          onClick={handleAutoGenerate} 
                          disabled={approvedTeams.length < 2}
                          className="w-full"
                        >
                          Generate Round 1
                        </Button>
                        {approvedTeams.length < 2 && (
                          <p className="text-xs text-destructive">Need at least 2 approved teams.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4 p-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label>Team A</Label>
                        <Select value={manualMatch.teamA} onValueChange={(val) => setManualMatch({...manualMatch, teamA: val || ''})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Team A">
                              {manualMatch.teamA && approvedTeams.find(t => t.id === manualMatch.teamA)?.name}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(approvedTeams || []).map(team => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Team B (Optional for Bye)</Label>
                        <Select value={manualMatch.teamB} onValueChange={(val) => setManualMatch({...manualMatch, teamB: val || ''})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Team B">
                              {manualMatch.teamB && approvedTeams.find(t => t.id === manualMatch.teamB)?.name}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">- Bye -</SelectItem>
                            {(approvedTeams || []).map(team => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Round</Label>
                      <Input 
                        placeholder="e.g., Round 1" 
                        value={manualMatch.round}
                        onChange={(e) => setManualMatch({...manualMatch, round: e.target.value})}
                      />
                    </div>
                    <Button onClick={handleManualMatch} className="w-full" disabled={!manualMatch.teamA}>
                      Create Match
                    </Button>
                  </TabsContent>
                </Tabs>

                <div className="mt-8 space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Trophy className="size-4 text-primary" /> Existing Matches
                  </h3>
                  {isLoadingBracket ? (
                    <p className="text-center py-8 text-muted-foreground">Loading matches...</p>
                  ) : existingMatches.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                      No matches have been generated yet.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {(existingMatches || []).map((match) => (
                        <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm">
                          <div className="flex-1 text-center font-bold">
                            {match.team_a_name || 'TBD'}
                          </div>
                          <div className="px-4 text-xs font-bold text-muted-foreground italic">VS</div>
                          <div className="flex-1 text-center font-bold">
                            {match.team_b_name || 'BYE'}
                          </div>
                          <div className="ml-4 flex flex-col items-end gap-1">
                            <Badge variant="outline" className="text-[10px]">{match.round}</Badge>
                            <Badge variant="secondary" className="text-[10px] uppercase">{match.status}</Badge>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] px-2"
                              onClick={() => navigate(`/match/${match.id}`)}
                            >
                              Live Match Control
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBracketOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Pending Team Applications</h2>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTeams ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading applications...</TableCell>
                  </TableRow>
                ) : pendingTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No pending team applications.</TableCell>
                  </TableRow>
                ) : (
                  pendingTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApproveTeam(team.id)}
                          >
                            <CheckCircle2 className="size-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRejectTeam(team.id)}
                          >
                            <XCircle className="size-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="mvp" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Award Tournament MVP (Gold Star)</h2>
          </div>

          <Card className="max-w-2xl border-yellow-500/30 bg-yellow-50/10">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 rounded-full">
                  <Trophy className="size-6 text-yellow-600" />
                </div>
                <div>
                  <CardTitle>Gold Star Recognition</CardTitle>
                  <CardDescription>Select a tournament and its top performer to award the ultimate MVP title.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 py-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>1. Select Tournament</Label>
                  <Select value={selectedTournamentId} onValueChange={(val) => setSelectedTournamentId(val ?? '')}>
                    <SelectTrigger className="border-2 h-12">
                      <SelectValue placeholder="Select Tournament...">
                        {selectedTournamentId && (tournaments || []).find(t => t.id === selectedTournamentId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(tournaments || []).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.sport})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>2. Select Player</Label>
                  <Select 
                    value={selectedPlayerForGoldId} 
                    onValueChange={(val) => setSelectedPlayerForGoldId(val ?? '')}
                    disabled={!selectedTournamentId}
                  >
                    <SelectTrigger className="border-2 h-12">
                      <SelectValue placeholder={selectedTournamentId ? "Select Player..." : "Select tournament first"}>
                        {selectedPlayerForGoldId && (tournamentPlayers || []).find(p => p.player_id === selectedPlayerForGoldId)?.users?.full_name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(tournamentPlayers || []).length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No approved players found.</div>
                      ) : (
                        (tournamentPlayers || []).map((p: any) => (
                          <SelectItem key={p.player_id} value={p.player_id}>
                            {Array.isArray(p.users) 
                              ? p.users[0]?.full_name 
                              : p.users?.full_name ?? 'Unknown Player'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  className="w-full h-14 bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-lg gap-2 shadow-lg"
                  disabled={!selectedPlayerForGoldId || isAwardingGold}
                  onClick={handleAwardGoldStar}
                >
                  <Star className="size-6 fill-black" />
                  {isAwardingGold ? 'Processing...' : 'Award Gold Star (Tournament MVP)'}
                </Button>
                <p className="text-[10px] text-center mt-3 text-muted-foreground uppercase tracking-widest font-bold opacity-70">
                  This action is permanent and will be displayed on the player's dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
