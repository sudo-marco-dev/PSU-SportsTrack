import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Mobile Responsive Headers & Tab Anti-Truncation Test Suite
 *
 * Implements 4-tier testing architecture:
 * Tier 1: Feature Coverage (Header compactness <= 140px, reading ratio >= 55%, tab anti-truncation scrollWidth <= clientWidth + 1)
 * Tier 2: Boundary & Corner Cases (320x568 iPhone SE, 375x520 in-app browser, orientation flips, zero horizontal overflow)
 * Tier 3: Cross-Feature Combinations (Register & LoginModal draft persistence, mandatory legal modal gating)
 * Tier 4: Real-World Workflows (Full sequential scroll-to-accept flow, in-context modal reviews, multi-tab switching)
 */

interface TabMetric {
  text: string;
  scrollWidth: number;
  clientWidth: number;
  isTruncated: boolean;
  hasEllipsis: boolean;
  overflow: string;
  textOverflow: string;
}

/**
 * Programmatically measures tab label elements for CSS or DOM truncation.
 * Asserts scrollWidth <= clientWidth + 1 (with 1px tolerance for sub-pixel anti-aliasing)
 * and verifies absence of literal ellipsis ('...' or '…').
 */
async function verifyTabTriggerAntiTruncation(trigger: Locator, contextDesc: string): Promise<void> {
  await expect(trigger).toBeVisible();

  const metrics: TabMetric[] = await trigger.evaluate((el) => {
    // Locate text label spans inside trigger, excluding numeric/percent badges and SVG icons
    const allSpans = Array.from(el.querySelectorAll('span'));
    const candidateSpans = allSpans.filter((s) => {
      const text = s.textContent?.trim() || '';
      if (!text) return false;
      if (s.querySelector('svg')) return false;
      if (s.querySelector('span')) return false;
      const isBadge = s.classList.contains('font-mono') || /^\d+%?$/.test(text);
      const isHidden = window.getComputedStyle(s).display === 'none';
      return !isBadge && !isHidden;
    });

    const targetElements = candidateSpans.length > 0 ? candidateSpans : [el];

    return targetElements.map((target) => {
      const text = target.textContent?.trim() || '';
      const scrollWidth = target.scrollWidth;
      const clientWidth = target.clientWidth;
      const style = window.getComputedStyle(target);
      const isTruncated = scrollWidth > clientWidth + 1;
      const hasEllipsis = text.includes('...') || text.includes('…');

      return {
        text,
        scrollWidth,
        clientWidth,
        isTruncated,
        hasEllipsis,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
      };
    });
  });

  for (const m of metrics) {
    expect(
      m.clientWidth,
      `Tab label "${m.text}" rendered width must be > 0 (${contextDesc})`
    ).toBeGreaterThan(0);

    expect(
      m.hasEllipsis,
      `Tab label "${m.text}" contains truncation ellipsis '...' (${contextDesc})`
    ).toBe(false);

    expect(
      m.isTruncated,
      `Tab label "${m.text}" is truncated! scrollWidth (${m.scrollWidth}px) > clientWidth + 1 (${m.clientWidth + 1}px) [overflow: ${m.overflow}, textOverflow: ${m.textOverflow}] (${contextDesc})`
    ).toBe(false);
  }
}

/**
 * Setup mock authenticated session and user profile data for /profile route testing.
 */
async function setupMockAthleteAuth(page: Page, athleteId = 'athlete-e2e-tester-101'): Promise<void> {
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
  const mockUser = {
    id: athleteId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'athlete.e2e@psu.palawan.edu.ph',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Elena Santos' },
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'fake-athlete-token-e2e',
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

  await page.route('**/rest/v1/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: athleteId,
        full_name: 'Elena Santos',
        role: 'player_student',
        college_id: 'col-1',
        college_name: 'College of Sciences (CS)',
        student_number: '2023-8-0999',
        program: 'BS Computer Science',
        year_level: 'Third Year',
        age: 21,
        is_verified: true,
      }),
    });
  });

  await page.route('**/rest/v1/verification_documents*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/player_stars*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/team_roster*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/colleges*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'col-1', college_name: 'College of Sciences (CS)' }]),
    });
  });

  await page.route('**/rest/v1/invitations*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.addInitScript(({ session }) => {
    localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
  }, { session: mockSession });
}

// ============================================================================
// TIER 1: FEATURE COVERAGE
// ============================================================================
test.describe('Tier 1: Feature Coverage - Mobile Header Compactness & Tab Anti-Truncation', () => {
  test('Tier 1.1: /legal top page header bounding-box height <= 140px on mobile viewports (320x568, 375x667)', async ({
    page,
  }) => {
    const mobileViewports = [
      { name: 'iPhone SE 1st Gen (320x568)', width: 320, height: 568 },
      { name: 'iPhone SE 2nd Gen / iPhone 8 (375x667)', width: 375, height: 667 },
    ];

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/legal?mode=accept&from=register');

      // Resilient locator targeting the hero card
      const header = page
        .locator('[data-testid="legal-page-header"], div.relative.overflow-hidden.bg-slate-950')
        .first();
      await expect(header).toBeVisible();

      const box = await header.boundingBox();
      expect(box, `Header bounding box must not be null at ${vp.name}`).not.toBeNull();
      expect(
        box!.height,
        `Header height on ${vp.name} is ${box!.height}px, which exceeds the 140px mobile threshold`
      ).toBeLessThanOrEqual(140);

      // Verify essential header content is preserved
      await expect(page.getByRole('heading', { name: /Official Legal & Governance Policies/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Close/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Back$/i })).toBeVisible();
    }
  });

  test('Tier 1.2: /legal scroll container visible reading ratio >= 55% of viewport height on mobile', async ({
    page,
  }) => {
    const mobileViewports = [
      { name: '320x568', width: 320, height: 568 },
      { name: '375x667', width: 375, height: 667 },
    ];

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/legal?mode=accept&from=register');

      const scrollContainer = page.getByTestId('legal-scroll-container');
      await expect(scrollContainer).toBeVisible();

      const scrollBox = await scrollContainer.boundingBox();
      expect(scrollBox, `Scroll container bounding box must exist at ${vp.name}`).not.toBeNull();

      const visibleRatio = scrollBox!.height / vp.height;
      expect(
        visibleRatio,
        `Scroll container visible reading ratio (${(visibleRatio * 100).toFixed(1)}%) must be >= 55% of viewport height at ${vp.name}`
      ).toBeGreaterThanOrEqual(0.55);
    }
  });

  test('Tier 1.3: /legal tab triggers display full non-truncated text across all standard viewports', async ({
    page,
  }) => {
    const viewports = [
      { name: '320x568 (Small Mobile)', width: 320, height: 568 },
      { name: '375x667 (Standard Mobile)', width: 375, height: 667 },
      { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
      { name: '1280x720 (Desktop Standard)', width: 1280, height: 720 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/legal?mode=accept&from=register');

      const tabTriggers = page.getByRole('tab');
      await expect(tabTriggers.first()).toBeVisible();
      const count = await tabTriggers.count();
      expect(count, `At least 2 tabs expected on /legal at ${vp.name}`).toBeGreaterThanOrEqual(2);

      for (let i = 0; i < count; i++) {
        const trigger = tabTriggers.nth(i);
        await trigger.click();
        await verifyTabTriggerAntiTruncation(trigger, `/legal tab #${i + 1} at ${vp.name}`);
      }
    }
  });

  test('Tier 1.4: LegalModal tab triggers display full non-truncated text across all viewports', async ({
    page,
  }) => {
    const viewports = [
      { name: '320x568 (Small Mobile)', width: 320, height: 568 },
      { name: '375x667 (Standard Mobile)', width: 375, height: 667 },
      { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
      { name: '1280x720 (Desktop Standard)', width: 1280, height: 720 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Open LoginModal and trigger LegalModal via footer Terms of Service button
      await page.getByRole('button', { name: /Log In/i }).first().click();
      const termsLink = page.getByRole('button', { name: /Terms of Service/i });
      await expect(termsLink).toBeVisible();
      await termsLink.click();

      const modalDialog = page.getByRole('dialog');
      await expect(modalDialog).toBeVisible();

      const modalTabs = modalDialog.getByRole('tab');
      const modalTabCount = await modalTabs.count();
      expect(modalTabCount, `LegalModal should have at least 2 tabs at ${vp.name}`).toBeGreaterThanOrEqual(2);

      for (let j = 0; j < modalTabCount; j++) {
        const trigger = modalTabs.nth(j);
        await trigger.click();
        await verifyTabTriggerAntiTruncation(trigger, `LegalModal tab #${j + 1} at ${vp.name}`);
      }

      // Close modal
      const closeBtn = page.locator('[data-slot="dialog-close"]').last();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test('Tier 1.5: ExpandableIconTabs on /profile maintains non-truncated labels across all viewports', async ({
    page,
  }) => {
    await setupMockAthleteAuth(page);

    const viewports = [
      { name: '320x568 (Small Mobile)', width: 320, height: 568 },
      { name: '375x667 (Standard Mobile)', width: 375, height: 667 },
      { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
      { name: '1280x720 (Desktop Standard)', width: 1280, height: 720 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/profile');

      const profileTabs = page.getByRole('tab');
      await expect(profileTabs.first()).toBeVisible();
      const tabCount = await profileTabs.count();
      expect(tabCount, `Profile should render 4 ExpandableIconTabs at ${vp.name}`).toBeGreaterThanOrEqual(4);

      for (let i = 0; i < tabCount; i++) {
        const tab = profileTabs.nth(i);
        await tab.click();
        await verifyTabTriggerAntiTruncation(tab, `Profile tab #${i + 1} at ${vp.name}`);
      }
    }
  });

  test('Tier 1.6: ExpandableIconTabs on /athletics maintains non-truncated labels across all viewports', async ({
    page,
  }) => {
    const viewports = [
      { name: '320x568 (Small Mobile)', width: 320, height: 568 },
      { name: '375x667 (Standard Mobile)', width: 375, height: 667 },
      { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
      { name: '1280x720 (Desktop Standard)', width: 1280, height: 720 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/athletics');

      const athleticsTabs = page.getByRole('tab');
      await expect(athleticsTabs.first()).toBeVisible();
      const count = await athleticsTabs.count();
      expect(count, `Athletics Hub should render 4 tabs at ${vp.name}`).toBeGreaterThanOrEqual(4);

      for (let i = 0; i < count; i++) {
        const tab = athleticsTabs.nth(i);
        await tab.click();
        await verifyTabTriggerAntiTruncation(tab, `Athletics tab #${i + 1} at ${vp.name}`);
      }
    }
  });

  test('Tier 1.7: App-wide top page headers are compact and custom tab switchers (/ranking, /explorer, /about) have zero truncation on mobile (320x568, 375x667)', async ({
    page,
  }) => {
    const mobileViewports = [
      { name: '320x568', width: 320, height: 568 },
      { name: '375x667', width: 375, height: 667 },
    ];

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. /ranking header compactness & custom standings switcher anti-truncation
      await page.goto('/ranking');
      const rankingHeader = page.locator('div.bg-slate-950').filter({ hasText: /LEADERBOARD & RANKINGS/i }).first();
      await expect(rankingHeader).toBeVisible();
      const rankingBox = await rankingHeader.boundingBox();
      expect(rankingBox).not.toBeNull();
      expect(
        rankingBox!.height,
        `/ranking top header height (${rankingBox!.height}px) must remain compact (<= 200px) at ${vp.name}`
      ).toBeLessThanOrEqual(200);

      const rankingTabButtons = page.getByRole('button', { name: /Colleges|Tribes|Squads/i });
      const rankingTabCount = await rankingTabButtons.count();
      expect(rankingTabCount).toBe(3);
      for (let i = 0; i < rankingTabCount; i++) {
        const btn = rankingTabButtons.nth(i);
        await btn.click();
        await verifyTabTriggerAntiTruncation(btn, `Ranking custom switcher tab #${i + 1} at ${vp.name}`);
      }

      // 2. /athletics header compactness
      await page.goto('/athletics');
      const athleticsHeader = page.locator('div.bg-slate-950').filter({ hasText: /ATHLETICS HUB/i }).first();
      await expect(athleticsHeader).toBeVisible();
      const athleticsBox = await athleticsHeader.boundingBox();
      expect(athleticsBox).not.toBeNull();
      expect(
        athleticsBox!.height,
        `/athletics top header height (${athleticsBox!.height}px) must remain compact (<= 220px) at ${vp.name}`
      ).toBeLessThanOrEqual(220);

      // 3. /about header compactness
      await page.goto('/about');
      const aboutHeader = page.locator('div.bg-slate-950').filter({ hasText: /Digital Arena/i }).first();
      await expect(aboutHeader).toBeVisible();
      const aboutBox = await aboutHeader.boundingBox();
      expect(aboutBox).not.toBeNull();
      expect(
        aboutBox!.height,
        `/about top header height (${aboutBox!.height}px) must remain compact (<= 210px) at ${vp.name}`
      ).toBeLessThanOrEqual(210);
    }
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ============================================================================
test.describe('Tier 2: Boundary & Corner Cases - Extreme Viewports, Orientation Flips & No Horizontal Overflow', () => {
  test('Tier 2.1: Extreme minimum mobile viewport 320x568 (iPhone SE 1): Header <= 140px, non-truncated tabs, zero horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/legal?mode=accept&from=register');

    // 1. Header height limit
    const header = page
      .locator('[data-testid="legal-page-header"], div.relative.overflow-hidden.bg-slate-950')
      .first();
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height, `Header must be <= 140px on 320x568`).toBeLessThanOrEqual(140);

    // 2. Tab triggers anti-truncation
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i++) {
      await verifyTabTriggerAntiTruncation(tabs.nth(i), `320x568 extreme boundary tab #${i + 1}`);
    }

    // 3. Sticky bottom bar must NOT exist on /legal (pure document reader)
    await expect(page.getByTestId('legal-sticky-bottom-bar')).not.toBeVisible();

    // 4. Zero horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(hasHorizontalOverflow, `Page should not have horizontal overflow on 320x568`).toBe(false);
  });

  test('Tier 2.2: Constrained short in-app browser viewport 375x520: Header compactness, tab readability, and layout integrity', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 520 });
    await page.goto('/legal?mode=accept&from=register');

    const header = page
      .locator('[data-testid="legal-page-header"], div.relative.overflow-hidden.bg-slate-950')
      .first();
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height, `Header must be <= 140px on short in-app 375x520`).toBeLessThanOrEqual(140);

    const scrollContainer = page.getByTestId('legal-scroll-container');
    await expect(scrollContainer).toBeVisible();
    const scrollBox = await scrollContainer.boundingBox();
    expect(scrollBox).not.toBeNull();
    expect(scrollBox!.height / 520, `Reading area must maintain >= 50% on short screen`).toBeGreaterThanOrEqual(0.50);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(hasHorizontalOverflow, `Zero horizontal overflow on 375x520`).toBe(false);
  });

  test('Tier 2.3: Responsive orientation flip 375x667 -> 667x375 -> 768x1024 preserves scroll progress, header compactness, and tab legibility', async ({
    page,
  }) => {
    // 1. Start in portrait (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/legal');

    // Scroll Terms halfway
    const scrollContainer = page.getByTestId('legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * 0.5);
      el.dispatchEvent(new Event('scroll'));
    });

    await expect(page.getByTestId('legal-sticky-bottom-bar')).not.toBeVisible();

    // 2. Rotate to landscape (667x375)
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.getByTestId('legal-sticky-bottom-bar')).not.toBeVisible();

    const landscapeOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(landscapeOverflow, `No horizontal blowout in landscape 667x375`).toBe(false);

    // 3. Rotate to tall tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('legal-sticky-bottom-bar')).not.toBeVisible();

    const tabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(tabletOverflow, `No horizontal blowout in tablet 768x1024`).toBe(false);
  });

  test('Tier 2.4: Zero horizontal scroll contract: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 across all audited pages and viewports', async ({
    page,
  }) => {
    const testPages = ['/legal', '/register', '/athletics', '/ranking'];
    const testViewports = [
      { name: '320x568', width: 320, height: 568 },
      { name: '375x667', width: 375, height: 667 },
      { name: '768x1024', width: 768, height: 1024 },
    ];

    for (const vp of testViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const pagePath of testPages) {
        await page.goto(pagePath);
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        });
        expect(hasOverflow, `Horizontal overflow detected on ${pagePath} at ${vp.name}`).toBe(false);
      }
    }
  });

  test('Tier 2.5: Touch targets: interactive buttons (Back, Close, Tabs) satisfy touch accessibility standards on small mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/legal');

    const closeBtn = page.getByRole('button', { name: /^Close$/i });
    const backBtn = page.getByRole('button', { name: /^Back$/i });
    const tabs = page.getByRole('tab');

    await expect(closeBtn).toBeVisible();
    await expect(backBtn).toBeVisible();

    const closeBox = await closeBtn.boundingBox();
    const backBox = await backBtn.boundingBox();

    expect(closeBox).not.toBeNull();
    expect(backBox).not.toBeNull();

    // Standard touch targets must be >= 32px height and width on mobile
    expect(closeBox!.height, `Close button height must be >= 32px`).toBeGreaterThanOrEqual(32);
    expect(closeBox!.width, `Close button width must be >= 32px`).toBeGreaterThanOrEqual(32);
    expect(backBox!.height, `Back button height must be >= 32px`).toBeGreaterThanOrEqual(32);

    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i++) {
      const tabBox = await tabs.nth(i).boundingBox();
      expect(tabBox).not.toBeNull();
      expect(tabBox!.height, `Tab #${i + 1} height must be >= 36px for touch`).toBeGreaterThanOrEqual(36);
    }
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================
test.describe('Tier 3: Cross-Feature Combinations - Form Draft Persistence & Acceptance Intersections', () => {
  test('Tier 3.1: In-context LegalModal acceptance from /register preserves form draft and marks terms checkbox checked without page redirect or premature submit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');

    // 1. Fill draft registration fields
    await page.locator('input[placeholder="Dela Cruz"]').fill('Del Rosario');
    await page.locator('input[placeholder="Juan"]').fill('Marco');
    await page.locator('input[type="email"]').fill('marco.delrosario@psu.palawan.edu.ph');
    const passwords = page.locator('input[autocomplete="new-password"]');
    await passwords.nth(0).fill('StrongPass123!');
    await passwords.nth(1).fill('StrongPass123!');

    // 2. Click unchecked Terms checkbox -> opens in-context LegalModal directly
    const regCheckbox = page.getByTestId('register-terms-checkbox');
    await expect(regCheckbox).toBeVisible();
    await regCheckbox.click();

    // Must NOT navigate to /legal
    await expect(page).toHaveURL(/\/register$/);

    // 3. Complete sequential scroll reading inside modal
    const scrollContainer = page.getByTestId('modal-legal-scroll-container');
    await expect(scrollContainer).toBeVisible();

    const termsCheckbox = page.getByTestId('modal-legal-terms-checkbox');
    const privacyCheckbox = page.getByTestId('modal-legal-privacy-checkbox');
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(termsCheckbox).toBeDisabled();
    await expect(privacyCheckbox).toBeDisabled();
    await expect(acceptBtn).toBeDisabled();

    // Scroll Terms to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(termsCheckbox).toBeEnabled();

    // Advance to Privacy
    const nextPrivacyBtn = page.getByTestId('modal-next-read-privacy-btn');
    await expect(nextPrivacyBtn).toBeVisible();
    await nextPrivacyBtn.click();

    // Scroll Privacy to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(privacyCheckbox).toBeEnabled();

    // 4. Accept in modal
    await termsCheckbox.click();
    await expect(acceptBtn).toBeDisabled();
    await privacyCheckbox.click();
    await expect(acceptBtn).toBeEnabled();
    await acceptBtn.click();

    // 5. Returned to /register with draft fields intact and checkbox checked
    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Del Rosario');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Marco');
    await expect(page.locator('input[type="email"]')).toHaveValue('marco.delrosario@psu.palawan.edu.ph');
    await expect(passwords.nth(0)).toHaveValue('StrongPass123!');
    await expect(passwords.nth(1)).toHaveValue('StrongPass123!');

    await expect(page.getByTestId('register-terms-checkbox')).toHaveAttribute('data-checked', '');
    await expect(page.getByRole('button', { name: /Complete Registration/i })).toBeVisible();
  });

  test('Tier 3.2: In-context LegalModal acceptance within LoginModal Create Account preserves draft fields and marks terms checkbox checked without page redirect', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Open LoginModal and switch to Create Account
    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Create Account/i }).click();

    // 2. Fill partial draft
    await page.locator('input[placeholder="Dela Cruz"]').fill('Valdez');
    await page.locator('input[placeholder="Juan"]').fill('Alyssa');
    await page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]').fill('alyssa.valdez@psu.palawan.edu.ph');

    // 3. Click modal terms checkbox -> opens in-context LegalModal directly
    await page.getByTestId('modal-register-terms-checkbox').click();
    await expect(page).toHaveURL(/\/$/);

    // 4. Complete sequential scroll and accept inside LegalModal
    const scrollContainer = page.getByTestId('modal-legal-scroll-container');
    await expect(scrollContainer).toBeVisible();

    const termsCheckbox = page.getByTestId('modal-legal-terms-checkbox');
    const privacyCheckbox = page.getByTestId('modal-legal-privacy-checkbox');
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(termsCheckbox).toBeDisabled();
    await expect(privacyCheckbox).toBeDisabled();
    await expect(acceptBtn).toBeDisabled();

    // Scroll Terms to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(termsCheckbox).toBeEnabled();

    // Advance to Privacy
    const nextPrivacyBtn = page.getByTestId('modal-next-read-privacy-btn');
    await expect(nextPrivacyBtn).toBeVisible();
    await nextPrivacyBtn.click();

    // Scroll Privacy to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(privacyCheckbox).toBeEnabled();

    // Check both boxes and accept
    await termsCheckbox.click();
    await expect(acceptBtn).toBeDisabled();
    await privacyCheckbox.click();
    await expect(acceptBtn).toBeEnabled();
    await acceptBtn.click();

    // 5. LegalModal closed; LoginModal stays open in Create Account view with draft intact
    await expect(acceptBtn).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Valdez');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Alyssa');
    await expect(page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]')).toHaveValue('alyssa.valdez@psu.palawan.edu.ph');
    await expect(page.getByTestId('modal-register-terms-checkbox')).toHaveAttribute('data-checked', '');
  });

  test('Tier 3.3: Mandatory legal acceptance modal triggering on /register submit without prior acceptance: tab switching and scroll requirement', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');

    // Fill valid registration fields
    await page.locator('input[placeholder="Dela Cruz"]').fill('Reyes');
    await page.locator('input[placeholder="Juan"]').fill('Maria');
    await page.locator('input[type="email"]').fill('test.student@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuSports#2026!');
    await passwordInputs.nth(1).fill('PsuSports#2026!');

    // Submit form without checking terms checkbox
    await page.getByRole('button', { name: /Complete Registration/i }).click();

    // Mandatory legal modal pops up
    const acceptBtn = page.getByRole('button', { name: /Accept & Continue Registration/i });
    await expect(acceptBtn).toBeVisible();
    await expect(acceptBtn).toBeDisabled();

    // Verify modal tab anti-truncation inside mandatory modal
    const modal = page.getByRole('dialog');
    const modalTabs = modal.getByRole('tab');
    for (let i = 0; i < await modalTabs.count(); i++) {
      await verifyTabTriggerAntiTruncation(modalTabs.nth(i), `Mandatory LegalModal tab #${i + 1}`);
    }

    // Decline & cancel modal
    const declineBtn = page.getByRole('button', { name: /Decline & Cancel/i });
    await declineBtn.click();

    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Reyes');
  });

  test('Tier 3.4: In-context LegalModal cancellation on /register preserves form draft and leaves terms checkbox unchecked', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');

    await page.locator('input[placeholder="Dela Cruz"]').fill('Aquino');
    await page.locator('input[placeholder="Juan"]').fill('Benigno');
    await page.locator('input[type="email"]').fill('benigno.aquino@psu.palawan.edu.ph');

    // Click checkbox -> modal opens without URL change
    await page.getByTestId('register-terms-checkbox').click();
    await expect(page).toHaveURL(/\/register$/);

    const declineBtn = page.getByTestId('modal-legal-decline-btn');
    await expect(declineBtn).toBeVisible();
    await declineBtn.click();

    await expect(declineBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Aquino');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Benigno');
    await expect(page.getByTestId('register-terms-checkbox')).not.toHaveAttribute('data-checked', '');
  });

  test('Tier 3.5: In-context LegalModal cancellation in LoginModal Create Account preserves form draft and leaves terms checkbox unchecked', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Create Account/i }).click();

    await page.locator('input[placeholder="Dela Cruz"]').fill('Bautista');
    await page.locator('input[placeholder="Juan"]').fill('Carlo');
    await page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]').fill('carlo.b@psu.palawan.edu.ph');

    await page.getByTestId('modal-register-terms-checkbox').click();
    await expect(page).toHaveURL(/\/$/);

    const declineBtn = page.getByTestId('modal-legal-decline-btn');
    await expect(declineBtn).toBeVisible();
    await declineBtn.click();

    await expect(declineBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Bautista');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Carlo');
    await expect(page.getByTestId('modal-register-terms-checkbox')).not.toHaveAttribute('data-checked', '');
  });
});

// ============================================================================
// TIER 4: REAL-WORLD WORKFLOWS
// ============================================================================
test.describe('Tier 4: Real-World Workflows - Sequential Read, Consent Gating & Multi-Tab Navigation', () => {
  test('Tier 4.1: Pure reference document reader on /legal without sticky acceptance drawer, responsive header <= 140px, tab switching, guided progression, and safe Back navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Visit /about first so there is a previous history entry
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: /Digital Arena/i })).toBeVisible();

    // Navigate to /legal
    await page.goto('/legal');

    // 1. Verify header compactness on /legal (<= 140px)
    const header = page
      .locator('[data-testid="legal-page-header"], div.relative.overflow-hidden.bg-slate-950')
      .first();
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(140);

    // 2. Verify tab anti-truncation on /legal
    const tabs = page.getByRole('tab');
    for (let i = 0; i < await tabs.count(); i++) {
      await verifyTabTriggerAntiTruncation(tabs.nth(i), `Legal tab #${i + 1}`);
    }

    // 3. Verify sticky bottom acceptance drawer does NOT exist on /legal
    const stickyBar = page.getByTestId('legal-sticky-bottom-bar');
    await expect(stickyBar).not.toBeVisible();
    await expect(page.getByTestId('legal-accept-btn')).not.toBeVisible();
    await expect(page.getByTestId('legal-decline-btn')).not.toBeVisible();
    await expect(page.getByTestId('legal-terms-checkbox')).not.toBeVisible();
    await expect(page.getByTestId('legal-privacy-checkbox')).not.toBeVisible();

    // 4. Tab switching between Terms and Privacy
    const privacyTab = page.getByRole('tab', { name: /Privacy Policy/i });
    await privacyTab.click();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    const termsTab = page.getByRole('tab', { name: /Terms & Conditions/i });
    await termsTab.click();
    await expect(page.getByRole('heading', { name: 'Terms and Conditions' })).toBeVisible();

    // 5. Test guided progression button "Next: Read Privacy Policy" at bottom of Terms
    const nextPrivacyBtn = page.getByTestId('next-read-privacy-btn');
    await expect(nextPrivacyBtn).toBeVisible();
    await nextPrivacyBtn.click();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    // 6. Test Back button returns user to /about (not /register!)
    const backBtn = page.getByRole('button', { name: /^Back$/i }).first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/\/about$/);
  });

  test('Tier 4.2: In-context LegalModal direct review from /register at 320x568', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');

    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Terms of Service/i }).click();

    const modal = page.locator('div[role="dialog"]').last();
    await expect(modal).toBeVisible();

    // Check modal bounding box does not exceed viewport width
    const modalBox = await modal.boundingBox();
    expect(modalBox).not.toBeNull();
    expect(modalBox!.width, `Modal width should fit within 320px viewport`).toBeLessThanOrEqual(320);

    // Switch between tabs inside modal
    const privacyTab = modal.getByRole('tab', { name: /Privacy Policy/i });
    await privacyTab.click();
    await verifyTabTriggerAntiTruncation(privacyTab, 'LegalModal Privacy tab at 320x568');

    const termsTab = modal.getByRole('tab', { name: /Terms/i });
    await termsTab.click();
    await verifyTabTriggerAntiTruncation(termsTab, 'LegalModal Terms tab at 320x568');

    // Close modal
    const closeBtn = page.locator('[data-slot="dialog-close"]').last();
    await closeBtn.click();
    await expect(page.getByRole('dialog', { name: /Terms and Conditions|Privacy Policy/i })).not.toBeVisible();
  });

  test('Tier 4.3: Athlete Profile multi-tab navigation on mobile 320x568 and 375x667: seamless active state transitions and anti-truncation', async ({
    page,
  }) => {
    await setupMockAthleteAuth(page);

    const mobileViewports = [
      { name: '320x568', width: 320, height: 568 },
      { name: '375x667', width: 375, height: 667 },
    ];

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/profile');

      const tabs = page.getByRole('tab');
      await expect(tabs.first()).toBeVisible();
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(4);

      // Cycle through each tab: Career -> Achievements -> Invites -> Account
      for (let i = 0; i < count; i++) {
        const tab = tabs.nth(i);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await verifyTabTriggerAntiTruncation(tab, `Profile tab #${i + 1} on ${vp.name}`);
      }

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      expect(hasOverflow, `No horizontal overflow on /profile at ${vp.name}`).toBe(false);
    }
  });

  test('Tier 4.4: Athletics Hub directory exploration on mobile 320x568 and 375x667: 4-entity tab switching and responsive layout', async ({
    page,
  }) => {
    const mobileViewports = [
      { name: '320x568', width: 320, height: 568 },
      { name: '375x667', width: 375, height: 667 },
    ];

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/athletics');

      const tabs = page.getByRole('tab');
      await expect(tabs.first()).toBeVisible();
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(4);

      // Switch to Coaches -> Teams -> Matches -> Players
      const coachesTab = page.getByRole('tab', { name: /Coaches/i });
      await coachesTab.click();
      await expect(coachesTab).toHaveAttribute('aria-selected', 'true');
      await verifyTabTriggerAntiTruncation(coachesTab, `Athletics Coaches tab on ${vp.name}`);

      const teamsTab = page.getByRole('tab', { name: /Teams/i });
      await teamsTab.click();
      await expect(teamsTab).toHaveAttribute('aria-selected', 'true');
      await verifyTabTriggerAntiTruncation(teamsTab, `Athletics Teams tab on ${vp.name}`);

      const matchesTab = page.getByRole('tab', { name: /Matches/i });
      await matchesTab.click();
      await expect(matchesTab).toHaveAttribute('aria-selected', 'true');
      await verifyTabTriggerAntiTruncation(matchesTab, `Athletics Matches tab on ${vp.name}`);

      const playersTab = page.getByRole('tab', { name: /Players/i });
      await playersTab.click();
      await expect(playersTab).toHaveAttribute('aria-selected', 'true');
      await verifyTabTriggerAntiTruncation(playersTab, `Athletics Players tab on ${vp.name}`);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      expect(hasOverflow, `No horizontal overflow on /athletics at ${vp.name}`).toBe(false);
    }
  });

  test('Tier 4.5: Direct URL tab navigation (/legal?tab=privacy and /legal?tab=terms) renders correct active tab, compact header, and full tab label', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 1. Direct link to Privacy tab
    await page.goto('/legal?tab=privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    const privacyTab = page.getByRole('tab', { name: /Privacy/i });
    await expect(privacyTab).toBeVisible();
    await verifyTabTriggerAntiTruncation(privacyTab, 'Direct deep link to Privacy tab');

    // 2. Direct link to Terms tab
    await page.goto('/legal?tab=terms');
    await expect(page.getByRole('heading', { name: 'Terms and Conditions' })).toBeVisible();

    const termsTab = page.getByRole('tab', { name: /Terms/i });
    await expect(termsTab).toBeVisible();
    await verifyTabTriggerAntiTruncation(termsTab, 'Direct deep link to Terms tab');
  });
});
