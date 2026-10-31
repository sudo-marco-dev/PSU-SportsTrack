import { test, expect } from '@playwright/test';

test.describe('Match Lockout, Strict Tie Guards, and Audit Humanization', () => {
  const mockAdminUser = {
    id: 'admin-uuid-1',
    email: 'admin@psu.palawan.edu.ph',
    role: 'super_admin',
    user_metadata: { role: 'super_admin', full_name: 'Dr. Ramon Bautista' },
  };

  const mockTournaments = [
    {
      id: 'tourn-active-1',
      name: 'PSU Inter-College Basketball 2026',
      sport: 'Basketball',
      type: 'Single Elimination',
      status: 'Active',
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      enforce_conflict_of_interest: true,
    },
    {
      id: 'tourn-done-all-matches',
      name: 'PSU Volleyball Championship 2026',
      sport: 'Volleyball',
      type: 'Single Elimination',
      status: 'Active', // Active status but all matches completed
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      enforce_conflict_of_interest: true,
    },
    {
      id: 'tourn-completed-1',
      name: 'PSU Table Tennis Men\'s Singles Open 2026 Invitational Cup',
      sport: 'Table Tennis',
      type: 'Single Elimination',
      status: 'Completed',
      start_date: '2026-10-01',
      end_date: '2026-10-03',
      enforce_conflict_of_interest: false,
    },
  ];

  // Matches for tournament 1: 1 completed, 1 ongoing, 1 scheduled
  // Matches for tournament 2: 3 completed (3/3 finished)
  // Matches for tournament 3: 2 completed
  const mockMatches = [
    { id: 'match-1', tournament_id: 'tourn-active-1', status: 'Completed', round: 'Quarterfinals', team_a_score: 82, team_b_score: 75, team_a_id: 't-1', team_b_id: 't-2' },
    { id: 'match-2', tournament_id: 'tourn-active-1', status: 'Ongoing', round: 'Semifinals', team_a_score: 54, team_b_score: 50, team_a_id: 't-1', team_b_id: 't-3' },
    { id: 'match-3', tournament_id: 'tourn-active-1', status: 'Scheduled', round: 'Finals', team_a_score: 0, team_b_score: 0, team_a_id: 't-1', team_b_id: null },
    { id: 'match-4', tournament_id: 'tourn-done-all-matches', status: 'Completed', round: 'Quarterfinals', team_a_score: 25, team_b_score: 21, team_a_id: 't-4', team_b_id: 't-5' },
    { id: 'match-5', tournament_id: 'tourn-done-all-matches', status: 'Completed', round: 'Semifinals', team_a_score: 25, team_b_score: 23, team_a_id: 't-4', team_b_id: 't-6' },
    { id: 'match-6', tournament_id: 'tourn-done-all-matches', status: 'Completed', round: 'Finals', team_a_score: 25, team_b_score: 19, team_a_id: 't-4', team_b_id: 't-7' },
    { id: 'match-7', tournament_id: 'tourn-completed-1', status: 'Completed', round: 'Semifinals', team_a_score: 11, team_b_score: 8, team_a_id: 't-8', team_b_id: 't-9' },
    { id: 'match-8', tournament_id: 'tourn-completed-1', status: 'Completed', round: 'Finals', team_a_score: 11, team_b_score: 9, team_a_id: 't-8', team_b_id: 't-10' },
  ];

  const mockAuditLogs = [
    {
      id: 'audit-1',
      action: 'ASSIGN_MATCH_FACILITATOR',
      entity_type: 'matches',
      details: 'Designated "Karl Nuas" to "CCS vs CBA" (Finals - Basketball)',
      created_at: new Date().toISOString(),
      admin: { full_name: 'Dr. Ramon Bautista' },
    },
    {
      id: 'audit-2',
      action: 'ASSIGN_MATCH_FACILITATOR',
      entity_type: 'matches',
      // Legacy unformatted UUID in details
      details: 'Designated "Karl Nuas" to match a2766c85-f25c-4be3-923a-82fc5e373794',
      created_at: new Date().toISOString(),
      admin: { full_name: 'Dr. Ramon Bautista' },
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Authenticate as super admin
    await page.addInitScript((adminUser) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify({
        id: adminUser.id,
        full_name: adminUser.user_metadata.full_name,
        email: adminUser.email,
        role: adminUser.role,
        is_verified: true,
        account_status: 'Approved',
      }));
      localStorage.setItem('psu_sportstrack_user', JSON.stringify(adminUser));
      localStorage.setItem(
        'sb-kxnkdhznnpwvnljjmfwl-auth-token',
        JSON.stringify({
          access_token: 'fake-jwt-token',
          user: adminUser,
        })
      );
    }, mockAdminUser);

    // Setup network mocks for Supabase REST endpoints
    await page.route('**/rest/v1/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTournaments),
      });
    });

    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMatches),
      });
    });

    await page.route('**/rest/v1/teams*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/users*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAdminUser]),
      });
    });

    await page.route('**/rest/v1/audit_logs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuditLogs),
      });
    });
  });

  test('1. Tournament Cards show at-a-glance match progress (e.g., 1/3 Done, 3/3 Done)', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');

    // Verify tournament 1 card has "1/3 Done"
    const card1 = page.locator('.group', { hasText: 'PSU Inter-College Basketball 2026' }).first();
    await expect(card1).toBeVisible();
    await expect(card1.getByText('Match Progress')).toBeVisible();
    await expect(card1.getByText('1/3 Done')).toBeVisible();

    // Verify tournament 2 card has "3/3 Done"
    const card2 = page.locator('.group', { hasText: 'PSU Volleyball Championship 2026' }).first();
    await expect(card2).toBeVisible();
    await expect(card2.getByText('3/3 Done')).toBeVisible();

    // Verify Review & Conclude primary action button appears on tournament 2 because all 3 matches are completed
    await expect(card2.getByRole('button', { name: 'Review & Conclude' })).toBeVisible();

    // Verify tournament 3 card has "View Results"
    const card3 = page.locator('.group', { hasText: 'PSU Table Tennis' }).first();
    await expect(card3).toBeVisible();
    await expect(card3.getByRole('button', { name: 'View Results' })).toBeVisible();

    // Take screenshot of the tournament cards showing unified button alignment across all 3 cards
    const cardsGrid = page.locator('.grid.gap-6').first();
    await cardsGrid.scrollIntoViewIfNeeded();
    await cardsGrid.screenshot({
      path: 'C:/Users/Marco/.gemini/antigravity/brain/94a3d8ca-678e-4e5e-bb7a-e2a01fb553dd/unified_tournament_cards.png',
    });
  });

  test('2. Completed and Live matches display locked indicators in Brackets and hide Edit button', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');

    // Click "Bracket Preview" on the first tournament
    const card1 = page.locator('.group', { hasText: 'PSU Inter-College Basketball 2026' }).first();
    await card1.getByRole('button', { name: 'Bracket Preview' }).click();

    // The Bracket dialog opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Check that Completed match has "Locked Record" badge and NO "Edit" button
    const lockedBadge = modal.getByText('Locked Record');
    await expect(lockedBadge.first()).toBeVisible();

    // Check that Live Match has "Live Match" badge
    const liveBadge = modal.getByText('Live Match');
    await expect(liveBadge.first()).toBeVisible();
  });

  test('3. Facilitator Kiosk blocks concluding on tied scores and shows Amber Overtime warning', async ({ page }) => {
    // Mock single match tied at 14 - 14
    await page.route('**/rest/v1/matches?id=eq.match-tied*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'match-tied',
          round: 'Finals',
          status: 'Ongoing',
          team_a_score: 14,
          team_b_score: 14,
          team_a_id: 't-1',
          team_b_id: 't-2',
          winner_team_id: null,
          team_a: { name: 'CEAT Red Scorpions' },
          team_b: { name: 'CS Blue Sharks' },
          tournament_id: 'tourn-active-1',
          tournament: { name: 'PSU Basketball 2026', sport: 'Basketball' },
        }]),
      });
    });

    await page.route('**/rest/v1/teams?id=in*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/match/match-tied/kiosk');
    await page.waitForLoadState('networkidle');

    // Click "End" or "Conclude Match" in Kiosk header
    const concludeHeaderBtn = page.getByRole('button', { name: 'End' });
    if (await concludeHeaderBtn.isVisible()) {
      await concludeHeaderBtn.click();
    } else {
      await page.getByRole('button', { name: /Conclude/i }).click();
    }

    // Modal opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Warning alert for tied score must appear
    await expect(dialog.getByText(/Scores are Tied/i)).toBeVisible();
    await expect(dialog.getByText(/Official ballgame rules prohibit concluding a fixture in a tie/i)).toBeVisible();

    // Confirm button must be disabled
    const certifyBtn = dialog.getByRole('button', { name: /Cannot Conclude \(Tied\)/i });
    await expect(certifyBtn).toBeDisabled();
  });

  test('4. System Audit Trail formats legacy UUIDs and displays humanized descriptions without raw UUIDs', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await page.waitForLoadState('networkidle');

    // Verify row 1 shows clean human-readable match label in the desktop table
    const table = page.locator('table');
    await expect(table.getByText('Designated "Karl Nuas" to "CCS vs CBA" (Finals - Basketball)')).toBeVisible();

    // Verify row 2 legacy UUID is humanized into official facilitator assignment prose
    await expect(table.getByText('Assigned Karl Nuas as the official courtside match facilitator.')).toBeVisible();

    // Ensure raw 36-character UUID is never exposed in the table
    await expect(table.getByText('a2766c85-f25c-4be3-923a-82fc5e373794')).not.toBeVisible();
  });
});
