import { test, expect } from '@playwright/test';

test.describe('Hardened Facilitator MVP Governance & Admin Override Engine', () => {
  const matchId = 'match-mvp-governance-01';

  test('Candidate selector groups winning team, displays points, and top scorer chip', async ({ page }) => {
    // 1. Mock match data (Completed)
    await page.route('**/rest/v1/matches*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: matchId,
          round: 'Finals',
          status: 'Completed',
          team_a_score: 88,
          team_b_score: 74,
          team_a_id: 'team-scorpions',
          team_b_id: 'team-enforcers',
          team_a: { id: 'team-scorpions', name: 'CEAT Red Scorpions', college_id: 'col-ceat' },
          team_b: { id: 'team-enforcers', name: 'CCJE Law Enforcers', college_id: 'col-ccje' },
          tournament_id: 'tourn-1',
          tournament: { name: 'PSU Palawan Games 2026', sport: 'Basketball' },
          designated_facilitator_id: 'faci-user-01',
        }),
      });
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // 2. Mock player stats (Janzen has 28 PTS, Carlo has 14 PTS, Ezekiel has 0 PTS)
    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { match_id: matchId, player_id: 'p1', points: 0 },
          { match_id: matchId, player_id: 'p2', points: 14 },
          { match_id: matchId, player_id: 'p3', points: 28 },
          { match_id: matchId, player_id: 'p7', points: 12 },
        ]),
      });
    });

    // 3. Mock team roster
    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', team_id: 'team-scorpions', player_id: 'p1', jersey_number: 1, position: 'Point Guard', is_starter: true, status: 'Approved', users: { full_name: 'Ezekiel Castro' } },
          { id: 'r2', team_id: 'team-scorpions', player_id: 'p2', jersey_number: 3, position: 'Shooting Guard', is_starter: true, status: 'Approved', users: { full_name: 'Carlo Villanueva' } },
          { id: 'r3', team_id: 'team-scorpions', player_id: 'p3', jersey_number: 5, position: 'Small Forward', is_starter: true, status: 'Approved', users: { full_name: 'Janzen Morales' } },
          { id: 'r7', team_id: 'team-enforcers', player_id: 'p7', jersey_number: 7, position: 'Center', is_starter: true, status: 'Approved', users: { full_name: 'Crispus Perez' } },
        ]),
      });
    });

    // 4. No star awarded yet
    await page.route('**/rest/v1/player_stars*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    // Seed dev facilitator persona
    await page.addInitScript(() => {
      localStorage.setItem(
        'psu_dev_impersonated_persona',
        JSON.stringify({
          id: 'faci-user-01',
          full_name: 'Karl Nuas',
          email: 'karl.nuas@psu.palawan.edu.ph',
          role: 'player_student',
          is_facilitator: true,
          is_verified: true,
          college_id: 'col-cba',
          college_name: 'College of Business and Accountancy',
          account_status: 'Approved',
        })
      );
    });

    await page.goto(`/match/${matchId}`);
    await page.waitForLoadState('networkidle');

    // Verify Post-Game Award card is rendered
    await expect(page.locator('text=Post-Game: Award MVP')).toBeVisible();

    // Trigger candidate dropdown
    const selectTrigger = page.getByTestId('mvp-candidate-trigger');
    await expect(selectTrigger).toBeVisible();
    await selectTrigger.click();

    // Verify candidate list contains points and top scorer
    await expect(page.locator('text=28 PTS').first()).toBeVisible();
    await expect(page.locator('text=High Scorer').first()).toBeVisible();
    await expect(page.locator('text=Winning Squad').first()).toBeVisible();

    // Select top scorer Janzen Morales
    await page.getByRole('option', { name: /Janzen Morales/i }).click();

    // Click "Review & Award Red Star"
    const reviewBtn = page.getByTestId('btn-review-award-mvp');
    await expect(reviewBtn).toBeEnabled();
    await reviewBtn.click();

    // Verify Attestation Modal is opened
    const modal = page.getByTestId('mvp-attestation-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Janzen Morales')).toBeVisible();
    await expect(modal.locator('text=28 PTS')).toBeVisible();

    // Since Janzen has 28 pts and is on the winning squad, no low-stat justification section should show
    await expect(page.getByTestId('mvp-justification-section')).not.toBeVisible();

    // Confirm button is disabled until fair play attestation checkbox is checked
    const confirmBtn = page.getByTestId('mvp-confirm-award-button');
    await expect(confirmBtn).toBeDisabled();

    // Check Fair Play Attestation
    await page.getByTestId('mvp-attestation-checkbox').click();
    await expect(confirmBtn).toBeEnabled();
  });

  test('Conflict of Interest (COI) warning and mandatory justification for 0-stat/losing team athlete', async ({ page }) => {
    // 1. Mock match data (Completed)
    await page.route('**/rest/v1/matches*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: matchId,
          round: 'Finals',
          status: 'Completed',
          team_a_score: 88,
          team_b_score: 74,
          team_a_id: 'team-scorpions',
          team_b_id: 'team-enforcers',
          team_a: { id: 'team-scorpions', name: 'CEAT Red Scorpions', college_id: 'col-ceat' },
          team_b: { id: 'team-enforcers', name: 'CCJE Law Enforcers', college_id: 'col-ccje' },
          tournament_id: 'tourn-1',
          tournament: { name: 'PSU Palawan Games 2026', sport: 'Basketball' },
          designated_facilitator_id: 'faci-user-01',
        }),
      });
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { match_id: matchId, player_id: 'p1', points: 0 },
          { match_id: matchId, player_id: 'p3', points: 28 },
        ]),
      });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', team_id: 'team-scorpions', player_id: 'p1', jersey_number: 1, position: 'Point Guard', is_starter: true, status: 'Approved', users: { full_name: 'Ezekiel Castro' } },
          { id: 'r3', team_id: 'team-scorpions', player_id: 'p3', jersey_number: 5, position: 'Small Forward', is_starter: true, status: 'Approved', users: { full_name: 'Janzen Morales' } },
        ]),
      });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    // Seed facilitator who belongs to CEAT (same as team-scorpions!)
    await page.addInitScript(() => {
      localStorage.setItem(
        'psu_dev_impersonated_persona',
        JSON.stringify({
          id: 'faci-user-01',
          full_name: 'Karl Nuas',
          email: 'karl.nuas@psu.palawan.edu.ph',
          role: 'player_student',
          is_facilitator: true,
          is_verified: true,
          college_id: 'col-ceat',
          college_name: 'College of Engineering, Architecture and Technology',
          account_status: 'Approved',
        })
      );
    });

    await page.goto(`/match/${matchId}`);
    await page.waitForLoadState('networkidle');

    // Select Ezekiel Castro (who scored 0 PTS and is from CEAT, triggering BOTH COI and Low-Stat justification)
    await page.getByTestId('mvp-candidate-trigger').click();
    await page.getByRole('option', { name: /Ezekiel Castro/i }).click();
    await page.getByTestId('btn-review-award-mvp').click();

    // Verify COI Warning banner is visible
    await expect(page.getByTestId('mvp-coi-warning')).toBeVisible();
    await expect(page.locator('text=Collegiate Affiliation Notice (Conflict of Interest)')).toBeVisible();

    // Verify Mandatory Justification Section is visible
    await expect(page.getByTestId('mvp-justification-section')).toBeVisible();

    // Confirm button is disabled
    const confirmBtn = page.getByTestId('mvp-confirm-award-button');
    await expect(confirmBtn).toBeDisabled();

    // Check Fair Play Attestation
    await page.getByTestId('mvp-attestation-checkbox').click();
    // Still disabled because justification is empty (< 10 chars)
    await expect(confirmBtn).toBeDisabled();

    // Type short note (less than 10 chars)
    const textarea = page.getByTestId('mvp-justification-input');
    await textarea.fill('Good lead');
    await expect(confirmBtn).toBeDisabled();

    // Type valid note (>= 10 chars)
    await textarea.fill('Outstanding defensive leadership and clutch floor general direction.');
    await expect(confirmBtn).toBeEnabled();
  });

  test('Administrator can view awarded MVP details, open Reassign modal, and review Revoke options', async ({ page }) => {
    // 1. Mock match data (Completed with existing MVP award)
    await page.route('**/rest/v1/matches*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: matchId,
          round: 'Finals',
          status: 'Completed',
          team_a_score: 88,
          team_b_score: 74,
          team_a_id: 'team-scorpions',
          team_b_id: 'team-enforcers',
          team_a: { id: 'team-scorpions', name: 'CEAT Red Scorpions', college_id: 'col-ceat' },
          team_b: { id: 'team-enforcers', name: 'CCJE Law Enforcers', college_id: 'col-ccje' },
          tournament_id: 'tourn-1',
          tournament: { name: 'PSU Palawan Games 2026', sport: 'Basketball' },
          designated_facilitator_id: 'faci-user-01',
        }),
      });
    });

    await page.route('**/rest/v1/match_events*', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/match_player_stats*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { match_id: matchId, player_id: 'p1', points: 0 },
          { match_id: matchId, player_id: 'p3', points: 28 },
        ]),
      });
    });

    await page.route('**/rest/v1/team_roster*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', team_id: 'team-scorpions', player_id: 'p1', jersey_number: 1, position: 'Point Guard', is_starter: true, status: 'Approved', users: { full_name: 'Ezekiel Castro' } },
          { id: 'r3', team_id: 'team-scorpions', player_id: 'p3', jersey_number: 5, position: 'Small Forward', is_starter: true, status: 'Approved', users: { full_name: 'Janzen Morales' } },
        ]),
      });
    });

    // Mock existing player_stars record awarded to p1 (Ezekiel Castro)
    await page.route('**/rest/v1/player_stars*', async (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'DELETE') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'star-rec-01',
          player_id: 'p1',
          star_type: 'Red',
          match_id: matchId,
          tournament_id: 'tourn-1',
          awarded_by: 'faci-user-01',
          justification: 'Assigned mistakenly by scorekeeper',
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/rest/v1/users*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ full_name: 'Karl Nuas' }),
      });
    });

    // Seed dev Admin persona
    await page.addInitScript(() => {
      localStorage.setItem(
        'psu_dev_impersonated_persona',
        JSON.stringify({
          id: 'admin-user-01',
          full_name: 'Sports Director Ramon Bautista',
          email: 'sports.director@psu.palawan.edu.ph',
          role: 'admin',
          account_status: 'Approved',
        })
      );
    });

    await page.goto(`/match/${matchId}`);
    await page.waitForLoadState('networkidle');

    // Verify MVP Recognition card is visible with awarded player
    await expect(page.locator('text=Official Red Star MVP')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ezekiel Castro' })).toBeVisible();
    await expect(page.locator('text=Awarded by Karl Nuas')).toBeVisible();

    // Verify Admin Override button is rendered
    const overrideBtn = page.getByTestId('admin-open-override-btn');
    await expect(overrideBtn).toBeVisible();
    await overrideBtn.click();

    // Verify Admin MVP Governance Modal opens
    const adminModal = page.getByTestId('admin-mvp-override-modal');
    await expect(adminModal).toBeVisible();
    await expect(adminModal.locator('text=Administrator MVP Governance')).toBeVisible();

    // Reassign tab: verify replacement select and justification
    const replacementSelect = page.getByTestId('admin-mvp-replacement-select');
    await expect(replacementSelect).toBeVisible();
    await replacementSelect.selectOption('p3');

    const reassignReason = page.getByTestId('admin-reassign-reason');
    await expect(page.getByTestId('btn-confirm-reassign')).toBeDisabled();
    await reassignReason.fill('Scorekeeper mistake: Janzen Morales led team with 28 points in finals victory.');
    await expect(page.getByTestId('btn-confirm-reassign')).toBeEnabled();

    // Switch to Revoke tab
    await page.getByTestId('tab-revoke-mvp').click();
    await expect(page.locator('text=Confirm Accolade Revocation')).toBeVisible();
    const revokeBtn = page.getByTestId('btn-confirm-revoke');
    await expect(revokeBtn).toBeDisabled();

    await page.getByTestId('admin-revoke-reason').fill('Officiating review concluded invalid award nomination.');
    await expect(revokeBtn).toBeEnabled();
  });
});
