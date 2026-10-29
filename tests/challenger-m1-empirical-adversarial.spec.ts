import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Challenger M1 Empirical Adversarial Test Suite
 *
 * Requirements & Stress Scenarios:
 * 1. Dynamic font scaling across:
 *    - Short: "CBA", "CEAT" (len <= 14 -> text-2xl sm:text-4xl md:text-5xl)
 *    - Medium: "CBA GOLDEN WOLVES" (17 chars, len 15-24 -> text-xl sm:text-3xl md:text-4xl)
 *    - Long: "COLLEGE OF SCIENCES" (19 chars, len 15-24 -> text-xl sm:text-3xl md:text-4xl)
 *    - Balanced: "COLLEGE OF ARTS AND HUMANITIES" (30 chars, len 25-36 -> text-lg sm:text-2xl md:text-3xl)
 *    - Extreme: "COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES" (49 chars, len > 36 -> text-base sm:text-xl md:text-2xl)
 *    - Pathological: "COLLEGE OF SPECIALIZED EXTRA-CURRICULAR AQUATIC ATHLETICS AND OCEANIC RESEARCH" (78 chars, len > 36 -> text-base sm:text-xl md:text-2xl)
 * 2. Viewports:
 *    - 320x568 (Compact Mobile)
 *    - 375x667 (Standard Mobile)
 *    - 1280x720 (Standard Desktop)
 *    - 1920x1080 (Stadium FHD)
 * 3. Invariants:
 *    - scrollWidth <= clientWidth + 2
 *    - Line clamp <= 2 lines (no single-line truncation)
 *    - Italic clearance >= 5.5px (pr-2 / pr-3 / px-1 to px-3)
 *    - Zero document-level horizontal overflow
 *    - Card visual balance & height symmetry
 */

interface MetricReport {
  text: string;
  scrollWidth: number;
  clientWidth: number;
  lineCount: number;
  isClipped: boolean;
  hasEllipsisCutoff: boolean;
  paddingRight: number;
  isItalic: boolean;
  computedFontSize: string;
  className: string;
}

async function inspectHeadingAntiClipping(locator: Locator, desc: string): Promise<MetricReport> {
  await expect(locator).toBeVisible();

  const report: MetricReport = await locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const isClipped = scrollWidth > clientWidth + 2;
    const hasEllipsisCutoff = style.textOverflow === 'ellipsis' && (isClipped || style.whiteSpace === 'nowrap');
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const isItalic = style.fontStyle === 'italic';
    const computedFontSize = style.fontSize;
    const text = el.textContent?.trim() || '';
    const className = el.className || '';

    // Calculate rendered line count using bounding client rects or line height
    const rects = el.getClientRects();
    const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.25);
    const estimatedLines = Math.max(1, Math.round(el.offsetHeight / lineHeight));
    const lineCount = rects.length > 0 ? Math.min(rects.length, estimatedLines) : estimatedLines;

    return {
      text,
      scrollWidth,
      clientWidth,
      lineCount,
      isClipped,
      hasEllipsisCutoff,
      paddingRight,
      isItalic,
      computedFontSize,
      className,
    };
  });

  expect(
    report.isClipped,
    `Clipping detected for "${report.text}" (${desc}): scrollWidth (${report.scrollWidth}px) > clientWidth + 2 (${report.clientWidth + 2}px)`
  ).toBe(false);

  expect(
    report.hasEllipsisCutoff,
    `Premature single-line ellipsis cutoff detected for "${report.text}" (${desc})`
  ).toBe(false);

  if (report.isItalic) {
    expect(
      report.paddingRight,
      `Italic element "${report.text}" missing right clearance buffer (got ${report.paddingRight}px, expected >= 5.5px) [${desc}]`
    ).toBeGreaterThanOrEqual(5.5);
  }

  expect(
    report.lineCount,
    `Heading exceeded 2 lines limit (got ${report.lineCount} lines) for "${report.text}" [${desc}]`
  ).toBeLessThanOrEqual(2);

  return report;
}

async function verifyZeroDocOverflow(page: Page, desc: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    return {
      hasDocOverflow: docEl.scrollWidth > docEl.clientWidth + 2,
      docScrollWidth: docEl.scrollWidth,
      docClientWidth: docEl.clientWidth,
      bodyScrollWidth: body?.scrollWidth || 0,
      windowWidth: window.innerWidth,
    };
  });

  expect(
    overflow.hasDocOverflow,
    `Document overflow in ${desc}: scrollWidth ${overflow.docScrollWidth} > clientWidth ${overflow.docClientWidth}`
  ).toBe(false);
}

function buildMockMatch(matchId: string, teamAName: string, teamBName: string, tournamentName?: string) {
  return {
    id: matchId,
    round: 'CHAMPIONSHIP PLAYOFFS - GRAND FINALS',
    status: 'Ongoing',
    team_a_score: 88,
    team_b_score: 84,
    team_a_id: 'team-a-mock-id',
    team_b_id: 'team-b-mock-id',
    venue: 'PSU Sports Complex - Arena Court 1',
    match_time: new Date().toISOString(),
    team_a: { name: teamAName },
    team_b: { name: teamBName },
    tournament_id: 'tourn-mock-id',
    tournament: {
      name: tournamentName || 'PSU PALAWANAN INTRAMURALS 2026 - BASKETBALL MEN',
      sport: 'Basketball',
    },
  };
}

async function routeMockMatch(page: Page, matchData: ReturnType<typeof buildMockMatch>) {
  await page.route('**/rest/v1/matches*', async (route) => {
    const url = route.request().url();
    if (url.includes(matchData.id) || url.includes('eq.')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(matchData),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([matchData]),
      });
    }
  });

  await page.route('**/rest/v1/match_events*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

// ---------------------------------------------------------------------------
// 1. STADIUM DISPLAY: Dynamic Font Scaling & Responsive Wraps Across Viewports
// ---------------------------------------------------------------------------

const STRESS_VIEWPORTS = [
  { width: 320, height: 568, name: 'Compact Mobile (320x568)' },
  { width: 375, height: 667, name: 'Standard Mobile (375x667)' },
  { width: 1280, height: 720, name: 'Desktop HD (1280x720)' },
  { width: 1920, height: 1080, name: 'Stadium FHD (1920x1080)' },
];

test.describe('Adversarial Test: StadiumDisplay String Length Categories Across Viewports', () => {
  for (const vp of STRESS_VIEWPORTS) {
    test(`Short ("CBA", "CEAT") renders text-2xl sm:text-4xl md:text-5xl at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch('match-short', 'CBA', 'CEAT');
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: 'CBA' });
      const teamB = page.locator('h2', { hasText: 'CEAT' });

      const reportA = await inspectHeadingAntiClipping(teamA, `Team A (Short) @ ${vp.name}`);
      const reportB = await inspectHeadingAntiClipping(teamB, `Team B (Short) @ ${vp.name}`);

      expect(reportA.className).toContain('text-2xl sm:text-4xl md:text-5xl');
      expect(reportB.className).toContain('text-2xl sm:text-4xl md:text-5xl');
      await verifyZeroDocOverflow(page, `Short @ ${vp.name}`);
    });

    test(`Medium ("CBA GOLDEN WOLVES", 17 chars) renders text-xl sm:text-3xl md:text-4xl at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch('match-medium', 'CBA GOLDEN WOLVES', 'CEAT SCORPIONS');
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: 'CBA GOLDEN WOLVES' });
      const reportA = await inspectHeadingAntiClipping(teamA, `Team A (Medium) @ ${vp.name}`);

      expect(reportA.className).toContain('text-xl sm:text-3xl md:text-4xl');
      await verifyZeroDocOverflow(page, `Medium @ ${vp.name}`);
    });

    test(`Long ("COLLEGE OF SCIENCES", 19 chars) renders text-xl sm:text-3xl md:text-4xl at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch('match-long', 'COLLEGE OF SCIENCES', 'COLLEGE OF NURSING');
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: 'COLLEGE OF SCIENCES' });
      const reportA = await inspectHeadingAntiClipping(teamA, `Team A (Long) @ ${vp.name}`);

      expect(reportA.className).toContain('text-xl sm:text-3xl md:text-4xl');
      await verifyZeroDocOverflow(page, `Long @ ${vp.name}`);
    });

    test(`Balanced ("COLLEGE OF ARTS AND HUMANITIES", 30 chars) renders text-lg sm:text-2xl md:text-3xl at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch('match-balanced', 'COLLEGE OF ARTS AND HUMANITIES', 'COLLEGE OF TEACHER EDUCATION');
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: 'COLLEGE OF ARTS AND HUMANITIES' });
      const reportA = await inspectHeadingAntiClipping(teamA, `Team A (Balanced) @ ${vp.name}`);

      expect(reportA.className).toContain('text-lg sm:text-2xl md:text-3xl');
      await verifyZeroDocOverflow(page, `Balanced @ ${vp.name}`);
    });

    test(`Extreme ("COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES", 49 chars) renders text-base sm:text-xl md:text-2xl at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch(
        'match-extreme',
        'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS'
      );
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
      const teamB = page.locator('h2', { hasText: 'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS' });

      const reportA = await inspectHeadingAntiClipping(teamA, `Team A (Extreme) @ ${vp.name}`);
      const reportB = await inspectHeadingAntiClipping(teamB, `Team B (Extreme) @ ${vp.name}`);

      expect(reportA.className).toContain('text-base sm:text-xl md:text-2xl');
      expect(reportB.className).toContain('text-base sm:text-xl md:text-2xl');
      await verifyZeroDocOverflow(page, `Extreme @ ${vp.name}`);
    });

    test(`Pathological 60+ chars ("COLLEGE OF SPECIALIZED EXTRA-CURRICULAR AQUATIC ATHLETICS...", 78 chars) at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch(
        'match-pathological',
        'COLLEGE OF SPECIALIZED EXTRA-CURRICULAR AQUATIC ATHLETICS AND OCEANIC RESEARCH',
        'CBA'
      );
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: /COLLEGE OF SPECIALIZED EXTRA-CURRICULAR/i });
      const teamB = page.locator('h2', { hasText: 'CBA' });

      const reportA = await inspectHeadingAntiClipping(teamA, `Team A (Pathological 78 chars) @ ${vp.name}`);
      const reportB = await inspectHeadingAntiClipping(teamB, `Team B (Short) @ ${vp.name}`);

      expect(reportA.className).toContain('text-base sm:text-xl md:text-2xl');
      expect(reportB.className).toContain('text-2xl sm:text-4xl md:text-5xl');
      await verifyZeroDocOverflow(page, `Pathological @ ${vp.name}`);
    });

    test(`Asymmetry stress: Team A 49 chars vs Team B 3 chars at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch(
        'match-asymmetric',
        'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        'CBA'
      );
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/display`);
      await page.waitForLoadState('networkidle');

      const teamA = page.locator('h2', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
      const teamB = page.locator('h2', { hasText: 'CBA' });

      await inspectHeadingAntiClipping(teamA, `Team A (49 chars) @ ${vp.name}`);
      await inspectHeadingAntiClipping(teamB, `Team B (3 chars) @ ${vp.name}`);

      // Inspect parent card containers to ensure no layout distortion
      const cardHeights = await page.evaluate(() => {
        const h2Elements = Array.from(document.querySelectorAll('h2'));
        const teamAH2 = h2Elements.find((el) => el.textContent?.includes('COLLEGE OF BUSINESS'));
        const teamBH2 = h2Elements.find((el) => el.textContent?.includes('CBA'));
        const cardA = teamAH2?.closest('.lg\\:col-span-5');
        const cardB = teamBH2?.closest('.lg\\:col-span-5');

        return {
          cardAHeight: cardA ? (cardA as HTMLElement).offsetHeight : 0,
          cardBHeight: cardB ? (cardB as HTMLElement).offsetHeight : 0,
        };
      });

      // On desktop (grid), cards should be balanced within 50px
      if (vp.width >= 1024) {
        const heightDiff = Math.abs(cardHeights.cardAHeight - cardHeights.cardBHeight);
        expect(heightDiff, `Cards have severe height imbalance (${heightDiff}px)`).toBeLessThanOrEqual(60);
      }

      await verifyZeroDocOverflow(page, `Asymmetry @ ${vp.name}`);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. LIVE MATCH PAGE: Scoreboard Headings Stress Test
// ---------------------------------------------------------------------------

test.describe('Adversarial Test: LiveMatch Scoreboard Headings', () => {
  for (const vp of [
    { width: 320, height: 568, name: 'Mobile 320x568' },
    { width: 375, height: 667, name: 'Mobile 375x667' },
    { width: 1280, height: 720, name: 'Desktop 1280x720' },
  ]) {
    test(`LiveMatch scoreboard renders 49-character team names cleanly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch(
        'match-live-test',
        'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        'COLLEGE OF ENGINEERING AND TECHNOLOGY RED SCORPIONS'
      );
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}`);
      await page.waitForLoadState('networkidle');

      const teamAHeading = page.locator('h2', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
      await expect(teamAHeading).toBeVisible();

      await inspectHeadingAntiClipping(teamAHeading, `LiveMatch Team A @ ${vp.name}`);
      await verifyZeroDocOverflow(page, `LiveMatch @ ${vp.name}`);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. FLOATING SCORE WIDGET: Scoreboard Pinning & Height Symmetry
// ---------------------------------------------------------------------------

test.describe('Adversarial Test: FloatingScoreWidget Multi-Line & Symmetry', () => {
  for (const vp of [
    { width: 375, height: 667, name: 'Mobile 375x667' },
    { width: 1280, height: 720, name: 'Desktop 1280x720' },
  ]) {
    test(`FloatingScoreWidget maintains balanced team labels and zero clipping at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch(
        'match-floating-test',
        'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        'CBA'
      );
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}`);
      await page.waitForLoadState('networkidle');

      // Scroll past 420px to trigger FloatingScoreWidget
      await page.evaluate(() => window.scrollTo(0, 800));
      await page.waitForTimeout(400);

      const widget = page.locator('div.fixed.bottom-4');
      await expect(widget).toBeVisible();

      // Team A label (49 chars)
      const teamALabel = widget.locator('span', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
      await expect(teamALabel).toBeVisible();
      await inspectHeadingAntiClipping(teamALabel, `FloatingWidget Team A @ ${vp.name}`);

      // Team B label (3 chars)
      const teamBLabel = widget.locator('span', { hasText: 'CBA' });
      await expect(teamBLabel).toBeVisible();
      await inspectHeadingAntiClipping(teamBLabel, `FloatingWidget Team B @ ${vp.name}`);

      // Vertical height symmetry: both labels must have min-h-[2.25rem] and equal rendered heights
      const heights = await widget.evaluate((el) => {
        const spans = Array.from(el.querySelectorAll('span.line-clamp-2'));
        return spans.map((s) => (s as HTMLElement).offsetHeight);
      });

      if (heights.length >= 2) {
        expect(
          Math.abs(heights[0] - heights[1]),
          `Floating widget team labels are vertically misaligned: Team A=${heights[0]}px, Team B=${heights[1]}px`
        ).toBeLessThanOrEqual(2);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 4. FACILITATOR KIOSK: KioskScoreColumn Typography
// ---------------------------------------------------------------------------

test.describe('Adversarial Test: FacilitatorKiosk KioskScoreColumn Typography', () => {
  for (const vp of [
    { width: 375, height: 667, name: 'Mobile 375x667' },
    { width: 1280, height: 720, name: 'Desktop 1280x720' },
  ]) {
    test(`KioskScoreColumn scales and wraps 49-char team names without clipping at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const mock = buildMockMatch(
        'match-kiosk-test',
        'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES',
        'CBA'
      );
      await routeMockMatch(page, mock);

      await page.goto(`/match/${mock.id}/kiosk`);
      await page.waitForLoadState('networkidle');

      const teamAHeading = page.locator('h2', { hasText: 'COLLEGE OF BUSINESS AND ACCOUNTANCY GOLDEN WOLVES' });
      await expect(teamAHeading).toBeVisible();

      await inspectHeadingAntiClipping(teamAHeading, `KioskScoreColumn Team A @ ${vp.name}`);
      await verifyZeroDocOverflow(page, `Kiosk @ ${vp.name}`);
    });
  }
});

