import { test, expect } from '@playwright/test';

test.describe('Courtside Scoring, Arena Display, Match Officials & Campus Enhancements', () => {
  const matchId = 'match-enhancements-01';

  test.beforeEach(async ({ page }) => {
    // Mock match data
    await page.route('**/rest/v1/matches*', async (route) => {
      const url = route.request().url();
      if (url.includes('id=eq.') || url.includes('/match/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: matchId,
            round: 'Semifinals',
            status: 'Ongoing',
            team_a_score: 30,
            team_b_score: 31,
            team_a_id: 'team-scorpions',
            team_b_id: 'team-enforcers',
            active_scorekeeper_id: '95f03009-c970-4840-9e90-5116237f0b5d',
            team_a: { name: 'CEAT RED SCORPIONS', college_id: 'col-ceat' },
            team_b: { name: 'CCJE LAW ENFORCERS', college_id: 'col-ccje' },
            tournament_id: 'tourn-binturangan-2026',
            tournament: {
              id: 'tourn-binturangan-2026',
              name: "PSU BINTURUNGAN 2026 - MEN'S VOLLEYBALL TOURNAMENT",
              sport: 'Volleyball',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: matchId,
              round: 'Semifinals',
              status: 'Ongoing',
              team_a_score: 30,
              team_b_score: 31,
              team_a_id: 'team-scorpions',
              team_b_id: 'team-enforcers',
              active_scorekeeper_id: '95f03009-c970-4840-9e90-5116237f0b5d',
              team_a: { name: 'CEAT RED SCORPIONS', college_id: 'col-ceat' },
              team_b: { name: 'CCJE LAW ENFORCERS', college_id: 'col-ccje' },
              tournament_id: '550e8400-e29b-41d4-a716-446655440000',
              designated_facilitator_id: null,
            },
          ]),
        });
      }
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'evt-1',
            match_id: matchId,
            description: 'CCJE Law Enforcers — #7 Crispus Allen Perez (CCJE) scored 1 PTS (Defensive Block Point (+1))!',
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/rest/v1/match_score_events*', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'score-evt-1' }) });
      }
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
          { id: 'r1', team_id: 'team-scorpions', player_id: 'p1', jersey_number: 1, is_starter: true, status: 'Approved', users: { full_name: 'Ezekiel Santos' } },
          { id: 'r2', team_id: 'team-scorpions', player_id: 'p2', jersey_number: 3, is_starter: true, status: 'Approved', users: { full_name: 'Carlo Mendoza' } },
          { id: 'r3', team_id: 'team-scorpions', player_id: 'p3', jersey_number: 5, is_starter: true, status: 'Approved', users: { full_name: 'Janzen Cruz' } },
          { id: 'r4', team_id: 'team-scorpions', player_id: 'p4', jersey_number: 7, is_starter: true, status: 'Approved', users: { full_name: 'Renz Garcia' } },
          { id: 'r5', team_id: 'team-scorpions', player_id: 'p5', jersey_number: 8, is_starter: true, status: 'Approved', users: { full_name: 'Daniel Ramos' } },
          { id: 'r6', team_id: 'team-scorpions', player_id: 'p6', jersey_number: 10, is_starter: true, status: 'Approved', users: { full_name: 'Francis Torres' } },
          { id: 'r7', team_id: 'team-enforcers', player_id: 'p7', jersey_number: 7, is_starter: true, status: 'Approved', users: { full_name: 'Crispus Allen Perez' } },
        ]),
      });
    });

    // Seed dev impersonation
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

  test('1. Facilitator Kiosk opens post-score credit modal and attributes player point', async ({ page }) => {
    await page.goto(`/match/${matchId}/kiosk`);
    await page.waitForLoadState('networkidle');

    // Click score action button on Team A (+1 KILL / ATTACK)
    const scoreBtn = page.getByRole('button', { name: /\+1\s+KILL\s*\/\s*ATTACK/i }).first();
    await expect(scoreBtn).toBeVisible({ timeout: 10000 });
    await scoreBtn.click();

    // The KioskScoreCreditModal should immediately appear
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Who Scored This Point\?/i)).toBeVisible();
    await expect(modal.getByText('CEAT RED SCORPIONS').first()).toBeVisible();

    // Select on-court athlete #1 Ezekiel Santos
    const playerCard = modal.getByRole('button', { name: /Ezekiel Santos/i });
    await expect(playerCard).toBeVisible();
    await playerCard.click();

    // Modal should close and score is registered
    await expect(modal).not.toBeVisible();
  });

  test('2. Stadium Display renders emphasized ticker and header without overlapping Live badge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/match/${matchId}/display`);
    await page.waitForLoadState('networkidle');

    // Verify tournament title is visible
    const title = page.getByRole('heading', { name: /PSU BINTURUNGAN 2026/i });
    await expect(title).toBeVisible({ timeout: 10000 });

    // Verify LIVE ARENA FEED badge is visible
    const liveBadge = page.getByText('LIVE ARENA FEED');
    await expect(liveBadge).toBeVisible();

    // Check bounding boxes to ensure NO horizontal overlap between tournament title and live badge
    const titleBox = await title.boundingBox();
    const liveBox = await liveBadge.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(liveBox).not.toBeNull();

    if (titleBox && liveBox) {
      // Title right edge must be to the left of the live badge left edge
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(liveBox.x + 5);
    }

    // Verify emphasized bottom ticker
    const ticker = page.locator('footer').getByText('LIVE ACTION');
    await expect(ticker).toBeVisible();
    await expect(page.getByText(/Crispus Allen Perez/i)).toBeVisible();
  });

  test('3. Register page displays PSU Campus dropdown when Student Athlete is selected', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Verify PSU Campus field is present for default Student Athlete
    const campusSelect = page.getByRole('combobox').filter({ hasText: /PSU Main Campus/i });
    await expect(campusSelect).toBeVisible({ timeout: 10000 });

    // Click campus selector and verify provincial campuses are listed
    await campusSelect.click();
    await expect(page.getByRole('option', { name: /PSU Narra/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /PSU Coron/i })).toBeVisible();
  });

  test('4. Facilitators Tab in Tournament Management displays tournament name instead of UUID', async ({ page }) => {
    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: "PSU Binturangan 2026",
            sport: 'Basketball',
            status: 'Ongoing',
            type: 'single_elimination',
          },
        ]),
      });
    });

    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');

    // Click on Match Officials tab
    const officialsTab = page.getByRole('tab', { name: /Match Officials/i });
    await expect(officialsTab).toBeVisible({ timeout: 10000 });
    await officialsTab.click();
    // Verify the tournament dropdown shows "PSU Binturangan 2026 (Basketball)" and NOT the UUID
    await expect(page.getByText('PSU Binturangan 2026 (Basketball)')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('550e8400-e29b-41d4-a716-446655440000')).not.toBeVisible();
  });
});
