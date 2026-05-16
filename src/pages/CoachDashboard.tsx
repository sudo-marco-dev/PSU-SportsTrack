import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Team = {
  id: string;
  name: string;
  status: string;
  tournament_id: string;
  created_at: string;
  tournaments: {
    name: string;
  };
};

type Player = {
  id: string;
  full_name: string;
  colleges: {
    college_name: string;
  } | null;
};

type Tournament = {
  id: string;
  name: string;
};

type RosterMember = {
  id: string;
  status: string;
  player_id: string;
  users: {
    full_name: string;
  } | null;
};

export const CoachDashboard = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);

  // Create Team Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');

  // Invite Player State
  const [invitePlayerId, setInvitePlayerId] = useState<string | null>(null);
  const [selectedTeamToInvite, setSelectedTeamToInvite] = useState('');

  // Manage Roster State
  const [manageRosterTeamId, setManageRosterTeamId] = useState<string | null>(null);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchTeams();
      fetchPlayers();
      fetchTournaments();
    }
  }, [user]);

  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    const { data, error } = await supabase
      .from('teams')
      .select('*, tournaments(name)')
      .eq('coach_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load teams: ' + error.message);
    } else {
      setTeams((data as unknown) as Team[]);
    }
    setIsLoadingTeams(false);
  };

  const fetchPlayers = async () => {
    setIsLoadingPlayers(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, is_verified, colleges(college_name)')
      .eq('role', 'Player')
      .eq('is_verified', true)
      .order('full_name', { ascending: true });

    if (error) {
      toast.error('Failed to load players: ' + error.message);
    } else {
      setPlayers((data as unknown) as Player[]);
    }
    setIsLoadingPlayers(false);
  };

  const fetchTournaments = async () => {
    const { data } = await supabase.from('tournaments').select('id, name');
    if (data) setTournaments(data as Tournament[]);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName || !selectedTournament) {
      toast.error('Please provide a team name and select a tournament.');
      return;
    }

    const { error } = await supabase.from('teams').insert({
      name: newTeamName,
      tournament_id: selectedTournament,
      coach_id: user?.id,
      status: 'Pending',
    });

    if (error) {
      toast.error('Error creating team: ' + error.message);
    } else {
      toast.success('Team created successfully.');
      setIsCreateOpen(false);
      setNewTeamName('');
      setSelectedTournament('');
      fetchTeams();
    }
  };

  const handleInvitePlayer = async () => {
    if (!invitePlayerId || !selectedTeamToInvite) {
      toast.error('Please select a team to invite the player to.');
      return;
    }

    const { error } = await supabase.from('team_roster').insert({
      team_id: selectedTeamToInvite,
      player_id: invitePlayerId,
      status: 'Pending',
    });

    if (error) {
      toast.error('Error inviting player: ' + error.message);
    } else {
      toast.success('Player invited successfully.');
      setInvitePlayerId(null);
      setSelectedTeamToInvite('');
    }
  };

  const fetchRosterMembers = async (teamId: string) => {
    setIsLoadingRoster(true);
    const { data, error } = await supabase
      .from('team_roster')
      .select('id, status, player_id, users(full_name)')
      .eq('team_id', teamId);

    if (error) {
      toast.error('Failed to load roster: ' + error.message);
    } else {
      setRosterMembers((data as unknown) as RosterMember[]);
    }
    setIsLoadingRoster(false);
  };

  const handleRemoveFromRoster = async (rosterId: string) => {
    const { error } = await supabase
      .from('team_roster')
      .delete()
      .eq('id', rosterId);

    if (error) {
      toast.error('Failed to remove player: ' + error.message);
    } else {
      toast.success('Player removed from roster.');
      if (manageRosterTeamId) fetchRosterMembers(manageRosterTeamId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200/50 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 italic uppercase">COACH <span className="text-orange-500">CENTRAL</span></h1>
          <p className="text-slate-500 font-bold opacity-70">Manage your teams and recruit top talent.</p>
        </div>
        <div className="absolute right-0 top-0 h-full w-32 bg-orange-500/5 -skew-x-12 translate-x-16" />
      </div>

      <Tabs defaultValue="my-teams" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="my-teams">My Teams</TabsTrigger>
          <TabsTrigger value="directory">Player Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="my-teams" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Formed Teams</h2>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger render={<Button>Create New Team</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Team</DialogTitle>
                  <DialogDescription>
                    Form a new team and enroll it into an upcoming tournament.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Team Name</label>
                    <Input
                      placeholder="Enter team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tournament</label>
                    <Select value={selectedTournament} onValueChange={(val) => setSelectedTournament(val || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tournament">
                          {selectedTournament && tournaments.find(t => t.id === selectedTournament)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tournaments.map((tournament) => (
                          <SelectItem key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTeam}>Create Team</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingTeams ? (
              <div className="col-span-full text-center text-muted-foreground py-12">
                Loading your teams...
              </div>
            ) : teams.length === 0 ? (
              <Card className="col-span-full bg-muted/50">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <h3 className="text-xl font-semibold mb-2">No Teams Found</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't formed any teams yet. Create a new team to get started.
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>Create New Team</Button>
                </CardContent>
              </Card>
            ) : (
              teams.map((team) => (
                <Card key={team.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                      <Badge variant={team.status === 'Approved' ? 'default' : 'secondary'}>
                        {team.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {team.tournaments?.name || 'Unknown Tournament'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-4">
                      Created {new Date(team.created_at).toLocaleDateString()}
                    </div>
                    
                    <Dialog 
                      open={manageRosterTeamId === team.id} 
                      onOpenChange={(open) => {
                        if (open) {
                          setManageRosterTeamId(team.id);
                          fetchRosterMembers(team.id);
                        } else {
                          setManageRosterTeamId(null);
                        }
                      }}
                    >
                      <DialogTrigger render={<Button variant="outline" className="w-full">Manage Roster</Button>} />
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Manage Roster: {team.name}</DialogTitle>
                          <DialogDescription>
                            View and manage players invited to this team.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="py-4">
                          {isLoadingRoster ? (
                            <p className="text-center py-4 text-muted-foreground">Loading roster...</p>
                          ) : rosterMembers.length === 0 ? (
                            <p className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
                              No players have been invited to this team yet.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {rosterMembers.map((member) => (
                                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="font-medium">
                                      {Array.isArray(member.users) ? member.users[0]?.full_name : member.users?.full_name || 'Unknown Player'}
                                    </div>
                                    <Badge 
                                      variant={
                                        member.status === 'Approved' ? 'default' : 
                                        member.status === 'Pending' ? 'secondary' : 'destructive'
                                      }
                                      className={
                                        member.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : ''
                                      }
                                    >
                                      {member.status}
                                    </Badge>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleRemoveFromRoster(member.id)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setManageRosterTeamId(null)}>Close</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="directory" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Player Directory (Verified)</h2>
            <p className="text-sm text-muted-foreground">Find and recruit eligible players for your teams.</p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingPlayers ? (
              <div className="col-span-full text-center text-muted-foreground py-12">
                Loading players...
              </div>
            ) : players.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground py-12 border border-dashed rounded-lg">
                No verified players found in the system yet.
              </div>
            ) : (
              players.map((player) => (
                <Card key={player.id} className="flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{player.full_name}</CardTitle>
                    <CardDescription>
                      {Array.isArray(player.colleges) 
                        ? player.colleges[0]?.college_name 
                        : player.colleges?.college_name || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={invitePlayerId === player.id} onOpenChange={(open) => {
                      if (open) setInvitePlayerId(player.id);
                      else { setInvitePlayerId(null); setSelectedTeamToInvite(''); }
                    }}>
                      <DialogTrigger render={<Button variant="default" size="sm" className="w-full">Invite to Team</Button>} />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite {player.full_name}</DialogTitle>
                          <DialogDescription>
                            Select one of your teams to send an invitation to this player.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Select value={selectedTeamToInvite} onValueChange={(val) => setSelectedTeamToInvite(val || '')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a team">
                                {selectedTeamToInvite && teams.find(t => t.id === selectedTeamToInvite)?.name}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {teams.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">No teams available</div>
                              ) : (
                                teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name} ({team.tournaments?.name || 'Tournament'})
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setInvitePlayerId(null)}>Cancel</Button>
                          <Button onClick={handleInvitePlayer} disabled={!selectedTeamToInvite}>
                            Send Invite
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
