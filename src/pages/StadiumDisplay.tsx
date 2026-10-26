import { useState, useEffect, useRef, useMemo, createElement, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getSportScoringProfile } from '@/lib/sportScoringRules';
import { getSportIcon } from '@/lib/sportIcons';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import {
  Trophy,
  ChevronLeft,
  Maximize2,
  Minimize2,
  MapPin,
  Tv,
  Globe,
  ExternalLink,
  Radio,
  Clock,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';
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
  playTimeoutSound,
  playSubHornSound,
  playClockStartSound,
  playClockPauseSound,
} from '@/lib/audioFx';
import { StadiumTimeoutOverlay } from '@/components/scoreboard/StadiumTimeoutOverlay';
import {
  StadiumSubBanner,
  type SubstitutionAlertData,
} from '@/components/scoreboard/StadiumSubBanner';
import { StadiumGameClock } from '@/components/scoreboard/StadiumGameClock';

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
};

type MatchEvent = {
  id: string;
  match_id: string;
  description: string;
  created_at: string;
};

export const StadiumDisplay = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Match Game Clock State (synced courtside from Facilitator Kiosk)
  const [gameTimeSeconds, setGameTimeSeconds] = useState<number>(600);
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);
  const [currentPeriod, setCurrentPeriod] = useState<string>('Period 1');
  const [isClockEnabled, setIsClockEnabled] = useState<boolean>(true);

  // Active Timeout State (with live visual overlay & countdown)
  const [activeTimeout, setActiveTimeout] = useState<{
    active: boolean;
    team: 'a' | 'b' | null;
    teamName: string;
    seconds: number;
    initialSeconds: number;
  } | null>(null);

  // Substitution Alert Banner
  const [subAlert, setSubAlert] = useState<SubstitutionAlertData | null>(null);

  // Team Fouls and Timeouts Counts
  const [teamAFouls, setTeamAFouls] = useState<number>(0);
  const [teamBFouls, setTeamBFouls] = useState<number>(0);
  const [teamATimeoutsRemaining, setTeamATimeoutsRemaining] = useState<number>(3);
  const [teamBTimeoutsRemaining, setTeamBTimeoutsRemaining] = useState<number>(3);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Clock ticker for top arena bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial match data & generate spectator QR code
  const fetchMatchData = useCallback(async () => {
    if (!matchId) return;

    try {
      const [matchRes, eventsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('*, team_a:team_a_id(name), team_b:team_b_id(name), tournament:tournament_id(name, sport)')
          .eq('id', matchId)
          .single(),
        supabase
          .from('match_events')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      if (matchRes.data) {
        setMatch(matchRes.data as Match);
      }
      if (eventsRes.data) {
        setEvents(eventsRes.data as MatchEvent[]);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error fetching stadium match data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMatchData();
  }, [fetchMatchData]);

  // Screen Wake Lock API — keeps the big screen TV permanently awake
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          const nav = navigator as unknown as {
            wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
          };
          const sentinel = await nav.wakeLock.request('screen');
          wakeLockRef.current = sentinel;
          setIsWakeLockActive(true);
          sentinel.addEventListener('release', () => {
            setIsWakeLockActive(false);
          });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.log('Wake Lock request discarded or not supported:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  // Fullscreen state listener & keyboard hotkeys (F to toggle fullscreen, ESC to exit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen]);

  // Match Game Clock Countdown Runner (sub-second local interpolation)
  useEffect(() => {
    if (!isClockRunning || !isClockEnabled) return;
    const timer = setInterval(() => {
      setGameTimeSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsClockRunning(false);
          playBuzzerSound(1.2);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isClockRunning, isClockEnabled]);

  // Active Timeout Countdown Runner
  useEffect(() => {
    if (!activeTimeout || !activeTimeout.active || activeTimeout.seconds <= 0) return;
    const timer = setInterval(() => {
      setActiveTimeout((prev) => {
        if (!prev || prev.seconds <= 1) {
          clearInterval(timer);
          playWhistleSound();
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTimeout]);

  // Real-time Supabase subscriptions (matches + events + courtside broadcast deck)
  useEffect(() => {
    if (!matchId) return;

    // 1. Ultra-fast WebRTC/WebSocket broadcast channel from courtside kiosk deck
    const broadcastChannel = supabase
      .channel(`match-broadcast:${matchId}`)
      .on('broadcast', { event: 'score_update' }, (payload) => {
        if (payload.payload) {
          const { team_a_score, team_b_score } = payload.payload;
          setMatch((prev) => (prev ? { ...prev, team_a_score, team_b_score } : prev));
        }
      })
      .on('broadcast', { event: 'clock_update' }, (payload) => {
        if (!payload.payload) return;
        const { seconds, isRunning, period, isEnabled } = payload.payload;
        if (seconds !== undefined) setGameTimeSeconds(seconds);
        if (period !== undefined) setCurrentPeriod(period);
        if (isEnabled !== undefined) setIsClockEnabled(isEnabled);
        if (isRunning !== undefined) {
          setIsClockRunning((prev) => {
            if (!prev && isRunning) {
              playClockStartSound();
            } else if (prev && !isRunning) {
              playClockPauseSound();
            }
            return isRunning;
          });
        }
      })
      .on('broadcast', { event: 'timeout_update' }, (payload) => {
        if (!payload.payload) return;
        const { active, team, teamName, seconds, teamATimeouts, teamBTimeouts } = payload.payload;
        if (active) {
          // Timeout called courtside: automatically pause the clock!
          setIsClockRunning(false);
          playTimeoutSound();
          setActiveTimeout({
            active: true,
            team: team ?? null,
            teamName: teamName || 'Team Timeout',
            seconds: seconds || 60,
            initialSeconds: seconds || 60,
          });
          if (teamATimeouts !== undefined) setTeamATimeoutsRemaining(teamATimeouts);
          if (teamBTimeouts !== undefined) setTeamBTimeoutsRemaining(teamBTimeouts);
        } else {
          setActiveTimeout(null);
          playWhistleSound();
        }
      })
      .on('broadcast', { event: 'substitution_alert' }, (payload) => {
        if (!payload.payload) return;
        playSubHornSound();
        setSubAlert(payload.payload as SubstitutionAlertData);
      })
      .on('broadcast', { event: 'foul_update' }, (payload) => {
        if (!payload.payload) return;
        playWhistleSound();
        if (payload.payload.teamAFouls !== undefined) setTeamAFouls(payload.payload.teamAFouls);
        if (payload.payload.teamBFouls !== undefined) setTeamBFouls(payload.payload.teamBFouls);
      })
      .subscribe();

    // 2. Database changes channel (fallback redundancy)
    const postgresChannel = supabase
      .channel(`stadium_match_${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          const updated = payload.new as Match;
          setMatch((prev) => (prev ? { ...prev, ...updated, tournament: prev.tournament } : updated));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const newEvent = payload.new as MatchEvent;
          setEvents((prev) => [newEvent, ...prev.slice(0, 9)]);

          const desc = newEvent.description || '';
          if (desc.startsWith('[Timeout]:')) {
            setIsClockRunning(false); // Auto-pause clock on timeout!
            playTimeoutSound();
            const matchName = desc.match(/Called by (.*?) \(/);
            const teamName = matchName ? matchName[1] : 'Team Timeout';
            setActiveTimeout((prev) => {
              if (prev?.active) return prev;
              return {
                active: true,
                team: null,
                teamName,
                seconds: 60,
                initialSeconds: 60,
              };
            });
          } else if (desc.startsWith('[Substitution]:')) {
            playSubHornSound();
          } else if (desc.startsWith('[Foul Recorded]:')) {
            playWhistleSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(postgresChannel);
    };
  }, [matchId]);

  const sportProfile = useMemo(
    () => getSportScoringProfile(match?.tournament?.sport),
    [match?.tournament?.sport]
  );

  const isTeamALeading = (match?.team_a_score ?? 0) > (match?.team_b_score ?? 0);
  const isTeamBLeading = (match?.team_b_score ?? 0) > (match?.team_a_score ?? 0);
  const isTied = (match?.team_a_score ?? 0) === (match?.team_b_score ?? 0) && (match?.team_a_score ?? 0) > 0;

  // Set document title to Focus View
  useEffect(() => {
    if (match) {
      document.title = `${match.team_a?.name || 'Team A'} vs ${match.team_b?.name || 'Team B'} | Focus View`;
    }
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
      setTimeout(() => setIsPoppingA(false), 700);
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
      setTimeout(() => setIsPoppingB(false), 700);
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
      setTimeout(() => {
        setLeadChangeAlert((prev) => (prev?.timestamp === leadChange.timestamp ? null : prev));
      }, 6000);
    }

    prevScoresRef.current = { a: currA, b: currB, hasInitialized: true };
  }, [match]);

  const momentumRun = useMemo(() => {
    if (!match) return null;
    return detectMomentumRun(
      events,
      match.team_a?.name || 'Team A',
      match.team_b?.name || 'Team B',
      sportProfile.pointUnit
    );
  }, [events, match, sportProfile.pointUnit]);

  if (isLoading) {
    return <SkeletonCard variant="stadium" />;
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <h2 className="text-3xl font-black uppercase tracking-tight text-red-400 mb-2">Match Not Found</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          The requested match display feed could not be located or has concluded.
        </p>
        <button
          type="button"
          onClick={() => navigate('/explorer')}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-slate-950 font-black rounded-xl uppercase tracking-wider text-xs"
        >
          Return to Match Center
        </button>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={toggleFullscreen}
      className="min-h-screen w-screen bg-[#020617] text-white flex flex-col justify-between overflow-hidden select-none relative"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.15) 0%, transparent 60%),
          radial-gradient(circle at 15% 100%, rgba(249, 115, 22, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 85% 100%, rgba(249, 115, 22, 0.08) 0%, transparent 40%)
        `,
      }}
    >
      {/* Top Arena Navigation & Header Bar */}
      <header className="w-full px-6 py-4 md:px-10 md:py-6 flex items-center justify-between border-b border-white/10 bg-slate-950/80 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => navigate(`/match/${match.id}`)}
            className="size-10 sm:size-11 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Back to Match Control / Box Score"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="p-1 rounded bg-orange-500 text-slate-950">
                {createElement(getSportIcon(match.tournament?.sport), { className: 'size-3.5' })}
              </span>
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-orange-400">
                {match.tournament?.sport || 'Ball Game'} • {match.round}
              </span>
              {match.venue && (
                <>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    <MapPin className="size-3 text-orange-400 shrink-0" />
                    <span>{match.venue}</span>
                  </span>
                </>
              )}
            </div>
            <h1 className="text-sm sm:text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-100 truncate max-w-xs sm:max-w-md md:max-w-xl">
              {match.tournament?.name || 'PSU Collegiate Games'}
            </h1>
          </div>
        </div>

        {/* Center Live Badge (True Screen Center) */}
        <div className="hidden sm:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 absolute left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2.5 bg-red-500"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-[0.25em] text-red-400">
            {match.status === 'Ongoing' ? 'LIVE ARENA FEED' : match.status}
          </span>
        </div>

        {/* Right Arena Tools */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono font-bold text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <Clock className="size-3.5 text-orange-400" />
            <span>{currentTime}</span>
          </div>

          {isWakeLockActive && (
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Tv className="size-3" />
              <span>Wake Lock Active</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleAudioActive}
            className={`size-10 sm:size-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              isAudioActive
                ? 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/40 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.25)]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title={isAudioActive ? 'Courtside Sound FX Active (Click to Mute)' : 'Sound Muted (Click to Enable Sound FX)'}
          >
            {isAudioActive ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="size-10 sm:size-11 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen (F / ESC)' : 'Enter Big Screen Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </button>
        </div>
      </header>

      {/* Main Stadium Centerpiece: Colossal Tabular Scoreboard */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-8 md:px-14 py-4 md:py-8 max-w-7xl mx-auto w-full relative z-10">
        {leadChangeAlert && (
          <div className="w-full max-w-xl mx-auto mb-4">
            <LeadChangeBanner alert={leadChangeAlert} onDismiss={() => setLeadChangeAlert(null)} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 sm:gap-6 my-auto">
          {/* Team A Card */}
          <div
            className={`lg:col-span-5 p-6 sm:p-8 md:p-10 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center justify-center text-center relative overflow-hidden ${
              isTeamALeading
                ? 'bg-slate-900/90 border-orange-500/70 shadow-[0_0_60px_rgba(249,115,22,0.25)]'
                : 'bg-slate-900/60 border-white/10'
            }`}
          >
            {/* Top Badges Bar */}
            <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between pointer-events-none z-20">
              <div className="pointer-events-auto">
                {momentumRun?.team === 'a' && (
                  <MomentumRunBadge run={momentumRun} />
                )}
              </div>
              <div className="pointer-events-auto">
                {isTeamALeading && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-md">
                    <Sparkles className="size-3" /> Leading
                  </div>
                )}
              </div>
            </div>

            <div className="mb-2 sm:mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-orange-400 block mb-1">
                TEAM A
              </span>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white drop-shadow-md truncate max-w-full">
                {match.team_a?.name || 'Team A'}
              </h2>
            </div>

            <div className="my-1 sm:my-3 relative">
              <FloatingDeltaBadge deltas={deltasA} />
              <span className={`text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black tabular-nums tracking-tighter text-white leading-none block transition-transform ${isPoppingA ? 'animate-score-pop' : ''}`}>
                {match.team_a_score}
              </span>
              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-slate-400 mt-1 block">
                {sportProfile.pointUnit}
              </span>
            </div>

            {/* Team A Courtside Stats Bar (Fouls & Timeouts) */}
            <div className="w-full mt-3 pt-3 border-t border-white/10 flex items-center justify-around gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">FOULS</span>
                <span className="font-mono font-black text-amber-400 text-sm">{teamAFouls}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">TO</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: sportProfile.defaultTimeouts || 3 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`size-2 rounded-full transition-all ${
                        idx < teamATimeoutsRemaining
                          ? 'bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center Pillar: Official Match Game Clock & VS */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center py-2 space-y-3">
            <StadiumGameClock
              gameTimeSeconds={gameTimeSeconds}
              isClockRunning={isClockRunning}
              currentPeriod={currentPeriod}
              isClockEnabled={isClockEnabled}
              isTimeoutActive={activeTimeout?.active ?? false}
            />

            <div className="size-12 sm:size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg sm:text-xl font-black italic tracking-tighter text-orange-500 shadow-inner">
              VS
            </div>

            {isTied && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                TIED GAME
              </span>
            )}
          </div>

          {/* Team B Card */}
          <div
            className={`lg:col-span-5 p-6 sm:p-8 md:p-10 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center justify-center text-center relative overflow-hidden ${
              isTeamBLeading
                ? 'bg-slate-900/90 border-cyan-500/70 shadow-[0_0_60px_rgba(6,182,212,0.25)]'
                : 'bg-slate-900/60 border-white/10'
            }`}
          >
            {/* Top Badges Bar */}
            <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between pointer-events-none z-20">
              <div className="pointer-events-auto">
                {momentumRun?.team === 'b' && (
                  <MomentumRunBadge run={momentumRun} />
                )}
              </div>
              <div className="pointer-events-auto">
                {isTeamBLeading && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-md">
                    <Sparkles className="size-3" /> Leading
                  </div>
                )}
              </div>
            </div>

            <div className="mb-2 sm:mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-cyan-400 block mb-1">
                TEAM B
              </span>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white drop-shadow-md truncate max-w-full">
                {match.team_b?.name || 'BYE'}
              </h2>
            </div>

            <div className="my-1 sm:my-3 relative">
              <FloatingDeltaBadge deltas={deltasB} />
              <span className={`text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black tabular-nums tracking-tighter text-white leading-none block transition-transform ${isPoppingB ? 'animate-score-pop' : ''}`}>
                {match.team_b_score}
              </span>
              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-slate-400 mt-1 block">
                {sportProfile.pointUnit}
              </span>
            </div>

            {/* Team B Courtside Stats Bar (Fouls & Timeouts) */}
            <div className="w-full mt-3 pt-3 border-t border-white/10 flex items-center justify-around gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">FOULS</span>
                <span className="font-mono font-black text-amber-400 text-sm">{teamBFouls}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">TO</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: sportProfile.defaultTimeouts || 3 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`size-2 rounded-full transition-all ${
                        idx < teamBTimeoutsRemaining
                          ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Post-Game Banner if Completed */}
        {match.status === 'Completed' && (
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-orange-500/40 text-center animate-in fade-in zoom-in duration-500">
            <div className="inline-flex items-center gap-2 text-sm sm:text-lg font-black uppercase italic tracking-wide text-orange-300">
              <Trophy className="size-5 text-yellow-400" />
              <span>
                Final Match Concluded • Winner:{' '}
                {match.team_a_score > match.team_b_score
                  ? match.team_a?.name
                  : match.team_b_score > match.team_a_score
                  ? match.team_b?.name
                  : 'Draw'}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Arena Footer: Live Play-by-Play Ticker & Spectator QR Code */}
      <footer className="w-full bg-slate-950/90 border-t border-white/10 px-6 py-4 md:px-10 md:py-5 flex flex-col md:flex-row items-center justify-between gap-4 relative z-20">
        {/* Play-by-play ticker bar */}
        <div className="flex-1 flex items-center gap-3 w-full overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black uppercase tracking-wider shrink-0">
            <Radio className="size-3.5 animate-pulse text-orange-500" />
            <span>Live Action</span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {events.length > 0 ? (
              <div className="text-xs sm:text-sm font-medium text-slate-200 truncate animate-in fade-in duration-300">
                <strong className="text-orange-400 mr-2">Latest:</strong>
                {events[0]?.description}
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-500 italic">
                Official play-by-play events will stream live here as points are recorded...
              </span>
            )}
          </div>
        </div>

        {/* Spectator Main Website Hub Link */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl shrink-0 shadow-lg">
          <div className="size-9 sm:size-10 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
            <Globe className="size-4 sm:size-5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
              Follow Live On Your Phone
            </span>
            <a
              href="https://psusportstrack.tech/explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm font-black font-mono tracking-tight text-orange-400 hover:text-orange-300 transition-colors inline-flex items-center gap-1.5 mt-0.5"
            >
              <span>psusportstrack.tech/explorer</span>
              <ExternalLink className="size-3 opacity-80" />
            </a>
          </div>
        </div>
      </footer>

      {/* Courtside Official Timeout Overlay */}
      <StadiumTimeoutOverlay
        active={activeTimeout?.active ?? false}
        team={activeTimeout?.team ?? null}
        teamName={activeTimeout?.teamName ?? 'Official Timeout'}
        secondsRemaining={activeTimeout?.seconds ?? 0}
        initialSeconds={activeTimeout?.initialSeconds ?? 60}
        onDismiss={() => setActiveTimeout(null)}
      />

      {/* Courtside Player Substitution Alert Lower-Third Banner */}
      <StadiumSubBanner
        alert={subAlert}
        onDismiss={() => setSubAlert(null)}
      />
    </div>
  );
};
