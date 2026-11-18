import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyHandPose,
  HandPoseDwellTracker,
  resolveMirroredHandSide,
  describeHandAction,
  formatPoseLabel,
  type LandmarkPoint,
} from '../src/lib/handPoseClassifier';

/**
 * Generates a realistic normalized 21-landmark hand skeleton anchored at wrist (0.50, 0.78)
 * with palmSize ~ 0.26 (well above MIN_VALID_PALM_SIZE = 0.065).
 */
function buildSyntheticHandLandmarks(config: {
  thumb?: boolean;
  index?: boolean;
  middle?: boolean;
  ring?: boolean;
  pinky?: boolean;
  scale?: number;
  thumbDirection?: 'up' | 'side';
}): LandmarkPoint[] {
  const s = config.scale ?? 1.0;
  const ox = 0.5;
  const oy = 0.78;
  const pt = (dx: number, dy: number): LandmarkPoint => ({
    x: ox + dx * s,
    y: oy + dy * s,
    z: 0,
  });

  const lm: LandmarkPoint[] = new Array(21);

  // 0: Wrist
  lm[0] = pt(0, 0);

  // 1-4: Thumb
  lm[1] = pt(-0.06, -0.08);
  lm[2] = pt(-0.09, -0.16);
  if (config.thumb) {
    if (config.thumbDirection === 'up') {
      lm[3] = pt(-0.14, -0.26);
      lm[4] = pt(-0.16, -0.36);
    } else {
      lm[3] = pt(-0.17, -0.22);
      lm[4] = pt(-0.24, -0.30);
    }
  } else {
    // Tucked tightly toward Index MCP (5)
    lm[3] = pt(-0.07, -0.21);
    lm[4] = pt(-0.05, -0.23);
  }

  const setFinger = (
    mcpIdx: number,
    pipIdx: number,
    dipIdx: number,
    tipIdx: number,
    baseX: number,
    baseY: number,
    extended: boolean
  ) => {
    lm[mcpIdx] = pt(baseX, baseY);
    if (extended) {
      lm[pipIdx] = pt(baseX, baseY - 0.12);
      lm[dipIdx] = pt(baseX, baseY - 0.20);
      lm[tipIdx] = pt(baseX, baseY - 0.28);
    } else {
      lm[pipIdx] = pt(baseX, baseY - 0.04);
      lm[dipIdx] = pt(baseX, baseY + 0.04);
      lm[tipIdx] = pt(baseX, baseY + 0.07);
    }
  };

  setFinger(5, 6, 7, 8, -0.05, -0.24, Boolean(config.index));
  setFinger(9, 10, 11, 12, 0.0, -0.26, Boolean(config.middle));
  setFinger(13, 14, 15, 16, 0.06, -0.24, Boolean(config.ring));
  setFinger(17, 18, 19, 20, 0.12, -0.22, Boolean(config.pinky));

  return lm;
}

test.describe('21-Landmark Hand Pose & Anti-Misfire Engine', () => {
  test('accurately classifies all 8 referee finger poses', () => {
    expect(
      classifyHandPose(buildSyntheticHandLandmarks({ index: true })).pose
    ).toBe('one_finger');

    expect(
      classifyHandPose(buildSyntheticHandLandmarks({ index: true, middle: true })).pose
    ).toBe('two_fingers');

    expect(
      classifyHandPose(
        buildSyntheticHandLandmarks({ index: true, middle: true, ring: true })
      ).pose
    ).toBe('three_fingers');

    expect(
      classifyHandPose(
        buildSyntheticHandLandmarks({
          index: true,
          middle: true,
          ring: true,
          pinky: true,
        })
      ).pose
    ).toBe('four_fingers');

    expect(
      classifyHandPose(
        buildSyntheticHandLandmarks({
          thumb: true,
          index: true,
          middle: true,
          ring: true,
          pinky: true,
        })
      ).pose
    ).toBe('open_palm');

    expect(
      classifyHandPose(buildSyntheticHandLandmarks({})).pose
    ).toBe('closed_fist');

    expect(
      classifyHandPose(
        buildSyntheticHandLandmarks({ thumb: true, thumbDirection: 'up' })
      ).pose
    ).toBe('thumbs_up');

    expect(
      classifyHandPose(buildSyntheticHandLandmarks({ thumb: true, pinky: true })).pose
    ).toBe('shaka');
  });

  test('rejects tiny distant hands, faces, and incomplete landmark arrays', () => {
    expect(classifyHandPose([])).toMatchObject({ valid: false, pose: 'none' });

    const tinyHand = buildSyntheticHandLandmarks({
      index: true,
      middle: true,
      scale: 0.15, // palmSize ~ 0.039 < 0.065
    });
    const tinyRes = classifyHandPose(tinyHand);
    expect(tinyRes.valid).toBe(false);
    expect(tinyRes.pose).toBe('none');

    // Ambiguous half-curled noise hand (only ring finger up) -> 'none'
    const ambiguous = buildSyntheticHandLandmarks({ ring: true });
    expect(classifyHandPose(ambiguous).pose).toBe('none');
  });

  test('maps MediaPipe anatomical Left/Right handedness and respects Invert L/R toggle', () => {
    expect(resolveMirroredHandSide('Left', false)).toBe('left');
    expect(resolveMirroredHandSide('Right', false)).toBe('right');
    expect(resolveMirroredHandSide('Left', true)).toBe('right');
    expect(resolveMirroredHandSide('Right', true)).toBe('left');
  });

  test('enforces 850ms dwell charge + Release-to-Rearm lock without double-scoring', () => {
    const tracker = new HandPoseDwellTracker({
      dwellMs: 850,
      cooldownMs: 700,
      releaseRequiredMs: 220,
    });

    let t = 1000;
    let lastRes = tracker.step('left', true, 'two_fingers', 80, t);
    expect(lastRes.fired).toBe(false);
    expect(lastRes.phase).toBe('charging');
    expect(lastRes.chargePercent).toBeGreaterThan(0);

    // Mid-charge pose switch resets charge
    t += 80;
    const switchRes = tracker.step('left', true, 'three_fingers', 80, t);
    expect(switchRes.fired).toBe(false);
    expect(switchRes.chargePercent).toBeLessThan(15);

    // Hold three_fingers steadily until 850ms accumulated
    let firedCount = 0;
    for (let i = 0; i < 12; i++) {
      t += 80;
      lastRes = tracker.step('left', true, 'three_fingers', 80, t);
      if (lastRes.fired) {
        firedCount += 1;
        expect(lastRes.firedPose).toBe('three_fingers');
      }
    }
    expect(firedCount).toBe(1);
    expect(lastRes.phase).toBe('locked_until_release');

    // Continuing to hold three_fingers for another full second MUST NOT double-fire
    for (let i = 0; i < 15; i++) {
      t += 80;
      const lockedRes = tracker.step('left', true, 'three_fingers', 80, t);
      expect(lockedRes.fired).toBe(false);
      expect(lockedRes.phase).toBe('locked_until_release');
    }

    // Drop hand for >= 220ms -> unlocks back to idle
    for (let i = 0; i < 4; i++) {
      t += 80;
      tracker.step('left', false, 'none', 80, t);
    }
    const afterRelease = tracker.step('left', false, 'none', 80, t + 80);
    expect(afterRelease.phase).toBe('idle');

    // Showing one_finger after release charges cleanly again
    let reFired = false;
    for (let i = 0; i < 14; i++) {
      t += 90;
      const r = tracker.step('left', true, 'one_finger', 90, t);
      if (r.fired) {
        reFired = true;
        expect(r.firedPose).toBe('one_finger');
      }
    }
    expect(reFired).toBe(true);
  });

  test('formats human-readable sport-clamped pose descriptions', () => {
    expect(formatPoseLabel('three_fingers')).toBe('3 Fingers');
    expect(describeHandAction('three_fingers', 'CCS', 3)).toBe('+3 Points (CCS)');
    expect(describeHandAction('three_fingers', 'Volleyball', 1)).toBe('+1 Point (Volleyball)');
    expect(describeHandAction('shaka', 'CBA', 3)).toBe('Substitutions (CBA)');
  });

  test('Touchless HUD, Engine & Classifier contain zero raw emojis or literal arrows', () => {
    const filesToCheck = [
      'src/components/kiosk/TouchlessGestureHUD.tsx',
      'src/lib/handPoseClassifier.ts',
      'src/lib/touchlessGestureEngine.ts',
      'src/hooks/useTouchlessGestures.ts',
    ];
    const emojiOrArrowRegex = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|\\rightarrow|\$\\rightarrow\$/u;

    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
      expect(emojiOrArrowRegex.test(content), `Found forbidden character in ${relPath}`).toBe(
        false
      );
    }
  });

  test('local MediaPipe model and WASM runtime assets are served by Vite', async ({ request }) => {
    const modelRes = await request.head('/mediapipe/models/hand_landmarker.task');
    expect(modelRes.ok()).toBe(true);

    const wasmJsRes = await request.head('/mediapipe/wasm/vision_wasm_internal.js');
    expect(wasmJsRes.ok()).toBe(true);
  });
});
