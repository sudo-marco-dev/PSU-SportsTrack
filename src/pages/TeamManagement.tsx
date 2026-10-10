import { useEffect, useState, useMemo } from 'react';
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
import { Users, UserPlus, ClipboardList, Star, AlertTriangle, Zap, Circle } from 'lucide-react';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { ViewToggle } from '@/components/admin/ViewToggle';

type Team = {
  id: string;
  name: string;
  status: string;
  tournament_id: string;
  created_at: string;
  tournaments: {
    name: string;
    sport?: string;
  };
};

type Player = {
  id: string;
  full_name: string;
  is_verified: boolean;
  colleges: {
    college_name: string;
  } | null;
};

type Tournament = {
  id: string;
  name: string;
  sport?: string;
  status?: string;
};

type RosterMember = {
  id: string;
  status: string;
  player_id: string;
  jersey_number?: number | null;
  position?: string | null;
  is_captain?: boolean;
  is_starter?: boolean;
  availability_status?: string;
  users: {
    full_name: string;
    colleges?: { college_name: string } | { college_name: string }[];
  } | null;
};

export const TeamManagement = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('my-teams');

  // Create Team Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');

  // Invite Player State
  const [invitePlayerId, setInvitePlayerId] = useState<string | null>(null);
  const [selectedTeamToInvite, setSelectedTeamToInvite] = useState('');

  // Manage Roster & Lineup State
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
      .select('*, tournaments(name, sport)')
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
      .select('id, full_name, is_verified, role, account_status, colleges(college_name)')
      .in('role', ['player_student', 'player_faculty', 'Player'])
      .eq('is_verified', true)
      .neq('account_status', 'inactive')
      .neq('account_status', 'soft_deleted')
      .order('full_name', { ascending: true });

    if (error) {
      toast.error('Failed to load players: ' + error.message);
    } else {
      setPlayers((data as unknown) as Player[]);
    }
    setIsLoadingPlayers(false);
  };

  const fetchTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, sport, status')
      .eq('status', 'Draft')
      .or('is_deleted.is.null,is_deleted.eq.false');
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

    const selectedTeam = teams.find(t => t.id === selectedTeamToInvite);
    // Handle both array and single object formats from Supabase joins
    const tournamentData = Array.isArray(selectedTeam?.tournaments)
      ? selectedTeam?.tournaments[0]
      : selectedTeam?.tournaments;
    const targetSport = tournamentData?.sport;

    if (targetSport) {
      // Check if player is already in a team for this sport
      const { data: existingRosters, error: checkError } = await supabase
        .from('team_roster')
        .select(`
          id,
          teams (
            tournaments (
              sport
            )
          )
        `)
        .eq('player_id', invitePlayerId)
        .neq('status', 'Rejected');

      if (checkError) {
        toast.error('Error verifying player eligibility: ' + checkError.message);
        return;
      }

      const isDuplicate = existingRosters?.some((roster: any) => {
        const teamData = Array.isArray(roster.teams) ? roster.teams[0] : roster.teams;
        const tourneyData = Array.isArray(teamData?.tournaments) ? teamData.tournaments[0] : teamData?.tournaments;
        return tourneyData?.sport === targetSport;
      });

      if (isDuplicate) {
        toast.error(`Cannot recruit: Player is already in a team for ${targetSport}.`);
        return;
      }
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
      .select('id, status, player_id, jersey_number, position, is_captain, is_starter, availability_status, users(full_name, colleges(college_name))')
      .eq('team_id', teamId);

    if (error) {
      toast.error('Failed to load roster: ' + error.message);
    } else if (data) {
      setRosterMembers((data as unknown) as RosterMember[]);
    }
    setIsLoadingRoster(false);
  };

  const handleUpdateRosterMember = async (rosterId: string, updates: Record<string, any>) => {
    try {
      const { data, error } = await supabase
        .from('team_roster')
        .update(updates)
        .eq('id', rosterId)
        .select();

      if (error) {
        toast.error('Failed to update roster: ' + error.message);
        return;
      }
      if (!data || data.length === 0) {
        toast.error('Unable to update roster: Permission denied or record not found.');
        return;
      }
      toast.success('Roster details updated.');
      setRosterMembers(prev => prev.map(m => m.id === rosterId ? { ...m, ...updates } : m));
    } catch (err: any) {
      toast.error('Update error: ' + err.message);
    }
  };

  const handleSaveJersey = async (rosterId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      await handleUpdateRosterMember(rosterId, { jersey_number: null });
      return;
    }
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < 0 || num > 99) {
      toast.error("Jersey number must be between 0 and 99.");
      return;
    }
    await handleUpdateRosterMember(rosterId, { jersey_number: num });
  };

  const handleToggleCaptain = async (member: RosterMember) => {
    await handleUpdateRosterMember(member.id, { is_captain: !member.is_captain });
  };

  const handleToggleStarter = async (member: RosterMember) => {
    await handleUpdateRosterMember(member.id, { is_starter: !member.is_starter });
  };

  const handleUpdatePosition = async (rosterId: string, position: string) => {
    await handleUpdateRosterMember(rosterId, { position });
  };

  const handleUpdateAvailability = async (rosterId: string, availability_status: string) => {
    await handleUpdateRosterMember(rosterId, { availability_status });
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

  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tournaments?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [teams, searchQuery, statusFilter]);

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const collegeName = Array.isArray(p.colleges) ? p.colleges[0]?.college_name : p.colleges?.college_name || '';
      const matchesSearch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collegeName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [players, searchQuery]);

  return (
    <div className="space-y-6 relative pb-6">
      <div className="bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-orange-500" />
              <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                Team Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
              ROSTER & <span className="text-orange-500">RECRUITMENT</span>
            </h1>
            <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
              Form your elite squad, manage rosters, and recruit verified university talent.
            </p>
          </div>
          <div className="flex gap-4 relative z-10">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger render={
                <Button size="lg" className="h-12 sm:h-14 bg-orange-500 hover:bg-orange-600 text-white font-black gap-2 px-6 sm:px-8 rounded-xl shadow-xl shadow-orange-500/20 uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-95 group">
                  <UserPlus className="size-5 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="text-sm sm:text-base">New Team</span>
                </Button>
              } />
              <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl p-6 sm:p-8 overflow-hidden">
                <DialogHeader className="min-w-0">
                  <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter truncate">Form <span className="text-orange-500">New Team</span></DialogTitle>
                  <DialogDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">
                    Enroll your squad into an official tournament.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 min-w-0">
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Team Identity</label>
                    <Input
                      placeholder="e.g., PSU Tigers"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold px-3"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 font-black text-[8px] uppercase tracking-wider border border-orange-500/20">Registration Open</span>
                      <span>Target Tournament (Draft Phase)</span>
                    </label>
                    {tournaments.length === 0 ? (
                      <div className="h-12 flex items-center gap-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-400 text-xs font-medium">
                        <AlertTriangle className="size-4 text-orange-500 shrink-0" />
                        <span>No draft tournaments available right now.</span>
                      </div>
                    ) : (
                      <Select value={selectedTournament} onValueChange={(val) => setSelectedTournament(val || '')}>
                        <SelectTrigger className="h-12 w-full min-w-0 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold px-3">
                          <SelectValue placeholder="Select a tournament">
                            {selectedTournament && (() => {
                              const tournament = (tournaments || []).find(t => t.id === selectedTournament);
                              return tournament ? `${tournament.name}${tournament.sport ? ` (${tournament.sport})` : ''}` : selectedTournament;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-w-[calc(100vw-3rem)] sm:max-w-md">
                          {tournaments.map((tournament) => (
                            <SelectItem key={tournament.id} value={tournament.id} className="rounded-lg">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="font-black text-sm truncate">{tournament.name}</span>
                                {tournament.sport && <span className="text-[10px] text-slate-400 font-medium">{tournament.sport} • Registration Open</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="h-11 sm:h-12 rounded-xl font-black uppercase tracking-wider text-xs">Cancel</Button>
                  <Button onClick={handleCreateTeam} className="h-11 sm:h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-wider text-xs sm:text-sm shadow-md shadow-orange-500/20">Launch Team</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 size-96 bg-orange-500/10 rounded-full blur-[100px]" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
        <TabsList className="w-full flex justify-start overflow-x-auto whitespace-nowrap bg-transparent border-b-2 border-slate-200 dark:border-white/10 rounded-none h-auto p-0 gap-8 scrollbar-hide mb-8">
          <TabsTrigger
            value="my-teams"
            className="shrink-0 rounded-none pb-5 text-sm font-black uppercase tracking-[0.2em] shadow-none transition-all border-b-4 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent"
          >
            My Teams
          </TabsTrigger>
          <TabsTrigger
            value="directory"
            className="shrink-0 rounded-none pb-5 text-sm font-black uppercase tracking-[0.2em] shadow-none transition-all border-b-4 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent"
          >
            Player Directory
          </TabsTrigger>
        </TabsList>

        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <DataToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterOptions={activeTab === 'my-teams' ? [
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Approved', value: 'Approved' },
            ] : []}
            searchPlaceholder={activeTab === 'my-teams' ? "Search teams..." : "Search players or colleges..."}
            actions={
              <ViewToggle view={viewMode} onViewChange={setViewMode} />
            }
          />
        </div>

        <TabsContent value="my-teams" className="space-y-6 outline-none">
          {isLoadingTeams ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Syncing Team Data...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <Card className="border-dashed border-2 py-24 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem]">
              <ClipboardList className="size-16 text-slate-300 dark:text-slate-800 mx-auto mb-6" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No teams found.</p>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team, idx) => (
                <Card key={team.id} className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4 flex flex-col justify-between min-w-0" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="min-w-0">
                    <div className={`h-2 w-full ${team.status === 'Approved' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                    <CardHeader className="p-5 sm:p-6 pb-2 min-w-0">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl group-hover:bg-orange-500 transition-colors duration-500 shrink-0">
                          <Users className="size-5 text-slate-400 group-hover:text-white transition-colors duration-500" />
                        </div>
                        <Badge className={`${team.status === 'Approved' ? 'bg-emerald-500' : 'bg-orange-500'} text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-lg shrink-0`}>
                          {team.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors truncate" title={team.name}>{team.name}</CardTitle>
                      <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1 flex items-center gap-2 truncate">
                        <span className="truncate">{team.tournaments?.name}</span>
                        {team.tournaments?.sport && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-orange-500 shrink-0">{team.tournaments.sport}</span>
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                  </div>
                  <CardContent className="p-5 sm:p-6 pt-3 mt-auto min-w-0">
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-xl font-black uppercase italic tracking-wider border-2 border-slate-100 dark:border-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300"
                      onClick={() => {
                        setManageRosterTeamId(team.id);
                        fetchRosterMembers(team.id);
                      }}
                    >
                      Manage Roster
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                    <tr>
                      <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px]">Team Name</th>
                      <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px]">Tournament</th>
                      <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px]">Status</th>
                      <th className="text-right py-4 px-8 font-black uppercase tracking-widest text-[10px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="border-b border-slate-50 dark:border-white/5 last:border-none hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors group">
                        <td className="py-4 px-8 font-black italic uppercase tracking-tighter text-lg">{team.name}</td>
                        <td className="py-4 px-8 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                          {team.tournaments?.name}
                          {team.tournaments?.sport && <span className="text-orange-500 ml-2">({team.tournaments.sport})</span>}
                        </td>
                        <td className="py-4 px-8">
                          <Badge variant={team.status === 'Approved' ? 'default' : 'secondary'} className="text-[9px] font-black uppercase tracking-tighter px-2">
                            {team.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-8 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-black uppercase italic tracking-widest text-[10px] text-orange-500 hover:text-orange-600"
                            onClick={() => {
                              setManageRosterTeamId(team.id);
                              fetchRosterMembers(team.id);
                            }}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="directory" className="space-y-6 outline-none">
          {isLoadingPlayers ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Scanning Roster Database...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <Card className="border-dashed border-2 py-24 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem]">
              <Users className="size-16 text-slate-300 dark:text-slate-800 mx-auto mb-6" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No players found.</p>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlayers.map((player, idx) => (
                <Card key={player.id} className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4 flex flex-col justify-between min-w-0" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="min-w-0">
                    <CardHeader className="p-5 sm:p-6 pb-2 min-w-0">
                      <div className="flex items-center gap-3.5 mb-3.5 min-w-0">
                        <div className="size-11 sm:size-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-orange-500 group-hover:text-white transition-all duration-500 shrink-0 shadow-sm">
                          {player.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg sm:text-xl font-black italic uppercase tracking-tighter truncate group-hover:text-orange-500 transition-colors" title={player.full_name}>{player.full_name}</CardTitle>
                          <CardDescription className="font-bold text-orange-500 uppercase text-[9px] tracking-[0.2em] mt-0.5 truncate">Verified Athlete</CardDescription>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 sm:p-3.5 border border-slate-100 dark:border-white/5 min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 italic">University</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 truncate" title={Array.isArray(player.colleges) ? player.colleges[0]?.college_name : player.colleges?.college_name || 'N/A'}>
                          {Array.isArray(player.colleges) ? player.colleges[0]?.college_name : player.colleges?.college_name || 'N/A'}
                        </p>
                      </div>
                    </CardHeader>
                  </div>
                  <CardContent className="p-5 sm:p-6 pt-3 mt-auto min-w-0">
                    <Button
                      className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      onClick={() => setInvitePlayerId(player.id)}
                    >
                      <UserPlus className="size-4" />
                      <span>Recruit Athlete</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                    <tr>
                      <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px]">Athlete Name</th>
                      <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px]">College</th>
                      <th className="text-right py-4 px-8 font-black uppercase tracking-widest text-[10px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="border-b border-slate-50 dark:border-white/5 last:border-none hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors group">
                        <td className="py-4 px-8">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-xs text-slate-500">
                              {player.full_name.charAt(0)}
                            </div>
                            <span className="font-black italic uppercase tracking-tighter text-lg">{player.full_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-8 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                          {Array.isArray(player.colleges) ? player.colleges[0]?.college_name : player.colleges?.college_name || 'N/A'}
                        </td>
                        <td className="py-4 px-8 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-black uppercase italic tracking-widest text-[10px] text-orange-500 hover:text-orange-600"
                            onClick={() => setInvitePlayerId(player.id)}
                          >
                            Recruit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={!!manageRosterTeamId} onOpenChange={(open) => !open && setManageRosterTeamId(null)}>
        <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] max-h-[88dvh] overflow-hidden rounded-3xl p-5 sm:p-8 flex flex-col min-w-0">
          <DialogHeader className="min-w-0">
            <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter truncate">Manage <span className="text-orange-500">Roster</span></DialogTitle>
            <DialogDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">View and manage players invited to this team.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1 scrollbar-hide min-w-0 flex-1">
            {isLoadingRoster ? (
              <p className="text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Retrieving Roster...</p>
            ) : rosterMembers.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-3xl border-slate-100 dark:border-white/5">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No players on roster yet.</p>
              </div>
            ) : (
              <div className="space-y-3.5 min-w-0">
                {rosterMembers.map((member) => {
                  const colleges = Array.isArray(member.users)
                    ? member.users[0]?.colleges
                    : member.users?.colleges;
                  const collegeName = Array.isArray(colleges)
                    ? colleges[0]?.college_name
                    : colleges?.college_name || 'N/A';

                  return (
                    <div key={member.id} className="p-4 sm:p-5 border-2 border-slate-100 dark:border-white/5 rounded-2xl bg-white dark:bg-slate-900 group hover:border-orange-500/30 transition-all duration-300 space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="size-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center font-black text-slate-500 group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0">
                            {((Array.isArray(member.users) ? member.users[0]?.full_name : member.users?.full_name) || '?')[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-black italic uppercase tracking-tighter text-base sm:text-lg leading-none truncate max-w-full">
                                {Array.isArray(member.users) ? member.users[0]?.full_name : member.users?.full_name || 'Unknown Player'}
                              </span>
                              {member.is_captain && (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase px-2 py-0 gap-1 shrink-0">
                                  <Star className="size-2.5 fill-amber-500" /> Captain
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate max-w-[200px]">{collegeName}</span>
                              <span className="text-slate-300">•</span>
                              <Badge
                                variant={member.status === 'Approved' ? 'default' : 'secondary'}
                                className="text-[9px] font-black uppercase px-2 py-0 shrink-0"
                              >
                                {member.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive font-black uppercase text-[10px] tracking-widest hover:bg-destructive/10 h-8 px-2.5 rounded-xl shrink-0"
                          onClick={() => handleRemoveFromRoster(member.id)}
                        >
                          Remove
                        </Button>
                      </div>

                      {/* Coach Game-Day Lineup & Jersey Operations Row */}
                      <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-white/[0.02] -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-3.5 sm:p-4 rounded-b-2xl min-w-0">
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                          {/* Stable Fixed-Width Jersey Number Input Badge - Zero Layout Shift */}
                          <div
                            className="h-8 w-20 shrink-0 flex items-center px-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500/30 transition-all shadow-sm"
                            title="Assign Jersey Number (0-99, press Enter or click outside to save)"
                          >
                            <span className="text-xs font-black text-slate-400 select-none mr-1">#</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              placeholder="--"
                              className="w-full bg-transparent text-xs font-black text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none p-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              defaultValue={member.jersey_number ?? ''}
                              key={`jersey-${member.id}-${member.jersey_number}`}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (!val && member.jersey_number !== null) {
                                  handleSaveJersey(member.id, '');
                                } else if (val && parseInt(val, 10) !== member.jersey_number) {
                                  handleSaveJersey(member.id, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </div>

                          {/* Captaincy Toggle */}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 px-2.5 rounded-lg text-xs font-bold gap-1 bg-white dark:bg-slate-900 shrink-0 transition-all ${member.is_captain ? 'bg-amber-500/10 text-amber-600 border-amber-500/40 font-black' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            onClick={() => handleToggleCaptain(member)}
                            title="Toggle Team Captaincy"
                          >
                            <Star className={`size-3 ${member.is_captain ? 'fill-amber-500 text-amber-500' : ''}`} />
                            <span>Captain</span>
                          </Button>

                          {/* Starters Toggle */}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 px-2.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 shrink-0 transition-all ${member.is_starter ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/40 font-black' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            onClick={() => handleToggleStarter(member)}
                            title="Toggle Starter vs Bench"
                          >
                            {member.is_starter ? (
                              <span className="inline-flex items-center gap-1">
                                <Zap className="size-3 fill-emerald-500 text-emerald-500" />
                                <span>Starter</span>
                              </span>
                            ) : (
                              'Bench'
                            )}
                          </Button>

                          {/* Position Selector */}
                          <Select value={member.position || 'Player'} onValueChange={(val) => val && handleUpdatePosition(member.id, val)}>
                            <SelectTrigger className="h-8 w-24 min-w-[6rem] text-xs font-bold rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
                              <SelectValue placeholder="Position" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="PG">PG</SelectItem>
                              <SelectItem value="SG">SG</SelectItem>
                              <SelectItem value="SF">SF</SelectItem>
                              <SelectItem value="PF">PF</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="Setter">Setter</SelectItem>
                              <SelectItem value="Spiker">Spiker</SelectItem>
                              <SelectItem value="Libero">Libero</SelectItem>
                              <SelectItem value="Striker">Striker</SelectItem>
                              <SelectItem value="Midfield">Midfield</SelectItem>
                              <SelectItem value="Defender">Defender</SelectItem>
                              <SelectItem value="Goalie">Goalie</SelectItem>
                              <SelectItem value="Player">Player</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Availability Selector */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status:</span>
                          <Select value={member.availability_status || 'active'} onValueChange={(val) => val && handleUpdateAvailability(member.id, val)}>
                            <SelectTrigger className={`h-8 w-28 min-w-[7rem] text-xs font-bold rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 ${member.availability_status === 'injured' ? 'text-red-500 font-black' : member.availability_status === 'benched' ? 'text-amber-500 font-bold' : 'text-emerald-600 font-bold'}`}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="active">
                                <span className="inline-flex items-center gap-1.5">
                                  <Circle className="size-2 fill-emerald-500 text-emerald-500" />
                                  <span>Active</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="benched">
                                <span className="inline-flex items-center gap-1.5">
                                  <Circle className="size-2 fill-amber-500 text-amber-500" />
                                  <span>Benched</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="injured">
                                <span className="inline-flex items-center gap-1.5">
                                  <Circle className="size-2 fill-red-500 text-red-500" />
                                  <span>Injured</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="excused">
                                <span className="inline-flex items-center gap-1.5">
                                  <Circle className="size-2 fill-slate-400 text-slate-400" />
                                  <span>Excused</span>
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="pt-3">
            <Button variant="ghost" onClick={() => setManageRosterTeamId(null)} className="h-11 sm:h-12 w-full rounded-xl font-black uppercase tracking-wider text-xs">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invitePlayerId} onOpenChange={(open) => !open && setInvitePlayerId(null)}>
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl p-6 sm:p-8 overflow-hidden min-w-0">
          <DialogHeader className="min-w-0">
            <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter truncate">Recruit <span className="text-orange-500">Athlete</span></DialogTitle>
            <DialogDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">Select a team to send an invitation to this player.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2.5 min-w-0">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Target Team</label>
            <Select value={selectedTeamToInvite} onValueChange={(val) => setSelectedTeamToInvite(val || '')}>
              <SelectTrigger className="h-12 w-full min-w-0 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold px-3">
                <SelectValue placeholder="Select one of your teams">
                  {selectedTeamToInvite && (() => {
                    const team = (teams || []).find(t => t.id === selectedTeamToInvite);
                    return team ? `${team.name} (${team.tournaments?.name || 'Tournament'}${team.tournaments?.sport ? ` - ${team.tournaments.sport}` : ''})` : selectedTeamToInvite;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl max-w-[calc(100vw-3rem)] sm:max-w-md">
                {teams.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No teams created yet</div>
                ) : (
                  teams.map((team) => (
                    <SelectItem key={team.id} value={team.id} className="rounded-lg">
                      <span className="truncate">{team.name} ({team.tournaments?.name || 'Tournament'}{team.tournaments?.sport ? ` - ${team.tournaments.sport}` : ''})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setInvitePlayerId(null); setSelectedTeamToInvite(''); }} className="h-11 sm:h-12 rounded-xl font-black uppercase tracking-wider text-xs">Cancel</Button>
            <Button onClick={handleInvitePlayer} disabled={!selectedTeamToInvite} className="h-11 sm:h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-wider text-xs sm:text-sm shadow-md shadow-orange-500/20">Send Recruitment Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
