import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Facilitator Kiosk Mobile Header & Anti-Clipping', () => {
  const matchId = 'kiosk-mobile-test-01';

  test.beforeEach(async ({ page }) => {
    // Mock match data with the exact scenario from user's bug report:
    // Exhibition tournament name, CNH vs CAH SQUAD, player with 'Torres, Juan'
    await page.route('**/rest/v1/matches*', async (route) => {
      const url = route.request().url();
      if (url.includes('id=eq.') || url.includes('/match/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: matchId,
            round: 'Period 1',
            status: 'Ongoing',
            team_a_score: 0,
            team_b_score: 0,
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
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/match_score_events*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'r1',
            team_id: 'team-cah',
            player_id: 'p1',
            jersey_number: 67,
            is_starter: true,
            status: 'Approved',
            users: { full_name: 'Torres, Juan' },
          },
        ]),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        'psu_dev_impersonated_persona',
        JSON.stringify({
          id: '95f03009-c970-4840-9e90-5116237f0b5d',
          full_name: 'Dr. Ramon Bautista',
          email: 'sports.director@psu.palawan.edu.ph',
          role: 'admin',
          is_verified: true,
          persona_label: 'Admin (Sports Director)',
        })
      );
      localStorage.setItem('psu_theme', 'dark');
      document.documentElement.classList.add('dark');
    });
  });

  test('Mobile viewport (375x812) header does not spill vertically and roster chip has no trailing comma', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/match/${matchId}/kiosk`);
    await page.waitForLoadState('networkidle');

    // Verify tournament name is visible and not broken into 1-char vertical spill
    const tournamentHeading = page.locator('h1', { hasText: 'EXHIBITION / GAME TEST' });
    await expect(tournamentHeading).toBeVisible();

    // Check header bounding box height: must be compact (<= 80px), never 300px
    const header = page.locator('header');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBeLessThanOrEqual(85);

    // Verify view tabs (Both, CNH, CAH) and layout buttons (Auto, Wide, Stack) are visible and not overlapping
    await expect(page.getByRole('button', { name: 'Both' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stack' })).toBeVisible();

    // Verify player chip is #67 Torres (WITHOUT comma)
    const playerChip = page.locator('button', { hasText: '#67' });
    await expect(playerChip).toBeVisible();
    const chipText = await playerChip.innerText();
    expect(chipText).not.toContain(',');
    expect(chipText).toContain('Torres');

    // Verify Deduction button does not clip
    await expect(page.getByText('Deduct / Correct').first()).toBeVisible();

    // Take screenshot to verify anti-clipping
    const screenshotDir = 'C:/Users/Marco/.gemini/antigravity/brain/472be629-050a-48a2-8ad9-1c9920850f1e/screenshots/kiosk';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    await page.screenshot({
      path: path.join(screenshotDir, 'kiosk-mobile-fixed.png'),
      fullPage: false,
    });
  });
});
