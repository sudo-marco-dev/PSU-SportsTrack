/**
 * Public Voice Assistant Hook for PSU SportsTrack
 *
 * Engineered for both Desktop Chrome/Edge/Safari and Mobile Chrome (Android) / iOS Safari:
 * - Calls `recognition.start()` 100% synchronously inside the user tap handler (required by Mobile Chrome).
 * - Avoids calling `speechSynthesis.cancel()` or `.stop()` on dead instances during `.start()`.
 * - Deduplicates Android Chrome's cumulative `event.results` array.
 * - Flushes uncommitted `interimResults` on `onend` when mobile browsers omit `isFinal = true`.
 * - Warms up site microphone permission via `getUserMedia` if mobile browser initially blocks SpeechRecognition.
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

const IS_MOBILE_BROWSER =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/**
 * Extracts clean interim and final transcripts while preventing Android Chrome's
 * cumulative result duplication bug.
 */
export function extractCleanSpeechTranscript(event: any): { interim: string; final: string } {
  let interim = '';
  let final = '';
  const results = event?.results;
  if (!results || !results.length) return { interim, final };

  const startIdx = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
  for (let i = startIdx; i < results.length; ++i) {
    const res = results[i];
    const piece = (res?.[0]?.transcript || '').trim();
    if (!piece) continue;

    if (res.isFinal) {
      if (final && piece.toLowerCase().startsWith(final.toLowerCase())) {
        final = piece;
      } else if (!final.toLowerCase().endsWith(piece.toLowerCase())) {
        final = final ? `${final} ${piece}` : piece;
      }
    } else {
      if (interim && piece.toLowerCase().startsWith(interim.toLowerCase())) {
        interim = piece;
      } else if (!interim.toLowerCase().endsWith(piece.toLowerCase())) {
        interim = interim ? `${interim} ${piece}` : piece;
      }
    }
  }

  return { interim: interim.trim(), final: final.trim() };
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
  // Default TTS muted on mobile so Android AudioManager never revokes mic focus
  const [isMuted, setIsMuted] = useState<boolean>(IS_MOBILE_BROWSER);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const latestInterimRef = useRef<string>('');
  const finalProcessedRef = useRef<boolean>(false);

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    setIsSupported(Boolean(SpeechRecognitionClass));
  }, []);

  const cleanupRecognitionRef = useCallback(() => {
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

      cleanupRecognitionRef();
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
    [cleanupRecognitionRef, isMuted]
  );

  /**
   * Starts speech recognition SYNCHRONOUSLY inside the user's tap/click event.
   * Do NOT wrap in setTimeout — Mobile Chrome requires transient user activation on the call stack.
   */
  const startListening = useCallback(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    setIsOpen(true);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setVoiceError(
        'Mobile browsers require HTTPS (e.g. Vercel preview URL) for microphone access. Over plain HTTP LAN, use the search bar below.'
      );
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    if (!SpeechRecognitionClass) {
      setVoiceError(
        'Voice recognition is not supported in this browser. Please use Chrome/Safari or type below.'
      );
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    // Only cancel speechSynthesis if it is actively speaking (calling cancel() when idle
    // triggers Android AudioManager focus churn that aborts SpeechRecognizer).
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

    // Clean up any leftover reference before creating a fresh recognizer
    cleanupRecognitionRef();

    setVoiceError(null);
    setInterimTranscript('');
    latestInterimRef.current = '';
    finalProcessedRef.current = false;

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
        const { interim, final } = extractCleanSpeechTranscript(event);
        const combined = final || interim;

        if (combined) {
          latestInterimRef.current = combined;
          setInterimTranscript(combined);
        }

        if (final && !finalProcessedRef.current) {
          finalProcessedRef.current = true;
          latestInterimRef.current = '';
          void handleProcessQuery(final);
        }
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error || 'unknown';

        // If words were already captured before mobile fired 'aborted'/'no-speech', let onend flush them
        if (latestInterimRef.current.trim().length > 0) {
          return;
        }

        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;

        if (errCode === 'no-speech') {
          setVoiceError('No speech heard. Tap Speak and talk right away.');
          return;
        }

        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          // Attempt to trigger native mobile mic permission prompt if not yet granted
          if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices
              .getUserMedia({ audio: true })
              .then((stream) => {
                stream.getTracks().forEach((t) => t.stop());
                setVoiceError('Microphone unlocked! Tap Speak again and say your query.');
              })
              .catch(() => {
                setVoiceError(
                  'Microphone permission blocked. Tap the lock icon in your Chrome address bar -> Permissions -> Allow Microphone.'
                );
              });
          } else {
            setVoiceError(
              'Microphone permission blocked. Allow Microphone in browser site settings or type below.'
            );
          }
          return;
        }

        if (errCode === 'aborted') {
          setVoiceError(
            'Mobile voice input was interrupted. Tap Speak once and talk immediately, or tap the mic on your phone keyboard in the box below.'
          );
          return;
        }

        setVoiceError(
          `Voice recognition unavailable (${errCode}). Tap the search box below to use your phone keyboard mic.`
        );
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;

        // Flush any uncommitted mobile interim speech
        const pendingInterim = latestInterimRef.current.trim();
        if (!finalProcessedRef.current && pendingInterim.length > 0) {
          finalProcessedRef.current = true;
          latestInterimRef.current = '';
          void handleProcessQuery(pendingInterim);
        }
      };

      recognitionRef.current = recognition;
      // Call .start() SYNCHRONOUSLY inside the click handler!
      recognition.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err: any) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceError(
        `Could not start microphone (${err?.message || 'busy'}). Tap Speak again or type below.`
      );
    }
  }, [cleanupRecognitionRef, handleProcessQuery]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);

    const pendingInterim = latestInterimRef.current.trim();
    cleanupRecognitionRef();

    if (!finalProcessedRef.current && pendingInterim.length > 0) {
      finalProcessedRef.current = true;
      latestInterimRef.current = '';
      void handleProcessQuery(pendingInterim);
    }
  }, [cleanupRecognitionRef, handleProcessQuery]);

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
        stopListening();
        setIsOpen(false);
        navigate(target);
      }
    },
    [activeQuery, navigate, stopListening]
  );

  useEffect(() => {
    return () => {
      cleanupRecognitionRef();
    };
  }, [cleanupRecognitionRef]);

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
