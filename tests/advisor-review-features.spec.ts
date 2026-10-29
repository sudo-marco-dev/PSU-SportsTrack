import { test, expect } from '@playwright/test';

test.describe('Advisor Review Features & Light Mode Legal Suite', () => {
  test('1. Live game card renders "Track Live Scores" button label', async ({ page }) => {
    // Setup mock user & active match
    const mockUser = {
      id: 'athlete-user-1',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'athlete@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Maria Santos' },
      created_at: new Date().toISOString(),
    };

    const mockProfile = {
      id: 'athlete-user-1',
      role: 'player_student',
      full_name: 'Maria Santos',
      email: 'athlete@psu.palawan.edu.ph',
      is_verified: true,
      account_status: 'active',
      college_id: 'col-1',
      colleges: { college_name: 'College of Sciences', code: 'CS' },
    };

    const mockMatches = [
      {
        id: 'match-live-101',
        tournament_id: 'tourn-1',
        team_a_id: 'team-a-1',
        team_b_id: 'team-b-1',
        team_a_score: 29,
        team_b_score: 25,
        status: 'Ongoing',
        round: 'Semifinals',
        venue: 'PSU Sports Complex - Arena Court A',
        scheduled_time: new Date().toISOString(),
        tournament: {
          id: 'tourn-1',
          name: 'PSU Binturungan 2026 - Volleyball',
          sport: 'Volleyball',
          type: 'Binturungan',
          status: 'Ongoing',
        },
        team_a: { id: 'team-a-1', name: 'CEAT Red Scorpions' },
        team_b: { id: 'team-b-1', name: 'CCJE Law Enforcers' },
      },
    ];

    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockSession = {
      access_token: 'fake-athlete-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: futureExpiresAt,
      user: mockUser,
    };

    await page.addInitScript(({ session }) => {
      window.localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/user')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) });
      }
    });

    await page.route('**/rest/v1/users*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProfile) });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMatches) });
    });

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/');

    // Locate the match card button
    const trackScoresBtn = page.getByRole('button', { name: /Track Live Scores/i });
    await expect(trackScoresBtn).toBeVisible({ timeout: 10000 });
    await expect(trackScoresBtn).toHaveText(/Track Live Scores/i);

    // Verify it doesn't say "Watch Live Tracker" anymore
    const oldBtn = page.getByRole('button', { name: /Watch Live Tracker/i });
    await expect(oldBtn).toHaveCount(0);
  });

  test('2. Draft tournament card disables Match Arena button and explains recruitment phase', async ({ page }) => {
    const mockDraftTournaments = [
      {
        id: 'draft-tourn-basketball',
        name: 'PSU BINTURUNGAN 2027 - BASKETBALL',
        sport: 'Basketball',
        type: 'Binturungan',
        status: 'Draft',
        start_date: '2026-10-29',
        end_date: '2026-11-02',
        is_deleted: false,
      },
    ];

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDraftTournaments) });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/');

    // Click on the Coming Soon draft tournament card
    const tournamentCard = page.locator('text=PSU BINTURUNGAN 2027 - BASKETBALL').first();
    await expect(tournamentCard).toBeVisible({ timeout: 10000 });
    await tournamentCard.click();

    // Verify modal is displayed
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Button should be disabled with clear text
    const arenaBtn = modal.getByRole('button', { name: /Match Arena Unavailable/i });
    await expect(arenaBtn).toBeVisible();
    await expect(arenaBtn).toBeDisabled();
    await expect(modal.getByText(/Match arena and fixtures will unlock once the recruitment phase concludes/i)).toBeVisible();
  });

  test('3. Navigating to /matches redirects smoothly to /explorer without 404', async ({ page }) => {
    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/matches');
    await page.waitForURL('**/explorer', { timeout: 10000 });
    expect(page.url()).toContain('/explorer');

    // Confirm no 404 message exists
    await expect(page.locator('text=FIXTURE NOT FOUND')).toHaveCount(0);
  });

  test('4. Legal page in Light Mode renders with crisp white background (no dark slate discoloration)', async ({ page }) => {
    await page.route('**/rest/v1/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // Explicitly set theme to light
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    await page.goto('/legal');

    const scrollContainer = page.locator('[data-testid="legal-scroll-container"]');
    await expect(scrollContainer).toBeVisible({ timeout: 10000 });

    // Assert that the container has a clean light/white background and not dark slate
    const bgColor = await scrollContainer.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // In light mode with `bg-white`, the backgroundColor is `rgb(255, 255, 255)`
    expect(bgColor).toBe('rgb(255, 255, 255)');

    // Verify section headings and text have high contrast
    const heading = scrollContainer.locator('h3').first();
    await expect(heading).toBeVisible();
    const headingColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    // In light mode, text-slate-900 is rgb(15, 23, 42)
    expect(headingColor).toBe('rgb(15, 23, 42)');
  });

  test('5. Notification Bell is visible in navigation and renders popover list', async ({ page }) => {
    const mockUser = {
      id: 'athlete-user-2',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'athlete2@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Carlos Yulo' },
      created_at: new Date().toISOString(),
    };

    const mockNotifications = [
      {
        id: 'notif-1',
        user_id: 'athlete-user-2',
        title: 'New Squad Recruitment Invite: CEAT Red Scorpions',
        message: 'Coach Coach Mike has invited you to join the official team roster.',
        type: 'coach_invite',
        link: '/athletics',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        user_id: 'athlete-user-2',
        title: 'Athletic Credential Verification Approved!',
        message: 'Your athlete verification has been approved by the sports administration.',
        type: 'verification_approved',
        link: '/profile',
        is_read: true,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockSession = {
      access_token: 'fake-athlete-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: futureExpiresAt,
      user: mockUser,
    };

    await page.addInitScript(({ session }) => {
      window.localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/user')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) });
      }
    });

    await page.route('**/rest/v1/users*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'athlete-user-2', full_name: 'Carlos Yulo', email: 'athlete2@psu.palawan.edu.ph', role: 'player_student', is_verified: true }),
      });
    });

    await page.route('**/rest/v1/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockNotifications) });
    });

    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const desktopBellBtn = page.locator('aside').getByRole('button', { name: /View notifications/i });
    await expect(desktopBellBtn).toBeVisible({ timeout: 10000 });

    // Open notifications popover in desktop sidebar
    await desktopBellBtn.click();

    // Verify notifications popover content
    const popoverHeading = page.getByText('Notifications', { exact: true });
    await expect(popoverHeading).toBeVisible();
    await expect(page.getByText('New Squad Recruitment Invite: CEAT Red Scorpions')).toBeVisible();
    await expect(page.getByText('Athletic Credential Verification Approved!')).toBeVisible();

    // Verify popover is NOT cut off to the left (bounding box x must be >= 0)
    const popoverContainer = page.locator('aside div.z-50');
    await expect(popoverContainer).toBeVisible();
    const box = await popoverContainer.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1280);
    }

    // Verify individual delete/clear action
    const clearOneBtn = popoverContainer.getByRole('button', { name: /Clear notification/i }).first();
    await expect(clearOneBtn).toBeVisible();
    await clearOneBtn.click();
    await expect(page.getByText('New Squad Recruitment Invite: CEAT Red Scorpions')).toHaveCount(0);

    // Verify Clear All action
    const clearAllBtn = popoverContainer.getByRole('button', { name: /Clear all/i });
    await expect(clearAllBtn).toBeVisible();
    await clearAllBtn.click();
    await expect(page.getByText('No notifications yet')).toBeVisible();
  });
});
