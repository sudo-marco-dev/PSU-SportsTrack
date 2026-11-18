/**
 * Multimodal Voice Scoring Automated Test Suite
 * PSU SportsTrack - HCI Capstone Verification
 */

import { test, expect } from '@playwright/test';
import { parseVoiceCommand } from '../src/lib/voiceCommandParser';
import {
  extractCleanSpeechTranscript,
  preparePcm16kForWhisper,
  cleanWhisperTranscript,
} from '../src/lib/mobileSpeechEngine';

test.describe('Multimodal Voice Parser Grammar & Intent Unit Tests', () => {
  const matchContext = {
    teamAName: 'College of Engineering and Technology',
    teamBName: 'College of Business and Accountancy',
    sport: 'Basketball',
  };

  test('1. Accurately parses field goal points (+2) for Team A', () => {
    const result = parseVoiceCommand('Add 2 points to Team A', matchContext);
    expect(result.intent).toBe('score');
    expect(result.team).toBe('a');
    expect(result.points).toBe(2);
    expect(result.actionType).toBe('Field Goal');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('2. Accurately parses player-specific scoring (Give 2 points to Team A player #1)', () => {
    const result = parseVoiceCommand('Give 2 points to Team A player #1', matchContext);
    expect(result.intent).toBe('score');
    expect(result.team).toBe('a');
    expect(result.points).toBe(2);
    expect(result.playerNumber).toBe(1);
  });

  test('3. Accurately parses player substitution (Substitute player 1 to player 2 from Team A)', () => {
    const result = parseVoiceCommand('Substitute player 1 to player 2 from Team A', matchContext);
    expect(result.intent).toBe('substitution');
    expect(result.team).toBe('a');
    expect(result.subOutPlayerNumber).toBe(1);
    expect(result.subInPlayerNumber).toBe(2);
  });

  test('4. Accurately parses 3-pointer (+3) for Team B using college name', () => {
    const result = parseVoiceCommand('3 pointer for College of Business and Accountancy', matchContext);
    expect(result.intent).toBe('score');
    expect(result.team).toBe('b');
    expect(result.points).toBe(3);
    expect(result.actionType).toBe('3-Pointer');
  });

  test('5. Accurately parses free throw (+1) for Team A', () => {
    const result = parseVoiceCommand('Free throw Team A', matchContext);
    expect(result.intent).toBe('score');
    expect(result.team).toBe('a');
    expect(result.points).toBe(1);
    expect(result.actionType).toBe('Free Throw');
  });

  test('6. Accurately parses timeout command', () => {
    const result = parseVoiceCommand('Timeout Team A', matchContext);
    expect(result.intent).toBe('timeout');
    expect(result.team).toBe('a');
  });

  test('7. Accurately parses foul with player jersey number (Foul on player 1)', () => {
    const result = parseVoiceCommand('Foul on player 1 for Team B', matchContext);
    expect(result.intent).toBe('foul');
    expect(result.team).toBe('b');
    expect(result.playerNumber).toBe(1);
  });

  test('8. Accurately parses clock controls (Pause clock)', () => {
    const result = parseVoiceCommand('Pause clock', matchContext);
    expect(result.intent).toBe('clock');
    expect(result.clockAction).toBe('pause');
  });

  test('9. Accurately parses score correction / deduction', () => {
    const result = parseVoiceCommand('Score correction deduct Team A', matchContext);
    expect(result.intent).toBe('deduct');
    expect(result.team).toBe('a');
  });

  test('10. Accurately parses undo last action', () => {
    const result = parseVoiceCommand('Undo last score', matchContext);
    expect(result.intent).toBe('undo');
  });

  test('11. Accurately parses live courtside commentary', () => {
    const result = parseVoiceCommand('Commentary: Fast break dunk on the counter attack', matchContext);
    expect(result.intent).toBe('commentary');
    expect(result.notes).toContain('Fast break dunk');
  });

  test('12. Accurately parses game pause/resume commands without saying "clock"', () => {
    const pauseCmd = parseVoiceCommand('Pause game', matchContext);
    expect(pauseCmd.intent).toBe('clock');
    expect(pauseCmd.clockAction).toBe('pause');

    const resumeCmd = parseVoiceCommand('Resume match', matchContext);
    expect(resumeCmd.intent).toBe('clock');
    expect(resumeCmd.clockAction).toBe('resume');
  });

  test('13. Accurately parses hands-free player selection and exact deduction points', () => {
    const pickCmd = parseVoiceCommand('Pick player 5 Team A', matchContext);
    expect(pickCmd.intent).toBe('select_player');
    expect(pickCmd.team).toBe('a');
    expect(pickCmd.playerNumber).toBe(5);

    const deductCmd = parseVoiceCommand('Deduct 2 points from Team B', matchContext);
    expect(deductCmd.intent).toBe('deduct');
    expect(deductCmd.team).toBe('b');
    expect(deductCmd.points).toBe(2);

    const subInForCmd = parseVoiceCommand('Sub in 10 for 4 Team A', matchContext);
    expect(subInForCmd.intent).toBe('substitution');
    expect(subInForCmd.team).toBe('a');
    expect(subInForCmd.subInPlayerNumber).toBe(10);
    expect(subInForCmd.subOutPlayerNumber).toBe(4);
  });

  test('14. Deduplicates Android Chrome cumulative speech result chunks and cleans Whisper transcripts', () => {
    const mockAndroidCumulativeEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Give 2' }], { isFinal: false }),
        Object.assign([{ transcript: 'Give 2 points' }], { isFinal: false }),
        Object.assign([{ transcript: 'Give 2 points to Team A' }], { isFinal: true }),
      ],
    };
    const extracted = extractCleanSpeechTranscript(mockAndroidCumulativeEvent);
    expect(extracted.final).toBe('Give 2 points to Team A');

    // Resampling & silence trimming check
    const raw48k = new Float32Array(48000); // 1 second at 48kHz
    for (let i = 12000; i < 36000; i++) {
      raw48k[i] = Math.sin(i * 0.1) * 0.25;
    }
    const { pcm16k, maxRms } = preparePcm16kForWhisper([raw48k], 48000);
    expect(maxRms).toBeGreaterThan(0.05);
    expect(pcm16k.length).toBeGreaterThan(4000);
    expect(pcm16k.length).toBeLessThanOrEqual(16000);

    // Whisper hallucination filter
    expect(cleanWhisperTranscript('[BLANK_AUDIO]')).toBe('');
    expect(cleanWhisperTranscript('(silence)')).toBe('');
    expect(cleanWhisperTranscript('[Music] Add 2 points to Team A')).toBe('Add 2 points to Team A');
  });
});

test.describe('Multimodal Voice Scoring UI & Mobile Chrome Anti-Glitch Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'psu_dev_impersonated_persona',
        JSON.stringify({
          id: '95f03009-c970-4840-9e90-5116237f0b5d',
          full_name: 'Dr. Ramon Bautista',
          email: 'sports.director@psu.palawan.edu.ph',
          role: 'admin',
          is_verified: true,
          department: 'University Sports Development Office',
          employee_id: 'EMP-2024-0001',
          persona_label: 'Admin (Sports Director)',
        })
      );
    });
  });

  test('Public Voice Assistant on Mobile Chrome survives instant webkitSpeechRecognition "aborted" without card glitch or state revert', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Simulate Android Chrome Mobile where webkitSpeechRecognition immediately fires onstart -> onerror('aborted') -> onend in 30ms,
    // while getUserMedia provides live microphone audio that transcribes to "Who won last week?"
    await page.addInitScript(() => {
      class AbortingMobileSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'en-US';
        onstart: (() => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          setTimeout(() => {
            this.onstart?.();
            setTimeout(() => {
              this.onerror?.({ error: 'aborted' });
              this.onend?.();
            }, 25);
          }, 5);
        }
        stop() {}
      }

      (window as any).webkitSpeechRecognition = AbortingMobileSpeechRecognition;
      (window as any).SpeechRecognition = AbortingMobileSpeechRecognition;

      // Provide synthetic microphone stream and mock Whisper transcriber for deterministic test speed
      (window as any).__psuMockAudioTranscriber = async () => 'Who won last week?';

      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.25;
          const dest = ctx.createMediaStreamDestination();
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          return dest.stream;
        };
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await expect(voiceBtn).toBeVisible({ timeout: 10000 });
    await voiceBtn.click();

    const speakToggleBtn = page.locator('[data-testid="btn-hud-speak-toggle"]');
    await expect(speakToggleBtn).toBeVisible();
    await expect(speakToggleBtn).toContainText('Speak');

    const voiceFeedCard = speakToggleBtn.locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
    const beforeBox = await voiceFeedCard.boundingBox();
    expect(beforeBox).not.toBeNull();

    // Tap Speak on mobile
    await speakToggleBtn.click();

    // Wait 120ms (well past the 30ms webkitSpeechRecognition 'aborted' + 'onend' event!)
    await page.waitForTimeout(120);

    // Button MUST STILL be in "Stop" state (did NOT revert back to "Speak"!)
    await expect(speakToggleBtn).toContainText('Stop');

    // Card height MUST NOT have jumped or glitched when switching to Listening state
    const duringBox = await voiceFeedCard.boundingBox();
    expect(duringBox).not.toBeNull();
    expect(Math.abs((duringBox?.height || 0) - (beforeBox?.height || 0))).toBeLessThanOrEqual(2);

    // Now tap "Stop" to finish and transcribe the captured microphone audio
    await speakToggleBtn.click();

    // Verify the transcribed query ("Who won last week?") was processed and rendered the Direct Answer card!
    const directCard = page.locator('[data-testid="hud-direct-answer-card"]');
    await expect(directCard).toBeVisible({ timeout: 10000 });
  });

  test('Kiosk Voice Scoring Widget on Mobile Chrome survives premature onend / aborted without card glitch or state revert', async ({
    page,
  }) => {
    const matchId = 'kiosk-mobile-voice-test-01';
    await page.setViewportSize({ width: 375, height: 812 });

    await page.route('**/rest/v1/matches*', async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: matchId }]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: matchId,
          round: 'Period 1',
          status: 'Ongoing',
          team_a_score: 10,
          team_b_score: 8,
          team_a_id: 'team-cnhs',
          team_b_id: 'team-cah',
          active_scorekeeper_id: '95f03009-c970-4840-9e90-5116237f0b5d',
          team_a: { name: 'CNHS', college_id: 'col-cnhs' },
          team_b: { name: 'CAH SQUAD', college_id: 'col-cah' },
          tournament_id: 'tourn-exhibition-test',
          tournament: {
            id: 'tourn-exhibition-test',
            name: 'EXHIBITION / GAME TEST',
            sport: 'Basketball',
          },
          designated_facilitator_id: '95f03009-c970-4840-9e90-5116237f0b5d',
          designated_facilitator: {
            full_name: 'Dr. Ramon Bautista',
          },
        }),
      });
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'evt-1', match_id: matchId, description: 'CNHS scored +2' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/match_score_events*', async (route) => {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'se-1' }),
      });
    });

    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Simulate Android Chrome's silent premature onend (onstart -> onend in 35ms with 0 words)
    await page.addInitScript(() => {
      class SilentPrematureEndSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'en-US';
        onstart: (() => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          setTimeout(() => {
            this.onstart?.();
            setTimeout(() => {
              this.onend?.();
            }, 30);
          }, 5);
        }
        stop() {}
      }

      (window as any).webkitSpeechRecognition = SilentPrematureEndSpeechRecognition;
      (window as any).SpeechRecognition = SilentPrematureEndSpeechRecognition;
      (window as any).__psuMockAudioTranscriber = async () => 'Add 2 points to CNHS';

      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.25;
          const dest = ctx.createMediaStreamDestination();
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          return dest.stream;
        };
      }
    });

    await page.goto(`/match/${matchId}/kiosk`, { waitUntil: 'domcontentloaded' });

    const voiceWidget = page.locator('[data-testid="voice-scoring-widget"]');
    await expect(voiceWidget).toBeVisible({ timeout: 10000 });

    const toggleBtn = page.locator('[data-testid="btn-toggle-voice-scoring"]');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText('Start Voice');

    const beforeWidgetBox = await voiceWidget.boundingBox();
    expect(beforeWidgetBox).not.toBeNull();

    // Tap Start Voice on mobile Kiosk
    await toggleBtn.click();

    // Wait 120ms (past the 35ms premature onend!)
    await page.waitForTimeout(120);

    // Button MUST remain "Stop Voice" (did NOT glitch back to "Start Voice"!)
    await expect(toggleBtn).toContainText('Stop Voice');

    // Widget height MUST NOT have jumped or glitched
    const duringWidgetBox = await voiceWidget.boundingBox();
    expect(duringWidgetBox).not.toBeNull();
    expect(Math.abs((duringWidgetBox?.height || 0) - (beforeWidgetBox?.height || 0))).toBeLessThanOrEqual(2);

    // Tap Stop Voice to commit & transcribe the recorded speech ("Add 2 points to CNHS")
    await toggleBtn.click();

    await expect(voiceWidget).toContainText('Recorded +2 for CNHS', { timeout: 8000 });
  });
});
