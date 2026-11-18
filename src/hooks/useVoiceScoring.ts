/**
 * Web Speech API Hook for Courtside Voice Scoring
 * PSU SportsTrack - Multimodal Interaction Module
 *
 * Includes mobile SpeechRecognition interim-result flushing on `onend`,
 * TTS audio-ducking cooldowns, benign 'aborted'/'no-speech' suppression,
 * and steady `isListening` state across mobile utterance restarts.
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
    window.speechSynthesis.cancel();
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

  const [isMuted, setIsMuted] = useState<boolean>(!enableSpeechFeedback);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const restartTimerRef = useRef<number | null>(null);
  const latestInterimRef = useRef<string>('');
  const finalProcessedRef = useRef<boolean>(false);
  const lastStartTimestampRef = useRef<number>(0);
  const rapidAbortCountRef = useRef<number>(0);

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

  const detachCurrentRecognition = useCallback(() => {
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
        existing.abort?.();
      } catch {
        // ignore
      }
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
   * Internal cycle launcher that respects mobile audio ducking & debounce
   */
  const launchRecognitionCycle = useCallback(
    (delayMs = 0) => {
      const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
      const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;
      if (!SpeechRecognitionClass || !isListeningRef.current) return;

      detachCurrentRecognition();

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!isListeningRef.current) return;

        // If browser TTS is currently speaking confirmation audio, wait for it to finish
        // so mobile OS audio routing does not immediately abort the microphone.
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
          launchRecognitionCycle(320);
          return;
        }

        try {
          const isMobile =
            typeof navigator !== 'undefined' &&
            /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

          const recognition = new SpeechRecognitionClass();
          // Mobile browsers handle single-utterance + debounced auto-restart cleanly
          // without triggering continuous-mode audio session aborts.
          recognition.continuous = !isMobile;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = 'en-US';

          latestInterimRef.current = '';
          finalProcessedRef.current = false;
          lastStartTimestampRef.current = Date.now();

          recognition.onstart = () => {
            if (!isListeningRef.current) return;
            setState((prev) => ({
              ...prev,
              isListening: true,
              error: null,
              feedbackMessage:
                prev.feedbackMessage && prev.feedbackMessage !== 'Voice scoring paused.'
                  ? prev.feedbackMessage
                  : 'Voice scoring active. Speak commands clearly.',
            }));
          };

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const piece = event.results[i]?.[0]?.transcript || '';
              if (event.results[i].isFinal) {
                final += piece;
              } else {
                interim += piece;
              }
            }

            rapidAbortCountRef.current = 0;

            const combined = (final || interim).trim();
            if (combined) {
              latestInterimRef.current = combined;
              setState((prev) => ({ ...prev, interimTranscript: combined }));
            }

            if (final.trim() && !finalProcessedRef.current) {
              finalProcessedRef.current = true;
              latestInterimRef.current = '';
              processTranscript(final.trim());
            }
          };

          recognition.onerror = (event: any) => {
            const errCode = event?.error || 'unknown';
            // Ignore routine mobile 'aborted' and 'no-speech' events so the UI never
            // flashes red errors or jumps scroll height during continuous listening.
            if (errCode === 'no-speech' || errCode === 'aborted') {
              return;
            }

            if (
              errCode === 'not-allowed' ||
              errCode === 'service-not-allowed' ||
              errCode === 'audio-capture'
            ) {
              isListeningRef.current = false;
              setState((prev) => ({
                ...prev,
                isListening: false,
                error:
                  'Microphone access denied or unavailable. Check browser mic permissions.',
              }));
              return;
            }

            setState((prev) => ({
              ...prev,
              error: `Voice recognition notice: ${errCode}`,
            }));
          };

          recognition.onend = () => {
            recognitionRef.current = null;

            // Flush any uncommitted mobile interim speech before restarting or stopping
            const pendingInterim = latestInterimRef.current.trim();
            if (!finalProcessedRef.current && pendingInterim.length > 0) {
              finalProcessedRef.current = true;
              latestInterimRef.current = '';
              processTranscript(pendingInterim);
            }

            if (!isListeningRef.current) {
              setState((prev) => ({ ...prev, isListening: false, interimTranscript: '' }));
              return;
            }

            const elapsed = Date.now() - lastStartTimestampRef.current;
            if (elapsed < 220 && !pendingInterim) {
              rapidAbortCountRef.current += 1;
            } else {
              rapidAbortCountRef.current = 0;
            }

            // Guard against mobile background/hardware lockouts (>5 instant aborts in a row)
            if (rapidAbortCountRef.current >= 5) {
              isListeningRef.current = false;
              setState((prev) => ({
                ...prev,
                isListening: false,
                interimTranscript: '',
                feedbackMessage: 'Microphone paused by device. Tap Start Voice when ready to speak.',
              }));
              return;
            }

            // Keep state.isListening = true across the 320ms mobile debounce so the
            // Stop Voice button never blinks or flickers between utterances.
            launchRecognitionCycle(320);
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (err: any) {
          isListeningRef.current = false;
          setState((prev) => ({
            ...prev,
            isListening: false,
            error: `Could not start microphone: ${err?.message || 'Permission denied'}`,
          }));
        }
      }, delayMs);
    },
    [detachCurrentRecognition, processTranscript]
  );

  /**
   * Start listening for voice commands
   */
  const startListening = useCallback(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error:
          'Mobile browsers require HTTPS (or localhost) for microphone access. Over plain HTTP LAN (192.168.x.x), use Quick Test buttons or type below.',
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

    rapidAbortCountRef.current = 0;
    isListeningRef.current = true;
    setState((prev) => ({
      ...prev,
      isListening: true,
      error: null,
      feedbackMessage: 'Voice scoring active. Speak commands clearly.',
    }));

    launchRecognitionCycle(60);
  }, [launchRecognitionCycle]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;

    const pendingInterim = latestInterimRef.current.trim();
    detachCurrentRecognition();

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
      feedbackMessage: 'Voice scoring paused.',
    }));
  }, [detachCurrentRecognition, processTranscript]);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
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
      detachCurrentRecognition();
    };
  }, [detachCurrentRecognition]);

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
