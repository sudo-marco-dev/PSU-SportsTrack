import { test, expect } from '@playwright/test';

test.describe('Match Completion & Dashboard Sport Pills Suite', () => {
  test('Dashboard displays sport pills with icons for Live & Upcoming matches and Draft tournaments', async ({ page }) => {
    const studentId = 'student-athlete-101';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: studentId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'student@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Juan Student' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-student-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: futureExpiresAt,
      user: mockUser,
    };

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
        body: JSON.stringify({
          id: studentId,
          full_name: 'Juan Student',
          role: 'player_student',
          is_verified: true,
          account_status: 'active',
        }),
      });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    // Mock Supabase REST endpoints for Dashboard matches & tournaments
    await page.route('**/rest/v1/matches*', async (route) => {
      const url = route.request().url();
      if (url.includes('Scheduled') || url.includes('Ongoing')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'match-futsal-1',
              team_a_score: 3,
              team_b_score: 6,
              status: 'Ongoing',
              round: 'Group Stage - Pool B',
              venue: 'PSU Covered Court - Pitch 1',
              team_a: { name: 'CAH ARTISTICS' },
              team_b: { name: 'CCRD FORESTERS' },
              tournament: {
                id: 'tourn-1',
                name: 'PSU Binturungan 2026 - Indoor Futsal Arena',
                sport: 'Futsal',
                type: 'Binturungan',
              },
            },
            {
              id: 'match-basketball-2',
              team_a_score: 25,
              team_b_score: 23,
              status: 'Ongoing',
              round: 'Semifinals',
              venue: 'PSU Sports Complex - Arena Court A',
              team_a: { name: 'CEAT RED SCORPIONS' },
              team_b: { name: 'CCJE LAW ENFORCERS' },
              tournament: {
                id: 'tourn-2',
                name: 'PSU Binturungan 2026 - Basketball Championship',
                sport: 'Basketball',
                type: 'Binturungan',
              },
            },
            {
              id: 'match-pickleball-3',
              team_a_score: 0,
              team_b_score: 0,
              status: 'Scheduled',
              round: 'Semifinals',
              venue: 'PSU Main Athletic Oval',
              team_a: { name: 'CS BYTE TITANS' },
              team_b: { name: 'CCJE LAW ENFORCERS' },
              tournament: {
                id: 'tourn-3',
                name: 'PSU Binturungan 2026 - Pickleball Open Division',
                sport: 'Pickleball',
                type: 'Binturungan',
              },
            },
          ]),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'draft-tourn-1',
            name: 'Binturungan Test Pickleball Cup',
            sport: 'Pickleball',
            type: 'Binturungan',
            status: 'Draft',
            start_date: '2026-10-29T00:00:00Z',
            end_date: '2026-11-05T00:00:00Z',
          },
        ]),
      });
    });

    await page.goto('/player');

    // 1. Verify Draft tournament card displays sport pill with text "Pickleball"
    const draftCard = page.locator('div').filter({ hasText: 'Binturungan Test Pickleball Cup' }).last();
    await expect(draftCard).toBeVisible();
    await expect(draftCard.locator('span', { hasText: 'Pickleball' }).first()).toBeVisible();

    // 2. Verify "Live & Upcoming Games" header
    await expect(page.getByRole('heading', { name: /Live & Upcoming Games/i })).toBeVisible();

    // 3. Verify match 1 (Futsal) has sport pill with Futsal icon and text
    const futsalCard = page.locator('div.border-2.rounded-2xl').filter({ hasText: 'CAH ARTISTICS' }).first();
    await expect(futsalCard).toBeVisible();
    await expect(futsalCard.getByText('Futsal')).toBeVisible();
    await expect(futsalCard.locator('svg').first()).toBeVisible();

    // 4. Verify match 2 (Basketball) has sport pill with Basketball icon and text
    const bballCard = page.locator('div.border-2.rounded-2xl').filter({ hasText: 'CEAT RED SCORPIONS' }).first();
    await expect(bballCard).toBeVisible();
    await expect(bballCard.getByText('Basketball')).toBeVisible();
    await expect(bballCard.locator('svg').first()).toBeVisible();

    // 5. Verify match 3 (Pickleball) has sport pill with Pickleball icon and text
    const pickleballCard = page.locator('div.border-2.rounded-2xl').filter({ hasText: 'CS BYTE TITANS' }).first();
    await expect(pickleballCard).toBeVisible();
    await expect(pickleballCard.getByText('Pickleball')).toBeVisible();
    await expect(pickleballCard.locator('svg').first()).toBeVisible();
  });

  test('LiveMatch: Ending an ongoing match updates status to Completed without "winner_team_id" schema error', async ({ page }) => {
    const matchId = 'da9db2c7-32f3-43df-9bec-51485b8aa97c';
    const adminId = 'admin-user-id-123';

    // Mock Auth
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: adminId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Admin Marco' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-admin-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 7200,
      expires_at: futureExpiresAt,
      user: mockUser,
    };

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
        body: JSON.stringify({
          id: adminId,
          full_name: 'Admin Marco',
          role: 'admin',
          is_verified: true,
          account_status: 'active',
        }),
      });
    });

    let matchStatus = 'Ongoing';
    let winnerTeamId: string | null = null;
    let patchPayloadReceived: Record<string, unknown> | null = null;

    await page.route(`**/rest/v1/matches*`, async (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        patchPayloadReceived = route.request().postDataJSON();
        matchStatus = patchPayloadReceived.status;
        winnerTeamId = patchPayloadReceived.winner_team_id;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: matchId,
              status: matchStatus,
              winner_team_id: winnerTeamId,
            },
          ]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: matchId,
            status: matchStatus,
            round: 'Group Stage - Pool B',
            team_a_score: 3,
            team_b_score: 6,
            team_a_id: 'team-a-cah',
            team_b_id: 'team-b-ccrd',
            active_scorekeeper_id: adminId,
            lease_expires_at: new Date(Date.now() + 3600000).toISOString(),
            team_a: { name: 'CAH ARTISTICS' },
            team_b: { name: 'CCRD FORESTERS' },
            tournament: { name: 'PSU Binturungan 2026 - Indoor Futsal Arena', sport: 'Futsal' },
            winner_team_id: winnerTeamId,
          }),
        });
      }
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
    });

    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.goto(`/match/${matchId}`);

    // Wait for scoreboard to be visible
    await expect(page.getByRole('heading', { name: 'CAH ARTISTICS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CCRD FORESTERS' })).toBeVisible();

    // Verify End Match button is visible
    const endMatchBtn = page.getByRole('button', { name: /End Match/i });
    await expect(endMatchBtn).toBeVisible();
    await endMatchBtn.click();

    // Verify PATCH payload was sent with status 'Completed' and winner_team_id 'team-b-ccrd'
    expect(patchPayloadReceived).not.toBeNull();
    expect(patchPayloadReceived.status).toBe('Completed');
    expect(patchPayloadReceived.winner_team_id).toBe('team-b-ccrd');
    expect(patchPayloadReceived.is_finalized).toBe(true);

    // Verify success toast appears and NO error toast is shown
    await expect(page.locator('text=Official winner: CCRD FORESTERS').or(page.locator('text=Match completed!'))).toBeVisible();
    await expect(page.locator('text=record "new" has no field "winner_team_id"')).not.toBeVisible();
  });
});
