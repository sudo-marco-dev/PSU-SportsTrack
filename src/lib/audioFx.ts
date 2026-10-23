/**
 * Courtside Web Audio FX Engine for PSU SportsTrack
 * High-performance, zero-latency procedural audio synthesizer using the Web Audio API.
 * Requires 0 external audio files or network requests.
 */

import { useState, useEffect, useCallback } from 'react';

const AUDIO_STORAGE_KEY = 'psu_audio_enabled';

let audioCtx: AudioContext | null = null;

/**
 * Lazily obtains or creates the global AudioContext and resumes it if suspended.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Check if Courtside Audio FX is enabled in localStorage
 */
export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUDIO_STORAGE_KEY) === 'true';
}

/**
 * Persist audio enabled preference and dispatch custom event
 */
export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUDIO_STORAGE_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    getAudioContext();
  }
  window.dispatchEvent(new CustomEvent('psu-audio-toggle', { detail: { enabled } }));
}

/**
 * Toggle audio FX on/off
 */
export function toggleAudio(): boolean {
  const next = !isAudioEnabled();
  setAudioEnabled(next);
  return next;
}

/**
 * Play an acoustic courtside score chime / swish.
 * Adapts melody based on points scored (1-pt free throw, 2-pt field goal, 3-pt triple/goal).
 */
export function playScoreChime(points: number = 1): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.22, now);
  master.connect(ctx.destination);

  // Note frequencies: E5 (659.25), G#5 (830.61), B5 (987.77), E6 (1318.51)
  const notes =
    points >= 3
      ? [659.25, 830.61, 987.77, 1318.51] // 4-tone triumphant arpeggio for 3-pointers / goals
      : points === 2
      ? [659.25, 830.61, 987.77]          // 3-tone bright major triad for 2-pt field goals
      : [784.0, 1046.5];                   // 2-tone crisp chime for 1-pt points

  const noteDuration = points >= 3 ? 0.14 : 0.16;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * noteDuration);

    const noteStart = now + idx * noteDuration;
    const noteEnd = noteStart + 0.45;

    noteGain.gain.setValueAtTime(0.001, noteStart);
    noteGain.gain.linearRampToValueAtTime(0.25, noteStart + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    osc.connect(noteGain);
    noteGain.connect(master);

    osc.start(noteStart);
    osc.stop(noteEnd);
  });
}

/**
 * Play authentic arena horn / buzzer for period end or match conclusion.
 * Detuned sawtooth waves with low-pass resonance replicate courtside jumbotron horns.
 */
export function playBuzzerSound(duration: number = 0.85): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.001, now);
  master.gain.linearRampToValueAtTime(0.24, now + 0.03);
  master.gain.setValueAtTime(0.24, now + duration - 0.08);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, now);
  filter.Q.setValueAtTime(2.5, now);

  master.connect(filter);
  filter.connect(ctx.destination);

  // Detuned stadium horn oscillators (Eb3 ~ 155Hz, detuned 158Hz, + fifth harmonic 233Hz)
  const freqs = [155, 158, 233];
  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(master);
    osc.start(now);
    osc.stop(now + duration);
  });
}

/**
 * Play a crisp Fox 40 referee whistle (dual high-frequency sine waves with air vibrato).
 * Used for referee timeouts, fouls, or score deductions.
 */
export function playWhistleSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Dual chirps: short chirp (100ms) + accented chirp (250ms)
  const bursts = [
    { start: now, dur: 0.1 },
    { start: now + 0.15, dur: 0.28 },
  ];

  bursts.forEach(({ start, dur }) => {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, start);
    master.gain.linearRampToValueAtTime(0.22, start + 0.015);
    master.gain.setValueAtTime(0.22, start + dur - 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    master.connect(ctx.destination);

    // Whistle vibrato (air modulation at ~36Hz)
    const vibrato = ctx.createOscillator();
    vibrato.frequency.setValueAtTime(36, start);
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(45, start);
    vibrato.connect(vibratoGain);

    // Primary whistle frequencies ~2800Hz and ~3050Hz
    [2850, 3080].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      vibratoGain.connect(osc.frequency);

      osc.connect(master);
      osc.start(start);
      osc.stop(start + dur);
    });

    vibrato.start(start);
    vibrato.stop(start + dur);
  });
}

/**
 * Play official courtside timeout signal (referee whistle chirp followed by two stadium klaxon horn blasts).
 */
export function playTimeoutSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Initial referee whistle tweet (0.12s)
  const whistleGain = ctx.createGain();
  whistleGain.gain.setValueAtTime(0.001, now);
  whistleGain.gain.linearRampToValueAtTime(0.20, now + 0.015);
  whistleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  whistleGain.connect(ctx.destination);

  const whistleOsc = ctx.createOscillator();
  whistleOsc.type = 'triangle';
  whistleOsc.frequency.setValueAtTime(2900, now);
  whistleOsc.connect(whistleGain);
  whistleOsc.start(now);
  whistleOsc.stop(now + 0.12);

  // 2. Dual stadium klaxon pulses (0.22s each)
  const pulses = [
    { start: now + 0.18, dur: 0.22 },
    { start: now + 0.46, dur: 0.22 },
  ];

  pulses.forEach(({ start, dur }) => {
    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(0.001, start);
    pulseGain.gain.linearRampToValueAtTime(0.24, start + 0.02);
    pulseGain.gain.setValueAtTime(0.24, start + dur - 0.04);
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, start);
    filter.Q.setValueAtTime(2.2, start);

    pulseGain.connect(filter);
    filter.connect(ctx.destination);

    // Arena chord freqs (G3 196Hz, B3 247Hz, D4 294Hz)
    [196, 247, 294].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(pulseGain);
      osc.start(start);
      osc.stop(start + dur);
    });
  });
}

/**
 * Play authentic scorer's table substitution horn (two rapid punchy horn chirps ~150ms each).
 */
export function playSubHornSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chirps = [
    { start: now, dur: 0.16 },
    { start: now + 0.22, dur: 0.16 },
  ];

  chirps.forEach(({ start, dur }) => {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, start);
    master.gain.linearRampToValueAtTime(0.26, start + 0.02);
    master.gain.setValueAtTime(0.26, start + dur - 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, start);
    filter.Q.setValueAtTime(3.0, start);

    master.connect(filter);
    filter.connect(ctx.destination);

    // Scorer horn oscillators (165Hz, 220Hz, 330Hz)
    [165, 220, 330].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(master);
      osc.start(start);
      osc.stop(start + dur);
    });
  });
}

/**
 * Play a crisp start cue when the game clock starts or resumes.
 */
export function playClockStartSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Play a subtle pause cue when the game clock stops or is halted.
 */
export function playClockPauseSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(784, now); // G5
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.08); // A4

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.085);
}

/**
 * Play a subtle click/ping confirmation when user un-mutes
 */
export function playTestPing(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

/**
 * Play gentle ascending chime when a live facilitator lease claim request arrives
 */
export function playClaimAlertChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

/**
 * React Hook for component integration with synchronized audio toggle
 */
export function useAudioFx() {
  const [enabled, setEnabledState] = useState<boolean>(() => isAudioEnabled());

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      setEnabledState(customEvent.detail.enabled);
    };
    window.addEventListener('psu-audio-toggle', handleToggle);
    return () => window.removeEventListener('psu-audio-toggle', handleToggle);
  }, []);

  const toggle = useCallback(() => {
    const next = toggleAudio();
    setEnabledState(next);
    if (next) {
      playTestPing();
    }
    return next;
  }, []);

  return {
    enabled,
    toggle,
    setEnabled: (val: boolean) => {
      setAudioEnabled(val);
      setEnabledState(val);
      if (val) playTestPing();
    },
    playScoreChime,
    playBuzzerSound,
    playWhistleSound,
    playTimeoutSound,
    playSubHornSound,
    playClockStartSound,
    playClockPauseSound,
  };
}
