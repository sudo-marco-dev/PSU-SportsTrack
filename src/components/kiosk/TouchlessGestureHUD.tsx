/**
 * Touchless Gesture Radar HUD Component for Kiosks
 * PSU SportsTrack - Multimodal Interaction System (HCI Capstone)
 *
 * Displays live mirrored webcam feed with peripheral Left/Right Hand Zones,
 * Center Face Exclusion Mask, 0-100% dwell charge gauges, and Hands-Free
 * Action Mode selectors adhering strictly to PSU SportsTrack's zero-emoji
 * Nocturnal Slate + Solar Orange design specification.
 */

import React, { useState } from 'react';
import {
  Camera,
  CameraOff,
  Hand,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Activity,
  RotateCcw,
  UserCheck,
  MinusCircle,
  ArrowLeftRight,
  Clock,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { useTouchlessGestures } from '@/hooks/useTouchlessGestures';
import type { GestureType, TouchlessActionMode } from '@/types/multimodal';

interface TouchlessGestureHUDProps {
  gestures: ReturnType<typeof useTouchlessGestures>;
  teamAName?: string;
  teamBName?: string;
  onTabChange?: (direction: 'next' | 'prev') => void;
  onClockToggle?: () => void;
  onSubstitutionTrigger?: () => void;
}

export const TouchlessGestureHUD: React.FC<TouchlessGestureHUDProps> = ({
  gestures,
  teamAName = 'Team A',
  teamBName = 'Team B',
}) => {
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const {
    isCameraActive,
    detectedGesture,
    confidence,
    error,
    leftHandDetected = false,
    rightHandDetected = false,
    topZoneDetected = false,
    leftChargePercent = 0,
    rightChargePercent = 0,
    topChargePercent = 0,
    bindVideoElement,
    recalibrateCamera,
    toggleCamera,
    simulateGesture,
    touchlessMode,
    setTouchlessMode,
    selectedPointValue,
    setSelectedPointValue,
  } = gestures;

  const getGestureIcon = (g: GestureType) => {
    switch (g) {
      case 'open_palm':
        return <Clock className="size-5 text-emerald-400" />;
      case 'swipe_left':
        return <ArrowLeft className="size-5 text-orange-400" />;
      case 'swipe_right':
        return <ArrowRight className="size-5 text-cyan-400" />;
      case 'thumbs_up':
        return <Hand className="size-5 text-emerald-400" />;
      case 'peace_sign':
        return <ArrowLeftRight className="size-5 text-orange-400" />;
      default:
        return <Activity className="size-4 text-slate-400" />;
    }
  };

  const getGestureLabel = (g: GestureType) => {
    switch (g) {
      case 'open_palm':
        return 'Top Clock Zone (Pause / Resume)';
      case 'swipe_left':
        return `Left Hand Zone (${teamAName})`;
      case 'swipe_right':
        return `Right Hand Zone (${teamBName})`;
      case 'thumbs_up':
        return `Confirmed Action (${teamAName})`;
      case 'peace_sign':
        return 'Substitution Drawer Triggered';
      default:
        return 'No Gesture Active';
    }
  };

  const modes: { id: TouchlessActionMode; label: string; icon: React.ReactNode }[] = [
    { id: 'score', label: 'Score', icon: <Hand className="size-3.5" /> },
    { id: 'select_player', label: 'Pick Player', icon: <UserCheck className="size-3.5" /> },
    { id: 'deduct', label: 'Deduct', icon: <MinusCircle className="size-3.5" /> },
    { id: 'sub_foul', label: 'Sub / Foul', icon: <ArrowLeftRight className="size-3.5" /> },
  ];

  return (
    <div
      data-testid="touchless-gesture-hud"
      className="bg-slate-950 border border-white/10 rounded-2xl p-3 text-white shadow-xl space-y-3"
    >
      {/* Top Control & Telemetry Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Camera Toggle + Radar Indicator */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              data-testid="btn-toggle-touchless-camera"
              variant="outline"
              onClick={toggleCamera}
              className={`h-9 px-3.5 text-xs font-black uppercase tracking-wider gap-2 rounded-xl transition-all border active:scale-[0.98] ${
                isCameraActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/15'
              }`}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="size-4" /> Stop Sensor
                </>
              ) : (
                <>
                  <Camera className="size-4 text-orange-400" /> Enable Camera Sensor
                </>
              )}
            </Button>

            {isCameraActive && (
              <Button
                size="sm"
                variant="outline"
                data-testid="btn-recalibrate-touchless"
                onClick={recalibrateCamera}
                className="h-9 px-2.5 text-[11px] font-bold uppercase tracking-wider gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/15"
                title="Re-capture clean room background"
              >
                <RotateCcw className="size-3.5 text-orange-400" />
                <span className="hidden md:inline">Zero BG</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              {isCameraActive && (
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full size-2 ${
                  isCameraActive ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              {isCameraActive ? 'Optical Radar Live' : 'Sensor Standby'}
            </span>
          </div>
        </div>

        {/* Active Trigger Feedback Pill */}
        {detectedGesture !== 'none' && (
          <div
            data-testid="hud-detected-gesture-banner"
            className="bg-slate-900 border border-orange-500/50 px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in zoom-in-95"
          >
            {getGestureIcon(detectedGesture)}
            <div>
              <span className="text-[11px] font-black text-orange-400 uppercase block leading-tight">
                {getGestureLabel(detectedGesture)}
              </span>
              <span className="text-[10px] text-slate-300 font-mono tabular-nums">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Quick Simulator Fallback Buttons (Zero Emojis) */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1 hidden lg:inline">
            Simulate:
          </span>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-simulate-left-hand"
            className="h-8 px-2.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-orange-400 border-white/15 gap-1 rounded-lg"
            onClick={() => simulateGesture('swipe_left')}
            title={`Trigger Left Hand Zone (${teamAName})`}
          >
            <ArrowLeft className="size-3.5" /> Left
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-simulate-right-hand"
            className="h-8 px-2.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-cyan-400 border-white/15 gap-1 rounded-lg"
            onClick={() => simulateGesture('swipe_right')}
            title={`Trigger Right Hand Zone (${teamBName})`}
          >
            Right <ArrowRight className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-simulate-open-palm"
            className="h-8 px-2.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-emerald-400 border-white/15 gap-1 rounded-lg"
            onClick={() => simulateGesture('open_palm')}
            title="Trigger Clock Pause / Resume"
          >
            <Clock className="size-3.5" /> Clock
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-simulate-peace-sub"
            className="h-8 px-2.5 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/15 gap-1 rounded-lg"
            onClick={() => simulateGesture('peace_sign')}
            title="Trigger Substitution Drawer"
          >
            <ArrowLeftRight className="size-3.5 text-orange-400" /> Sub
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            title="Touchless Zone Guide"
          >
            <HelpCircle className="size-4" />
          </Button>
        </div>
      </div>

      {/* Hands-Free Mode Selector + Live Left/Right Hand Detection Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center bg-slate-900/70 border border-white/10 rounded-xl p-2.5">
        {/* Hands-Free Mode & Point Picker */}
        <div className="lg:col-span-5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
            <SlidersHorizontal className="size-3 text-orange-500" /> Mode:
          </span>
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              data-testid={`touchless-mode-${m.id}`}
              onClick={() => setTouchlessMode(m.id)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all border active:scale-95 ${
                touchlessMode === m.id
                  ? 'bg-orange-500 text-slate-950 border-orange-400 font-black'
                  : 'bg-slate-950 text-slate-300 border-white/10 hover:border-white/25'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}

          {touchlessMode === 'score' && (
            <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-white/10">
              {([1, 2, 3] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  data-testid={`touchless-pts-${pt}`}
                  onClick={() => setSelectedPointValue(pt)}
                  className={`h-7 w-8 rounded-lg text-[11px] font-black tabular-nums border transition-all ${
                    selectedPointValue === pt
                      ? 'bg-white text-slate-950 border-white'
                      : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  +{pt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Left & Right Hand Zone Detection + Percentage Gauges */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Left Hand Gauge (Team A) */}
          <div
            data-testid="indicator-left-hand"
            className={`rounded-lg px-2.5 py-1.5 border transition-colors ${
              leftHandDetected
                ? 'bg-orange-500/15 border-orange-500'
                : 'bg-slate-950 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5 text-orange-400 truncate">
                <span
                  className={`size-2 rounded-full shrink-0 ${
                    leftHandDetected ? 'bg-orange-400 animate-ping' : 'bg-slate-600'
                  }`}
                />
                Left Hand ({teamAName.slice(0, 10)}): {leftHandDetected ? 'DETECTED' : 'IDLE'}
              </span>
              <span
                data-testid="left-charge-percent"
                className="font-mono tabular-nums text-white shrink-0 ml-1"
              >
                {leftChargePercent}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-75"
                style={{ width: `${leftChargePercent}%` }}
              />
            </div>
          </div>

          {/* Right Hand Gauge (Team B) */}
          <div
            data-testid="indicator-right-hand"
            className={`rounded-lg px-2.5 py-1.5 border transition-colors ${
              rightHandDetected
                ? 'bg-cyan-500/15 border-cyan-500'
                : 'bg-slate-950 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400 truncate">
                <span
                  className={`size-2 rounded-full shrink-0 ${
                    rightHandDetected ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
                  }`}
                />
                Right Hand ({teamBName.slice(0, 10)}): {rightHandDetected ? 'DETECTED' : 'IDLE'}
              </span>
              <span
                data-testid="right-charge-percent"
                className="font-mono tabular-nums text-white shrink-0 ml-1"
              >
                {rightChargePercent}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-75"
                style={{ width: `${rightChargePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Camera Viewport with Spatial Target Zones & Face Exclusion Mask */}
      {isCameraActive && (
        <div
          data-testid="touchless-camera-viewport"
          className="relative w-full max-w-md mx-auto aspect-[4/3] max-h-52 rounded-xl overflow-hidden border-2 border-white/15 bg-black shadow-2xl"
        >
          <video
            ref={bindVideoElement}
            autoPlay
            playsInline
            muted
            data-testid="touchless-camera-video"
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Overlay 1: Left Hand Target Zone (0% - 28% width, 12% - 88% height) */}
          <div
            className={`absolute left-1.5 top-[12%] bottom-[12%] w-[26%] rounded-lg border-2 flex flex-col justify-between p-1.5 pointer-events-none transition-colors ${
              leftHandDetected
                ? 'border-orange-400 bg-orange-500/20'
                : 'border-orange-500/50 bg-slate-950/35'
            }`}
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-orange-300 leading-tight">
              Left Hand
            </span>
            <span className="text-xs font-black font-mono tabular-nums text-white">
              {leftChargePercent}%
            </span>
          </div>

          {/* Overlay 2: Top Center Clock Zone (30% - 70% width, 0% - 22% height) */}
          <div
            className={`absolute left-[30%] right-[30%] top-1 h-[20%] rounded-lg border flex items-center justify-between px-2 pointer-events-none transition-colors ${
              topZoneDetected
                ? 'border-emerald-400 bg-emerald-500/25'
                : 'border-emerald-500/40 bg-slate-950/45'
            }`}
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              <Clock className="size-2.5" /> Clock
            </span>
            <span className="text-[10px] font-black font-mono tabular-nums text-white">
              {topChargePercent}%
            </span>
          </div>

          {/* Overlay 3: Center Face Exclusion Mask (28% - 72% width, 24% - 96% height) */}
          <div
            data-testid="face-exclusion-overlay"
            className="absolute left-[29%] right-[29%] top-[24%] bottom-1.5 rounded-lg border border-dashed border-white/25 bg-slate-950/15 flex items-end justify-center pb-1.5 pointer-events-none"
          >
            <Badge className="bg-slate-950/85 text-slate-300 border-white/15 text-[8px] font-bold uppercase tracking-wider gap-1">
              <ShieldCheck className="size-2.5 text-emerald-400" /> Face Zone Ignored
            </Badge>
          </div>

          {/* Overlay 4: Right Hand Target Zone (72% - 100% width, 12% - 88% height) */}
          <div
            className={`absolute right-1.5 top-[12%] bottom-[12%] w-[26%] rounded-lg border-2 flex flex-col justify-between p-1.5 text-right pointer-events-none transition-colors ${
              rightHandDetected
                ? 'border-cyan-400 bg-cyan-500/20'
                : 'border-cyan-500/50 bg-slate-950/35'
            }`}
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300 leading-tight">
              Right Hand
            </span>
            <span className="text-xs font-black font-mono tabular-nums text-white">
              {rightChargePercent}%
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[11px] text-rose-400 font-mono bg-rose-500/10 p-2 rounded-lg border border-rose-500/30">
          {error}
        </div>
      )}

      {/* Collapsible Zone Gesture Guide (Zero Emojis) */}
      {showCheatSheet && (
        <div className="pt-2.5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] animate-in fade-in">
          <div className="bg-slate-900 p-2.5 rounded-xl border border-orange-500/20">
            <span className="font-black text-orange-400 flex items-center gap-1.5 uppercase">
              <ArrowLeft className="size-3.5" /> Hold Left Zone
            </span>
            <span className="text-slate-400 block mt-0.5">
              Hold hand on left side until 100% to trigger Team A action ({touchlessMode}).
            </span>
          </div>
          <div className="bg-slate-900 p-2.5 rounded-xl border border-cyan-500/20">
            <span className="font-black text-cyan-400 flex items-center gap-1.5 uppercase">
              <ArrowRight className="size-3.5" /> Hold Right Zone
            </span>
            <span className="text-slate-400 block mt-0.5">
              Hold hand on right side until 100% to trigger Team B action ({touchlessMode}).
            </span>
          </div>
          <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-500/20">
            <span className="font-black text-emerald-400 flex items-center gap-1.5 uppercase">
              <Clock className="size-3.5" /> Hold Top Zone
            </span>
            <span className="text-slate-400 block mt-0.5">
              Raise hand above head to 100% to pause or resume match clock.
            </span>
          </div>
          <div className="bg-slate-900 p-2.5 rounded-xl border border-white/10">
            <span className="font-black text-slate-200 flex items-center gap-1.5 uppercase">
              <ShieldCheck className="size-3.5 text-emerald-400" /> Center Mask
            </span>
            <span className="text-slate-400 block mt-0.5">
              Your face and center torso are ignored so natural movement does not false-trigger.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
