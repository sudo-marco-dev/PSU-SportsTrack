/**
 * Universal Mobile & Desktop Speech Recognition Engine for PSU SportsTrack
 *
 * Solves the Android Chrome Mobile `webkitSpeechRecognition` instant-abort (`ERROR_CLIENT` /
 * `error: "aborted"`) and premature `onend` hardware bug:
 *
 * - Stage 1 (Native Web Speech API): Invokes `SpeechRecognition.start()` synchronously on tap.
 *   Deduplicates Android Chrome's cumulative `event.results` array and flushes uncommitted
 *   interim transcripts on `onend`.
 * - Stage 2 (Automatic Hardware Mic + On-Device Whisper Fallback): When Android Chrome's native
 *   `SpeechRecognizer` intent immediately aborts (`onerror: "aborted"`, `"service-not-allowed"`,
 *   `"network"`, `"audio-capture"`) or terminates prematurely (`onend` within <1400ms with zero
 *   transcript), the engine DOES NOT flip `isListening` back to `false` (preventing card glitching).
 *   Instead, it seamlessly opens the microphone via `navigator.mediaDevices.getUserMedia({ audio: true })`,
 *   tracks real-time voice activity (VAD) via Web Audio `AudioContext` + `MediaRecorder` backup, and
 *   transcribes the 16kHz PCM audio in-browser using `@xenova/transformers` (`Xenova/whisper-tiny.en`).
 */

import { suspendAudioContextForMic } from './audioFx';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
  __psuMockAudioTranscriber?: (pcm16k: Float32Array) => Promise<string>;
}

export const IS_MOBILE_BROWSER =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// Session-sticky flag: once native SpeechRecognition aborts prematurely on a mobile device,
// subsequent taps bypass the broken Android SpeechRecognizer intent and go straight to Stage 2.
let nativeSpeechAbortedOnDevice = false;

// Singleton cached Whisper pipeline promise so the quantized model is loaded only once per session
let whisperPipelinePromise: Promise<any> | null = null;

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

/**
 * Preloads the quantized on-device Whisper speech-to-text pipeline in the background
 * so mobile fallback transcription executes with minimal latency.
 */
export function preloadMobileWhisperModel(
  onProgress?: (statusText: string) => void
): Promise<any> {
  if (typeof window !== 'undefined' && (window as unknown as IWindow).__psuMockAudioTranscriber) {
    return Promise.resolve((window as unknown as IWindow).__psuMockAudioTranscriber);
  }

  if (!whisperPipelinePromise) {
    whisperPipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        // Crucial for Vite/Vercel SPAs: prevent fetching `/models/...` from local SPA rewrite
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        return await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
          quantized: true,
          progress_callback: (prog: any) => {
            if (onProgress && prog?.status === 'progress' && typeof prog?.progress === 'number') {
              onProgress(`Preparing voice engine (${Math.round(prog.progress)}%)...`);
            }
          },
        });
      } catch (err) {
        whisperPipelinePromise = null;
        throw err;
      }
    })();
  }

  return whisperPipelinePromise;
}

/**
 * Concatenates Float32Array chunks, resamples to 16,000 Hz, and trims dead silence
 * around the spoken utterance for fast Whisper inference.
 */
export function preparePcm16kForWhisper(
  chunks: Float32Array[],
  inputSampleRate: number
): { pcm16k: Float32Array; maxRms: number } {
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  if (totalLen === 0) {
    return { pcm16k: new Float32Array(0), maxRms: 0 };
  }

  const merged = new Float32Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  // Resample to 16,000 Hz if needed
  const targetRate = 16000;
  let resampled: Float32Array;
  if (inputSampleRate === targetRate || inputSampleRate <= 0) {
    resampled = merged;
  } else {
    const ratio = inputSampleRate / targetRate;
    const outLen = Math.max(1, Math.round(merged.length / ratio));
    resampled = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(merged.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      resampled[i] = merged[idx0] * (1 - frac) + merged[idx1] * frac;
    }
  }

  // Measure frame RMS and trim excessive leading/trailing silence
  const frameSize = 400; // 25ms at 16kHz
  let maxRms = 0;
  let firstActiveSample = 0;
  let lastActiveSample = resampled.length;
  let foundStart = false;
  const activeThreshold = 0.011;

  for (let i = 0; i < resampled.length; i += frameSize) {
    const end = Math.min(resampled.length, i + frameSize);
    let sumSq = 0;
    for (let j = i; j < end; j++) {
      sumSq += resampled[j] * resampled[j];
    }
    const rms = Math.sqrt(sumSq / (end - i));
    if (rms > maxRms) maxRms = rms;
    if (rms >= activeThreshold) {
      if (!foundStart) {
        foundStart = true;
        firstActiveSample = Math.max(0, i - 2400); // keep 150ms leading pad
      }
      lastActiveSample = Math.min(resampled.length, end + 3200); // keep 200ms trailing pad
    }
  }

  if (foundStart && lastActiveSample > firstActiveSample) {
    resampled = resampled.subarray(firstActiveSample, lastActiveSample);
  }

  // Normalize peak amplitude if quiet mic
  let peak = 0;
  for (let i = 0; i < resampled.length; i++) {
    const abs = Math.abs(resampled[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0.01 && peak < 0.5) {
    const scale = Math.min(8, 0.75 / peak);
    for (let i = 0; i < resampled.length; i++) {
      resampled[i] = Math.max(-1, Math.min(1, resampled[i] * scale));
    }
  }

  return { pcm16k: resampled, maxRms };
}

/**
 * Cleans Whisper output tokens by stripping non-speech tags like [BLANK_AUDIO] or (music).
 */
export function cleanWhisperTranscript(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\[.*?\]|\(.*?\)|\*.*?\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Filter common Whisper silence hallucinations
  const lower = cleaned.toLowerCase().replace(/[.!,?]/g, '').trim();
  if (
    !lower ||
    lower === 'you' ||
    lower === 'thank you' ||
    lower === 'thanks for watching' ||
    lower === 'blank audio' ||
    lower === 'silence'
  ) {
    return '';
  }

  return cleaned;
}

export interface HybridSpeechCallbacks {
  onStart?: () => void;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

export interface HybridSpeechSession {
  /** Stops recording immediately and transcribes any speech captured so far */
  finishAndTranscribe: () => void;
  /** Cancels recognition/recording immediately without transcribing */
  abort: () => void;
}

/**
 * Starts a hybrid speech recognition session:
 * - Tries native `SpeechRecognition` synchronously on user tap.
 * - If native `SpeechRecognition` is unsupported, aborts (`error: "aborted"`), or ends
 *   prematurely (<1400ms with 0 words), seamlessly transitions to `getUserMedia` + Web Audio VAD +
 *   on-device Whisper STT WITHOUT dropping `isListening`.
 */
export function startHybridSpeechSession(callbacks: HybridSpeechCallbacks): HybridSpeechSession {
  const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
  const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

  let isAborted = false;
  let isFinished = false;
  let finalDelivered = false;
  let recognition: any = null;

  // Fallback Web Audio + MediaRecorder recording state
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  const mediaBlobChunks: BlobPart[] = [];
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;
  let maxDurationTimer: number | null = null;
  const pcmChunks: Float32Array[] = [];
  let recordedSampleRate = 16000;
  let fallbackActive = false;

  suspendAudioContextForMic();

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

  const cleanupFallbackHardware = () => {
    if (maxDurationTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorder = null;
    if (processorNode) {
      try {
        processorNode.onaudioprocess = null;
        processorNode.disconnect();
      } catch {
        // ignore
      }
      processorNode = null;
    }
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch {
        // ignore
      }
      sourceNode = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      try {
        void audioContext.close();
      } catch {
        // ignore
      }
      audioContext = null;
    }
  };

  const cleanupNativeRecognition = () => {
    if (recognition) {
      const ref = recognition;
      recognition = null;
      ref.onstart = null;
      ref.onresult = null;
      ref.onerror = null;
      ref.onend = null;
      try {
        ref.stop?.();
      } catch {
        // ignore
      }
    }
  };

  const finalizeFallbackTranscription = async () => {
    if (isAborted || finalDelivered) return;
    fallbackActive = false;

    // If MediaRecorder is running and ScriptProcessorNode captured 0 PCM chunks (e.g. suspended AudioContext),
    // decode the MediaRecorder blob as backup
    if (pcmChunks.length === 0 && mediaRecorder && mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!mediaRecorder) {
          resolve();
          return;
        }
        mediaRecorder.onstop = () => resolve();
        try {
          mediaRecorder.stop();
        } catch {
          resolve();
        }
      });

      if (mediaBlobChunks.length > 0 && typeof window !== 'undefined') {
        try {
          const blob = new Blob(mediaBlobChunks);
          const arrayBuf = await blob.arrayBuffer();
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const decodeCtx = new AudioCtx();
          const decoded = await decodeCtx.decodeAudioData(arrayBuf);
          recordedSampleRate = decoded.sampleRate || 16000;
          pcmChunks.push(new Float32Array(decoded.getChannelData(0)));
          void decodeCtx.close().catch(() => {});
        } catch {
          // ignore decode error
        }
      }
    }

    cleanupFallbackHardware();
    mediaBlobChunks.length = 0;

    const { pcm16k, maxRms } = preparePcm16kForWhisper(pcmChunks, recordedSampleRate);
    pcmChunks.length = 0;

    const customMock =
      typeof window !== 'undefined'
        ? (window as unknown as IWindow).__psuMockAudioTranscriber
        : undefined;

    if (!customMock && (pcm16k.length < 600 || maxRms < 0.007)) {
      if (!isAborted) {
        callbacks.onError?.('No speech heard. Tap the voice button and speak clearly.');
        callbacks.onEnd?.();
      }
      return;
    }

    try {
      callbacks.onInterim?.('Transcribing your voice...');

      let rawText = '';
      if (customMock) {
        rawText = await customMock(pcm16k);
      } else {
        const transcriber = await preloadMobileWhisperModel((progText) => {
          if (!isAborted) callbacks.onInterim?.(progText);
        });
        if (isAborted) return;
        callbacks.onInterim?.('Processing spoken command...');
        const output = await transcriber(pcm16k, {
          chunk_length_s: 15,
          stride_length_s: 3,
          return_timestamps: false,
        });
        rawText = typeof output === 'string' ? output : output?.text || '';
      }

      if (isAborted) return;

      const cleaned = cleanWhisperTranscript(rawText);
      if (cleaned) {
        finalDelivered = true;
        callbacks.onFinal(cleaned);
        callbacks.onEnd?.();
      } else {
        callbacks.onError?.('Could not catch that clearly. Please speak slightly louder.');
        callbacks.onEnd?.();
      }
    } catch (err: any) {
      if (!isAborted) {
        callbacks.onError?.(
          `Voice processing unavailable (${err?.message || 'error'}). Try typing below.`
        );
        callbacks.onEnd?.();
      }
    }
  };

  const startFallbackAudioCapture = async () => {
    if (isAborted || finalDelivered || fallbackActive) return;
    fallbackActive = true;
    cleanupNativeRecognition();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      callbacks.onError?.(
        'Microphone access is not available in this browser. Please use HTTPS or type below.'
      );
      callbacks.onEnd?.();
      return;
    }

    // Start warming up the on-device Whisper model in parallel while the user speaks
    void preloadMobileWhisperModel().catch(() => {});

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (isAborted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      mediaStream = stream;
      callbacks.onStart?.();
      callbacks.onInterim?.('Listening... speak now (auto-sends when you pause)');

      // Start MediaRecorder backup in parallel
      if (typeof MediaRecorder !== 'undefined') {
        try {
          const mr = new MediaRecorder(stream);
          mr.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              mediaBlobChunks.push(ev.data);
            }
          };
          mr.start(200);
          mediaRecorder = mr;
        } catch {
          // ignore if MediaRecorder unsupported for synthetic stream
        }
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      audioContext = ctx;
      recordedSampleRate = ctx.sampleRate || 16000;

      const source = ctx.createMediaStreamSource(stream);
      sourceNode = source;

      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorNode = processor;

      let activeVoiceFrames = 0;
      let silenceMsAfterSpeech = 0;
      let totalElapsedMs = 0;
      let notifiedVoiceDetected = false;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isAborted || !fallbackActive) return;
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        pcmChunks.push(copy);

        let sumSq = 0;
        for (let i = 0; i < copy.length; i++) {
          sumSq += copy[i] * copy[i];
        }
        const rms = Math.sqrt(sumSq / copy.length);
        const frameDurationMs = (copy.length / recordedSampleRate) * 1000;
        totalElapsedMs += frameDurationMs;

        if (rms >= 0.014) {
          activeVoiceFrames += 1;
          silenceMsAfterSpeech = 0;
          if (activeVoiceFrames >= 3 && !notifiedVoiceDetected) {
            notifiedVoiceDetected = true;
            callbacks.onInterim?.('Hearing your voice... keep speaking or tap Stop');
          }
        } else if (activeVoiceFrames >= 5) {
          silenceMsAfterSpeech += frameDurationMs;
          // Auto-commit 1.15s after the user finishes speaking
          if (silenceMsAfterSpeech >= 1150) {
            void finalizeFallbackTranscription();
            return;
          }
        }

        // If 8.5s elapsed, finalize automatically
        if (totalElapsedMs >= 8500) {
          void finalizeFallbackTranscription();
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      maxDurationTimer = window.setTimeout(() => {
        if (fallbackActive && !isAborted) {
          void finalizeFallbackTranscription();
        }
      }, 9000);
    } catch (err: any) {
      fallbackActive = false;
      cleanupFallbackHardware();
      if (!isAborted) {
        const isDenied =
          err?.name === 'NotAllowedError' ||
          err?.name === 'PermissionDeniedError' ||
          /denied|permission/i.test(err?.message || '');
        callbacks.onError?.(
          isDenied
            ? 'Microphone permission blocked. Tap the lock/tune icon in your Chrome address bar -> Permissions -> Allow Microphone.'
            : `Microphone unavailable (${err?.message || 'busy'}). Please check site permissions or type below.`
        );
        callbacks.onEnd?.();
      }
    }
  };

  // If native SpeechRecognition is missing OR already known to abort on this mobile device,
  // jump straight to Stage 2 hardware microphone capture!
  if (!SpeechRecognitionClass || (IS_MOBILE_BROWSER && nativeSpeechAbortedOnDevice)) {
    callbacks.onStart?.();
    void startFallbackAudioCapture();
  } else {
    let latestInterim = '';
    const startedAt = Date.now();

    try {
      recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        if (isAborted) return;
        callbacks.onStart?.();
      };

      recognition.onresult = (event: any) => {
        if (isAborted || fallbackActive) return;
        const { interim, final } = extractCleanSpeechTranscript(event);
        const combined = final || interim;

        if (combined) {
          latestInterim = combined;
          callbacks.onInterim?.(combined);
        }

        if (final && !finalDelivered) {
          finalDelivered = true;
          latestInterim = '';
          cleanupNativeRecognition();
          callbacks.onFinal(final);
          callbacks.onEnd?.();
        }
      };

      recognition.onerror = (event: any) => {
        if (isAborted || fallbackActive) return;
        const errCode = event?.error || 'unknown';

        // If speech was already captured before mobile fired 'aborted'/'no-speech', flush it in onend
        if (latestInterim.trim().length > 0) {
          return;
        }

        // On mobile (or when native SpeechRecognition throws 'aborted', 'service-not-allowed',
        // 'not-allowed', 'audio-capture', or 'network'), seamlessly hand off to Stage 2
        // hardware microphone capture WITHOUT dropping out of listening state!
        if (
          errCode === 'aborted' ||
          errCode === 'service-not-allowed' ||
          errCode === 'not-allowed' ||
          errCode === 'audio-capture' ||
          errCode === 'network'
        ) {
          if (IS_MOBILE_BROWSER || errCode === 'aborted' || errCode === 'service-not-allowed') {
            nativeSpeechAbortedOnDevice = true;
          }
          void startFallbackAudioCapture();
          return;
        }

        cleanupNativeRecognition();
        if (errCode === 'no-speech') {
          callbacks.onError?.('No speech heard. Tap the voice button and speak right away.');
        } else {
          callbacks.onError?.(`Voice recognition notice (${errCode}). Try speaking again or type below.`);
        }
        callbacks.onEnd?.();
      };

      recognition.onend = () => {
        if (isAborted || fallbackActive || finalDelivered) return;
        cleanupNativeRecognition();

        const pending = latestInterim.trim();
        if (pending.length > 0) {
          finalDelivered = true;
          latestInterim = '';
          callbacks.onFinal(pending);
          callbacks.onEnd?.();
          return;
        }

        // If user manually clicked Stop while native recognizer was listening with 0 words
        if (isFinished) {
          callbacks.onEnd?.();
          return;
        }

        // CRITICAL ANDROID CHROME FIX:
        // Android Chrome often fires `onstart` followed immediately by `onend` (<1400ms)
        // WITHOUT firing `onerror` when the OS SpeechRecognizer binder fails.
        // Detect this premature termination and seamlessly hand off to Stage 2 `getUserMedia`!
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < 1400) {
          if (IS_MOBILE_BROWSER) {
            nativeSpeechAbortedOnDevice = true;
          }
          void startFallbackAudioCapture();
          return;
        }

        callbacks.onEnd?.();
      };

      // Invoke .start() 100% synchronously on the user tap call stack
      recognition.start();
      callbacks.onStart?.();
    } catch {
      if (IS_MOBILE_BROWSER) {
        nativeSpeechAbortedOnDevice = true;
      }
      void startFallbackAudioCapture();
    }
  }

  return {
    finishAndTranscribe: () => {
      if (isAborted) return;
      if (isFinished) {
        isAborted = true;
        fallbackActive = false;
        cleanupNativeRecognition();
        cleanupFallbackHardware();
        callbacks.onEnd?.();
        return;
      }
      isFinished = true;
      if (fallbackActive) {
        void finalizeFallbackTranscription();
      } else if (recognition) {
        try {
          recognition.stop?.();
        } catch {
          cleanupNativeRecognition();
          callbacks.onEnd?.();
        }
      } else {
        callbacks.onEnd?.();
      }
    },
    abort: () => {
      if (isAborted) return;
      isAborted = true;
      isFinished = true;
      fallbackActive = false;
      cleanupNativeRecognition();
      cleanupFallbackHardware();
    },
  };
}
