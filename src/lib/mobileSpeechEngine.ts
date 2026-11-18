/**
 * Universal Mobile & Desktop Speech Recognition Engine for PSU SportsTrack
 *
 * Solves the Android Chrome Mobile `webkitSpeechRecognition` instant-abort (`ERROR_CLIENT` /
 * `error: "aborted"`), silent hang, and premature `onend` hardware bugs:
 *
 * - Stage 1 (Native Web Speech API): Invokes `SpeechRecognition.start()` synchronously on tap.
 *   Deduplicates Android Chrome's cumulative `event.results` array and flushes uncommitted
 *   interim transcripts on `onend`. Includes a 1,200ms mobile watchdog if the OS recognizer
 *   hangs silently without emitting speech results.
 * - Stage 2 (Automatic Hardware Mic + On-Device Whisper Fallback): When Android Chrome's native
 *   `SpeechRecognizer` intent aborts, hangs, or terminates with zero transcript, the engine
 *   DOES NOT flip `isListening` back to `false` (preventing card glitching and state reversion).
 *   Instead, it seamlessly opens the microphone via `navigator.mediaDevices.getUserMedia` (with
 *   automatic retry if the OS audio binder is still releasing), tracks real-time voice activity
 *   (VAD) via a tap-unlocked Web Audio `AudioContext` + `MediaRecorder` backup, and transcribes
 *   16kHz PCM audio in-browser using `@xenova/transformers` (`Xenova/whisper-tiny.en`).
 */

import { suspendAudioContextForMic } from './audioFx';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
  __psuMockAudioTranscriber?: (pcm16k: Float32Array) => Promise<string>;
}

const NATIVE_ABORT_STORAGE_KEY = 'psu_native_speech_aborted';

export const IS_MOBILE_BROWSER =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 &&
      typeof window !== 'undefined' &&
      window.innerWidth <= 1024));

// Session-sticky flag: once native SpeechRecognition aborts or hangs on a mobile device,
// subsequent taps bypass the broken Android SpeechRecognizer intent and go straight to Stage 2.
let nativeSpeechAbortedOnDevice = (() => {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(NATIVE_ABORT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
})();

function markNativeSpeechAbortedOnDevice(): void {
  nativeSpeechAbortedOnDevice = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(NATIVE_ABORT_STORAGE_KEY, '1');
    }
  } catch {
    // ignore storage restrictions
  }
}

// Singleton cached Whisper pipeline promise + live progress listener set
let whisperPipelinePromise: Promise<any> | null = null;
const whisperProgressListeners = new Set<(statusText: string) => void>();
let lastWhisperProgressText: string | null = null;

// Shared recording AudioContext unlocked synchronously on user tap
let sharedRecordingAudioCtx: AudioContext | null = null;

/**
 * Unlocks or resumes a Web Audio context synchronously inside the user's tap gesture
 * so mobile browsers (Chrome Android / iOS Safari) never leave the context suspended
 * when Stage 2 microphone capture attaches asynchronously.
 */
function unlockRecordingAudioContextOnTap(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    if (!sharedRecordingAudioCtx || sharedRecordingAudioCtx.state === 'closed') {
      sharedRecordingAudioCtx = new AudioCtx();
    }
    if (sharedRecordingAudioCtx.state === 'suspended') {
      void sharedRecordingAudioCtx.resume().catch(() => {});
    }
    return sharedRecordingAudioCtx;
  } catch {
    return null;
  }
}

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
 * Supports attaching progress listeners even if preloading was already started earlier.
 */
export function preloadMobileWhisperModel(
  onProgress?: (statusText: string) => void
): Promise<any> {
  if (typeof window !== 'undefined' && (window as unknown as IWindow).__psuMockAudioTranscriber) {
    return Promise.resolve((window as unknown as IWindow).__psuMockAudioTranscriber);
  }

  if (onProgress) {
    whisperProgressListeners.add(onProgress);
    if (lastWhisperProgressText) {
      onProgress(lastWhisperProgressText);
    }
  }

  if (!whisperPipelinePromise) {
    whisperPipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        // Crucial for Vite/Vercel SPAs: prevent fetching `/models/...` from local SPA rewrite
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        // Prevent cross-origin Worker SecurityError from jsDelivr CDN on production HTTPS origins
        if (env.backends?.onnx?.wasm) {
          env.backends.onnx.wasm.numThreads = 1;
          env.backends.onnx.wasm.proxy = false;
        }

        const loadedPipeline = await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-tiny.en',
          {
            quantized: true,
            progress_callback: (prog: any) => {
              if (prog?.status === 'progress' && typeof prog?.progress === 'number') {
                const text = `Preparing voice engine (${Math.round(prog.progress)}%)...`;
                lastWhisperProgressText = text;
                whisperProgressListeners.forEach((listener) => {
                  try {
                    listener(text);
                  } catch {
                    // ignore listener error
                  }
                });
              }
            },
          }
        );

        lastWhisperProgressText = null;
        return loadedPipeline;
      } catch (err) {
        whisperPipelinePromise = null;
        lastWhisperProgressText = null;
        throw err;
      }
    })();
  }

  if (!onProgress) {
    return whisperPipelinePromise;
  }

  return whisperPipelinePromise.finally(() => {
    whisperProgressListeners.delete(onProgress);
  });
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

/**
 * Acquires hardware microphone stream with automatic backoff retry when Android's
 * SpeechRecognizer binder is still releasing audio hardware (`NotReadableError`).
 */
async function acquireMicrophoneStreamWithRetry(isCancelled: () => boolean): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    },
    { audio: true },
    { audio: true },
  ];
  const retryDelaysMs = [160, 340];

  let lastErr: any = null;
  for (let i = 0; i < attempts.length; i++) {
    if (isCancelled()) {
      throw new Error('Cancelled');
    }
    try {
      return await navigator.mediaDevices.getUserMedia(attempts[i]);
    } catch (err: any) {
      lastErr = err;
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError' ||
        /denied|permission/i.test(err?.message || '');
      if (isPermissionDenied || i === attempts.length - 1) {
        throw err;
      }
      const delay = retryDelaysMs[i] || 200;
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
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
 * - If native `SpeechRecognition` is unsupported, aborts (`error: "aborted"`), hangs (>1200ms on mobile
 *   with 0 results), or ends with 0 words, seamlessly transitions to `getUserMedia` + Web Audio VAD +
 *   on-device Whisper STT WITHOUT dropping `isListening`.
 */
export function startHybridSpeechSession(callbacks: HybridSpeechCallbacks): HybridSpeechSession {
  const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
  const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

  let isAborted = false;
  let isFinished = false;
  let isTranscribing = false;
  let finalDelivered = false;
  let recognition: any = null;
  let nativeWatchdogTimer: number | null = null;
  let nativeStopFallbackTimer: number | null = null;

  // Fallback Web Audio + MediaRecorder recording state
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  const mediaBlobChunks: BlobPart[] = [];
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;
  let muteGainNode: GainNode | null = null;
  let maxDurationTimer: number | null = null;
  const pcmChunks: Float32Array[] = [];
  let recordedSampleRate = 16000;
  let fallbackActive = false;

  suspendAudioContextForMic();
  // Unlock Web Audio context synchronously inside the user tap gesture
  const unlockedAudioCtx = unlockRecordingAudioContextOnTap();

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

  const clearNativeTimers = () => {
    if (nativeWatchdogTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(nativeWatchdogTimer);
      nativeWatchdogTimer = null;
    }
    if (nativeStopFallbackTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(nativeStopFallbackTimer);
      nativeStopFallbackTimer = null;
    }
  };

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
    if (muteGainNode) {
      try {
        muteGainNode.disconnect();
      } catch {
        // ignore
      }
      muteGainNode = null;
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
  };

  const cleanupNativeRecognition = (useAbort = true) => {
    clearNativeTimers();
    if (recognition) {
      const ref = recognition;
      recognition = null;
      ref.onstart = null;
      ref.onresult = null;
      ref.onerror = null;
      ref.onend = null;
      try {
        if (useAbort && typeof ref.abort === 'function') {
          ref.abort();
        } else {
          ref.stop?.();
        }
      } catch {
        // ignore
      }
    }
  };

  const finalizeFallbackTranscription = async () => {
    if (isAborted || finalDelivered || isTranscribing) return;
    isTranscribing = true;
    isFinished = true;
    fallbackActive = false;

    // Stop MediaRecorder cleanly first so any buffered blob chunks flush before hardware teardown
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!mediaRecorder) {
          resolve();
          return;
        }
        const safetyTimer = setTimeout(resolve, 300);
        mediaRecorder.onstop = () => {
          clearTimeout(safetyTimer);
          resolve();
        };
        try {
          mediaRecorder.stop();
        } catch {
          clearTimeout(safetyTimer);
          resolve();
        }
      });
    }

    cleanupFallbackHardware();

    let { pcm16k, maxRms } = preparePcm16kForWhisper(pcmChunks, recordedSampleRate);
    pcmChunks.length = 0;

    // If ScriptProcessorNode captured 0 or silent frames, decode MediaRecorder blob as backup
    if (
      (pcm16k.length < 600 || maxRms < 0.007) &&
      mediaBlobChunks.length > 0 &&
      typeof window !== 'undefined'
    ) {
      try {
        const blob = new Blob(mediaBlobChunks);
        const arrayBuf = await blob.arrayBuffer();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const decodeCtx = unlockedAudioCtx && unlockedAudioCtx.state !== 'closed'
          ? unlockedAudioCtx
          : new AudioCtx();
        const decoded = await decodeCtx.decodeAudioData(arrayBuf);
        const backupChunks = [new Float32Array(decoded.getChannelData(0))];
        const backupPrepared = preparePcm16kForWhisper(backupChunks, decoded.sampleRate || 16000);
        if (backupPrepared.pcm16k.length > pcm16k.length || backupPrepared.maxRms > maxRms) {
          pcm16k = backupPrepared.pcm16k;
          maxRms = backupPrepared.maxRms;
        }
      } catch {
        // ignore decode error
      }
    }
    mediaBlobChunks.length = 0;

    const customMock =
      typeof window !== 'undefined'
        ? (window as unknown as IWindow).__psuMockAudioTranscriber
        : undefined;

    if (!customMock && (pcm16k.length < 600 || maxRms < 0.007)) {
      isTranscribing = false;
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
        let transcriber: any;
        try {
          transcriber = await preloadMobileWhisperModel((progText) => {
            if (!isAborted) callbacks.onInterim?.(progText);
          });
        } catch {
          // Retry model load once in case of transient mobile network hiccup
          transcriber = await preloadMobileWhisperModel((progText) => {
            if (!isAborted) callbacks.onInterim?.(progText);
          });
        }
        if (isAborted) return;
        callbacks.onInterim?.('Processing spoken command...');
        const output = await transcriber(pcm16k, {
          max_new_tokens: 40,
          return_timestamps: false,
        });
        rawText = typeof output === 'string' ? output : output?.text || '';
      }

      isTranscribing = false;
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
      isTranscribing = false;
      if (!isAborted) {
        callbacks.onError?.(
          `Voice processing unavailable (${err?.message || 'error'}). Try typing below.`
        );
        callbacks.onEnd?.();
      }
    }
  };

  const startFallbackAudioCapture = async () => {
    if (isAborted || finalDelivered || fallbackActive || isTranscribing) return;
    fallbackActive = true;
    cleanupNativeRecognition(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      fallbackActive = false;
      callbacks.onError?.(
        'Microphone access is not available in this browser. Please use HTTPS or type below.'
      );
      callbacks.onEnd?.();
      return;
    }

    // Start warming up the on-device Whisper model in parallel while the user speaks
    void preloadMobileWhisperModel().catch(() => {});

    try {
      const stream = await acquireMicrophoneStreamWithRetry(() => isAborted);

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
      const ctx =
        unlockedAudioCtx && unlockedAudioCtx.state !== 'closed'
          ? unlockedAudioCtx
          : new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      recordedSampleRate = ctx.sampleRate || 16000;

      const source = ctx.createMediaStreamSource(stream);
      sourceNode = source;

      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorNode = processor;

      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      muteGainNode = silentGain;

      let activeVoiceFrames = 0;
      let silenceMsAfterSpeech = 0;
      let totalElapsedMs = 0;
      let notifiedVoiceDetected = false;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isAborted || !fallbackActive || isTranscribing) return;
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
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      maxDurationTimer = window.setTimeout(() => {
        if (fallbackActive && !isAborted && !isTranscribing) {
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

  // If native SpeechRecognition is missing OR already known to abort/hang on this mobile device,
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
        if (isAborted || fallbackActive) return;
        callbacks.onStart?.();
      };

      recognition.onresult = (event: any) => {
        if (isAborted || fallbackActive) return;
        clearNativeTimers();
        const { interim, final } = extractCleanSpeechTranscript(event);
        const combined = final || interim;

        if (combined) {
          latestInterim = combined;
          callbacks.onInterim?.(combined);
        }

        if (final && !finalDelivered) {
          finalDelivered = true;
          latestInterim = '';
          cleanupNativeRecognition(false);
          callbacks.onFinal(final);
          callbacks.onEnd?.();
        }
      };

      recognition.onerror = (event: any) => {
        if (isAborted || fallbackActive || isTranscribing) return;
        clearNativeTimers();
        const errCode = event?.error || 'unknown';

        // If speech was already captured before mobile fired 'aborted'/'no-speech', flush it in onend
        if (latestInterim.trim().length > 0) {
          return;
        }

        // On mobile (or when native SpeechRecognition throws 'aborted', 'service-not-allowed',
        // 'not-allowed', 'audio-capture', 'network', or mobile 'no-speech'), seamlessly hand off
        // to Stage 2 hardware microphone capture WITHOUT dropping out of listening state!
        if (
          IS_MOBILE_BROWSER ||
          errCode === 'aborted' ||
          errCode === 'service-not-allowed' ||
          errCode === 'not-allowed' ||
          errCode === 'audio-capture' ||
          errCode === 'network'
        ) {
          if (IS_MOBILE_BROWSER || errCode === 'aborted' || errCode === 'service-not-allowed') {
            markNativeSpeechAbortedOnDevice();
          }
          void startFallbackAudioCapture();
          return;
        }

        cleanupNativeRecognition(true);
        if (errCode === 'no-speech') {
          callbacks.onError?.('No speech heard. Tap the voice button and speak right away.');
        } else {
          callbacks.onError?.(
            `Voice recognition notice (${errCode}). Try speaking again or type below.`
          );
        }
        callbacks.onEnd?.();
      };

      recognition.onend = () => {
        if (isAborted || fallbackActive || isTranscribing || finalDelivered) return;
        clearNativeTimers();
        cleanupNativeRecognition(false);

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
        // Android Chrome often fires `onstart` followed by `onend` with 0 results
        // WITHOUT firing `onerror` when the OS SpeechRecognizer binder fails.
        // Detect this premature termination and seamlessly hand off to Stage 2 `getUserMedia`!
        const elapsedMs = Date.now() - startedAt;
        if (IS_MOBILE_BROWSER || elapsedMs < 2200) {
          if (IS_MOBILE_BROWSER) {
            markNativeSpeechAbortedOnDevice();
          }
          void startFallbackAudioCapture();
          return;
        }

        callbacks.onEnd?.();
      };

      // Mobile Native Watchdog: if Android Chrome's SpeechRecognizer hangs silently for 1,200ms
      // with zero results, seamlessly switch to Stage 2 hardware microphone capture!
      if (IS_MOBILE_BROWSER && typeof window !== 'undefined') {
        nativeWatchdogTimer = window.setTimeout(() => {
          nativeWatchdogTimer = null;
          if (
            !isAborted &&
            !isFinished &&
            !fallbackActive &&
            !isTranscribing &&
            !finalDelivered &&
            latestInterim.trim().length === 0
          ) {
            markNativeSpeechAbortedOnDevice();
            void startFallbackAudioCapture();
          }
        }, 1200);
      }

      // Invoke .start() 100% synchronously on the user tap call stack
      recognition.start();
      callbacks.onStart?.();
    } catch {
      if (IS_MOBILE_BROWSER) {
        markNativeSpeechAbortedOnDevice();
      }
      void startFallbackAudioCapture();
    }
  }

  return {
    finishAndTranscribe: () => {
      if (isAborted) return;
      // If Whisper transcription is already in progress, let it finish rather than aborting it!
      if (isTranscribing) {
        callbacks.onInterim?.('Transcribing your voice...');
        return;
      }
      if (isFinished) {
        isAborted = true;
        fallbackActive = false;
        cleanupNativeRecognition(true);
        cleanupFallbackHardware();
        callbacks.onEnd?.();
        return;
      }
      isFinished = true;
      clearNativeTimers();
      if (fallbackActive) {
        void finalizeFallbackTranscription();
      } else if (recognition) {
        try {
          recognition.stop?.();
          if (typeof window !== 'undefined') {
            nativeStopFallbackTimer = window.setTimeout(() => {
              nativeStopFallbackTimer = null;
              if (!isAborted && !finalDelivered && !fallbackActive && !isTranscribing) {
                cleanupNativeRecognition(true);
                callbacks.onEnd?.();
              }
            }, 450);
          }
        } catch {
          cleanupNativeRecognition(true);
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
      isTranscribing = false;
      fallbackActive = false;
      cleanupNativeRecognition(true);
      cleanupFallbackHardware();
    },
  };
}
