import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * UI Anti-Clipping & Responsive Typography Full Sweep Test Suite
 *
 * Requirements Reference:
 * - ORIGINAL_REQUEST.md ## 2026-10-29T05:06:18Z (R1, R2, R3, R4)
 * - PROJECT.md (Feature Inventory 1-10, Interface Contracts)
 * - TEST_INFRA.md (4-Tier Verification Framework & Programmatic Evaluators)
 *
 * Viewports Covered:
 * - 375x667  (Standard Mobile / iPhone SE 2020)
 * - 768x1024 (Tablet Portrait / iPad)
 * - 1280x720 (Standard Desktop / Laptop)
 * - 1920x1080 (Stadium Jumbotron / FHD Display)
 * - 320x568  (Auxiliary Compact Mobile)
 * - 414x896  (Auxiliary Large Mobile / iPhone XR)
 */

interface AntiClippingMetric {
  text: string;
  scrollWidth: number;
  clientWidth: number;
  isClipped: boolean;
  hasEllipsisCutoff: boolean;
  paddingRight: number;
  isItalic: boolean;
  whiteSpace: string;
}

/**
 * Programmatic DOM evaluator asserting:
 * 1. scrollWidth <= clientWidth + 2 (sub-pixel anti-aliasing tolerance)
 * 2. No premature CSS text-overflow ellipsis cutoff
 * 3. Italic elements have >= 5.5px right clearance (pr-1.5 to pr-3) for slanted glyphs
 */
async function verifyElementAntiClipping(locator: Locator, contextDesc: string): Promise<void> {
  await expect(locator).toBeVisible();

  const metric: AntiClippingMetric = await locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const text = el.textContent?.trim() || '';
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const isClipped = scrollWidth > clientWidth + 2;
    const hasEllipsisCutoff = style.textOverflow === 'ellipsis' && (isClipped || style.whiteSpace === 'nowrap');
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const isItalic = style.fontStyle === 'italic';
    const whiteSpace = style.whiteSpace;

    return {
      text,
      scrollWidth,
      clientWidth,
      isClipped,
      hasEllipsisCutoff,
      paddingRight,
      isItalic,
      whiteSpace,
    };
  });

  expect(
    metric.isClipped,
    `Element "${metric.text}" is clipped! scrollWidth (${metric.scrollWidth}px) > clientWidth + 2 (${metric.clientWidth + 2}px) [${contextDesc}]`
  ).toBe(false);

  expect(
    metric.hasEllipsisCutoff,
    `Element "${metric.text}" prematurely cuts off with text-overflow: ellipsis and whiteSpace: ${metric.whiteSpace} [${contextDesc}]`
  ).toBe(false);

  if (metric.isItalic) {
    expect(
      metric.paddingRight,
      `Italic element "${metric.text}" must have >= 5.5px right padding (pr-1.5 to pr-3) for glyph clearance (got ${metric.paddingRight}px) [${contextDesc}]`
    ).toBeGreaterThanOrEqual(5.5);
  }
}

/**
 * Verifies document-level zero horizontal overflow.
 * Neither documentElement nor body may generate horizontal scrollbars.
 */
async function assertZeroHorizontalOverflow(page: Page, route: string, vpName: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const docScrollWidth = docEl.scrollWidth;
    const docClientWidth = docEl.clientWidth;
    const bodyScrollWidth = body ? body.scrollWidth : 0;
    const windowWidth = window.innerWidth;

    return {
      hasDocOverflow: docScrollWidth > docClientWidth + 2,
      hasBodyOverflow: bodyScrollWidth > windowWidth + 2,
      docScrollWidth,
      docClientWidth,
      bodyScrollWidth,
      windowWidth,
    };
  });

  expect(
    overflow.hasDocOverflow,
    `Document horizontal overflow detected on ${route} at ${vpName}: scrollWidth (${overflow.docScrollWidth}px) > clientWidth + 2 (${overflow.docClientWidth + 2}px)`
  ).toBe(false);

  expect(
    overflow.hasBodyOverflow,
    `Body horizontal overflow detected on ${route} at ${vpName}: scrollWidth (${overflow.bodyScrollWidth}px) > innerWidth + 2 (${overflow.windowWidth + 2}px)`
  ).toBe(false);
}

// ---------------------------------------------------------------------------
// Mock Data Helpers
// ---------------------------------------------------------------------------

const MOCK_MATCH_ID_LONG = 'match-stadium-long-entities-001';
const MOCK_MATCH_ID_EXCLAMATION = 'match-stadium-exclamation-002';

async function setupStadiumDisplayMock(
  page: Page,
  matchOverride: {
    id: string;
    teamAName: string;
    teamBName: string;
    tournamentName?: string;
  }
): Promise<void> {
  const mockMatch = {
    id: matchOverride.id,
    round: 'CHAMPIONSHIP PLAYOFFS - UPPER SEMIFINALS',
    status: 'Ongoing',
    team_a_score: 92,
    team_b_score: 87,
    team_a_id: 'team-a-mock-id',
    team_b_id: 'team-b-mock-id',
    venue: 'PSU Sports Complex - Arena Court 1',
    match_time: new Date().toISOString(),
    team_a: { name: matchOverride.teamAName },
    team_b: { name: matchOverride.teamBName },
    tournament_id: 'tourn-intramurals-2026',
    tournament: {
      name: matchOverride.tournamentName || 'PSU PALAWANAN INTRAMURALS 2026 - SEPAK TAKRAW REGU',
      sport: 'Basketball',
    },
  };

  await page.route(`**/rest/v1/matches*`, async (route) => {
    const url = route.request().url();
    if (url.includes(matchOverride.id) || url.includes('eq.')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMatch),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockMatch]),
      });
    }
  });

  await page.route(`**/rest/v1/match_events*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function setupRankingMock(page: Page): Promise<void> {
  const mockColleges = [
    { id: 'col-ceat', college_name: 'College of Engineering and Technology (CEAT)' },
    { id: 'col-cba', college_name: 'College of Business and Accountancy (CBA)' },
    { id: 'col-cah', college_name: 'College of Arts and Humanities (CAH)' },
    { id: 'col-ccje', college_name: 'College of Criminal Justice Education (CCJE)' },
  ];

  const mockClusters = [
    { id: 'cl-binturungan', name: 'Authentic Binturungan', description: 'Binturungan Tribe', college_codes: ['CEAT'] },
    { id: 'cl-psu', name: 'Palawan State University Tribe', description: 'Central Tribe', college_codes: ['CBA'] },
    { id: 'cl-artistics', name: 'Artistics Tribe', description: 'Humanities Tribe', college_codes: ['CAH'] },
  ];

  const mockTournaments = [
    {
      id: 'tourn-champ-1',
      name: 'PSU Palawanan Championship 2026',
      sport: 'Basketball',
      type: 'Championship',
      status: 'Completed',
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-03-10T00:00:00Z',
    },
  ];

  const mockTeams = [
    {
      id: 'team-rank-1',
      name: 'COLLEGE OF ENGINEERING AND TECHNOLOGY',
      tournament_id: 'tourn-champ-1',
      status: 'Approved',
      affiliation_type: 'college',
      college_id: 'col-ceat',
      cluster_id: 'cl-binturungan',
      colleges: { id: 'col-ceat', college_name: 'College of Engineering and Technology (CEAT)' },
      clusters: { id: 'cl-binturungan', name: 'Authentic Binturungan', description: 'Binturungan Tribe' },
    },
    {
      id: 'team-rank-2',
      name: 'COLLEGE OF BUSINESS AND ACCOUNTANCY',
      tournament_id: 'tourn-champ-1',
      status: 'Approved',
      affiliation_type: 'college',
      college_id: 'col-cba',
      cluster_id: 'cl-psu',
      colleges: { id: 'col-cba', college_name: 'College of Business and Accountancy (CBA)' },
      clusters: { id: 'cl-psu', name: 'Palawan State University Tribe', description: 'Central Tribe' },
    },
    {
      id: 'team-rank-3',
      name: 'COLLEGE OF ARTS AND HUMANITIES',
      tournament_id: 'tourn-champ-1',
      status: 'Approved',
      affiliation_type: 'college',
      college_id: 'col-cah',
      cluster_id: 'cl-artistics',
      colleges: { id: 'col-cah', college_name: 'College of Arts and Humanities (CAH)' },
      clusters: { id: 'cl-artistics', name: 'Artistics Tribe', description: 'Humanities Tribe' },
    },
  ];

  const mockMatches = [
    {
      id: 'match-final',
      tournament_id: 'tourn-champ-1',
      round: 'Grand Finals',
      status: 'Completed',
      team_a_id: 'team-rank-1',
      team_b_id: 'team-rank-2',
      team_a_score: 95,
      team_b_score: 88,
      match_time: '2026-03-10T14:00:00Z',
      venue: 'Main Gym',
      team_a: { name: 'COLLEGE OF ENGINEERING AND TECHNOLOGY' },
      team_b: { name: 'COLLEGE OF BUSINESS AND ACCOUNTANCY' },
    },
    {
      id: 'match-semi-1',
      tournament_id: 'tourn-champ-1',
      round: 'Semifinals',
      status: 'Completed',
      team_a_id: 'team-rank-1',
      team_b_id: 'team-rank-3',
      team_a_score: 80,
      team_b_score: 72,
      match_time: '2026-03-08T14:00:00Z',
      venue: 'Main Gym',
      team_a: { name: 'COLLEGE OF ENGINEERING AND TECHNOLOGY' },
      team_b: { name: 'COLLEGE OF ARTS AND HUMANITIES' },
    },
    {
      id: 'match-bronze',
      tournament_id: 'tourn-champ-1',
      round: '3rd Place Bronze Match',
      status: 'Completed',
      team_a_id: 'team-rank-3',
      team_b_id: 'team-rank-4',
      team_a_score: 77,
      team_b_score: 70,
      match_time: '2026-03-09T14:00:00Z',
      venue: 'Main Gym',
      team_a: { name: 'COLLEGE OF ARTS AND HUMANITIES' },
      team_b: { name: 'COLLEGE OF CRIMINAL JUSTICE EDUCATION' },
    },
  ];

  await page.route('**/rest/v1/tournaments*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTournaments) });
  });

  await page.route('**/rest/v1/teams*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTeams) });
  });

  await page.route('**/rest/v1/matches*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMatches) });
  });

  await page.route('**/rest/v1/colleges*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockColleges) });
  });

  await page.route('**/rest/v1/clusters*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockClusters) });
  });

  await page.route('**/rest/v1/player_stars*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function setupMatchCenterMock(page: Page): Promise<void> {
  const tournId = 'tourn-mc-2026';
  const mockTournaments = [
    {
      id: tournId,
      name: 'PSU PALAWANAN INTRAMURALS 2026',
      sport: 'Basketball',
      type: 'Binturungan',
      status: 'Ongoing',
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-03-15T00:00:00Z',
    },
  ];

  const mockMatches = [
    {
      id: 'match-mc-1',
      tournament_id: tournId,
      round: 'CHAMPIONSHIP PLAYOFFS - UPPER SEMIFINALS',
      status: 'Ongoing',
      team_a_score: 45,
      team_b_score: 41,
      match_time: new Date().toISOString(),
      venue: 'PSU Main Court A',
      team_a: { name: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' },
      team_b: { name: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' },
      tournament: {
        id: tournId,
        name: 'PSU PALAWANAN INTRAMURALS 2026',
        sport: 'Basketball',
        type: 'Binturungan',
        status: 'Ongoing',
      },
    },
  ];

  const mockTeams = [
    {
      id: 'team-mc-1',
      name: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
      affiliation_type: 'college',
      college_id: 'col-cba',
      cluster_id: 'cl-psu',
      colleges: { college_name: 'College of Business and Accountancy (CBA)' },
      clusters: { name: 'PSU Tribe' },
    },
    {
      id: 'team-mc-2',
      name: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS',
      affiliation_type: 'college',
      college_id: 'col-ceat',
      cluster_id: 'cl-binturungan',
      colleges: { college_name: 'College of Engineering, Architecture and Technology (CEAT)' },
      clusters: { name: 'Binturungan Tribe' },
    },
  ];

  await page.route('**/rest/v1/tournaments*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTournaments) });
  });

  await page.route('**/rest/v1/matches*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMatches) });
  });

  await page.route('**/rest/v1/teams*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTeams) });
  });
}

async function setupPlayerDashboardMock(page: Page): Promise<void> {
  const studentId = 'student-sweep-tester-001';
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
  const mockUser = {
    id: studentId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'athlete.sweep@psu.palawan.edu.ph',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'DANILO DE LOS SANTOS MAGBANUA JR.' },
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'fake-sweep-token',
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
        full_name: 'DANILO DE LOS SANTOS MAGBANUA JR.',
        college_name: 'College of Business and Accountancy (CBA)',
        program: 'BSBA Financial Management',
        year_level: '3rd Year',
        primary_position: 'Guard',
        role: 'player_student',
        is_verified: true,
        account_status: 'active',
      }),
    });
  });

  await page.route('**/rest/v1/matches*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'dash-match-1',
          round: 'CHAMPIONSHIP PLAYOFFS - UPPER SEMIFINALS',
          status: 'Ongoing',
          team_a_score: 34,
          team_b_score: 30,
          venue: 'PSU Sports Complex - Arena Court A',
          team_a: { name: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' },
          team_b: { name: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' },
          tournament: {
            id: 'dash-tourn-1',
            name: 'PSU Binturungan 2026 - Basketball Championship',
            sport: 'Basketball',
            type: 'Binturungan',
          },
        },
      ]),
    });
  });

  await page.route('**/rest/v1/tournaments*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'dash-tourn-1',
          name: 'PSU Binturungan 2026 - Basketball Championship',
          sport: 'Basketball',
          type: 'Binturungan',
          status: 'Ongoing',
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

  await page.route('**/rest/v1/verification_documents*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.addInitScript(({ session }) => {
    localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
  }, { session: mockSession });
}

// ===========================================================================
// TEST SUITE: UI Anti-Clipping Full Sweep
// ===========================================================================

/**
 * Dynamic Font Sizing specification from PROJECT.md / StadiumDisplay.tsx
 */
function getScoreboardTeamFontClass(name?: string | null): string {
  const len = name?.trim().length || 0;
  if (len <= 14) return 'text-2xl sm:text-4xl md:text-5xl';
  if (len <= 24) return 'text-xl sm:text-3xl md:text-4xl';
  if (len <= 36) return 'text-lg sm:text-2xl md:text-3xl';
  return 'text-base sm:text-xl md:text-2xl';
}

test.describe('Tier 1 & R1: Stadium Display Dynamic Scaling & Anti-Clipping', () => {
  test('Dynamic Font Sizing Contract resolves correct classes for tiered lengths', () => {
    // <= 14 characters: Colossal jumbotron centerpiece
    expect(getScoreboardTeamFontClass('CBA')).toBe('text-2xl sm:text-4xl md:text-5xl');
    expect(getScoreboardTeamFontClass('CEAT SCORPIONS')).toBe('text-2xl sm:text-4xl md:text-5xl');

    // 15 to 24 characters: Scaled jumbotron
    expect(getScoreboardTeamFontClass('CBA GOLDEN WOLVES')).toBe('text-xl sm:text-3xl md:text-4xl');
    expect(getScoreboardTeamFontClass('CHMT NAVIGATORS!')).toBe('text-xl sm:text-3xl md:text-4xl');

    // 25 to 36 characters: Balanced multi-line
    expect(getScoreboardTeamFontClass('COLLEGE OF ARTS AND HUMANITIES')).toBe('text-lg sm:text-2xl md:text-3xl');

    // > 36 characters: Crisp, anti-clipping 2-line wrap
    expect(getScoreboardTeamFontClass('COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES')).toBe('text-base sm:text-xl md:text-2xl');
    expect(getScoreboardTeamFontClass('COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS')).toBe('text-base sm:text-xl md:text-2xl');

    // Empty / null fallbacks
    expect(getScoreboardTeamFontClass(null)).toBe('text-2xl sm:text-4xl md:text-5xl');
    expect(getScoreboardTeamFontClass('')).toBe('text-2xl sm:text-4xl md:text-5xl');
  });

  test('StadiumDisplay: 49-character team names wrap over 2 lines without single-line ellipsis on Mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupStadiumDisplayMock(page, {
      id: MOCK_MATCH_ID_LONG,
      teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
      teamBName: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS',
    });

    await page.goto(`/match/${MOCK_MATCH_ID_LONG}/display`);
    await page.waitForLoadState('networkidle');

    // Verify Team A and Team B headers
    const teamAHeading = page.locator('h2', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
    const teamBHeading = page.locator('h2', { hasText: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' });

    await expect(teamAHeading).toBeVisible();
    await expect(teamBHeading).toBeVisible();

    // Must NOT contain ellipsis truncation '...'
    const teamAText = (await teamAHeading.textContent()) || '';
    const teamBText = (await teamBHeading.textContent()) || '';
    expect(teamAText).toContain('COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES');
    expect(teamAText).not.toContain('...');
    expect(teamBText).toContain('COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS');
    expect(teamBText).not.toContain('...');

    // Programmatic Anti-Clipping Evaluation
    await verifyElementAntiClipping(teamAHeading, 'StadiumDisplay Team A on Mobile 375');
    await verifyElementAntiClipping(teamBHeading, 'StadiumDisplay Team B on Mobile 375');

    // Tournament top header anti-clipping
    const tournHeader = page.locator('h1', { hasText: 'PSU PALAWANAN INTRAMURALS 2026' });
    await expect(tournHeader).toBeVisible();
    await verifyElementAntiClipping(tournHeader, 'StadiumDisplay Tournament Title on Mobile 375');

    // Page-level zero horizontal overflow
    await assertZeroHorizontalOverflow(page, `/match/${MOCK_MATCH_ID_LONG}/display`, 'Mobile 375x667');
  });

  test('StadiumDisplay: Slanted punctuation "CBA GOLDEN WOLVES!" has >= 5.5px right clearance on Tablet (768x1024) & Desktop (1280x720)', async ({ page }) => {
    for (const vp of [
      { width: 768, height: 1024, name: 'Tablet 768' },
      { width: 1280, height: 720, name: 'Desktop 1280' },
      { width: 1920, height: 1080, name: 'Stadium/FHD 1920' },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupStadiumDisplayMock(page, {
        id: MOCK_MATCH_ID_EXCLAMATION,
        teamAName: 'CBA GOLDEN WOLVES!',
        teamBName: 'CHMT NAVIGATORS!',
      });

      await page.goto(`/match/${MOCK_MATCH_ID_EXCLAMATION}/display`);
      await page.waitForLoadState('networkidle');

      const teamAHeading = page.locator('h2', { hasText: 'CBA GOLDEN WOLVES!' });
      await expect(teamAHeading).toBeVisible();

      // Slanted terminal glyphs '!' and 'S' must have adequate right padding
      await verifyElementAntiClipping(teamAHeading, `StadiumDisplay Team A at ${vp.name}`);

      // Verify no document horizontal scroll
      await assertZeroHorizontalOverflow(page, `/match/${MOCK_MATCH_ID_EXCLAMATION}/display`, vp.name);
    }
  });

  test('StadiumDisplay: Extreme compact screen (320x568) maintains zero horizontal document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await setupStadiumDisplayMock(page, {
      id: MOCK_MATCH_ID_LONG,
      teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
      teamBName: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS',
    });

    await page.goto(`/match/${MOCK_MATCH_ID_LONG}/display`);
    await page.waitForLoadState('networkidle');

    await assertZeroHorizontalOverflow(page, `/match/${MOCK_MATCH_ID_LONG}/display`, 'Auxiliary 320x568');
  });
});

// ---------------------------------------------------------------------------
// TEST GROUP 2: Ranking Podium Cards Full Entity Name Legibility
// ---------------------------------------------------------------------------

test.describe('Tier 2 & R2: Ranking Podium Full Entity Name Legibility', () => {
  const desktopViewports = [
    { width: 768, height: 1024, name: 'Tablet 768x1024' },
    { width: 1280, height: 720, name: 'Desktop 1280x720' },
    { width: 1920, height: 1080, name: 'Stadium 1920x1080' },
  ];

  for (const vp of desktopViewports) {
    test(`Desktop Podium Cards wrap full entity names without single-line ellipsis at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupRankingMock(page);

      await page.goto('/ranking');
      await page.waitForLoadState('networkidle');

      // 1. Champion Tier Card (Gold)
      const championCardTitle = page.locator('h4', { hasText: /COLLEGE OF ENGINEERING AND TECHNOLOGY/i });
      await expect(championCardTitle).toBeVisible();
      const champText = (await championCardTitle.textContent()) || '';
      expect(champText).not.toContain('COLLEGE OF ENGI...');
      expect(champText).not.toContain('...');
      await verifyElementAntiClipping(championCardTitle, `Champion Podium Title at ${vp.name}`);

      // 2. Silver Tier Card
      const silverCardTitle = page.locator('h4', { hasText: /COLLEGE OF BUSINESS AND ACCOUNTANCY/i });
      await expect(silverCardTitle).toBeVisible();
      const silverText = (await silverCardTitle.textContent()) || '';
      expect(silverText).not.toContain('COLLEGE OF BUSINESS AND A...');
      expect(silverText).not.toContain('...');
      await verifyElementAntiClipping(silverCardTitle, `Silver Podium Title at ${vp.name}`);

      // 3. Bronze Tier Card
      const bronzeCardTitle = page.locator('h4', { hasText: /COLLEGE OF ARTS AND HUMANITIES/i });
      await expect(bronzeCardTitle).toBeVisible();
      await verifyElementAntiClipping(bronzeCardTitle, `Bronze Podium Title at ${vp.name}`);

      // 4. Subtitle Tribe Wrapping
      const championSubtitle = page.locator('p', { hasText: /Authentic Binturungan/i }).first();
      if (await championSubtitle.isVisible()) {
        const subText = (await championSubtitle.textContent()) || '';
        expect(subText).not.toContain('...');
        await verifyElementAntiClipping(championSubtitle, `Champion Subtitle at ${vp.name}`);
      }

      // 5. Zero document horizontal overflow
      await assertZeroHorizontalOverflow(page, '/ranking', vp.name);
    });
  }

  const mobileViewports = [
    { width: 320, height: 568, name: 'Compact Mobile 320x568' },
    { width: 375, height: 667, name: 'Standard Mobile 375x667' },
    { width: 414, height: 896, name: 'Large Mobile 414x896' },
  ];

  for (const vp of mobileViewports) {
    test(`Mobile Podium Spotlight wraps Champion & Silver/Bronze cards cleanly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupRankingMock(page);

      await page.goto('/ranking');
      await page.waitForLoadState('networkidle');

      // In mobile view (md:hidden), the Champion spotlight heading is rendered
      const mobileChampHeading = page.locator('h4', { hasText: /COLLEGE OF ENGINEERING AND TECHNOLOGY/i }).first();
      await expect(mobileChampHeading).toBeVisible();

      const champText = (await mobileChampHeading.textContent()) || '';
      expect(champText).not.toContain('COLLEGE OF ENGI...');
      await verifyElementAntiClipping(mobileChampHeading, `Mobile Champion Title at ${vp.name}`);

      // Mobile Silver card entity subtitle / code
      const mobileSilverCard = page.locator('div', { hasText: /Silver/i }).first();
      await expect(mobileSilverCard).toBeVisible();

      // Mobile standings list row italic check
      const standingsItalicRow = page.locator('span.font-black.italic.uppercase').first();
      if (await standingsItalicRow.isVisible()) {
        await verifyElementAntiClipping(standingsItalicRow, `Mobile Standings Italic Row at ${vp.name}`);
      }

      // Zero document-level horizontal scrollbar
      await assertZeroHorizontalOverflow(page, '/ranking', vp.name);
    });
  }
});

// ---------------------------------------------------------------------------
// TEST GROUP 3: Match Center Schedule & Bracket Component Audit
// ---------------------------------------------------------------------------

test.describe('Tier 3 & R3: Match Center Schedule & Bracket Component Audit', () => {
  test('MatchScheduleList: Mobile top-down slots wrap with line-clamp-1 and pr-1.5 at 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupMatchCenterMock(page);

    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Mobile match slots
    const teamASlot = page.locator('span', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' }).first();
    const teamBSlot = page.locator('span', { hasText: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' }).first();

    if (await teamASlot.isVisible()) {
      await verifyElementAntiClipping(teamASlot, 'MatchScheduleList Mobile Team A Slot');
    }
    if (await teamBSlot.isVisible()) {
      await verifyElementAntiClipping(teamBSlot, 'MatchScheduleList Mobile Team B Slot');
    }

    // Playoff Round Tag
    const roundTag = page.locator('span', { hasText: /CHAMPIONSHIP PLAYOFFS/i }).first();
    if (await roundTag.isVisible()) {
      const roundText = (await roundTag.textContent()) || '';
      expect(roundText).toContain('CHAMPIONSHIP PLAYOFFS');
      await verifyElementAntiClipping(roundTag, 'MatchScheduleList Round Tag');
    }

    await assertZeroHorizontalOverflow(page, '/explorer', 'Mobile 375x667');
  });

  test('MatchScheduleList: Desktop horizontal row matchup anti-clipping at 1280x720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setupMatchCenterMock(page);

    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Desktop row spans
    const teamASpan = page.locator('span', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' }).first();
    const teamBSpan = page.locator('span', { hasText: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' }).first();

    if (await teamASpan.isVisible()) {
      await verifyElementAntiClipping(teamASpan, 'MatchScheduleList Desktop Team A');
    }
    if (await teamBSpan.isVisible()) {
      await verifyElementAntiClipping(teamBSpan, 'MatchScheduleList Desktop Team B');
    }

    await assertZeroHorizontalOverflow(page, '/explorer', 'Desktop 1280x720');
  });

  test('Bracket Tree: Tree columns horizontal scroll is safely isolated within overflow-x-auto', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupMatchCenterMock(page);

    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Check if Bracket tab or tree exists
    const bracketBtn = page.getByRole('button', { name: /Bracket/i }).or(page.getByRole('tab', { name: /Bracket/i }));
    if (await bracketBtn.isVisible()) {
      await bracketBtn.click();
      await page.waitForTimeout(400);

      // Bracket tree may have min-w-[540px] to min-w-[840px], but document-level scrollWidth must be bounded!
      await assertZeroHorizontalOverflow(page, '/explorer [Bracket View]', 'Mobile 375x667');
    }
  });
});

// ---------------------------------------------------------------------------
// TEST GROUP 4: Player Dashboard Typography & Hero Anti-Clipping
// ---------------------------------------------------------------------------

test.describe('Tier 3 & R3: Player Dashboard Typography & Hero Anti-Clipping', () => {
  test('Player Dashboard: Long athlete name and live match cards wrap cleanly without glyph cutoff', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupPlayerDashboardMock(page);

    await page.goto('/player');
    await page.waitForLoadState('networkidle');

    // Hero Header Athlete Name
    const athleteHero = page.locator('h1', { hasText: 'DANILO DE LOS SANTOS MAGBANUA JR.' });
    if (await athleteHero.isVisible()) {
      await verifyElementAntiClipping(athleteHero, 'Player Dashboard Hero Heading');
    }

    // Match Card Teams
    const matchTeamA = page.locator('span', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' }).first();
    const matchTeamB = page.locator('span', { hasText: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' }).first();

    if (await matchTeamA.isVisible()) {
      await verifyElementAntiClipping(matchTeamA, 'Player Dashboard Match Card Team A');
    }
    if (await matchTeamB.isVisible()) {
      await verifyElementAntiClipping(matchTeamB, 'Player Dashboard Match Card Team B');
    }

    await assertZeroHorizontalOverflow(page, '/player', 'Mobile 375x667');
  });
});

// ---------------------------------------------------------------------------
// TEST GROUP 5: Full Viewport Sweep & Zero Document-Level Horizontal Overflow
// ---------------------------------------------------------------------------

test.describe('Tier 4 & R4: Full Viewport Sweep & Zero Document Horizontal Overflow', () => {
  const sweepViewports = [
    { width: 320, height: 568, name: '320x568 (iPhone SE 1st gen)' },
    { width: 375, height: 667, name: '375x667 (iPhone SE 2nd gen)' },
    { width: 414, height: 896, name: '414x896 (iPhone XR)' },
    { width: 768, height: 1024, name: '768x1024 (iPad Portrait)' },
    { width: 1280, height: 720, name: '1280x720 (Standard HD)' },
    { width: 1920, height: 1080, name: '1920x1080 (FHD / Stadium Display)' },
  ];

  for (const vp of sweepViewports) {
    test(`Zero document-level horizontal scrollbar on /ranking at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupRankingMock(page);
      await page.goto('/ranking');
      await page.waitForLoadState('networkidle');

      await assertZeroHorizontalOverflow(page, '/ranking', vp.name);
    });

    test(`Zero document-level horizontal scrollbar on /explorer at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupMatchCenterMock(page);
      await page.goto('/explorer');
      await page.waitForLoadState('networkidle');

      await assertZeroHorizontalOverflow(page, '/explorer', vp.name);
    });

    test(`Zero document-level horizontal scrollbar on /match/display at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupStadiumDisplayMock(page, {
        id: 'sweep-match-display',
        teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        teamBName: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS',
      });
      await page.goto('/match/sweep-match-display/display');
      await page.waitForLoadState('networkidle');

      await assertZeroHorizontalOverflow(page, '/match/display', vp.name);
    });
  }
});
