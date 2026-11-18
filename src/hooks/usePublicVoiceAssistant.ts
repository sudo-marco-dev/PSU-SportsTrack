/**
 * Public Voice Assistant Hook for PSU SportsTrack
 *
 * Powered by the 2-Stage Hybrid Mobile Speech Engine (`mobileSpeechEngine.ts`):
 * - Stage 1: Native `SpeechRecognition` invoked synchronously on tap.
 * - Stage 2: Automatic seamless fallback to `getUserMedia` hardware microphone capture +
 *   Web Audio Voice Activity Detection (VAD) + on-device Whisper speech-to-text when
 *   Mobile Chrome's native `SpeechRecognizer` aborts (`error: "aborted"`) or ends prematurely.
 * - Guarantees `isListening` never flickers or reverts prematurely on mobile tap.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ParsedPublicVoiceQuery } from '@/lib/publicVoiceAssistant';
import { parsePublicVoiceQuery, executePublicVoiceDataQuery } from '@/lib/publicVoiceAssistant';
import { speakConfirmation } from './useVoiceScoring';
import {
  IS_MOBILE_BROWSER,
  extractCleanSpeechTranscript,
  preloadMobileWhisperModel,
  startHybridSpeechSession,
  type HybridSpeechSession,
} from '@/lib/mobileSpeechEngine';

export { extractCleanSpeechTranscript };

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function usePublicVoiceAssistant() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState<boolean>(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const hasNativeSpeech = Boolean(win?.SpeechRecognition || win?.webkitSpeechRecognition);
    const hasMediaMic =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    return hasNativeSpeech || hasMediaMic;
  });
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<ParsedPublicVoiceQuery | null>(null);
  const [queryResults, setQueryResults] = useState<{
    type: string;
    items: any[];
    directAnswer?: any;
    isFallback?: boolean;
    fallbackMessage?: string;
    autoCorrectedNotice?: string;
    spokenResponse?: string;
    error?: boolean;
  } | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  // Default TTS muted on mobile so Android AudioManager never revokes mic focus
  const [isMuted, setIsMuted] = useState<boolean>(IS_MOBILE_BROWSER);

  const sessionRef = useRef<HybridSpeechSession | null>(null);
  const isListeningRef = useRef<boolean>(false);

  // Warm up on-device Whisper in the background on mobile (on idle after mount + when dialog opens)
  useEffect(() => {
    if (!IS_MOBILE_BROWSER) return;
    if (isOpen) {
      void preloadMobileWhisperModel().catch(() => {});
      return;
    }
    const warmupTimer = window.setTimeout(() => {
      void preloadMobileWhisperModel().catch(() => {});
    }, 1200);
    return () => window.clearTimeout(warmupTimer);
  }, [isOpen]);

  const abortCurrentSession = useCallback(() => {
    if (sessionRef.current) {
      const current = sessionRef.current;
      sessionRef.current = null;
      current.abort();
    }
  }, []);

  const handleProcessQuery = useCallback(
    async (spokenText: string) => {
      const cleaned = spokenText.trim();
      if (!cleaned) return;

      setVoiceError(null);
      const parsed = parsePublicVoiceQuery(cleaned);
      setActiveQuery(parsed);
      setTranscript(cleaned);
      setInterimTranscript('');
      setIsOpen(true);

      abortCurrentSession();
      isListeningRef.current = false;
      setIsListening(false);

      // Audible Initial Acknowledgment (only when unmuted)
      if (!isMuted && parsed.spokenResponse) {
        speakConfirmation(parsed.spokenResponse);
      }

      // Fetch dynamic previews and analytical direct answers
      setIsLoadingResults(true);
      const results = await executePublicVoiceDataQuery(parsed);
      setQueryResults(results);
      setIsLoadingResults(false);

      // Audible Final Direct Answer if computed and different from initial acknowledgment
      if (
        !isMuted &&
        results &&
        results.spokenResponse &&
        results.spokenResponse !== parsed.spokenResponse
      ) {
        speakConfirmation(results.spokenResponse);
      }
    },
    [abortCurrentSession, isMuted]
  );

  const startListening = useCallback(() => {
    setIsOpen(true);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setVoiceError(
        'Mobile browsers require HTTPS (e.g. Vercel preview URL) for microphone access. Over plain HTTP LAN, use the search bar below.'
      );
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    abortCurrentSession();
    setVoiceError(null);
    setInterimTranscript('Listening... speak now');
    isListeningRef.current = true;
    setIsListening(true);

    sessionRef.current = startHybridSpeechSession({
      onStart: () => {
        isListeningRef.current = true;
        setIsListening(true);
        setVoiceError(null);
      },
      onInterim: (text) => {
        setInterimTranscript(text);
      },
      onFinal: (text) => {
        void handleProcessQuery(text);
      },
      onError: (msg) => {
        setInterimTranscript('');
        setVoiceError(msg);
      },
      onEnd: () => {
        sessionRef.current = null;
        isListeningRef.current = false;
        setIsListening(false);
        setInterimTranscript('');
      },
    });
  }, [abortCurrentSession, handleProcessQuery]);

  const stopListening = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.finishAndTranscribe();
    } else {
      isListeningRef.current = false;
      setIsListening(false);
      setInterimTranscript('');
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const navigateToResult = useCallback(
    (route?: string) => {
      const target = route || activeQuery?.targetRoute;
      if (target) {
        abortCurrentSession();
        isListeningRef.current = false;
        setIsListening(false);
        setIsOpen(false);
        navigate(target);
      }
    },
    [abortCurrentSession, activeQuery, navigate]
  );

  useEffect(() => {
    return () => {
      abortCurrentSession();
    };
  }, [abortCurrentSession]);

  return {
    isOpen,
    setIsOpen,
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    voiceError,
    activeQuery,
    queryResults,
    isLoadingResults,
    isMuted,
    setIsMuted,
    startListening,
    stopListening,
    toggleListening,
    simulateQuery: handleProcessQuery,
    navigateToResult,
  };
}
