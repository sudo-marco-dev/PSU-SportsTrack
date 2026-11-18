/**
 * Touchless Gestures Hook for Courtside Kiosks
 * PSU SportsTrack - Multimodal Interaction Interface
 *
 * Manages webcam stream lifecycle, attaches the live <video> and 21-landmark
 * overlay <canvas> to the MediaPipe HandLandmarker engine, enforces Live Armed vs.
 * Sensor Test Lock (Dry-Run) gating, and syncs anatomical Left/Right hand telemetry.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  GestureType,
  GestureState,
  TouchlessActionMode,
  HandSide,
  HandPoseName,
  TouchlessModelStatus,
} from '@/types/multimodal';
import {
  TouchlessGestureEngine,
  createIdleTrackedHandState,
  type GestureTelemetry,
} from '@/lib/touchlessGestureEngine';

export interface UseTouchlessGesturesOptions {
  leftTeamLabel?: string;
  rightTeamLabel?: string;
  maxPoint?: number;
  onHandCommand?: (side: HandSide, pose: HandPoseName, confidence: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onOpenPalm?: () => void;
  onThumbsUp?: () => void;
  onPeaceSign?: () => void;
  autoStart?: boolean;
}

export function useTouchlessGestures(options: UseTouchlessGesturesOptions = {}) {
  const {
    leftTeamLabel = 'Team A',
    rightTeamLabel = 'Team B',
    maxPoint = 3,
    autoStart = false,
  } = options;

  const [isArmed, setIsArmed] = useState<boolean>(true);
  const [invertHandedness, setInvertHandedness] = useState<boolean>(false);
  const [touchlessMode, setTouchlessMode] = useState<TouchlessActionMode>('score');
  const [selectedPointValue, setSelectedPointValue] = useState<1 | 2 | 3>(2);

  const [state, setState] = useState<GestureState>(() => ({
    detectedGesture: 'none',
    detectedHandSide: undefined,
    confidence: 0,
    isCameraActive: false,
    lastTriggered: 0,
    motionVelocity: { x: 0, y: 0 },
    error: null,
    modelStatus: 'idle',
    isArmed: true,
    leftHand: createIdleTrackedHandState('Show Left Hand'),
    rightHand: createIdleTrackedHandState('Show Right Hand'),
    leftHandDetected: false,
    rightHandDetected: false,
    topZoneDetected: false,
    leftChargePercent: 0,
    rightChargePercent: 0,
    topChargePercent: 0,
  }));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<TouchlessGestureEngine | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isArmedRef = useRef(isArmed);
  isArmedRef.current = isArmed;

  const invertHandednessRef = useRef(invertHandedness);
  invertHandednessRef.current = invertHandedness;

  const leftTeamLabelRef = useRef(leftTeamLabel);
  leftTeamLabelRef.current = leftTeamLabel;

  const rightTeamLabelRef = useRef(rightTeamLabel);
  rightTeamLabelRef.current = rightTeamLabel;

  const maxPointRef = useRef(maxPoint);
  maxPointRef.current = maxPoint;

  const handleTelemetry = useCallback((telemetry: GestureTelemetry) => {
    setState((prev) => ({
      ...prev,
      leftHand: telemetry.leftHand,
      rightHand: telemetry.rightHand,
      leftHandDetected: telemetry.leftHand.detected,
      rightHandDetected: telemetry.rightHand.detected,
      leftChargePercent: telemetry.leftHand.chargePercent,
      rightChargePercent: telemetry.rightHand.chargePercent,
    }));
  }, []);

  const handleModelStatusChange = useCallback(
    (modelStatus: TouchlessModelStatus, errorMessage?: string | null) => {
      setState((prev) => ({
        ...prev,
        modelStatus,
        error: errorMessage ?? (modelStatus === 'error' ? prev.error : null),
      }));
    },
    []
  );

  const dispatchLegacyCallback = useCallback((side: HandSide, pose: HandPoseName) => {
    if (pose === 'open_palm') {
      optionsRef.current.onOpenPalm?.();
    } else if (pose === 'thumbs_up') {
      optionsRef.current.onThumbsUp?.();
    } else if (pose === 'shaka') {
      optionsRef.current.onPeaceSign?.();
    } else if (side === 'left') {
      optionsRef.current.onSwipeLeft?.();
    } else if (side === 'right') {
      optionsRef.current.onSwipeRight?.();
    }
  }, []);

  const handleHandCommand = useCallback(
    (side: HandSide, pose: HandPoseName, confidence: number) => {
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }

      setState((prev) => ({
        ...prev,
        detectedGesture: pose as GestureType,
        detectedHandSide: side,
        confidence,
        lastTriggered: Date.now(),
      }));

      // Only mutate live scoreboard/clock state when Sensor is Armed.
      if (isArmedRef.current) {
        if (optionsRef.current.onHandCommand) {
          optionsRef.current.onHandCommand(side, pose, confidence);
        } else {
          dispatchLegacyCallback(side, pose);
        }
      }

      bannerTimerRef.current = window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          detectedGesture: 'none',
          detectedHandSide: undefined,
        }));
      }, 1700);
    },
    [dispatchLegacyCallback]
  );

  const bindVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) {
      engineRef.current?.attachVideo(null);
      return;
    }
    if (streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
    engineRef.current?.attachVideo(el);
  }, []);

  const bindOverlayCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    engineRef.current?.attachOverlayCanvas(el);
  }, []);

  const stopCamera = useCallback(() => {
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }

    if (engineRef.current) {
      engineRef.current.dispose();
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
      modelStatus: 'idle',
      detectedGesture: 'none',
      detectedHandSide: undefined,
      leftHand: createIdleTrackedHandState('Show Left Hand'),
      rightHand: createIdleTrackedHandState('Show Right Hand'),
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
      setState((prev) => ({
        ...prev,
        error: 'Webcam API not supported in this browser environment.',
      }));
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
        onGesture: () => {},
        onHandCommand: handleHandCommand,
        onTelemetry: handleTelemetry,
        onModelStatusChange: handleModelStatusChange,
        dwellDurationMs: 850,
        releaseRequiredMs: 220,
        minDetectionConfidence: 0.7,
        invertHandedness: invertHandednessRef.current,
        leftTeamLabel: leftTeamLabelRef.current,
        rightTeamLabel: rightTeamLabelRef.current,
        maxPoint: maxPointRef.current,
      });

      engine.attachVideo(videoRef.current);
      if (canvasRef.current) {
        engine.attachOverlayCanvas(canvasRef.current);
      }
      engineRef.current = engine;

      setState((prev) => ({
        ...prev,
        isCameraActive: true,
        modelStatus: 'loading',
        error: null,
      }));

      await engine.start();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera error';
      setState((prev) => ({
        ...prev,
        isCameraActive: false,
        modelStatus: 'error',
        error: `Camera access denied or unavailable: ${message}`,
      }));
    }
  }, [handleHandCommand, handleModelStatusChange, handleTelemetry, stopCamera]);

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

  const toggleArmed = useCallback(() => {
    setIsArmed((prev) => {
      const next = !prev;
      setState((s) => ({ ...s, isArmed: next }));
      return next;
    });
  }, []);

  const toggleInvertHandedness = useCallback(() => {
    setInvertHandedness((prev) => {
      const next = !prev;
      engineRef.current?.setInvertHandedness(next);
      return next;
    });
  }, []);

  const simulateHandCommand = useCallback(
    (side: HandSide, pose: HandPoseName) => {
      handleHandCommand(side, pose, 0.98);
    },
    [handleHandCommand]
  );

  const simulateGesture = useCallback(
    (gesture: GestureType) => {
      switch (gesture) {
        case 'swipe_left':
          simulateHandCommand('left', 'two_fingers');
          break;
        case 'swipe_right':
          simulateHandCommand('right', 'two_fingers');
          break;
        case 'peace_sign':
          simulateHandCommand('left', 'shaka');
          break;
        case 'one_finger':
        case 'two_fingers':
        case 'three_fingers':
        case 'four_fingers':
        case 'open_palm':
        case 'closed_fist':
        case 'thumbs_up':
        case 'shaka':
          simulateHandCommand('left', gesture);
          break;
        default:
          break;
      }
    },
    [simulateHandCommand]
  );

  // Sync kiosk team names & sport maxPoint dynamically (handles swap sides / sport changes)
  useEffect(() => {
    engineRef.current?.updateLabels(leftTeamLabel, rightTeamLabel, maxPoint);
  }, [leftTeamLabel, rightTeamLabel, maxPoint]);

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
    isArmed,
    setIsArmed: (next: boolean) => {
      setIsArmed(next);
      setState((s) => ({ ...s, isArmed: next }));
    },
    toggleArmed,
    invertHandedness,
    toggleInvertHandedness,
    videoRef,
    bindVideoElement,
    bindOverlayCanvas,
    recalibrateCamera,
    startCamera,
    stopCamera,
    toggleCamera,
    simulateHandCommand,
    simulateGesture,
    touchlessMode,
    setTouchlessMode,
    selectedPointValue,
    setSelectedPointValue,
  };
}
