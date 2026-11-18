/**
 * Touchless Gestures Hook for Courtside Kiosks
 * PSU SportsTrack - Multimodal Interaction Interface
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GestureType, GestureState, TouchlessActionMode } from '@/types/multimodal';
import { TouchlessGestureEngine, type GestureTelemetry } from '@/lib/touchlessGestureEngine';

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
    leftHandDetected: false,
    rightHandDetected: false,
    topZoneDetected: false,
    leftChargePercent: 0,
    rightChargePercent: 0,
    topChargePercent: 0,
  });

  const [touchlessMode, setTouchlessMode] = useState<TouchlessActionMode>('score');
  const [selectedPointValue, setSelectedPointValue] = useState<1 | 2 | 3>(2);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<TouchlessGestureEngine | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleTelemetry = useCallback((telemetry: GestureTelemetry) => {
    setState((prev) => ({
      ...prev,
      leftHandDetected: telemetry.leftHandDetected,
      rightHandDetected: telemetry.rightHandDetected,
      topZoneDetected: telemetry.topZoneDetected,
      leftChargePercent: telemetry.leftChargePercent,
      rightChargePercent: telemetry.rightChargePercent,
      topChargePercent: telemetry.topChargePercent,
    }));
  }, []);

  const handleGestureDetected = useCallback((gesture: GestureType, confidence: number) => {
    setState((prev) => ({
      ...prev,
      detectedGesture: gesture,
      confidence,
      lastTriggered: Date.now(),
      leftHandDetected: gesture === 'swipe_left' ? true : prev.leftHandDetected,
      rightHandDetected: gesture === 'swipe_right' ? true : prev.rightHandDetected,
      topZoneDetected: gesture === 'open_palm' ? true : prev.topZoneDetected,
      leftChargePercent: gesture === 'swipe_left' ? 100 : prev.leftChargePercent,
      rightChargePercent: gesture === 'swipe_right' ? 100 : prev.rightChargePercent,
      topChargePercent: gesture === 'open_palm' ? 100 : prev.topChargePercent,
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
      setState((prev) =>
        prev.detectedGesture === gesture
          ? {
              ...prev,
              detectedGesture: 'none',
              leftChargePercent: gesture === 'swipe_left' ? 0 : prev.leftChargePercent,
              rightChargePercent: gesture === 'swipe_right' ? 0 : prev.rightChargePercent,
              topChargePercent: gesture === 'open_palm' ? 0 : prev.topChargePercent,
              leftHandDetected: gesture === 'swipe_left' ? false : prev.leftHandDetected,
              rightHandDetected: gesture === 'swipe_right' ? false : prev.rightHandDetected,
              topZoneDetected: gesture === 'open_palm' ? false : prev.topZoneDetected,
            }
          : prev
      );
    }, 1500);
  }, []);

  /**
   * Binds a visible React <video> element to the live MediaStream and gesture engine
   */
  const bindVideoElement = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    videoRef.current = el;
    if (streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
    if (engineRef.current) {
      engineRef.current.attachVideo(el);
    }
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
      leftHandDetected: false,
      rightHandDetected: false,
      topZoneDetected: false,
      leftChargePercent: 0,
      rightChargePercent: 0,
      topChargePercent: 0,
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
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
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
        onTelemetry: handleTelemetry,
        dwellDurationMs: 1000,
        cooldownMs: 1100,
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
  }, [handleGestureDetected, handleTelemetry, stopCamera]);

  const recalibrateCamera = useCallback(() => {
    engineRef.current?.recalibrateBackground();
  }, []);

  const toggleCamera = useCallback(() => {
    if (state.isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [state.isCameraActive, startCamera, stopCamera]);

  const simulateGesture = useCallback(
    (gesture: GestureType) => {
      handleGestureDetected(gesture, 0.96);
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
    bindVideoElement,
    recalibrateCamera,
    startCamera,
    stopCamera,
    toggleCamera,
    simulateGesture,
    touchlessMode,
    setTouchlessMode,
    selectedPointValue,
    setSelectedPointValue,
  };
}
