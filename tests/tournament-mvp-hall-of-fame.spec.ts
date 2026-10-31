import { test, expect } from '@playwright/test';

test.describe('Admin MVP Hall of Fame Command Center & Rapid Queue Workflow', () => {
  // Generate 22 realistic tournaments across PSU ballgames
  const mockTournaments = [
    { id: 'tourn-1', name: 'PSU Inter-College Men Basketball 2026', sport: 'Basketball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-2', name: 'PSU Women Volleyball Championship', sport: 'Volleyball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-3', name: 'Binturungan Men Soccer League', sport: 'Soccer', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-4', name: 'PSU Futsal Invitational Cup', sport: 'Futsal', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-5', name: 'Palawan Sepak Takraw Regu Open', sport: 'Sepak Takraw', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-6', name: 'PSU Varsity Baseball Series', sport: 'Baseball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-7', name: 'PSU Women Softball Classic', sport: 'Softball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-8', name: 'Palawan Pickleball Mixed Doubles', sport: 'Pickleball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-9', name: 'PSU Table Tennis Singles Trophy', sport: 'Table Tennis', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-10', name: 'Freshmen Basketball Showcase', sport: 'Basketball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-11', name: 'Inter-Department Volleyball Cup', sport: 'Volleyball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-12', name: 'PSU Beach Volleyball Invitational', sport: 'Volleyball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    // 10 Pending Tournaments
    { id: 'tourn-13', name: 'CCJE vs CS Soccer Derby', sport: 'Soccer', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-14', name: 'Binturungan Men Table Tennis Masters', sport: 'Table Tennis', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-15', name: 'PSU Open Futsal Cup Women', sport: 'Futsal', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-16', name: 'Palawan State Baseball Championship', sport: 'Baseball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-17', name: 'PSU Softball Alumni Cup', sport: 'Softball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-18', name: 'Binturungan Pickleball Singles', sport: 'Pickleball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-19', name: 'Palawan Sepak Takraw Team Event', sport: 'Sepak Takraw', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-20', name: 'Executive Basketball League', sport: 'Basketball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-21', name: 'Intramural Mixed Volleyball Rally', sport: 'Volleyball', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
    { id: 'tourn-22', name: 'PSU Football Senior Cup', sport: 'Soccer', type: 'Single Elimination', status: 'Completed', start_date: '2026-10-01', end_date: '2026-10-05' },
  ];

  // 12 initial Gold Stars (tournaments 1-12 crowned)
  let mockGoldStars = [
    { id: 'star-1', tournament_id: 'tourn-1', player_id: 'p-champ-1', star_type: 'Gold', users: { full_name: 'Janzen Morales' }, justification: 'Unanimous Finals MVP with 34 PTS', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-2', tournament_id: 'tourn-2', player_id: 'p-champ-2', star_type: 'Gold', users: { full_name: 'Alyssa Valdez' }, justification: 'Led team to flawless 4-0 sweep', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-3', tournament_id: 'tourn-3', player_id: 'p-champ-3', star_type: 'Gold', users: { full_name: 'Phil Younghusband' }, justification: 'Hat-trick in the finals fixture', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-4', tournament_id: 'tourn-4', player_id: 'p-champ-4', star_type: 'Gold', users: { full_name: 'Marco Santos' }, justification: 'Tournament top scorer', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-5', tournament_id: 'tourn-5', player_id: 'p-champ-5', star_type: 'Gold', users: { full_name: 'Jason Delos Reyes' }, justification: 'Best Tekong of tournament', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-6', tournament_id: 'tourn-6', player_id: 'p-champ-6', star_type: 'Gold', users: { full_name: 'Eduardo Bautista' }, justification: 'Complete game shutout in finals', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-7', tournament_id: 'tourn-7', player_id: 'p-champ-7', star_type: 'Gold', users: { full_name: 'Maria Clara' }, justification: 'Walk-off grand slam in championship', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-8', tournament_id: 'tourn-8', player_id: 'p-champ-8', star_type: 'Gold', users: { full_name: 'Christian Lee' }, justification: 'Undefeated mixed doubles run', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-9', tournament_id: 'tourn-9', player_id: 'p-champ-9', star_type: 'Gold', users: { full_name: 'Richard Gonzales' }, justification: 'Flawless table dominance', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-10', tournament_id: 'tourn-10', player_id: 'p-champ-10', star_type: 'Gold', users: { full_name: 'Kiefer Ravena' }, justification: 'Rookie scoring leader', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-11', tournament_id: 'tourn-11', player_id: 'p-champ-11', star_type: 'Gold', users: { full_name: 'Jia Morado' }, justification: 'Masterful playmaking', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
    { id: 'star-12', tournament_id: 'tourn-12', player_id: 'p-champ-12', star_type: 'Gold', users: { full_name: 'Cherry Rondina' }, justification: 'Relentless sand defense', created_at: '2026-10-25T10:00:00Z', awarded_by: 'admin-1' },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock user session as super_admin
    await page.addInitScript(() => {
      localStorage.setItem(
        'psu_dev_impersonated_persona',
        JSON.stringify({
          id: 'admin-user-01',
          full_name: 'Super Admin User',
          email: 'admin@psu.palawan.edu.ph',
          role: 'super_admin',
          is_verified: true,
          account_status: 'Approved',
        })
      );
    });

    // Mock tournaments endpoint
    await page.route('**/rest/v1/tournaments*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTournaments),
      });
    });

    // Mock player_stars
    await page.route('**/rest/v1/player_stars*', async (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === 'GET') {
        if (url.includes('star_type=eq.Gold') || url.includes('star_type.eq.Gold')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockGoldStars),
          });
        }
        if (url.includes('star_type=eq.Red') || url.includes('star_type.eq.Red')) {
          // Mock Red stars for contenders in tournament 13
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: 'rs-1', player_id: 'p-cand-1', match_id: 'm-1' },
              { id: 'rs-2', player_id: 'p-cand-1', match_id: 'm-2' },
              { id: 'rs-3', player_id: 'p-cand-2', match_id: 'm-3' },
            ]),
          });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }

      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        const newStar = {
          id: 'star-new-99',
          tournament_id: payload.tournament_id,
          player_id: payload.player_id,
          star_type: 'Gold',
          users: { full_name: 'Carlo Villanueva' },
          justification: payload.justification || null,
          created_at: new Date().toISOString(),
          awarded_by: 'admin-user-01',
        };
        mockGoldStars.push(newStar);
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newStar),
        });
      }

      if (method === 'PATCH') {
        const payload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'star-1', ...payload }),
        });
      }

      if (method === 'DELETE') {
        mockGoldStars = mockGoldStars.filter((s) => s.id !== 'star-1');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }

      return route.continue();
    });

    // Mock teams endpoint for tournament 13
    await page.route('**/rest/v1/teams*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'team-ccje', name: 'CCJE Law Enforcers', college_id: 'col-ccje', colleges: { college_name: 'College of Criminology and Criminal Justice', name: 'College of Criminology and Criminal Justice' }, status: 'Approved' },
          { id: 'team-cs', name: 'CS Cyber Scorpions', college_id: 'col-cs', colleges: { college_name: 'College of Sciences', name: 'College of Sciences' }, status: 'Approved' },
        ]),
      });
    });

    // Mock matches for tournament 13 (CCJE won finals)
    await page.route('**/rest/v1/matches*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'm-1',
            round: 'Finals',
            status: 'Completed',
            winner_team_id: 'team-ccje',
            winner_id: 'team-ccje',
            team_a_id: 'team-ccje',
            team_b_id: 'team-cs',
            team_a_score: 3,
            team_b_score: 1,
            tournament_id: 'tourn-13',
          },
          {
            id: 'm-2',
            round: 'Semifinals',
            status: 'Completed',
            winner_team_id: 'team-ccje',
            winner_id: 'team-ccje',
            team_a_id: 'team-ccje',
            team_b_id: 'team-other',
            team_a_score: 2,
            team_b_score: 0,
            tournament_id: 'tourn-13',
          },
        ]),
      });
    });

    // Mock team_roster
    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r-1', team_id: 'team-ccje', player_id: 'p-cand-1', jersey_number: 10, position: 'Striker', is_starter: true, status: 'Approved', users: { full_name: 'Carlo Villanueva' } },
          { id: 'r-2', team_id: 'team-ccje', player_id: 'p-cand-2', jersey_number: 7, position: 'Midfielder', is_starter: true, status: 'Approved', users: { full_name: 'Daryl Ramos' } },
          { id: 'r-3', team_id: 'team-cs', player_id: 'p-cand-3', jersey_number: 9, position: 'Forward', is_starter: true, status: 'Approved', users: { full_name: 'Ezekiel Castro' } },
        ]),
      });
    });

    // Mock match_player_stats
    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { match_id: 'm-1', player_id: 'p-cand-1', points: 3 },
          { match_id: 'm-2', player_id: 'p-cand-1', points: 2 },
          { match_id: 'm-1', player_id: 'p-cand-2', points: 1 },
          { match_id: 'm-1', player_id: 'p-cand-3', points: 1 },
        ]),
      });
    });

    // Mock audit_logs
    await page.route('**/rest/v1/audit_logs*', async (route) => {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
  });

  test('Master Directory displays 22 tournaments with progress meter, search, and quick jump', async ({ page }) => {
    await page.goto('/admin/tournaments');

    // Click MVP Hall of Fame tab
    const mvpTab = page.locator('button[role="tab"]:has-text("MVP")');
    await expect(mvpTab).toBeVisible({ timeout: 10000 });
    await mvpTab.click();

    // 1. Verify progress meter shows 12 of 22 Crowned • 55%
    await expect(page.locator('text=12 of 22 Crowned • 55%')).toBeVisible();
    await expect(page.locator('text=10 Pending')).toBeVisible();

    // 2. Verify search input filters arenas
    const searchInput = page.locator('[data-testid="tournament-search-input"]');
    await searchInput.fill('Volleyball');
    await expect(page.locator('[data-testid="tournament-card-tourn-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="tournament-card-tourn-1"]')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');

    // 3. Verify status tabs
    await page.locator('button:has-text("Pending (10)")').click();
    await expect(page.locator('[data-testid="tournament-card-tourn-13"]')).toBeVisible();
    await expect(page.locator('[data-testid="tournament-card-tourn-1"]')).not.toBeVisible();

    // 4. Test Quick Jump: Next Pending Arena advances cyclically without looping trap
    const quickJumpBtn = page.locator('[data-testid="quick-jump-pending-btn"]');
    await expect(quickJumpBtn).toBeVisible();
    await quickJumpBtn.click();

    // Expect arena 13 to be selected in the workspace header
    await expect(page.locator('h2:has-text("CCJE vs CS Soccer Derby")')).toBeVisible();

    // Clicking again MUST advance forward to the next pending arena (tourn-14), not get stuck!
    await quickJumpBtn.click();
    await expect(page.locator('h2:has-text("Binturungan Men Table Tennis Masters")')).toBeVisible();
  });

  test('Multi-Factor Contender Spotlight ranks champion team performer with 2x Red Stars', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await page.locator('button[role="tab"]:has-text("MVP")').click();

    // Click on pending tournament 13
    await page.locator('[data-testid="tournament-card-tourn-13"]').click();

    // Verify Champion Squad Banner
    await expect(page.locator('text=1st Place Champion: CCJE Law Enforcers')).toBeVisible();

    // Verify Top Contenders Spotlight #1 is Carlo Villanueva (Champion squad, 2x Red Stars, 5 PTS)
    const spotlightCard0 = page.locator('[data-testid="spotlight-card-0"]');
    await expect(spotlightCard0).toBeVisible();
    await expect(spotlightCard0.locator('text=Carlo Villanueva')).toBeVisible();
    await expect(spotlightCard0.locator('text=2x')).toBeVisible(); // 2x Red Stars
    await expect(spotlightCard0.getByText('5', { exact: true })).toBeVisible(); // 5 PTS
    await expect(spotlightCard0.getByText('2.5', { exact: true })).toBeVisible(); // 2.5 PPG

    // Verify Nominate button is visible
    const nominateBtn = page.locator('[data-testid="nominate-spotlight-0"]');
    await expect(nominateBtn).toBeVisible();
  });

  test('Induction Modal enforces non-champion justification guardrail and auto-advances', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await page.locator('button[role="tab"]:has-text("MVP")').click();

    // Select tournament 13
    await page.locator('[data-testid="tournament-card-tourn-13"]').click();

    // Nominate Ezekiel Castro from runner-up team (CS Cyber Scorpions)
    const nominateEzekielBtn = page.locator('[data-testid="nominate-candidate-p-cand-3"]');
    await nominateEzekielBtn.scrollIntoViewIfNeeded();
    await nominateEzekielBtn.click();

    // Verify Modal opens
    const modal = page.locator('[data-testid="tournament-gold-star-modal"]');
    await expect(modal).toBeVisible();

    // Non-champion alert MUST be present
    const alert = page.locator('[data-testid="gold-star-justification-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Non-Champion Contender Justification Required');

    // Confirm button should be disabled without justification and attestation
    const confirmBtn = page.locator('[data-testid="confirm-gold-star-btn"]');
    await expect(confirmBtn).toBeDisabled();

    // Enter short justification (< 10 chars)
    const justInput = page.locator('[data-testid="gold-star-justification-input"]');
    await justInput.fill('Good game');
    await expect(confirmBtn).toBeDisabled();

    // Enter valid justification (>= 10 chars)
    await justInput.fill('Extraordinary defensive leadership throughout tournament');
    await expect(confirmBtn).toBeDisabled(); // Still disabled because checkbox not checked

    // Check official certification checkbox
    const checkbox = page.locator('[data-testid="gold-star-attestation-checkbox"]');
    await checkbox.click();

    // Now confirm button should be enabled!
    await expect(confirmBtn).toBeEnabled();

    // Click confirm & advance
    await confirmBtn.click();

    // Verify modal closes and auto-advances to the next pending arena (tourn-14)
    await expect(modal).not.toBeVisible();
    await expect(page.locator('h2:has-text("Binturungan Men Table Tennis Masters")')).toBeVisible({ timeout: 5000 });
  });

  test('Crowned arena renders Hall of Fame certificate and allows Admin Reassign / Revoke', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await page.locator('button[role="tab"]:has-text("MVP")').click();

    // Select tournament 1 (already crowned with Janzen Morales)
    await page.locator('[data-testid="tournament-card-tourn-1"]').click();

    // Verify Crowned Banner is rendered
    const banner = page.locator('[data-testid="crowned-hof-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner.locator('text=Janzen Morales')).toBeVisible();
    await expect(banner.locator('text=Unanimous Finals MVP with 34 PTS')).toBeVisible();

    // Verify Reassign & Revoke buttons
    const reassignBtn = page.locator('[data-testid="reassign-mvp-btn"]');
    const revokeBtn = page.locator('[data-testid="revoke-mvp-btn"]');
    await expect(reassignBtn).toBeVisible();
    await expect(revokeBtn).toBeVisible();

    // Click Reassign
    await reassignBtn.click();
    const overrideModal = page.locator('[data-testid="admin-gold-star-override-modal"]');
    await expect(overrideModal).toBeVisible();
    await expect(overrideModal.locator('text=Current Inductee')).toBeVisible();
    await expect(overrideModal.locator('text=Janzen Morales')).toBeVisible();
  });

  test('Capture visual screenshots for Hall of Fame command center walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/tournaments');
    await page.locator('button[role="tab"]:has-text("MVP")').click();

    // Select pending tournament 13
    await page.locator('[data-testid="tournament-card-tourn-13"]').click();
    await page.waitForTimeout(1000);

    // Save Command Center screenshot directly to artifact dir
    await page.screenshot({
      path: 'C:/Users/Marco/.gemini/antigravity/brain/94a3d8ca-678e-4e5e-bb7a-e2a01fb553dd/admin_mvp_command_center.png',
      fullPage: true,
    });

    // Open Induction Modal for runner-up candidate
    const nominateEzekielBtn = page.locator('[data-testid="nominate-candidate-p-cand-3"]');
    await nominateEzekielBtn.scrollIntoViewIfNeeded();
    await nominateEzekielBtn.click();
    await page.waitForTimeout(500);

    // Fill sample justification
    const justInput = page.locator('[data-testid="gold-star-justification-input"]');
    await justInput.fill('Demonstrated exceptional individual performance and tactical leadership throughout all 4 matches.');

    await page.screenshot({
      path: 'C:/Users/Marco/.gemini/antigravity/brain/94a3d8ca-678e-4e5e-bb7a-e2a01fb553dd/admin_mvp_induction_modal.png',
    });
  });
});
