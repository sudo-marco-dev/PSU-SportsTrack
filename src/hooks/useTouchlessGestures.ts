/**
 * Touchless Gestures Hook for Courtside Kiosks
 * PSU SportsTrack - Multimodal Interaction Interface
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GestureType, GestureState } from '@/types/multimodal';
import { TouchlessGestureEngine } from '@/lib/touchlessGestureEngine';

interface UseTouchlessGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onOpenPalm?: () => void;
  onThumbsUp?: () => void;
  onPeaceSign?: () => void;
  autoStart?: boolean;
}

export function useTouchlessGestures(options: UseTouchlessGesturesOptions = {}) {
  const { autoStart = false } = options;

  const [state, setState] = useState<GestureState>({
    detectedGesture: 'none',
    confidence: 0,
    isCameraActive: false,
    lastTriggered: 0,
    motionVelocity: { x: 0, y: 0 },
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<TouchlessGestureEngine | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleGestureDetected = useCallback((gesture: GestureType, confidence: number) => {
    setState((prev) => ({
      ...prev,
      detectedGesture: gesture,
      confidence,
      lastTriggered: Date.now(),
    }));

    switch (gesture) {
      case 'swipe_left':
        optionsRef.current.onSwipeLeft?.();
        break;
      case 'swipe_right':
        optionsRef.current.onSwipeRight?.();
        break;
      case 'open_palm':
        optionsRef.current.onOpenPalm?.();
        break;
      case 'thumbs_up':
        optionsRef.current.onThumbsUp?.();
        break;
      case 'peace_sign':
        optionsRef.current.onPeaceSign?.();
        break;
      default:
        break;
    }

    // Reset visual gesture display after 1.5 seconds
    setTimeout(() => {
      setState((prev) => (prev.detectedGesture === gesture ? { ...prev, detectedGesture: 'none' } : prev));
    }, 1500);
  }, []);

  const stopCamera = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState((prev) => ({
      ...prev,
      isCameraActive: false,
      detectedGesture: 'none',
    }));
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({ ...prev, error: 'Webcam API not supported in this browser environment.' }));
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        videoRef.current = video;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const engine = new TouchlessGestureEngine({
        onGesture: handleGestureDetected,
      });

      engine.attachVideo(videoRef.current);
      engine.start();
      engineRef.current = engine;

      setState((prev) => ({ ...prev, isCameraActive: true, error: null }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isCameraActive: false,
        error: `Camera access denied or unavailable: ${err.message || 'Error'}`,
      }));
    }
  }, [handleGestureDetected, stopCamera]);

  const toggleCamera = useCallback(() => {
    if (state.isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [state.isCameraActive, startCamera, stopCamera]);

  const simulateGesture = useCallback(
    (gesture: GestureType) => {
      handleGestureDetected(gesture, 0.95);
    },
    [handleGestureDetected]
  );

  useEffect(() => {
    if (autoStart) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  return {
    ...state,
    videoRef,
    startCamera,
    stopCamera,
    toggleCamera,
    simulateGesture,
  };
}
