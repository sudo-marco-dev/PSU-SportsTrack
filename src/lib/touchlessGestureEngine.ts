/**
 * MediaPipe 21-Landmark Hand & Finger Touchless Gesture Engine for PSU SportsTrack
 * Replaces pixel-box motion triggers with genuine anatomical Left/Right hand
 * skeletal tracking, finger counting (1-5, Fist, Thumbs Up, Shaka), aligned canvas
 * wireframe rendering, and a 3-layer Dwell + Release-to-Rearm safety gate.
 * Complies with Capstone HCI-2 Touchless Interface requirements.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type {
  GestureType,
  HandPoseName,
  HandSide,
  TouchlessModelStatus,
  TrackedHandState,
} from '@/types/multimodal';
import {
  classifyHandPose,
  describeHandAction,
  formatPoseLabel,
  FINGERTIP_INDICES,
  HAND_SKELETON_CONNECTIONS,
  HandPoseDwellTracker,
  resolveMirroredHandSide,
  type LandmarkPoint,
} from '@/lib/handPoseClassifier';

export interface GestureTelemetry {
  leftHand: TrackedHandState;
  rightHand: TrackedHandState;
}

export interface GestureDetectionOptions {
  onGesture: (gesture: GestureType, confidence: number) => void;
  onHandCommand?: (side: HandSide, pose: HandPoseName, confidence: number) => void;
  onTelemetry?: (telemetry: GestureTelemetry) => void;
  onModelStatusChange?: (status: TouchlessModelStatus, errorMessage?: string | null) => void;
  dwellDurationMs?: number;
  cooldownMs?: number;
  releaseRequiredMs?: number;
  minDetectionConfidence?: number;
  invertHandedness?: boolean;
  maxPoint?: number;
  leftTeamLabel?: string;
  rightTeamLabel?: string;
  // Legacy config aliases preserved for existing callers & unit tests
  minMotionThreshold?: number;
  swipeVelocityThreshold?: number;
  holdDurationMs?: number;
}

export function createIdleTrackedHandState(actionLabel = 'Show Hand & Fingers'): TrackedHandState {
  return {
    detected: false,
    pose: 'none',
    fingerCount: 0,
    score: 0,
    chargePercent: 0,
    phase: 'idle',
    actionLabel,
  };
}

interface FrameHandCandidate {
  side: HandSide;
  score: number;
  landmarks: LandmarkPoint[];
  pose: HandPoseName;
  fingerCount: number;
  fingers: { thumb: boolean; index: boolean; middle: boolean; ring: boolean; pinky: boolean };
}

export class TouchlessGestureEngine {
  private video: HTMLVideoElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private animFrameId: number | null = null;
  private options: GestureDetectionOptions;
  private dwellTracker: HandPoseDwellTracker;

  private isRunning = false;
  private isInitializing = false;
  private lastProcessTime = 0;
  private lastVideoTime = -1;
  private invertHandedness = false;
  private leftTeamLabel = 'Team A';
  private rightTeamLabel = 'Team B';
  private maxPoint = 3;

  private lastTelemetry: GestureTelemetry = {
    leftHand: createIdleTrackedHandState(),
    rightHand: createIdleTrackedHandState(),
  };

  constructor(options: GestureDetectionOptions) {
    this.options = {
      dwellDurationMs: options.dwellDurationMs || options.holdDurationMs || 850,
      cooldownMs: options.cooldownMs ?? 700,
      releaseRequiredMs: options.releaseRequiredMs ?? 220,
      minDetectionConfidence: options.minDetectionConfidence ?? 0.7,
      ...options,
    };

    this.invertHandedness = Boolean(options.invertHandedness);
    this.leftTeamLabel = options.leftTeamLabel || 'Team A';
    this.rightTeamLabel = options.rightTeamLabel || 'Team B';
    this.maxPoint = options.maxPoint ?? 3;

    this.dwellTracker = new HandPoseDwellTracker({
      dwellMs: this.options.dwellDurationMs,
      cooldownMs: this.options.cooldownMs,
      releaseRequiredMs: this.options.releaseRequiredMs,
    });
  }

  public updateLabels(leftTeamLabel: string, rightTeamLabel: string, maxPoint = 3) {
    this.leftTeamLabel = leftTeamLabel || 'Team A';
    this.rightTeamLabel = rightTeamLabel || 'Team B';
    this.maxPoint = maxPoint;
  }

  public setInvertHandedness(invert: boolean) {
    this.invertHandedness = invert;
    this.dwellTracker.resetAll();
  }

  public attachVideo(videoElement: HTMLVideoElement | null) {
    this.video = videoElement;
    this.lastVideoTime = -1;
  }

  public attachOverlayCanvas(canvasElement: HTMLCanvasElement | null) {
    this.overlayCanvas = canvasElement;
  }

  public recalibrateBackground() {
    this.dwellTracker.resetAll();
    this.emitIdleTelemetry();
  }

  private emitIdleTelemetry() {
    this.emitTelemetry({
      leftHand: createIdleTrackedHandState(`Show Left Hand (${this.leftTeamLabel})`),
      rightHand: createIdleTrackedHandState(`Show Right Hand (${this.rightTeamLabel})`),
    });
  }

  private async ensureHandLandmarkerLoaded(): Promise<HandLandmarker | null> {
    if (this.handLandmarker) {
      this.options.onModelStatusChange?.('ready', null);
      return this.handLandmarker;
    }
    if (this.isInitializing || typeof window === 'undefined') return null;

    this.isInitializing = true;
    this.options.onModelStatusChange?.('loading', null);

    try {
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      } catch {
        // Fallback to jsDelivr CDN WASM if local assets are unavailable
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );
      }

      const baseModelPaths = [
        '/mediapipe/models/hand_landmarker.task',
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      ];

      const delegates: Array<'GPU' | 'CPU'> = ['GPU', 'CPU'];
      let created: HandLandmarker | null = null;
      let lastErr: unknown = null;

      for (const modelAssetPath of baseModelPaths) {
        for (const delegate of delegates) {
          try {
            created = await HandLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: this.options.minDetectionConfidence ?? 0.7,
              minHandPresenceConfidence: this.options.minDetectionConfidence ?? 0.7,
              minTrackingConfidence: 0.68,
            });
            break;
          } catch (err) {
            lastErr = err;
          }
        }
        if (created) break;
      }

      if (!created) {
        throw lastErr || new Error('Failed to load MediaPipe HandLandmarker model.');
      }

      this.handLandmarker = created;
      this.options.onModelStatusChange?.('ready', null);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Unable to initialize MediaPipe hand landmark model.';
      this.options.onModelStatusChange?.('error', msg);
      return null;
    } finally {
      this.isInitializing = false;
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastProcessTime = Date.now();
    this.lastVideoTime = -1;
    this.dwellTracker.resetAll();

    // Only attempt WASM/model loading in a real browser environment with video attached
    if (typeof window !== 'undefined') {
      void this.ensureHandLandmarkerLoaded();
    }

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
    this.dwellTracker.resetAll();
    this.clearOverlayCanvas();
    this.emitIdleTelemetry();
  }

  public dispose() {
    this.stop();
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch {
        // no-op
      }
      this.handLandmarker = null;
    }
  }

  private loop = () => {
    if (!this.isRunning) return;

    const now = Date.now();
    // Run MediaPipe inference at ~30 FPS for crisp tracking without overloading device CPU/GPU
    if (now - this.lastProcessTime >= 32) {
      const dt = Math.min(100, Math.max(16, now - this.lastProcessTime));
      this.processCurrentFrame(now, dt);
      this.lastProcessTime = now;
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animFrameId = setTimeout(this.loop, 32) as any;
    }
  };

  private processCurrentFrame(now: number, dt: number) {
    if (!this.video || !this.handLandmarker || this.video.readyState < 2 || this.video.videoWidth === 0) {
      return;
    }

    if (this.video.currentTime === this.lastVideoTime) {
      return;
    }
    this.lastVideoTime = this.video.currentTime;

    let result;
    try {
      const ts = typeof performance !== 'undefined' ? performance.now() : now;
      result = this.handLandmarker.detectForVideo(this.video, ts);
    } catch {
      return;
    }

    const candidates: { left: FrameHandCandidate | null; right: FrameHandCandidate | null } = {
      left: null,
      right: null,
    };

    const landmarkSets = result?.landmarks || [];
    const handednessSets = result?.handedness || result?.handednesses || [];
    const minScore = this.options.minDetectionConfidence ?? 0.7;

    for (let i = 0; i < landmarkSets.length; i++) {
      const lm = landmarkSets[i] as LandmarkPoint[];
      const cat = handednessSets[i]?.[0];
      const mpScore = cat?.score ?? 0.85;
      if (mpScore < minScore) continue;

      const classified = classifyHandPose(lm);
      if (!classified.valid) continue;

      const side = resolveMirroredHandSide(cat?.categoryName, this.invertHandedness);
      const existing = candidates[side];
      if (!existing || mpScore > existing.score) {
        candidates[side] = {
          side,
          score: mpScore,
          landmarks: lm,
          pose: classified.pose,
          fingerCount: classified.fingerCount,
          fingers: classified.fingers,
        };
      }
    }

    // Step deterministic 3-layer dwell & release state machine for both hands
    const leftStep = this.dwellTracker.step(
      'left',
      Boolean(candidates.left),
      candidates.left?.pose ?? 'none',
      dt,
      now
    );
    const rightStep = this.dwellTracker.step(
      'right',
      Boolean(candidates.right),
      candidates.right?.pose ?? 'none',
      dt,
      now
    );

    const leftHandState: TrackedHandState = {
      detected: Boolean(candidates.left),
      pose: candidates.left?.pose ?? 'none',
      fingerCount: candidates.left?.fingerCount ?? 0,
      score: candidates.left?.score ?? 0,
      chargePercent: leftStep.chargePercent,
      phase: leftStep.phase,
      actionLabel: candidates.left
        ? describeHandAction(candidates.left.pose, this.leftTeamLabel, this.maxPoint)
        : `Show Left Hand (${this.leftTeamLabel})`,
    };

    const rightHandState: TrackedHandState = {
      detected: Boolean(candidates.right),
      pose: candidates.right?.pose ?? 'none',
      fingerCount: candidates.right?.fingerCount ?? 0,
      score: candidates.right?.score ?? 0,
      chargePercent: rightStep.chargePercent,
      phase: rightStep.phase,
      actionLabel: candidates.right
        ? describeHandAction(candidates.right.pose, this.rightTeamLabel, this.maxPoint)
        : `Show Right Hand (${this.rightTeamLabel})`,
    };

    this.drawOverlay(candidates, leftHandState, rightHandState);
    this.emitTelemetry({ leftHand: leftHandState, rightHand: rightHandState });

    if (leftStep.fired && leftStep.firedPose) {
      const conf = candidates.left?.score ?? 0.95;
      this.options.onHandCommand?.('left', leftStep.firedPose, conf);
      this.options.onGesture?.(leftStep.firedPose, conf);
    }

    if (rightStep.fired && rightStep.firedPose) {
      const conf = candidates.right?.score ?? 0.95;
      this.options.onHandCommand?.('right', rightStep.firedPose, conf);
      this.options.onGesture?.(rightStep.firedPose, conf);
    }
  }

  private clearOverlayCanvas() {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }

  private drawOverlay(
    candidates: { left: FrameHandCandidate | null; right: FrameHandCandidate | null },
    leftState: TrackedHandState,
    rightState: TrackedHandState
  ) {
    if (!this.overlayCanvas || !this.video) return;
    const w = this.video.videoWidth || 640;
    const h = this.video.videoHeight || 480;
    if (this.overlayCanvas.width !== w) this.overlayCanvas.width = w;
    if (this.overlayCanvas.height !== h) this.overlayCanvas.height = h;

    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    const drawSingleHand = (cand: FrameHandCandidate, state: TrackedHandState, isLeft: boolean) => {
      const lm = cand.landmarks;
      // Coordinates aligned to mirrored CSS video (`-scale-x-100`) while keeping canvas text upright
      const toX = (nx: number) => (1 - nx) * w;
      const toY = (ny: number) => ny * h;

      const primaryColor = isLeft ? '#F97316' : '#06B6D4'; // Palawan Solar Orange vs Cyan
      const lightColor = isLeft ? '#FDBA74' : '#67E8F9';

      // 1. Skeleton Bone Connectors
      ctx.strokeStyle = state.phase === 'locked_until_release' ? '#10B981' : primaryColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const [startIdx, endIdx] of HAND_SKELETON_CONNECTIONS) {
        const a = lm[startIdx];
        const b = lm[endIdx];
        ctx.beginPath();
        ctx.moveTo(toX(a.x), toY(a.y));
        ctx.lineTo(toX(b.x), toY(b.y));
        ctx.stroke();
      }

      // 2. Landmark Joints & Extended Fingertip Highlights
      const fingerByTip: Record<number, boolean> = {
        4: cand.fingers.thumb,
        8: cand.fingers.index,
        12: cand.fingers.middle,
        16: cand.fingers.ring,
        20: cand.fingers.pinky,
      };

      for (let i = 0; i < lm.length; i++) {
        const pt = lm[i];
        const x = toX(pt.x);
        const y = toY(pt.y);
        const isTip = (FINGERTIP_INDICES as readonly number[]).includes(i);
        const isExt = isTip && fingerByTip[i];

        ctx.beginPath();
        ctx.arc(x, y, isTip ? (isExt ? 7 : 4.5) : 3, 0, Math.PI * 2);
        ctx.fillStyle = isExt ? '#FFFFFF' : lightColor;
        ctx.fill();
        if (isExt) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = primaryColor;
          ctx.stroke();
        }
      }

      // 3. Wrist Dwell-Charge Circular Progress Ring
      const wx = toX(lm[0].x);
      const wy = toY(lm[0].y);
      ctx.beginPath();
      ctx.arc(wx, wy, 22, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 4;
      ctx.stroke();

      if (state.chargePercent > 0 || state.phase === 'locked_until_release') {
        const endAngle =
          state.phase === 'locked_until_release'
            ? Math.PI * 2 - Math.PI / 2
            : -Math.PI / 2 + (Math.PI * 2 * state.chargePercent) / 100;
        ctx.beginPath();
        ctx.arc(wx, wy, 22, -Math.PI / 2, endAngle);
        ctx.strokeStyle = state.phase === 'locked_until_release' ? '#10B981' : primaryColor;
        ctx.lineWidth = 5;
        ctx.stroke();
      }

      // 4. Crisp HUD Badge Above Hand
      const minY = Math.min(...lm.map((p) => toY(p.y)));
      const labelX = Math.max(80, Math.min(w - 80, wx));
      const labelY = Math.max(24, minY - 14);
      const poseTitle = formatPoseLabel(cand.pose).toUpperCase();
      const statusSuffix =
        state.phase === 'locked_until_release'
          ? 'FIRED - DROP HAND'
          : cand.pose === 'none'
          ? 'HOLD POSE'
          : `${state.chargePercent}%`;
      const tagText = `${isLeft ? 'L' : 'R'}: ${poseTitle} (${statusSuffix})`;

      ctx.font = 'bold 12px monospace';
      const metrics = ctx.measureText(tagText);
      const boxW = metrics.width + 16;
      const boxH = 22;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.strokeStyle = state.phase === 'locked_until_release' ? '#10B981' : primaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(labelX - boxW / 2, labelY - boxH / 2, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, labelX, labelY);
    };

    if (candidates.left) drawSingleHand(candidates.left, leftState, true);
    if (candidates.right) drawSingleHand(candidates.right, rightState, false);
  }

  private emitTelemetry(next: GestureTelemetry) {
    const prev = this.lastTelemetry;
    if (
      prev.leftHand.detected === next.leftHand.detected &&
      prev.leftHand.pose === next.leftHand.pose &&
      prev.leftHand.chargePercent === next.leftHand.chargePercent &&
      prev.leftHand.phase === next.leftHand.phase &&
      prev.rightHand.detected === next.rightHand.detected &&
      prev.rightHand.pose === next.rightHand.pose &&
      prev.rightHand.chargePercent === next.rightHand.chargePercent &&
      prev.rightHand.phase === next.rightHand.phase
    ) {
      return;
    }
    this.lastTelemetry = next;
    this.options.onTelemetry?.(next);
  }
}
