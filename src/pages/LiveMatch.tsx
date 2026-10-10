import { useState, useEffect, useRef } from 'react';
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
  Radio,
  Check,
  X,
  Loader2,
  MinusCircle,
  AlertTriangle,
  Users
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { offlineQueue } from '@/lib/offlineQueue';
import { FacilitatorManagementModal } from '@/components/admin/FacilitatorManagementModal';

type Match = {
  id: string;
  team_a_id: string;
  team_b_id: string | null;
  team_a_score: number;
  team_b_score: number;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  round: string;
  venue?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament_id: string;
  next_match_id?: string | null;
  next_match_slot?: 'team_a' | 'team_b' | null;
  loser_next_match_id?: string | null;
  loser_next_match_slot?: 'team_a' | 'team_b' | null;
  active_scorekeeper_id?: string | null;
  lease_expires_at?: string | null;
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

const playClaimAlertChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
};

export const LiveMatch = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { role, user, profile, isSuperAdmin, isFacilitator } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    actionType: 'FT' | 'Field' | 'Triple';
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
  const [deductPoints, setDeductPoints] = useState<1 | 2 | 3>(1);
  const [deductPlayerId, setDeductPlayerId] = useState<string>('');
  const [deductReason, setDeductReason] = useState<string>('Referee Wave-off / Offensive Foul');
  const [customDeductNote, setCustomDeductNote] = useState<string>('');

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

  // Strict Governance: ONLY Facilitators and Superadmins can score games. Coaches are strictly read-only!
  const isAuthorizedScorekeeper = isFacilitator || isSuperAdmin || role === 'facilitator' || role === 'super_admin' || role === 'Admin';
  const isAuthorized = isAuthorizedScorekeeper && (isHoldingLease || isSuperAdmin);

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
          setMatch((prev) => prev ? { ...prev, ...updatedMatch } : updatedMatch);
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
          .select('*, team_a:team_a_id(name), team_b:team_b_id(name)')
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

  const handleClaimLease = async (force: boolean = false) => {
    if (!isAuthorizedScorekeeper || !user || !matchId) return;

    const { error } = await supabase
      .from('matches')
      .update({
        active_scorekeeper_id: user.id,
        lease_expires_at: new Date(Date.now() + 90000).toISOString()
      })
      .eq('id', matchId);

    if (error) {
      toast.error("Failed to claim scoring console: " + error.message);
    } else {
      setIsHoldingLease(true);
      setActiveScorekeeperName(profile?.full_name || 'You');
      setMatch(prev => prev ? {
        ...prev,
        active_scorekeeper_id: user.id,
        lease_expires_at: new Date(Date.now() + 90000).toISOString()
      } : prev);
      toast.success(force ? "Superadmin force-claimed scoring console!" : "Scoring console lease acquired!");
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
        toast.error('Failed to transfer console lease: ' + error.message);
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

  const handleInitiateScore = (team: 'a' | 'b', points: number, actionType: 'FT' | 'Field' | 'Triple') => {
    if (!isAuthorizedScorekeeper || !match || match.status !== 'Ongoing') return;

    if (!isHoldingLease && !isSuperAdmin) {
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

    const scoreDescription = (selectedPlayer || customAttribution) && (playerName || jerseyDisplay)
      ? `[${jerseyDisplay || 'Player'}] ${playerName || 'Player'} scored ${points} point${points > 1 ? 's' : ''} (${actionType}) for ${teamName}!`
      : `${teamName} scored ${points} point${points > 1 ? 's' : ''} (${actionType})!`;

    // Offline Buffering Guard
    if (!navigator.onLine) {
      offlineQueue.bufferScore(match.id, newScoreA, newScoreB);
      const offlineEvt = offlineQueue.bufferEvent(match.id, scoreDescription);
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
      toast.error('Failed to update score: ' + updateError.message);
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

    if (!isHoldingLease && !isSuperAdmin) {
      toast.error("You must claim the scoring lease before adjusting points.");
      return;
    }

    const teamId = team === 'a' ? match.team_a_id : match.team_b_id;
    const teamName = (team === 'a' ? match.team_a?.name : match.team_b?.name) || (team === 'a' ? 'Team A' : 'Team B');

    if (!teamId) return;

    const currentScore = team === 'a' ? match.team_a_score : match.team_b_score;
    if (currentScore <= 0) {
      toast.warning(`${teamName} currently has 0 points. Cannot deduct further.`);
      return;
    }

    setPendingDeduct({
      team,
      teamId,
      teamName,
    });
    setDeductPoints(1);
    setDeductPlayerId('');
    setDeductReason('Referee Wave-off / Offensive Foul');
    setCustomDeductNote('');
  };

  const handleConfirmDeduct = async () => {
    if (!pendingDeduct || !match) return;

    const { team, teamId, teamName } = pendingDeduct;
    const currentScore = team === 'a' ? match.team_a_score : match.team_b_score;

    if (currentScore < deductPoints) {
      toast.error(`Cannot deduct ${deductPoints} points. ${teamName} only has ${currentScore} points.`);
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
    const deductDescription = `[Score Correction]: -${deductPoints} PTS from ${teamName}${playerSummary} - Reason: ${reasonSummary}`;

    // Offline Buffering Guard
    if (!navigator.onLine) {
      offlineQueue.bufferScore(match.id, newScoreA, newScoreB);
      const offlineEvt = offlineQueue.bufferEvent(match.id, deductDescription);
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
      toast.error('Failed to deduct score: ' + updateError.message);
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

    // Tie Guard: Single elimination matches cannot end in a tie
    if (newStatus === 'Completed') {
      if (match.team_a_score === match.team_b_score) {
        toast.error('Cannot complete a match with a tie score! Please break the tie first.');
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

    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', match.id);

    if (error) {
      toast.error('Failed to update status: ' + error.message);
    } else {
      toast.success(`Match status updated to ${newStatus}`);

      // Require Admin confirmation in Tournament Arena before bracket progression
      if (newStatus === 'Completed') {
        toast.info(`Match completed! Result recorded. Awaiting Admin confirmation in Tournament Arena to advance winner.`);
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
      toast.error('Failed to log event: ' + error.message);
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
        toast.error('Failed to award MVP: ' + error.message);
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
      <div className="flex flex-col justify-center items-center h-[50vh] w-full gap-4 animate-in fade-in duration-300">
        <div className="animate-spin rounded-full h-11 w-11 border-3 border-orange-500/20 border-t-orange-500"></div>
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Loading Match Data...</p>
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
                <Activity className="w-4 h-4 text-orange-500" />
                <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
                  {match.status === 'Completed' ? 'Post-Game Record' : 'Live Match Control'}
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

          <div className="flex items-center gap-3">
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
        {/* Scoreboard */}
        <Card className="bg-primary text-primary-foreground shadow-xl overflow-hidden border-none rounded-2xl">
          <CardContent className="p-0">
            <div className="bg-black/20 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest opacity-80 flex items-center justify-center gap-2">
              <span>{match.round}</span>
              {match.venue && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1"><MapPin className="size-3 text-orange-400" /> {match.venue}</span>
                </>
              )}
              <span>•</span>
              <span>Live Scoring</span>
            </div>
            <div className="flex items-center justify-between p-6 md:p-8">
              <div className="flex-1 text-center">
                <h2 className="text-lg md:text-xl font-bold mb-1 uppercase">{match.team_a?.name || 'Team A'}</h2>
                <div className="text-5xl md:text-7xl font-black tabular-nums">{match.team_a_score}</div>
              </div>

              <div className="px-6 text-3xl font-black italic opacity-40">VS</div>

              <div className="flex-1 text-center">
                <h2 className="text-lg md:text-xl font-bold mb-1 uppercase">{match.team_b?.name || 'BYE'}</h2>
                <div className="text-5xl md:text-7xl font-black tabular-nums">{match.team_b_score}</div>
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
              <div className="bg-black/10 p-3 flex items-center justify-center gap-2 text-xs font-semibold text-white/80">
                <Activity className="size-3.5 text-orange-400 animate-pulse" />
                <span>Spectator Mode • Official Match Scoring Managed Exclusively by PSU Facilitators</span>
                {match.status === 'Completed' && (
                  <span className="font-bold text-yellow-300 ml-2">
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
                {isSuperAdmin && (
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
                {!isHoldingLease && match.active_scorekeeper_id && isSuperAdmin && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs font-bold" onClick={() => handleClaimLease(true)}>
                    Force-Claim (Admin)
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

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
                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">{awardedMVP}</h3>
                    <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest mt-4">
                      Official Red Star MVP
                    </div>
                    <p className="text-slate-500 text-sm mt-6 max-w-xs mx-auto">
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
                    <div className="grid grid-cols-3 gap-2.5">
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                        onClick={() => handleInitiateScore('a', 1, 'FT')}
                      >
                        <span className="text-lg font-black">+1</span>
                        <span className="text-[10px] uppercase font-bold opacity-60">FT</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                        onClick={() => handleInitiateScore('a', 2, 'Field')}
                      >
                        <span className="text-lg font-black">+2</span>
                        <span className="text-[10px] uppercase font-bold opacity-60">Field</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                        onClick={() => handleInitiateScore('a', 3, 'Triple')}
                      >
                        <span className="text-lg font-black">+3</span>
                        <span className="text-[10px] uppercase font-bold opacity-60">Triple</span>
                      </Button>
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
                    <div className="grid grid-cols-3 gap-2.5">
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                        onClick={() => handleInitiateScore('b', 1, 'FT')}
                      >
                        <span className="text-lg font-black">+1</span>
                        <span className="text-[10px] uppercase font-bold opacity-60">FT</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                        onClick={() => handleInitiateScore('b', 2, 'Field')}
                      >
                        <span className="text-lg font-black">+2</span>
                        <span className="text-[10px] uppercase font-bold opacity-60">Field</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                        onClick={() => handleInitiateScore('b', 3, 'Triple')}
                      >
                        <span className="text-lg font-black">+3</span>
                        <span className="text-[10px] uppercase font-bold opacity-60">Triple</span>
                      </Button>
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-left">Select MVP Player</label>
                    <Select value={selectedPlayerId} onValueChange={(val) => setSelectedPlayerId(val || '')}>
                      <SelectTrigger className="w-full bg-white border-slate-200">
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
                            <span className="font-semibold text-slate-200 truncate">
                              {name || 'Unknown'}
                            </span>
                            {player.is_captain && (
                              <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/20 px-1 rounded shrink-0">C</span>
                            )}
                          </div>
                          <span className={`font-black font-mono shrink-0 ml-2 ${pts > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                            {pts} PTS
                          </span>
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
                            <span className="font-semibold text-slate-200 truncate">
                              {name || 'Unknown'}
                            </span>
                            {player.is_captain && (
                              <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/20 px-1 rounded shrink-0">C</span>
                            )}
                          </div>
                          <span className={`font-black font-mono shrink-0 ml-2 ${pts > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                            {pts} PTS
                          </span>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col bg-slate-950 border-slate-800 text-white p-0 overflow-hidden shadow-2xl">
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
              Select the scoring player by jersey number to attribute +{pendingScore?.points} PTS, or credit to the team directly.
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
                            {currentPts} PTS
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
                        <div className="w-full mt-1.5">
                          <p className="text-xs font-bold text-white group-hover:text-orange-400 truncate max-w-full">
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
              Record as Team Point (Uncredited)
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
                  {pendingDeduct?.teamName} (Current: {pendingDeduct?.team === 'a' ? match.team_a_score : match.team_b_score} PTS)
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
                Points to Deduct:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((pts) => {
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
                      -{pts} PTS
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
                  <SelectValue placeholder="Team / Uncredited (Do not deduct player stats)" />
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
                      return (
                        <SelectItem key={p.player_id} value={p.player_id}>
                          {jersey}{name || 'Player'} ({pts} PTS)
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
              Confirm -{deductPoints} PTS Deduction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FacilitatorManagementModal
        open={isFacilitatorModalOpen}
        onOpenChange={setIsFacilitatorModalOpen}
        onUpdated={fetchInitialData}
      />
    </div>
  );
};
