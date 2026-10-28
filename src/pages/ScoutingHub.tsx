import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  Users,
  Trophy,
  Star,
  GraduationCap,
  ShieldCheck,
  Activity,
  Calendar,
  MapPin,
  Eye,
  UserCheck,
  UserPlus,
  Loader2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExpandableIconTabs } from '@/components/ui/expandable-icon-tabs';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import {
  fetchBatchPlayerSummaries,
  getPrimarySportStatPill,
  AVAILABLE_SPORTS,
  extractCollegeCode,
  type PlayerDirectorySummary,
} from '@/lib/playerStatsEngine';
import { PlayerDossierModal } from '@/components/scouting/PlayerDossierModal';
import { MatchBoxScoreModal } from '@/components/scouting/MatchBoxScoreModal';
import { formatCoachName } from '@/lib/utils';

type ScoutPlayer = {
  id: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  college_id: string | null;
  program: string | null;
  year_level: string | null;
  preferred_sports: string[] | null;
  primary_position: string | null;
  colleges: { college_name: string } | null;
};

type ScoutCoach = {
  id: string;
  full_name: string;
  is_verified: boolean;
  college_id: string | null;
  colleges: { college_name: string } | null;
};

type ScoutTeam = {
  id: string;
  name: string;
  status: string;
  coach_id: string | null;
  tournament_id: string;
  affiliation_type?: 'college' | 'cluster' | null;
  college_id?: string | null;
  cluster_id?: string | null;
  coach?: { full_name: string } | null;
  tournaments?: { id: string; name: string; sport: string; status: string; is_deleted?: boolean } | null;
  colleges?: { college_name: string } | null;
  clusters?: { name: string } | null;
};

type ScoutMatch = {
  id: string;
  round: string;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  match_time: string | null;
  venue: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_score: number;
  team_b_score: number;
  winner_team_id: string | null;
  tournament_id: string;
  team_a?: { id: string; name: string } | null;
  team_b?: { id: string; name: string } | null;
  tournaments?: { id: string; name: string; sport: string; is_deleted?: boolean } | null;
};

type CollegeOption = {
  id: string;
  college_name: string;
};

type ClusterOption = {
  id: string;
  name: string;
  college_codes: string[];
};

export const ScoutingHub = () => {
  const { user, isVerified, isCoach } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [collegeOrClusterFilter, setCollegeOrClusterFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [playerSortBy, setPlayerSortBy] = useState<'points' | 'ppg' | 'threes' | 'mvp' | 'name'>('points');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'Completed' | 'Ongoing' | 'all'>('Completed');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Coach Recruitment State
  const [coachTeams, setCoachTeams] = useState<{ id: string; name: string; sport: string; tournament_id: string }[]>([]);
  const [coachRecruitPlayerId, setCoachRecruitPlayerId] = useState<string | null>(null);
  const [selectedCoachTeamId, setSelectedCoachTeamId] = useState<string>('');
  const [isSubmittingRecruit, setIsSubmittingRecruit] = useState(false);

  const activeFilterCount =
    (sportFilter !== 'all' ? 1 : 0) +
    (collegeOrClusterFilter !== 'all' ? 1 : 0) +
    (positionFilter !== 'all' ? 1 : 0) +
    (activeTab === 'players' && playerSortBy !== 'points' ? 1 : 0) +
    (activeTab === 'matches' && matchStatusFilter !== 'Completed' ? 1 : 0);

  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState<ScoutPlayer[]>([]);
  const [playerSummaries, setPlayerSummaries] = useState<Record<string, PlayerDirectorySummary>>({});
  const [coaches, setCoaches] = useState<ScoutCoach[]>([]);
  const [teams, setTeams] = useState<ScoutTeam[]>([]);
  const [matches, setMatches] = useState<ScoutMatch[]>([]);
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [clusters, setClusters] = useState<ClusterOption[]>([]);
  const [rostersByTeam, setRostersByTeam] = useState<
    Record<
      string,
      {
        playerId: string;
        playerName: string;
        jerseyNumber: number | null;
        position: string | null;
        isCaptain: boolean;
      }[]
    >
  >({});

  // Modals
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedTeamModal, setSelectedTeamModal] = useState<ScoutTeam | null>(null);

  useEffect(() => {
    void fetchArchiveData();
  }, []);

  // Fetch coach squads for direct recruitment
  useEffect(() => {
    if (!isCoach || !user?.id) return;
    const loadCoachTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          status,
          tournament_id,
          tournaments (
            id,
            name,
            sport,
            status,
            is_deleted
          )
        `)
        .eq('coach_id', user.id)
        .neq('status', 'Rejected')
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (data) {
        const mapped = data.map((t: any) => {
          const tourney = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
          return {
            id: t.id,
            name: t.name,
            sport: tourney?.sport || 'Sport',
            tournament_id: t.tournament_id,
          };
        });
        setCoachTeams(mapped);
        if (mapped.length > 0) {
          setSelectedCoachTeamId(mapped[0].id);
        }
      }
    };
    void loadCoachTeams();
  }, [isCoach, user?.id]);

  const handleStartCoachRecruit = (playerId: string) => {
    if (isCoach && !isVerified) {
      toast.error('Coach verification required to recruit athletes. Please submit your Coach ID for clearance.');
      return;
    }
    setCoachRecruitPlayerId(playerId);
    if (coachTeams.length > 0 && !selectedCoachTeamId) {
      setSelectedCoachTeamId(coachTeams[0].id);
    }
  };

  const handleSendDirectRecruit = async () => {
    if (isCoach && !isVerified) {
      toast.error('Coach verification required to recruit athletes. Please submit your Coach ID for clearance.');
      return;
    }
    if (!coachRecruitPlayerId || !selectedCoachTeamId) {
      toast.error('Please select a team to recruit the athlete to.');
      return;
    }

    const targetTeam = coachTeams.find((t) => t.id === selectedCoachTeamId);
    const targetSport = targetTeam?.sport;

    setIsSubmittingRecruit(true);
    try {
      if (targetSport) {
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
          .eq('player_id', coachRecruitPlayerId)
          .neq('status', 'Rejected');

        if (checkError) {
          toast.error('Error verifying athlete eligibility: ' + checkError.message);
          setIsSubmittingRecruit(false);
          return;
        }

        const alreadyInvited = existingRosters?.some((r: any) => r.team_id === selectedCoachTeamId);
        if (alreadyInvited) {
          toast.error('This athlete already has an invitation or is on this squad.');
          setIsSubmittingRecruit(false);
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
          toast.error(`Cannot recruit: Athlete is already approved on an active ${targetSport} team.`);
          setIsSubmittingRecruit(false);
          return;
        }
      }

      const { error: insertError } = await supabase.from('team_roster').insert({
        team_id: selectedCoachTeamId,
        player_id: coachRecruitPlayerId,
        status: 'Pending',
      });

      if (insertError) {
        toast.error('Failed to recruit athlete: ' + insertError.message);
      } else {
        toast.success('Recruitment invitation dispatched successfully!');
        setCoachRecruitPlayerId(null);
      }
    } catch (err: any) {
      toast.error('Recruitment failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingRecruit(false);
    }
  };

  const fetchArchiveData = async () => {
    setIsLoading(true);
    try {
      const [
        playersRes,
        summaries,
        coachesRes,
        teamsRes,
        matchesRes,
        collegesRes,
        clustersRes,
        rostersRes,
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, role, is_verified, college_id, program, year_level, preferred_sports, primary_position, colleges(college_name)')
          .in('role', ['player_student', 'player_faculty', 'player_staff', 'Player'])
          .eq('is_verified', true)
          .neq('account_status', 'inactive')
          .neq('account_status', 'soft_deleted')
          .order('full_name'),
        fetchBatchPlayerSummaries(),
        supabase
          .from('users')
          .select('id, full_name, is_verified, college_id, colleges(college_name)')
          .eq('role', 'coach')
          .neq('account_status', 'inactive')
          .neq('account_status', 'soft_deleted')
          .order('full_name'),
        supabase
          .from('teams')
          .select(`
            id,
            name,
            status,
            is_deleted,
            coach_id,
            tournament_id,
            affiliation_type,
            college_id,
            cluster_id,
            coach:users!teams_coach_id_fkey(full_name),
            tournaments(id, name, sport, status, is_deleted),
            colleges(college_name),
            clusters(name)
          `)
          .neq('status', 'Rejected')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false }),
        supabase
          .from('matches')
          .select(`
            id,
            round,
            status,
            match_time,
            venue,
            team_a_id,
            team_b_id,
            team_a_score,
            team_b_score,
            winner_team_id,
            tournament_id,
            team_a:teams!matches_team_a_id_fkey(id, name),
            team_b:teams!matches_team_b_id_fkey(id, name),
            tournaments(id, name, sport, is_deleted)
          `)
          .in('status', ['Completed', 'Ongoing', 'Scheduled'])
          .order('match_time', { ascending: false }),
        supabase.from('colleges').select('id, college_name').order('college_name'),
        supabase.from('clusters').select('id, name, college_codes').order('name'),
        supabase
          .from('team_roster')
          .select('team_id, player_id, jersey_number, position, is_captain, status, users(full_name)')
          .eq('status', 'Approved'),
      ]);

      if (playersRes.data) {
        setPlayers(
          (playersRes.data as any[]).map((p) => ({
            ...p,
            colleges: Array.isArray(p.colleges) ? p.colleges[0] : p.colleges,
          }))
        );
      }
      setPlayerSummaries(summaries);

      if (coachesRes.data) {
        setCoaches(
          (coachesRes.data as any[]).map((c) => ({
            ...c,
            colleges: Array.isArray(c.colleges) ? c.colleges[0] : c.colleges,
          }))
        );
      }

      if (teamsRes.data) {
        const validTeams = (teamsRes.data as any[])
          .map((t) => ({
            ...t,
            coach: Array.isArray(t.coach) ? t.coach[0] : t.coach,
            tournaments: Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments,
            colleges: Array.isArray(t.colleges) ? t.colleges[0] : t.colleges,
            clusters: Array.isArray(t.clusters) ? t.clusters[0] : t.clusters,
          }))
          .filter((t) => !t.tournaments?.is_deleted);
        setTeams(validTeams);
      }

      if (matchesRes.data) {
        const validMatches = (matchesRes.data as any[])
          .map((m) => ({
            ...m,
            team_a: Array.isArray(m.team_a) ? m.team_a[0] : m.team_a,
            team_b: Array.isArray(m.team_b) ? m.team_b[0] : m.team_b,
            tournaments: Array.isArray(m.tournaments) ? m.tournaments[0] : m.tournaments,
          }))
          .filter(
            (m) =>
              !m.tournaments?.is_deleted &&
              !String(m.round || '').startsWith('[ARCHIVED]') &&
              (m.team_a_id || m.team_b_id)
          );
        setMatches(validMatches);
      }

      if (collegesRes.data) setColleges(collegesRes.data as CollegeOption[]);
      if (clustersRes.data) setClusters(clustersRes.data as ClusterOption[]);

      if (rostersRes.data) {
        const rMap: Record<string, any[]> = {};
        for (const r of rostersRes.data as any[]) {
          if (!r.team_id) continue;
          if (!rMap[r.team_id]) rMap[r.team_id] = [];
          const u = Array.isArray(r.users) ? r.users[0] : r.users;
          rMap[r.team_id].push({
            playerId: r.player_id,
            playerName: u?.full_name || 'Athlete',
            jerseyNumber: r.jersey_number ?? null,
            position: r.position || null,
            isCaptain: Boolean(r.is_captain),
          });
        }
        setRostersByTeam(rMap);
      }
    } catch (err) {
      console.error('Error loading scouting archive:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-compute Team W-L records from completed matches
  const teamRecordsMap = useMemo(() => {
    const map: Record<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }> = {};
    const ensure = (id: string) => {
      if (!map[id]) map[id] = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
      return map[id];
    };

    for (const m of matches) {
      if (m.status !== 'Completed') continue;
      if (m.team_a_id) {
        const recA = ensure(m.team_a_id);
        recA.pointsFor += Number(m.team_a_score || 0);
        recA.pointsAgainst += Number(m.team_b_score || 0);
        const aWon =
          m.winner_team_id === m.team_a_id ||
          (!m.winner_team_id && m.team_a_score > m.team_b_score);
        const bWon =
          m.winner_team_id === m.team_b_id ||
          (!m.winner_team_id && m.team_b_score > m.team_a_score);
        if (aWon) recA.wins += 1;
        else if (bWon) recA.losses += 1;
      }
      if (m.team_b_id) {
        const recB = ensure(m.team_b_id);
        recB.pointsFor += Number(m.team_b_score || 0);
        recB.pointsAgainst += Number(m.team_a_score || 0);
        const bWon =
          m.winner_team_id === m.team_b_id ||
          (!m.winner_team_id && m.team_b_score > m.team_a_score);
        const aWon =
          m.winner_team_id === m.team_a_id ||
          (!m.winner_team_id && m.team_a_score > m.team_b_score);
        if (bWon) recB.wins += 1;
        else if (aWon) recB.losses += 1;
      }
    }
    return map;
  }, [matches]);

  // Helper to check if a college matches collegeOrClusterFilter
  const matchesAffiliationFilter = (collegeId?: string | null, collegeName?: string | null, clusterId?: string | null) => {
    if (collegeOrClusterFilter === 'all') return true;
    if (collegeOrClusterFilter.startsWith('college:')) {
      const targetCollegeId = collegeOrClusterFilter.replace('college:', '');
      return collegeId === targetCollegeId;
    }
    if (collegeOrClusterFilter.startsWith('cluster:')) {
      const targetClusterId = collegeOrClusterFilter.replace('cluster:', '');
      if (clusterId && clusterId === targetClusterId) return true;
      const cl = clusters.find((c) => c.id === targetClusterId);
      if (!cl) return false;
      const code = extractCollegeCode(collegeName);
      return Boolean(code && cl.college_codes.map((x) => x.toUpperCase()).includes(code));
    }
    return true;
  };

  // 1. Filtered Players
  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = players.filter((p) => {
      const colName = p.colleges?.college_name || '';
      const sum = playerSummaries[p.id];
      const prefSports = Array.isArray(p.preferred_sports) ? p.preferred_sports : [];
      const allSports = Array.from(new Set([...prefSports, ...(sum?.activeSports || [])]));
      const allPos = Array.from(
        new Set([...(p.primary_position ? [p.primary_position] : []), ...(sum?.positions || [])])
      );

      if (q) {
        const hit =
          p.full_name.toLowerCase().includes(q) ||
          colName.toLowerCase().includes(q) ||
          (p.program || '').toLowerCase().includes(q) ||
          allSports.some((s) => s.toLowerCase().includes(q)) ||
          (sum?.activeTeamNames || []).some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }

      if (!matchesAffiliationFilter(p.college_id, colName, null)) return false;

      if (sportFilter !== 'all') {
        if (!allSports.some((s) => s.toLowerCase() === sportFilter.toLowerCase())) return false;
      }

      if (positionFilter !== 'all') {
        if (!allPos.some((pos) => pos.toLowerCase().includes(positionFilter.toLowerCase()))) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      const sA = playerSummaries[a.id];
      const sB = playerSummaries[b.id];
      if (playerSortBy === 'points') return (sB?.totalPoints || 0) - (sA?.totalPoints || 0);
      if (playerSortBy === 'ppg') return (sB?.ppg || 0) - (sA?.ppg || 0);
      if (playerSortBy === 'threes') return (sB?.threePointers || 0) - (sA?.threePointers || 0);
      if (playerSortBy === 'mvp') return (sB?.mvpCount || 0) - (sA?.mvpCount || 0);
      return a.full_name.localeCompare(b.full_name);
    });
  }, [players, playerSummaries, searchQuery, collegeOrClusterFilter, sportFilter, positionFilter, playerSortBy, clusters]);

  // 2. Filtered Coaches
  const filteredCoaches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return coaches.filter((c) => {
      const colName = c.colleges?.college_name || '';
      const coachTeams = teams.filter((t) => t.coach_id === c.id);

      if (q) {
        const hit =
          c.full_name.toLowerCase().includes(q) ||
          colName.toLowerCase().includes(q) ||
          coachTeams.some((t) => t.name.toLowerCase().includes(q));
        if (!hit) return false;
      }

      if (!matchesAffiliationFilter(c.college_id, colName, null)) return false;

      if (sportFilter !== 'all') {
        const hasSport = coachTeams.some(
          (t) => (t.tournaments?.sport || '').toLowerCase() === sportFilter.toLowerCase()
        );
        if (!hasSport) return false;
      }

      return true;
    });
  }, [coaches, teams, searchQuery, collegeOrClusterFilter, sportFilter, clusters]);

  // 3. Filtered Teams
  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teams.filter((t) => {
      const colName = t.colleges?.college_name || '';
      const clusName = t.clusters?.name || '';
      const sport = t.tournaments?.sport || '';
      const tourneyName = t.tournaments?.name || '';
      const coachName = t.coach?.full_name || '';

      if (q) {
        const hit =
          t.name.toLowerCase().includes(q) ||
          colName.toLowerCase().includes(q) ||
          clusName.toLowerCase().includes(q) ||
          tourneyName.toLowerCase().includes(q) ||
          coachName.toLowerCase().includes(q) ||
          sport.toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (!matchesAffiliationFilter(t.college_id, colName, t.cluster_id)) return false;

      if (sportFilter !== 'all' && sport.toLowerCase() !== sportFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [teams, searchQuery, collegeOrClusterFilter, sportFilter, clusters]);

  // 4. Filtered Matches (Old / Completed & Ongoing Matches)
  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (matchStatusFilter !== 'all' && m.status !== matchStatusFilter) return false;
      const teamAName = m.team_a?.name || 'TBD';
      const teamBName = m.team_b?.name || 'TBD';
      const tourneyName = m.tournaments?.name || '';
      const sport = m.tournaments?.sport || '';

      if (q) {
        const hit =
          teamAName.toLowerCase().includes(q) ||
          teamBName.toLowerCase().includes(q) ||
          tourneyName.toLowerCase().includes(q) ||
          (m.round || '').toLowerCase().includes(q) ||
          (m.venue || '').toLowerCase().includes(q) ||
          sport.toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (sportFilter !== 'all' && sport.toLowerCase() !== sportFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [matches, matchStatusFilter, searchQuery, sportFilter]);

  return (
    <div className="space-y-6 pb-8 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Compact Hero Banner */}
      <div className="bg-slate-950 text-white py-3.5 sm:py-5 md:py-7 px-4 sm:px-6 md:px-10 rounded-2xl sm:rounded-[2rem] shadow-xl border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-5">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Search className="size-3.5 sm:size-4 text-orange-500" />
              <span className="text-orange-500 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase">
                Official PSU Athletics Directory
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black italic tracking-tighter uppercase leading-none">
              ATHLETICS <span className="text-orange-500">HUB</span>
            </h1>
            <p className="hidden sm:block text-slate-400 text-xs sm:text-sm font-medium mt-1.5 max-w-2xl">
              Official Palawan State University Athlete Directory, Coach Roster &amp; Match Statistics Archive.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 shrink-0">
            <div className="px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-center">
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest text-slate-400">Athletes</p>
              <p className="text-sm sm:text-xl font-black text-white tabular-nums leading-tight">{players.length}</p>
            </div>
            <div className="px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-center">
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest text-slate-400">Coaches</p>
              <p className="text-sm sm:text-xl font-black text-orange-400 tabular-nums leading-tight">{coaches.length}</p>
            </div>
            <div className="px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-center">
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest text-slate-400">Squads</p>
              <p className="text-sm sm:text-xl font-black text-cyan-400 tabular-nums leading-tight">{teams.length}</p>
            </div>
            <div className="px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-center">
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest text-slate-400">Matches</p>
              <p className="text-sm sm:text-xl font-black text-emerald-400 tabular-nums leading-tight">{matches.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Search & Collapsible Filter Bar */}
      <Card className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        {/* Search Bar + Mobile Filter Toggle Row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players, coaches, teams, matches..."
              className="pl-9 pr-8 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center text-xs"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsFiltersExpanded((prev) => !prev)}
            className={`lg:hidden h-10 px-3 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 gap-1.5 transition-all ${
              isFiltersExpanded || activeFilterCount > 0
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
                : 'border-slate-200 dark:border-white/10'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden xs:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0 rounded-full ml-0.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter Dropdowns Grid: Collapsible on mobile, always visible on lg */}
        <div className={`${isFiltersExpanded ? 'grid' : 'hidden lg:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-200`}>
          {/* Sport Filter */}
          <Select value={sportFilter} onValueChange={(v) => setSportFilter(v || 'all')}>
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
              <SelectValue placeholder="All Sports" />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-64">
              <SelectItem value="all" className="text-xs font-bold">All Sports</SelectItem>
              {AVAILABLE_SPORTS.map((sp) => (
                <SelectItem key={sp} value={sp} className="text-xs font-bold">
                  {sp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* College / Binturungan Tribe Filter */}
          <Select
            value={collegeOrClusterFilter}
            onValueChange={(v) => setCollegeOrClusterFilter(v || 'all')}
          >
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
              <SelectValue placeholder="All Colleges & Tribes">
                {collegeOrClusterFilter === 'all'
                  ? 'All Colleges & Binturungan Tribes'
                  : collegeOrClusterFilter.startsWith('cluster:')
                  ? (() => {
                      const cl = clusters.find((c) => `cluster:${c.id}` === collegeOrClusterFilter);
                      return cl ? `Tribe: ${cl.name} (${cl.college_codes.join(', ')})` : collegeOrClusterFilter;
                    })()
                  : collegeOrClusterFilter.startsWith('college:')
                  ? (() => {
                      const col = colleges.find((c) => `college:${c.id}` === collegeOrClusterFilter);
                      return col ? col.college_name : collegeOrClusterFilter;
                    })()
                  : collegeOrClusterFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-72">
              <SelectItem value="all" className="text-xs font-bold">
                All Colleges &amp; Binturungan Tribes
              </SelectItem>
              {clusters.map((cl) => (
                <SelectItem key={`cluster:${cl.id}`} value={`cluster:${cl.id}`} className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Tribe: {cl.name} ({cl.college_codes.join(', ')})
                </SelectItem>
              ))}
              {colleges.map((col) => (
                <SelectItem key={`college:${col.id}`} value={`college:${col.id}`} className="text-xs font-bold">
                  {col.college_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Contextual 3rd / 4th Filter */}
          {activeTab === 'players' ? (
            <Select value={playerSortBy} onValueChange={(v: any) => setPlayerSortBy(v || 'points')}>
              <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                <SelectValue>
                  {playerSortBy === 'points'
                    ? 'Sort: Career Points'
                    : playerSortBy === 'ppg'
                    ? 'Sort: PPG Average'
                    : playerSortBy === 'threes'
                    ? 'Sort: 3-Pointers (3PM)'
                    : playerSortBy === 'mvp'
                    ? 'Sort: MVP Trophies'
                    : 'Sort: Name (A-Z)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="points" className="text-xs font-bold">Sort: Career Points</SelectItem>
                <SelectItem value="ppg" className="text-xs font-bold">Sort: PPG Average</SelectItem>
                <SelectItem value="threes" className="text-xs font-bold">Sort: 3-Pointers (3PM)</SelectItem>
                <SelectItem value="mvp" className="text-xs font-bold">Sort: MVP Trophies</SelectItem>
                <SelectItem value="name" className="text-xs font-bold">Sort: Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          ) : activeTab === 'matches' ? (
            <Select value={matchStatusFilter} onValueChange={(v: any) => setMatchStatusFilter(v || 'Completed')}>
              <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-xs font-bold">
                <SelectValue>
                  {matchStatusFilter === 'Completed'
                    ? 'Completed Matches (Archive)'
                    : matchStatusFilter === 'Ongoing'
                    ? 'Live / Ongoing Matches'
                    : 'All Recorded Matches'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Completed" className="text-xs font-bold">Completed Matches (Archive)</SelectItem>
                <SelectItem value="Ongoing" className="text-xs font-bold">Live / Ongoing Matches</SelectItem>
                <SelectItem value="all" className="text-xs font-bold">All Recorded Matches</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSportFilter('all');
                setCollegeOrClusterFilter('all');
                setPositionFilter('all');
              }}
              className="h-10 rounded-xl text-xs font-black uppercase"
            >
              Reset All Filters
            </Button>
          )}
        </div>

        {/* Active Criteria Chips on mobile when collapsed */}
        {!isFiltersExpanded && activeFilterCount > 0 && (
          <div className="lg:hidden flex flex-wrap items-center gap-1.5 pt-0.5">
            {sportFilter !== 'all' && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30">
                {sportFilter}
                <button type="button" onClick={() => setSportFilter('all')}><X className="size-2.5" /></button>
              </Badge>
            )}
            {collegeOrClusterFilter !== 'all' && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                {collegeOrClusterFilter.startsWith('cluster:') ? 'Tribe Active' : 'College Active'}
                <button type="button" onClick={() => setCollegeOrClusterFilter('all')}><X className="size-2.5" /></button>
              </Badge>
            )}
            <button
              type="button"
              onClick={() => {
                setSportFilter('all');
                setCollegeOrClusterFilter('all');
                setPositionFilter('all');
                setPlayerSortBy('points');
                setMatchStatusFilter('Completed');
              }}
              className="text-[10px] font-bold text-orange-500 hover:text-orange-600 uppercase"
            >
              Clear All
            </button>
          </div>
        )}
      </Card>

      {/* Main 4-Entity Tabs — Expandable Icon Tabs (Single sleek 44px row) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6 min-w-0">
        <ExpandableIconTabs
          tabs={[
            { id: 'players', label: 'Players', shortLabel: 'Players', icon: Users, count: filteredPlayers.length },
            { id: 'coaches', label: 'Coaches', shortLabel: 'Coaches', icon: UserCheck, count: filteredCoaches.length },
            { id: 'teams', label: 'Teams', shortLabel: 'Teams', icon: ShieldCheck, count: filteredTeams.length },
            { id: 'matches', label: 'Matches', shortLabel: 'Matches', icon: Trophy, count: filteredMatches.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="w-full sm:w-fit sm:mx-auto sm:self-center"
          ariaLabel="Athletics Hub Navigation"
        />

        {isLoading ? (
          <SkeletonCard variant="athlete-grid" count={6} className="mt-4" />
        ) : (
          <>
            {/* ============================================================== */}
            {/* TAB 1: PLAYERS DIRECTORY & TELEMETRY */}
            {/* ============================================================== */}
            <TabsContent value="players" className="space-y-4 outline-none">
              {filteredPlayers.length === 0 ? (
                <Card className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                  <p className="text-sm font-black uppercase text-slate-500">No Athletes Match Your Search</p>
                </Card>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {filteredPlayers.map((p, idx) => {
                    const sum = playerSummaries[p.id];
                    const colName = p.colleges?.college_name || 'Unassigned College';
                    const prefSports = Array.isArray(p.preferred_sports) ? p.preferred_sports : [];
                    const displaySports = Array.from(new Set([...prefSports, ...(sum?.activeSports || [])]));

                    return (
                      <Card
                        key={p.id}
                        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                        className="rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all shadow-sm hover:shadow-xl flex flex-col justify-between overflow-hidden active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                      >
                        <CardHeader className="p-5 pb-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="size-11 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white font-black text-base flex items-center justify-center shrink-0">
                                {p.full_name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <CardTitle
                                  onClick={() => setSelectedPlayerId(p.id)}
                                  className="text-lg font-black italic uppercase tracking-tight text-slate-900 dark:text-white hover:text-orange-500 break-words line-clamp-2 leading-snug cursor-pointer"
                                >
                                  {p.full_name}
                                </CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-orange-500 break-words line-clamp-2 leading-snug mt-0.5">
                                  {p.primary_position || sum?.positions[0] || 'Verified Athlete'}
                                  {p.year_level ? ` • ${p.year_level}` : ''}
                                </CardDescription>
                              </div>
                            </div>
                            {(sum?.mvpCount || 0) > 0 && (
                              <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px] font-black uppercase gap-1 shrink-0">
                                <Star className="size-3 fill-amber-500" /> {sum?.mvpCount}
                              </Badge>
                            )}
                          </div>

                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 min-w-0">
                            <GraduationCap className="size-3.5 text-orange-500 shrink-0" />
                            <span className="break-words line-clamp-2 leading-snug">{colName}</span>
                          </div>

                          {displaySports.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {displaySports.slice(0, 4).map((sp) => (
                                <Badge
                                  key={sp}
                                  variant="outline"
                                  className="text-[9px] font-black uppercase border-orange-500/30 text-orange-600 dark:text-orange-400"
                                >
                                  {sp}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {(() => {
                            const primaryPill = getPrimarySportStatPill(
                              sum,
                              sportFilter !== 'all' ? sportFilter : displaySports[0]
                            );
                            return (
                              <div className="grid grid-cols-4 gap-1.5 pt-1">
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center">
                                  <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">GP</p>
                                  <p className="text-xs font-black tabular-nums text-slate-900 dark:text-white">{sum?.gamesPlayed || 0}</p>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center">
                                  <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">PTS</p>
                                  <p className="text-xs font-black tabular-nums text-orange-600 dark:text-orange-400">
                                    {sum?.totalPoints || 0}
                                  </p>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center">
                                  <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">AVG</p>
                                  <p className="text-xs font-black tabular-nums text-cyan-600 dark:text-cyan-400">
                                    {sum?.ppg || 0}
                                  </p>
                                </div>
                                <div
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-center"
                                  title={primaryPill.unitLabel}
                                >
                                  <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">
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

                        <CardContent className="p-5 pt-2">
                          {isCoach ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedPlayerId(p.id)}
                                className="w-full h-10 rounded-xl font-black uppercase text-xs tracking-wider gap-1.5 border-slate-200 dark:border-white/10 hover:border-orange-500/50"
                              >
                                <Eye className="size-3.5 text-orange-500" />
                                <span>Dossier</span>
                              </Button>
                              <Button
                                onClick={() => handleStartCoachRecruit(p.id)}
                                className={`w-full h-10 rounded-xl font-black uppercase text-xs tracking-wider gap-1.5 ${
                                  isVerified
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20'
                                    : 'bg-slate-800 text-slate-300 border border-white/10'
                                }`}
                              >
                                <UserPlus className="size-3.5" />
                                <span>{isVerified ? 'Recruit' : 'Recruit (Verify)'}</span>
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => setSelectedPlayerId(p.id)}
                              className="w-full h-10 rounded-xl font-black uppercase text-xs tracking-wider gap-1.5 border-slate-200 dark:border-white/10 hover:border-orange-500/50"
                            >
                              <Eye className="size-3.5 text-orange-500" />
                              <span>View Athletic Profile &amp; Stats</span>
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ============================================================== */}
            {/* TAB 2: COACHES DIRECTORY & COACHING RECORDS */}
            {/* ============================================================== */}
            <TabsContent value="coaches" className="space-y-4 outline-none">
              {filteredCoaches.length === 0 ? (
                <Card className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                  <p className="text-sm font-black uppercase text-slate-500">No Coaches Match Your Search</p>
                </Card>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCoaches.map((coach) => {
                    const coachTeams = teams.filter((t) => t.coach_id === coach.id);
                    let totalWins = 0;
                    let totalLosses = 0;
                    let totalAthletes = 0;
                    for (const t of coachTeams) {
                      const rec = teamRecordsMap[t.id];
                      if (rec) {
                        totalWins += rec.wins;
                        totalLosses += rec.losses;
                      }
                      totalAthletes += (rostersByTeam[t.id] || []).length;
                    }

                    return (
                      <Card
                        key={coach.id}
                        className="rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 p-5 space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="size-12 rounded-2xl bg-slate-950 text-orange-500 font-black text-lg flex items-center justify-center shrink-0">
                              {coach.full_name?.charAt(0) || 'C'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[9px] font-black uppercase mb-0.5">
                                Official PSU Coach
                              </Badge>
                              <h3 className="text-lg font-black italic uppercase tracking-tight text-slate-900 dark:text-white break-words line-clamp-2 leading-snug">
                                {formatCoachName(coach.full_name)}
                              </h3>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 break-words line-clamp-2 leading-snug mt-0.5">
                                {coach.colleges?.college_name || 'PSU Athletic Division'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-center">
                              <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Squads</p>
                              <p className="text-sm font-black tabular-nums">{coachTeams.length}</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-center">
                              <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Record</p>
                              <p className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                                {totalWins}W - {totalLosses}L
                              </p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-center">
                              <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Athletes</p>
                              <p className="text-sm font-black tabular-nums text-orange-600 dark:text-orange-400">{totalAthletes}</p>
                            </div>
                          </div>

                          {coachTeams.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Managed Squads
                              </p>
                              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                {coachTeams.map((ct) => (
                                  <button
                                    key={ct.id}
                                    type="button"
                                    onClick={() => setSelectedTeamModal(ct)}
                                    className="w-full text-left px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-orange-500/10 border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs cursor-pointer transition-colors"
                                  >
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {ct.name}
                                    </span>
                                    <span className="text-[10px] font-black uppercase text-orange-500 shrink-0 ml-2">
                                      {ct.tournaments?.sport || 'Sport'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ============================================================== */}
            {/* TAB 3: TEAMS & SQUADS DIRECTORY */}
            {/* ============================================================== */}
            <TabsContent value="teams" className="space-y-4 outline-none">
              {filteredTeams.length === 0 ? (
                <Card className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                  <p className="text-sm font-black uppercase text-slate-500">No Teams Match Your Search</p>
                </Card>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTeams.map((team) => {
                    const rec = teamRecordsMap[team.id] || { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
                    const roster = rostersByTeam[team.id] || [];

                    return (
                      <Card
                        key={team.id}
                        className="rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all p-5 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[9px] font-black uppercase">
                                  {team.tournaments?.sport || 'Sport'}
                                </Badge>
                                {team.affiliation_type === 'cluster' && team.clusters?.name ? (
                                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] font-black uppercase">
                                    {team.clusters.name}
                                  </Badge>
                                ) : team.colleges?.college_name ? (
                                  <Badge variant="outline" className="text-[9px] font-black uppercase">
                                    {extractCollegeCode(team.colleges.college_name)}
                                  </Badge>
                                ) : null}
                              </div>
                              <h3 className="text-xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white break-words line-clamp-2 leading-snug">
                                {team.name}
                              </h3>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 break-words line-clamp-1">
                                {team.tournaments?.name || 'Tournament'} • {formatCoachName(team.coach?.full_name, 'Coach TBA')}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-center">
                              <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Record</p>
                              <p className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                                {rec.wins}W - {rec.losses}L
                              </p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-center">
                              <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">PTS Scored</p>
                              <p className="text-sm font-black tabular-nums text-orange-600 dark:text-orange-400">{rec.pointsFor}</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-center">
                              <p className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">Roster</p>
                              <p className="text-sm font-black tabular-nums text-cyan-600 dark:text-cyan-400">{roster.length}</p>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => setSelectedTeamModal(team)}
                          className="w-full h-10 rounded-xl font-black uppercase text-xs tracking-wider gap-1.5"
                        >
                          <Users className="size-3.5 text-orange-500" />
                          <span>Inspect Squad Roster &amp; Games</span>
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ============================================================== */}
            {/* TAB 4: OLD / COMPLETED MATCHES ARCHIVE */}
            {/* ============================================================== */}
            <TabsContent value="matches" className="space-y-4 outline-none">
              {filteredMatches.length === 0 ? (
                <Card className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                  <p className="text-sm font-black uppercase text-slate-500">No Recorded Matches Found</p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredMatches.map((m) => {
                    const teamAWin =
                      m.status === 'Completed' &&
                      (m.winner_team_id === m.team_a_id || m.team_a_score > m.team_b_score);
                    const teamBWin =
                      m.status === 'Completed' &&
                      (m.winner_team_id === m.team_b_id || m.team_b_score > m.team_a_score);

                    return (
                      <Card
                        key={m.id}
                        onClick={() => setSelectedMatchId(m.id)}
                        className="rounded-3xl border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 hover:border-orange-500/40 transition-all p-5 cursor-pointer group space-y-3.5 shadow-sm hover:shadow-xl"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[9px] font-black uppercase">
                              {m.tournaments?.sport || 'Sport'}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] font-bold uppercase">
                              {m.round}
                            </Badge>
                          </div>
                          <Badge
                            className={
                              m.status === 'Completed'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase'
                                : 'bg-amber-500 text-white text-[9px] font-black uppercase'
                            }
                          >
                            {m.status}
                          </Badge>
                        </div>

                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 break-words line-clamp-1">
                          {m.tournaments?.name || 'Official Tournament'}
                        </p>

                        {/* Mobile Stacked View (< sm) */}
                        <div className="sm:hidden p-3 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs font-black uppercase italic break-words line-clamp-2 leading-snug ${
                                  teamAWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {m.team_a?.name || 'TBD'}
                              </p>
                              {teamAWin && (
                                <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 inline-block mt-0.5">Winner</span>
                              )}
                            </div>
                            <span className="text-xl font-black tabular-nums text-orange-600 dark:text-orange-400 shrink-0">
                              {m.team_a_score}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 py-0.5">
                            <div className="h-px bg-slate-200 dark:bg-white/10 flex-1" />
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">VS</span>
                            <div className="h-px bg-slate-200 dark:bg-white/10 flex-1" />
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs font-black uppercase italic break-words line-clamp-2 leading-snug ${
                                  teamBWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {m.team_b?.name || 'TBD'}
                              </p>
                              {teamBWin && (
                                <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 inline-block mt-0.5">Winner</span>
                              )}
                            </div>
                            <span className="text-xl font-black tabular-nums text-cyan-600 dark:text-cyan-400 shrink-0">
                              {m.team_b_score}
                            </span>
                          </div>
                        </div>

                        {/* Desktop Grid View (>= sm) */}
                        <div className="hidden sm:grid p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white grid-cols-3 items-center gap-2 text-center">
                          <div className="min-w-0">
                            <p
                              className={`text-xs sm:text-sm font-black uppercase italic break-words line-clamp-2 leading-snug ${
                                teamAWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {m.team_a?.name || 'TBD'}
                            </p>
                            {teamAWin && (
                              <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 inline-block mt-0.5">Winner</span>
                            )}
                          </div>
                          <div className="flex items-center justify-center gap-2.5">
                            <span className="text-2xl font-black tabular-nums text-orange-600 dark:text-orange-400">
                              {m.team_a_score}
                            </span>
                            <span className="text-[10px] font-black uppercase text-slate-400">VS</span>
                            <span className="text-2xl font-black tabular-nums text-cyan-600 dark:text-cyan-400">
                              {m.team_b_score}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-xs sm:text-sm font-black uppercase italic break-words line-clamp-2 leading-snug ${
                                teamBWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {m.team_b?.name || 'TBD'}
                            </p>
                            {teamBWin && (
                              <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 inline-block mt-0.5">Winner</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-1">
                          <div className="flex items-center gap-3">
                            {m.match_time && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="size-3 text-orange-500" />
                                {new Date(m.match_time).toLocaleDateString()}
                              </span>
                            )}
                            {m.venue && (
                              <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                                <MapPin className="size-3 text-orange-500" />
                                {m.venue}
                              </span>
                            )}
                          </div>
                          <span className="text-orange-500 font-black uppercase text-[10px] group-hover:underline flex items-center gap-1">
                            <Activity className="size-3" /> Box Score
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Team Roster & Match History Modal */}
      <Dialog open={!!selectedTeamModal} onOpenChange={(open) => !open && setSelectedTeamModal(null)}>
        <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] max-h-[88dvh] overflow-hidden rounded-3xl p-5 sm:p-7 flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          {selectedTeamModal && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase">
                    {selectedTeamModal.tournaments?.sport || 'Sport'}
                  </Badge>
                  {selectedTeamModal.clusters?.name && (
                    <Badge className="bg-amber-500/15 text-amber-500 text-[9px] font-black uppercase">
                      {selectedTeamModal.clusters.name}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white break-words leading-tight">
                  {selectedTeamModal.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-500 break-words line-clamp-1">
                  {selectedTeamModal.tournaments?.name} • {formatCoachName(selectedTeamModal.coach?.full_name, 'Coach TBA')}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-5 py-3 pr-1 scrollbar-hide">
                {/* Roster Members */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Approved Squad Roster ({(rostersByTeam[selectedTeamModal.id] || []).length})
                  </h4>
                  {(rostersByTeam[selectedTeamModal.id] || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No approved roster members yet.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(rostersByTeam[selectedTeamModal.id] || []).map((rm) => (
                        <button
                          key={rm.playerId}
                          type="button"
                          onClick={() => {
                            setSelectedTeamModal(null);
                            setSelectedPlayerId(rm.playerId);
                          }}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-orange-500/10 border border-slate-100 dark:border-white/10 flex items-center justify-between text-left cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-slate-900 dark:text-white break-words line-clamp-2 leading-snug">
                              {rm.jerseyNumber !== null ? `#${rm.jerseyNumber} ` : ''}
                              {rm.playerName}
                            </p>
                            <p className="text-[10px] font-bold text-orange-500 uppercase">
                              {rm.position || 'Athlete'} {rm.isCaptain ? '• Captain' : ''}
                            </p>
                          </div>
                          <Eye className="size-3.5 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Squad Matches */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Recorded Squad Matches
                  </h4>
                  {matches.filter(
                    (m) => m.team_a_id === selectedTeamModal.id || m.team_b_id === selectedTeamModal.id
                  ).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No matches recorded for this squad yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {matches
                        .filter(
                          (m) => m.team_a_id === selectedTeamModal.id || m.team_b_id === selectedTeamModal.id
                        )
                        .map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedTeamModal(null);
                              setSelectedMatchId(m.id);
                            }}
                            className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-between text-xs cursor-pointer hover:border-orange-500 border border-slate-200/80 dark:border-white/10"
                          >
                            <div>
                              <span className="font-black uppercase">
                                {m.team_a?.name || 'TBD'} vs {m.team_b?.name || 'TBD'}
                              </span>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">{m.round} • {m.status}</p>
                            </div>
                            <span className="font-black text-sm text-orange-600 dark:text-orange-400 tabular-nums">
                              {m.team_a_score} - {m.team_b_score}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Player Dossier Modal */}
      <PlayerDossierModal
        playerId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
        onOpenMatchBoxScore={(mId) => {
          setSelectedPlayerId(null);
          setSelectedMatchId(mId);
        }}
        onRecruitPlayer={
          isCoach
            ? (pId) => handleStartCoachRecruit(pId)
            : undefined
        }
      />

      {/* Match Box Score Modal */}
      <MatchBoxScoreModal
        matchId={selectedMatchId}
        onClose={() => setSelectedMatchId(null)}
        onSelectPlayer={(pId) => {
          setSelectedMatchId(null);
          setSelectedPlayerId(pId);
        }}
      />

      {/* Coach Direct Recruitment Dialog */}
      <Dialog
        open={!!coachRecruitPlayerId}
        onOpenChange={(open) => !open && setCoachRecruitPlayerId(null)}
      >
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] rounded-3xl p-6 sm:p-7 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
              Direct Roster <span className="text-orange-500">Recruitment</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
              {players.find((p) => p.id === coachRecruitPlayerId)?.full_name
                ? `Invite ${players.find((p) => p.id === coachRecruitPlayerId)?.full_name} to join your squad`
                : 'Select target squad for recruitment invitation'}
            </DialogDescription>
          </DialogHeader>

          {coachTeams.length === 0 ? (
            <div className="py-6 text-center space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                You don't have any active squads yet. Create a squad in Team Management first before recruiting athletes.
              </p>
              <Button
                onClick={() => {
                  setCoachRecruitPlayerId(null);
                  navigate('/coach/teams');
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs h-10 px-5 rounded-xl"
              >
                Go to My Teams
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Select Target Squad
                </label>
                <Select value={selectedCoachTeamId} onValueChange={(val) => setSelectedCoachTeamId(val || '')}>
                  <SelectTrigger className="w-full h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 font-bold text-xs">
                    <SelectValue placeholder="Choose one of your teams" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    {coachTeams.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id} className="font-bold text-xs py-2.5">
                        <span className="font-black uppercase">{ct.name}</span>
                        <span className="ml-2 text-[10px] text-orange-500 uppercase font-black">({ct.sport})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCoachRecruitPlayerId(null)}
                  className="flex-1 h-11 rounded-xl font-black uppercase text-xs border-slate-200 dark:border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!selectedCoachTeamId || isSubmittingRecruit}
                  onClick={handleSendDirectRecruit}
                  className="flex-1 h-11 rounded-xl font-black uppercase text-xs bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                >
                  {isSubmittingRecruit ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Send Invite'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
