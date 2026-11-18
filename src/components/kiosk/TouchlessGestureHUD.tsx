/**
 * Touchless Gesture HUD Component for Courtside Kiosks
 * PSU SportsTrack - Multimodal Interaction System (HCI Capstone)
 *
 * Displays live mirrored webcam feed with pixel-aligned 21-landmark hand
 * skeleton overlay, anatomical Left vs. Right Hand detection telemetry,
 * Live Armed vs. Sensor Test Lock (Dry-Run) safety toggle, and Referee Finger
 * Pose Guide using PSU SportsTrack's zero-emoji Nocturnal Slate + Solar Orange theme.
 */

import React, { useState } from 'react';
import {
  Camera,
  CameraOff,
  Hand,
  HelpCircle,
  Activity,
  RotateCcw,
  UserCheck,
  MinusCircle,
  ArrowLeftRight,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FlipHorizontal2,
  Flag,
  Cpu,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { useTouchlessGestures } from '@/hooks/useTouchlessGestures';
import { formatPoseLabel, describeHandAction } from '@/lib/handPoseClassifier';
import type { HandPoseName, HandSide, TrackedHandState } from '@/types/multimodal';

interface TouchlessGestureHUDProps {
  gestures: ReturnType<typeof useTouchlessGestures>;
  leftTeamName?: string;
  rightTeamName?: string;
  /** Legacy alias kept for compatibility; maps to leftTeamName if leftTeamName omitted */
  teamAName?: string;
  /** Legacy alias kept for compatibility; maps to rightTeamName if rightTeamName omitted */
  teamBName?: string;
  maxPoint?: number;
}

const SIM_POSES: {
  pose: HandPoseName;
  short: string;
  testId: string;
}[] = [
  { pose: 'one_finger', short: '1F (+1)', testId: 'btn-sim-1f' },
  { pose: 'two_fingers', short: '2F (+2)', testId: 'btn-sim-2f' },
  { pose: 'three_fingers', short: '3F (+3)', testId: 'btn-sim-3f' },
  { pose: 'four_fingers', short: '4F Player', testId: 'btn-sim-4f' },
  { pose: 'open_palm', short: 'Palm Clock', testId: 'btn-sim-palm' },
  { pose: 'closed_fist', short: 'Fist (-1)', testId: 'btn-sim-fist' },
  { pose: 'thumbs_up', short: 'Timeout', testId: 'btn-sim-thumbs' },
  { pose: 'shaka', short: 'Shaka Sub', testId: 'btn-sim-shaka' },
];

export const TouchlessGestureHUD: React.FC<TouchlessGestureHUDProps> = ({
  gestures,
  leftTeamName,
  rightTeamName,
  teamAName = 'Team A',
  teamBName = 'Team B',
  maxPoint = 3,
}) => {
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [simHandSide, setSimHandSide] = useState<HandSide>('left');

  const resolvedLeftTeam = leftTeamName ?? teamAName;
  const resolvedRightTeam = rightTeamName ?? teamBName;

  const {
    isCameraActive,
    modelStatus,
    detectedGesture,
    detectedHandSide,
    confidence,
    error,
    leftHand,
    rightHand,
    isArmed,
    toggleArmed,
    invertHandedness,
    toggleInvertHandedness,
    bindVideoElement,
    bindOverlayCanvas,
    recalibrateCamera,
    toggleCamera,
    simulateHandCommand,
  } = gestures;

  const modelStatusLabel =
    modelStatus === 'ready'
      ? '21-Joint Hand AI Ready'
      : modelStatus === 'loading'
        ? 'Loading 21-Joint Model...'
        : modelStatus === 'error'
          ? 'Model Init Error'
          : 'Sensor Standby';

  const getPoseIcon = (pose: string) => {
    switch (pose) {
      case 'open_palm':
        return <Clock className="size-4 text-emerald-400" />;
      case 'four_fingers':
        return <UserCheck className="size-4 text-sky-400" />;
      case 'closed_fist':
        return <MinusCircle className="size-4 text-rose-400" />;
      case 'thumbs_up':
        return <Flag className="size-4 text-amber-400" />;
      case 'shaka':
        return <ArrowLeftRight className="size-4 text-orange-400" />;
      case 'one_finger':
      case 'two_fingers':
      case 'three_fingers':
        return <Hand className="size-4 text-orange-400" />;
      default:
        return <Activity className="size-4 text-slate-400" />;
    }
  };

  const renderHandCard = (
    side: HandSide,
    hand: TrackedHandState,
    teamName: string
  ) => {
    const isLeft = side === 'left';
    const isLocked = hand.phase === 'locked_until_release';
    const accentBorder = hand.detected
      ? isLocked
        ? 'border-emerald-500/80 bg-emerald-500/10'
        : isLeft
          ? 'border-orange-500 bg-orange-500/10'
          : 'border-cyan-500 bg-cyan-500/10'
      : 'border-white/10 bg-slate-950';

    const dotClass = hand.detected
      ? isLocked
        ? 'bg-emerald-400'
        : isLeft
          ? 'bg-orange-400 animate-ping'
          : 'bg-cyan-400 animate-ping'
      : 'bg-slate-600';

    const barClass = isLocked
      ? 'bg-emerald-500'
      : isLeft
        ? 'bg-orange-500'
        : 'bg-cyan-500';

    const badgeText =
      hand.phase === 'locked_until_release'
        ? 'RELEASE TO REARM'
        : hand.pose !== 'none'
          ? `${formatPoseLabel(hand.pose).toUpperCase()} (${hand.fingerCount}F)`
          : hand.detected
            ? 'PALM DETECTED'
            : 'IDLE';

    return (
      <div
        data-testid={`indicator-${side}-hand`}
        className={`rounded-xl px-3 py-2 border transition-colors ${accentBorder}`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 truncate ${
              isLeft ? 'text-orange-400' : 'text-cyan-400'
            }`}
          >
            <span className={`size-2 rounded-full shrink-0 ${dotClass}`} />
            {isLeft ? 'Left Hand' : 'Right Hand'} ({teamName.slice(0, 12)})
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              data-testid={`${side}-pose-badge`}
              className="text-[9px] font-black uppercase px-1.5 py-0 h-5 border-white/15 bg-slate-900 text-slate-200"
            >
              {badgeText}
            </Badge>
            <span
              data-testid={`${side}-charge-percent`}
              className="text-[11px] font-mono font-black tabular-nums text-white w-9 text-right"
            >
              {hand.chargePercent}%
            </span>
          </div>
        </div>

        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
          <div
            className={`h-full transition-all duration-75 ${barClass}`}
            style={{ width: `${hand.chargePercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span className="truncate">{hand.actionLabel}</span>
          {hand.detected && (
            <span className="font-mono tabular-nums text-slate-500 ml-2 shrink-0">
              {Math.round(hand.score * 100)}% AI
            </span>
          )}
        </div>
      </div>
    );
  };

  const activePoseTeam =
    detectedHandSide === 'right' ? resolvedRightTeam : resolvedLeftTeam;

  return (
    <div
      data-testid="touchless-gesture-hud"
      className="bg-slate-950 border border-white/10 rounded-2xl p-3 text-white shadow-xl space-y-3"
    >
      {/* Top Control & Telemetry Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-2.5">
        {/* Camera + Safety Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
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
                <Camera className="size-4 text-orange-400" /> Enable Hand AI Camera
              </>
            )}
          </Button>

          {/* Live Armed vs Dry-Run Test Lock */}
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-toggle-touchless-armed"
            onClick={toggleArmed}
            className={`h-9 px-3 text-[11px] font-black uppercase tracking-wider gap-1.5 rounded-xl border transition-all active:scale-[0.98] ${
              isArmed
                ? 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/60'
            }`}
            title={
              isArmed
                ? 'Live Armed: Completed hand poses update the scoreboard & clock'
                : 'Test Lock (Dry-Run): Detects poses without mutating scoreboard'
            }
          >
            {isArmed ? (
              <>
                <ShieldCheck className="size-3.5" /> Live Armed
              </>
            ) : (
              <>
                <Lock className="size-3.5" /> Test Lock (Dry-Run)
              </>
            )}
          </Button>

          {/* Flip L/R Hardware Mirror Button */}
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-toggle-invert-handedness"
            onClick={toggleInvertHandedness}
            className={`h-9 px-2.5 text-[11px] font-bold uppercase tracking-wider gap-1.5 rounded-xl border transition-all ${
              invertHandedness
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/15'
            }`}
            title="Invert anatomical Left/Right hand mapping if using an unmirrored USB camera"
          >
            <FlipHorizontal2 className="size-3.5 text-orange-400" />
            <span>{invertHandedness ? 'L/R Inverted' : 'Flip L/R'}</span>
          </Button>

          {isCameraActive && (
            <Button
              size="sm"
              variant="outline"
              data-testid="btn-recalibrate-touchless"
              onClick={recalibrateCamera}
              className="h-9 px-2.5 text-[11px] font-bold uppercase tracking-wider gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/15"
              title="Reset hand dwell charge & lock timers"
            >
              <RotateCcw className="size-3.5 text-orange-400" />
              <span className="hidden md:inline">Reset Hold</span>
            </Button>
          )}

          {/* Model Readiness Pill */}
          <div
            data-testid="touchless-model-status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10"
          >
            <Cpu
              className={`size-3.5 ${
                modelStatus === 'ready'
                  ? 'text-emerald-400'
                  : modelStatus === 'loading'
                    ? 'text-orange-400 animate-spin'
                    : modelStatus === 'error'
                      ? 'text-rose-400'
                      : 'text-slate-500'
              }`}
            />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              {modelStatusLabel}
            </span>
          </div>
        </div>

        {/* Active Trigger Feedback Pill */}
        {detectedGesture !== 'none' && (
          <div
            data-testid="hud-detected-gesture-banner"
            className={`px-3 py-1.5 rounded-xl flex items-center gap-2 border ${
              isArmed
                ? 'bg-slate-900 border-orange-500/60'
                : 'bg-amber-950/60 border-amber-500/60'
            }`}
          >
            {getPoseIcon(detectedGesture)}
            <div>
              <span className="text-[11px] font-black text-orange-400 uppercase block leading-tight">
                {!isArmed ? '[DRY-RUN] ' : ''}
                {detectedHandSide ? `${detectedHandSide.toUpperCase()} HAND: ` : ''}
                {detectedGesture === 'open_palm' ||
                detectedGesture === 'one_finger' ||
                detectedGesture === 'two_fingers' ||
                detectedGesture === 'three_fingers' ||
                detectedGesture === 'four_fingers' ||
                detectedGesture === 'closed_fist' ||
                detectedGesture === 'thumbs_up' ||
                detectedGesture === 'shaka'
                  ? describeHandAction(detectedGesture, activePoseTeam, maxPoint)
                  : detectedGesture}
              </span>
              <span className="text-[10px] text-slate-300 font-mono tabular-nums">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Anatomical Left vs Right Hand Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {renderHandCard('left', leftHand, resolvedLeftTeam)}
        {renderHandCard('right', rightHand, resolvedRightTeam)}
      </div>

      {/* Live Camera Viewport + Pixel-Aligned 21-Joint Skeleton Canvas */}
      {isCameraActive && (
        <div
          data-testid="touchless-camera-viewport"
          className="relative w-full max-w-lg mx-auto aspect-[4/3] max-h-64 rounded-xl overflow-hidden border-2 border-white/15 bg-black shadow-2xl"
        >
          <video
            ref={bindVideoElement}
            autoPlay
            playsInline
            muted
            data-testid="touchless-camera-video"
            className="w-full h-full object-cover -scale-x-100"
          />
          <canvas
            ref={bindOverlayCanvas}
            data-testid="touchless-skeleton-canvas"
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Top Left Tracker Tag */}
          <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 bg-slate-950/85 border border-white/15 px-2.5 py-1 rounded-lg">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span
              data-testid="skeleton-lock-badge"
              className="text-[9px] font-black uppercase tracking-wider text-slate-200"
            >
              21-Joint Skeleton Lock
            </span>
          </div>

          {/* Top Right Safety Tag */}
          <div className="pointer-events-none absolute top-2 right-2 bg-slate-950/85 border border-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            {isArmed ? (
              <>
                <ShieldCheck className="size-3 text-emerald-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                  Live Scoring Armed
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="size-3 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                  Dry-Run Test Lock
                </span>
              </>
            )}
          </div>

          {/* Bottom Framing Hint */}
          <div className="pointer-events-none absolute bottom-2 inset-x-2 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wider">
            <span className="bg-slate-950/85 border border-orange-500/40 text-orange-300 px-2 py-0.5 rounded">
              Left Hand: {resolvedLeftTeam.slice(0, 12)}
            </span>
            <span className="bg-slate-950/85 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded">
              Right Hand: {resolvedRightTeam.slice(0, 12)}
            </span>
          </div>
        </div>
      )}

      {/* Simulator Bar + Help Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 border border-white/10 rounded-xl p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
            Simulate Hand:
          </span>

          <div className="inline-flex rounded-lg border border-white/15 bg-slate-950 p-0.5 mr-1">
            <button
              type="button"
              data-testid="btn-simulate-left-hand"
              onClick={() => setSimHandSide('left')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-colors ${
                simHandSide === 'left'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Left ({resolvedLeftTeam.slice(0, 8)})
            </button>
            <button
              type="button"
              data-testid="btn-simulate-right-hand"
              onClick={() => setSimHandSide('right')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-colors ${
                simHandSide === 'right'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Right ({resolvedRightTeam.slice(0, 8)})
            </button>
          </div>

          {SIM_POSES.map((item) => (
            <Button
              key={item.pose}
              size="sm"
              variant="outline"
              data-testid={item.testId}
              className="h-7 px-2 text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-200 border-white/15 rounded-lg active:scale-[0.98]"
              onClick={() => simulateHandCommand(simHandSide, item.pose)}
              title={`Simulate ${simHandSide} hand: ${describeHandAction(
                item.pose,
                simHandSide === 'left' ? resolvedLeftTeam : resolvedRightTeam,
                maxPoint
              )}`}
            >
              {item.short}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          variant="ghost"
          data-testid="btn-toggle-pose-guide"
          className="h-7 px-2 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 gap-1 rounded-lg"
          onClick={() => setShowCheatSheet(!showCheatSheet)}
        >
          <HelpCircle className="size-3.5 text-orange-400" />
          <span>{showCheatSheet ? 'Hide Pose Guide' : 'Pose Guide'}</span>
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          data-testid="touchless-error-banner"
          className="text-[11px] font-medium text-rose-300 bg-rose-950/50 border border-rose-500/40 rounded-lg px-3 py-2 flex items-center gap-2"
        >
          <ShieldAlert className="size-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Collapsible Referee Finger Pose Guide (Zero Emojis) */}
      {showCheatSheet && (
        <div
          data-testid="touchless-pose-guide"
          className="bg-slate-900 border border-white/10 rounded-xl p-3 space-y-2.5 text-[11px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
            <span className="font-black uppercase tracking-wider text-orange-400">
              Referee Finger Pose Vocabulary (Anatomical Left vs. Right Hand)
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              Hold steady for 850ms to fire, then lower hand to rearm
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-300">
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                1 Finger (Index Up)
              </p>
              <p className="text-slate-400 text-[10px]">+1 Point for hand&apos;s team</p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                2 Fingers (Peace / Index+Mid)
              </p>
              <p className="text-slate-400 text-[10px]">
                +{Math.min(2, maxPoint)} Pts for hand&apos;s team
              </p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                3 Fingers (Index+Mid+Ring)
              </p>
              <p className="text-slate-400 text-[10px]">
                +{Math.min(3, maxPoint)} Pts for hand&apos;s team
              </p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                4 Fingers (Thumb Tucked)
              </p>
              <p className="text-slate-400 text-[10px]">Cycle active player on team</p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                Open Palm (All 5 Extended)
              </p>
              <p className="text-slate-400 text-[10px]">Pause or Resume match clock</p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                Closed Fist (0 Fingers)
              </p>
              <p className="text-slate-400 text-[10px]">Deduct -1 Point correction</p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                Thumbs Up Only
              </p>
              <p className="text-slate-400 text-[10px]">Call Official Timeout</p>
            </div>
            <div className="bg-slate-950 border border-white/10 p-2 rounded-lg">
              <p className="font-black text-white uppercase text-[10px]">
                Shaka (Thumb + Pinky)
              </p>
              <p className="text-slate-400 text-[10px]">Open Substitution Drawer</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
