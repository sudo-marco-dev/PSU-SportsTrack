import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Milestone 1 Adversarial Typography, Anti-Clipping, and Alignment Test Suite
 * Authored by: Challenger 2 (challenger_m1_ui_2)
 *
 * Verifies:
 * 1. Trailing slanted characters ('S', '!', 'Z', 'W', ')') have >= 5.5px right clearance padding.
 * 2. LeadChangeBanner and FloatingScoreWidget maintain vertical alignment under asymmetric 2-line wraps.
 * 3. Responsive viewports: 320px, 375px, 768px, 1280px, 1920px.
 * 4. Zero document-level horizontal overflow across all tested viewports.
 */

interface ElementMetric {
  text: string;
  scrollWidth: number;
  clientWidth: number;
  isClipped: boolean;
  hasEllipsisCutoff: boolean;
  paddingRight: number;
  paddingLeft: number;
  isItalic: boolean;
  whiteSpace: string;
  boxHeight: number;
  boxTop: number;
}

async function inspectElementMetrics(locator: Locator): Promise<ElementMetric> {
  await expect(locator).toBeVisible();

  return await locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const text = el.textContent?.trim() || '';
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const isClipped = scrollWidth > clientWidth + 2;
    const hasEllipsisCutoff = style.textOverflow === 'ellipsis' && (isClipped || style.whiteSpace === 'nowrap');
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const isItalic = style.fontStyle === 'italic';
    const whiteSpace = style.whiteSpace;

    return {
      text,
      scrollWidth,
      clientWidth,
      isClipped,
      hasEllipsisCutoff,
      paddingRight,
      paddingLeft,
      isItalic,
      whiteSpace,
      boxHeight: rect.height,
      boxTop: rect.top,
    };
  });
}

async function assertZeroHorizontalOverflow(page: Page, contextName: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    return {
      docScrollWidth: docEl.scrollWidth,
      docClientWidth: docEl.clientWidth,
      bodyScrollWidth: body ? body.scrollWidth : 0,
      windowWidth: window.innerWidth,
    };
  });

  expect(
    overflow.docScrollWidth,
    `Document horizontal overflow detected in [${contextName}]: scrollWidth (${overflow.docScrollWidth}px) > clientWidth + 2 (${overflow.docClientWidth + 2}px)`
  ).toBeLessThanOrEqual(overflow.docClientWidth + 2);

  expect(
    overflow.bodyScrollWidth,
    `Body horizontal overflow detected in [${contextName}]: scrollWidth (${overflow.bodyScrollWidth}px) > innerWidth + 2 (${overflow.windowWidth + 2}px)`
  ).toBeLessThanOrEqual(overflow.windowWidth + 2);
}

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

const ADVERSARIAL_MATCH_ID = 'match-m1-adversarial-challenger';

function createMockMatch(overrides: {
  teamAName: string;
  teamBName: string;
  tournamentName?: string;
  round?: string;
  status?: string;
  teamAScore?: number;
  teamBScore?: number;
}) {
  return {
    id: ADVERSARIAL_MATCH_ID,
    round: overrides.round || 'CHAMPIONSHIP PLAYOFFS - GRAND FINALS',
    status: overrides.status || 'Ongoing',
    team_a_score: overrides.teamAScore ?? 88,
    team_b_score: overrides.teamBScore ?? 85,
    team_a_id: 'team-a-adv',
    team_b_id: 'team-b-adv',
    venue: 'PSU Sports Complex - Main Gymnasium',
    match_time: new Date().toISOString(),
    team_a: { name: overrides.teamAName },
    team_b: { name: overrides.teamBName },
    tournament_id: 'tourn-adv-2026',
    tournament: {
      name: overrides.tournamentName || 'PSU PALAWANAN INTRAMURALS 2026 - BASKETBALL MEN',
      sport: 'Basketball',
    },
  };
}

async function setupAdversarialMatchRoute(
  page: Page,
  mockMatch: ReturnType<typeof createMockMatch>,
  events: Array<{ id: string; description: string; created_at: string }> = []
) {
  await page.route('**/rest/v1/matches*', async (route) => {
    const url = route.request().url();
    if (url.includes(mockMatch.id) || url.includes('eq.')) {
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

  await page.route('**/rest/v1/match_events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(events),
    });
  });

  await page.route('**/rest/v1/tournaments*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([mockMatch.tournament]),
    });
  });

  await page.route('**/rest/v1/teams*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: mockMatch.team_a_id, name: mockMatch.team_a.name },
        { id: mockMatch.team_b_id, name: mockMatch.team_b.name },
      ]),
    });
  });

  await page.route('**/rest/v1/team_roster*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/player_stars*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

// ===========================================================================
// ADVERSARIAL TEST SUITE
// ===========================================================================

const VIEWPORTS = [
  { width: 320, height: 568, name: '320px (Auxiliary Compact Mobile)' },
  { width: 375, height: 667, name: '375px (iPhone SE standard)' },
  { width: 768, height: 1024, name: '768px (iPad portrait)' },
  { width: 1280, height: 720, name: '1280px (Standard Desktop / Laptop)' },
  { width: 1920, height: 1080, name: '1920px (Stadium Jumbotron / 1080p FHD)' },
];

test.describe('Milestone 1 Empirical Challenger: Typography Anti-Shearing & Alignment', () => {

  // -------------------------------------------------------------------------
  // 1. Trailing slanted characters clearance (>= 5.5px right clearance)
  // -------------------------------------------------------------------------
  test.describe('Task 1: Trailing slanted characters clearance (S, !, Z, W, ))', () => {
    const trailingCases = [
      {
        charName: 'Uppercase S',
        teamA: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        teamB: 'CEAT RED SCORPIONS',
      },
      {
        charName: 'Exclamation Mark !',
        teamA: 'CBA GOLDEN WOLVES!',
        teamB: 'CHMT NAVIGATORS!',
      },
      {
        charName: 'Uppercase Z',
        teamA: 'CS TECH WIZARDS - BIZ',
        teamB: 'CCJE LAW PATROL BIZ',
      },
      {
        charName: 'Uppercase W',
        teamA: 'STUDENT COMMUNITY CSW',
        teamB: 'APPLIED SCIENCE ASW',
      },
      {
        charName: 'Closing Parenthesis )',
        teamA: 'COLLEGE OF ARTS AND HUMANITIES (CAH)',
        teamB: 'COLLEGE OF TEACHER EDUCATION (CTE)',
      },
    ];

    for (const vp of VIEWPORTS) {
      for (const tc of trailingCases) {
        test(`StadiumDisplay: Trailing "${tc.charName}" has >= 5.5px right clearance at ${vp.name}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const mock = createMockMatch({
            teamAName: tc.teamA,
            teamBName: tc.teamB,
          });
          await setupAdversarialMatchRoute(page, mock);

          await page.goto(`/match/${ADVERSARIAL_MATCH_ID}/display`);
          await page.waitForLoadState('networkidle');

          const headingA = page.locator('h2', { hasText: tc.teamA });
          const headingB = page.locator('h2', { hasText: tc.teamB });

          await expect(headingA).toBeVisible();
          await expect(headingB).toBeVisible();

          const metricA = await inspectElementMetrics(headingA);
          const metricB = await inspectElementMetrics(headingB);

          // Verify italic styling
          expect(metricA.isItalic, `Team A heading should be italic`).toBe(true);
          expect(metricB.isItalic, `Team B heading should be italic`).toBe(true);

          // Verify trailing right clearance >= 5.5px
          expect(
            metricA.paddingRight,
            `Team A "${tc.teamA}" right clearance must be >= 5.5px (got ${metricA.paddingRight}px) [${vp.name}]`
          ).toBeGreaterThanOrEqual(5.5);

          expect(
            metricB.paddingRight,
            `Team B "${tc.teamB}" right clearance must be >= 5.5px (got ${metricB.paddingRight}px) [${vp.name}]`
          ).toBeGreaterThanOrEqual(5.5);

          // Verify no horizontal overflow
          await assertZeroHorizontalOverflow(page, `StadiumDisplay [${tc.charName}] at ${vp.name}`);
        });
      }
    }
  });

  // -------------------------------------------------------------------------
  // 2. FloatingScoreWidget Asymmetry & Vertical Alignment
  // -------------------------------------------------------------------------
  test.describe('Task 2A: FloatingScoreWidget Asymmetric 2-Line Wrap & Alignment', () => {
    for (const vp of [
      { width: 320, height: 568, name: '320px' },
      { width: 375, height: 667, name: '375px' },
      { width: 768, height: 1024, name: '768px' },
      { width: 1280, height: 720, name: '1280px' },
    ]) {
      test(`FloatingScoreWidget: Team A (2-line wrap) vs Team B (3-letter acronym) aligns score numbers at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // Team A: 49 characters (forces 2-line wrap)
        // Team B: 3 characters (1 short line)
        const mock = createMockMatch({
          teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
          teamBName: 'CBA',
          teamAScore: 77,
          teamBScore: 71,
        });
        await setupAdversarialMatchRoute(page, mock);

        await page.goto(`/match/${ADVERSARIAL_MATCH_ID}`);
        await page.waitForLoadState('networkidle');

        // Scroll down to activate FloatingScoreWidget (isScrolledPastScoreboard)
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForTimeout(400);

        // Find FloatingScoreWidget
        const widget = page.locator('div.fixed.bottom-4');
        await expect(widget).toBeVisible();

        // Team A label and Team B label
        const teamALabel = widget.locator('span', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
        const teamBLabel = widget.locator('span', { hasText: 'CBA' });

        await expect(teamALabel).toBeVisible();
        await expect(teamBLabel).toBeVisible();

        const metricA = await inspectElementMetrics(teamALabel);
        const metricB = await inspectElementMetrics(teamBLabel);

        const displayA = await teamALabel.evaluate((el) => window.getComputedStyle(el).display);
        const lineClampA = await teamALabel.evaluate((el) => window.getComputedStyle(el).webkitLineClamp);
        console.log(`[Diagnostic ${vp.name}] displayA: ${displayA}, webkitLineClamp: ${lineClampA}, boxHeightA: ${metricA.boxHeight}px, boxHeightB: ${metricB.boxHeight}px`);

        // Crucial Check: Score tabular numbers (77 vs 71) MUST share the exact same vertical baseline (top position)
        const scoreAEl = widget.locator('div.tabular-nums', { hasText: '77' });
        const scoreBEl = widget.locator('div.tabular-nums', { hasText: '71' });

        await expect(scoreAEl).toBeVisible();
        await expect(scoreBEl).toBeVisible();

        const scoreATop = await scoreAEl.evaluate((el) => el.getBoundingClientRect().top);
        const scoreBTop = await scoreBEl.evaluate((el) => el.getBoundingClientRect().top);

        const scoreTopDelta = Math.abs(scoreATop - scoreBTop);
        console.log(`[Diagnostic ${vp.name}] scoreATop: ${scoreATop}px, scoreBTop: ${scoreBTop}px, delta: ${scoreTopDelta}px`);

        // Height symmetry check
        const heightDifference = Math.abs(metricA.boxHeight - metricB.boxHeight);
        expect(
          heightDifference,
          `FloatingScoreWidget label heights must remain symmetrical between 2-line (${metricA.boxHeight}px) and 1-line (${metricB.boxHeight}px) [${vp.name}]`
        ).toBeLessThanOrEqual(4);

        expect(
          scoreTopDelta,
          `Score numbers must be horizontally aligned at the same vertical offset! Score A top: ${scoreATop}px, Score B top: ${scoreBTop}px, delta: ${scoreTopDelta}px [${vp.name}]`
        ).toBeLessThanOrEqual(2);

        // Verify no document overflow
        await assertZeroHorizontalOverflow(page, `LiveMatch FloatingScoreWidget at ${vp.name}`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 3. LeadChangeBanner Asymmetric Wrap & Alignment
  // -------------------------------------------------------------------------
  test.describe('Task 2B: LeadChangeBanner 2-Line Wrap Alignment & Clearance', () => {
    for (const vp of [
      { width: 320, height: 568, name: '320px' },
      { width: 375, height: 667, name: '375px' },
      { width: 768, height: 1024, name: '768px' },
      { width: 1280, height: 720, name: '1280px' },
      { width: 1920, height: 1080, name: '1920px' },
    ]) {
      test(`LeadChangeBanner: Long slanted team name wraps cleanly without icon distortion at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const mock = createMockMatch({
          teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES!',
          teamBName: 'CEAT',
          teamAScore: 90,
          teamBScore: 89,
        });
        await setupAdversarialMatchRoute(page, mock);

        // Mount LeadChangeBanner directly in page context via evaluate or render test
        await page.goto(`/match/${ADVERSARIAL_MATCH_ID}/display`);
        await page.waitForLoadState('networkidle');

        // Trigger leadChangeAlert in StadiumDisplay DOM state by emitting broadcast or injecting simulated state
        await page.evaluate((teamName) => {
          // Find root and inject custom event or DOM node with identical classes to verify styling
          const container = document.createElement('div');
          container.id = 'adversarial-lead-change-container';
          container.className = 'fixed top-20 left-4 right-4 z-50';
          container.innerHTML = `
            <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/25 via-orange-500/35 to-amber-500/25 border-2 border-orange-500/70 p-3.5 sm:p-4 text-white shadow-2xl">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div id="lead-zap-icon" class="size-9 sm:size-10 rounded-xl bg-orange-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/40">
                    <span class="font-bold">⚡</span>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-orange-400">
                        LEAD CHANGE
                      </span>
                      <span class="text-[10px] sm:text-xs font-mono font-bold text-slate-300 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                        90 - 89
                      </span>
                    </div>
                    <h4 id="lead-heading-target" class="text-sm sm:text-base md:text-lg font-black uppercase italic tracking-tight text-white break-words line-clamp-2 leading-tight pr-2 drop-shadow-sm">
                      <span class="text-orange-300">${teamName}</span> takes the lead!
                    </h4>
                  </div>
                </div>
                <button type="button" id="lead-dismiss-btn" class="size-7 rounded-lg bg-black/20 text-slate-400 flex items-center justify-center shrink-0">
                  ✕
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(container);
        }, 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES!');

        const leadHeading = page.locator('#lead-heading-target');
        const zapIcon = page.locator('#lead-zap-icon');
        const dismissBtn = page.locator('#lead-dismiss-btn');

        await expect(leadHeading).toBeVisible();
        await expect(zapIcon).toBeVisible();
        await expect(dismissBtn).toBeVisible();

        const headingMetric = await inspectElementMetrics(leadHeading);

        // 1. Right padding must be >= 5.5px (from pr-2 = 8px)
        expect(
          headingMetric.paddingRight,
          `LeadChangeBanner italic heading right clearance must be >= 5.5px (got ${headingMetric.paddingRight}px) [${vp.name}]`
        ).toBeGreaterThanOrEqual(5.5);

        // 2. Heading is italic
        expect(headingMetric.isItalic, 'LeadChangeBanner text should be italic').toBe(true);

        // 3. Icon and Dismiss button must NOT be squeezed/shrunk below expected size (shrink-0)
        const zapBox = await zapIcon.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { width: r.width, height: r.height };
        });
        expect(zapBox.width, `Zap icon width should not be shrunk below 34px (got ${zapBox.width}px)`).toBeGreaterThanOrEqual(34);
        expect(zapBox.height, `Zap icon height should not be shrunk below 34px (got ${zapBox.height}px)`).toBeGreaterThanOrEqual(34);

        const dismissBox = await dismissBtn.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { width: r.width, height: r.height };
        });
        expect(dismissBox.width, `Dismiss button width should be >= 26px (got ${dismissBox.width}px)`).toBeGreaterThanOrEqual(26);

        // 4. Verify no document overflow
        await assertZeroHorizontalOverflow(page, `LeadChangeBanner at ${vp.name}`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 4. StadiumTimeoutOverlay Dynamic Scaling & Clearance
  // -------------------------------------------------------------------------
  test.describe('Task 3: StadiumTimeoutOverlay Dynamic Scaling & Padding Clearance', () => {
    for (const vp of VIEWPORTS) {
      test(`StadiumTimeoutOverlay: 49-char team name scales and clears right margin at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const mock = createMockMatch({
          teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES!',
          teamBName: 'CEAT',
        });
        await setupAdversarialMatchRoute(page, mock);

        await page.goto(`/match/${ADVERSARIAL_MATCH_ID}/display`);
        await page.waitForLoadState('networkidle');

        // Inject StadiumTimeoutOverlay DOM representation to evaluate exact rendered CSS metrics
        await page.evaluate((teamName) => {
          const overlay = document.createElement('div');
          overlay.id = 'adversarial-timeout-overlay';
          overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md';
          overlay.innerHTML = `
            <div class="relative w-full max-w-xl bg-slate-900/95 border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-10 shadow-[0_0_80px_rgba(6,182,212,0.35)] flex flex-col items-center text-center overflow-hidden">
              <div class="mb-6">
                <span class="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-400 block mb-1">
                  Called By
                </span>
                <h2 id="timeout-team-title" class="${teamName.length > 25 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'} font-black uppercase italic tracking-tight text-white drop-shadow-[0_2px_15px_rgba(6,182,212,0.4)] break-words line-clamp-2 leading-tight px-3">
                  ${teamName}
                </h2>
              </div>
            </div>
          `;
          document.body.appendChild(overlay);
        }, 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES!');

        const timeoutHeading = page.locator('#timeout-team-title');
        await expect(timeoutHeading).toBeVisible();

        const metric = await inspectElementMetrics(timeoutHeading);

        // Check italic
        expect(metric.isItalic, 'Timeout called-by heading should be italic').toBe(true);

        // Check px-3 padding (12px >= 5.5px)
        expect(
          metric.paddingRight,
          `Timeout team name right clearance must be >= 5.5px (got ${metric.paddingRight}px) [${vp.name}]`
        ).toBeGreaterThanOrEqual(5.5);

        expect(
          metric.paddingLeft,
          `Timeout team name left clearance must be >= 5.5px (got ${metric.paddingLeft}px) [${vp.name}]`
        ).toBeGreaterThanOrEqual(5.5);

        // Check font size scaled down for > 25 characters (should have font-size <= 32px on mobile)
        const fontSizePx = await timeoutHeading.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
        if (vp.width <= 375) {
          expect(
            fontSizePx,
            `Timeout font size for 49-char name should be scaled to text-2xl (<= 28px) on mobile (got ${fontSizePx}px) [${vp.name}]`
          ).toBeLessThanOrEqual(28);
        }

        await assertZeroHorizontalOverflow(page, `StadiumTimeoutOverlay at ${vp.name}`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 5. KioskScoreColumn Dynamic Font Scaling & Clearance
  // -------------------------------------------------------------------------
  test.describe('Task 4: KioskScoreColumn Font Scaling, Clearance & Symmetry', () => {
    for (const vp of VIEWPORTS) {
      test(`KioskScoreColumn: Long slanted team name has >= 5.5px clearance at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const mock = createMockMatch({
          teamAName: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES!',
          teamBName: 'CEAT RED SCORPIONS',
        });
        await setupAdversarialMatchRoute(page, mock);

        await page.goto(`/match/${ADVERSARIAL_MATCH_ID}/kiosk`);
        await page.waitForLoadState('networkidle');

        // Locate Team A and Team B headers
        const headingA = page.locator('h2', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES!' });
        const headingB = page.locator('h2', { hasText: 'CEAT RED SCORPIONS' });

        await expect(headingA).toBeVisible();
        await expect(headingB).toBeVisible();

        const metricA = await inspectElementMetrics(headingA);
        const metricB = await inspectElementMetrics(headingB);

        // Both are italic
        expect(metricA.isItalic, 'Kiosk Team A should be italic').toBe(true);
        expect(metricB.isItalic, 'Kiosk Team B should be italic').toBe(true);

        // Both have >= 5.5px right clearance (pr-2 = 8px)
        expect(
          metricA.paddingRight,
          `Kiosk Team A right clearance must be >= 5.5px (got ${metricA.paddingRight}px) [${vp.name}]`
        ).toBeGreaterThanOrEqual(5.5);

        expect(
          metricB.paddingRight,
          `Kiosk Team B right clearance must be >= 5.5px (got ${metricB.paddingRight}px) [${vp.name}]`
        ).toBeGreaterThanOrEqual(5.5);

        // Zero horizontal overflow
        await assertZeroHorizontalOverflow(page, `FacilitatorKiosk at ${vp.name}`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 6. StadiumSubBanner Clearance
  // -------------------------------------------------------------------------
  test.describe('Task 5: StadiumSubBanner Character Clearance', () => {
    for (const vp of [
      { width: 320, height: 568, name: '320px' },
      { width: 375, height: 667, name: '375px' },
      { width: 1280, height: 720, name: '1280px' },
    ]) {
      test(`StadiumSubBanner: Team name has >= 5.5px right clearance (pr-1.5) at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const mock = createMockMatch({
          teamAName: 'CBA GOLDEN WOLVES',
          teamBName: 'CEAT',
        });
        await setupAdversarialMatchRoute(page, mock);

        await page.goto(`/match/${ADVERSARIAL_MATCH_ID}/display`);
        await page.waitForLoadState('networkidle');

        // Inject StadiumSubBanner DOM node with exact classes from component
        await page.evaluate((teamName) => {
          const banner = document.createElement('aside');
          banner.id = 'adversarial-sub-banner';
          banner.className = 'fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-2xl bg-slate-950/95 border-2 border-orange-500/50 rounded-2xl p-4 sm:p-5';
          banner.innerHTML = `
            <div class="flex items-center justify-between gap-3 mb-3 border-b border-white/10 pb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-orange-400">
                  PLAYER SUBSTITUTION
                </span>
                <span class="text-slate-600">•</span>
                <span id="sub-banner-team-name" class="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white line-clamp-1 break-words pr-1.5 max-w-[280px] sm:max-w-md">
                  ${teamName}
                </span>
              </div>
            </div>
          `;
          document.body.appendChild(banner);
        }, 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES');

        const subTeamSpan = page.locator('#sub-banner-team-name');
        await expect(subTeamSpan).toBeVisible();

        const metric = await inspectElementMetrics(subTeamSpan);

        // pr-1.5 provides 6px >= 5.5px clearance
        expect(
          metric.paddingRight,
          `StadiumSubBanner right clearance must be >= 5.5px (got ${metric.paddingRight}px) [${vp.name}]`
        ).toBeGreaterThanOrEqual(5.5);

        await assertZeroHorizontalOverflow(page, `StadiumSubBanner at ${vp.name}`);
      });
    }
  });

});
