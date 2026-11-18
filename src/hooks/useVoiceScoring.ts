/**
 * Web Speech & On-Device Hybrid Hook for Courtside Voice Scoring
 * PSU SportsTrack - Multimodal Interaction Module
 *
 * Powered by the 2-Stage Hybrid Mobile Speech Engine (`mobileSpeechEngine.ts`):
 * - Stage 1: Native `SpeechRecognition` invoked synchronously on tap.
 * - Stage 2: Automatic seamless fallback to `getUserMedia` hardware microphone capture +
 *   Web Audio Voice Activity Detection (VAD) + on-device Whisper speech-to-text when
 *   Mobile Chrome's native `SpeechRecognizer` aborts (`error: "aborted"`) or ends prematurely.
 * - Uses `optionsRef` so 1-second Kiosk game clock re-renders never recreate voice handlers.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  VoiceScoringOptions,
  VoiceRecognitionState,
  ParsedVoiceCommand,
} from '@/types/multimodal';
import { parseVoiceCommand } from '@/lib/voiceCommandParser';
import {
  playScoreChime,
  playSubHornSound,
  playClockPauseSound,
  playClockStartSound,
} from '@/lib/audioFx';
import {
  IS_MOBILE_BROWSER,
  preloadMobileWhisperModel,
  startHybridSpeechSession,
  type HybridSpeechSession,
} from '@/lib/mobileSpeechEngine';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * Text-to-speech synthesized audio confirmation
 */
export function speakConfirmation(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[VUI] Speech synthesis error:', err);
  }
}

export function useVoiceScoring(options: VoiceScoringOptions) {
  const { enableSpeechFeedback = true } = options;

  const [state, setState] = useState<VoiceRecognitionState>(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const hasNativeSpeech = Boolean(win?.SpeechRecognition || win?.webkitSpeechRecognition);
    const hasMediaMic =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    const supported = hasNativeSpeech || hasMediaMic;
    return {
      isListening: false,
      isSupported: supported,
      transcript: '',
      interimTranscript: '',
      lastCommand: null,
      error: supported ? null : 'Voice input is not supported in this browser. Use the Quick Test grid below.',
      feedbackMessage: null,
      history: [],
    };
  });

  // Default TTS muted on mobile browsers so Android AudioManager does not abort SpeechRecognizer
  const [isMuted, setIsMuted] = useState<boolean>(
    IS_MOBILE_BROWSER ? true : !enableSpeechFeedback
  );

  const isMutedRef = useRef<boolean>(isMuted);
  const sessionRef = useRef<HybridSpeechSession | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const restartTimerRef = useRef<number | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    isMutedRef.current = isMuted;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (IS_MOBILE_BROWSER) {
      void preloadMobileWhisperModel().catch(() => {});
    }
  }, []);

  const abortCurrentSession = useCallback(() => {
    if (restartTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (sessionRef.current) {
      const current = sessionRef.current;
      sessionRef.current = null;
      current.abort();
    }
  }, []);

  /**
   * Dispatches the parsed voice command to the appropriate handler using stable `optionsRef`
   */
  const executeCommand = useCallback((command: ParsedVoiceCommand) => {
    const {
      teamAName,
      teamBName,
      onScore,
      onSubstitution,
      onSelectPlayer,
      onDeduct,
      onTimeout,
      onFoul,
      onClockControl,
      onPeriodChange,
      onCommentary,
      onUndo,
    } = optionsRef.current;

    const muted = isMutedRef.current;
    const {
      intent,
      team,
      teamName,
      points,
      actionType,
      playerNumber,
      subOutPlayerNumber,
      subInPlayerNumber,
      clockAction,
      notes,
    } = command;

    switch (intent) {
      case 'score': {
        if (!team || !points) {
          const feedback = !team
            ? 'Could not detect which team. Please specify Team A or Team B.'
            : 'Could not determine points value. Say "Add 2 points".';
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!muted) speakConfirmation(feedback);
          return;
        }

        const targetName = teamName || (team === 'a' ? 'Team A' : 'Team B');
        const description = playerNumber
          ? `[#${playerNumber}] scored +${points} (${actionType}) via voice`
          : `${targetName} scored +${points} (${actionType}) via voice`;

        onScore?.(team, points, actionType || 'Score', description, playerNumber || undefined);
        playScoreChime(points);

        const feedback = playerNumber
          ? `Recorded +${points} to #${playerNumber} (${targetName})`
          : `Recorded +${points} for ${targetName}`;
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'substitution': {
        const targetTeam = team || 'a';
        const targetName = (targetTeam === 'a' ? teamAName : teamBName) || 'Team';
        const subOut = subOutPlayerNumber || 1;
        const subIn = subInPlayerNumber || 2;

        onSubstitution?.(targetTeam, subOut, subIn);
        try {
          playSubHornSound();
        } catch {
          // fallback
        }

        const feedback = `Substituted #${subOut} with #${subIn} for ${targetName}`;
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'select_player': {
        const targetTeam = team || 'a';
        const targetName = (targetTeam === 'a' ? teamAName : teamBName) || 'Team';
        onSelectPlayer?.(targetTeam, playerNumber || undefined);
        const feedback = playerNumber
          ? `Selected Player #${playerNumber} for ${targetName}`
          : `Focused ${targetName} scoring column`;
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'clock': {
        const action = clockAction === 'resume' ? 'resume' : 'pause';
        onClockControl?.(action);
        if (action === 'pause') {
          try {
            playClockPauseSound();
          } catch {
            // ignore
          }
        } else {
          try {
            playClockStartSound();
          } catch {
            // ignore
          }
        }

        const feedback = action === 'pause' ? 'Match clock paused' : 'Match clock resumed';
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'period': {
        const dir = command.periodAction === 'prev' ? 'prev' : 'next';
        onPeriodChange?.(dir);
        const feedback =
          dir === 'next' ? 'Advancing to next period' : 'Returning to previous period';
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'deduct': {
        const targetTeam = team || 'a';
        const targetName = (targetTeam === 'a' ? teamAName : teamBName) || 'Team';
        const deductPts = points || 1;
        onDeduct?.(targetTeam, deductPts);

        const feedback = `Deducted ${deductPts} point${deductPts > 1 ? 's' : ''} from ${targetName}`;
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'timeout': {
        onTimeout?.(team || undefined);
        const feedback = team ? `Timeout called for ${teamName}` : 'Official timeout called';
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'foul': {
        onFoul?.(team || 'a', playerNumber || undefined);
        const feedback = playerNumber
          ? `Foul logged on Player #${playerNumber}`
          : `Foul logged for ${teamName || 'team'}`;
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'commentary': {
        if (notes) {
          onCommentary?.(notes);
          const feedback = 'Commentary broadcasted';
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!muted) speakConfirmation(feedback);
        }
        break;
      }

      case 'undo': {
        onUndo?.();
        const feedback = 'Reverting last courtside action';
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'help': {
        const feedback =
          'Say: "Give 2 points to Team A player 1", "Substitute player 1 with 2", or "Timeout Team B"';
        setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
        if (!muted) speakConfirmation(feedback);
        break;
      }

      case 'unknown':
      default: {
        const feedback = `Unrecognized command: "${command.rawTranscript}".`;
        setState((prev) => ({ ...prev, feedbackMessage: feedback }));
        break;
      }
    }
  }, []);

  /**
   * Process incoming transcript text
   */
  const processTranscript = useCallback(
    (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;

      const parsed = parseVoiceCommand(cleaned, {
        teamAName: optionsRef.current.teamAName,
        teamBName: optionsRef.current.teamBName,
        sport: optionsRef.current.sport || 'Basketball',
      });

      setState((prev) => ({
        ...prev,
        transcript: cleaned,
        interimTranscript: '',
        lastCommand: parsed,
        error: null,
        history: [parsed, ...prev.history.slice(0, 9)],
      }));

      executeCommand(parsed);
    },
    [executeCommand]
  );

  const launchHybridSession = useCallback(
    (isAutoRestart = false) => {
      abortCurrentSession();

      isListeningRef.current = true;
      setState((prev) => ({
        ...prev,
        isListening: true,
        error: null,
        interimTranscript: isAutoRestart ? prev.interimTranscript : 'Listening... speak command now',
        feedbackMessage:
          isAutoRestart && prev.feedbackMessage
            ? prev.feedbackMessage
            : 'Listening now — speak your command clearly.',
      }));

      sessionRef.current = startHybridSpeechSession({
        onStart: () => {
          isListeningRef.current = true;
          setState((prev) => ({
            ...prev,
            isListening: true,
            error: null,
          }));
        },
        onInterim: (text) => {
          setState((prev) => ({ ...prev, interimTranscript: text }));
        },
        onFinal: (text) => {
          processTranscript(text);
        },
        onError: (msg) => {
          isListeningRef.current = false;
          sessionRef.current = null;
          setState((prev) => ({
            ...prev,
            isListening: false,
            interimTranscript: '',
            error: null,
            feedbackMessage: msg,
          }));
        },
        onEnd: () => {
          sessionRef.current = null;

          if (!isListeningRef.current || IS_MOBILE_BROWSER) {
            isListeningRef.current = false;
            setState((prev) => ({
              ...prev,
              isListening: false,
              interimTranscript: '',
            }));
            return;
          }

          // On Desktop, seamlessly continue listening for next command
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null;
            if (isListeningRef.current) {
              launchHybridSession(true);
            }
          }, 250);
        },
      });
    },
    [abortCurrentSession, processTranscript]
  );

  const startListening = useCallback(() => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error:
          'Mobile browsers require HTTPS (Vercel preview URL) for microphone access. Over plain HTTP LAN, use the Quick Test buttons below.',
      }));
      return;
    }

    launchHybridSession(false);
  }, [launchHybridSession]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (restartTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (sessionRef.current) {
      sessionRef.current.finishAndTranscribe();
    } else {
      setState((prev) => ({
        ...prev,
        isListening: false,
        interimTranscript: '',
        error: null,
        feedbackMessage: prev.feedbackMessage || 'Voice scoring paused.',
      }));
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const simulateVoiceCommand = useCallback(
    (spokenText: string) => {
      processTranscript(spokenText);
    },
    [processTranscript]
  );

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      abortCurrentSession();
    };
  }, [abortCurrentSession]);

  return {
    ...state,
    isMuted,
    setIsMuted,
    startListening,
    stopListening,
    toggleListening,
    simulateVoiceCommand,
    clearHistory: () => setState((prev) => ({ ...prev, history: [] })),
  };
}
