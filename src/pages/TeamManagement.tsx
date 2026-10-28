import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, UserPlus, ClipboardList, Star, AlertTriangle, Zap, Circle, GraduationCap, Eye, Target, Filter, CheckCircle2, Trophy, Lock } from 'lucide-react';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { ViewToggle } from '@/components/admin/ViewToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import {
  fetchBatchPlayerSummaries,
  evaluateSquadEligibility,
  getPrimarySportStatPill,
  AVAILABLE_SPORTS,
  extractCollegeCode,
  type PlayerDirectorySummary,
} from '@/lib/playerStatsEngine';
import { getSportIcon } from '@/lib/sportIcons';
import { PlayerDossierModal } from '@/components/scouting/PlayerDossierModal';
import { MatchBoxScoreModal } from '@/components/scouting/MatchBoxScoreModal';

type Team = {
  id: string;
  name: string;
  status: string;
  is_deleted?: boolean | null;
  tournament_id: string;
  affiliation_type?: 'college' | 'cluster';
  college_id?: string | null;
  cluster_id?: string | null;
  created_at: string;
  tournaments: {
    name: string;
    sport?: string;
    status?: string;
    is_deleted?: boolean | null;
  };
  colleges?: {
    college_name: string;
  } | null;
  clusters?: {
    name: string;
  } | null;
};

type CollegeItem = {
  id: string;
  college_name: string;
};

type ClusterItem = {
  id: string;
  name: string;
  description: string;
  college_codes: string[];
};

type Player = {
  id: string;
  full_name: string;
  is_verified: boolean;
  college_id?: string | null;
  preferred_sports?: string[] | null;
  primary_position?: string | null;
  program?: string | null;
  year_level?: string | null;
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
  const { user, isVerified } = useAuth();
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
  const [affiliationType, setAffiliationType] = useState<'college' | 'cluster'>('college');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [colleges, setColleges] = useState<CollegeItem[]>([]);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);

  // Invite Player State
  const [invitePlayerId, setInvitePlayerId] = useState<string | null>(null);
  const [selectedTeamToInvite, setSelectedTeamToInvite] = useState('');

  const handleStartInvitePlayer = (playerId: string) => {
    if (!isVerified) {
      toast.error('Coach verification required to invite athletes. Please submit your Coach ID for clearance.');
      return;
    }
    setInvitePlayerId(playerId);
  };

  // Smart Recruitment Scouting Filters & Modals State
  const [playerSummaries, setPlayerSummaries] = useState<Record<string, PlayerDirectorySummary>>({});
  const [targetRecruitmentTeamId, setTargetRecruitmentTeamId] = useState<string>('all');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'eligible'>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'points' | 'ppg' | 'threes' | 'mvp' | 'name'>('points');
  const [dossierPlayerId, setDossierPlayerId] = useState<string | null>(null);
  const [boxScoreMatchId, setBoxScoreMatchId] = useState<string | null>(null);

  // Manage Roster & Lineup State
  const [manageRosterTeamId, setManageRosterTeamId] = useState<string | null>(null);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchTeams();
      fetchPlayers();
      fetchTournaments();
      fetchCollegesAndClusters();
    }
  }, [user]);

  const fetchCollegesAndClusters = async () => {
    const [colRes, clusRes] = await Promise.all([
      supabase.from('colleges').select('id, college_name').order('college_name'),
      supabase.from('clusters').select('id, name, description, college_codes').order('name')
    ]);
    if (colRes.data) setColleges(colRes.data as CollegeItem[]);
    if (clusRes.data) setClusters(clusRes.data as ClusterItem[]);
  };

  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    const { data, error } = await supabase
      .from('teams')
      .select('*, tournaments(name, sport, status, is_deleted), colleges(college_name), clusters(name)')
      .eq('coach_id', user?.id)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load teams: ' + error.message);
    } else {
      const activeTeams = ((data as unknown) as Team[]).filter((t) => {
        const tourney = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
        return !tourney?.is_deleted;
      });
      setTeams(activeTeams);
    }
    setIsLoadingTeams(false);
  };

  const fetchPlayers = async () => {
    setIsLoadingPlayers(true);
    const [usersRes, summaries] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, is_verified, role, account_status, college_id, preferred_sports, primary_position, program, year_level, colleges(college_name)')
        .in('role', ['player_student', 'player_faculty', 'player_staff', 'Player'])
        .eq('is_verified', true)
        .neq('account_status', 'inactive')
        .neq('account_status', 'soft_deleted')
        .order('full_name', { ascending: true }),
      fetchBatchPlayerSummaries(),
    ]);

    if (usersRes.error) {
      toast.error('Failed to load players: ' + usersRes.error.message);
    } else {
      setPlayers(Array.isArray(usersRes.data) ? ((usersRes.data as unknown) as Player[]) : []);
    }
    setPlayerSummaries(summaries);
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
    if (!isVerified) {
      toast.error('Coach verification required to register new teams. Please submit your Coach ID for clearance.');
      return;
    }

    if (!newTeamName.trim() || !selectedTournament) {
      toast.error('Please provide a team name and select a tournament.');
      return;
    }

    if (affiliationType === 'college' && !selectedCollegeId) {
      toast.error('Please select an affiliated PSU College for your squad.');
      return;
    }

    if (affiliationType === 'cluster' && !selectedClusterId) {
      toast.error('Please select an affiliated Binturungan Tribe / Cluster.');
      return;
    }

    const { error } = await supabase.from('teams').insert({
      name: newTeamName.trim(),
      tournament_id: selectedTournament,
      coach_id: user?.id,
      status: 'Pending',
      affiliation_type: affiliationType,
      college_id: affiliationType === 'college' ? selectedCollegeId : null,
      cluster_id: affiliationType === 'cluster' ? selectedClusterId : null,
    });

    if (error) {
      toast.error('Error creating team: ' + error.message);
    } else {
      toast.success('Team created successfully and submitted for facilitator review.');
      setIsCreateOpen(false);
      setNewTeamName('');
      setSelectedTournament('');
      setSelectedCollegeId('');
      setSelectedClusterId('');
      setAffiliationType('college');
      fetchTeams();
    }
  };

  const handleInvitePlayer = async () => {
    if (!isVerified) {
      toast.error('Coach verification required to recruit or invite players. Please submit your Coach ID for clearance.');
      return;
    }

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
      // Check if player is already invited to this exact team or approved in another active team for this sport
      const { data: existingRosters, error: checkError } = await supabase
        .from('team_roster')
        .select(`
          id,
          team_id,
          status,
          teams (
            id,
            name,
            status,
            is_deleted,
            tournaments (
              id,
              sport,
              status,
              is_deleted
            )
          )
        `)
        .eq('player_id', invitePlayerId)
        .neq('status', 'Rejected');

      if (checkError) {
        toast.error('Error verifying player eligibility: ' + checkError.message);
        return;
      }

      const alreadyOnSameTeam = existingRosters?.some(
        (roster: any) => roster.team_id === selectedTeamToInvite
      );
      if (alreadyOnSameTeam) {
        toast.error('This player has already been invited to or is already on this squad.');
        return;
      }

      const isDuplicate = existingRosters?.some((roster: any) => {
        if (roster.status !== 'Approved') return false;
        const teamData = Array.isArray(roster.teams) ? roster.teams[0] : roster.teams;
        if (!teamData || teamData.is_deleted || teamData.status === 'Rejected') return false;
        const tourneyData = Array.isArray(teamData?.tournaments) ? teamData.tournaments[0] : teamData?.tournaments;
        if (!tourneyData || tourneyData.is_deleted || tourneyData.status === 'Completed') return false;
        return tourneyData.sport === targetSport;
      });

      if (isDuplicate) {
        toast.error(`Cannot recruit: Player is already an approved roster member on an active ${targetSport} squad.`);
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
    if (!isVerified) {
      toast.error('Coach verification required to modify rosters.');
      return;
    }
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
    if (!isVerified) {
      toast.error('Coach verification required to modify rosters.');
      return;
    }
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

  const targetRecruitmentTeam = useMemo(() => {
    if (!targetRecruitmentTeamId || targetRecruitmentTeamId === 'all') return null;
    return teams.find((t) => t.id === targetRecruitmentTeamId) || null;
  }, [teams, targetRecruitmentTeamId]);

  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tournaments?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [teams, searchQuery, statusFilter]);

  const filteredPlayers = useMemo(() => {
    const result = players.filter(p => {
      const collegeName = Array.isArray(p.colleges) ? p.colleges[0]?.college_name : p.colleges?.college_name || '';
      const summary = playerSummaries[p.id];
      const prefSports = Array.isArray(p.preferred_sports) ? p.preferred_sports : [];
      const activeSports = summary?.activeSports || [];
      const allPlayerSports = Array.from(new Set([...prefSports, ...activeSports]));
      const allPositions = Array.from(new Set([
        ...(p.primary_position ? [p.primary_position] : []),
        ...(summary?.positions || []),
      ]));

      const matchesSearch =
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collegeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.program || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        allPlayerSports.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (eligibilityFilter === 'eligible' && targetRecruitmentTeam) {
        const elig = evaluateSquadEligibility(p.college_id, collegeName, targetRecruitmentTeam, clusters);
        if (!elig.eligible) return false;
      }

      if (sportFilter !== 'all') {
        const hasSport = allPlayerSports.some((s) => s.toLowerCase() === sportFilter.toLowerCase());
        if (!hasSport) return false;
      }

      if (positionFilter !== 'all') {
        const hasPos = allPositions.some((pos) => pos.toLowerCase().includes(positionFilter.toLowerCase()));
        if (!hasPos) return false;
      }

      return true;
    });

    return result.sort((a, b) => {
      const sumA = playerSummaries[a.id];
      const sumB = playerSummaries[b.id];
      if (sortBy === 'points') return (sumB?.totalPoints || 0) - (sumA?.totalPoints || 0);
      if (sortBy === 'ppg') return (sumB?.ppg || 0) - (sumA?.ppg || 0);
      if (sortBy === 'threes') return (sumB?.threePointers || 0) - (sumA?.threePointers || 0);
      if (sortBy === 'mvp') return (sumB?.mvpCount || 0) - (sumA?.mvpCount || 0);
      return a.full_name.localeCompare(b.full_name);
    });
  }, [players, searchQuery, playerSummaries, eligibilityFilter, targetRecruitmentTeam, clusters, sportFilter, positionFilter, sortBy]);

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
            <p className="text-slate-400 font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
              Form your elite squad, manage rosters, and recruit verified university talent.
            </p>
          </div>
          <div className="flex gap-4 relative z-10">
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                if (open && !isVerified) {
                  toast.error('Coach verification required to register new teams. Please submit your Coach ID for clearance.');
                  return;
                }
                setIsCreateOpen(open);
              }}
            >
              <DialogTrigger render={
                <Button
                  size="lg"
                  onClick={(e) => {
                    if (!isVerified) {
                      e.preventDefault();
                      toast.error('Coach verification required to register new teams. Please submit your Coach ID for clearance.');
                    }
                  }}
                  className={`h-12 sm:h-14 font-black gap-2 px-6 sm:px-8 rounded-xl shadow-xl uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-95 group ${
                    isVerified
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {isVerified ? (
                    <>
                      <UserPlus className="size-5 group-hover:rotate-12 transition-transform duration-300" />
                      <span className="text-sm sm:text-base">New Team</span>
                    </>
                  ) : (
                    <>
                      <Lock className="size-4 text-orange-400" />
                      <span className="text-sm sm:text-base">Verification Required</span>
                    </>
                  )}
                </Button>
              } />
              <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl p-6 sm:p-8 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                <DialogHeader className="min-w-0">
                  <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter break-words leading-tight text-slate-900 dark:text-white">Form <span className="text-orange-500">New Team</span></DialogTitle>
                  <DialogDescription className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest mt-1">
                    Enroll your squad into an official tournament.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 min-w-0">
                  {/* Affiliation Format Toggle */}
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">
                      Affiliation Format
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setAffiliationType('college');
                          setSelectedClusterId('');
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          affiliationType === 'college'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        College Squad
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAffiliationType('cluster');
                          setSelectedCollegeId('');
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          affiliationType === 'cluster'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        Cluster / Tribe
                      </button>
                    </div>
                  </div>

                  {/* College or Cluster Selector */}
                  {affiliationType === 'college' ? (
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">
                        Affiliated PSU College
                      </label>
                      <Select
                        value={selectedCollegeId}
                        onValueChange={(val) => {
                          const id = val || '';
                          setSelectedCollegeId(id);
                          const col = colleges.find(c => c.id === id);
                          if (col && !newTeamName) {
                            const code = extractCollegeCode(col.college_name);
                            setNewTeamName(`${code} Squad`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-12 w-full min-w-0 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold px-3">
                          <SelectValue placeholder="Select PSU College" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-w-[calc(100vw-3rem)] sm:max-w-md">
                          {colleges.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="rounded-lg">
                              <span className="font-bold text-xs truncate">{c.college_name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">
                        Affiliated Binturungan Tribe / Cluster
                      </label>
                      <Select
                        value={selectedClusterId}
                        onValueChange={(val) => {
                          const id = val || '';
                          setSelectedClusterId(id);
                          const cl = clusters.find(c => c.id === id);
                          if (cl && !newTeamName) {
                            setNewTeamName(`${cl.name} Squad`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-12 w-full min-w-0 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold px-3">
                          <SelectValue placeholder="Select Binturungan Tribe" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-w-[calc(100vw-3rem)] sm:max-w-md">
                          {clusters.map((cl) => (
                            <SelectItem key={cl.id} value={cl.id} className="rounded-lg">
                              <div className="flex flex-col gap-0.5 min-w-0 text-left py-0.5">
                                <span className="font-black text-sm truncate">{cl.name}</span>
                                {cl.description && (
                                  <span className="text-[10px] text-slate-400 font-medium truncate max-w-sm">
                                    {cl.description}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedClusterId && (() => {
                        const cl = clusters.find(c => c.id === selectedClusterId);
                        return cl ? (
                          <p className="text-[10px] text-orange-500 font-bold px-1 leading-snug">
                            {cl.description}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  )}

                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] ml-1">Team Identity</label>
                    <Input
                      placeholder={affiliationType === 'cluster' ? "e.g., Tribo Libulan Warriors" : "e.g., CEAT Red Scorpions"}
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

      {/* Clearance Banner for Unverified Coaches */}
      {!isVerified && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-md backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-500 text-white rounded-full">
                  Unverified Coach
                </span>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  Roster Management Restricted
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Your account is currently awaiting coach clearance. Registering teams and recruiting players is locked until your Coach / Employee ID is verified by sports administration.
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.location.href = '/coach'}
            className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shrink-0 self-stretch sm:self-auto"
          >
            Submit ID in Dashboard
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col min-w-0">
        <div className="w-full sm:w-fit p-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl flex items-center gap-1.5 mb-6 shadow-sm sm:mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('my-teams')}
            className={`flex-1 sm:flex-initial min-h-[44px] px-3 sm:px-6 rounded-xl font-black uppercase italic tracking-wider text-xs sm:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'my-teams'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-orange-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            <Users className="size-4 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Teams</span>
              <span className="hidden sm:inline">My Teams</span>
            </span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold shrink-0 min-w-[20px] text-center ${
              activeTab === 'my-teams' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {teams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`flex-1 sm:flex-initial min-h-[44px] px-3 sm:px-6 rounded-xl font-black uppercase italic tracking-wider text-xs sm:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'directory'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-orange-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            <ClipboardList className="size-4 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Players</span>
              <span className="hidden sm:inline">Player Directory</span>
            </span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold shrink-0 min-w-[20px] text-center ${
              activeTab === 'directory' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {filteredPlayers.length}
            </span>
          </button>
        </div>

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
            <SkeletonCard count={3} variant="card" />
          ) : filteredTeams.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No Teams Found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'No teams match your current search and filter criteria.'
                  : 'You have not formed any collegiate teams yet. Launch your first roster to get started.'
              }
              actionLabel={searchQuery || statusFilter !== 'all' ? 'Reset Filters' : '+ Create New Team'}
              onAction={() => {
                if (searchQuery || statusFilter !== 'all') {
                  setSearchQuery('');
                  setStatusFilter('all');
                } else {
                  if (!isVerified) {
                    toast.error('Coach verification required to register new teams. Please submit your Coach ID for clearance.');
                    return;
                  }
                  setIsCreateOpen(true);
                }
              }}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team, idx) => {
                const sport = team.tournaments?.sport || 'PSU Sport';
                const SportIcon = getSportIcon(sport);

                return (
                <Card key={team.id} className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4 flex flex-col justify-between min-w-0" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="min-w-0">
                    <div className={`h-2 w-full ${team.status === 'Approved' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                    <CardHeader className="p-5 sm:p-6 pb-2 min-w-0">
                      {/* Top Sport & Status Row */}
                      <div className="flex justify-between items-center mb-3 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-10 bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0 border border-orange-500/30 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                            <SportIcon className="size-5" />
                          </div>
                          <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 font-black text-[10px] uppercase tracking-wider py-1 px-2.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                            <SportIcon className="size-3.5 shrink-0" />
                            <span className="truncate">{sport}</span>
                          </Badge>
                        </div>
                        <Badge className={`${team.status === 'Approved' ? 'bg-emerald-500' : 'bg-orange-500'} text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-sm shrink-0`}>
                          {team.status}
                        </Badge>
                      </div>

                      <CardTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors break-words line-clamp-2 leading-snug" title={team.name}>{team.name}</CardTitle>
                      
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {team.affiliation_type === 'cluster' && team.clusters?.name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[9px] uppercase tracking-wider border border-purple-500/20">
                            <Users className="size-3" />
                            {team.clusters.name}
                          </span>
                        ) : team.colleges?.college_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[9px] uppercase tracking-wider border border-orange-500/20">
                            <GraduationCap className="size-3" />
                            {extractCollegeCode(team.colleges.college_name)}
                          </span>
                        ) : null}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold text-[9px] uppercase tracking-wider border border-slate-200/80 dark:border-white/5 break-words line-clamp-1" title={team.tournaments?.name}>
                          <Trophy className="size-2.5 text-orange-500 shrink-0" />
                          <span>{team.tournaments?.name || 'Tournament'}</span>
                        </span>
                      </div>
                    </CardHeader>
                  </div>
                  <CardContent className="p-5 sm:p-6 pt-3 mt-auto min-w-0">
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-xl font-black uppercase italic tracking-wider border-2 border-slate-100 dark:border-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300 text-slate-900 dark:text-white"
                      onClick={() => {
                        setManageRosterTeamId(team.id);
                        fetchRosterMembers(team.id);
                      }}
                    >
                      Manage Roster
                    </Button>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile List View (< md): Mobile-First Cards — Zero horizontal scroll */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm">
                {filteredTeams.map((team) => {
                  const sport = team.tournaments?.sport || 'PSU Sport';
                  const SportIcon = getSportIcon(sport);
                  return (
                    <div key={team.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="size-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                            <SportIcon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black italic uppercase tracking-tight text-sm text-slate-900 dark:text-white truncate">
                              {team.name}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase px-1.5 py-0">
                                {sport}
                              </Badge>
                              {team.affiliation_type === 'cluster' && team.clusters?.name ? (
                                <span className="not-italic px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[9px] uppercase tracking-wider border border-purple-500/20">
                                  {team.clusters.name}
                                </span>
                              ) : team.colleges?.college_name ? (
                                <span className="not-italic px-1.5 py-0.2 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[9px] uppercase tracking-wider border border-orange-500/20">
                                  {extractCollegeCode(team.colleges.college_name)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <Badge variant={team.status === 'Approved' ? 'default' : 'secondary'} className="text-[9px] font-black uppercase shrink-0">
                          {team.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider break-words line-clamp-1 min-w-0" title={team.tournaments?.name}>
                          {team.tournaments?.name || 'Tournament'}
                        </p>
                        <Button
                          size="sm"
                          className="h-8 px-3 rounded-lg font-black uppercase text-[10px] tracking-wider bg-orange-500 hover:bg-orange-600 text-white shrink-0 shadow-sm"
                          onClick={() => {
                            setManageRosterTeamId(team.id);
                            fetchRosterMembers(team.id);
                          }}
                        >
                          Manage Roster
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md): Full-Width Table */}
              <Card className="hidden md:block rounded-[2rem] border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                      <tr>
                        <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 dark:text-slate-400">Team &amp; Sport</th>
                        <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 dark:text-slate-400">Tournament</th>
                        <th className="text-left py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 dark:text-slate-400">Status</th>
                        <th className="text-right py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 dark:text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.map((team) => {
                        const sport = team.tournaments?.sport || 'PSU Sport';
                        const SportIcon = getSportIcon(sport);
                        return (
                        <tr key={team.id} className="border-b border-slate-50 dark:border-white/5 last:border-none hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors group">
                          <td className="py-4 px-8 font-black italic uppercase tracking-tighter text-lg text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <div className="size-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                                <SportIcon className="size-4.5" />
                              </div>
                              <span>{team.name}</span>
                              <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase">
                                {sport}
                              </Badge>
                              {team.affiliation_type === 'cluster' && team.clusters?.name ? (
                                <span className="not-italic px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[9px] uppercase tracking-wider border border-purple-500/20">
                                  {team.clusters.name}
                                </span>
                              ) : team.colleges?.college_name ? (
                                <span className="not-italic px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[9px] uppercase tracking-wider border border-orange-500/20">
                                  {extractCollegeCode(team.colleges.college_name)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-4 px-8 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest">
                            {team.tournaments?.name}
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
                              Manage Roster
                            </Button>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="directory" className="space-y-6 outline-none">
          {/* Smart Coach Recruitment Filter & Eligibility Workbench */}
          <Card className="p-4 sm:p-5 rounded-3xl border-2 border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                  <Filter className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Smart Scouting &amp; Eligibility Filters
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Filter athletes by Target Squad College / Binturungan Tribe, Preferred Sport, Position &amp; Career Stats
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-black uppercase border-orange-500/30 text-orange-500 w-fit">
                {filteredPlayers.length} Matching Athletes
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Target Squad Context Selector */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Target Squad Context
                </label>
                <Select
                  value={targetRecruitmentTeamId}
                  onValueChange={(val) => {
                    const nextVal = val || 'all';
                    setTargetRecruitmentTeamId(nextVal);
                    if (nextVal !== 'all') {
                      setEligibilityFilter('eligible');
                      const t = teams.find((tm) => tm.id === nextVal);
                      const tr = Array.isArray(t?.tournaments) ? t?.tournaments[0] : t?.tournaments;
                      if (tr?.sport) setSportFilter('all');
                    } else {
                      setEligibilityFilter('all');
                    }
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                    <SelectValue placeholder="All Squads (Open)">
                      {targetRecruitmentTeamId === 'all'
                        ? 'All Squads (Open Browse)'
                        : (() => {
                            const t = teams.find((tm) => tm.id === targetRecruitmentTeamId);
                            if (!t) return targetRecruitmentTeamId;
                            const tr = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
                            return `${t.name} (${tr?.sport || 'Sport'})`;
                          })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs font-bold">
                      All Squads (Open Browse)
                    </SelectItem>
                    {teams
                      .filter((t) => t.status !== 'Rejected')
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs font-bold">
                          {t.name} ({t.tournaments?.sport || 'Sport'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. College / Tribe Eligibility Toggle */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  College / Tribe Eligibility
                </label>
                <Select
                  value={eligibilityFilter}
                  onValueChange={(val) => setEligibilityFilter((val as 'all' | 'eligible') || 'all')}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                    <SelectValue>
                      {eligibilityFilter === 'eligible'
                        ? 'Only Eligible for Target Squad'
                        : 'Show All Colleges / Tribes'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs font-bold">
                      Show All Colleges / Tribes
                    </SelectItem>
                    <SelectItem value="eligible" className="text-xs font-bold">
                      Only Eligible for Target Squad
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Preferred Sport Filter */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Preferred / Active Sport
                </label>
                <Select value={sportFilter} onValueChange={(val) => setSportFilter(val || 'all')}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                    <SelectValue>
                      {sportFilter === 'all' ? 'All Sports' : sportFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
                    <SelectItem value="all" className="text-xs font-bold">
                      All Sports
                    </SelectItem>
                    {AVAILABLE_SPORTS.map((sp) => (
                      <SelectItem key={sp} value={sp} className="text-xs font-bold">
                        {sp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Position Filter */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Position / Role
                </label>
                <Select value={positionFilter} onValueChange={(val) => setPositionFilter(val || 'all')}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                    <SelectValue>
                      {positionFilter === 'all'
                        ? 'All Positions'
                        : positionFilter === 'PG'
                        ? 'Point Guard (PG)'
                        : positionFilter === 'SG'
                        ? 'Shooting Guard (SG)'
                        : positionFilter === 'SF'
                        ? 'Small Forward (SF)'
                        : positionFilter === 'PF'
                        ? 'Power Forward (PF)'
                        : positionFilter === 'C'
                        ? 'Center (C)'
                        : positionFilter === 'Spiker'
                        ? 'Spiker / Hitter'
                        : positionFilter === 'Striker'
                        ? 'Striker / Forward'
                        : positionFilter === 'Midfield'
                        ? 'Midfielder'
                        : positionFilter === 'Goal'
                        ? 'Goalkeeper'
                        : positionFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
                    <SelectItem value="all" className="text-xs font-bold">
                      All Positions
                    </SelectItem>
                    <SelectItem value="PG" className="text-xs font-bold">Point Guard (PG)</SelectItem>
                    <SelectItem value="SG" className="text-xs font-bold">Shooting Guard (SG)</SelectItem>
                    <SelectItem value="SF" className="text-xs font-bold">Small Forward (SF)</SelectItem>
                    <SelectItem value="PF" className="text-xs font-bold">Power Forward (PF)</SelectItem>
                    <SelectItem value="C" className="text-xs font-bold">Center (C)</SelectItem>
                    <SelectItem value="Setter" className="text-xs font-bold">Setter</SelectItem>
                    <SelectItem value="Spiker" className="text-xs font-bold">Spiker / Hitter</SelectItem>
                    <SelectItem value="Libero" className="text-xs font-bold">Libero</SelectItem>
                    <SelectItem value="Striker" className="text-xs font-bold">Striker / Forward</SelectItem>
                    <SelectItem value="Midfield" className="text-xs font-bold">Midfielder</SelectItem>
                    <SelectItem value="Defender" className="text-xs font-bold">Defender</SelectItem>
                    <SelectItem value="Goal" className="text-xs font-bold">Goalkeeper</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Sort By Telemetry */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Rank / Sort By
                </label>
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val || 'points')}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                    <SelectValue>
                      {sortBy === 'points'
                        ? 'Career Points (High → Low)'
                        : sortBy === 'ppg'
                        ? 'Scoring Average / PPG'
                        : sortBy === 'threes'
                        ? '3-Pointers Made (3PM)'
                        : sortBy === 'mvp'
                        ? 'MVP Trophies'
                        : 'Athlete Name (A → Z)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="points" className="text-xs font-bold">Career Points (High → Low)</SelectItem>
                    <SelectItem value="ppg" className="text-xs font-bold">Scoring Average / PPG</SelectItem>
                    <SelectItem value="threes" className="text-xs font-bold">3-Pointers Made (3PM)</SelectItem>
                    <SelectItem value="mvp" className="text-xs font-bold">MVP Trophies</SelectItem>
                    <SelectItem value="name" className="text-xs font-bold">Athlete Name (A → Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetRecruitmentTeam && (
              <div className="p-3 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-orange-500 shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Active Recruitment Context:{' '}
                    <strong className="text-orange-500 uppercase">{targetRecruitmentTeam.name}</strong>
                    {targetRecruitmentTeam.affiliation_type === 'cluster' && targetRecruitmentTeam.clusters?.name
                      ? ` • Binturungan Tribe: ${targetRecruitmentTeam.clusters.name}`
                      : targetRecruitmentTeam.colleges?.college_name
                      ? ` • College: ${targetRecruitmentTeam.colleges.college_name}`
                      : ''}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTargetRecruitmentTeamId('all');
                    setEligibilityFilter('all');
                    setSportFilter('all');
                    setPositionFilter('all');
                  }}
                  className="h-7 text-[10px] font-black uppercase text-slate-500 hover:text-orange-500"
                >
                  Reset Context
                </Button>
              </div>
            )}
          </Card>

          {isLoadingPlayers ? (
            <SkeletonCard count={3} variant="card" />
          ) : filteredPlayers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Players Match Filters"
              description="No verified athletes match your current college/tribe eligibility, preferred sport, or search filters."
              actionLabel="Reset Scouting Filters"
              onAction={() => {
                setSearchQuery('');
                setEligibilityFilter('all');
                setSportFilter('all');
                setPositionFilter('all');
              }}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlayers.map((player, idx) => {
                const collegeName = Array.isArray(player.colleges)
                  ? player.colleges[0]?.college_name
                  : player.colleges?.college_name || 'Unassigned College';
                const summary = playerSummaries[player.id];
                const elig = evaluateSquadEligibility(
                  player.college_id,
                  collegeName,
                  targetRecruitmentTeam,
                  clusters
                );
                const prefSports = Array.isArray(player.preferred_sports) ? player.preferred_sports : [];
                const displaySports = Array.from(new Set([...prefSports, ...(summary?.activeSports || [])]));

                return (
                  <Card
                    key={player.id}
                    className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4 flex flex-col justify-between min-w-0"
                    style={{ animationDelay: `${Math.min(idx * 35, 300)}ms` }}
                  >
                    <div className="min-w-0">
                      <CardHeader className="p-5 sm:p-6 pb-3 min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="size-11 sm:size-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-orange-500 group-hover:text-white transition-all duration-500 shrink-0 shadow-sm">
                              {player.full_name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <CardTitle
                                className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors cursor-pointer break-words line-clamp-2 leading-snug"
                                title={player.full_name}
                                onClick={() => setDossierPlayerId(player.id)}
                              >
                                {player.full_name}
                              </CardTitle>
                              <CardDescription className="font-bold text-orange-500 uppercase text-[9px] tracking-[0.15em] mt-0.5 break-words line-clamp-2 leading-snug flex items-center gap-1.5">
                                <span>{player.primary_position || summary?.positions[0] || 'Verified Athlete'}</span>
                                {player.year_level && (
                                  <span className="text-slate-400">• {player.year_level}</span>
                                )}
                              </CardDescription>
                            </div>
                          </div>

                          {targetRecruitmentTeam && (
                            <Badge
                              className={
                                elig.eligible
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase shrink-0'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 text-[9px] font-black uppercase shrink-0'
                              }
                              title={elig.reason}
                            >
                              {elig.badgeLabel}
                            </Badge>
                          )}
                        </div>

                        {/* College Affiliation */}
                        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5 min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 italic">
                            College Affiliation
                          </p>
                          <p
                            className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words line-clamp-2 leading-snug"
                            title={collegeName}
                          >
                            {collegeName}
                          </p>
                        </div>

                        {/* Preferred / Played Sports Pills */}
                        {displaySports.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {displaySports.slice(0, 4).map((sp) => (
                              <Badge
                                key={sp}
                                variant="outline"
                                className="text-[9px] font-black uppercase border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/5"
                              >
                                {sp}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Career Telemetry Strip */}
                        {(() => {
                          const sportCtx =
                            sportFilter !== 'all'
                              ? sportFilter
                              : targetRecruitmentTeam?.tournaments?.sport || displaySports[0];
                          const primaryPill = getPrimarySportStatPill(summary, sportCtx);
                          return (
                            <div className="grid grid-cols-4 gap-1.5 pt-1">
                              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center">
                                <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">GP</p>
                                <p className="text-xs font-black tabular-nums text-slate-900 dark:text-white">{summary?.gamesPlayed || 0}</p>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center">
                                <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">PTS</p>
                                <p className="text-xs font-black tabular-nums text-orange-600 dark:text-orange-400">
                                  {summary?.totalPoints || 0}
                                </p>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center">
                                <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">AVG</p>
                                <p className="text-xs font-black tabular-nums text-cyan-600 dark:text-cyan-400">
                                  {summary?.ppg || 0}
                                </p>
                              </div>
                              <div
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center"
                                title={primaryPill.unitLabel}
                              >
                                <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">
                                  {primaryPill.label}
                                </p>
                                <p className="text-xs font-black tabular-nums text-amber-600 dark:text-amber-400">
                                  {primaryPill.value}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </CardHeader>
                    </div>
                    <CardContent className="p-5 sm:p-6 pt-2 mt-auto min-w-0 flex gap-2">
                      <Button
                        variant="outline"
                        className="h-11 px-3.5 rounded-xl font-black uppercase text-[10px] tracking-wider border-slate-200 dark:border-white/10 hover:border-orange-500/50 gap-1.5 shrink-0"
                        onClick={() => setDossierPlayerId(player.id)}
                      >
                        <Eye className="size-3.5 text-orange-500" />
                        <span>Scout</span>
                      </Button>
                      <Button
                        className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                        onClick={() => {
                          if (targetRecruitmentTeamId && targetRecruitmentTeamId !== 'all') {
                            setSelectedTeamToInvite(targetRecruitmentTeamId);
                          }
                          handleStartInvitePlayer(player.id);
                        }}
                      >
                        <UserPlus className="size-3.5" />
                        <span>Recruit</span>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile View: Dedicated responsive cards (md:hidden) to eliminate horizontal table scrolling */}
              <div className="md:hidden space-y-3">
                {filteredPlayers.map((player) => {
                  const collegeName = Array.isArray(player.colleges)
                    ? player.colleges[0]?.college_name
                    : player.colleges?.college_name || 'N/A';
                  const summary = playerSummaries[player.id];
                  const elig = evaluateSquadEligibility(
                    player.college_id,
                    collegeName,
                    targetRecruitmentTeam,
                    clusters
                  );
                  const prefSports = Array.isArray(player.preferred_sports) ? player.preferred_sports : [];
                  const displaySports = Array.from(new Set([...prefSports, ...(summary?.activeSports || [])]));
                  const keyStatPill = getPrimarySportStatPill(
                    summary,
                    sportFilter !== 'all'
                      ? sportFilter
                      : targetRecruitmentTeam?.tournaments?.sport || displaySports[0]
                  );

                  return (
                    <Card
                      key={`mob-${player.id}`}
                      className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="size-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm shrink-0 border border-orange-500/30">
                            {player.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setDossierPlayerId(player.id)}
                              className="font-black italic uppercase tracking-tight text-sm text-slate-900 dark:text-white hover:text-orange-500 text-left break-words line-clamp-2 leading-snug block"
                            >
                              {player.full_name}
                            </button>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {player.primary_position && (
                                <span className="text-[10px] font-black text-orange-500 uppercase">
                                  {player.primary_position}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase break-words line-clamp-1">
                                • {collegeName}
                              </span>
                            </div>
                          </div>
                        </div>

                        {targetRecruitmentTeam && (
                          <Badge
                            className={`shrink-0 text-[8px] font-black uppercase ${
                              elig.eligible
                                ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-500 border border-red-500/30'
                            }`}
                          >
                            {elig.badgeLabel}
                          </Badge>
                        )}
                      </div>

                      {/* Micro stats grid */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 mb-3 text-center">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Games</p>
                          <p className="text-xs font-mono font-black text-slate-800 dark:text-slate-200">
                            {summary?.gamesPlayed || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">PTS (AVG)</p>
                          <p className="text-xs font-mono font-black text-orange-500">
                            {summary?.totalPoints || 0} <span className="text-[10px] opacity-75">({summary?.ppg || 0})</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">{keyStatPill.label}</p>
                          <p className="text-xs font-mono font-black text-amber-500 truncate">
                            {keyStatPill.value}
                          </p>
                        </div>
                      </div>

                      {/* Sports tags + Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                        <div className="flex flex-wrap gap-1 min-w-0 max-w-[50%]">
                          {displaySports.length === 0 ? (
                            <span className="text-[10px] text-slate-400">Open Sport</span>
                          ) : (
                            displaySports.slice(0, 2).map((sp) => (
                              <Badge key={sp} variant="outline" className="text-[8px] font-bold uppercase px-1.5 py-0">
                                {sp}
                              </Badge>
                            ))
                          )}
                          {displaySports.length > 2 && (
                            <Badge variant="outline" className="text-[8px] font-bold uppercase px-1 py-0 text-slate-400">
                              +{displaySports.length - 2}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-[10px] font-black uppercase rounded-lg"
                            onClick={() => setDossierPlayerId(player.id)}
                          >
                            Scout
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-[10px] rounded-lg shadow-sm"
                            onClick={() => {
                              if (targetRecruitmentTeamId && targetRecruitmentTeamId !== 'all') {
                                setSelectedTeamToInvite(targetRecruitmentTeamId);
                              }
                              handleStartInvitePlayer(player.id);
                            }}
                          >
                            Recruit
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop View: Preserved Table (hidden md:block) */}
              <Card className="hidden md:block rounded-[2rem] border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                      <tr>
                        <th className="text-left py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Athlete</th>
                        <th className="text-left py-4 px-4 font-black uppercase tracking-widest text-[10px] text-slate-400">College &amp; Eligibility</th>
                        <th className="text-left py-4 px-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Preferred Sports</th>
                        <th className="text-center py-4 px-3 font-black uppercase tracking-widest text-[10px] text-slate-400">GP</th>
                        <th className="text-center py-4 px-3 font-black uppercase tracking-widest text-[10px] text-slate-400">PTS (AVG)</th>
                        <th className="text-center py-4 px-3 font-black uppercase tracking-widest text-[10px] text-slate-400">Key Stat</th>
                        <th className="text-right py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlayers.map((player) => {
                        const collegeName = Array.isArray(player.colleges)
                          ? player.colleges[0]?.college_name
                          : player.colleges?.college_name || 'N/A';
                        const summary = playerSummaries[player.id];
                        const elig = evaluateSquadEligibility(
                          player.college_id,
                          collegeName,
                          targetRecruitmentTeam,
                          clusters
                        );
                        const prefSports = Array.isArray(player.preferred_sports) ? player.preferred_sports : [];
                        const displaySports = Array.from(new Set([...prefSports, ...(summary?.activeSports || [])]));

                        return (
                          <tr key={player.id} className="border-b border-slate-50 dark:border-white/5 last:border-none hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors group">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-xs text-slate-500">
                                  {player.full_name.charAt(0)}
                                </div>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setDossierPlayerId(player.id)}
                                    className="font-black italic uppercase tracking-tighter text-base text-slate-900 dark:text-white hover:text-orange-500 text-left cursor-pointer"
                                  >
                                    {player.full_name}
                                  </button>
                                  {player.primary_position && (
                                    <p className="text-[10px] font-bold text-orange-500 uppercase">
                                      {player.primary_position}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <p className="font-bold text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                                {collegeName}
                              </p>
                              {targetRecruitmentTeam && (
                                <Badge
                                  className={
                                    elig.eligible
                                      ? 'bg-emerald-500/15 text-emerald-600 text-[8px] font-black uppercase mt-1'
                                      : 'bg-red-500/15 text-red-500 text-[8px] font-black uppercase mt-1'
                                  }
                                >
                                  {elig.badgeLabel}
                                </Badge>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-1">
                                {displaySports.length === 0 ? (
                                  <span className="text-[10px] text-slate-400">Open</span>
                                ) : (
                                  displaySports.map((sp) => (
                                    <Badge key={sp} variant="outline" className="text-[9px] font-bold uppercase">
                                      {sp}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-3 text-center font-mono font-bold text-xs">
                              {summary?.gamesPlayed || 0}
                            </td>
                            <td className="py-4 px-3 text-center font-mono font-black text-xs text-orange-500">
                              {summary?.totalPoints || 0} ({summary?.ppg || 0})
                            </td>
                            <td className="py-4 px-3 text-center font-mono font-bold text-xs text-amber-500">
                              {(() => {
                                const pill = getPrimarySportStatPill(
                                  summary,
                                  sportFilter !== 'all'
                                    ? sportFilter
                                    : targetRecruitmentTeam?.tournaments?.sport || displaySports[0]
                                );
                                return `${pill.value} ${pill.label}`;
                              })()}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-[10px] font-black uppercase rounded-lg"
                                  onClick={() => setDossierPlayerId(player.id)}
                                >
                                  Scout
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8 px-3 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-[10px] rounded-lg"
                                  onClick={() => {
                                    if (targetRecruitmentTeamId && targetRecruitmentTeamId !== 'all') {
                                      setSelectedTeamToInvite(targetRecruitmentTeamId);
                                    }
                                    handleStartInvitePlayer(player.id);
                                  }}
                                >
                                  Recruit
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={!!manageRosterTeamId} onOpenChange={(open) => !open && setManageRosterTeamId(null)}>
        <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] max-h-[88dvh] overflow-hidden rounded-3xl p-5 sm:p-8 flex flex-col min-w-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader className="min-w-0">
            <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter break-words leading-tight text-slate-900 dark:text-white">Manage <span className="text-orange-500">Roster</span></DialogTitle>
            <DialogDescription className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest mt-1">View and manage players invited to this team.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60dvh] overflow-y-auto overflow-x-hidden pr-1 scrollbar-hide min-w-0 flex-1">
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
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="size-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center font-black text-slate-500 group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0">
                            {((Array.isArray(member.users) ? member.users[0]?.full_name : member.users?.full_name) || '?')[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-black italic uppercase tracking-tighter text-base sm:text-lg break-words line-clamp-2 leading-snug text-slate-900 dark:text-white">
                                {Array.isArray(member.users) ? member.users[0]?.full_name : member.users?.full_name || 'Unknown Player'}
                              </span>
                              {member.is_captain && (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase px-2 py-0 gap-1 shrink-0">
                                  <Star className="size-2.5 fill-amber-500" /> Captain
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider break-words line-clamp-2 leading-snug">{collegeName}</span>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
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
                              <SelectValue placeholder="Status">
                                {member.availability_status === 'injured'
                                  ? 'Injured'
                                  : member.availability_status === 'benched'
                                  ? 'Benched'
                                  : member.availability_status === 'excused'
                                  ? 'Excused'
                                  : 'Active'}
                              </SelectValue>
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
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl p-6 sm:p-8 overflow-hidden min-w-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader className="min-w-0">
            <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter break-words leading-tight text-slate-900 dark:text-white">Recruit <span className="text-orange-500">Athlete</span></DialogTitle>
            <DialogDescription className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest mt-1">Select a team to send an invitation to this player.</DialogDescription>
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
                {teams.filter((t) => {
                  const tourney = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
                  return t.status !== 'Rejected' && tourney?.status !== 'Completed';
                }).length === 0 ? (
                  <div className="p-4 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No active teams available for recruitment</div>
                ) : (
                  teams
                    .filter((t) => {
                      const tourney = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
                      return t.status !== 'Rejected' && tourney?.status !== 'Completed';
                    })
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id} className="rounded-lg">
                        <span className="truncate">{team.name} ({team.tournaments?.name || 'Tournament'}{team.tournaments?.sport ? ` - ${team.tournaments.sport}` : ''})</span>
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>

            {invitePlayerId && selectedTeamToInvite && (() => {
              const targetPl = players.find((p) => p.id === invitePlayerId);
              const targetTm = teams.find((t) => t.id === selectedTeamToInvite) || null;
              if (!targetPl || !targetTm) return null;
              const colName = Array.isArray(targetPl.colleges)
                ? targetPl.colleges[0]?.college_name
                : targetPl.colleges?.college_name || '';
              const check = evaluateSquadEligibility(targetPl.college_id, colName, targetTm, clusters);
              return (
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 mt-2 ${
                    check.eligible
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {check.eligible ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-black uppercase text-[10px] tracking-wider">{check.badgeLabel}</p>
                    <p className="text-[11px] font-medium mt-0.5">{check.reason}</p>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setInvitePlayerId(null); setSelectedTeamToInvite(''); }} className="h-11 sm:h-12 rounded-xl font-black uppercase tracking-wider text-xs">Cancel</Button>
            <Button onClick={handleInvitePlayer} disabled={!selectedTeamToInvite} className="h-11 sm:h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-wider text-xs sm:text-sm shadow-md shadow-orange-500/20">Send Recruitment Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Athlete Scouting Dossier Modal */}
      <PlayerDossierModal
        playerId={dossierPlayerId}
        onClose={() => setDossierPlayerId(null)}
        onOpenMatchBoxScore={(mId) => setBoxScoreMatchId(mId)}
        onRecruitPlayer={(pId) => {
          if (targetRecruitmentTeamId && targetRecruitmentTeamId !== 'all') {
            setSelectedTeamToInvite(targetRecruitmentTeamId);
          }
          handleStartInvitePlayer(pId);
        }}
        eligibilityBadge={(() => {
          if (!dossierPlayerId || !targetRecruitmentTeam) return null;
          const p = players.find((pl) => pl.id === dossierPlayerId);
          if (!p) return null;
          const cName = Array.isArray(p.colleges) ? p.colleges[0]?.college_name : p.colleges?.college_name || '';
          return evaluateSquadEligibility(p.college_id, cName, targetRecruitmentTeam, clusters);
        })()}
      />

      {/* Match Box Score Modal */}
      <MatchBoxScoreModal
        matchId={boxScoreMatchId}
        onClose={() => setBoxScoreMatchId(null)}
        onSelectPlayer={(pId) => {
          setBoxScoreMatchId(null);
          setDossierPlayerId(pId);
        }}
      />
    </div>
  );
};
