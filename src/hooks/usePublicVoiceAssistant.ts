/**
 * Public Voice Assistant Hook for PSU SportsTrack
 * Manages universal voice queries, TTS feedback, mobile interim-result flushing,
 * debounced hardware mic lifecycle, and dynamic data previews.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ParsedPublicVoiceQuery } from '@/lib/publicVoiceAssistant';
import { parsePublicVoiceQuery, executePublicVoiceDataQuery } from '@/lib/publicVoiceAssistant';
import { speakConfirmation } from './useVoiceScoring';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function usePublicVoiceAssistant() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
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
  const [isMuted, setIsMuted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const startTimerRef = useRef<number | null>(null);
  const latestInterimRef = useRef<string>('');
  const finalProcessedRef = useRef<boolean>(false);

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    setIsSupported(Boolean(SpeechRecognitionClass));
  }, []);

  const detachCurrentRecognition = useCallback(() => {
    if (startTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
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

      // Stop active mic capture before speaking TTS so mobile audio ducking doesn't glitch
      detachCurrentRecognition();
      isListeningRef.current = false;
      setIsListening(false);

      // Audible Initial Acknowledgment
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
    [detachCurrentRecognition, isMuted]
  );

  const startListening = useCallback(
    (delayMs = 0) => {
      const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
      const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

      setIsOpen(true);

      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setVoiceError(
          'Mobile browsers block microphone access on plain HTTP LAN URLs (http://192.168.x.x). Use HTTPS (Vercel preview), localhost, or type below.'
        );
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }

      if (!SpeechRecognitionClass) {
        setVoiceError(
          'Voice recognition is not supported in this mobile browser. Please use Chrome/Safari or type your query below.'
        );
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }

      const hadPreviousSession = Boolean(recognitionRef.current);
      detachCurrentRecognition();

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      setVoiceError(null);
      setInterimTranscript('');
      latestInterimRef.current = '';
      finalProcessedRef.current = false;

      // Mobile OS audio stacks need ~180ms to release an aborted SpeechRecognition instance
      // or complete modal focus transitions before starting a new session.
      const effectiveDelay = Math.max(delayMs, hadPreviousSession ? 200 : 60);

      startTimerRef.current = window.setTimeout(() => {
        startTimerRef.current = null;
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = 'en-US';

          recognition.onstart = () => {
            isListeningRef.current = true;
            setIsListening(true);
            setVoiceError(null);
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

            const combinedInterim = (final || interim).trim();
            if (combinedInterim) {
              latestInterimRef.current = combinedInterim;
              setInterimTranscript(combinedInterim);
            }

            if (final.trim() && !finalProcessedRef.current) {
              finalProcessedRef.current = true;
              latestInterimRef.current = '';
              void handleProcessQuery(final.trim());
            }
          };

          recognition.onerror = (event: any) => {
            const errCode = event?.error || 'unknown';
            // If mobile aborted right as speech ended, let onend flush latestInterimRef
            if (errCode === 'aborted' || errCode === 'no-speech') {
              if (!latestInterimRef.current.trim() && errCode === 'no-speech') {
                setVoiceError('No speech detected. Tap Speak and talk clearly near the microphone.');
              }
              return;
            }

            isListeningRef.current = false;
            setIsListening(false);
            if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
              setVoiceError(
                'Microphone permission denied or blocked. Allow mic access in browser settings or type below.'
              );
            } else {
              setVoiceError(`Voice input unavailable (${errCode}). You can type your search below.`);
            }
          };

          recognition.onend = () => {
            isListeningRef.current = false;
            setIsListening(false);
            recognitionRef.current = null;

            // Mobile Safari / Android Chrome often fire onend with only interimResults
            const pendingInterim = latestInterimRef.current.trim();
            if (!finalProcessedRef.current && pendingInterim.length > 0) {
              finalProcessedRef.current = true;
              latestInterimRef.current = '';
              void handleProcessQuery(pendingInterim);
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (err: any) {
          isListeningRef.current = false;
          setIsListening(false);
          setVoiceError(
            `Could not start microphone (${err?.message || 'busy'}). Tap Speak again or type below.`
          );
        }
      }, effectiveDelay);
    },
    [detachCurrentRecognition, handleProcessQuery]
  );

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);

    // If the user spoke words and tapped "Stop" manually on mobile before isFinal fired,
    // flush the captured interim phrase immediately!
    const pendingInterim = latestInterimRef.current.trim();
    detachCurrentRecognition();

    if (!finalProcessedRef.current && pendingInterim.length > 0) {
      finalProcessedRef.current = true;
      latestInterimRef.current = '';
      void handleProcessQuery(pendingInterim);
    }
  }, [detachCurrentRecognition, handleProcessQuery]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening(0);
    }
  }, [isListening, startListening, stopListening]);

  const navigateToResult = useCallback(
    (route?: string) => {
      const target = route || activeQuery?.targetRoute;
      if (target) {
        stopListening();
        setIsOpen(false);
        navigate(target);
      }
    },
    [activeQuery, navigate, stopListening]
  );

  useEffect(() => {
    return () => {
      detachCurrentRecognition();
    };
  }, [detachCurrentRecognition]);

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
