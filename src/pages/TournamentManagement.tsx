import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Trophy, 
  Users, 
  CheckCircle2, 
  XCircle, 
  LayoutGrid, 
  Shuffle, 
  Plus, 
  Trash2,
  CalendarDays, 
  Check,
  ChevronRight, 
  Info, 
  AlertTriangle,
  Star,
  Sparkles,
  Lightbulb
} from 'lucide-react';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { ViewToggle } from '@/components/admin/ViewToggle';
import { logAudit } from '@/lib/audit';

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

const BINTURUNGAN_DEFAULT_SPORTS = [
  { name: 'Basketball', icon: '🏀', category: 'Court' },
  { name: 'Volleyball', icon: '🏐', category: 'Court' },
  { name: 'Soccer', icon: '⚽', category: 'Pitch' },
  { name: 'Badminton', icon: '🏸', category: 'Racket' },
  { name: 'Baseball', icon: '⚾', category: 'Diamond' },
  { name: 'Futsal', icon: '🥅', category: 'Indoor' },
  { name: 'Table Tennis', icon: '🏓', category: 'Paddle' },
];

export const TournamentManagement = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  // Create Tournament State - Wide Binturungan One-Click Setup
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'binturungan' | 'single'>('binturungan');
  const [selectedSports, setSelectedSports] = useState<string[]>(BINTURUNGAN_DEFAULT_SPORTS.map(s => s.name));
  const [eventName, setEventName] = useState('PSU Binturungan 2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleSport, setSingleSport] = useState('Basketball');
  const [singleType, setSingleType] = useState('Binturungan');
  const [isCreatingTournaments, setIsCreatingTournaments] = useState(false);

  // Delete Tournament State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeletingTournament, setIsDeletingTournament] = useState(false);

  // Bracket / Wizard State
  const [isBracketOpen, setIsBracketOpen] = useState(false);
  const [selectedTournamentForBracket, setSelectedTournamentForBracket] = useState<Tournament | null>(null);
  const [approvedTeams, setApprovedTeams] = useState<{id: string, name: string}[]>([]);
  const [existingMatches, setExistingMatches] = useState<any[]>([]);
  const [isLoadingBracket, setIsLoadingBracket] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedBracketType, setSelectedBracketType] = useState<'single' | 'round_robin' | 'double'>('single');
  const [proposedMatches, setProposedMatches] = useState<{
    team_a_id: string | null;
    team_a_name: string;
    team_b_id: string | null;
    team_b_name: string;
    round: string;
    match_time: string;
    local_id: string;
    next_match_local_id?: string;
    next_match_slot?: 'team_a' | 'team_b';
  }[]>([]);

  // MVP Awards State
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [tournamentPlayers, setTournamentPlayers] = useState<any[]>([]);
  const [selectedPlayerForGoldId, setSelectedPlayerForGoldId] = useState<string>('');
  const [isAwardingGold, setIsAwardingGold] = useState(false);

  // UI State for Standardization
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('tournaments');

  // Memoized Filtering Logic
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.sport.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchQuery, statusFilter]);

  const filteredTeams = useMemo(() => {
    return pendingTeams.filter(team => {
      const teamName = team.name || '';
      const coachName = (team.users as any)?.full_name || '';
      const tourName = (team.tournaments as any)?.name || '';
      
      return teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             coachName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             tourName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [pendingTeams, searchQuery]);

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
      .select('id, name, status, users(full_name), tournaments(id, name, status, sport)')
      .eq('status', 'Pending');

    if (error) {
      toast.error('Failed to load pending teams: ' + error.message);
    } else {
      setPendingTeams((data as unknown) as PendingTeam[]);
    }
    setIsLoadingTeams(false);
  };

  const toggleSport = (sport: string) => {
    setSelectedSports(prev => 
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    );
  };

  const handleCreateTournament = async () => {
    const trimmedName = eventName.trim();
    if (!trimmedName) {
      toast.error('Please specify the event master name.');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please specify both kickoff and finals dates.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Kickoff date cannot be scheduled after the finals date.');
      return;
    }

    setIsCreatingTournaments(true);
    try {
      // 1. Duplicate Event Name Prevention (Case-Insensitive)
      const proposedNames = creationMode === 'binturungan'
        ? selectedSports.map(sport => `${trimmedName} - ${sport}`)
        : [trimmedName];

      if (creationMode === 'binturungan' && selectedSports.length === 0) {
        toast.error('Please select at least one sport for the Binturungan event.');
        setIsCreatingTournaments(false);
        return;
      }

      // Check existing tournament names
      const { data: existingTournaments, error: checkError } = await supabase
        .from('tournaments')
        .select('name');

      if (checkError) throw checkError;

      const existingNamesLower = new Set(
        (existingTournaments || []).map(t => t.name.trim().toLowerCase())
      );

      // Check if any proposed tournament name already exists
      const duplicate = proposedNames.find(name => existingNamesLower.has(name.toLowerCase()));
      if (duplicate) {
        toast.error(`An event named "${duplicate}" already exists. Please choose a unique event name.`);
        setIsCreatingTournaments(false);
        return;
      }

      if (creationMode === 'binturungan') {
        // Batch create tournament records for each selected sport in Draft mode
        const payloads = selectedSports.map(sport => ({
          name: `${trimmedName} - ${sport}`,
          sport: sport,
          type: 'Binturungan',
          status: 'Draft',
          start_date: startDate,
          end_date: endDate,
        }));

        const { error } = await supabase.from('tournaments').insert(payloads);
        if (error) throw error;

        toast.success(`Successfully initialized ${selectedSports.length} Binturungan sport tournaments in Draft mode!`);
        
        logAudit({
          action: 'CREATE_TOURNAMENT',
          entity_type: 'tournaments',
          details: `Initialized Binturungan event "${trimmedName}" across ${selectedSports.length} sports (${selectedSports.join(', ')}) in Draft mode`
        });
      } else {
        // Single Event Creation
        const { error } = await supabase.from('tournaments').insert({
          name: trimmedName,
          sport: singleSport,
          type: singleType,
          status: 'Draft',
          start_date: startDate,
          end_date: endDate,
        });

        if (error) throw error;
        toast.success(`Tournament "${trimmedName}" created in Draft mode.`);
        
        logAudit({
          action: 'CREATE_TOURNAMENT',
          entity_type: 'tournaments',
          details: `Created single tournament "${trimmedName}" (${singleSport}) in Draft mode`
        });
      }

      // Automatically remove/close popup after confirm and reset form
      setIsCreateOpen(false);
      setEventName('PSU Binturungan 2026');
      setStartDate('');
      setEndDate('');
      setSelectedSports(BINTURUNGAN_DEFAULT_SPORTS.map(s => s.name));
      fetchTournaments();
    } catch (err: any) {
      toast.error('Error creating tournament(s): ' + err.message);
    } finally {
      setIsCreatingTournaments(false);
    }
  };

  const promptDeleteTournament = (tournament: Tournament) => {
    setTournamentToDelete(tournament);
    setDeleteConfirmationInput('');
    setIsDeleteOpen(true);
  };

  const handleDeleteTournament = async () => {
    if (!tournamentToDelete) return;
    setIsDeletingTournament(true);

    try {
      const tournamentId = tournamentToDelete.id;

      // 1. Break self-referencing pointer links on matches
      await supabase
        .from('matches')
        .update({ next_match_id: null })
        .eq('tournament_id', tournamentId);

      // 2. Fetch all match IDs in this tournament
      const { data: matchesData } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (matchesData && matchesData.length > 0) {
        const matchIds = matchesData.map(m => m.id);
        // Delete match events referencing these matches
        await supabase.from('match_events').delete().in('match_id', matchIds);
        // Delete player stars referencing these matches
        await supabase.from('player_stars').delete().in('match_id', matchIds);
      }

      // 3. Delete player stars associated directly with the tournament
      await supabase.from('player_stars').delete().eq('tournament_id', tournamentId);

      // 4. Delete matches in tournament
      await supabase.from('matches').delete().eq('tournament_id', tournamentId);

      // 5. Find teams in tournament to remove rosters and then teams
      const { data: teamsData } = await supabase.from('teams').select('id').eq('tournament_id', tournamentId);
      if (teamsData && teamsData.length > 0) {
        const teamIds = teamsData.map(t => t.id);
        await supabase.from('team_roster').delete().in('team_id', teamIds);
        await supabase.from('teams').delete().eq('tournament_id', tournamentId);
      }

      // 6. Delete the tournament itself
      const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);

      if (error) {
        throw error;
      }

      toast.success(`Tournament "${tournamentToDelete.name}" has been permanently terminated.`);

      logAudit({
        action: 'DELETE_TOURNAMENT',
        entity_type: 'tournaments',
        entity_id: tournamentId,
        details: `Terminated and deleted tournament: ${tournamentToDelete.name}`
      });

      setIsDeleteOpen(false);
      setTournamentToDelete(null);
      setDeleteConfirmationInput('');
      fetchTournaments();
      fetchPendingTeams();
    } catch (err: any) {
      toast.error('Failed to delete tournament: ' + err.message);
    } finally {
      setIsDeletingTournament(false);
    }
  };

  const handleApproveTeam = async (teamId: string) => {
    // Check if the team's tournament is in Draft mode
    const pendingTeam = pendingTeams.find(t => t.id === teamId);
    const tournamentStatus = (pendingTeam?.tournaments as any)?.status;

    if (tournamentStatus && tournamentStatus !== 'Draft') {
      toast.error(`Team approvals are only permitted during the Draft phase. This tournament is already "${tournamentStatus}".`);
      return;
    }

    const { error } = await supabase
      .from('teams')
      .update({ status: 'Approved' })
      .eq('id', teamId);

    if (error) {
      toast.error('Failed to approve team: ' + error.message);
    } else {
      toast.success('Team approved successfully.');
      
      logAudit({
        action: 'APPROVE_TEAM',
        entity_type: 'teams',
        entity_id: teamId,
        details: `Approved team ${teamId} for tournament ${(pendingTeam?.tournaments as any)?.name || 'Draft tournament'}`
      });

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
    
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .eq('status', 'Approved');
    
    if (teamsData) setApprovedTeams(teamsData);

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
      .eq('tournament_id', tournamentId)
      .order('match_time', { ascending: true, nullsFirst: false });

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
    if (isAwardingGold || !selectedTournamentId || !selectedPlayerForGoldId) {
      if (!selectedTournamentId || !selectedPlayerForGoldId) {
        toast.error('Please select both a tournament and a player.');
      }
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
      if (error.code === '23505') {
        toast.error("A Tournament MVP has already been awarded!");
      } else {
        toast.error('Failed to award Tournament MVP: ' + error.message);
      }
    } else {
      toast.success('Gold Star awarded to Tournament MVP!');
      
      logAudit({
        action: 'AWARD_STAR',
        entity_type: 'player_stars',
        entity_id: selectedPlayerForGoldId,
        details: `Awarded MVP Gold Star in tournament ${selectedTournamentId}`
      });

      setSelectedPlayerForGoldId('');
    }
    setIsAwardingGold(false);
  };

  // --- Wizard: Auto-Seeding Algorithm (Fisher-Yates Shuffle & Multi-Round Bracket Seeding) ---
  const generateSeededMatches = () => {
    if (approvedTeams.length < 2) {
      toast.error('Need at least 2 approved teams to generate a bracket.');
      return;
    }

    // Fisher-Yates shuffle for fair randomization
    const shuffled = [...approvedTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const baseDate = selectedTournamentForBracket?.start_date 
      ? new Date(selectedTournamentForBracket.start_date + 'T09:00')
      : new Date();

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDate = (date: Date) => {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const N = shuffled.length;
    const totalRounds = Math.ceil(Math.log2(N));
    
    // Group proposed matches by round number (1-indexed)
    const matchesByRound: { [r: number]: any[] } = {};

    // Step 1: Create all placeholders for all rounds
    for (let r = 1; r <= totalRounds; r++) {
      matchesByRound[r] = [];
      const numMatches = Math.pow(2, totalRounds - r);
      for (let j = 0; j < numMatches; j++) {
        // Calculate date for the round and match
        const matchDate = new Date(baseDate);
        // Advance by (r - 1) days
        matchDate.setDate(matchDate.getDate() + (r - 1));
        // Advance by j hours within that day
        matchDate.setHours(matchDate.getHours() + j);

        matchesByRound[r].push({
          team_a_id: null,
          team_a_name: 'TBD',
          team_b_id: null,
          team_b_name: 'TBD',
          round: r === totalRounds ? 'Finals' : r === totalRounds - 1 ? 'Semifinals' : `Round ${r}`,
          match_time: formatDate(matchDate),
          local_id: `${r}-${j}`,
        });
      }
    }

    // Step 2: Seed Round 1
    const round1Matches = matchesByRound[1];
    for (let i = 0; i < N; i++) {
      const matchIdx = Math.floor(i / 2);
      const isEven = i % 2 === 0;
      const team = shuffled[i];

      if (isEven) {
        round1Matches[matchIdx].team_a_id = team.id;
        round1Matches[matchIdx].team_a_name = team.name;
      } else {
        round1Matches[matchIdx].team_b_id = team.id;
        round1Matches[matchIdx].team_b_name = team.name;
      }
    }

    // Handle Round 1 BYEs
    for (let j = 0; j < round1Matches.length; j++) {
      if (round1Matches[j].team_a_id && !round1Matches[j].team_b_id) {
        round1Matches[j].team_b_name = 'BYE';
      }
    }

    // Step 3: Link parent/child matches
    for (let r = 1; r < totalRounds; r++) {
      const currentRoundMatches = matchesByRound[r];
      for (let j = 0; j < currentRoundMatches.length; j++) {
        const parentIdx = Math.floor(j / 2);
        const parentSlot = j % 2 === 0 ? 'team_a' : 'team_b';
        currentRoundMatches[j].next_match_local_id = `${r + 1}-${parentIdx}`;
        currentRoundMatches[j].next_match_slot = parentSlot;
      }
    }

    // Step 4: Auto-advance Round 1 BYE winners to Round 2
    if (totalRounds > 1) {
      const r1Matches = matchesByRound[1];
      const r2Matches = matchesByRound[2];
      for (let j = 0; j < r1Matches.length; j++) {
        if (r1Matches[j].team_b_name === 'BYE') {
          const parentIdx = Math.floor(j / 2);
          const parentSlot = r1Matches[j].next_match_slot;
          
          if (parentSlot === 'team_a') {
            r2Matches[parentIdx].team_a_id = r1Matches[j].team_a_id;
            r2Matches[parentIdx].team_a_name = r1Matches[j].team_a_name;
          } else {
            r2Matches[parentIdx].team_b_id = r1Matches[j].team_a_id;
            r2Matches[parentIdx].team_b_name = r1Matches[j].team_a_name;
          }
        }
      }
    }

    // Flatten all matches into a single list in chronological / round order
    const flatProposed: typeof proposedMatches = [];
    for (let r = 1; r <= totalRounds; r++) {
      flatProposed.push(...matchesByRound[r]);
    }

    setProposedMatches(flatProposed);
    setWizardStep(2);
    toast.success(`Generated a full ${totalRounds}-round tournament tree (${flatProposed.length} matches total). Review & schedule below.`);
  };

  const handleUpdateMatchTime = (index: number, newTime: string) => {
    setProposedMatches(prev => prev.map((m, i) => i === index ? { ...m, match_time: newTime } : m));
  };

  const handleSwapTeams = (index: number) => {
    setProposedMatches(prev => prev.map((m, i) => {
      if (i !== index) return m;
      return {
        ...m,
        team_a_id: m.team_b_id,
        team_a_name: m.team_b_name,
        team_b_id: m.team_a_id,
        team_b_name: m.team_a_name,
      };
    }));
  };

  const handleRemoveMatch = (index: number) => {
    setProposedMatches(prev => prev.filter((_, i) => i !== index));
  };

  // Bracket Recommendation Logic based on participant team count
  const getBracketRecommendation = (teamCount: number) => {
    if (teamCount < 2) {
      return {
        type: 'single' as const,
        title: 'Need at least 2 teams',
        reason: 'Recruit and approve more teams during the draft phase to generate a bracket.'
      };
    }
    if (teamCount <= 4) {
      return {
        type: 'round_robin' as const,
        title: 'Round Robin Recommended',
        reason: `With ${teamCount} teams, a Round Robin format guarantees every squad plays each other before finals.`
      };
    }
    if (teamCount >= 5 && teamCount <= 16) {
      return {
        type: 'single' as const,
        title: 'Single Elimination Recommended',
        reason: `Optimal for ${teamCount} teams. High-intensity knockout tree with auto-handled BYEs.`
      };
    }
    return {
      type: 'double' as const,
      title: 'Multi-Pool Elimination Recommended',
      reason: `With ${teamCount} teams, multiple pools or double elimination provides the fairest championship progression.`
    };
  };

  // --- Wizard: Batch Publish to Supabase (2-Pass Batch Insert & Activate Tournament) ---
  const handlePublishBracket = async () => {
    if (!selectedTournamentForBracket || proposedMatches.length === 0) return;
    setIsPublishing(true);

    try {
      // Pass 1: Batch Insert all matches to get database-generated IDs
      const payload = proposedMatches.map(m => {
        const isByeMatch = m.team_b_name === 'BYE';
        return {
          tournament_id: selectedTournamentForBracket.id,
          team_a_id: m.team_a_id,
          team_b_id: m.team_b_id,
          round: m.round,
          status: isByeMatch ? ('Completed' as const) : ('Scheduled' as const),
          team_a_score: isByeMatch ? 1 : 0,
          team_b_score: 0,
          match_time: m.match_time ? new Date(m.match_time).toISOString() : null,
        };
      });

      const { data: insertedData, error: insertError } = await supabase
        .from('matches')
        .insert(payload)
        .select();

      if (insertError) {
        throw insertError;
      }

      if (!insertedData || insertedData.length !== proposedMatches.length) {
        throw new Error('Inserted match count does not match generated count.');
      }

      // Map local_id to database UUID
      const localIdToDbId: { [localId: string]: string } = {};
      insertedData.forEach((dbMatch, idx) => {
        const localMatch = proposedMatches[idx];
        localIdToDbId[localMatch.local_id] = dbMatch.id;
      });

      // Pass 2: Batch Update next_match_id pointer links in parallel
      const updates = proposedMatches
        .filter(m => m.next_match_local_id && localIdToDbId[m.next_match_local_id])
        .map(m => {
          const dbId = localIdToDbId[m.local_id];
          const nextDbId = localIdToDbId[m.next_match_local_id!];
          return supabase
            .from('matches')
            .update({
              next_match_id: nextDbId,
              next_match_slot: m.next_match_slot
            })
            .eq('id', dbId);
        });

      if (updates.length > 0) {
        const updateResults = await Promise.all(updates);
        for (const res of updateResults) {
          if (res.error) throw res.error;
        }
      }

      // Pass 3: Transition Tournament status from 'Draft' to 'Active' so everyone can see!
      const { error: statusError } = await supabase
        .from('tournaments')
        .update({ status: 'Active' })
        .eq('id', selectedTournamentForBracket.id);

      if (statusError) {
        console.warn('Could not update tournament status:', statusError);
      }

      toast.success(`Published full bracket (${proposedMatches.length} matches) and set tournament to ACTIVE!`);
      
      logAudit({
        action: 'GENERATE_BRACKET',
        entity_type: 'matches',
        entity_id: selectedTournamentForBracket.id,
        details: `Published ${proposedMatches.length} matches and activated tournament: ${selectedTournamentForBracket.name}`
      });

      setProposedMatches([]);
      setWizardStep(1);
      setIsBracketOpen(false);
      fetchBracketData(selectedTournamentForBracket.id);
      fetchTournaments();
    } catch (err: any) {
      toast.error('Failed to publish bracket: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const openWizard = (tournament: Tournament) => {
    setSelectedTournamentForBracket(tournament);
    setIsBracketOpen(true);
    setWizardStep(1);
    setProposedMatches([]);
    fetchBracketData(tournament.id);
  };

  return (
    <div className="space-y-6 relative min-h-screen max-w-[1600px] mx-auto px-4">
      {/* Subtle Grain Texture Overlay - Using a reliable data URI for the noise */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Administrative Hub
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
            TOURNAMENT <span className="text-orange-500">ARENA</span>
          </h1>
          <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
            The central command for institutional competitions, team enrollments, and MVP recognition.
          </p>
        </div>
        <div className="flex gap-4 relative z-10">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger 
              render={
                <Button size="lg" className="h-14 bg-orange-500 hover:bg-orange-600 text-white font-black gap-2 px-8 rounded-xl shadow-xl shadow-orange-500/20 uppercase italic tracking-wider transition-all hover:scale-[1.02] active:scale-95 group">
                  <Plus className="size-5 group-hover:rotate-90 transition-transform duration-300" /> 
                  <span className="text-base">Host Event</span>
                </Button>
              }
            />
            <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] rounded-3xl border-slate-200 dark:border-white/10 p-6 shadow-2xl bg-white dark:bg-slate-950">
              <DialogHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500 rounded-lg text-white shadow-sm shadow-orange-500/20">
                      <Sparkles className="size-3.5" />
                    </div>
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                      Host <span className="text-orange-500">Tournament</span>
                    </DialogTitle>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/20">
                    Draft Phase
                  </span>
                </div>
                <DialogDescription className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest">
                  Initialized tournaments enter Draft status ("Coming Soon") for team enrollment.
                </DialogDescription>
              </DialogHeader>

              {/* Mode Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1.5 border border-slate-200/60 dark:border-white/5 my-1">
                <button
                  type="button"
                  onClick={() => { setCreationMode('binturungan'); setEventName('PSU Binturungan 2026'); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase italic tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    creationMode === 'binturungan' 
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 scale-[1.01]' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <Trophy className="size-3.5" /> One-Click Binturungan (All Sports)
                </button>
                <button
                  type="button"
                  onClick={() => { setCreationMode('single'); setEventName('PSU Friendly Games'); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase italic tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    creationMode === 'single' 
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 scale-[1.01]' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <Plus className="size-3.5" /> Custom Single Sport
                </button>
              </div>

              <div className="space-y-3.5 py-1">
                {/* Event Name */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">
                      Event Master Name
                    </Label>
                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">Unique Name</span>
                  </div>
                  <Input 
                    placeholder="e.g., PSU Binturungan 2026" 
                    value={eventName} 
                    onChange={(e) => setEventName(e.target.value)} 
                    className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 focus:ring-orange-500 rounded-xl font-bold text-sm text-slate-900 dark:text-white transition-all" 
                  />
                </div>

                {creationMode === 'binturungan' ? (
                  /* ===== BINTURUNGAN SPORTS CHECKLIST ===== */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em] flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-orange-500" /> 
                        Sports Checklist
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[9px] font-black">
                          {selectedSports.length}/{BINTURUNGAN_DEFAULT_SPORTS.length}
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => setSelectedSports(BINTURUNGAN_DEFAULT_SPORTS.map(s => s.name))} 
                          className="text-[10px] font-black uppercase text-orange-500 hover:underline tracking-wider transition-colors"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button 
                          type="button" 
                          onClick={() => setSelectedSports([])} 
                          className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 tracking-wider transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10">
                      {BINTURUNGAN_DEFAULT_SPORTS.map((sport) => {
                        const isChecked = selectedSports.includes(sport.name);
                        return (
                          <button
                            type="button"
                            key={sport.name}
                            onClick={() => toggleSport(sport.name)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition-all duration-200 active:scale-95 ${
                              isChecked 
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20 font-bold' 
                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-orange-500/40 hover:bg-orange-50/50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm leading-none select-none">{sport.icon}</span>
                              <span className="text-xs font-black uppercase tracking-tight truncate">{sport.name}</span>
                            </div>
                            <div className={`size-3.5 rounded flex items-center justify-center border shrink-0 ml-1 ${
                              isChecked ? 'bg-white text-orange-500 border-white' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900'
                            }`}>
                              {isChecked && <Check className="size-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ===== SINGLE SPORT SELECTOR ===== */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Sport Discipline</Label>
                      <Select value={singleSport} onValueChange={(v) => v && setSingleSport(v)}>
                        <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {BINTURUNGAN_DEFAULT_SPORTS.map(s => (
                            <SelectItem key={s.name} value={s.name} className="rounded-lg font-bold text-xs">
                              {s.icon} {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Tournament Format</Label>
                      <Select value={singleType} onValueChange={(v) => v && setSingleType(v)}>
                        <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Binturungan" className="rounded-lg font-bold text-xs">Binturungan</SelectItem>
                          <SelectItem value="STRASUC" className="rounded-lg font-bold text-xs">STRASUC</SelectItem>
                          <SelectItem value="Faculty and Staff Friendly Games" className="rounded-lg font-bold text-xs">Friendly Games</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Kickoff Date</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Finals Date</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white" 
                      />
                    </div>
                  </div>
                  {startDate && endDate && new Date(startDate) > new Date(endDate) && (
                    <div className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold px-1 pt-0.5 animate-in fade-in">
                      <AlertTriangle className="size-3 shrink-0" />
                      <span>Kickoff date cannot be after finals date.</span>
                    </div>
                  )}
                </div>

                {/* Status Notice */}
                <div className="py-2 px-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                  <Info className="size-4 text-orange-500 shrink-0" />
                  <p className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                    Events launch in <strong>Draft Status ("Coming Soon")</strong>. Coaches can immediately enroll squads.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsCreateOpen(false)} 
                  className="h-11 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  disabled={isCreatingTournaments}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateTournament} 
                  disabled={isCreatingTournaments}
                  className="h-11 flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-orange-500/20 gap-2 transition-all active:scale-[0.98]"
                >
                  {isCreatingTournaments ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                  ) : (
                    <Trophy className="size-4" />
                  )}
                  {isCreatingTournaments ? 'Initializing Events...' : creationMode === 'binturungan' ? `Launch ${selectedSports.length} Binturungan Events (Draft)` : 'Launch Event (Draft)'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="absolute -right-20 -top-20 size-96 bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full relative z-10 flex flex-col">
        <TabsList className="w-full flex justify-start overflow-x-auto whitespace-nowrap bg-transparent border-b-2 border-slate-200 dark:border-white/10 rounded-none h-auto p-0 gap-8 scrollbar-hide mb-8">
          <TabsTrigger 
            value="tournaments" 
            className="shrink-0 rounded-none pb-5 text-sm font-black uppercase tracking-[0.2em] shadow-none transition-all border-b-4 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent"
          >
            <Trophy className="size-4 mr-2 inline-block mb-0.5" /> Institutional Tournaments
          </TabsTrigger>
          <TabsTrigger 
            value="approvals" 
            className="shrink-0 rounded-none pb-5 text-sm font-black uppercase tracking-[0.2em] shadow-none transition-all border-b-4 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white bg-transparent"
          >
            <Users className="size-4 mr-2 inline-block mb-0.5" /> 
            Approvals
            {pendingTeams.length > 0 && (
              <span className="ml-3 px-2 py-0.5 bg-orange-500 text-white text-[10px] rounded-full">
                {pendingTeams.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="mvp" 
            className="shrink-0 rounded-none pb-5 text-sm font-black uppercase tracking-[0.2em] shadow-none transition-all border-b-4 data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white bg-transparent"
          >
            <Star className="size-4 mr-2 inline-block mb-0.5" /> MVP Hall of Fame
          </TabsTrigger>
        </TabsList>

        {activeTab !== 'mvp' && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <DataToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterValue={statusFilter}
              onFilterChange={setStatusFilter}
              filterOptions={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Draft Mode', value: 'Draft' },
                { label: 'Active Games', value: 'Active' },
                { label: 'Completed', value: 'Completed' },
              ]}
              searchPlaceholder={activeTab === 'tournaments' ? "Search tournaments..." : "Search teams or coaches..."}
              actions={
                <ViewToggle view={viewMode} onViewChange={setViewMode} />
              }
            />
          </div>
        )}

        <TabsContent value="tournaments" className="space-y-6 outline-none">
          {isLoadingTournaments ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Syncing Arena Data...</p>
            </div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="border-dashed border-2 py-24 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem]">
              <Trophy className="size-16 text-slate-300 dark:text-slate-800 mx-auto mb-6" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No tournaments match your search criteria.</p>
              <Button variant="link" onClick={() => {setSearchQuery(''); setStatusFilter('all');}} className="mt-2 text-orange-500 font-black uppercase italic tracking-widest text-[10px]">Clear all filters</Button>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((t, idx) => (
                <Card key={t.id} className={`group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4`} style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="h-2 bg-slate-100 dark:bg-white/5 w-full overflow-hidden">
                    <div className={`h-full bg-orange-500 transition-all duration-1000 delay-300 w-0 group-hover:w-full`} />
                  </div>
                  <CardHeader className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl group-hover:bg-orange-500 transition-colors duration-500">
                        <Trophy className="size-5 text-slate-400 group-hover:text-white transition-colors duration-500" />
                      </div>
                      <Badge className={`${t.status === 'Completed' ? 'bg-slate-900' : 'bg-orange-500'} text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-lg shadow-orange-500/10`}>
                        {t.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors">{t.name}</CardTitle>
                    <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">{t.sport} • {t.type}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-4">
                    <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500 mb-8 font-bold text-xs">
                      <CalendarDays className="size-4 text-orange-500" />
                      {new Date(t.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(t.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        className="flex-1 h-14 flex items-center justify-center gap-3 bg-slate-900 hover:bg-orange-500 text-white font-black uppercase italic tracking-[0.1em] rounded-2xl shadow-xl transition-all duration-300 group-hover:shadow-orange-500/20"
                        onClick={() => openWizard(t)}
                      >
                        <LayoutGrid className="size-5" />
                        Setup Bracket
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-14 w-14 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                        title="Terminate Tournament"
                        onClick={() => promptDeleteTournament(t)}
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-x-auto shadow-2xl">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-white/5">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pl-8">Event Name</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Category</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Status</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Kickoff</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 text-right pr-8">Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTournaments.map((t, idx) => (
                    <TableRow 
                      key={t.id} 
                      className="hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors border-slate-100 dark:border-white/5 group animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <TableCell className="font-black italic uppercase tracking-tighter text-lg pl-8 py-5">{t.name}</TableCell>
                      <TableCell className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">{t.sport}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'Completed' ? 'default' : 'secondary'} className="text-[9px] font-black uppercase tracking-tighter px-2">
                           {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-slate-400">{new Date(t.start_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="font-black uppercase italic tracking-widest text-[10px] text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                            onClick={() => openWizard(t)}
                          >
                            Manage <ChevronRight className="size-3 ml-1" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                            title="Terminate Tournament"
                            onClick={() => promptDeleteTournament(t)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          <Dialog open={isBracketOpen} onOpenChange={(open) => { setIsBracketOpen(open); if (!open) { setWizardStep(1); setProposedMatches([]); } }}>
            <DialogContent className="sm:max-w-4xl overflow-y-auto max-h-[90vh] rounded-[2rem] border-slate-200 dark:border-white/10 p-0">
              {/* Wizard Header */}
              <div className="bg-slate-950 text-white px-8 py-6 rounded-t-[2rem] relative overflow-hidden">
                <div className="absolute -right-16 -top-16 size-64 bg-orange-500/10 rounded-full blur-[80px]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Shuffle className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-500 font-bold text-[10px] tracking-[0.2em] uppercase">Tournament Setup Wizard</span>
                  </div>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tight text-white">{selectedTournamentForBracket?.name}</DialogTitle>
                    <DialogDescription className="text-slate-400 text-xs font-medium mt-1">
                      {wizardStep === 1 ? 'Step 1: Review format & teams, then auto-seed the bracket.' : 'Step 2: Review matchups, set schedules, then publish.'}
                    </DialogDescription>
                  </DialogHeader>
                  {/* Step Indicators */}
                  <div className="flex items-center gap-3 mt-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${wizardStep === 1 ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
                      1. Format
                    </div>
                    <div className="h-px w-6 bg-white/20" />
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${wizardStep === 2 ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
                      2. Schedule
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 space-y-6">
                {isLoadingBracket ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Loading bracket data...</p>
                  </div>
                ) : wizardStep === 1 ? (
                  /* ===== STEP 1: Format & Teams ===== */
                  <div className="space-y-6">
                    {/* System Recommendation Banner */}
                    {(() => {
                      const rec = getBracketRecommendation(approvedTeams.length);
                      return (
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/30 flex items-start gap-4">
                          <div className="p-3 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-500/20 shrink-0">
                            <Lightbulb className="size-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">System Recommendation</span>
                              <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
                                {approvedTeams.length} Teams Ready
                              </Badge>
                            </div>
                            <h4 className="font-black italic uppercase text-lg text-slate-900 dark:text-white mt-0.5">
                              {rec.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                              {rec.reason}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Format Selector Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Single Elimination */}
                      <button
                        type="button"
                        onClick={() => setSelectedBracketType('single')}
                        className={`p-5 rounded-2xl border-2 text-left relative transition-all ${
                          selectedBracketType === 'single'
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 shadow-md shadow-orange-500/10'
                            : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {selectedBracketType === 'single' && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-5 text-orange-500" />
                          </div>
                        )}
                        <LayoutGrid className="size-8 text-orange-500 mb-3" />
                        <div className="flex items-center gap-2">
                          <h4 className="font-black uppercase italic tracking-tight text-lg text-slate-900 dark:text-white">Single Elimination</h4>
                          {approvedTeams.length >= 4 && approvedTeams.length <= 16 && (
                            <Badge className="bg-orange-500 text-white text-[8px] font-black uppercase">Suggested</Badge>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">Standard knockout tree. Loser is eliminated, winners advance.</p>
                      </button>

                      {/* Round Robin */}
                      <button
                        type="button"
                        onClick={() => setSelectedBracketType('round_robin')}
                        className={`p-5 rounded-2xl border-2 text-left relative transition-all ${
                          selectedBracketType === 'round_robin'
                            ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 shadow-md shadow-orange-500/10'
                            : 'border-slate-200 dark:border-white/5 hover:border-orange-500/30 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {selectedBracketType === 'round_robin' && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-5 text-orange-500" />
                          </div>
                        )}
                        <Shuffle className="size-8 text-orange-500 mb-3" />
                        <div className="flex items-center gap-2">
                          <h4 className="font-black uppercase italic tracking-tight text-lg text-slate-900 dark:text-white">Round Robin / Pools</h4>
                          {approvedTeams.length > 0 && approvedTeams.length <= 4 && (
                            <Badge className="bg-emerald-600 text-white text-[8px] font-black uppercase">Suggested</Badge>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">All vs All format. Every squad battles each team before finals.</p>
                      </button>
                    </div>

                    {/* Approved Teams Count */}
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-100 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Approved Teams for This Event</p>
                          <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums">{approvedTeams.length}</span>
                            <span className="text-sm font-bold text-slate-400">teams ready</span>
                          </div>
                        </div>
                        <Users className="size-12 text-slate-200 dark:text-white/10" />
                      </div>
                      {approvedTeams.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                          {approvedTeams.map(t => (
                            <span key={t.id} className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Existing Matches */}
                    {existingMatches.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                          <Trophy className="size-3 text-orange-500" /> Published Matches ({existingMatches.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {existingMatches.map((match) => (
                            <div key={match.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-xl">
                              <span className="font-black text-sm text-slate-700 dark:text-slate-200">{match.team_a_name}</span>
                              <span className="text-[10px] font-black text-slate-300 italic mx-3">VS</span>
                              <span className="font-black text-sm text-slate-700 dark:text-slate-200">{match.team_b_name}</span>
                              <div className="flex items-center gap-2 ml-4">
                                <Badge variant="outline" className="text-[9px] font-black">{match.round}</Badge>
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-orange-500" onClick={() => navigate(`/match/${match.id}`)}>
                                  <ChevronRight className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ===== STEP 2: Scheduling & Review ===== */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {proposedMatches.length} Matchups Generated
                      </h4>
                      <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-orange-500 h-8" onClick={() => { setWizardStep(1); setProposedMatches([]); }}>
                        ← Re-Seed
                      </Button>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {proposedMatches.map((match, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl hover:shadow-md transition-shadow">
                          {/* Match Number */}
                          <div className="flex items-center justify-center size-10 rounded-full bg-slate-100 dark:bg-white/5 text-sm font-black text-slate-400 shrink-0">
                            {idx + 1}
                          </div>
                          {/* Matchup */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-black text-sm text-slate-900 dark:text-white uppercase italic tracking-tight truncate flex-1 text-right">{match.team_a_name}</span>
                            <span className="text-[10px] font-black text-slate-300 italic px-2">VS</span>
                            <span className={`font-black text-sm uppercase italic tracking-tight truncate flex-1 ${match.team_b_id ? 'text-slate-900 dark:text-white' : 'text-orange-500'}`}>{match.team_b_name}</span>
                          </div>
                          {/* DateTime Picker */}
                          <input
                            type="datetime-local"
                            value={match.match_time}
                            onChange={(e) => handleUpdateMatchTime(idx, e.target.value)}
                            className="h-10 px-3 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all w-full md:w-52"
                          />
                          {/* Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            {match.team_b_id && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-orange-500" title="Swap Teams" onClick={() => handleSwapTeams(idx)}>
                                <Shuffle className="size-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500" title="Remove Match" onClick={() => handleRemoveMatch(idx)}>
                              <XCircle className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer */}
              <DialogFooter className="px-8 py-5 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] rounded-b-[2rem] gap-3">
                <Button variant="ghost" onClick={() => { setIsBracketOpen(false); setWizardStep(1); setProposedMatches([]); }} className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 dark:hover:bg-white/5">
                  Cancel
                </Button>
                {wizardStep === 1 ? (
                  <Button
                    onClick={generateSeededMatches}
                    disabled={approvedTeams.length < 2}
                    className="h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-[0.1em] shadow-lg shadow-orange-500/20 gap-2"
                  >
                    <Shuffle className="size-4" />
                    Auto-Seed Bracket
                  </Button>
                ) : (
                  <Button
                    onClick={handlePublishBracket}
                    disabled={isPublishing || proposedMatches.length === 0}
                    className="h-12 flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic tracking-[0.1em] shadow-lg shadow-orange-500/20 gap-2"
                  >
                    {isPublishing ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" /> : <CheckCircle2 className="size-4" />}
                    {isPublishing ? 'Publishing...' : `Publish ${proposedMatches.length} Matches`}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-6 outline-none">
          {isLoadingTeams ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Scanning Roster Database...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <Card className="border-dashed border-2 py-24 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem]">
              <Users className="size-16 text-slate-300 dark:text-slate-800 mx-auto mb-6" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No pending applications match your search.</p>
              <Button variant="link" onClick={() => setSearchQuery('')} className="mt-2 text-orange-500 font-black uppercase italic tracking-widest text-[10px]">Clear search</Button>
            </Card>
          ) : viewMode === 'list' ? (
            <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl bg-white dark:bg-slate-900">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-white/5">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-16 pl-10">Team Identity</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-16">Lead Coach</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-16">Target Event</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-16 text-right pr-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team, idx) => (
                    <TableRow 
                      key={team.id} 
                      className="hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors border-slate-100 dark:border-white/5 group animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <TableCell className="pl-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black italic uppercase tracking-tighter text-xl group-hover:text-orange-500 transition-colors">{team.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {team.id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                            {(Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'NA')[0]}
                          </div>
                          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                            {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-tighter border-slate-200 dark:border-white/10 px-3 py-1 bg-white dark:bg-slate-950">
                          {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-10">
                        <div className="flex justify-end gap-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10"
                            onClick={() => handleApproveTeam(team.id)}
                          >
                            <CheckCircle2 className="size-4 mr-2" /> Approve
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-destructive hover:bg-destructive/10"
                            onClick={() => handleRejectTeam(team.id)}
                          >
                            <XCircle className="size-4 mr-2" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team, idx) => (
                <Card key={team.id} className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms` }}>
                  <CardHeader className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="size-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                        <Users className="size-6 text-orange-500" />
                      </div>
                      <Badge className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full border-none shadow-none">
                        Pending
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors">{team.name}</CardTitle>
                    <CardDescription className="font-bold text-slate-500 uppercase text-[10px] tracking-widest mt-1">
                      {Array.isArray(team.tournaments) ? team.tournaments[0]?.name : team.tournaments?.name || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-4">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl mb-8">
                      <div className="size-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-black text-orange-500 border border-slate-100 dark:border-white/5">
                        {(Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'NA')[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Coach</span>
                        <span className="font-black text-sm uppercase italic tracking-tighter">
                          {Array.isArray(team.users) ? team.users[0]?.full_name : team.users?.full_name || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 h-12 bg-slate-900 hover:bg-green-600 text-white font-black uppercase italic tracking-widest text-[10px] rounded-xl shadow-lg transition-all"
                        onClick={() => handleApproveTeam(team.id)}
                      >
                        Approve
                      </Button>
                      <Button 
                        variant="ghost"
                        className="h-12 px-5 text-destructive font-black uppercase italic tracking-widest text-[10px] rounded-xl hover:bg-destructive/10"
                        onClick={() => handleRejectTeam(team.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mvp" className="space-y-6 outline-none">
          <div className="grid lg:grid-cols-5 gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-10 bg-slate-950 text-white rounded-[3rem] shadow-2xl relative overflow-hidden group border border-white/5">
                <div className="relative z-10">
                  <div className="size-16 rounded-3xl bg-orange-500 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Trophy className="size-8 text-white" />
                  </div>
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-4">Gold Star <br /> <span className="text-orange-500 text-5xl">Recognition</span></h3>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest leading-relaxed opacity-60">
                    The ultimate honor for a PSU athlete. Awarding a Gold Star signifies peak performance and institutional mastery.
                  </p>
                </div>
                <Star className="absolute -bottom-10 -right-10 size-48 text-white/5 group-hover:text-orange-500/10 transition-colors duration-1000 rotate-12 group-hover:rotate-45" />
              </div>
              
              <div className="p-8 bg-orange-50 dark:bg-orange-500/5 rounded-[2.5rem] border-2 border-orange-200/50 dark:border-orange-500/10">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-orange-200 dark:bg-orange-500/20 rounded-xl mt-1">
                    <Star className="size-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase italic text-lg tracking-tight text-orange-900 dark:text-orange-400">Institutional Impact</h4>
                    <p className="text-xs font-bold text-orange-800/60 dark:text-orange-400/60 uppercase tracking-widest mt-1">
                      Awarded players receive a permanent "Tournament MVP" badge on their profile dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="lg:col-span-3 rounded-[3rem] border-2 border-slate-100 dark:border-white/5 shadow-2xl overflow-hidden p-1">
              <CardContent className="space-y-8 p-12">
                <div className="grid md:grid-cols-1 gap-8">
                  <div className="space-y-4">
                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] ml-1">1. Select Tournament Arena</Label>
                    <Select value={selectedTournamentId} onValueChange={(val) => setSelectedTournamentId(val ?? '')}>
                      <SelectTrigger className="border-2 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5 font-black uppercase italic tracking-tight text-lg focus:ring-orange-500 transition-all">
                        <SelectValue placeholder="Browse Competitions...">
                          {selectedTournamentId && (tournaments || []).find(t => t.id === selectedTournamentId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {(tournaments || []).map(t => (
                          <SelectItem key={t.id} value={t.id} className="rounded-xl font-bold uppercase italic text-sm">{t.name} ({t.sport})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] ml-1">2. Nominate Top Performer</Label>
                    <Select 
                      value={selectedPlayerForGoldId} 
                      onValueChange={(val) => setSelectedPlayerForGoldId(val ?? '')}
                      disabled={!selectedTournamentId}
                    >
                      <SelectTrigger className="border-2 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-white/5 font-black uppercase italic tracking-tight text-lg focus:ring-orange-500 transition-all disabled:opacity-30">
                        <SelectValue placeholder={selectedTournamentId ? "Select MVP Candidate..." : "Select tournament first"}>
                          {selectedPlayerForGoldId && (() => {
                            const p = (tournamentPlayers || []).find(p => p.player_id === selectedPlayerForGoldId);
                            if (!p) return null;
                            return Array.isArray(p.users) ? p.users[0]?.full_name : p.users?.full_name;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {(tournamentPlayers || []).length === 0 ? (
                          <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No verified players found in this arena.</div>
                        ) : (
                          (tournamentPlayers || []).map((p: any) => (
                            <SelectItem key={p.player_id} value={p.player_id} className="rounded-xl font-bold uppercase italic text-sm">
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

                <div className="pt-6">
                  <Button 
                    className="w-full h-20 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl italic uppercase tracking-tighter gap-4 shadow-2xl shadow-orange-500/30 rounded-[2rem] transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                    disabled={!selectedPlayerForGoldId || isAwardingGold}
                    onClick={handleAwardGoldStar}
                  >
                    <Star className={`size-8 ${isAwardingGold ? 'animate-spin' : 'fill-white animate-pulse'}`} />
                    {isAwardingGold ? 'Committing to Hall of Fame...' : 'Award Tournament MVP'}
                  </Button>
                  <div className="flex items-center justify-center gap-2 mt-6 opacity-40">
                    <CheckCircle2 className="size-3 text-slate-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                      Permanent Blockchain-verified record
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete / Terminate Tournament Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { setIsDeleteOpen(open); if (!open) { setTournamentToDelete(null); setDeleteConfirmationInput(''); } }}>
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl border-rose-200 dark:border-rose-500/20 p-6 shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
                <AlertTriangle className="size-5" />
              </div>
              <DialogTitle className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                Terminate <span className="text-rose-600">Tournament</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Are you sure you want to permanently terminate <strong className="text-slate-900 dark:text-white font-bold">{tournamentToDelete?.name}</strong>? This action will purge all registered teams, brackets, matches, and player records for this event.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 p-3 bg-rose-500/5 rounded-2xl border border-rose-500/15 space-y-2">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Type <span className="font-mono font-black text-rose-700 dark:text-rose-300">DELETE</span> to confirm:
            </p>
            <Input
              placeholder="DELETE"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              className="h-10 bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-500/30 rounded-xl font-mono font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <Button
              variant="ghost"
              onClick={() => { setIsDeleteOpen(false); setTournamentToDelete(null); }}
              className="h-10 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 dark:hover:bg-white/5"
              disabled={isDeletingTournament}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteTournament}
              disabled={deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' || isDeletingTournament}
              className="h-10 flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-rose-600/20 gap-2 transition-all active:scale-[0.98]"
            >
              {isDeletingTournament ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {isDeletingTournament ? 'Terminating...' : 'Confirm Termination'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
