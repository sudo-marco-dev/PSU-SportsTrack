/**
 * Touchless Gesture Recognition Engine for PSU SportsTrack
 * Spatial-zone optical hand detector with center face-exclusion mask and
 * dwell-charge percentages (0% - 100%) using HTML5 Canvas.
 * Complies with Capstone HCI-2 Touchless Interface requirements.
 */

import type { GestureType } from '@/types/multimodal';

export interface GestureTelemetry {
  leftHandDetected: boolean;
  rightHandDetected: boolean;
  topZoneDetected: boolean;
  leftChargePercent: number;
  rightChargePercent: number;
  topChargePercent: number;
}

export interface GestureDetectionOptions {
  onGesture: (gesture: GestureType, confidence: number) => void;
  onTelemetry?: (telemetry: GestureTelemetry) => void;
  minMotionThreshold?: number; // Minimum luminance delta against background (default 22)
  swipeVelocityThreshold?: number; // Legacy option kept for config compatibility
  holdDurationMs?: number; // Legacy hold duration alias
  dwellDurationMs?: number; // Sustained presence time to charge 0% -> 100% (default 1000ms)
  cooldownMs?: number; // Milliseconds between gesture triggers (default 1100ms)
}

export interface ZoneEvaluationResult {
  leftActiveRatio: number;
  rightActiveRatio: number;
  topActiveRatio: number;
  faceIgnoredCount: number;
}

/**
 * Evaluates spatial zones on an RGBA frame buffer, explicitly masking out the center face region.
 * Pure helper exported for deterministic unit testing and frame loop reuse.
 */
export function evaluateSpatialZones(
  currData: Uint8ClampedArray,
  bgData: Uint8ClampedArray,
  prevData: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): ZoneEvaluationResult {
  const leftMaxX = Math.floor(width * 0.28);
  const rightMinX = Math.ceil(width * 0.72);
  const sideMinY = Math.floor(height * 0.12);
  const sideMaxY = Math.ceil(height * 0.88);
  const topMaxY = Math.floor(height * 0.22);
  const topMinX = Math.floor(width * 0.30);
  const topMaxX = Math.ceil(width * 0.70);

  let leftTotal = 0;
  let leftActive = 0;
  let rightTotal = 0;
  let rightActive = 0;
  let topTotal = 0;
  let topActive = 0;
  let faceIgnoredCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Center Face Exclusion Mask (x: 28%..72%, y: 22%..100%)
      if (x >= leftMaxX && x <= rightMinX && y >= topMaxY) {
        faceIgnoredCount++;
        continue;
      }

      const inLeft = x < leftMaxX && y >= sideMinY && y <= sideMaxY;
      const inRight = x > rightMinX && y >= sideMinY && y <= sideMaxY;
      const inTop = x >= topMinX && x <= topMaxX && y < topMaxY;

      if (!inLeft && !inRight && !inTop) {
        continue;
      }

      const idx = (y * width + x) * 4;
      const r = currData[idx];
      const g = currData[idx + 1];
      const b = currData[idx + 2];

      const currLum = 0.299 * r + 0.587 * g + 0.114 * b;
      const bgLum = 0.299 * bgData[idx] + 0.587 * bgData[idx + 1] + 0.114 * bgData[idx + 2];
      const prevLum = 0.299 * prevData[idx] + 0.587 * prevData[idx + 1] + 0.114 * prevData[idx + 2];

      const bgDiff = Math.abs(currLum - bgLum);
      const motionDiff = Math.abs(currLum - prevLum);

      // Subtle YCbCr skin contrast cue only when foreground differs from baseline room background
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkinHue = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
      const effectiveThreshold = isSkinHue ? threshold * 0.75 : threshold;

      const isPixelActive = bgDiff > effectiveThreshold || motionDiff > threshold * 0.9;

      if (inLeft) {
        leftTotal++;
        if (isPixelActive) leftActive++;
      } else if (inRight) {
        rightTotal++;
        if (isPixelActive) rightActive++;
      } else if (inTop) {
        topTotal++;
        if (isPixelActive) topActive++;
      }
    }
  }

  return {
    leftActiveRatio: leftTotal > 0 ? leftActive / leftTotal : 0,
    rightActiveRatio: rightTotal > 0 ? rightActive / rightTotal : 0,
    topActiveRatio: topTotal > 0 ? topActive / topTotal : 0,
    faceIgnoredCount,
  };
}

export class TouchlessGestureEngine {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private prevFrameData: Uint8ClampedArray | null = null;
  private bgFrameData: Uint8ClampedArray | null = null;
  private animFrameId: number | null = null;
  private options: GestureDetectionOptions;

  // Running tracking metrics
  private lastTriggerTime = 0;
  private lastFrameTime = 0;
  private warmupFrames = 0;
  private isRunning = false;

  // Dwell charge accumulators (milliseconds)
  private leftChargeMs = 0;
  private rightChargeMs = 0;
  private topChargeMs = 0;
  private lastTelemetry: GestureTelemetry = {
    leftHandDetected: false,
    rightHandDetected: false,
    topZoneDetected: false,
    leftChargePercent: 0,
    rightChargePercent: 0,
    topChargePercent: 0,
  };

  constructor(options: GestureDetectionOptions) {
    this.options = {
      minMotionThreshold: 22,
      swipeVelocityThreshold: 18,
      holdDurationMs: 1000,
      dwellDurationMs: options.dwellDurationMs || options.holdDurationMs || 1000,
      cooldownMs: 1100,
      ...options,
    };

    // Off-screen downsampled canvas (64x48) for ultra-fast mirrored processing (<1ms per frame)
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 64;
      this.canvas.height = 48;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    } else {
      this.canvas = null as any;
      this.ctx = null;
    }
  }

  public attachVideo(videoElement: HTMLVideoElement) {
    this.video = videoElement;
    if (!this.canvas && typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 64;
      this.canvas.height = 48;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public recalibrateBackground() {
    this.bgFrameData = null;
    this.prevFrameData = null;
    this.warmupFrames = 0;
    this.resetCharges();
    this.emitTelemetry({
      leftHandDetected: false,
      rightHandDetected: false,
      topZoneDetected: false,
      leftChargePercent: 0,
      rightChargePercent: 0,
      topChargePercent: 0,
    });
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.prevFrameData = null;
    this.bgFrameData = null;
    this.warmupFrames = 0;
    this.lastFrameTime = Date.now();
    this.resetCharges();
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId);
      }
      this.animFrameId = null;
    }
    this.prevFrameData = null;
    this.bgFrameData = null;
    this.resetCharges();
    this.emitTelemetry({
      leftHandDetected: false,
      rightHandDetected: false,
      topZoneDetected: false,
      leftChargePercent: 0,
      rightChargePercent: 0,
      topChargePercent: 0,
    });
  }

  private resetCharges() {
    this.leftChargeMs = 0;
    this.rightChargeMs = 0;
    this.topChargeMs = 0;
  }

  private emitTelemetry(next: GestureTelemetry) {
    const prev = this.lastTelemetry;
    if (
      prev.leftHandDetected === next.leftHandDetected &&
      prev.rightHandDetected === next.rightHandDetected &&
      prev.topZoneDetected === next.topZoneDetected &&
      prev.leftChargePercent === next.leftChargePercent &&
      prev.rightChargePercent === next.rightChargePercent &&
      prev.topChargePercent === next.topChargePercent
    ) {
      return;
    }
    this.lastTelemetry = next;
    this.options.onTelemetry?.(next);
  }

  private loop = () => {
    if (!this.isRunning) return;

    const now = Date.now();
    // Run optical analysis at ~30 FPS for balanced CPU usage and responsive 0-100% meters
    if (now - this.lastFrameTime >= 30) {
      this.processCurrentFrame(now);
      this.lastFrameTime = now;
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animFrameId = setTimeout(this.loop, 32) as any;
    }
  };

  private processCurrentFrame(now: number) {
    if (!this.video || !this.ctx || this.video.readyState < 2) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const dt = Math.min(100, Math.max(15, now - this.lastFrameTime));

    // Mirror horizontally so screen Left matches user's mirrored Left side
    this.ctx.save();
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(this.video, -w, 0, w, h);
    this.ctx.restore();

    const frame = this.ctx.getImageData(0, 0, w, h);
    const data = frame.data;

    if (!this.prevFrameData || !this.bgFrameData) {
      this.prevFrameData = new Uint8ClampedArray(data);
      this.bgFrameData = new Uint8ClampedArray(data);
      this.warmupFrames = 1;
      return;
    }

    // Brief 8-frame camera auto-exposure stabilization before evaluating triggers
    if (this.warmupFrames < 8) {
      for (let i = 0; i < data.length; i++) {
        this.bgFrameData[i] = Math.round(this.bgFrameData[i] * 0.7 + data[i] * 0.3);
      }
      this.prevFrameData.set(data);
      this.warmupFrames++;
      return;
    }

    const threshold = this.options.minMotionThreshold || 22;
    const evalResult = evaluateSpatialZones(data, this.bgFrameData, this.prevFrameData, w, h, threshold);

    // Save frame for motion diff on next tick
    this.prevFrameData.set(data);

    // Minimum active pixel ratio within each peripheral zone (10% prevents single-pixel noise)
    const zoneRatioThreshold = 0.10;
    const rawLeftDetected = evalResult.leftActiveRatio >= zoneRatioThreshold;
    const rawRightDetected = evalResult.rightActiveRatio >= zoneRatioThreshold;
    const rawTopDetected = evalResult.topActiveRatio >= zoneRatioThreshold;

    // Gentle background adaptation ONLY in zones that are currently idle
    this.adaptIdleBackground(data, w, h, rawLeftDetected, rawRightDetected, rawTopDetected);

    const cooldown = this.options.cooldownMs || 1100;
    const inCooldown = now - this.lastTriggerTime < cooldown;

    if (inCooldown) {
      this.resetCharges();
      this.emitTelemetry({
        leftHandDetected: rawLeftDetected,
        rightHandDetected: rawRightDetected,
        topZoneDetected: rawTopDetected,
        leftChargePercent: 0,
        rightChargePercent: 0,
        topChargePercent: 0,
      });
      return;
    }

    const dwellMs = this.options.dwellDurationMs || 1000;

    // Update dwell charges (build smoothly while present, decay faster when absent)
    this.leftChargeMs = rawLeftDetected
      ? Math.min(dwellMs, this.leftChargeMs + dt)
      : Math.max(0, this.leftChargeMs - dt * 1.8);

    this.rightChargeMs = rawRightDetected
      ? Math.min(dwellMs, this.rightChargeMs + dt)
      : Math.max(0, this.rightChargeMs - dt * 1.8);

    // Top clock zone requires neither side zone simultaneously active
    this.topChargeMs = rawTopDetected && !rawLeftDetected && !rawRightDetected
      ? Math.min(dwellMs, this.topChargeMs + dt)
      : Math.max(0, this.topChargeMs - dt * 2.0);

    const leftChargePercent = Math.min(100, Math.round((this.leftChargeMs / dwellMs) * 100));
    const rightChargePercent = Math.min(100, Math.round((this.rightChargeMs / dwellMs) * 100));
    const topChargePercent = Math.min(100, Math.round((this.topChargeMs / dwellMs) * 100));

    this.emitTelemetry({
      leftHandDetected: rawLeftDetected,
      rightHandDetected: rawRightDetected,
      topZoneDetected: rawTopDetected,
      leftChargePercent,
      rightChargePercent,
      topChargePercent,
    });

    if (leftChargePercent >= 100) {
      this.triggerGesture('swipe_left', Math.min(0.99, 0.85 + evalResult.leftActiveRatio * 0.25));
      return;
    }

    if (rightChargePercent >= 100) {
      this.triggerGesture('swipe_right', Math.min(0.99, 0.85 + evalResult.rightActiveRatio * 0.25));
      return;
    }

    if (topChargePercent >= 100) {
      this.triggerGesture('open_palm', Math.min(0.99, 0.85 + evalResult.topActiveRatio * 0.25));
      return;
    }
  }

  private adaptIdleBackground(
    currData: Uint8ClampedArray,
    w: number,
    h: number,
    leftBusy: boolean,
    rightBusy: boolean,
    topBusy: boolean
  ) {
    if (!this.bgFrameData) return;
    const leftMaxX = Math.floor(w * 0.28);
    const rightMinX = Math.ceil(widthClamp(w * 0.72));
    const topMaxY = Math.floor(h * 0.22);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < leftMaxX && leftBusy) continue;
        if (x > rightMinX && rightBusy) continue;
        if (y < topMaxY && x >= leftMaxX && x <= rightMinX && topBusy) continue;

        const idx = (y * w + x) * 4;
        this.bgFrameData[idx] = Math.round(this.bgFrameData[idx] * 0.98 + currData[idx] * 0.02);
        this.bgFrameData[idx + 1] = Math.round(this.bgFrameData[idx + 1] * 0.98 + currData[idx + 1] * 0.02);
        this.bgFrameData[idx + 2] = Math.round(this.bgFrameData[idx + 2] * 0.98 + currData[idx + 2] * 0.02);
      }
    }
  }

  private triggerGesture(gesture: GestureType, confidence: number) {
    this.lastTriggerTime = Date.now();
    this.resetCharges();
    this.emitTelemetry({
      leftHandDetected: gesture === 'swipe_left',
      rightHandDetected: gesture === 'swipe_right',
      topZoneDetected: gesture === 'open_palm',
      leftChargePercent: gesture === 'swipe_left' ? 100 : 0,
      rightChargePercent: gesture === 'swipe_right' ? 100 : 0,
      topChargePercent: gesture === 'open_palm' ? 100 : 0,
    });
    this.options.onGesture(gesture, confidence);
  }
}

function widthClamp(v: number): number {
  return Math.max(0, v);
}
