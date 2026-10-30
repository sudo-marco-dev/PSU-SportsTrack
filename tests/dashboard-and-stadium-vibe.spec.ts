import { test, expect } from '@playwright/test';

test.describe('Dashboard Order & Stadium Display Vibe Tests', () => {
  test('Dashboard displays Live & Upcoming Games before Coming Soon • Upcoming Events in DOM order', async ({ page }) => {
    // Route mock data
    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tourn-draft-1',
            name: 'PSU Binturungan 2027 - Basketball',
            sport: 'Basketball',
            status: 'Draft',
            type: 'Binturungan',
            start_date: '2026-10-29',
            is_deleted: false,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'match-live-1',
            team_a_score: 15,
            team_b_score: 12,
            status: 'Ongoing',
            round: 'Semifinals',
            venue: 'PSU Gymnasium',
            team_a: { name: 'CCJE Law Enforcers' },
            team_b: { name: 'CBPA Aguila' },
            tournament: { name: 'PSU Games', sport: 'Basketball', type: 'Collegiate' },
          },
        ]),
      });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/');

    const liveHeading = page.locator('h2:has-text("Live & Upcoming Games")');
    const comingSoonHeading = page.locator('h2:has-text("Coming Soon • Upcoming Events")');

    await expect(liveHeading).toBeVisible();
    await expect(comingSoonHeading).toBeVisible();

    // Verify DOM order: liveHeading must appear before comingSoonHeading
    const isLiveFirst = await page.evaluate(() => {
      const live = Array.from(document.querySelectorAll('h2')).find((el) =>
        el.textContent?.includes('Live & Upcoming Games')
      );
      const comingSoon = Array.from(document.querySelectorAll('h2')).find((el) =>
        el.textContent?.includes('Coming Soon • Upcoming Events')
      );
      if (!live || !comingSoon) return false;
      return (
        Boolean(live.compareDocumentPosition(comingSoon) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    });

    expect(isLiveFirst).toBe(true);
  });

  test('Stadium Display has dedicated top HUD shelf and no truncation on play-by-play ticker', async ({ page }) => {
    const mockMatchId = 'test-stadium-vibe-match';

    await page.route(`**/rest/v1/matches*id=eq.${mockMatchId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockMatchId,
          round: 'Finals',
          status: 'Ongoing',
          team_a_score: 30,
          team_b_score: 41,
          team_a_id: 'team-a',
          team_b_id: 'team-b',
          venue: 'PSU Gymnasium',
          team_a: { name: 'CBPA Aguila' },
          team_b: { name: 'CCJE Law Enforcers' },
          tournament_id: 'tourn-1',
          tournament: {
            name: 'PSU Sports Track Live Tournament 2026',
            sport: 'Volleyball',
          },
        }),
      });
    });

    await page.route(`**/rest/v1/match_events*match_id=eq.${mockMatchId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'event-1',
            match_id: mockMatchId,
            description: 'CCJE LAW ENFORCERS - #12 Cruz, Christian (Defensive Block Point)',
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto(`/match/${mockMatchId}/display`);

    // Verify scores are rendered
    await expect(page.locator('text=30')).toBeVisible();
    await expect(page.locator('text=41')).toBeVisible();

    // Verify team headings
    await expect(page.getByRole('heading', { name: 'CBPA Aguila' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CCJE Law Enforcers' })).toBeVisible();

    // Verify timeout bars exist (3 bars per team)
    const timeoutBars = page.locator('span[title="Available Timeout"]');
    await expect(timeoutBars.first()).toBeVisible();

    // Verify Play-by-play ticker displays full text without truncation into "Defensive Block Poi..."
    const tickerEvent = page.locator('text=CCJE LAW ENFORCERS - #12 Cruz, Christian (Defensive Block Point)');
    await expect(tickerEvent).toBeVisible();

    // Verify the text does NOT contain truncated "..."
    const tickerText = await tickerEvent.textContent();
    expect(tickerText).not.toContain('Defensive Block Poi...');
    expect(tickerText).toContain('Defensive Block Point');
  });

  test('Stadium Display shows FINAL clock, MATCH WINNER badge, and colossal championship banner when match is Completed', async ({ page }) => {
    const mockMatchId = 'test-stadium-completed-match';

    await page.route(`**/rest/v1/matches*id=eq.${mockMatchId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockMatchId,
          round: 'Finals',
          status: 'Completed',
          team_a_score: 31,
          team_b_score: 54,
          team_a_id: 'team-a',
          team_b_id: 'team-b',
          venue: 'PSU Gymnasium',
          team_a: { name: 'CBPA Aguila' },
          team_b: { name: 'CCJE Law Enforcers' },
          tournament_id: 'tourn-1',
          tournament: {
            name: 'PSU Sports Track Live Tournament 2026',
            sport: 'Basketball',
          },
        }),
      });
    });

    await page.route(`**/rest/v1/match_events*match_id=eq.${mockMatchId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/match/${mockMatchId}/display`);

    // Verify FINAL LED clock text is displayed
    await expect(page.locator('text=FINAL').first()).toBeVisible();

    // Verify MATCH WINNER badge is displayed for Team B
    await expect(page.locator('text=MATCH WINNER')).toBeVisible();

    // Verify FINALIST badge is displayed for Team A
    await expect(page.locator('text=FINALIST')).toBeVisible();

    // Verify colossal championship victory banner
    await expect(page.locator('text=Official Match Result • Final Score Certified')).toBeVisible();
    await expect(page.locator('text=Champion:')).toBeVisible();

    // Verify bottom arena ticker displays OFFICIAL FINAL
    await expect(page.getByRole('contentinfo').getByText('OFFICIAL FINAL')).toBeVisible();
    await expect(page.locator('text=Final Result:')).toBeVisible();
  });

  test('Facilitator Kiosk disables all actions when match is Completed', async ({ page }) => {
    const mockMatchId = 'test-kiosk-completed-match';

    await page.route(`**/rest/v1/matches*id=eq.${mockMatchId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockMatchId,
          round: 'Finals',
          status: 'Completed',
          team_a_score: 31,
          team_b_score: 54,
          team_a_id: 'team-a',
          team_b_id: 'team-b',
          venue: 'PSU Gymnasium',
          team_a: { name: 'CBPA Aguila' },
          team_b: { name: 'CCJE Law Enforcers' },
          tournament_id: 'tourn-1',
          tournament: {
            name: 'PSU Sports Track Live Tournament 2026',
            sport: 'Basketball',
          },
        }),
      });
    });

    await page.route(`**/rest/v1/team_roster*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'roster-1',
            team_id: 'team-a',
            player_id: 'player-1',
            jersey_number: 10,
            status: 'Approved',
            users: { full_name: 'Dela Cruz, Juan' },
          },
          {
            id: 'roster-2',
            team_id: 'team-b',
            player_id: 'player-2',
            jersey_number: 23,
            status: 'Approved',
            users: { full_name: 'Santos, Christian' },
          },
        ]),
      });
    });

    await page.route(`**/rest/v1/match_events*match_id=eq.${mockMatchId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/match/${mockMatchId}/kiosk`);

    // Verify top locked banner is visible
    await expect(page.locator('text=Official Final • Scoring Console Locked')).toBeVisible();

    // Verify clock displays FINAL and clock button is disabled
    await expect(page.locator('text=FINAL').first()).toBeVisible();
    const clockButton = page.getByRole('button', { name: 'Locked' }).first();
    await expect(clockButton).toBeDisabled();

    // Verify score buttons (+1, +2, +3, etc.) are disabled
    const pointButtons = page.locator('button:has-text("+1"), button:has-text("+2"), button:has-text("+3")');
    const pointCount = await pointButtons.count();
    expect(pointCount).toBeGreaterThan(0);
    for (let i = 0; i < pointCount; i++) {
      await expect(pointButtons.nth(i)).toBeDisabled();
    }

    // Verify Foul buttons are disabled
    const foulButtons = page.locator('button:has-text("+ Foul"), button:has-text("+1")');
    const foulCount = await foulButtons.count();
    for (let i = 0; i < foulCount; i++) {
      await expect(foulButtons.nth(i)).toBeDisabled();
    }

    // Verify timeout buttons are disabled
    const timeoutButtons = page.locator('button:has-text("Call TO"), button:has-text("Call")');
    const timeoutCount = await timeoutButtons.count();
    for (let i = 0; i < timeoutCount; i++) {
      await expect(timeoutButtons.nth(i)).toBeDisabled();
    }

    // Verify sub buttons are disabled
    const subButtons = page.locator('button:has-text("Sub")');
    const subCount = await subButtons.count();
    for (let i = 0; i < subCount; i++) {
      await expect(subButtons.nth(i)).toBeDisabled();
    }
  });
});
