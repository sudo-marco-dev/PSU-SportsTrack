import { useState, useEffect, useRef, useMemo, createElement, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  Wifi,
  WifiOff,
  ShieldCheck,
  Play,
  Pause,
  Undo2,
  ArrowLeftRight,
  Timer,
  X,
  LogIn,
} from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';
import { getSportScoringProfile } from '@/lib/sportScoringRules';
import { getSportIcon } from '@/lib/sportIcons';
import { offlineQueue } from '@/lib/offlineQueue';
import {
  useAudioFx,
  playScoreChime,
  playBuzzerSound,
  playWhistleSound,
  playTimeoutSound,
  playSubHornSound,
  playClockStartSound,
  playClockPauseSound,
} from '@/lib/audioFx';
import {
  type FloatingDelta,
  type LeadChangeAlert,
  detectLeadChange,
} from '@/lib/scoreboardAnimations';
import { LeadChangeBanner } from '@/components/scoreboard/LeadChangeBanner';
import { KioskScoreColumn } from '@/components/kiosk/KioskScoreColumn';
import { KioskCenterConsole } from '@/components/kiosk/KioskCenterConsole';
import {
  KioskSubstitutionModal,
  type RosterPlayerItem,
} from '@/components/kiosk/KioskSubstitutionModal';

type Match = {
  id: string;
  round: string;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  team_a_score: number;
  team_b_score: number;
  team_a_id: string;
  team_b_id: string | null;
  venue?: string | null;
  match_time?: string | null;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament_id: string;
  tournament?: {
    name: string;
    sport: string;
  } | null;
  active_scorekeeper_id?: string | null;
  lease_expires_at?: string | null;
};

type MatchEvent = {
  id: string;
  match_id: string;
  description: string;
  created_at?: string;
};

export const FacilitatorKiosk = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, isSuperAdmin, isFacilitator, openLoginModal } = useAuth();

  // Match and Realtime State
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  // Network online listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Facilitator Console Lease
  const [isHoldingLease, setIsHoldingLease] = useState(false);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Wake Lock & Fullscreen
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio FX
  const { enabled: isAudioActive, toggle: toggleAudioActive } = useAudioFx();

  // Sport Scoring Profile
  const sportProfile = useMemo(
    () => getSportScoringProfile(match?.tournament?.sport),
    [match?.tournament?.sport]
  );

  // Court Side Switch State
  const [isSwappedSides, setIsSwappedSides] = useState<boolean>(() => {
    return localStorage.getItem('psu_kiosk_swap_sides') === 'true';
  });

  const toggleSwapSides = useCallback(() => {
    setIsSwappedSides((prev) => {
      const next = !prev;
      localStorage.setItem('psu_kiosk_swap_sides', next ? 'true' : 'false');
      return next;
    });
  }, []);

  // Orientation Mode: 'auto' | 'landscape' | 'portrait'
  const [orientationMode, setOrientationMode] = useState<'auto' | 'landscape' | 'portrait'>(() => {
    const saved = localStorage.getItem('psu_kiosk_orientation');
    if (saved === 'landscape' || saved === 'portrait') return saved;
    return 'auto';
  });

  const handleOrientationChange = useCallback((mode: 'auto' | 'landscape' | 'portrait') => {
    setOrientationMode(mode);
    localStorage.setItem('psu_kiosk_orientation', mode);
  }, []);

  // Fouls and Timeouts State
  const [teamAFouls, setTeamAFouls] = useState<number>(0);
  const [teamBFouls, setTeamBFouls] = useState<number>(0);
  const [teamATimeoutsRemaining, setTeamATimeoutsRemaining] = useState<number>(3);
  const [teamBTimeoutsRemaining, setTeamBTimeoutsRemaining] = useState<number>(3);

  // Active Timeout Stopwatch
  const [activeTimeoutTeam, setActiveTimeoutTeam] = useState<'a' | 'b' | null>(null);
  const [activeTimeoutSeconds, setActiveTimeoutSeconds] = useState<number>(0);

  // Master Game Clock
  const [currentPeriod, setCurrentPeriod] = useState<string>(
    () => sportProfile.periods[0] || '1st Quarter'
  );
  const [gameTimeSeconds, setGameTimeSeconds] = useState<number>(
    () => (sportProfile.defaultPeriodMinutes || 10) * 60
  );
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);
  const [isClockEnabled, setIsClockEnabled] = useState<boolean>(true);

  // Active Players On-Court (Player IDs)
  const [activePlayerIdsA, setActivePlayerIdsA] = useState<Set<string>>(new Set());
  const [activePlayerIdsB, setActivePlayerIdsB] = useState<Set<string>>(new Set());

  // Substitution Modal State
  const [subModalTeam, setSubModalTeam] = useState<'a' | 'b' | null>(null);

  // Score Animations and Deltas
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

  // Last score action for 1-tap Undo
  const lastScoreActionRef = useRef<{
    team: 'a' | 'b';
    points: number;
    prevScoreA: number;
    prevScoreB: number;
    eventId?: string;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Viewport Dimension & Orientation Snapping
  const [windowDimensions, setWindowDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isPhysicalLandscape = windowDimensions.width > windowDimensions.height;
  const isMobileWidth = windowDimensions.width < 768;
  const isShortScreen = windowDimensions.height <= 480;

  // Effective layout mode: landscape vs portrait
  const isLandscapeMode =
    orientationMode === 'landscape' || (orientationMode === 'auto' && (isPhysicalLandscape || !isMobileWidth));

  // Mobile View Tab in Portrait Mode: 'split' | 'team_a' | 'team_b' | 'clock'
  const [mobileTab, setMobileTab] = useState<'split' | 'team_a' | 'team_b' | 'clock'>('split');

  // Formatted Game Clock MM:SS
  const formattedTime = useMemo(() => {
    const mins = Math.floor(Math.max(0, gameTimeSeconds) / 60);
    const secs = Math.max(0, gameTimeSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [gameTimeSeconds]);

  // Strict Governance: Facilitator/Admin authorization
  // User must be authenticated to satisfy Postgres Row Level Security (RLS) policies
  const isAuthorizedScorekeeper = Boolean(user && (isFacilitator || isSuperAdmin));
  const isAuthorized = Boolean(user && (isHoldingLease || isSuperAdmin || isFacilitator));

  // Broadcast Master Clock State to Arena Screens & Connected Clients
  const broadcastClockState = useCallback(
    (running: boolean, seconds: number, period: string, enabled: boolean = isClockEnabled) => {
      if (!broadcastChannelRef.current || !matchId) return;
      broadcastChannelRef.current
        .send({
          type: 'broadcast',
          event: 'clock_update',
          payload: {
            match_id: matchId,
            seconds,
            isRunning: running,
            period,
            isEnabled: enabled,
            timestamp: Date.now(),
          },
        })
        .catch(() => {});
    },
    [matchId, isClockEnabled]
  );

  // Toggle Clock Play/Pause with Audio Cues & Realtime Sync
  const handleToggleClock = useCallback(() => {
    setIsClockRunning((prev) => {
      const next = !prev;
      if (next) {
        playClockStartSound();
      } else {
        playClockPauseSound();
      }
      broadcastClockState(next, gameTimeSeconds, currentPeriod);
      return next;
    });
  }, [broadcastClockState, gameTimeSeconds, currentPeriod]);

  // Adjust Clock (+/- Seconds) with Realtime Sync
  const handleAdjustClock = useCallback(
    (delta: number) => {
      setGameTimeSeconds((prev) => {
        const next = Math.max(0, prev + delta);
        broadcastClockState(isClockRunning, next, currentPeriod);
        return next;
      });
    },
    [broadcastClockState, isClockRunning, currentPeriod]
  );

  // Reset Clock to Period Duration
  const handleResetClock = useCallback(() => {
    const secs = (sportProfile.defaultPeriodMinutes || 10) * 60;
    setIsClockRunning(false);
    setGameTimeSeconds(secs);
    playClockPauseSound();
    broadcastClockState(false, secs, currentPeriod);
    toast.info('Game clock reset to period start.');
  }, [sportProfile.defaultPeriodMinutes, currentPeriod, broadcastClockState]);

  // Select New Match Period
  const handleSelectPeriod = useCallback(
    (period: string) => {
      setCurrentPeriod(period);
      const secs = (sportProfile.defaultPeriodMinutes || 10) * 60;
      setGameTimeSeconds(secs);
      setIsClockRunning(false);
      broadcastClockState(false, secs, period);
      toast.info(`Period changed: ${period}. Clock reset.`);
    },
    [sportProfile.defaultPeriodMinutes, broadcastClockState]
  );

  // Cancel / End Active Timeout Early
  const handleCancelTimeout = useCallback(() => {
    setActiveTimeoutSeconds(0);
    setActiveTimeoutTeam(null);
    playWhistleSound();
    toast.info('Timeout concluded courtside.');
    if (broadcastChannelRef.current && matchId) {
      broadcastChannelRef.current
        .send({
          type: 'broadcast',
          event: 'timeout_update',
          payload: {
            match_id: matchId,
            active: false,
          },
        })
        .catch(() => {});
    }
  }, [matchId]);

  // Master Clock interval runner
  useEffect(() => {
    if (!isClockRunning || !isClockEnabled) return;
    const timer = setInterval(() => {
      setGameTimeSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsClockRunning(false);
          playBuzzerSound();
          broadcastClockState(false, 0, currentPeriod);
          toast.info(`Period completed: ${currentPeriod}! Arena horn sounded.`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isClockRunning, isClockEnabled, currentPeriod, broadcastClockState]);

  // Clock broadcast heartbeat while running (every 4s prevents drift on remote displays)
  useEffect(() => {
    if (!isClockRunning || !isClockEnabled) return;
    const heartbeat = setInterval(() => {
      broadcastClockState(true, gameTimeSeconds, currentPeriod);
    }, 4000);

    return () => clearInterval(heartbeat);
  }, [isClockRunning, isClockEnabled, gameTimeSeconds, currentPeriod, broadcastClockState]);

  // Active Timeout Stopwatch interval runner
  useEffect(() => {
    if (activeTimeoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setActiveTimeoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setActiveTimeoutTeam(null);
          playWhistleSound();
          if (broadcastChannelRef.current && matchId) {
            broadcastChannelRef.current
              .send({
                type: 'broadcast',
                event: 'timeout_update',
                payload: {
                  match_id: matchId,
                  active: false,
                },
              })
              .catch(() => {});
          }
          toast.warning('Timeout concluded! Resuming game.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTimeoutSeconds, matchId]);

  // Screen Wake Lock API
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          const nav = navigator as unknown as { wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> } };
          wakeLockRef.current = await nav.wakeLock.request('screen');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.log('Wake Lock unavailable:', err);
      }
    };
    void requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Fetch initial match and roster data
  const fetchMatchData = useCallback(async () => {
    if (!matchId) return;
    try {
      const [matchRes, eventsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('*, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), tournament:tournaments(name, sport)')
          .eq('id', matchId)
          .single(),
        supabase
          .from('match_events')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (matchRes.data) {
        const m = matchRes.data as Match;
        setMatch(m);

        // Check lease
        if (m.active_scorekeeper_id === user?.id) {
          const isExpired = m.lease_expires_at ? new Date(m.lease_expires_at) < new Date() : false;
          setIsHoldingLease(!isExpired);
        } else {
          setIsHoldingLease(false);
        }

        // Fetch Rosters
        const teamIds = [m.team_a_id, m.team_b_id].filter(Boolean);
        const { data: rosterData } = await supabase
          .from('team_roster')
          .select('id, team_id, player_id, jersey_number, position, is_captain, is_starter, availability_status, status, users(full_name)')
          .in('team_id', teamIds)
          .neq('status', 'Rejected');

        if (rosterData) {
          const items = rosterData as RosterPlayerItem[];
          setRosterPlayers(items);

          // Seed active court players based on starters or first N
          const count = getSportScoringProfile(m.tournament?.sport).onCourtPlayerCount || 5;
          const aPlayers = items.filter((p) => p.team_id === m.team_a_id);
          const bPlayers = items.filter((p) => p.team_id === m.team_b_id);

          const startersA = aPlayers.filter((p) => p.is_starter).map((p) => p.player_id);
          const initialA = startersA.length >= count ? startersA.slice(0, count) : aPlayers.slice(0, count).map((p) => p.player_id);
          setActivePlayerIdsA(new Set(initialA));

          const startersB = bPlayers.filter((p) => p.is_starter).map((p) => p.player_id);
          const initialB = startersB.length >= count ? startersB.slice(0, count) : bPlayers.slice(0, count).map((p) => p.player_id);
          setActivePlayerIdsB(new Set(initialB));
        }
      }

      if (eventsRes.data) {
        setEvents(eventsRes.data as MatchEvent[]);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error fetching kiosk data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [matchId, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMatchData();
  }, [fetchMatchData]);

  // Facilitator Lease 15-second Heartbeat
  useEffect(() => {
    if (!isHoldingLease || !matchId || !user?.id) return;
    const heartbeat = setInterval(async () => {
      try {
        await supabase
          .from('matches')
          .update({
            active_scorekeeper_id: user.id,
            lease_expires_at: new Date(Date.now() + 90000).toISOString(),
          })
          .eq('id', matchId);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Kiosk lease heartbeat failed:', err);
      }
    }, 15000);

    return () => clearInterval(heartbeat);
  }, [isHoldingLease, matchId, user?.id]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Supabase Realtime channel
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`kiosk_match_${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          const updated = payload.new as Match;
          setMatch((prev) => (prev ? { ...prev, ...updated, tournament: prev.tournament } : updated));
          if (user?.id && updated.active_scorekeeper_id !== user.id) {
            setIsHoldingLease(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const newEvent = payload.new as MatchEvent;
          setEvents((prev) => [newEvent, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    const broadcast = supabase
      .channel(`match-broadcast:${matchId}`)
      .on('broadcast', { event: 'score_update' }, (payload) => {
        if (payload.payload) {
          const { team_a_score, team_b_score } = payload.payload;
          setMatch((prev) => (prev ? { ...prev, team_a_score, team_b_score } : prev));
        }
      })
      .subscribe();

    broadcastChannelRef.current = broadcast;

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcast);
    };
  }, [matchId, user?.id]);

  // Reactive score change animation and audio triggers
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
      setTimeout(() => setDeltasA((prev) => prev.filter((d) => d.id !== newDelta.id)), 1400);
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
      setTimeout(() => setDeltasB((prev) => prev.filter((d) => d.id !== newDelta.id)), 1400);
    }

    if (diffA > 0 || diffB > 0) {
      playScoreChime(Math.max(diffA, diffB));
    } else if (diffA < 0 || diffB < 0) {
      playWhistleSound();
    }

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
      setTimeout(() => setLeadChangeAlert((prev) => (prev?.timestamp === leadChange.timestamp ? null : prev)), 5000);
    }

    prevScoresRef.current = { a: currA, b: currB, hasInitialized: true };
  }, [match]);

  // Score Action Handler
  const handleScore = async (
    team: 'a' | 'b',
    points: number,
    actionType: string,
    actionDesc?: string
  ) => {
    if (!match) return;
    if (!user) {
      toast.error('You must log in to record official scores in the tournament database.');
      openLoginModal();
      return;
    }
    if (!isAuthorized) {
      toast.error('You must claim the scoring console lease before updating points.');
      return;
    }

    const teamId = team === 'a' ? match.team_a_id : match.team_b_id;
    const teamName = team === 'a' ? match.team_a?.name || 'Team A' : match.team_b?.name || 'Team B';
    if (!teamId) return;

    const newScoreA = team === 'a' ? match.team_a_score + points : match.team_a_score;
    const newScoreB = team === 'b' ? match.team_b_score + points : match.team_b_score;

    const desc = `${teamName} scored ${points} ${sportProfile.pointUnit} (${actionDesc || actionType})!`;

    // Save for undo
    lastScoreActionRef.current = {
      team,
      points,
      prevScoreA: match.team_a_score,
      prevScoreB: match.team_b_score,
    };

    if (!navigator.onLine) {
      offlineQueue.bufferScore(match.id, newScoreA, newScoreB);
      const offlineEvt = offlineQueue.bufferEvent(match.id, desc);
      setMatch((prev) => (prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev));
      setEvents((prev) => [offlineEvt, ...prev]);
      setPendingOfflineCount(offlineQueue.getPendingCount(match.id));
      toast.warning('Offline Mode: Score buffered locally.');
      return;
    }

    const { data: updatedMatches, error } = await supabase
      .from('matches')
      .update({ team_a_score: newScoreA, team_b_score: newScoreB })
      .eq('id', match.id)
      .select('id');

    if (error) {
      toast.error('Failed to update score: ' + error.message);
      return;
    }

    if (!updatedMatches || updatedMatches.length === 0) {
      toast.error('Permission Denied: Database write rejected. Please claim the scoring console lease.');
      return;
    }

    setMatch((prev) => (prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev));

    if (broadcastChannelRef.current) {
      await broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'score_update',
        payload: {
          match_id: match.id,
          team_a_score: newScoreA,
          team_b_score: newScoreB,
        },
      });
    }

    // Insert score audit event
    await supabase.from('match_score_events').insert({
      match_id: match.id,
      team_id: teamId,
      points: points,
      action_type: actionType,
      stat_type: `PTS_${points}`,
      delta: points,
    });

    const { data: eventData } = await supabase
      .from('match_events')
      .insert({ match_id: match.id, description: desc })
      .select()
      .single();

    if (eventData) {
      setEvents((prev) => [eventData as MatchEvent, ...prev.slice(0, 9)]);
    }
    setCanUndo(true);
  };

  // 1-Tap Undo Last Score Action
  const handleUndoLastScore = async () => {
    if (!match || !lastScoreActionRef.current) return;
    if (!user) {
      toast.error('You must log in to undo score actions.');
      openLoginModal();
      return;
    }
    const { prevScoreA, prevScoreB } = lastScoreActionRef.current;

    const { data: updatedMatches, error } = await supabase
      .from('matches')
      .update({ team_a_score: prevScoreA, team_b_score: prevScoreB })
      .eq('id', match.id)
      .select('id');

    if (error) {
      toast.error('Failed to undo action: ' + error.message);
      return;
    }

    if (!updatedMatches || updatedMatches.length === 0) {
      toast.error('Permission Denied: Database write rejected.');
      return;
    }

    setMatch((prev) => (prev ? { ...prev, team_a_score: prevScoreA, team_b_score: prevScoreB } : prev));
    lastScoreActionRef.current = null;
    setCanUndo(false);
    toast.success('Undid last score action successfully.');
    playWhistleSound();
  };

  // Quick 1-Tap Deduct
  const handleQuickDeduct = async (team: 'a' | 'b') => {
    if (!match) return;
    if (!user) {
      toast.error('You must log in to record score corrections.');
      openLoginModal();
      return;
    }
    if (!isAuthorized) {
      toast.error('You must claim the scoring console lease before updating points.');
      return;
    }
    const current = team === 'a' ? match.team_a_score : match.team_b_score;
    if (current <= 0) return;

    const points = sportProfile.deductibleValues[0] || 1;
    const newScoreA = team === 'a' ? match.team_a_score - points : match.team_a_score;
    const newScoreB = team === 'b' ? match.team_b_score - points : match.team_b_score;
    const teamName = team === 'a' ? match.team_a?.name : match.team_b?.name;

    const { data: updatedMatches, error } = await supabase
      .from('matches')
      .update({ team_a_score: newScoreA, team_b_score: newScoreB })
      .eq('id', match.id)
      .select('id');

    if (error) {
      toast.error('Failed to deduct score: ' + error.message);
      return;
    }

    if (!updatedMatches || updatedMatches.length === 0) {
      toast.error('Permission Denied: Database write rejected.');
      return;
    }

    setMatch((prev) => (prev ? { ...prev, team_a_score: newScoreA, team_b_score: newScoreB } : prev));
    toast.warning(`Deducted -${points} ${sportProfile.pointUnit} from ${teamName}`);
    playWhistleSound();
  };

  // Quick Team Foul increment
  const handleAddFoul = async (team: 'a' | 'b') => {
    if (!match) return;
    if (!user) {
      toast.error('You must log in to record match fouls.');
      openLoginModal();
      return;
    }
    if (!isAuthorized) {
      toast.error('You must claim the scoring console lease before recording fouls.');
      return;
    }
    const teamName = team === 'a' ? match.team_a?.name || 'Team A' : match.team_b?.name || 'Team B';
    let nextA = teamAFouls;
    let nextB = teamBFouls;
    if (team === 'a') {
      nextA = teamAFouls + 1;
      setTeamAFouls(nextA);
    } else {
      nextB = teamBFouls + 1;
      setTeamBFouls(nextB);
    }

    playWhistleSound();
    const desc = `[Foul Recorded]: Team foul against ${teamName}.`;
    toast.info(desc);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current
        .send({
          type: 'broadcast',
          event: 'foul_update',
          payload: {
            match_id: match.id,
            team,
            teamName,
            teamAFouls: nextA,
            teamBFouls: nextB,
          },
        })
        .catch(() => {});
    }

    await supabase.from('match_events').insert({ match_id: match.id, description: desc });
  };

  // Call Timeout: Immediately auto-pauses the game clock, plays courtside timeout siren, and broadcasts
  const handleCallTimeout = async (team: 'a' | 'b') => {
    if (!match) return;
    if (!user) {
      toast.error('You must log in to call official timeouts.');
      openLoginModal();
      return;
    }
    if (!isAuthorized) {
      toast.error('You must claim the scoring console lease before calling timeouts.');
      return;
    }
    const teamName = team === 'a' ? match.team_a?.name || 'Team A' : match.team_b?.name || 'Team B';

    let nextA = teamATimeoutsRemaining;
    let nextB = teamBTimeoutsRemaining;
    if (team === 'a') {
      if (teamATimeoutsRemaining <= 0) {
        toast.error(`${teamName} has no timeouts remaining!`);
        return;
      }
      nextA = Math.max(0, teamATimeoutsRemaining - 1);
      setTeamATimeoutsRemaining(nextA);
    } else {
      if (teamBTimeoutsRemaining <= 0) {
        toast.error(`${teamName} has no timeouts remaining!`);
        return;
      }
      nextB = Math.max(0, teamBTimeoutsRemaining - 1);
      setTeamBTimeoutsRemaining(nextB);
    }

    // 1. Auto-pause the master clock immediately
    if (isClockRunning) {
      setIsClockRunning(false);
      broadcastClockState(false, gameTimeSeconds, currentPeriod);
    }

    // 2. Start timeout stopwatch
    setActiveTimeoutTeam(team);
    setActiveTimeoutSeconds(60);
    playTimeoutSound();

    const desc = `[Timeout]: Called by ${teamName} (60s countdown). Clock auto-paused.`;
    toast.warning(desc);

    // 3. Broadcast timeout update and clock update to connected arena screens & clients
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current
        .send({
          type: 'broadcast',
          event: 'timeout_update',
          payload: {
            match_id: match.id,
            team,
            teamName,
            seconds: 60,
            active: true,
            teamATimeouts: nextA,
            teamBTimeouts: nextB,
            clockSeconds: gameTimeSeconds,
            isClockRunning: false,
          },
        })
        .catch(() => {});
    }

    await supabase.from('match_events').insert({ match_id: match.id, description: desc });
  };

  // Execute Player Substitution: Plays table sub horn and broadcasts banner
  const handleConfirmSub = async (
    subOutPlayer: RosterPlayerItem,
    subInPlayer: RosterPlayerItem
  ) => {
    if (!match || !subModalTeam) return;
    if (!user) {
      toast.error('You must log in to execute player substitutions.');
      openLoginModal();
      return;
    }
    if (!isAuthorized) {
      toast.error('You must claim the scoring console lease before executing substitutions.');
      return;
    }

    if (subModalTeam === 'a') {
      setActivePlayerIdsA((prev) => {
        const next = new Set(prev);
        next.delete(subOutPlayer.player_id);
        next.add(subInPlayer.player_id);
        return next;
      });
    } else {
      setActivePlayerIdsB((prev) => {
        const next = new Set(prev);
        next.delete(subOutPlayer.player_id);
        next.add(subInPlayer.player_id);
        return next;
      });
    }

    playSubHornSound();
    const teamName = subModalTeam === 'a' ? match.team_a?.name || 'Team A' : match.team_b?.name || 'Team B';
    const outJersey = subOutPlayer.jersey_number ? `${subOutPlayer.jersey_number}` : '';
    const inJersey = subInPlayer.jersey_number ? `${subInPlayer.jersey_number}` : '';
    const resolveName = (u: RosterPlayerItem['users']) => {
      if (!u) return '';
      if (Array.isArray(u)) return u[0]?.full_name || '';
      return u.full_name || '';
    };
    const outName = resolveName(subOutPlayer.users) || (outJersey ? `Jersey #${outJersey}` : 'Player');
    const inName = resolveName(subInPlayer.users) || (inJersey ? `Jersey #${inJersey}` : 'Player');
    const desc = `[Substitution]: ${outJersey ? '#' + outJersey + ' ' : ''}${outName} Off -> ${inJersey ? '#' + inJersey + ' ' : ''}${inName} On for ${teamName}.`;
    toast.success(desc);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current
        .send({
          type: 'broadcast',
          event: 'substitution_alert',
          payload: {
            id: `sub-${Date.now()}`,
            match_id: match.id,
            team: subModalTeam,
            teamName,
            outPlayer: outName,
            inPlayer: inName,
            outJersey,
            inJersey,
            timestamp: Date.now(),
          },
        })
        .catch(() => {});
    }

    await supabase.from('match_events').insert({ match_id: match.id, description: desc });
  };

  // Console Lease Claim
  const handleClaimLease = async () => {
    if (!user) {
      toast.info('Please log in with your facilitator or admin account to claim the scoring console.');
      openLoginModal();
      return;
    }
    if (!matchId) return;

    const { data: updatedMatches, error } = await supabase
      .from('matches')
      .update({
        active_scorekeeper_id: user.id,
        lease_expires_at: new Date(Date.now() + 90000).toISOString(),
      })
      .eq('id', matchId)
      .select('id');

    if (error) {
      toast.error('Failed to claim console: ' + error.message);
    } else if (!updatedMatches || updatedMatches.length === 0) {
      toast.error('Permission Denied: Only authorized facilitators or admins can claim the scoring console.');
    } else {
      setIsHoldingLease(true);
      toast.success('Kiosk Scoring Console claimed! You are presiding.');
      fetchMatchData();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="size-16 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
        <span className="font-mono text-sm tracking-[0.3em] uppercase text-slate-400">
          Initializing Facilitator Kiosk Deck...
        </span>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <h2 className="text-3xl font-black uppercase tracking-tight text-red-400 mb-2">Match Not Found</h2>
        <Button onClick={() => navigate('/explorer')} className="bg-orange-500 font-black">
          Return to Explorer
        </Button>
      </div>
    );
  }

  // Active roster partitions
  const teamAPlayers = rosterPlayers.filter((p) => p.team_id === match.team_a_id);
  const teamBPlayers = rosterPlayers.filter((p) => p.team_id === match.team_b_id);

  const activePlayersA = teamAPlayers.filter((p) => activePlayerIdsA.has(p.player_id));
  const benchPlayersA = teamAPlayers.filter((p) => !activePlayerIdsA.has(p.player_id));

  const activePlayersB = teamBPlayers.filter((p) => activePlayerIdsB.has(p.player_id));
  const benchPlayersB = teamBPlayers.filter((p) => !activePlayerIdsB.has(p.player_id));

  const isTeamALeading = match.team_a_score > match.team_b_score;
  const isTeamBLeading = match.team_b_score > match.team_a_score;

  // Determine if compact mode should be applied to cards
  const isCompactMode = isShortScreen || isMobileWidth || !isLandscapeMode;

  // Render Column A Component
  const renderColumnA = (compact = isCompactMode) => (
    <KioskScoreColumn
      team="a"
      teamName={match.team_a?.name || 'Team A'}
      score={match.team_a_score}
      pointUnit={sportProfile.pointUnit}
      actions={sportProfile.actions}
      onScore={handleScore}
      onDeduct={handleQuickDeduct}
      fouls={teamAFouls}
      onAddFoul={handleAddFoul}
      foulBonusThreshold={sportProfile.teamFoulBonusThreshold}
      timeoutsRemaining={teamATimeoutsRemaining}
      totalTimeouts={sportProfile.defaultTimeouts || 3}
      onCallTimeout={handleCallTimeout}
      activePlayers={activePlayersA}
      onOpenSubModal={() => setSubModalTeam('a')}
      isLeading={isTeamALeading}
      isAuthorized={isAuthorized}
      deltas={deltasA}
      isPopping={isPoppingA}
      accentColor="orange"
      compact={compact}
    />
  );

  // Render Column B Component
  const renderColumnB = (compact = isCompactMode) => (
    <KioskScoreColumn
      team="b"
      teamName={match.team_b?.name || 'Team B'}
      score={match.team_b_score}
      pointUnit={sportProfile.pointUnit}
      actions={sportProfile.actions}
      onScore={handleScore}
      onDeduct={handleQuickDeduct}
      fouls={teamBFouls}
      onAddFoul={handleAddFoul}
      foulBonusThreshold={sportProfile.teamFoulBonusThreshold}
      timeoutsRemaining={teamBTimeoutsRemaining}
      totalTimeouts={sportProfile.defaultTimeouts || 3}
      onCallTimeout={handleCallTimeout}
      activePlayers={activePlayersB}
      onOpenSubModal={() => setSubModalTeam('b')}
      isLeading={isTeamBLeading}
      isAuthorized={isAuthorized}
      deltas={deltasB}
      isPopping={isPoppingB}
      accentColor="cyan"
      compact={compact}
    />
  );

  // Render Center Console Component
  const renderCenterConsole = (compact = isCompactMode) => (
    <KioskCenterConsole
      gameTimeSeconds={gameTimeSeconds}
      isClockRunning={isClockRunning}
      onToggleClock={handleToggleClock}
      onAdjustClock={handleAdjustClock}
      onResetClock={handleResetClock}
      isClockEnabled={isClockEnabled}
      onToggleClockEnabled={() => setIsClockEnabled((p) => !p)}
      currentPeriod={currentPeriod}
      periods={sportProfile.periods}
      onSelectPeriod={handleSelectPeriod}
      isSwappedSides={isSwappedSides}
      onToggleSwapSides={toggleSwapSides}
      orientationMode={orientationMode}
      onChangeOrientationMode={handleOrientationChange}
      activeTimeoutTeam={activeTimeoutTeam}
      activeTimeoutTeamName={activeTimeoutTeam === 'a' ? match.team_a?.name : match.team_b?.name}
      activeTimeoutSeconds={activeTimeoutSeconds}
      onCancelTimeoutCountdown={handleCancelTimeout}
      recentEvents={events}
      onUndoLastScore={handleUndoLastScore}
      canUndo={canUndo}
      isAudioActive={isAudioActive}
      onToggleAudio={toggleAudioActive}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      compact={compact}
    />
  );

  return (
    <div className="h-dvh max-h-dvh w-full max-w-full overflow-hidden bg-[#020617] text-white flex flex-col justify-between p-1.5 sm:p-3 select-none relative">
      {/* Top Header Control Strip */}
      <header className="w-full shrink-0 px-2 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between border-b border-white/10 bg-slate-950/90 rounded-xl mb-1.5 sm:mb-2 relative z-20">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/match/${match.id}`)}
            className="size-7 sm:size-8 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 shrink-0"
            title="Return to standard Match Control"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="p-0.5 sm:p-1 rounded bg-orange-500 text-slate-950 shrink-0">
                {createElement(getSportIcon(match.tournament?.sport), { className: 'size-2.5 sm:size-3' })}
              </span>
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-orange-400 truncate">
                {match.tournament?.sport || 'Game'} • {match.round}
              </span>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[8px] font-black uppercase h-3.5 px-1 shrink-0">
                KIOSK
              </Badge>
            </div>
            <h1 className="text-[11px] sm:text-sm font-black uppercase italic tracking-tight text-white truncate max-w-[120px] sm:max-w-xs hidden xs:block">
              {match.tournament?.name || 'PSU Collegiate Games'}
            </h1>
          </div>
        </div>

        {/* In Mobile Portrait Mode: Quick View Switcher Tabs */}
        {!isLandscapeMode && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab('split')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                mobileTab === 'split' ? 'bg-orange-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('team_a')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                mobileTab === 'team_a' ? 'bg-orange-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              {match.team_a?.name?.slice(0, 3) || 'A'}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('team_b')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                mobileTab === 'team_b' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              {match.team_b?.name?.slice(0, 3) || 'B'}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('clock')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                mobileTab === 'clock' ? 'bg-white text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
              title="Full Clock Deck"
            >
              <Timer className="size-3" />
            </button>
          </div>
        )}

        {/* Console Lease & Network Connection Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="size-2.5" /> <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <WifiOff className="size-2.5" /> <span className="hidden sm:inline">({pendingOfflineCount})</span>
              </span>
            )}
          </div>

          {!user && (
            <Button
              type="button"
              size="sm"
              onClick={openLoginModal}
              className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-[10px] uppercase h-6 sm:h-7 px-2.5 rounded-lg shadow-md flex items-center gap-1 active:scale-95 transition-all"
            >
              <LogIn className="size-3" />
              <span>Log In</span>
            </Button>
          )}

          {user && !isHoldingLease && isAuthorizedScorekeeper && (
            <Button
              type="button"
              size="sm"
              onClick={handleClaimLease}
              className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-[10px] uppercase h-6 sm:h-7 px-2.5 rounded-lg shadow-md active:scale-95 transition-all"
            >
              Claim
            </Button>
          )}

          {user && isHoldingLease && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase h-6 px-1.5">
              <ShieldCheck className="size-3 mr-0.5" /> Host
            </Badge>
          )}
        </div>
      </header>

      {/* Lead Change Alert Banner */}
      {leadChangeAlert && (
        <div className="w-full max-w-xl mx-auto mb-1 shrink-0">
          <LeadChangeBanner alert={leadChangeAlert} onDismiss={() => setLeadChangeAlert(null)} />
        </div>
      )}

      {/* Main Kiosk Content Area */}
      {isLandscapeMode ? (
        /* Widescreen / Mobile Landscape 3-Column Deck (Snaps 100% horizontally and vertically) */
        <main className="grid grid-cols-12 gap-1.5 sm:gap-3 flex-1 h-full overflow-hidden">
          {isSwappedSides ? (
            <>
              <div className="col-span-4 h-full overflow-hidden">{renderColumnB()}</div>
              <div className="col-span-4 h-full overflow-hidden">{renderCenterConsole()}</div>
              <div className="col-span-4 h-full overflow-hidden">{renderColumnA()}</div>
            </>
          ) : (
            <>
              <div className="col-span-4 h-full overflow-hidden">{renderColumnA()}</div>
              <div className="col-span-4 h-full overflow-hidden">{renderCenterConsole()}</div>
              <div className="col-span-4 h-full overflow-hidden">{renderColumnB()}</div>
            </>
          )}
        </main>
      ) : (
        /* Mobile Portrait View (Snaps cleanly with zero scrolling) */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {mobileTab === 'split' && (
            <>
              {/* Pinned Mobile Game Clock Strip */}
              <div className="w-full shrink-0 h-9 px-2 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between gap-1.5 shadow-lg mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black font-mono tracking-tight text-white tabular-nums">
                    {formattedTime}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleToggleClock}
                    className={`h-6 px-2 text-[9px] font-black uppercase rounded ${
                      isClockRunning ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {isClockRunning ? <Pause className="size-2.5 mr-0.5" /> : <Play className="size-2.5 mr-0.5 fill-slate-950" />}
                    {isClockRunning ? 'Pause' : 'Start'}
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-orange-400 uppercase bg-slate-900 px-1.5 py-0.5 rounded border border-white/10">
                    {currentPeriod}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSwapSides}
                    className="h-6 px-1.5 text-[9px] font-bold text-slate-300 hover:text-white rounded gap-0.5"
                    title="Swap Sides"
                  >
                    <ArrowLeftRight className="size-2.5 text-orange-400" />
                    <span>Swap</span>
                  </Button>
                  {canUndo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUndoLastScore}
                      className="h-6 px-1.5 text-[9px] font-bold text-amber-400 hover:text-amber-300 rounded gap-0.5"
                      title="Undo Last Score"
                    >
                      <Undo2 className="size-2.5" />
                      <span>Undo</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Timeout Bar */}
              {activeTimeoutSeconds > 0 && (
                <div className="w-full shrink-0 h-7 px-2 rounded-lg bg-cyan-950/90 border border-cyan-500 text-cyan-300 flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1.5 animate-pulse">
                  <div className="flex items-center gap-1.5 truncate">
                    <Timer className="size-3 text-cyan-400 shrink-0" />
                    <span>TO ({activeTimeoutTeam === 'a' ? match.team_a?.name : match.team_b?.name}):</span>
                    <strong className="text-white font-mono">00:{String(activeTimeoutSeconds).padStart(2, '0')}</strong>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelTimeout}
                    className="h-5 px-1.5 text-[9px] text-red-400 hover:text-red-300"
                  >
                    <X className="size-2.5 mr-0.5" /> End
                  </Button>
                </div>
              )}

              {/* Dual-Team Side-by-Side Split View */}
              <main className="grid grid-cols-2 gap-1.5 flex-1 h-full overflow-hidden">
                {isSwappedSides ? (
                  <>
                    <div className="h-full overflow-hidden">{renderColumnB(true)}</div>
                    <div className="h-full overflow-hidden">{renderColumnA(true)}</div>
                  </>
                ) : (
                  <>
                    <div className="h-full overflow-hidden">{renderColumnA(true)}</div>
                    <div className="h-full overflow-hidden">{renderColumnB(true)}</div>
                  </>
                )}
              </main>
            </>
          )}

          {mobileTab === 'team_a' && (
            <main className="flex-1 h-full overflow-hidden">
              {renderColumnA(false)}
            </main>
          )}

          {mobileTab === 'team_b' && (
            <main className="flex-1 h-full overflow-hidden">
              {renderColumnB(false)}
            </main>
          )}

          {mobileTab === 'clock' && (
            <main className="flex-1 h-full overflow-hidden">
              {renderCenterConsole(false)}
            </main>
          )}
        </div>
      )}

      {/* Quick Player Substitution Dialog */}
      <KioskSubstitutionModal
        isOpen={!!subModalTeam}
        onClose={() => setSubModalTeam(null)}
        teamName={
          subModalTeam === 'a'
            ? match.team_a?.name || 'Team A'
            : match.team_b?.name || 'Team B'
        }
        activePlayers={subModalTeam === 'a' ? activePlayersA : activePlayersB}
        benchPlayers={subModalTeam === 'a' ? benchPlayersA : benchPlayersB}
        onConfirmSub={handleConfirmSub}
      />

      {/* Global Login Dialog for Unauthenticated Courtside Terminals */}
      <LoginModal />
    </div>
  );
};
