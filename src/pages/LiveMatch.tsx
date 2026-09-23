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
import { Trophy, ChevronLeft, Activity, Send, Clock, AlertCircle, Star, MapPin } from 'lucide-react';

import { offlineQueue } from '@/lib/offlineQueue';

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

type MatchEvent = {
  id: string;
  description: string;
  created_at: string;
};

export const LiveMatch = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { role, user, isSuperAdmin, isFacilitator } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customEvent, setCustomEvent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardedMVP, setAwardedMVP] = useState<string | null>(null);

  // Facilitator Lease State
  const [isHoldingLease, setIsHoldingLease] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  const broadcastChannelRef = useRef<any>(null);

  // Strict Governance: ONLY Facilitators and Superadmins can score games. Coaches are strictly read-only!
  const isAuthorizedScorekeeper = isFacilitator || isSuperAdmin || role === 'facilitator' || role === 'super_admin' || role === 'Admin';
  const isAuthorized = isAuthorizedScorekeeper && (isHoldingLease || isSuperAdmin);

  useEffect(() => {
    if (!matchId) {
      console.log("⏳ Waiting for Match ID before connecting to Realtime...");
      return;
    }

    fetchInitialData();
    console.log(`🔌 Connecting to Realtime for Match ID: ${matchId}`);

    let isMounted = true;

    const broadcastChannel = supabase
      .channel(`match-broadcast:${matchId}`)
      .on(
        'broadcast',
        { event: 'score_update' },
        (payload) => {
          if (!isMounted) return;
          console.log('🔥 Broadcast score received:', payload);
          const { team_a_score, team_b_score } = payload.payload;
          setMatch(prev => prev ? { ...prev, team_a_score, team_b_score } : prev);
        }
      )
      .on(
        'broadcast',
        { event: 'event_update' },
        (payload) => {
          if (!isMounted) return;
          console.log('🔥 Broadcast event received:', payload);
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
          console.log('🔥 Broadcast MVP received:', payload);
          setAwardedMVP(payload.payload.mvpName);
        }
      )
      .subscribe((status) => {
        console.log('📡 Broadcast channel status:', status);
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
          console.log("🔥 GLOBAL REALTIME PAYLOAD (matches) RECEIVED:", payload);
          setMatch((prev) => prev ? { ...prev, ...payload.new } : (payload.new as Match));
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
          console.log("🔥 GLOBAL REALTIME PAYLOAD (player_stars) RECEIVED:", payload);
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
          console.log("🔥 GLOBAL REALTIME PAYLOAD (match_events) RECEIVED:", payload);
          setEvents((prev) => [payload.new as MatchEvent, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Status for ${matchId}:`, status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      broadcastChannelRef.current = null;
    };
  }, [matchId]);

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

      // Fetch eligible players for the match roster first
      let currentRoster: EligiblePlayer[] = [];
      if (matchRes.data) {
        const { data: rosterData } = await supabase
          .from('team_roster')
          .select('player_id, users(full_name)')
          .in('team_id', [matchRes.data.team_a_id, matchRes.data.team_b_id])
          .eq('status', 'Approved');

        if (rosterData) {
          currentRoster = (rosterData as unknown) as EligiblePlayer[];
          setEligiblePlayers(currentRoster);
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
        console.log('💓 [Lease] Extended facilitator lease by 90s');
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
      setMatch(prev => prev ? {
        ...prev,
        active_scorekeeper_id: user.id,
        lease_expires_at: new Date(Date.now() + 90000).toISOString()
      } : prev);
      toast.success(force ? "Superadmin force-claimed scoring console!" : "Scoring console lease acquired!");
    }
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

  const handleUpdateScore = async (team: 'a' | 'b', points: number) => {
    if (!isAuthorizedScorekeeper || !match || match.status === 'Completed') return;
    
    // Check lease requirement
    if (!isHoldingLease && !isSuperAdmin) {
      toast.error("You must claim the scoring lease before updating the scoreboard.");
      return;
    }

    setIsSubmitting(true);

    const newScoreA = team === 'a' ? match.team_a_score + points : match.team_a_score;
    const newScoreB = team === 'b' ? match.team_b_score + points : match.team_b_score;
    const teamName = team === 'a' ? match.team_a?.name : match.team_b?.name;

    // Offline Buffering Guard
    if (!navigator.onLine) {
      offlineQueue.bufferScore(match.id, newScoreA, newScoreB);
      const offlineEvt = offlineQueue.bufferEvent(match.id, `${teamName} scored ${points} point${points > 1 ? 's' : ''}!`);
      setMatch(prev => prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev);
      setEvents(prev => [offlineEvt, ...prev]);
      setPendingOfflineCount(offlineQueue.getPendingCount(match.id));
      toast.warning("Offline Mode: Points buffered locally. Will sync upon reconnection.");
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({ team_a_score: newScoreA, team_b_score: newScoreB })
      .eq('id', match.id)
      .select()
      .single();

    if (updateError) {
      toast.error('Failed to update score: ' + updateError.message);
      setIsSubmitting(false);
      return;
    }

    // Optimistically update local state for the sender
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

    const { data: eventData, error: eventError } = await supabase.from('match_events').insert({
      match_id: match.id,
      description: `${teamName} scored ${points} point${points > 1 ? 's' : ''}!`
    }).select().single();

    if (!eventError && eventData) {
      setEvents(prev => [eventData as MatchEvent, ...prev]);
      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'event_update',
          payload: eventData
        });
      }
    }

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
      .eq('id', match.id)
      .select()
      .single();

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
        setEvents(prev => [eventData as MatchEvent, ...prev]);
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
        setEvents(prev => [eventData as MatchEvent, ...prev]);
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
              <h1 className="text-2xl md:text-3xl font-sans font-black tracking-tight uppercase leading-tight">
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
            <Badge variant={match.status === 'Completed' ? 'secondary' : 'destructive'} className="h-9 px-4 rounded-full font-bold text-xs uppercase tracking-tight animate-pulse">
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
                      : match.active_scorekeeper_id
                        ? 'Console is assigned to another official. Read-only view active.'
                        : 'No facilitator currently holds this console. Claim to begin scoring.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isHoldingLease && (!match.active_scorekeeper_id || (match.lease_expires_at && new Date(match.lease_expires_at) < new Date())) && (
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-7 text-xs" onClick={() => handleClaimLease(false)}>
                    Claim Scoring Console
                  </Button>
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
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="text-center border-b pb-3 pt-4">
                    <CardTitle className="text-primary text-base sm:text-lg">{match.team_a?.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 grid grid-cols-3 gap-2.5">
                    <Button size="lg" variant="outline" className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95" onClick={() => handleUpdateScore('a', 1)}>
                      <span className="text-lg font-bold">+1</span>
                      <span className="text-[10px] uppercase opacity-60">FT</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95" onClick={() => handleUpdateScore('a', 2)}>
                      <span className="text-lg font-bold">+2</span>
                      <span className="text-[10px] uppercase opacity-60">Field</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95" onClick={() => handleUpdateScore('a', 3)}>
                      <span className="text-lg font-bold">+3</span>
                      <span className="text-[10px] uppercase opacity-60">Triple</span>
                    </Button>
                  </CardContent>
                </Card>

                {/* Team B Controls */}
                <Card className={`rounded-2xl shadow-sm ${!match.team_b_id ? 'opacity-50 pointer-events-none' : ''}`}>
                  <CardHeader className="text-center border-b pb-3 pt-4">
                    <CardTitle className="text-primary text-base sm:text-lg">{match.team_b?.name || 'BYE'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 grid grid-cols-3 gap-2.5">
                    <Button size="lg" variant="outline" className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95" onClick={() => handleUpdateScore('b', 1)}>
                      <span className="text-lg font-bold">+1</span>
                      <span className="text-[10px] uppercase opacity-60">FT</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95" onClick={() => handleUpdateScore('b', 2)}>
                      <span className="text-lg font-bold">+2</span>
                      <span className="text-[10px] uppercase opacity-60">Field</span>
                    </Button>
                    <Button size="lg" variant="outline" className="flex flex-col h-16 sm:h-18 gap-1 border-2 rounded-xl active:scale-95" onClick={() => handleUpdateScore('b', 3)}>
                      <span className="text-lg font-bold">+3</span>
                      <span className="text-[10px] uppercase opacity-60">Triple</span>
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
                            const player = (eligiblePlayers || []).find(p => p.player_id === selectedPlayerId);
                            const users = player?.users as any;
                            return Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(eligiblePlayers || []).map((player) => {
                          const users = player.users as any;
                          const playerName = Array.isArray(users) ? users[0]?.full_name : users?.full_name;
                          return (
                            <SelectItem key={player.player_id} value={player.player_id}>
                              {playerName || 'Unknown Player'}
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
                events.map((event) => (
                  <div key={event.id} className="flex gap-4 items-start animate-in slide-in-from-left-2 duration-300">
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
    </div>
  );
};
