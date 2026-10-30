import { test, expect } from '@playwright/test';

test.describe('Substitution Function in Kiosk and Focus View (StadiumDisplay)', () => {
  const matchId = 'match-sub-test-01';

  test.beforeEach(async ({ page }) => {
    // 1. Mock match and roster data with 5 starters and 1 bench player
    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: matchId,
          round: 'Quarterfinals',
          status: 'Ongoing',
          team_a_score: 54,
          team_b_score: 48,
          team_a_id: 'team-a-sub',
          team_b_id: 'team-b-sub',
          active_scorekeeper_id: '95f03009-c970-4840-9e90-5116237f0b5d',
          team_a: { name: 'CCJE Eagles', college_id: 'col-1' },
          team_b: { name: 'CEAT Titans', college_id: 'col-2' },
          tournament_id: 'tourn-sub',
          tournament: { name: 'PSU Intramurals 2026', sport: 'Basketball' },
        }),
      });
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', team_id: 'team-a-sub', player_id: 'p1', jersey_number: 10, is_starter: true, status: 'Approved', users: { full_name: 'Mark Reyes' } },
          { id: 'r2', team_id: 'team-a-sub', player_id: 'p2', jersey_number: 11, is_starter: true, status: 'Approved', users: { full_name: 'Active Player 2' } },
          { id: 'r3', team_id: 'team-a-sub', player_id: 'p3', jersey_number: 12, is_starter: true, status: 'Approved', users: { full_name: 'Active Player 3' } },
          { id: 'r4', team_id: 'team-a-sub', player_id: 'p4', jersey_number: 13, is_starter: true, status: 'Approved', users: { full_name: 'Active Player 4' } },
          { id: 'r5', team_id: 'team-a-sub', player_id: 'p5', jersey_number: 14, is_starter: true, status: 'Approved', users: { full_name: 'Active Player 5' } },
          { id: 'r6', team_id: 'team-a-sub', player_id: 'p6', jersey_number: 23, is_starter: false, status: 'Approved', users: { full_name: 'Derrick Rose' } },
        ]),
      });
    });

    // Seed dev impersonated persona as admin/facilitator
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
    });
  });

  test('1. Facilitator Kiosk opens substitution dialog and confirms sub without looping', async ({ page }) => {
    await page.goto(`/match/${matchId}/kiosk`);
    await page.waitForLoadState('networkidle');

    // Click "Sub" on Team A
    const subBtn = page.getByRole('button', { name: /Sub/i }).first();
    await expect(subBtn).toBeVisible({ timeout: 10000 });
    await subBtn.click();

    // Substitution modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Quick Substitution')).toBeVisible();

    // Select out player (Mark Reyes from on-court starters)
    const outPlayerBtn = modal.getByRole('button', { name: /Mark Reyes/i });
    await expect(outPlayerBtn).toBeVisible();
    await outPlayerBtn.click();

    // Select in player (Derrick Rose from bench)
    const inPlayerBtn = modal.getByRole('button', { name: /Derrick Rose/i });
    await expect(inPlayerBtn).toBeVisible();
    await inPlayerBtn.click();

    // Click Confirm Substitution
    const confirmBtn = modal.getByRole('button', { name: /Confirm Substitution/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Modal should close immediately and NOT re-open
    await expect(modal).not.toBeVisible();
  });

  test('2. Stadium Display renders substitution banner and dismisses without infinite loop', async ({ page }) => {
    await page.goto(`/match/${matchId}/display`);
    await page.waitForLoadState('networkidle');

    // Verify Stadium Display is loaded
    await expect(page.getByText('CCJE Eagles')).toBeVisible({ timeout: 10000 });

    // Dispatch simulated substitution alert event
    await page.evaluate((mId) => {
      window.dispatchEvent(
        new CustomEvent('psu:substitution_alert', {
          detail: {
            id: `sub-${Date.now()}`,
            match_id: mId,
            team: 'a',
            teamName: 'CCJE Eagles',
            outPlayer: 'Mark Reyes',
            inPlayer: 'Derrick Rose',
            outJersey: '10',
            inJersey: '23',
            timestamp: Date.now(),
          },
        })
      );
    }, matchId);

    // Substitution alert banner should appear on screen
    const subBanner = page.locator('aside[aria-label="Courtside Player Substitution Alert"]');
    await expect(subBanner).toBeVisible({ timeout: 5000 });
    await expect(subBanner.getByText('PLAYER SUBSTITUTION')).toBeVisible();
    await expect(subBanner.getByText('Mark Reyes')).toBeVisible();
    await expect(subBanner.getByText('Derrick Rose')).toBeVisible();

    // Ensure dismiss button closes it cleanly
    const closeBtn = subBanner.getByRole('button', { name: /Dismiss Alert/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Banner should disappear and NOT loop back
    await expect(subBanner).not.toBeVisible();
  });

  test('3. Stadium Display auto-dismisses substitution banner cleanly after duration', async ({ page }) => {
    await page.goto(`/match/${matchId}/display`);
    await page.waitForLoadState('networkidle');

    // Dispatch substitution alert with short simulated duration
    const now = Date.now();
    await page.evaluate(
      ({ mId, timestamp }) => {
        window.dispatchEvent(
          new CustomEvent('psu:substitution_alert', {
            detail: {
              id: `sub-auto-${timestamp}`,
              match_id: mId,
              team: 'b',
              teamName: 'CEAT Titans',
              outPlayer: 'Player Out',
              inPlayer: 'Player In',
              timestamp,
            },
          })
        );
      },
      { mId: matchId, timestamp: now }
    );

    const subBanner = page.locator('aside[aria-label="Courtside Player Substitution Alert"]');
    await expect(subBanner).toBeVisible({ timeout: 5000 });

    // Wait for the timer to expire (6s duration + 0.5s safety margin).
    // In the old buggy code, it reset to 100% every second and NEVER disappeared!
    await expect(subBanner).not.toBeVisible({ timeout: 12000 });
  });
});
