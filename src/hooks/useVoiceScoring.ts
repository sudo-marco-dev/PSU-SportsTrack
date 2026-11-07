/**
 * Web Speech API Hook for Courtside Voice Scoring
 * PSU SportsTrack - Multimodal Interaction Module
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  VoiceScoringOptions,
  VoiceRecognitionState,
  ParsedVoiceCommand,
} from '@/types/multimodal';
import { parseVoiceCommand } from '@/lib/voiceCommandParser';
import { playScoreChime, playSubHornSound, playClockPauseSound, playClockStartSound } from '@/lib/audioFx';

// Type definitions for Web Speech API
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
    onDeduct,
    onTimeout,
    onFoul,
    onClockControl,
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
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Check browser support on mount
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
            setState((prev) => ({ ...prev, feedbackMessage: feedback }));
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
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
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
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'clock': {
          const action = clockAction === 'resume' ? 'resume' : 'pause';
          onClockControl?.(action);
          if (action === 'pause') {
            try { playClockPauseSound(); } catch {}
          } else {
            try { playClockStartSound(); } catch {}
          }

          const feedback = action === 'pause' ? 'Match clock paused' : 'Match clock resumed';
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'deduct': {
          const targetTeam = team || 'a';
          const targetName = (targetTeam === 'a' ? teamAName : teamBName) || 'Team';
          onDeduct?.(targetTeam);

          const feedback = `Score correction opened for ${targetName}`;
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'timeout': {
          onTimeout?.(team || undefined);
          const feedback = team ? `Timeout called for ${teamName}` : 'Official timeout called';
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'foul': {
          onFoul?.(team || 'a', playerNumber || undefined);
          const feedback = playerNumber
            ? `Foul logged on Player #${playerNumber}`
            : `Foul logged for ${teamName || 'team'}`;
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'commentary': {
          if (notes) {
            onCommentary?.(notes);
            const feedback = 'Commentary broadcasted';
            setState((prev) => ({ ...prev, feedbackMessage: feedback }));
            if (!isMuted) speakConfirmation(feedback);
          }
          break;
        }

        case 'undo': {
          onUndo?.();
          const feedback = 'Reverting last courtside action';
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
          if (!isMuted) speakConfirmation(feedback);
          break;
        }

        case 'help': {
          const feedback = 'You can say: "Give 2 points to Team A player 1", "Substitute player 1 with 2", or "Timeout Team B"';
          setState((prev) => ({ ...prev, feedbackMessage: feedback }));
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
    [teamAName, teamBName, onScore, onSubstitution, onDeduct, onTimeout, onFoul, onClockControl, onCommentary, onUndo, isMuted]
  );

  /**
   * Process incoming transcript text
   */
  const processTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const parsed = parseVoiceCommand(text, {
        teamAName: optionsRef.current.teamAName,
        teamBName: optionsRef.current.teamBName,
        sport,
      });

      setState((prev) => ({
        ...prev,
        transcript: text,
        interimTranscript: '',
        lastCommand: parsed,
        history: [parsed, ...prev.history.slice(0, 9)],
      }));

      executeCommand(parsed);
    },
    [sport, executeCommand]
  );

  /**
   * Start listening for voice commands
   */
  const startListening = useCallback(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setState((prev) => ({
        ...prev,
        error: 'Web Speech API is not supported in this browser.',
      }));
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setState((prev) => ({
          ...prev,
          isListening: true,
          error: null,
          feedbackMessage: 'Voice scoring active. Speak commands clearly.',
        }));
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setState((prev) => ({ ...prev, interimTranscript: interim }));
        }

        if (final) {
          processTranscript(final);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setState((prev) => ({
            ...prev,
            error: `Voice recognition error: ${event.error}`,
          }));
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
            setState((prev) => ({ ...prev, isListening: false }));
          }
        } else {
          setState((prev) => ({ ...prev, isListening: false }));
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: `Could not access microphone: ${err.message || 'Permission denied'}`,
      }));
    }
  }, [processTranscript]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // no-op
      }
      recognitionRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isListening: false,
      interimTranscript: '',
      feedbackMessage: 'Voice scoring paused.',
    }));
  }, []);

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
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // no-op
        }
      }
    };
  }, []);

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
