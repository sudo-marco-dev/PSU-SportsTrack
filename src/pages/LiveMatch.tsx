import { useState, useEffect, useRef, useMemo, createElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Trophy,
  ChevronLeft,
  Activity,
  Send,
  Clock,
  AlertCircle,
  Star,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Check,
  X,
  Loader2,
  MinusCircle,
  AlertTriangle,
  Users,
  Maximize2,
  PictureInPicture2,
  Volume2,
  VolumeX,
  LayoutGrid
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { offlineQueue } from '@/lib/offlineQueue';
import { FacilitatorManagementModal } from '@/components/admin/FacilitatorManagementModal';
import { getSportScoringProfile } from '@/lib/sportScoringRules';
import { getSportIcon } from '@/lib/sportIcons';
import { pipScoreboard } from '@/lib/pipScoreboard';
import { FloatingScoreWidget } from '@/components/scoreboard/FloatingScoreWidget';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { getFriendlyErrorMessage } from '@/lib/friendlyErrors';
import {
  type FloatingDelta,
  type LeadChangeAlert,
  detectLeadChange,
  detectMomentumRun,
} from '@/lib/scoreboardAnimations';
import { FloatingDeltaBadge } from '@/components/scoreboard/FloatingDeltaBadge';
import { LeadChangeBanner } from '@/components/scoreboard/LeadChangeBanner';
import { MomentumRunBadge } from '@/components/scoreboard/MomentumRunBadge';
import {
  useAudioFx,
  playScoreChime,
  playBuzzerSound,
  playWhistleSound,
  playClaimAlertChime
} from '@/lib/audioFx';

type Match = {
  id: string;
  team_a_id: string;
  team_b_id: string | null;
  team_a_score: number;
  team_b_score: number;
  winner_team_id?: string | null;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  round: string;
  venue?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament_id: string;
  tournament?: {
    name: string;
    sport: string;
  } | null;
  next_match_id?: string | null;
  next_match_slot?: 'team_a' | 'team_b' | null;
  loser_next_match_id?: string | null;
  loser_next_match_slot?: 'team_a' | 'team_b' | null;
  active_scorekeeper_id?: string | null;
  lease_expires_at?: string | null;
  official_scorekeeper_id?: string | null;
  official_scorekeeper?: { full_name: string } | null;
  finalized_by?: string | null;
  finalizer?: { full_name: string } | null;
  finalized_at?: string | null;
  scorer_notes?: string | null;
  conflict_flag?: boolean;
  conflict_notes?: string | null;
};

type EligiblePlayer = {
  player_id: string;
  users: {
    full_name: string;
  } | null;
};

type MatchRosterPlayer = {
  id: string;
  team_id: string;
  player_id: string;
  jersey_number?: number | null;
  position?: string | null;
  is_captain?: boolean;
  is_starter?: boolean;
  availability_status?: string;
  users: {
    full_name: string;
  } | null;
};

export type MatchPlayerStat = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  jersey_number?: number | null;
  custom_player_label?: string | null;
  points: number;
};

type MatchEvent = {
  id: string;
  description: string;
  created_at: string;
};

type IncomingClaimRequest = {
  requesterId: string;
  requesterName: string;
  timestamp: number;
};


export const LiveMatch = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, profile, isAdmin, isFacilitator, isOfficial } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conflictPrompt, setConflictPrompt] = useState<{ isOpen: boolean; reason: string }>({ isOpen: false, reason: '' });
  const [shortageReason, setShortageReason] = useState('');
  const [customEvent, setCustomEvent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<MatchRosterPlayer[]>([]);
  const [playerPointsMap, setPlayerPointsMap] = useState<Record<string, number>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardedMVP, setAwardedMVP] = useState<string | null>(null);

  // Scorer attribution modal state
  const [pendingScore, setPendingScore] = useState<{
    team: 'a' | 'b';
    teamId: string;
    teamName: string;
    points: number;
    actionType: string;
    actionDescription?: string;
  } | null>(null);
  const [showCustomJersey, setShowCustomJersey] = useState(false);
  const [customJerseyInput, setCustomJerseyInput] = useState('');
  const [customPlayerNameInput, setCustomPlayerNameInput] = useState('');

  // Score deduction / minus modal state
  const [pendingDeduct, setPendingDeduct] = useState<{
    team: 'a' | 'b';
    teamId: string;
    teamName: string;
  } | null>(null);
  const [deductPoints, setDeductPoints] = useState<number>(1);
  const [deductPlayerId, setDeductPlayerId] = useState<string>('');
  const [deductReason, setDeductReason] = useState<string>('Referee Wave-off / Offensive Foul');
  const [customDeductNote, setCustomDeductNote] = useState<string>('');

  // Sport Scoring Profile
  const sportProfile = useMemo(() => getSportScoringProfile(match?.tournament?.sport), [match?.tournament?.sport]);

  // Floating PiP & In-App Widget State
  const [isPipActive, setIsPipActive] = useState(false);
  const [isScrolledPastScoreboard, setIsScrolledPastScoreboard] = useState(false);

  // Scroll detector for bottom floating scoreboard
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolledPastScoreboard(window.scrollY > 420);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen to native OS PiP window state
  useEffect(() => {
    const unsubscribe = pipScoreboard.subscribeStateChange((active) => {
      setIsPipActive(active);
    });
    return unsubscribe;
  }, []);

  // Synchronize canvas Picture-in-Picture window when scores or events change
  useEffect(() => {
    if (match && pipScoreboard.isActive()) {
      pipScoreboard.draw({
        sport: match.tournament?.sport || 'General',
        round: match.round,
        status: match.status,
        teamAName: match.team_a?.name || 'Team A',
        teamBName: match.team_b?.name || 'Team B',
        teamAScore: match.team_a_score,
        teamBScore: match.team_b_score,
        pointUnit: sportProfile.pointUnit,
        latestEvent: events[0]?.description,
      });
    }
  }, [match, events, sportProfile.pointUnit]);

  // Dynamic Document Title for background multitasking
  useEffect(() => {
    if (!match) return;
    const teamAName = match.team_a?.name || 'Team A';
    const teamBName = match.team_b?.name || 'Team B';
    document.title = `(${match.team_a_score} - ${match.team_b_score}) ${teamAName} vs ${teamBName} • ${match.round} | PSU SportsTrack`;
  }, [match]);

  // Dynamic Scoreboard Animations (Phase 4)
  const prevScoresRef = useRef<{ a: number; b: number; hasInitialized: boolean }>({
    a: 0,
    b: 0,
    hasInitialized: false,
  });
  const [deltasA, setDeltasA] = useState<FloatingDelta[]>([]);
  const [deltasB, setDeltasB] = useState<FloatingDelta[]>([]);
  const [isPoppingA, setIsPoppingA] = useState(false);
  const [isPoppingB, setIsPoppingB] = useState(false);
  const [leadChangeAlert, setLeadChangeAlert] = useState<LeadChangeAlert | null>(null);

  // Courtside Web Audio FX Engine
  const { enabled: isAudioActive, toggle: toggleAudioActive } = useAudioFx();
  const prevStatusRef = useRef<string | null>(null);

  // Match completion arena buzzer trigger
  useEffect(() => {
    if (!match) return;
    if (prevStatusRef.current && prevStatusRef.current !== 'Completed' && match.status === 'Completed') {
      playBuzzerSound();
    }
    prevStatusRef.current = match.status;
  }, [match]);

  // Score pop, floating delta, audio FX, and lead change detector
  useEffect(() => {
    if (!match) return;

    if (!prevScoresRef.current.hasInitialized) {
      prevScoresRef.current = {
        a: match.team_a_score,
        b: match.team_b_score,
        hasInitialized: true,
      };
      return;
    }

    const prevA = prevScoresRef.current.a;
    const prevB = prevScoresRef.current.b;
    const currA = match.team_a_score;
    const currB = match.team_b_score;

    const diffA = currA - prevA;
    const diffB = currB - prevB;

    if (diffA !== 0) {
      setIsPoppingA(true);
      setTimeout(() => setIsPoppingA(false), 650);
      const newDelta: FloatingDelta = {
        id: `delta-a-${Date.now()}-${Math.random()}`,
        delta: diffA > 0 ? `+${diffA}` : `${diffA}`,
        isPositive: diffA > 0,
        timestamp: Date.now(),
      };
      setDeltasA((prev) => [...prev, newDelta]);
      setTimeout(() => {
        setDeltasA((prev) => prev.filter((d) => d.id !== newDelta.id));
      }, 1400);
    }

    if (diffB !== 0) {
      setIsPoppingB(true);
      setTimeout(() => setIsPoppingB(false), 650);
      const newDelta: FloatingDelta = {
        id: `delta-b-${Date.now()}-${Math.random()}`,
        delta: diffB > 0 ? `+${diffB}` : `${diffB}`,
        isPositive: diffB > 0,
        timestamp: Date.now(),
      };
      setDeltasB((prev) => [...prev, newDelta]);
      setTimeout(() => {
        setDeltasB((prev) => prev.filter((d) => d.id !== newDelta.id));
      }, 1400);
    }

    // Audio FX triggers: chime for points scored, whistle for deductions
    if (diffA > 0 || diffB > 0) {
      playScoreChime(Math.max(diffA, diffB));
    } else if (diffA < 0 || diffB < 0) {
      playWhistleSound();
    }

    // Lead Change Alert detection
    const leadChange = detectLeadChange(
      prevA,
      prevB,
      currA,
      currB,
      match.team_a?.name || 'Team A',
      match.team_b?.name || 'Team B'
    );

    if (leadChange) {
      setLeadChangeAlert(leadChange);
      toast.info(`LEAD CHANGE: ${leadChange.teamName} takes the lead (${currA} - ${currB})!`, {
        duration: 4500,
      });
      setTimeout(() => {
        setLeadChangeAlert((prev) => (prev?.timestamp === leadChange.timestamp ? null : prev));
      }, 5000);
    }

    prevScoresRef.current = { a: currA, b: currB, hasInitialized: true };
  }, [match]);

  // Momentum Run detection
  const momentumRun = useMemo(() => {
    if (!match) return null;
    return detectMomentumRun(
      events,
      match.team_a?.name || 'Team A',
      match.team_b?.name || 'Team B',
      sportProfile.pointUnit
    );
  }, [events, match?.team_a?.name, match?.team_b?.name, sportProfile.pointUnit]);

  // Facilitator Lease & Claim Handover State
  const [isHoldingLease, setIsHoldingLease] = useState(false);
  const [isFacilitatorModalOpen, setIsFacilitatorModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  // Live Console Claim & Handover State
  const [incomingClaimRequest, setIncomingClaimRequest] = useState<IncomingClaimRequest | null>(null);
  const [isRequestingClaim, setIsRequestingClaim] = useState(false);
  const [claimTimeoutSeconds, setClaimTimeoutSeconds] = useState(45);
  const [activeScorekeeperName, setActiveScorekeeperName] = useState<string | null>(null);
  const isHoldingLeaseRef = useRef(false);

  useEffect(() => {
    isHoldingLeaseRef.current = isHoldingLease;
  }, [isHoldingLease]);

  // Resolve active scorekeeper's name dynamically
  useEffect(() => {
    if (!match?.active_scorekeeper_id) {
      setActiveScorekeeperName(null);
      return;
    }
    if (match.active_scorekeeper_id === user?.id) {
      setActiveScorekeeperName(profile?.full_name || 'You');
      return;
    }

    let isMounted = true;
    supabase
      .from('users')
      .select('full_name')
      .eq('id', match.active_scorekeeper_id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted && data?.full_name) {
          setActiveScorekeeperName(data.full_name);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [match?.active_scorekeeper_id, user?.id, profile?.full_name]);

  // Resolve official scorekeeper and finalizer display names dynamically
  const [officialScorekeeperName, setOfficialScorekeeperName] = useState<string | null>(null);
  const [finalizerName, setFinalizerName] = useState<string | null>(null);

  useEffect(() => {
    const idsToFetch = [
      match?.official_scorekeeper_id,
      match?.finalized_by,
    ].filter(Boolean) as string[];

    if (idsToFetch.length === 0) {
      setOfficialScorekeeperName(null);
      setFinalizerName(null);
      return;
    }

    let isMounted = true;
    supabase
      .from('users')
      .select('id, full_name')
      .in('id', idsToFetch)
      .then(({ data }) => {
        if (!isMounted || !data || !Array.isArray(data)) return;
        const map = new Map(data.map((u) => [u.id, u.full_name]));
        if (match?.official_scorekeeper_id && map.has(match.official_scorekeeper_id)) {
          setOfficialScorekeeperName(map.get(match.official_scorekeeper_id)!);
        }
        if (match?.finalized_by && map.has(match.finalized_by)) {
          setFinalizerName(map.get(match.finalized_by)!);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [match?.official_scorekeeper_id, match?.finalized_by]);

  // Timeout ticker for the claim request
  useEffect(() => {
    if (!isRequestingClaim) return;
    const timer = setInterval(() => {
      setClaimTimeoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRequestingClaim(false);
          toast.warning(
            `No response from ${activeScorekeeperName || 'the active official'}. If they have disconnected, their lease will automatically expire after 90 seconds.`
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRequestingClaim, activeScorekeeperName]);

  const broadcastChannelRef = useRef<any>(null);

  // Strict Governance: ONLY Facilitators, Officials, and Admins can score games. Coaches are strictly read-only!
  const isAuthorizedScorekeeper = Boolean(isFacilitator || isAdmin || isOfficial);
  const isAuthorized = isAuthorizedScorekeeper && (isHoldingLease || isAdmin);

  useEffect(() => {
    if (!matchId) {
      console.log("[Realtime] Waiting for Match ID before connecting...");
      return;
    }

    fetchInitialData();
    if (import.meta.env.DEV) console.log(`[Realtime] Connecting for Match ID: ${matchId}`);

    let isMounted = true;

    const broadcastChannel = supabase
      .channel(`match-broadcast:${matchId}`)
      .on(
        'broadcast',
        { event: 'score_update' },
        (payload) => {
          if (!isMounted) return;
          if (import.meta.env.DEV) console.log('[Broadcast] Score received:', payload);
          const { team_a_score, team_b_score } = payload.payload;
          setMatch(prev => prev ? { ...prev, team_a_score, team_b_score } : prev);
        }
      )
      .on(
        'broadcast',
        { event: 'player_stats_update' },
        (payload) => {
          if (!isMounted) return;
          if (import.meta.env.DEV) console.log('[Broadcast] Player stats received:', payload);
          const { player_id, points } = payload.payload;
          setPlayerPointsMap(prev => ({ ...prev, [player_id]: points }));
        }
      )
      .on(
        'broadcast',
        { event: 'event_update' },
        (payload) => {
          if (!isMounted) return;
          if (import.meta.env.DEV) console.log('[Broadcast] Event received:', payload);
          const newEvent = payload.payload as MatchEvent;
          // Check if event already exists to prevent duplicate optimistic updates
          setEvents(prev => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
        }
      )
      .on(
        'broadcast',
        { event: 'mvp_update' },
        (payload) => {
          if (!isMounted) return;
          if (import.meta.env.DEV) console.log('[Broadcast] MVP received:', payload);
          setAwardedMVP(payload.payload.mvpName);
        }
      )
      .on(
        'broadcast',
        { event: 'claim_request' },
        (payload) => {
          if (!isMounted) return;
          const req = payload.payload;
          // Notify if this client currently holds the scoring lease and requester is another official
          if (user?.id && isHoldingLeaseRef.current && req.requesterId !== user.id) {
            setIncomingClaimRequest({
              requesterId: req.requesterId,
              requesterName: req.requesterName || 'Another Official',
              timestamp: req.timestamp || Date.now()
            });
            playClaimAlertChime();
            toast.warning(`Official ${req.requesterName || 'A facilitator'} is calling to claim this scoring console!`, {
              duration: 12000
            });
          }
        }
      )
      .on(
        'broadcast',
        { event: 'claim_accepted' },
        (payload) => {
          if (!isMounted) return;
          const data = payload.payload;
          if (data.requesterId === user?.id) {
            setIsRequestingClaim(false);
            setIsHoldingLease(true);
            toast.success(`Console claim approved by ${data.acceptedBy || 'the presiding official'}! You are now presiding over this match.`);
            fetchInitialData();
          }
        }
      )
      .on(
        'broadcast',
        { event: 'claim_rejected' },
        (payload) => {
          if (!isMounted) return;
          const data = payload.payload;
          if (data.requesterId === user?.id) {
            setIsRequestingClaim(false);
            toast.error(`${data.declinedBy || 'The presiding official'} declined your console claim request.`);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'claim_cancelled' },
        (payload) => {
          if (!isMounted) return;
          const data = payload.payload;
          setIncomingClaimRequest(prev => prev && prev.requesterId === data.requesterId ? null : prev);
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) console.log('[Broadcast] Channel status:', status);
      });

    broadcastChannelRef.current = broadcastChannel;

    const channel = supabase
      .channel(`realtime:matches:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          if (import.meta.env.DEV) console.log('[Realtime] matches UPDATE received:', payload);
          const updatedMatch = payload.new as Match;
          setMatch((prev) => prev ? { ...prev, ...updatedMatch, tournament: prev.tournament } : updatedMatch);
          if (user?.id && updatedMatch.active_scorekeeper_id !== user.id) {
            setIsHoldingLease(false);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_stars',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          if (import.meta.env.DEV) console.log('[Realtime] player_stars INSERT received:', payload);
          fetchInitialData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          if (import.meta.env.DEV) console.log('[Realtime] match_events INSERT received:', payload);
          const newEvent = payload.new as MatchEvent;
          setEvents((prev) => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_player_stats',
          filter: `match_id=eq.${matchId}`
        },
        () => {
          if (import.meta.env.DEV) console.log('[Realtime] match_player_stats change received');
          fetchPlayerStats(matchId);
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) console.log(`[Realtime] Status for ${matchId}:`, status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      broadcastChannelRef.current = null;
    };
  }, [matchId]);

  const fetchPlayerStats = async (targetMatchId: string) => {
    try {
      const { data } = await supabase
        .from('match_player_stats')
        .select('*')
        .eq('match_id', targetMatchId);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach((st: any) => {
          if (st.player_id) {
            map[st.player_id] = st.points || 0;
          }
        });
        setPlayerPointsMap(map);
      }
    } catch (err) {
      console.warn('Failed to fetch player stats:', err);
    }
  };

  const fetchInitialData = async () => {
    if (!matchId) return;
    setIsLoading(true);

    try {
      // Fetch match, events, and star in parallel
      // We fetch star player_id only to avoid ambiguous join issues
      const [matchRes, eventsRes, starRes] = await Promise.all([
        supabase
          .from('matches')
          .select('*, team_a:team_a_id(name), team_b:team_b_id(name), tournament:tournament_id(name, sport)')
          .eq('id', matchId)
          .single(),
        supabase
          .from('match_events')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false }),
        supabase
          .from('player_stars')
          .select('player_id')
          .eq('match_id', matchId)
          .eq('star_type', 'Red')
          .maybeSingle()
      ]);

      if (matchRes.error) throw matchRes.error;

      const matchData = matchRes.data as Match;
      setMatch(matchData);
      if (eventsRes.data) setEvents(eventsRes.data);

      // Check lease status
      if (matchData.active_scorekeeper_id === user?.id) {
        const isExpired = matchData.lease_expires_at ? new Date(matchData.lease_expires_at) < new Date() : false;
        setIsHoldingLease(!isExpired);
      } else {
        setIsHoldingLease(false);
      }

      // Fetch match player stats
      await fetchPlayerStats(matchId);

      // Fetch roster players for both teams (allow all registered non-rejected members)
      let currentRoster: MatchRosterPlayer[] = [];
      if (matchRes.data) {
        const teamIds = [matchRes.data.team_a_id, matchRes.data.team_b_id].filter(Boolean);
        const { data: rosterData, error: rosterError } = await supabase
          .from('team_roster')
          .select('id, team_id, player_id, jersey_number, position, is_captain, is_starter, availability_status, status, users(full_name)')
          .in('team_id', teamIds)
          .neq('status', 'Rejected');

        if (rosterError) {
          console.warn('[LiveMatch] Error loading roster players:', rosterError);
        }

        if (rosterData) {
          currentRoster = (rosterData as unknown) as MatchRosterPlayer[];
          setRosterPlayers(currentRoster);
          setEligiblePlayers(currentRoster as any);
        }
      }

      // Now resolve the MVP name based on the star data
      if (starRes.data) {
        const star = starRes.data;
        const playerInRoster = currentRoster.find(p => p.player_id === star.player_id);

        if (playerInRoster) {
          const users = playerInRoster.users as any;
          const mvpName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
          setAwardedMVP(mvpName || 'A Player');
        } else {
          // Fallback: Fetch user name directly if not found in pre-fetched roster
          const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', star.player_id)
            .single();
          setAwardedMVP(userData?.full_name || 'A Player');
        }
      } else {
        setAwardedMVP(null);
      }

    } catch (error: any) {
      console.error("Error fetching match data:", error);
      if (error.code !== 'PGRST116') {
        toast.error("Failed to load match details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 15-second heartbeat for active facilitator lease holder
  useEffect(() => {
    if (!isHoldingLease || !matchId || !user?.id) return;

    const heartbeat = setInterval(async () => {
      try {
        await supabase
          .from('matches')
          .update({
            active_scorekeeper_id: user.id,
            lease_expires_at: new Date(Date.now() + 90000).toISOString()
          })
          .eq('id', matchId);
        if (import.meta.env.DEV) console.log('[Lease] Extended facilitator lease by 90s');
      } catch (err) {
        console.warn('Lease heartbeat ping failed:', err);
      }
    }, 15000);

    return () => clearInterval(heartbeat);
  }, [isHoldingLease, matchId, user?.id]);

  // Offline and Online network event listeners
  useEffect(() => {
    if (matchId) {
      setPendingOfflineCount(offlineQueue.getPendingCount(matchId));
    }

    const handleOnline = async () => {
      setIsOnline(true);
      if (!matchId) return;
      toast.info("Network restored! Synchronizing court-side offline queue...");
      const res = await offlineQueue.flush(matchId, supabase);
      if (res.success) {
        toast.success(`Cloud synchronized: ${res.syncedEvents} match events updated.`);
        setPendingOfflineCount(0);
        fetchInitialData();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Network connection lost. Court-side offline buffering active.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [matchId]);

  const handleClaimLease = async (force: boolean = false, overrideReason?: string) => {
    if (!isAuthorizedScorekeeper || !user || !matchId) return;

    try {
      const { data, error } = await supabase.rpc('claim_match_lease', {
        p_match_id: matchId,
        p_force: force,
        p_override_reason: overrideReason || null,
      });

      if (error) {
        toast.error(getFriendlyErrorMessage(error, 'Failed to claim scoring console.'));
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result) {
        toast.error('Unexpected response while claiming console.');
        return;
      }

      if (result.conflict) {
        setConflictPrompt({
          isOpen: true,
          reason: result.message || 'Collegiate affiliation conflict detected.',
        });
        toast.warning(result.message || 'Conflict of Interest detected. Facilitator shortage override required.');
        return;
      }

      if (result.success) {
        setIsHoldingLease(true);
        setConflictPrompt({ isOpen: false, reason: '' });
        setActiveScorekeeperName(profile?.full_name || 'You');
        toast.success(result.message || (force ? 'Admin force-claimed scoring console!' : 'Scoring console lease acquired!'));
        fetchInitialData();
      } else {
        toast.error(result.message || 'Failed to claim console lease.');
      }
    } catch (err: any) {
      toast.error('Error claiming console: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleSendClaimRequest = async () => {
    if (!user || !matchId || !broadcastChannelRef.current) return;
    setIsRequestingClaim(true);
    setClaimTimeoutSeconds(45);

    const requesterName = profile?.full_name || user.email || 'Facilitator';

    await broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'claim_request',
      payload: {
        requesterId: user.id,
        requesterName,
        timestamp: Date.now()
      }
    });

    toast.info(`Claim request sent to ${activeScorekeeperName || 'the active official'}. Waiting for response...`);
  };

  const handleCancelClaimRequest = async () => {
    if (!user || !broadcastChannelRef.current) return;
    await broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'claim_cancelled',
      payload: {
        requesterId: user.id
      }
    });
    setIsRequestingClaim(false);
    toast.info('Console claim request cancelled.');
  };

  const handleAcceptClaim = async () => {
    if (!incomingClaimRequest || !matchId) return;
    setIsSubmitting(true);
    try {
      const newKeeperId = incomingClaimRequest.requesterId;
      const newKeeperName = incomingClaimRequest.requesterName;

      const { error } = await supabase
        .from('matches')
        .update({
          active_scorekeeper_id: newKeeperId,
          lease_expires_at: new Date(Date.now() + 90000).toISOString()
        })
        .eq('id', matchId);

      if (error) {
        toast.error(getFriendlyErrorMessage(error, 'Failed to transfer console lease.'));
        setIsSubmitting(false);
        return;
      }

      // Broadcast acceptance
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'claim_accepted',
          payload: {
            requesterId: newKeeperId,
            acceptedBy: profile?.full_name || user?.email || 'Previous Official'
          }
        });
      }

      // Log match event for governance and auditability
      await supabase.from('match_events').insert({
        match_id: matchId,
        description: `Scoring console handed over to official ${newKeeperName}.`
      });

      setIsHoldingLease(false);
      setActiveScorekeeperName(newKeeperName);
      setMatch(prev => prev ? {
        ...prev,
        active_scorekeeper_id: newKeeperId,
        lease_expires_at: new Date(Date.now() + 90000).toISOString()
      } : prev);

      toast.success(`Scoring console handed over to ${newKeeperName}.`);
      setIncomingClaimRequest(null);
    } catch (err: any) {
      toast.error('Error during handover: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!incomingClaimRequest) return;
    const requesterId = incomingClaimRequest.requesterId;
    const requesterName = incomingClaimRequest.requesterName;

    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'claim_rejected',
        payload: {
          requesterId,
          declinedBy: profile?.full_name || user?.email || 'Current Official'
        }
      });
    }

    toast.info(`Claim request from ${requesterName} declined. You retain console control.`);
    setIncomingClaimRequest(null);
  };

  const handleReleaseLease = async () => {
    if (!user || !matchId) return;
    await supabase
      .from('matches')
      .update({
        active_scorekeeper_id: null,
        lease_expires_at: null
      })
      .eq('id', matchId);

    setIsHoldingLease(false);
    setMatch(prev => prev ? {
      ...prev,
      active_scorekeeper_id: null,
      lease_expires_at: null
    } : prev);
    toast.info("Scoring console lease released.");
  };

  const handleManualSync = async () => {
    if (!matchId) return;
    setIsSubmitting(true);
    const res = await offlineQueue.flush(matchId, supabase);
    setIsSubmitting(false);
    if (res.success) {
      toast.success(`Cloud synchronized: ${res.syncedEvents} match events updated.`);
      setPendingOfflineCount(0);
      fetchInitialData();
    } else {
      toast.error("Failed to sync offline events. Check connection.");
    }
  };

  const handleTogglePip = async () => {
    if (!match) return;
    if (!pipScoreboard.isSupported()) {
      toast.info("Picture-in-Picture floating windows are not supported on this browser. Try Focus View instead!");
      return;
    }

    const active = await pipScoreboard.togglePip({
      sport: match.tournament?.sport || 'General',
      round: match.round,
      status: match.status,
      teamAName: match.team_a?.name || 'Team A',
      teamBName: match.team_b?.name || 'Team B',
      teamAScore: match.team_a_score,
      teamBScore: match.team_b_score,
      pointUnit: sportProfile.pointUnit,
      latestEvent: events[0]?.description,
    });

    if (active) {
      toast.success("Floating scoreboard active! You can now multitask outside the browser.");
    }
  };

  const handleInitiateScore = (team: 'a' | 'b', points: number, actionType: string, actionDescription?: string) => {
    if (!isAuthorizedScorekeeper || !match || match.status !== 'Ongoing') return;

    if (!isHoldingLease && !isAdmin) {
      toast.error("You must claim the scoring lease before updating the scoreboard.");
      return;
    }

    const teamId = team === 'a' ? match.team_a_id : match.team_b_id;
    const teamName = (team === 'a' ? match.team_a?.name : match.team_b?.name) || (team === 'a' ? 'Team A' : 'Team B');

    if (!teamId) {
      toast.error("Invalid team selected.");
      return;
    }

    setPendingScore({
      team,
      teamId,
      teamName,
      points,
      actionType,
      actionDescription,
    });
  };

  const handleConfirmScore = async (
    selectedPlayer: MatchRosterPlayer | null,
    customAttribution?: { jerseyNumber: number; playerName?: string }
  ) => {
    if (!pendingScore || !match) return;

    const { team, points, actionType, teamName, teamId } = pendingScore;
    setIsSubmitting(true);

    const newScoreA = team === 'a' ? match.team_a_score + points : match.team_a_score;
    const newScoreB = team === 'b' ? match.team_b_score + points : match.team_b_score;

    let playerName = '';
    let jerseyDisplay = '';

    if (customAttribution) {
      jerseyDisplay = `#${customAttribution.jerseyNumber}`;
      playerName = customAttribution.playerName || `Player #${customAttribution.jerseyNumber}`;
    } else if (selectedPlayer) {
      const users = selectedPlayer?.users as any;
      playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
      jerseyDisplay = selectedPlayer?.jersey_number !== null && selectedPlayer?.jersey_number !== undefined
        ? `#${selectedPlayer.jersey_number}`
        : '';
    }

    const unitLabel = sportProfile.pointUnit;
    const scoreDescription = (selectedPlayer || customAttribution) && (playerName || jerseyDisplay)
      ? `[${jerseyDisplay || 'Player'}] ${playerName || 'Player'} scored ${points} ${unitLabel} (${actionType}) for ${teamName}!`
      : `${teamName} scored ${points} ${unitLabel} (${actionType})!`;

    // Offline Buffering Guard
    if (!navigator.onLine) {
      offlineQueue.bufferScore(match.id, newScoreA, newScoreB);
      const offlineEvt = offlineQueue.bufferEvent(match.id, scoreDescription);
      if (selectedPlayer) {
        offlineQueue.bufferScoreEvent(match.id, {
          match_id: match.id,
          team_id: teamId,
          player_id: selectedPlayer.player_id,
          jersey_number: selectedPlayer.jersey_number !== null && selectedPlayer.jersey_number !== undefined ? String(selectedPlayer.jersey_number) : null,
          points: points,
          delta: points,
          action_type: actionType,
          stat_type: `PTS_${points}`,
        });
      }
      setMatch(prev => prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev);
      setEvents(prev => [offlineEvt, ...prev]);
      setPendingOfflineCount(offlineQueue.getPendingCount(match.id));
      if (selectedPlayer) {
        setPlayerPointsMap(prev => ({
          ...prev,
          [selectedPlayer.player_id]: (prev[selectedPlayer.player_id] || 0) + points
        }));
      }
      toast.warning("Offline Mode: Points buffered locally. Will sync upon reconnection.");
      setPendingScore(null);
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({ team_a_score: newScoreA, team_b_score: newScoreB })
      .eq('id', match.id);

    if (updateError) {
      toast.error(getFriendlyErrorMessage(updateError, 'Failed to update score. Please try again.'));
      setIsSubmitting(false);
      return;
    }

    setMatch(prev => prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev);

    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
          match_id: matchId,
          team_a_score: newScoreA,
          team_b_score: newScoreB,
          updated_at: new Date().toISOString(),
        },
      });
    }

    // Insert score audit event
    await supabase.from('match_score_events').insert({
      match_id: match.id,
      team_id: teamId,
      player_id: selectedPlayer?.player_id || null,
      points: points,
      action_type: actionType,
      stat_type: `PTS_${points}`,
      delta: points,
      recorded_by: user?.id || null,
    });

    // If player credited, upsert match_player_stats
    if (selectedPlayer) {
      const currentPts = playerPointsMap[selectedPlayer.player_id] || 0;
      const updatedPts = currentPts + points;

      setPlayerPointsMap(prev => ({
        ...prev,
        [selectedPlayer.player_id]: updatedPts
      }));

      await supabase
        .from('match_player_stats')
        .upsert({
          match_id: match.id,
          team_id: teamId,
          player_id: selectedPlayer.player_id,
          jersey_number: selectedPlayer.jersey_number ?? null,
          custom_player_label: playerName || null,
          points: updatedPts,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'match_id,player_id'
        });

      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'player_stats_update',
          payload: {
            player_id: selectedPlayer.player_id,
            points: updatedPts,
          }
        });
      }
    }

    // Log in match_events
    const { data: eventData, error: eventError } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: scoreDescription
    }).select().single();

    if (!eventError && eventData) {
      const newEvent = eventData as MatchEvent;
      setEvents(prev => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'event_update',
          payload: eventData
        });
      }
    }

    toast.success(`Recorded +${points} PTS for ${jerseyDisplay || playerName ? `${jerseyDisplay} ${playerName}`.trim() : teamName}`);
    setPendingScore(null);
    setIsSubmitting(false);
  };

  const handleOpenDeductModal = (team: 'a' | 'b') => {
    if (!isAuthorizedScorekeeper || !match || match.status !== 'Ongoing') return;

    if (!isHoldingLease && !isAdmin) {
      toast.error("You must claim the scoring lease before adjusting points.");
      return;
    }

    const teamId = team === 'a' ? match.team_a_id : match.team_b_id;
    const teamName = (team === 'a' ? match.team_a?.name : match.team_b?.name) || (team === 'a' ? 'Team A' : 'Team B');

    if (!teamId) return;

    const currentScore = team === 'a' ? match.team_a_score : match.team_b_score;
    if (currentScore <= 0) {
      toast.warning(`${teamName} currently has 0 ${sportProfile.pointUnit}. Cannot deduct further.`);
      return;
    }

    setPendingDeduct({
      team,
      teamId,
      teamName,
    });
    setDeductPoints(sportProfile.deductibleValues[0] || 1);
    setDeductPlayerId('');
    setDeductReason('Referee Wave-off / Correction');
    setCustomDeductNote('');
  };

  const handleConfirmDeduct = async () => {
    if (!pendingDeduct || !match) return;

    const { team, teamId, teamName } = pendingDeduct;
    const currentScore = team === 'a' ? match.team_a_score : match.team_b_score;

    if (currentScore < deductPoints) {
      toast.error(`Cannot deduct ${deductPoints} ${sportProfile.pointUnit}. ${teamName} only has ${currentScore} ${sportProfile.pointUnit}.`);
      return;
    }

    setIsSubmitting(true);
    const newScoreA = team === 'a' ? match.team_a_score - deductPoints : match.team_a_score;
    const newScoreB = team === 'b' ? match.team_b_score - deductPoints : match.team_b_score;

    let targetPlayer: MatchRosterPlayer | undefined;
    let playerName = '';
    let jerseyDisplay = '';

    if (deductPlayerId) {
      targetPlayer = rosterPlayers.find(p => p.player_id === deductPlayerId);
      if (targetPlayer) {
        const users = targetPlayer.users as any;
        playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
        jerseyDisplay = targetPlayer.jersey_number !== null && targetPlayer.jersey_number !== undefined
          ? `#${targetPlayer.jersey_number}`
          : '';
      }
    }

    const reasonSummary = customDeductNote.trim() ? `${deductReason}: ${customDeductNote.trim()}` : deductReason;
    const playerSummary = targetPlayer && playerName ? ` (${jerseyDisplay || 'Player'} ${playerName})` : '';
    const deductDescription = `[Score Correction]: -${deductPoints} ${sportProfile.pointUnit} from ${teamName}${playerSummary} - Reason: ${reasonSummary}`;

    // Offline Buffering Guard
    if (!navigator.onLine) {
      offlineQueue.bufferScore(match.id, newScoreA, newScoreB);
      const offlineEvt = offlineQueue.bufferEvent(match.id, deductDescription);
      if (deductPlayerId) {
        offlineQueue.undoLastScoreEvent(match.id, deductPlayerId, deductPoints);
      }
      setMatch(prev => prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev);
      setEvents(prev => [offlineEvt, ...prev]);
      setPendingOfflineCount(offlineQueue.getPendingCount(match.id));
      if (deductPlayerId) {
        setPlayerPointsMap(prev => ({
          ...prev,
          [deductPlayerId]: Math.max(0, (prev[deductPlayerId] || 0) - deductPoints)
        }));
      }
      toast.warning("Offline Mode: Deduction buffered locally. Will sync upon reconnection.");
      setPendingDeduct(null);
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({ team_a_score: newScoreA, team_b_score: newScoreB })
      .eq('id', match.id);

    if (updateError) {
      toast.error(getFriendlyErrorMessage(updateError, 'Failed to deduct score. Please try again.'));
      setIsSubmitting(false);
      return;
    }

    setMatch(prev => prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev);

    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
          match_id: matchId,
          team_a_score: newScoreA,
          team_b_score: newScoreB,
          updated_at: new Date().toISOString(),
        },
      });
    }

    // Record in match_score_events
    await supabase.from('match_score_events').insert({
      match_id: match.id,
      team_id: teamId,
      player_id: deductPlayerId || null,
      points: -deductPoints,
      action_type: 'correction',
      stat_type: 'DEDUCT',
      delta: -deductPoints,
      recorded_by: user?.id || null,
    });

    // Rollback player points if assigned
    if (deductPlayerId && targetPlayer) {
      const currentPts = playerPointsMap[deductPlayerId] || 0;
      const updatedPts = Math.max(0, currentPts - deductPoints);

      setPlayerPointsMap(prev => ({
        ...prev,
        [deductPlayerId]: updatedPts
      }));

      await supabase
        .from('match_player_stats')
        .upsert({
          match_id: match.id,
          team_id: teamId,
          player_id: deductPlayerId,
          jersey_number: targetPlayer.jersey_number ?? null,
          custom_player_label: playerName || null,
          points: updatedPts,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'match_id,player_id'
        });

      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'player_stats_update',
          payload: {
            player_id: deductPlayerId,
            points: updatedPts,
          }
        });
      }
    }

    // Log to match_events
    const { data: eventData, error: eventError } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: deductDescription
    }).select().single();

    if (!eventError && eventData) {
      const newEvent = eventData as MatchEvent;
      setEvents(prev => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'event_update',
          payload: eventData
        });
      }
    }

    toast.warning(`Correction recorded: -${deductPoints} PTS from ${teamName}`);
    setPendingDeduct(null);
    setIsSubmitting(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!isAuthorizedScorekeeper || !match) return;

    // Tie Guard: Bracket elimination matches cannot end in a tie without an awarded winner
    if (newStatus === 'Completed') {
      const isKnockoutMatch = Boolean(match.next_match_id);
      if (isKnockoutMatch && match.team_a_score === match.team_b_score && !match.winner_team_id) {
        toast.error('Cannot complete an elimination bracket match with a tie score! Please break the tie first.');
        return;
      }
    }

    // Offline completion handling
    if (!navigator.onLine && newStatus === 'Completed') {
      offlineQueue.bufferScore(match.id, match.team_a_score, match.team_b_score, true);
      setMatch(prev => prev ? { ...prev, status: 'Completed' } : prev);
      setPendingOfflineCount(offlineQueue.getPendingCount(match.id));
      toast.warning("Match completed offline. Bracket advancement will sync when reconnected.");
      return;
    }

    const updatePayload: Record<string, any> = { status: newStatus };
    if (newStatus === 'Completed') {
      updatePayload.finalized_by = user?.id || null;
      updatePayload.finalized_at = new Date().toISOString();
      updatePayload.is_finalized = true;
      updatePayload.is_clock_running = false;
      updatePayload.active_scorekeeper_id = null;

      // Compute and record the decisive winner_team_id
      if ((match.team_a_score || 0) > (match.team_b_score || 0)) {
        updatePayload.winner_team_id = match.team_a_id;
      } else if ((match.team_b_score || 0) > (match.team_a_score || 0)) {
        updatePayload.winner_team_id = match.team_b_id;
      } else if (match.winner_team_id) {
        updatePayload.winner_team_id = match.winner_team_id;
      }
    }

    const { error } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', match.id);

    if (error) {
      toast.error(getFriendlyErrorMessage(error, 'Failed to update match status. Please try again.'));
    } else {
      const computedWinnerId = updatePayload.winner_team_id || (
        (match.team_a_score || 0) > (match.team_b_score || 0)
          ? match.team_a_id
          : (match.team_b_score || 0) > (match.team_a_score || 0)
          ? match.team_b_id
          : match.winner_team_id
      );

      setMatch(prev => prev ? {
        ...prev,
        status: newStatus as Match['status'],
        finalized_by: newStatus === 'Completed' ? (user?.id || null) : prev.finalized_by,
        finalized_at: newStatus === 'Completed' ? updatePayload.finalized_at : prev.finalized_at,
        winner_team_id: newStatus === 'Completed' ? computedWinnerId : prev.winner_team_id,
      } : prev);

      // Automated Postgres trigger handles bracket advancement (trg_advance_bracket_on_match_completed)
      if (newStatus === 'Completed') {
        const isTeamAWinner = (match.team_a_score || 0) > (match.team_b_score || 0);
        const winnerName = isTeamAWinner ? (match.team_a?.name || 'Team A') : (match.team_b?.name || 'Team B');
        const loserName = isTeamAWinner ? (match.team_b?.name || 'Team B') : (match.team_a?.name || 'Team A');

        if (match.next_match_id || match.loser_next_match_id) {
          toast.success(
            match.loser_next_match_id
              ? `Match completed! ${winnerName} advances to the next round and ${loserName} moves to the Lower/3rd Place bracket.`
              : `Match completed! ${winnerName} automatically advances to the next bracket round.`
          );
        } else {
          toast.success(`Match completed! Official winner: ${winnerName}.`);
        }
      } else {
        toast.success(`Match status updated to ${newStatus}`);
      }

      const { data: eventData, error: eventError } = await supabase.from('match_events').insert({
        match_id: match.id,
        description: `Match status changed to ${newStatus}`
      }).select().single();

      if (!eventError && eventData) {
        const newEvent = eventData as MatchEvent;
        setEvents(prev => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
        if (broadcastChannelRef.current) {
          await broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'event_update',
            payload: eventData
          });
        }
      }
    }
  };

  const handleLogCustomEvent = async () => {
    if (!isAuthorized || !match || !customEvent.trim()) return;
    setIsSubmitting(true);

    const { data: eventData, error } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: customEvent.trim()
    }).select().single();

    if (error) {
      toast.error(getFriendlyErrorMessage(error, 'Failed to log event. Please try again.'));
    } else {
      setCustomEvent('');
      if (eventData) {
        const newEvent = eventData as MatchEvent;
        setEvents(prev => prev.some(e => e.id === newEvent.id) ? prev : [newEvent, ...prev]);
        if (broadcastChannelRef.current) {
          await broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'event_update',
            payload: eventData
          });
        }
      }
    }
    setIsSubmitting(false);
  };

  const handleAwardMVP = async () => {
    if (isAwarding || !isAuthorized || !match || !selectedPlayerId) return;
    setIsAwarding(true);

    const { error } = await supabase.from('player_stars').insert({
      player_id: selectedPlayerId,
      star_type: 'Red',
      match_id: match.id,
      tournament_id: match.tournament_id,
      awarded_by: user?.id
    });

    if (error) {
      if (error.code === '23505') {
        toast.error("An MVP has already been awarded for this match!");
        // Re-fetch to lock UI
        fetchInitialData();
      } else {
        toast.error(getFriendlyErrorMessage(error, 'Failed to award MVP. Please try again.'));
      }
      setIsAwarding(false);
    } else {
      toast.success('Red Star awarded to player!');
      const player = (eligiblePlayers || []).find(p => p.player_id === selectedPlayerId);
      const users = player?.users as any;
      const selectedPlayerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
      const finalMvpName = selectedPlayerName || 'Unknown Player';

      setAwardedMVP(finalMvpName);

      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'mvp_update',
          payload: { mvpName: finalMvpName }
        });
      }

      setIsAwarding(false);
      setSelectedPlayerId('');
    }
  };

  if (isLoading) {
    return (
      <div className="py-6 px-4 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
        <SkeletonCard variant="scoreboard" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-16 px-4 text-center max-w-md mx-auto animate-in fade-in duration-300">
        <div className="size-16 rounded-3xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">Match Not Found</h2>
        <p className="text-xs text-slate-500 font-medium mt-1 mb-6">The requested fixture either does not exist or has been removed from the schedule.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase text-xs tracking-wider gap-2">
          <ChevronLeft className="size-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Dynamic Arena Header */}
      <div className="bg-slate-950 text-white py-5 md:py-6 px-5 md:px-8 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white/10 hover:bg-white/20 text-white border-none shrink-0">
              <ChevronLeft className="size-5 sm:size-6" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {createElement(getSportIcon(match.tournament?.sport), { className: 'w-4 h-4 text-orange-500' })}
                <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                  {match.tournament?.sport || 'Live Match'} • {match.status === 'Completed' ? 'Post-Game Record' : 'Match Control'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
                {match.status === 'Completed' ? (
                  <>POST-GAME <span className="text-orange-500">BOX SCORE</span></>
                ) : (
                  <>MATCH <span className="text-orange-500">CONTROL</span></>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePip}
              className={`h-9 px-3.5 rounded-full border-orange-500/40 font-bold text-xs uppercase tracking-tight gap-1.5 transition-all cursor-pointer shadow-sm ${
                isPipActive
                  ? 'bg-orange-500 text-slate-950 hover:bg-orange-600'
                  : 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
              }`}
              title="Pop out floating scoreboard window for multitasking outside browser"
            >
              <PictureInPicture2 className="size-3.5" />
              <span>{isPipActive ? 'Floating Active' : 'Float Score'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/match/${match.id}/display`)}
              className="h-9 px-3.5 rounded-full border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 font-bold text-xs uppercase tracking-tight gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Open distraction-free live scoreboard Focus View"
            >
              <Maximize2 className="size-3.5 text-orange-400" />
              <span>Focus View</span>
            </Button>
            {isAuthorizedScorekeeper && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/match/${match.id}/kiosk`)}
                className="h-9 px-3.5 rounded-full border-orange-500 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 font-black text-xs uppercase tracking-tight gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Launch tactile courtside Kiosk Deck (Stream Deck style scoring console)"
              >
                <LayoutGrid className="size-3.5" />
                <span>Kiosk Deck</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAudioActive}
              className={`h-9 px-3.5 rounded-full border-orange-500/40 font-bold text-xs uppercase tracking-tight gap-1.5 transition-all cursor-pointer shadow-sm ${
                isAudioActive
                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                  : 'text-slate-400 bg-white/5 hover:bg-white/10 border-white/10'
              }`}
              title={isAudioActive ? 'Courtside Sound FX Active (Click to Mute)' : 'Sound Muted (Click to Enable Sound FX)'}
            >
              {isAudioActive ? <Volume2 className="size-3.5 text-orange-400" /> : <VolumeX className="size-3.5" />}
              <span>{isAudioActive ? 'Sound On' : 'Muted'}</span>
            </Button>
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 rounded-full border border-white/10 text-xs">
              <Activity className="size-3.5 text-orange-500 animate-pulse" />
              <span className="font-bold uppercase tracking-wider">{match.status}</span>
            </div>
            <Badge variant={match.status === 'Completed' ? 'secondary' : 'destructive'} className="h-9 px-4 rounded-full font-bold text-xs uppercase tracking-tight gap-2 shadow-sm">
              {match.status === 'Ongoing' && (
                <span className="relative flex size-2">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-white"></span>
                </span>
              )}
              {match.status === 'Ongoing' ? 'LIVE' : match.status}
            </Badge>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-64 bg-orange-500/10 -skew-x-12 translate-x-32" />
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Lead Change Alert Banner */}
        <LeadChangeBanner
          alert={leadChangeAlert}
          onDismiss={() => setLeadChangeAlert(null)}
        />

        {/* Scoreboard */}
        <Card className="bg-primary text-primary-foreground shadow-xl overflow-hidden border-none rounded-2xl relative">
          <CardContent className="p-0">
            <div className="bg-black/20 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest opacity-80 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span>{match.round}</span>
                {match.venue && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3 text-orange-400" /> {match.venue}</span>
                  </>
                )}
                <span>•</span>
                <span>{sportProfile.sport} ({sportProfile.pointUnit})</span>
              </div>
              {momentumRun && (
                <MomentumRunBadge run={momentumRun} />
              )}
            </div>
            <div className="flex items-center justify-between p-4 sm:p-6 md:p-8 gap-2">
              <div className="flex-1 min-w-0 text-center relative">
                <FloatingDeltaBadge deltas={deltasA} />
                <h2 className="text-sm sm:text-lg md:text-xl font-bold mb-1 uppercase break-words leading-tight">{match.team_a?.name || 'Team A'}</h2>
                <div className={`text-4xl sm:text-5xl md:text-7xl font-black tabular-nums transition-transform ${isPoppingA ? 'animate-score-pop' : ''}`}>
                  {match.team_a_score}
                </div>
              </div>

              <div className="px-2 sm:px-6 text-xl sm:text-3xl font-black italic opacity-40 shrink-0">VS</div>

              <div className="flex-1 min-w-0 text-center relative">
                <FloatingDeltaBadge deltas={deltasB} />
                <h2 className="text-sm sm:text-lg md:text-xl font-bold mb-1 uppercase break-words leading-tight">{match.team_b?.name || 'BYE'}</h2>
                <div className={`text-4xl sm:text-5xl md:text-7xl font-black tabular-nums transition-transform ${isPoppingB ? 'animate-score-pop' : ''}`}>
                  {match.team_b_score}
                </div>
              </div>
            </div>
            {/* Facilitator Action Bar on Scoreboard */}
            {isAuthorizedScorekeeper && (
              <div className="bg-black/10 p-4 flex flex-wrap items-center justify-center gap-3">
                {match.status === 'Scheduled' && (
                  <Button variant="secondary" className="bg-white text-primary hover:bg-white/90 font-bold" onClick={() => handleUpdateStatus('Ongoing')}>
                    Start Match
                  </Button>
                )}
                {match.status === 'Ongoing' && (
                  <Button variant="secondary" className="bg-white text-primary hover:bg-white/90 font-bold" onClick={() => handleUpdateStatus('Completed')}>
                    End Match
                  </Button>
                )}
                {match.status === 'Completed' && (
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Trophy className="size-5 text-yellow-400" />
                    Winner: {match.team_a_score > match.team_b_score ? match.team_a?.name : match.team_b?.name || 'N/A'}
                  </div>
                )}
              </div>
            )}
            {!isAuthorizedScorekeeper && (
              <div className="bg-black/10 p-3 flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] sm:text-xs font-semibold text-white/80">
                <Activity className="size-3.5 text-orange-400 animate-pulse shrink-0" />
                <span>Spectator Mode • Official Match Scoring Managed Exclusively by PSU Facilitators</span>
                {match.status === 'Completed' && (
                  <span className="font-bold text-yellow-300">
                    (Final Winner: {match.team_a_score > match.team_b_score ? match.team_a?.name : match.team_b?.name})
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facilitator Lease & Court-Side Network Controls (Only for Facilitator/Admin) */}
        {isAuthorizedScorekeeper && (
          <div className="space-y-3">
            {/* Offline Alert & Sync Bar */}
            {(!isOnline || pendingOfflineCount > 0) && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0 text-amber-600 animate-pulse" />
                  <span>
                    <strong>{!isOnline ? 'Offline Court-Side Mode:' : 'Pending Offline Changes:'}</strong> Scoring & events are buffered locally. ({pendingOfflineCount} queued)
                  </span>
                </div>
                {isOnline && pendingOfflineCount > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20" onClick={handleManualSync} disabled={isSubmitting}>
                    Sync Cloud Now
                  </Button>
                )}
              </div>
            )}

            {/* Incoming Claim Handover Banner (Presiding Official) */}
            {incomingClaimRequest && isHoldingLease && (
              <div className="p-3.5 bg-gradient-to-r from-amber-950/80 to-orange-950/80 border-2 border-amber-500/70 rounded-xl flex flex-wrap items-center justify-between gap-3 text-white shadow-lg animate-in fade-in duration-300">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <Radio className="size-4 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs uppercase tracking-wide text-amber-300">Incoming Handover Call</span>
                      <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] h-4">Action Required</Badge>
                    </div>
                    <p className="text-xs text-slate-200 mt-0.5">
                      Official <strong className="text-white underline">{incomingClaimRequest.requesterName}</strong> is calling to claim this scoring console.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-xs gap-1.5 shadow-sm"
                    onClick={handleAcceptClaim}
                    disabled={isSubmitting}
                  >
                    <Check className="size-3.5" /> Accept Handover
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold h-7 text-xs gap-1.5"
                    onClick={handleRejectClaim}
                  >
                    <X className="size-3.5" /> Decline
                  </Button>
                </div>
              </div>
            )}

            {/* Lease Status Card */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-white flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className={`size-2.5 rounded-full ${isHoldingLease ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`} />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[11px] block">
                    {isHoldingLease ? 'Active Scoring Console Lease (You are Presiding)' : 'Facilitator Console Status'}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {isHoldingLease
                      ? 'Heartbeat active (renewed every 15s). You hold exclusive rights to record points.'
                      : match.active_scorekeeper_id && (!match.lease_expires_at || new Date(match.lease_expires_at) >= new Date())
                        ? `Console is presided by ${activeScorekeeperName || 'another official'}. Read-only view active.`
                        : 'No facilitator currently holds this console. Claim to begin scoring.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-bold border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-1.5"
                    onClick={() => setIsFacilitatorModalOpen(true)}
                  >
                    <ShieldCheck className="size-3.5 text-orange-400" />
                    Appoint Facilitators
                  </Button>
                )}
                {!isHoldingLease && (!match.active_scorekeeper_id || (match.lease_expires_at && new Date(match.lease_expires_at) < new Date())) && (
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-7 text-xs" onClick={() => handleClaimLease(false)}>
                    Claim Scoring Console
                  </Button>
                )}
                {!isHoldingLease && match.active_scorekeeper_id && (!match.lease_expires_at || new Date(match.lease_expires_at) >= new Date()) && (
                  <>
                    {isRequestingClaim ? (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" disabled className="bg-amber-600/80 text-white font-bold h-7 text-xs gap-1.5 cursor-not-allowed">
                          <Loader2 className="size-3 animate-spin" />
                          Calling {activeScorekeeperName || 'Official'} ({claimTimeoutSeconds}s)
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-white" onClick={handleCancelClaimRequest}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-7 text-xs gap-1.5 shadow-sm"
                        onClick={handleSendClaimRequest}
                        disabled={!isOnline}
                      >
                        <Radio className="size-3.5 animate-pulse" />
                        Call to Claim Console
                      </Button>
                    )}
                  </>
                )}
                {isHoldingLease && (
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 text-xs" onClick={handleReleaseLease}>
                    Release Console
                  </Button>
                )}
                {!isHoldingLease && match.active_scorekeeper_id && isAdmin && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs font-bold" onClick={() => handleClaimLease(true)}>
                    Force-Claim (Admin)
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Match Officials & Governance Accountability Card */}
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-orange-400" />
              <span className="font-bold uppercase tracking-wider text-[11px]">
                Match Governance & Officials Accountability
              </span>
            </div>
            {match.conflict_flag ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                Shortage Policy Override
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                Neutral Scorer Verified
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Official Scorekeeper</span>
              <span className="font-semibold text-orange-400">
                {officialScorekeeperName || (match.official_scorekeeper_id ? 'Authenticated Scorer' : 'Unassigned')}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Console Lease</span>
              <span className="font-semibold text-emerald-400">
                {isHoldingLease ? 'You (Presiding)' : (activeScorekeeperName || 'No Active Lease')}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Match Finalizer</span>
              <span className="font-semibold text-white">
                {match.status === 'Completed'
                  ? (finalizerName || 'Certified Final')
                  : 'Match in Progress'}
              </span>
            </div>
          </div>

          {match.conflict_notes && (
            <div className="text-[10px] text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-500/20">
              <span className="font-bold">Shortage Policy Override Justification:</span> {match.conflict_notes}
            </div>
          )}
          {match.scorer_notes && (
            <div className="text-[10px] text-slate-300 bg-slate-950/60 p-2 rounded border border-white/5">
              <span className="font-bold">Scorer Certification Note:</span> {match.scorer_notes}
            </div>
          )}
        </div>

        {/* MVP Recognition Center (Visible to EVERYONE once awarded) */}
        {awardedMVP && (
          <Card className="border-primary/50 bg-primary/5 shadow-lg overflow-hidden border-2">
            <CardContent className="p-0">
              <div className="relative py-12 px-6 text-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10 animate-in zoom-in fade-in duration-700">
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 animate-pulse" />
                      <div className="relative inline-flex items-center justify-center p-6 bg-orange-500 rounded-full shadow-2xl shadow-orange-500/50">
                        <Trophy className="size-16 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-orange-600 mb-1">
                      <Star className="size-5 fill-orange-600" />
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Match Recognition</span>
                      <Star className="size-5 fill-orange-600" />
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">{awardedMVP}</h3>
                    <div className="inline-block px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-bold uppercase tracking-widest mt-4">
                      Official Red Star MVP
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-6 max-w-xs mx-auto">
                      This player has been officially recognized for their exceptional performance in this match.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Facilitator Live Scoring Controls (Facilitators / Admins Only) */}
        {isAuthorizedScorekeeper && (
          <div className="space-y-6">
            {/* Live Scoring Controls */}
            {match.status === 'Ongoing' && (
              <div className="grid md:grid-cols-2 gap-5">
                {/* Team A Controls */}
                <Card className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <CardHeader className="text-center border-b pb-3 pt-4">
                    <CardTitle className="text-primary text-base sm:text-lg font-black uppercase tracking-tight">
                      {match.team_a?.name || 'Team A'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className={`grid gap-2.5 ${sportProfile.actions.length <= 2 ? 'grid-cols-2' : sportProfile.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                      {sportProfile.actions.map((act, idx) => (
                        <Button
                          key={idx}
                          size="lg"
                          variant="outline"
                          className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-left justify-center"
                          onClick={() => handleInitiateScore('a', act.points, act.actionType, act.description)}
                        >
                          <span className="text-lg font-black">{act.label}</span>
                          <span className="text-[10px] uppercase font-bold opacity-60 truncate max-w-full px-0.5">{act.sublabel}</span>
                        </Button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs font-bold border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5 transition-colors"
                      onClick={() => handleOpenDeductModal('a')}
                    >
                      <MinusCircle className="size-3.5" />
                      Score Correction / Deduct
                    </Button>
                  </CardContent>
                </Card>

                {/* Team B Controls */}
                <Card className={`rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 ${!match.team_b_id ? 'opacity-50 pointer-events-none' : ''}`}>
                  <CardHeader className="text-center border-b pb-3 pt-4">
                    <CardTitle className="text-primary text-base sm:text-lg font-black uppercase tracking-tight">
                      {match.team_b?.name || 'BYE'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className={`grid gap-2.5 ${sportProfile.actions.length <= 2 ? 'grid-cols-2' : sportProfile.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                      {sportProfile.actions.map((act, idx) => (
                        <Button
                          key={idx}
                          size="lg"
                          variant="outline"
                          className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-left justify-center"
                          onClick={() => handleInitiateScore('b', act.points, act.actionType, act.description)}
                        >
                          <span className="text-lg font-black">{act.label}</span>
                          <span className="text-[10px] uppercase font-bold opacity-60 truncate max-w-full px-0.5">{act.sublabel}</span>
                        </Button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs font-bold border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5 transition-colors"
                      onClick={() => handleOpenDeductModal('b')}
                    >
                      <MinusCircle className="size-3.5" />
                      Score Correction / Deduct
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Post-Game Award Form (Only if NOT awarded yet) */}
            {match.status === 'Completed' && !awardedMVP && (
              <Card className="border-primary/50 bg-primary/5 shadow-lg overflow-hidden border-2">
                <CardHeader className="text-center">
                  <div className="flex justify-center mb-2">
                    <Star className="size-12 text-red-500 fill-red-500 animate-bounce" />
                  </div>
                  <CardTitle className="text-2xl text-primary font-black uppercase italic">Post-Game: Award MVP</CardTitle>
                  <p className="text-sm text-muted-foreground">Select the standout player of this match to recognize their performance.</p>
                </CardHeader>
                <CardContent className="max-w-md mx-auto space-y-4 pb-8 text-center">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block text-left">Select MVP Player</label>
                    <Select value={selectedPlayerId} onValueChange={(val) => setSelectedPlayerId(val || '')}>
                      <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                        <SelectValue placeholder="Select a player...">
                          {selectedPlayerId && (() => {
                            const player = (rosterPlayers || []).find(p => p.player_id === selectedPlayerId);
                            const users = player?.users as any;
                            const playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                            const jersey = player?.jersey_number !== null && player?.jersey_number !== undefined ? `#${player.jersey_number} ` : '';
                            return `${jersey}${playerName || 'A Player'}`;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(rosterPlayers || []).map((player) => {
                          const users = player.users as any;
                          const playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                          const jersey = player.jersey_number !== null && player.jersey_number !== undefined ? `#${player.jersey_number} ` : '';
                          return (
                            <SelectItem key={player.player_id} value={player.player_id}>
                              {jersey}{playerName || 'Unknown Player'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-12 gap-2"
                    onClick={handleAwardMVP}
                    disabled={!selectedPlayerId || isAwarding}
                  >
                    <Star className="size-5 fill-white" />
                    {isAwarding ? 'Awarding...' : 'Award Red Star'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Default state if scheduled */}
            {match.status === 'Scheduled' && (
              <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                Match is scheduled. Start the match to enable score controls.
              </div>
            )}
          </div>
        )}

        {/* Match Box Score & Scorers (Visible to Everyone) */}
        <Card className="rounded-2xl shadow-xl overflow-hidden border border-slate-800 bg-slate-950 text-white">
          <CardHeader className="border-b border-white/10 pb-3 pt-4 px-5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-orange-500" />
              <CardTitle className="text-base font-black uppercase italic tracking-tight text-white">
                Match Box Score & Scorers
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] border-white/20 text-slate-400 font-bold uppercase">
              Live Stats
            </Badge>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/10">
              {/* Team A Box Score */}
              <div className="space-y-3 pt-3 md:pt-0">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase text-orange-400">{match.team_a?.name || 'Team A'}</span>
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px] font-black">
                      {match.team_a_score} PTS
                    </Badge>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Points</span>
                </div>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {(() => {
                    const teamAPlayers = rosterPlayers.filter(p => p.team_id === match.team_a_id);
                    if (teamAPlayers.length === 0) {
                      return <p className="text-xs text-slate-500 py-3 text-center">No roster players recorded.</p>;
                    }
                    const sorted = [...teamAPlayers].sort((a, b) => (playerPointsMap[b.player_id] || 0) - (playerPointsMap[a.player_id] || 0));
                    return sorted.map(player => {
                      const users = player.users as any;
                      const name = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                      const pts = playerPointsMap[player.player_id] || 0;
                      const jersey = player.jersey_number !== null && player.jersey_number !== undefined ? `#${player.jersey_number}` : '#--';
                      return (
                        <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-orange-400 shrink-0">
                              {jersey}
                            </span>
                            <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-slate-200 break-words line-clamp-2 leading-snug">
                                  {name || 'Unknown'}
                                </span>
                                {player.is_captain && (
                                  <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/20 px-1 rounded shrink-0">C</span>
                                )}
                              </div>
                              {player.position && (
                                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                                  {player.position}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                player.is_starter
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-slate-500/10 text-slate-400 border-white/10'
                              }`}
                            >
                              {player.is_starter ? 'Starter' : 'Sub'}
                            </span>
                            <span className={`font-black font-mono ${pts > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                              {pts} PTS
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Team B Box Score */}
              <div className="space-y-3 pt-6 md:pt-0 md:pl-6">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase text-orange-400">{match.team_b?.name || 'Team B'}</span>
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px] font-black">
                      {match.team_b_score} PTS
                    </Badge>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Points</span>
                </div>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {(() => {
                    const teamBPlayers = rosterPlayers.filter(p => p.team_id === match.team_b_id);
                    if (teamBPlayers.length === 0) {
                      return <p className="text-xs text-slate-500 py-3 text-center">No roster players recorded.</p>;
                    }
                    const sorted = [...teamBPlayers].sort((a, b) => (playerPointsMap[b.player_id] || 0) - (playerPointsMap[a.player_id] || 0));
                    return sorted.map(player => {
                      const users = player.users as any;
                      const name = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                      const pts = playerPointsMap[player.player_id] || 0;
                      const jersey = player.jersey_number !== null && player.jersey_number !== undefined ? `#${player.jersey_number}` : '#--';
                      return (
                        <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-orange-400 shrink-0">
                              {jersey}
                            </span>
                            <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-slate-200 break-words line-clamp-2 leading-snug">
                                  {name || 'Unknown'}
                                </span>
                                {player.is_captain && (
                                  <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/20 px-1 rounded shrink-0">C</span>
                                )}
                              </div>
                              {player.position && (
                                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                                  {player.position}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                player.is_starter
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-slate-500/10 text-slate-400 border-white/10'
                              }`}
                            >
                              {player.is_starter ? 'Starter' : 'Sub'}
                            </span>
                            <span className={`font-black font-mono ${pts > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                              {pts} PTS
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Feed & Commentary */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="size-4 text-primary" /> Live Commentary & Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isAuthorizedScorekeeper && (
              <div className="p-4 border-b flex gap-2">
                <Input
                  placeholder="Log a custom event (e.g., Timeout, Foul, Substitution)..."
                  value={customEvent}
                  onChange={(e) => setCustomEvent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogCustomEvent()}
                  disabled={match.status === 'Completed'}
                />
                <Button size="icon" onClick={handleLogCustomEvent} disabled={!customEvent.trim() || isSubmitting || match.status === 'Completed'}>
                  <Send className="size-4" />
                </Button>
              </div>
            )}
            <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-muted/5">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <AlertCircle className="size-12 mb-2" />
                  <p>No events logged yet.</p>
                </div>
              ) : (
                events.map((event, idx) => (
                  <div key={event.id ? `${event.id}-${idx}` : idx} className="flex gap-4 items-start animate-in slide-in-from-left-2 duration-300">
                    <div className="mt-1.5 p-1.5 bg-primary/10 rounded-full">
                      <Clock className="size-3 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Handover Modal for Current Presiding Official */}
      <Dialog open={!!incomingClaimRequest && isHoldingLease} onOpenChange={(open) => {
        if (!open && incomingClaimRequest) {
          handleRejectClaim();
        }
      }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-3 mx-auto">
              <Radio className="size-6 animate-pulse" />
            </div>
            <DialogTitle className="text-center text-lg font-black uppercase tracking-tight">
              Scoring Handover Request
            </DialogTitle>
            <DialogDescription className="text-center text-slate-400 text-xs">
              Another official is calling to take over court-side scoring for this fixture.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5 my-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Calling Official:</span>
              <span className="font-bold text-amber-400">{incomingClaimRequest?.requesterName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Fixture:</span>
              <span className="font-semibold text-slate-200">
                {match?.team_a?.name || 'Team A'} vs {match?.team_b?.name || 'Team B'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Your Current Lease:</span>
              <span className="text-emerald-400 font-semibold">Active Presiding Scorekeeper</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            If you <strong>accept</strong>, scoring lease and console rights will immediately transfer to <strong>{incomingClaimRequest?.requesterName}</strong>. If you decline, you keep exclusive rights to record points.
          </p>

          <div className="flex items-center gap-3 mt-4">
            <Button
              variant="outline"
              className="w-1/2 border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs"
              onClick={handleRejectClaim}
            >
              <X className="size-4 mr-1.5 text-red-400" /> Decline Request
            </Button>
            <Button
              className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
              onClick={handleAcceptClaim}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Check className="size-4 mr-1.5" />
              )}
              Accept Handover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scorer Assignment Dialog */}
      <Dialog open={!!pendingScore} onOpenChange={(open) => {
        if (!open) {
          setPendingScore(null);
          setShowCustomJersey(false);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] flex flex-col bg-slate-950 border-slate-800 text-white p-0 overflow-hidden shadow-2xl">
          <div className="p-5 pr-14 border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge className="bg-orange-500 text-slate-950 font-black text-xs px-2.5 py-0.5 shadow-md">
                +{pendingScore?.points} {pendingScore?.actionType}
              </Badge>
              <Badge variant="outline" className="border-orange-500/40 text-orange-400 bg-orange-500/10 font-black text-xs px-2.5 py-0.5">
                {pendingScore?.teamName}
              </Badge>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">Scorer Attribution</span>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-black uppercase italic tracking-tight text-white">
              Who scored for <span className="text-orange-400">{pendingScore?.teamName}</span>?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Select the scoring player by jersey number to attribute +{pendingScore?.points} {sportProfile.pointUnit}, or credit to the team directly.
            </DialogDescription>
          </div>

          {/* Scrollable Player List Grid & Walk-on Entry */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {(() => {
              const teamPlayers = rosterPlayers.filter(p => p.team_id === pendingScore?.teamId);
              if (teamPlayers.length === 0) {
                return (
                  <div className="py-6 px-4 text-center rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                    <Users className="size-8 mx-auto text-slate-500" />
                    <p className="font-bold text-xs text-slate-300">No roster members registered for {pendingScore?.teamName}.</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                      You can attribute points to a custom jersey number below, or record as a team point.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {teamPlayers.map((player) => {
                    const users = player.users as any;
                    const playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                    const currentPts = playerPointsMap[player.player_id] || 0;
                    const jerseyNumber = player.jersey_number !== null && player.jersey_number !== undefined
                      ? player.jersey_number
                      : null;

                    return (
                      <button
                        key={player.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleConfirmScore(player)}
                        className="flex flex-col items-center justify-between p-3 rounded-xl bg-slate-900/90 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/50 transition-all duration-150 group text-center relative active:scale-95 cursor-pointer"
                      >
                        {/* Top: Current Match Points */}
                        <div className="w-full flex items-center justify-between mb-1.5 text-[10px]">
                          <span className="font-mono text-slate-400 group-hover:text-orange-300">
                            {currentPts} {sportProfile.pointUnit}
                          </span>
                          {player.is_captain && (
                            <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded">C</span>
                          )}
                        </div>

                        {/* Center: Large Jersey Number Badge */}
                        <div className="size-14 rounded-2xl bg-white/5 group-hover:bg-orange-500 group-hover:text-slate-950 border border-white/10 group-hover:border-transparent flex items-center justify-center font-black text-xl sm:text-2xl transition-colors shadow-inner my-1">
                          {jerseyNumber !== null ? `#${jerseyNumber}` : '#--'}
                        </div>

                        {/* Bottom: Small Player Name Text */}
                        <div className="w-full mt-1.5 min-w-0">
                          <p className="text-xs font-bold text-white group-hover:text-orange-400 break-words line-clamp-2 leading-tight">
                            {playerName || 'Unknown'}
                          </p>
                          <p className="text-[10px] uppercase font-semibold text-slate-500 group-hover:text-slate-400 mt-0.5">
                            {player.position || 'Player'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Quick Walk-on / Custom Jersey Entry */}
            <div className="pt-2 border-t border-white/10">
              {!showCustomJersey ? (
                <button
                  type="button"
                  onClick={() => setShowCustomJersey(true)}
                  className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <span className="text-base font-black leading-none">+</span>
                  <span>Attribute to a custom jersey number / walk-on</span>
                </button>
              ) : (
                <div className="p-3 bg-slate-900/90 rounded-xl border border-white/10 space-y-2 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Custom Walk-On Player Attribution
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <span className="text-xs font-black text-slate-400">#</span>
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        placeholder="No."
                        value={customJerseyInput}
                        onChange={(e) => setCustomJerseyInput(e.target.value)}
                        className="h-8 bg-slate-950 border-white/10 text-white text-xs font-bold text-center"
                      />
                    </div>
                    <Input
                      placeholder="Player Name (Optional)"
                      value={customPlayerNameInput}
                      onChange={(e) => setCustomPlayerNameInput(e.target.value)}
                      className="h-8 bg-slate-950 border-white/10 text-white text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={!customJerseyInput.trim() || isSubmitting}
                      onClick={() => {
                        const num = parseInt(customJerseyInput, 10);
                        if (!isNaN(num)) {
                          handleConfirmScore(null, {
                            jerseyNumber: num,
                            playerName: customPlayerNameInput.trim() || undefined
                          });
                          setCustomJerseyInput('');
                          setCustomPlayerNameInput('');
                          setShowCustomJersey(false);
                        }
                      }}
                      className="h-8 bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs shrink-0"
                    >
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCustomJersey(false);
                        setCustomJerseyInput('');
                        setCustomPlayerNameInput('');
                      }}
                      className="h-8 text-slate-400 hover:text-white text-xs px-2 shrink-0"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Fallback: Uncredited / Team Points & Cancel */}
          <div className="p-4 border-t border-white/10 bg-slate-900/80 flex flex-col sm:flex-row items-center gap-2 justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                setPendingScore(null);
                setShowCustomJersey(false);
              }}
              className="w-full sm:w-auto text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleConfirmScore(null)}
              className="w-full sm:w-auto text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Record as Team Score (Uncredited)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Destructive Score Deduction / Minus Confirmation Dialog */}
      <Dialog open={!!pendingDeduct} onOpenChange={(open) => !open && setPendingDeduct(null)}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-red-500/30 text-white p-0 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-red-500/20 bg-gradient-to-r from-red-950/40 via-slate-950 to-red-950/40">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="size-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black uppercase tracking-tight text-red-400">
                  Score Correction & Deduction
                </DialogTitle>
                <span className="text-[11px] font-bold text-slate-400">
                  {pendingDeduct?.teamName} (Current: {pendingDeduct?.team === 'a' ? match.team_a_score : match.team_b_score} {sportProfile.pointUnit})
                </span>
              </div>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              Deducting points adjusts the official scoreboard and logs a permanent correction record in the match event feed.
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4 text-xs">
            {/* 1. Points Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {sportProfile.pointUnit} to Deduct:
              </label>
              <div className={`grid gap-2 ${sportProfile.deductibleValues.length <= 2 ? 'grid-cols-2' : sportProfile.deductibleValues.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {sportProfile.deductibleValues.map((pts) => {
                  const currentScore = pendingDeduct?.team === 'a' ? match.team_a_score : match.team_b_score;
                  const disabled = currentScore < pts;
                  const selected = deductPoints === pts;
                  return (
                    <button
                      key={pts}
                      type="button"
                      disabled={disabled || isSubmitting}
                      onClick={() => setDeductPoints(pts)}
                      className={`py-2.5 rounded-xl font-black text-sm border transition-all ${
                        selected
                          ? 'bg-red-600 border-red-500 text-white shadow-md'
                          : disabled
                          ? 'opacity-30 border-white/5 bg-white/5 cursor-not-allowed'
                          : 'bg-slate-900 border-white/10 hover:border-red-500/40 text-slate-200'
                      }`}
                    >
                      -{pts} {sportProfile.pointUnit}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Rollback Player Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Player to Rollback (Optional):
              </label>
              <Select value={deductPlayerId || 'uncredited'} onValueChange={(val) => setDeductPlayerId(!val || val === 'uncredited' ? '' : val)}>
                <SelectTrigger className="w-full bg-slate-900 border-white/10 text-white">
                  <SelectValue placeholder="Team / Uncredited (Do not deduct player stats)">
                    {deductPlayerId ? (() => {
                      const p = rosterPlayers.find((rp) => rp.player_id === deductPlayerId);
                      if (!p) return deductPlayerId;
                      const users = p.users as any;
                      const name = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                      const jersey = p.jersey_number !== null && p.jersey_number !== undefined ? `#${p.jersey_number} ` : '';
                      const pts = playerPointsMap[p.player_id] || 0;
                      return `${jersey}${name || 'Player'} (${pts} PTS)`;
                    })() : 'Team / Uncredited (Do not deduct player stats)'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="uncredited">Team / Uncredited (Do not deduct player stats)</SelectItem>
                  {rosterPlayers
                    .filter(p => p.team_id === pendingDeduct?.teamId)
                    .map(p => {
                      const users = p.users as any;
                      const name = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                      const jersey = p.jersey_number !== null && p.jersey_number !== undefined ? `#${p.jersey_number} ` : '';
                      const pts = playerPointsMap[p.player_id] || 0;
                      const label = `${jersey}${name || 'Player'} (${pts} PTS)`;
                      return (
                        <SelectItem key={p.player_id} value={p.player_id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Reason Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Reason for Correction:
              </label>
              <Select value={deductReason} onValueChange={(val) => setDeductReason(val || 'Referee Wave-off / Offensive Foul')}>
                <SelectTrigger className="w-full bg-slate-900 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="Referee Wave-off / Offensive Foul">Referee Wave-off / Offensive Foul</SelectItem>
                  <SelectItem value="Misclick / Accidental Score Input">Misclick / Accidental Score Input</SelectItem>
                  <SelectItem value="Shot Clock Expired Before Release">Shot Clock Expired Before Release</SelectItem>
                  <SelectItem value="Foot on 3-Point Line (Downgrade to 2PT)">Foot on 3-Point Line (Downgrade to 2PT)</SelectItem>
                  <SelectItem value="Play Re-evaluation / Scoring Audit">Play Re-evaluation / Scoring Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Optional Custom Note */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Additional Note (Optional):
              </label>
              <Input
                placeholder="e.g., Charge called on baseline gather"
                value={customDeductNote}
                onChange={(e) => setCustomDeductNote(e.target.value)}
                className="bg-slate-900 border-white/10 text-white text-xs placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Destructive Confirmation Action Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setPendingDeduct(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              onClick={handleConfirmDeduct}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs gap-1.5 shadow-lg shadow-red-600/30"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MinusCircle className="size-3.5" />
              )}
              Confirm -{deductPoints} {sportProfile.pointUnit} Deduction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FacilitatorManagementModal
        open={isFacilitatorModalOpen}
        onOpenChange={setIsFacilitatorModalOpen}
        onUpdated={fetchInitialData}
      />

      {/* Conflict of Interest & Shortage Policy Override Dialog */}
      <Dialog
        open={conflictPrompt.isOpen}
        onOpenChange={(open) => !open && setConflictPrompt({ isOpen: false, reason: '' })}
      >
        <DialogContent className="max-w-md bg-slate-950 border-amber-500/30 text-white p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400">
              <ShieldAlert className="size-5 shrink-0" />
              <DialogTitle className="text-lg font-black uppercase tracking-tight">
                Conflict of Interest Warning
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-300 leading-relaxed">
              {conflictPrompt.reason}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] leading-relaxed">
              <strong>Facilitator Shortage Policy:</strong> If no other neutral facilitator or official is available courtside, you may proceed to score this match under the shortage exception. Your official name and this override will be permanently attached to the certified box score audit log.
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Shortage Justification Note (Optional)
              </label>
              <Input
                placeholder="e.g., Sole assigned scorekeeper on court 2"
                value={shortageReason}
                onChange={(e) => setShortageReason(e.target.value)}
                className="bg-slate-900 border-white/10 text-white text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="ghost"
              onClick={() => setConflictPrompt({ isOpen: false, reason: '' })}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleClaimLease(true, shortageReason.trim() || undefined)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
            >
              Override & Claim Console
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating In-App Score Widget (Pinned when scrolling) */}
      {isScrolledPastScoreboard && match && (
        <FloatingScoreWidget
          sport={match.tournament?.sport}
          round={match.round}
          status={match.status}
          teamAName={match.team_a?.name || 'Team A'}
          teamBName={match.team_b?.name || 'Team B'}
          teamAScore={match.team_a_score}
          teamBScore={match.team_b_score}
          pointUnit={sportProfile.pointUnit}
          matchId={match.id}
          isPipActive={isPipActive}
          onTogglePip={handleTogglePip}
        />
      )}
    </div>
  );
};
