/**
 * Web Speech API Hook for Courtside Voice Scoring
 * PSU SportsTrack - Multimodal Interaction Module
 *
 * Engineered for both Desktop Chrome/Edge/Safari and Mobile Chrome (Android) / iOS Safari:
 * - Calls `recognition.start()` 100% synchronously inside the user's tap handler (required by Mobile Chrome).
 * - Deduplicates Android Chrome's cumulative `event.results` transcript chunks.
 * - Flushes uncommitted `interimResults` on `onend` when mobile browsers omit `isFinal = true`.
 * - Defaults TTS speech synthesis to muted on mobile so Android AudioManager never revokes mic focus.
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
import { extractCleanSpeechTranscript } from './usePublicVoiceAssistant';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

const IS_MOBILE_BROWSER =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

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
  const {
    teamAName,
    teamBName,
    sport = 'Basketball',
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
    enableSpeechFeedback = true,
  } = options;

  const [state, setState] = useState<VoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    lastCommand: null,
    error: null,
    feedbackMessage: null,
    history: [],
  });

  // Default TTS muted on mobile browsers so Android AudioManager does not abort SpeechRecognizer
  const [isMuted, setIsMuted] = useState<boolean>(
    IS_MOBILE_BROWSER ? true : !enableSpeechFeedback
  );

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const restartTimerRef = useRef<number | null>(null);
  const latestInterimRef = useRef<string>('');
  const finalProcessedRef = useRef<boolean>(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setState((prev) => ({ ...prev, isSupported: true }));
    } else {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        error: 'Web Speech API is not supported in this browser. Use Chrome, Edge, or Safari.',
      }));
    }
  }, []);

  const cleanupRecognitionRef = useCallback(() => {
    if (restartTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const existing = recognitionRef.current;
    if (existing) {
      recognitionRef.current = null;
      existing.onstart = null;
      existing.onresult = null;
      existing.onerror = null;
      existing.onend = null;
      try {
        existing.stop?.();
      } catch {
        // ignore
      }
    }
  }, []);

  /**
   * Dispatches the parsed voice command to the appropriate handler
   */
  const executeCommand = useCallback(
    (command: ParsedVoiceCommand) => {
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
            if (!isMuted) speakConfirmation(feedback);
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
          if (!isMuted) speakConfirmation(feedback);
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
          if (!isMuted) speakConfirmation(feedback);
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
          if (!isMuted) speakConfirmation(feedback);
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
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'period': {
          const dir = command.periodAction === 'prev' ? 'prev' : 'next';
          onPeriodChange?.(dir);
          const feedback =
            dir === 'next' ? 'Advancing to next period' : 'Returning to previous period';
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'deduct': {
          const targetTeam = team || 'a';
          const targetName = (targetTeam === 'a' ? teamAName : teamBName) || 'Team';
          const deductPts = points || 1;
          onDeduct?.(targetTeam, deductPts);

          const feedback = `Deducted ${deductPts} point${deductPts > 1 ? 's' : ''} from ${targetName}`;
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'timeout': {
          onTimeout?.(team || undefined);
          const feedback = team ? `Timeout called for ${teamName}` : 'Official timeout called';
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'foul': {
          onFoul?.(team || 'a', playerNumber || undefined);
          const feedback = playerNumber
            ? `Foul logged on Player #${playerNumber}`
            : `Foul logged for ${teamName || 'team'}`;
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'commentary': {
          if (notes) {
            onCommentary?.(notes);
            const feedback = 'Commentary broadcasted';
            setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
            if (!isMuted) speakConfirmation(feedback);
          }
          break;
        }

        case 'undo': {
          onUndo?.();
          const feedback = 'Reverting last courtside action';
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'help': {
          const feedback =
            'Say: "Give 2 points to Team A player 1", "Substitute player 1 with 2", or "Timeout Team B"';
          setState((prev) => ({ ...prev, feedbackMessage: feedback, error: null }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'unknown':
        default: {
          const feedback = `Unrecognized command: "${command.rawTranscript}".`;
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          break;
        }
      }
    },
    [
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
      isMuted,
    ]
  );

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
        sport,
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
    [sport, executeCommand]
  );

  /**
   * Creates and starts a SpeechRecognition instance.
   * When invoked from `startListening()`, this runs 100% SYNCHRONOUSLY inside the user's click event.
   */
  const startRecognitionNow = useCallback(
    (isAutoRestart = false) => {
      const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
      const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;

      cleanupRecognitionRef();

      try {
        const recognition = new SpeechRecognitionClass();
        // Desktop Chrome supports continuous=true; Mobile Chrome requires single-utterance mode
        recognition.continuous = !IS_MOBILE_BROWSER;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = 'en-US';

        latestInterimRef.current = '';
        finalProcessedRef.current = false;

        recognition.onstart = () => {
          isListeningRef.current = true;
          setState((prev) => ({
            ...prev,
            isListening: true,
            error: null,
            feedbackMessage:
              isAutoRestart && prev.feedbackMessage
                ? prev.feedbackMessage
                : 'Listening now — speak your command clearly.',
          }));
        };

        recognition.onresult = (event: any) => {
          const { interim, final } = extractCleanSpeechTranscript(event);
          const combined = final || interim;

          if (combined) {
            latestInterimRef.current = combined;
            setState((prev) => ({ ...prev, interimTranscript: combined }));
          }

          if (final && !finalProcessedRef.current) {
            finalProcessedRef.current = true;
            latestInterimRef.current = '';
            processTranscript(final);
          }
        };

        recognition.onerror = (event: any) => {
          const errCode = event?.error || 'unknown';

          // If words were already captured before mobile fired 'aborted'/'no-speech', let onend flush them
          if (latestInterimRef.current.trim().length > 0) {
            return;
          }

          // If a background auto-restart was rejected by mobile Chrome (because mobile requires
          // a fresh user tap per utterance), exit listening cleanly without showing a red error.
          if (isAutoRestart && (errCode === 'aborted' || errCode === 'not-allowed' || errCode === 'no-speech')) {
            isListeningRef.current = false;
            recognitionRef.current = null;
            setState((prev) => ({
              ...prev,
              isListening: false,
              interimTranscript: '',
              error: null,
            }));
            return;
          }

          if (errCode === 'no-speech' || errCode === 'aborted') {
            if (IS_MOBILE_BROWSER) {
              isListeningRef.current = false;
              recognitionRef.current = null;
              setState((prev) => ({
                ...prev,
                isListening: false,
                interimTranscript: '',
                error: null,
                feedbackMessage: 'Tap Start Voice and speak right away.',
              }));
            }
            return;
          }

          isListeningRef.current = false;
          recognitionRef.current = null;

          if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
            if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
              navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((stream) => {
                  stream.getTracks().forEach((t) => t.stop());
                  setState((prev) => ({
                    ...prev,
                    isListening: false,
                    error: null,
                    feedbackMessage: 'Microphone permission unlocked! Tap Start Voice again.',
                  }));
                })
                .catch(() => {
                  setState((prev) => ({
                    ...prev,
                    isListening: false,
                    error:
                      'Microphone permission blocked. Tap the lock icon in Chrome address bar -> Allow Microphone.',
                  }));
                });
            } else {
              setState((prev) => ({
                ...prev,
                isListening: false,
                error: 'Microphone access denied. Check browser site permissions.',
              }));
            }
            return;
          }

          setState((prev) => ({
            ...prev,
            isListening: false,
            error: `Voice recognition notice (${errCode}). Use Quick Test grid or type below.`,
          }));
        };

        recognition.onend = () => {
          recognitionRef.current = null;

          // Flush any uncommitted mobile interim speech before ending or restarting
          const pendingInterim = latestInterimRef.current.trim();
          const didFlushCommand = !finalProcessedRef.current && pendingInterim.length > 0;
          if (didFlushCommand) {
            finalProcessedRef.current = true;
            latestInterimRef.current = '';
            processTranscript(pendingInterim);
          }

          if (!isListeningRef.current) {
            setState((prev) => ({ ...prev, isListening: false, interimTranscript: '' }));
            return;
          }

          // On Mobile Chrome, a single user tap authorizes one utterance session; trying to call
          // recognition.start() from an async timer without a new tap causes Android Chrome to abort.
          // End cleanly after each mobile utterance so the next tap is a 100% synchronous user gesture!
          if (IS_MOBILE_BROWSER) {
            isListeningRef.current = false;
            setState((prev) => ({
              ...prev,
              isListening: false,
              interimTranscript: '',
            }));
            return;
          }

          // On Desktop Chrome/Edge, auto-restart continuous listening seamlessly
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null;
            if (isListeningRef.current) {
              startRecognitionNow(true);
            }
          }, 250);
        };

        recognitionRef.current = recognition;
        recognition.start();
        isListeningRef.current = true;
        setState((prev) => ({
          ...prev,
          isListening: true,
          error: null,
        }));
      } catch (err: any) {
        isListeningRef.current = false;
        recognitionRef.current = null;
        setState((prev) => ({
          ...prev,
          isListening: false,
          error: `Could not start microphone: ${err?.message || 'Permission denied'}`,
        }));
      }
    },
    [cleanupRecognitionRef, processTranscript]
  );

  /**
   * Start listening for voice commands — called SYNCHRONOUSLY inside onClick!
   */
  const startListening = useCallback(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error:
          'Mobile browsers require HTTPS (Vercel preview URL) for microphone access. Over plain HTTP LAN, use the Quick Test buttons below.',
      }));
      return;
    }

    if (!SpeechRecognitionClass) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: 'Web Speech API is not supported in this browser.',
      }));
      return;
    }

    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis?.speaking
    ) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    // Call startRecognitionNow(false) synchronously on the user's tap call stack!
    startRecognitionNow(false);
  }, [startRecognitionNow]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;

    const pendingInterim = latestInterimRef.current.trim();
    cleanupRecognitionRef();

    if (!finalProcessedRef.current && pendingInterim.length > 0) {
      finalProcessedRef.current = true;
      latestInterimRef.current = '';
      processTranscript(pendingInterim);
    }

    setState((prev) => ({
      ...prev,
      isListening: false,
      interimTranscript: '',
      error: null,
      feedbackMessage: prev.feedbackMessage || 'Voice scoring paused.',
    }));
  }, [cleanupRecognitionRef, processTranscript]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  const simulateVoiceCommand = useCallback(
    (spokenText: string) => {
      processTranscript(spokenText);
    },
    [processTranscript]
  );

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      cleanupRecognitionRef();
    };
  }, [cleanupRecognitionRef]);

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
