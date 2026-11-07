/**
 * Public Voice Assistant Hook for PSU SportsTrack
 * Manages universal voice queries, TTS feedback, and dynamic data previews.
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

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionClass);
  }, []);

  const handleProcessQuery = useCallback(
    async (spokenText: string) => {
      if (!spokenText.trim()) return;

      const parsed = parsePublicVoiceQuery(spokenText);
      setActiveQuery(parsed);
      setTranscript(spokenText);
      setInterimTranscript('');
      setIsOpen(true);

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
    [isMuted]
  );

  const startListening = useCallback(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsOpen(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setIsOpen(true);
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

        if (interim) setInterimTranscript(interim);
        if (final) {
          handleProcessQuery(final);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [handleProcessQuery]);

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
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const navigateToResult = useCallback(
    (route?: string) => {
      const target = route || activeQuery?.targetRoute;
      if (target) {
        setIsOpen(false);
        navigate(target);
      }
    },
    [activeQuery, navigate]
  );

  return {
    isOpen,
    setIsOpen,
    isListening,
    isSupported,
    transcript,
    interimTranscript,
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
