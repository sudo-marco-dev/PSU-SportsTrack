/**
 * 21-Landmark Hand & Finger Pose Classifier
 * Pure geometric classifier (zero DOM/browser dependencies) for MediaPipe HandLandmarker.
 * Uses palm-normalized 2D distances & joint straightness dot products for
 * scale-invariant, orientation-tolerant Left/Right hand and finger-count detection.
 */

import type { HandPoseName, HandSide } from '@/types/multimodal';

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FingerExtensionFlags {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export interface HandPoseClassification {
  valid: boolean;
  pose: HandPoseName;
  fingerCount: number;
  palmSize: number;
  fingers: FingerExtensionFlags;
}

/**
 * Standard MediaPipe 21-hand landmark bone connections for skeletal canvas rendering
 */
export const HAND_SKELETON_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Palm
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Knuckle arch
];

export const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;

export const MIN_VALID_PALM_SIZE = 0.065;

function dist2D(a: LandmarkPoint, b: LandmarkPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Determines whether a non-thumb finger (index, middle, ring, pinky) is cleanly extended.
 */
function isFingerExtended(
  lm: ReadonlyArray<LandmarkPoint>,
  mcpIdx: number,
  pipIdx: number,
  tipIdx: number
): boolean {
  const wrist = lm[0];
  const mcp = lm[mcpIdx];
  const pip = lm[pipIdx];
  const tip = lm[tipIdx];

  const dWristTip = dist2D(wrist, tip);
  const dWristPip = dist2D(wrist, pip);
  const dWristMcp = dist2D(wrist, mcp);

  const v1x = pip.x - mcp.x;
  const v1y = pip.y - mcp.y;
  const v2x = tip.x - pip.x;
  const v2y = tip.y - pip.y;
  const boneDot = v1x * v2x + v1y * v2y;

  return dWristTip > dWristPip * 1.12 && dWristTip > dWristMcp * 1.32 && boneDot > 0;
}

/**
 * Determines whether a non-thumb finger is tightly curled toward the palm (strict Closed Fist check).
 */
function isFingerCurled(
  lm: ReadonlyArray<LandmarkPoint>,
  pipIdx: number,
  tipIdx: number,
  palmCenter: LandmarkPoint,
  palmSize: number
): boolean {
  const dWristTip = dist2D(lm[0], lm[tipIdx]);
  const dWristPip = dist2D(lm[0], lm[pipIdx]);
  const dPalmTip = dist2D(palmCenter, lm[tipIdx]);
  return dWristTip < dWristPip * 1.08 && dPalmTip < palmSize * 0.98;
}

/**
 * Determines thumb extension relative to palm size and opposite-side knuckle (Pinky MCP 17).
 */
function isThumbExtended(lm: ReadonlyArray<LandmarkPoint>, palmSize: number): boolean {
  const dPinkyToTip = dist2D(lm[17], lm[4]);
  const dPinkyToMcp = dist2D(lm[17], lm[2]);
  const dIndexToTip = dist2D(lm[5], lm[4]);
  const dMcpToTip = dist2D(lm[2], lm[4]);

  return (
    dPinkyToTip > dPinkyToMcp * 1.2 &&
    dIndexToTip > palmSize * 0.42 &&
    dMcpToTip > palmSize * 0.42
  );
}

/**
 * Classifies 21 normalized hand landmarks into an unmistakable referee-style finger pose.
 */
export function classifyHandPose(lm: ReadonlyArray<LandmarkPoint>): HandPoseClassification {
  if (!lm || lm.length < 21) {
    return {
      valid: false,
      pose: 'none',
      fingerCount: 0,
      palmSize: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    };
  }

  const palmSize = dist2D(lm[0], lm[9]);
  if (palmSize < MIN_VALID_PALM_SIZE) {
    return {
      valid: false,
      pose: 'none',
      fingerCount: 0,
      palmSize,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    };
  }

  const thumb = isThumbExtended(lm, palmSize);
  const index = isFingerExtended(lm, 5, 6, 8);
  const middle = isFingerExtended(lm, 9, 10, 12);
  const ring = isFingerExtended(lm, 13, 14, 16);
  const pinky = isFingerExtended(lm, 17, 18, 20);

  const fingers: FingerExtensionFlags = { thumb, index, middle, ring, pinky };

  const thumbLooselyTucked = !thumb || dist2D(lm[5], lm[4]) < palmSize * 0.62;
  const extendedNonThumb = [index, middle, ring, pinky].filter(Boolean).length;
  const fingerCount = extendedNonThumb + (thumb ? 1 : 0);

  // 1. Open Palm (All 5 digits extended) -> Pause / Resume Match Clock
  if (thumb && index && middle && ring && pinky) {
    return { valid: true, pose: 'open_palm', fingerCount: 5, palmSize, fingers };
  }

  // 2. Four Fingers (Index + Middle + Ring + Pinky extended, thumb tucked) -> Pick / Cycle Player
  if (index && middle && ring && pinky && thumbLooselyTucked) {
    return { valid: true, pose: 'four_fingers', fingerCount: 4, palmSize, fingers };
  }

  // 3. Three Fingers (Index + Middle + Ring extended, Pinky down) -> +3 Points
  if (index && middle && ring && !pinky && thumbLooselyTucked) {
    return { valid: true, pose: 'three_fingers', fingerCount: 3, palmSize, fingers };
  }

  // 4. Two Fingers (Index + Middle extended, Ring & Pinky down) -> +2 Points
  if (index && middle && !ring && !pinky && thumbLooselyTucked) {
    return { valid: true, pose: 'two_fingers', fingerCount: 2, palmSize, fingers };
  }

  // 5. One Finger (Index extended only) -> +1 Point
  if (index && !middle && !ring && !pinky && thumbLooselyTucked) {
    return { valid: true, pose: 'one_finger', fingerCount: 1, palmSize, fingers };
  }

  // 6. Shaka (Thumb + Pinky extended, middle 3 curled) -> Open Substitutions
  if (thumb && !index && !middle && !ring && pinky) {
    return { valid: true, pose: 'shaka', fingerCount: 2, palmSize, fingers };
  }

  // 7. Thumbs Up (Only thumb extended and pointing upward above knuckle arch) -> Call Timeout
  if (
    thumb &&
    !index &&
    !middle &&
    !ring &&
    !pinky &&
    lm[4].y < lm[3].y - palmSize * 0.06 &&
    lm[4].y < lm[5].y
  ) {
    return { valid: true, pose: 'thumbs_up', fingerCount: 1, palmSize, fingers };
  }

  // 8. Closed Fist (All 4 fingers tightly curled near palm center + thumb tucked) -> Deduct -1 Point
  const palmCenter: LandmarkPoint = {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
    y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
  };
  const allCurled =
    !thumb &&
    !index &&
    !middle &&
    !ring &&
    !pinky &&
    isFingerCurled(lm, 6, 8, palmCenter, palmSize) &&
    isFingerCurled(lm, 10, 12, palmCenter, palmSize) &&
    isFingerCurled(lm, 14, 16, palmCenter, palmSize) &&
    isFingerCurled(lm, 18, 20, palmCenter, palmSize);

  if (allCurled) {
    return { valid: true, pose: 'closed_fist', fingerCount: 0, palmSize, fingers };
  }

  return { valid: true, pose: 'none', fingerCount, palmSize, fingers };
}

/**
 * Corrects MediaPipe's handedness label to the subject's anatomical Left vs Right hand.
 * Per MediaPipe HandLandmarker specification, raw unmirrored webcam frames report the
 * subject's true anatomical Left/Right directly; set `invertHandedness` only if the
 * camera driver itself outputs hardware-mirrored frames.
 */
export function resolveMirroredHandSide(
  mediaPipeLabel: string | undefined,
  invertHandedness = false
): HandSide {
  const lower = (mediaPipeLabel || '').toLowerCase();
  if (invertHandedness) {
    return lower === 'right' ? 'left' : 'right';
  }
  return lower === 'left' ? 'left' : 'right';
}

export interface HandSlotDwellState {
  phase: 'idle' | 'charging' | 'locked_until_release';
  activePose: HandPoseName;
  chargeMs: number;
  releaseMs: number;
  lastFireTime: number;
}

export interface DwellStepResult {
  fired: boolean;
  firedPose?: HandPoseName;
  chargePercent: number;
  phase: 'idle' | 'charging' | 'locked_until_release';
}

/**
 * Deterministic 3-layer anti-misfire state machine per hand:
 * - Requires sustained steady pose (`dwellMs`, default 850ms) to reach 100%.
 * - Enforces `locked_until_release` after firing so keeping a hand up never double-scores.
 * - Requires dropping hand or holding a different/neutral pose for `releaseMs` (220ms) to re-arm.
 */
export class HandPoseDwellTracker {
  private slots: Record<HandSide, HandSlotDwellState>;
  private readonly dwellMs: number;
  private readonly cooldownMs: number;
  private readonly releaseRequiredMs: number;

  constructor(options?: { dwellMs?: number; cooldownMs?: number; releaseRequiredMs?: number }) {
    this.dwellMs = options?.dwellMs ?? 850;
    this.cooldownMs = options?.cooldownMs ?? 700;
    this.releaseRequiredMs = options?.releaseRequiredMs ?? 220;
    this.slots = {
      left: this.createEmptySlot(),
      right: this.createEmptySlot(),
    };
  }

  private createEmptySlot(): HandSlotDwellState {
    return {
      phase: 'idle',
      activePose: 'none',
      chargeMs: 0,
      releaseMs: 0,
      lastFireTime: 0,
    };
  }

  public resetAll() {
    this.slots.left = this.createEmptySlot();
    this.slots.right = this.createEmptySlot();
  }

  public step(
    side: HandSide,
    detected: boolean,
    pose: HandPoseName,
    dtMs: number,
    nowMs: number
  ): DwellStepResult {
    const slot = this.slots[side];
    const dt = Math.max(0, Math.min(120, dtMs));

    // Layer 3: Locked until hand drops out of frame or changes away from the fired pose
    if (slot.phase === 'locked_until_release') {
      if (!detected || pose === 'none' || pose !== slot.activePose) {
        slot.releaseMs += dt;
        if (slot.releaseMs >= this.releaseRequiredMs) {
          slot.phase = 'idle';
          slot.activePose = 'none';
          slot.chargeMs = 0;
          slot.releaseMs = 0;
        }
      } else {
        slot.releaseMs = 0;
      }
      return {
        fired: false,
        chargePercent: 0,
        phase: slot.phase,
      };
    }

    // No recognizable referee pose -> smoothly decay charge back to 0
    if (!detected || pose === 'none') {
      slot.chargeMs = Math.max(0, slot.chargeMs - dt * 2.2);
      if (slot.chargeMs === 0) {
        slot.phase = 'idle';
        slot.activePose = 'none';
      }
      return {
        fired: false,
        chargePercent: Math.min(100, Math.round((slot.chargeMs / this.dwellMs) * 100)),
        phase: slot.phase,
      };
    }

    // Pose changed mid-charge -> restart clean charge for the newly shown fingers
    if (pose !== slot.activePose) {
      slot.activePose = pose;
      slot.chargeMs = dt;
      slot.phase = 'charging';
    } else if (nowMs - slot.lastFireTime < this.cooldownMs) {
      slot.chargeMs = 0;
      slot.phase = 'charging';
    } else {
      slot.chargeMs = Math.min(this.dwellMs, slot.chargeMs + dt);
      slot.phase = 'charging';
    }

    const chargePercent = Math.min(100, Math.round((slot.chargeMs / this.dwellMs) * 100));
    if (chargePercent >= 100) {
      slot.lastFireTime = nowMs;
      slot.phase = 'locked_until_release';
      slot.chargeMs = 0;
      slot.releaseMs = 0;
      return {
        fired: true,
        firedPose: pose,
        chargePercent: 100,
        phase: 'locked_until_release',
      };
    }

    return {
      fired: false,
      chargePercent,
      phase: slot.phase,
    };
  }
}

export function formatPoseLabel(pose: HandPoseName): string {
  switch (pose) {
    case 'one_finger':
      return '1 Finger';
    case 'two_fingers':
      return '2 Fingers';
    case 'three_fingers':
      return '3 Fingers';
    case 'four_fingers':
      return '4 Fingers';
    case 'open_palm':
      return 'Open Palm (5)';
    case 'closed_fist':
      return 'Closed Fist';
    case 'thumbs_up':
      return 'Thumbs Up';
    case 'shaka':
      return 'Shaka (Thumb+Pinky)';
    default:
      return 'Neutral / Standby';
  }
}

export function describeHandAction(pose: HandPoseName, teamLabel: string, maxPoint = 3): string {
  switch (pose) {
    case 'one_finger':
      return `+1 Point (${teamLabel})`;
    case 'two_fingers':
      return maxPoint >= 2 ? `+2 Points (${teamLabel})` : `+1 Point (${teamLabel})`;
    case 'three_fingers':
      return maxPoint >= 3 ? `+3 Points (${teamLabel})` : `+1 Point (${teamLabel})`;
    case 'four_fingers':
      return `Pick Player (${teamLabel})`;
    case 'open_palm':
      return 'Pause / Resume Clock';
    case 'closed_fist':
      return `Deduct -1 Point (${teamLabel})`;
    case 'thumbs_up':
      return `Timeout (${teamLabel})`;
    case 'shaka':
      return `Substitutions (${teamLabel})`;
    default:
      return 'Hold Pose to Charge';
  }
}
