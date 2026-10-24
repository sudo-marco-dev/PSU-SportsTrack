import { test, expect, type Page, type Route } from '@playwright/test';

async function setupDevSession(page: Page, devId = '4af94002-41b0-4629-8950-e38263f28fb6') {
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
  const mockUser = {
    id: devId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'dev@sportstrack.com',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Platform Dev Admin' },
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'fake-dev-token-valid-for-tests',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: futureExpiresAt,
    user: mockUser,
  };

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    }
  });

  const mockColleges = [
    { id: '11111111-0000-0000-0000-000000000001', code: 'CAS', name: 'College of Arts and Sciences' },
    { id: '11111111-0000-0000-0000-000000000002', code: 'CBA', name: 'College of Business and Accountancy' },
    { id: '11111111-0000-0000-0000-000000000003', code: 'CEAT', name: 'College of Engineering, Architecture and Technology' },
    { id: '11111111-0000-0000-0000-000000000004', code: 'CIT', name: 'College of Industrial Technology' },
    { id: '11111111-0000-0000-0000-000000000005', code: 'CCJE', name: 'College of Criminal Justice Education' },
    { id: '11111111-0000-0000-0000-000000000006', code: 'CTE', name: 'College of Teacher Education' },
    { id: '11111111-0000-0000-0000-000000000007', code: 'CNHS', name: 'College of Nursing and Health Sciences' },
    { id: '11111111-0000-0000-0000-000000000008', code: 'CHMT', name: 'College of Hospitality and Tourism' },
  ];

  const mockMatches = [
    {
      id: 'match-dev-1',
      round: 'Semifinals',
      status: 'live',
      team_a_score: 78,
      team_b_score: 76,
      current_period: 'Q4',
      match_time: new Date().toISOString(),
      team_a_id: 'team-a-1',
      team_b_id: 'team-b-1',
      next_match_id: null,
      loser_next_match_id: null,
      team_a: { name: 'CAS Titans' },
      team_b: { name: 'CBA Wolves' },
      tournament: { name: '[DEV] PSU Inter-Collegiate 2026 - Basketball Championship', sport: 'Basketball' },
    },
  ];

  await page.route('**/rest/v1/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    const accept = route.request().headers()['accept'] || '';
    const isSingle = accept.includes('vnd.pgrst.object+json');

    // HEAD or count queries
    if (method === 'HEAD') {
      return route.fulfill({
        status: 200,
        headers: {
          'content-range': '0-4/5',
        },
      });
    }

    if (url.includes('/rest/v1/colleges')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockColleges),
      });
    }

    if (url.includes('/rest/v1/users')) {
      const mockUserRecord = {
        id: devId,
        full_name: 'Platform Dev Admin',
        role: 'dev',
        is_verified: true,
        account_status: 'active',
        email: 'dev@sportstrack.com',
        college_id: mockColleges[0].id,
      };

      if (method === 'GET') {
        if (url.includes('id=eq.') && isSingle) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockUserRecord),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockUserRecord]),
        });
      }

      // POST or PATCH user
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? mockUserRecord : [mockUserRecord]),
      });
    }

    if (url.includes('/rest/v1/matches')) {
      if (method === 'GET') {
        if (isSingle) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMatches[0]),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMatches),
        });
      }

      // PATCH or POST matches
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? mockMatches[0] : mockMatches),
      });
    }

    if (url.includes('/rest/v1/tournaments')) {
      const mockTourney = {
        id: 'tourney-dev-1',
        name: '[DEV] PSU Inter-Collegiate 2026 - Basketball Championship',
        sport: 'Basketball',
        division: 'Inter-Collegiate',
        status: 'ongoing',
      };
      if (method === 'GET') {
        if (isSingle) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockTourney),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockTourney]),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? mockTourney : [mockTourney]),
      });
    }

    if (url.includes('/rest/v1/teams')) {
      const mockTeams = [
        { id: 'team-a-1', name: 'CAS Titans', college_id: mockColleges[0].id },
        { id: 'team-b-1', name: 'CBA Wolves', college_id: mockColleges[1].id },
        { id: 'team-c-1', name: 'CEAT Builders', college_id: mockColleges[2].id },
        { id: 'team-d-1', name: 'CIT Cyber Knights', college_id: mockColleges[3].id },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? mockTeams[0] : mockTeams),
      });
    }

    if (url.includes('/rest/v1/team_roster')) {
      const mockRoster = [
        {
          id: 'roster-1',
          team_id: 'team-a-1',
          player_id: devId,
          jersey_number: 23,
          is_starter: true,
          position: 'Point Guard',
          player: { full_name: 'Mark Reyes' },
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? mockRoster[0] : mockRoster),
      });
    }

    // Default 200/201 response for all other REST calls (events, stats, verifications)
    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify(isSingle ? { id: 'mock-single-id' } : [{ id: 'mock-id' }]),
    });
  });

  await page.addInitScript(({ session }) => {
    localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
  }, { session: mockSession });
}

test.describe('Developer Command Deck & Rapid Testing Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupDevSession(page);
  });

  test('should load the Dev Command Deck and display sandbox tabs', async ({ page }) => {
    await page.goto('/dev');

    // Verify Dev Command Deck heading and hero branding
    await expect(page.locator('text=COMMAND DECK').first()).toBeVisible();
    await expect(page.locator('text=Sandbox v2.0').first()).toBeVisible();

    // Verify all 7 developer tabs are rendered
    await expect(page.getByRole('tab', { name: /Demo Scenarios/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /1-Tap Impersonate/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Rapid Hosting/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Faker & Clearance/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Score Simulator/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Health & Dual Wipe/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Defense Script/i })).toBeVisible();
  });

  test('should switch personas via 1-Tap Impersonation and synchronize AuthContext', async ({ page }) => {
    await page.goto('/dev');

    // Navigate to 1-Tap Impersonate tab
    await page.getByRole('tab', { name: /1-Tap Impersonate/i }).click();

    // Verify preset personas are displayed
    await expect(page.getByText('Coach Danilo Soriano')).toBeVisible();
    await expect(page.getByText('CBA Lady Wolves Coach')).toBeVisible();
    await expect(page.getByText('Dr. Ramon Bautista')).toBeVisible();
    await expect(page.getByText('Engr. Patrick Manalo')).toBeVisible();
    await expect(page.getByText('Juan Dela Cruz')).toBeVisible();

    // Locate Coach Danilo Soriano's card and click Impersonate Persona
    const impersonateBtn = page.getByRole('button', { name: /Impersonate Coach Danilo Soriano/i });
    await impersonateBtn.click();

    // Verify top global Impersonation Strip appears across the application layout
    const banner = page.locator('text=Impersonating:').first();
    await expect(banner).toBeVisible();
    await expect(page.locator('text=Coach Danilo Soriano').first()).toBeVisible();
    await expect(page.locator('text=CBA Lady Wolves Coach').first()).toBeVisible();

    // Verify Active Persona Card on the Impersonate tab
    await expect(page.locator('text=Currently Active').first()).toBeVisible();

    // Click Exit on the impersonation banner to clear impersonation
    const exitBtn = page.getByRole('button', { name: /^Exit$/i }).first();
    await exitBtn.click();

    // Verify banner is dismissed
    await expect(banner).not.toBeVisible();
  });

  test('should render rapid hosting engine with strict 9 official ballgames', async ({ page }) => {
    await page.goto('/dev');

    // Navigate to Rapid Hosting tab
    await page.getByRole('tab', { name: /Rapid Hosting/i }).click();

    // Verify R1 Engine header
    await expect(page.getByText('Rapid Multi-Ballgame Tournament Hosting Engine')).toBeVisible();

    // Verify all 9 official PSU ballgame disciplines are available
    const officialSports = [
      'Basketball',
      'Volleyball',
      'Soccer',
      'Futsal',
      'Sepak Takraw',
      'Baseball',
      'Softball',
      'Pickleball',
      'Table Tennis',
    ];

    for (const sport of officialSports) {
      const sportBtn = page.getByRole('button', { name: new RegExp(sport, 'i') }).first();
      await expect(sportBtn).toBeVisible();
    }

    // Verify non-ballgame sports (e.g. Chess, Swimming, Esports) are NOT present
    await expect(page.locator('text=Esports')).not.toBeVisible();
    await expect(page.locator('text=Swimming')).not.toBeVisible();
    await expect(page.locator('text=Chess')).not.toBeVisible();

    // Select Volleyball
    const volleyballBtn = page.getByRole('button', { name: /Volleyball/i }).first();
    await volleyballBtn.click();

    // Verify Division options (Binturungan, Inter-Collegiate, Friendly)
    const divisionSelect = page.locator('select').first();
    await expect(divisionSelect).toContainText('Inter-Collegiate');
    await expect(divisionSelect).toContainText('Binturungan');
    await expect(divisionSelect).toContainText('Friendly');

    // Verify Host Single Tournament button reflects selection
    await expect(page.getByRole('button', { name: /Host Volleyball Tournament/i })).toBeVisible();

    // Verify Batch Host 9-Ballgame Circuit is ready
    await expect(page.getByRole('button', { name: /Batch Host All 9 Ballgames/i })).toBeVisible();
  });

  test('should execute single tournament rapid hosting and batch circuit triggers', async ({ page }) => {
    await page.goto('/dev?tab=hosting');

    // Click Volleyball sport button
    const volleyballBtn = page.getByRole('button', { name: /Volleyball/i }).first();
    await volleyballBtn.click();

    // Click Host Volleyball Tournament
    const hostSingleBtn = page.getByRole('button', { name: /Host Volleyball Tournament/i });
    await expect(hostSingleBtn).toBeVisible();
    await hostSingleBtn.click();

    // Expect success toast indicating tournament hosted
    await expect(page.locator('text=Hosted').first()).toBeVisible({ timeout: 10000 });

    // Click Batch Host All 9 Ballgames
    const batchHostBtn = page.getByRole('button', { name: /Batch Host All 9 Ballgames/i });
    await expect(batchHostBtn).toBeVisible();
    await batchHostBtn.click();

    // Expect success toast indicating batch hosted
    await expect(page.locator('text=Successfully hosted all 9 official PSU ballgame tournaments').first()).toBeVisible({ timeout: 15000 });
  });

  test('should render role-adaptive faker generator and clearance presets', async ({ page }) => {
    await page.goto('/dev');

    // Navigate to Faker & Clearance tab
    await page.getByRole('tab', { name: /Faker & Clearance/i }).click();

    // Verify R2 Generator header
    await expect(page.getByText('Role-Adaptive Faker User Generator')).toBeVisible();

    // Verify role select options
    const roleSelect = page.locator('select').first();
    await expect(roleSelect).toContainText('Student Athletes (2024-8-XXXX)');
    await expect(roleSelect).toContainText('Faculty Athletes (EMP-2024-XXXX)');
    await expect(roleSelect).toContainText('Staff Athletes (EMP-2024-XXXX)');
    await expect(roleSelect).toContainText('Athletic Coaches');
    await expect(roleSelect).toContainText('Courtside Facilitators / Officials');

    // Verify 1-Tap Clearance Review Batch action button exists
    const clearanceBatchBtn = page.getByRole('button', { name: /1-Tap Clearance Review Batch/i });
    await expect(clearanceBatchBtn).toBeVisible();
  });

  test('should execute faker user generator and 1-tap clearance queue batch', async ({ page }) => {
    await page.goto('/dev?tab=faker');

    // Trigger Faker User Generation
    const generateBtn = page.getByRole('button', { name: /Generate \d+ Personas/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Verify generation success toast
    await expect(page.locator('text=Generated').first()).toBeVisible({ timeout: 10000 });

    // Trigger 1-Tap Clearance Review Batch
    const clearanceBatchBtn = page.getByRole('button', { name: /1-Tap Clearance Review Batch/i });
    await expect(clearanceBatchBtn).toBeVisible();
    await clearanceBatchBtn.click();

    // Verify clearance queue creation toast
    await expect(page.locator('text=populated pending Admin clearance verification queue').first()).toBeVisible({ timeout: 10000 });
  });

  test('should render sport-aware score simulator and fast-forward controls', async ({ page }) => {
    await page.goto('/dev');

    // Navigate to Score Simulator tab
    await page.getByRole('tab', { name: /Score Simulator/i }).click();

    // Verify R4 Simulator header
    await expect(page.getByText('Sport-Aware Score Simulation & Fast-Forward Engine')).toBeVisible();

    // Verify Auto-Bot Toggle button
    const autoBotBtn = page.getByRole('button', { name: /Start Auto-Play Bot/i });
    await expect(autoBotBtn).toBeVisible();
  });

  test('should simulate sport scoring plays and fast-forward clutch moments', async ({ page }) => {
    await page.goto('/dev?tab=bot');

    // Verify active match selection
    await expect(page.locator('text=CAS Titans').first()).toBeVisible();
    await expect(page.locator('text=CBA Wolves').first()).toBeVisible();

    // Click scoring play for Team A (+2 Field Goal)
    const teamAPlus2 = page.getByRole('button', { name: /\+2 Field Goal/i }).first();
    await expect(teamAPlus2).toBeVisible();
    await teamAPlus2.click();

    // Verify score event toast
    await expect(page.locator('text=+2 PTS for CAS Titans').first()).toBeVisible({ timeout: 10000 });

    // Click Clutch Fast-Forward: Clutch Tied Game
    const tiedGameBtn = page.getByRole('button', { name: /Clutch Tied Game/i });
    await expect(tiedGameBtn).toBeVisible();
    await tiedGameBtn.click();

    // Verify clutch fast-forward toast
    await expect(page.locator('text=Fast-forwarded Basketball match to tied').first()).toBeVisible({ timeout: 10000 });

    // Conclude Match with Stars
    const concludeBtn = page.getByRole('button', { name: /Conclude Match: CAS Titans Wins \+ MVP Stars/i });
    await expect(concludeBtn).toBeVisible();
    await concludeBtn.click();

    // Verify conclusion toast
    await expect(page.locator('text=Match concluded! CAS Titans won').first()).toBeVisible({ timeout: 10000 });
  });

  test('should trigger Capstone defense showcase scenario cards', async ({ page }) => {
    await page.goto('/dev?tab=scenarios');

    // Verify scenario cards exist
    await expect(page.getByText('Courtside Halftime Thriller').first()).toBeVisible();
    await expect(page.getByText('Championship Sunday & Medal Podium').first()).toBeVisible();
    await expect(page.getByText('Recruitment & COR Verification Queue').first()).toBeVisible();

    // Inject Halftime Thriller
    const injectHalftimeBtn = page.getByRole('button', { name: /Inject Courtside Halftime Thriller/i }).first();
    await injectHalftimeBtn.click();

    // Verify success toast
    await expect(page.locator('text=Live Halftime Match injected').first()).toBeVisible({ timeout: 10000 });
  });

  test('should adapt layout responsively on mobile viewport without text clipping', async ({ page }) => {
    // Set viewport to mobile phone width (390x844 - iPhone 12/13/14)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev');

    // Verify Command Deck header fits mobile screen
    await expect(page.locator('text=COMMAND DECK').first()).toBeVisible();

    // Verify ExpandableIconTabs renders on mobile
    const expandableTabs = page.locator('div[role="tablist"]');
    await expect(expandableTabs).toBeVisible();

    // Click through tabs on mobile to ensure no layout breakage
    const rapidHostingTab = page.getByRole('tab', { name: /Rapid Hosting/i });
    await expect(rapidHostingTab).toBeVisible();
    await rapidHostingTab.click();

    await expect(page.getByText('Rapid Multi-Ballgame Tournament Hosting Engine')).toBeVisible();

    // Verify horizontal overflow does not exceed viewport
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(395);
  });

  test('should enforce double-confirmation modal on Hard Reset full database wipe', async ({ page }) => {
    await page.goto('/dev');

    // Navigate to Health & Dual Wipe tab
    await page.getByRole('tab', { name: /Health & Dual Wipe/i }).click();

    // Verify Dual Wipe controls
    await expect(page.getByRole('button', { name: /Clean Slate \(Safe Scoped\)/i })).toBeVisible();
    const hardResetBtn = page.getByRole('button', { name: /Hard Reset \(Complete Wipe\)/i });
    await expect(hardResetBtn).toBeVisible();

    // Open Hard Reset Modal
    await hardResetBtn.click();

    // Verify modal title and instructions
    await expect(page.getByText('Hard Reset Database Confirmation')).toBeVisible();
    await expect(page.getByText('Type RESET below to confirm:')).toBeVisible();

    // Confirm button should initially be disabled
    const confirmWipeBtn = page.getByRole('button', { name: /Confirm Full Wipe/i });
    await expect(confirmWipeBtn).toBeDisabled();

    // Type incorrect text
    const confirmInput = page.getByPlaceholder('RESET');
    await confirmInput.fill('NOPE');
    await expect(confirmWipeBtn).toBeDisabled();

    // Type RESET
    await confirmInput.fill('RESET');
    await expect(confirmWipeBtn).toBeEnabled();

    // Cancel modal
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText('Hard Reset Database Confirmation')).not.toBeVisible();
  });
});
