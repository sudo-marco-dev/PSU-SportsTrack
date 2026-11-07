import { test, expect } from '@playwright/test';

/**
 * Milestone 1 Empirical Challenger Adversarial Verification Suite
 * Authored by: Empirical Challenger (challenger_m1_2)
 * 
 * Verifies:
 * 1. Empty state verification: non-existent queries, empty query, random symbols in HUD and /search
 * 2. Invariant: HUD NEVER renders a blank preview container under any scenario
 * 3. /search category tabs filter data correctly and render working detail links
 * 4. Clicking preview links or search result links redirects to valid destinations without 404
 * 5. Route alias redirect integrity across all canonical and legacy entrypoints
 */

test.describe('Adversarial Challenge 1: Empty States & Pathological Queries', () => {
  const PATHOLOGICAL_QUERIES = [
    { name: 'Non-existent alphanumeric query', term: 'xyznonexistent999' },
    { name: 'Random special symbols query', term: '!@#$%^&*()_+~`' },
    { name: 'Pure numeric query without matches', term: '99999999' },
    { name: 'Whitespace query', term: '     ' },
  ];

  for (const tc of PATHOLOGICAL_QUERIES) {
    test(`HUD renders informative empty state without blank preview container for "${tc.name}"`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Open HUD
      const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
      await voiceBtn.click();

      const searchInput = page.locator('[data-testid="input-public-voice-search"]');
      await expect(searchInput).toBeVisible();

      // Submit query
      await searchInput.fill(tc.term);
      await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

      if (tc.term.trim()) {
        // Must show hud-empty-state
        const emptyState = page.locator('[data-testid="hud-empty-state"]');
        await expect(emptyState).toBeVisible({ timeout: 8000 });
        await expect(emptyState).toContainText('No matching athletic records found');

        // Verify action link to search hub
        const searchHubBtn = page.locator('[data-testid="btn-hud-open-search"]');
        await expect(searchHubBtn).toBeVisible();

        // Invariant: Verify NO blank preview containers or orphaned "Preview Results" header
        await expect(page.locator('text=Preview Results')).not.toBeVisible();
      } else {
        // Blank/whitespace submit should do nothing, no empty state error and no blank container
        await expect(page.locator('text=Preview Results')).not.toBeVisible();
      }

      // No 404 error
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    });

    test(`/search page renders clear empty state for "${tc.name}" without crashing or 404`, async ({ page }) => {
      const encoded = encodeURIComponent(tc.term);
      await page.goto(`/search?q=${encoded}`, { waitUntil: 'domcontentloaded' });

      const searchPage = page.locator('[data-testid="page-voice-query-search"]');
      await expect(searchPage).toBeVisible({ timeout: 8000 });

      if (tc.term.trim()) {
        // Verify empty state is displayed
        await expect(page.locator('text=No Matching Records Found')).toBeVisible({ timeout: 6000 });
        await expect(page.locator('text=Suggested searches:')).toBeVisible();

        // Verify Reset All Filters button exists and works
        const resetBtn = page.locator('button:has-text("Reset All Filters")');
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

        // Clicking reset clears the query parameter
        await expect(page).not.toHaveURL(new RegExp(encoded));
      }

      // No 404
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    });
  }

  test('HUD empty state button redirects to /search page with query intact', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const searchInput = page.locator('[data-testid="input-public-voice-search"]');
    await searchInput.fill('xyznonexistent999');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    const searchHubBtn = page.locator('[data-testid="btn-hud-open-search"]');
    await expect(searchHubBtn).toBeVisible({ timeout: 8000 });
    await searchHubBtn.click();

    // Verify redirected to /search without 404
    await expect(page).toHaveURL(/\/search\?q=xyznonexistent999/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible();
  });
});

test.describe('Adversarial Challenge 2: HUD Preview Rendering Integrity & Detail Links', () => {
  test('HUD renders upcoming games preview with working "View Match" link without 404', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    // Use Quick Chip for upcoming games
    const gamesChip = page.locator('button:has-text("Upcoming games this week")');
    await gamesChip.click();

    // Wait for preview results
    await expect(page.locator('text=Preview Results')).toBeVisible({ timeout: 10000 });

    // Verify preview card has content (not blank)
    const viewMatchBtn = page.locator('[data-testid^="btn-preview-view-match-"]').first();
    const hasMatches = await viewMatchBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMatches) {
      await viewMatchBtn.click();
      // Should navigate to /match/:id
      await expect(page).toHaveURL(/\/match\//);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    } else {
      // If database has 0 matches, empty state must render
      await expect(page.locator('[data-testid="hud-empty-state"]')).toBeVisible();
    }
  });

  test('HUD renders sport schedule preview with working "View Fixtures" link without 404', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const basketballChip = page.locator('button:has-text("Basketball schedule")');
    await basketballChip.click();

    // Wait for response
    await page.waitForTimeout(2000);

    const viewSchedBtn = page.locator('[data-testid^="btn-preview-view-schedule-"]').first();
    const hasSchedules = await viewSchedBtn.isVisible().catch(() => false);

    if (hasSchedules) {
      await viewSchedBtn.click();
      await expect(page).toHaveURL(/\/explorer/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    } else {
      // Must not be blank container
      const emptyState = page.locator('[data-testid="hud-empty-state"]');
      const previewResults = page.locator('text=Preview Results');
      const isEitherVisible = (await emptyState.isVisible()) || (await previewResults.isVisible());
      expect(isEitherVisible).toBe(true);
    }
  });

  test('HUD renders college standings preview with working link without 404', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const searchInput = page.locator('[data-testid="input-public-voice-search"]');
    await searchInput.fill('CET');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    await page.waitForTimeout(2000);

    const viewCollegeBtn = page.locator('[data-testid^="btn-preview-view-college-"]').first();
    const hasColleges = await viewCollegeBtn.isVisible().catch(() => false);

    if (hasColleges) {
      await viewCollegeBtn.click();
      await expect(page).toHaveURL(/\/ranking/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    }
  });

  test('HUD "View All in Portal" redirects to target without 404', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    const starsChip = page.locator('button:has-text("Players with highest stars")');
    await starsChip.click();

    await page.waitForTimeout(2000);

    const viewAllBtn = page.locator('button:has-text("View All in Portal")');
    const isViewAllVisible = await viewAllBtn.isVisible().catch(() => false);

    if (isViewAllVisible) {
      await viewAllBtn.click();
      // Expect ranking page without 404
      await expect(page).toHaveURL(/\/ranking/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    }
  });
});

test.describe('Adversarial Challenge 3: /search Category Tabs & Detail Links', () => {
  test('/search category tabs isolate content and render working detail links', async ({ page }) => {
    // Navigate to /search without filter
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible();

    // 1. Matches & Games tab
    const matchesTab = page.locator('[data-testid="tab-filter-matches"]');
    await matchesTab.click();
    await expect(page).toHaveURL(/type=matches/);

    // Verify other sections are hidden
    await expect(page.locator('[data-testid="section-players-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-colleges-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-stars-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-schedules-results"]')).not.toBeVisible();

    // If matches section has cards, verify detail button redirects without 404
    const matchBtn = page.locator('[data-testid^="btn-view-match-"]').first();
    if (await matchBtn.isVisible().catch(() => false)) {
      await matchBtn.click();
      await expect(page).toHaveURL(/\/match\//);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      // Go back to search
      await page.goto('/search?type=matches', { waitUntil: 'domcontentloaded' });
    }

    // 2. Athletes tab
    const playersTab = page.locator('[data-testid="tab-filter-players"]');
    await playersTab.click();
    await expect(page).toHaveURL(/type=players/);

    await expect(page.locator('[data-testid="section-matches-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-colleges-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-stars-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-schedules-results"]')).not.toBeVisible();

    const scoutBtn = page.locator('[data-testid^="btn-scout-player-"]').first();
    if (await scoutBtn.isVisible().catch(() => false)) {
      await scoutBtn.click();
      await expect(page).toHaveURL(/\/athletics/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await page.goto('/search?type=players', { waitUntil: 'domcontentloaded' });
    }

    // 3. Colleges tab
    const collegesTab = page.locator('[data-testid="tab-filter-colleges"]');
    await collegesTab.click();
    await expect(page).toHaveURL(/type=colleges/);

    await expect(page.locator('[data-testid="section-matches-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-players-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-stars-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-schedules-results"]')).not.toBeVisible();

    const collegeBtn = page.locator('[data-testid^="btn-view-college-"]').first();
    if (await collegeBtn.isVisible().catch(() => false)) {
      await collegeBtn.click();
      await expect(page).toHaveURL(/\/ranking/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await page.goto('/search?type=colleges', { waitUntil: 'domcontentloaded' });
    }

    // 4. Rankings & Star Leaders tab
    const rankingsTab = page.locator('[data-testid="tab-filter-rankings"]');
    await rankingsTab.click();
    await expect(page).toHaveURL(/type=rankings/);

    await expect(page.locator('[data-testid="section-matches-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-players-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-colleges-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-schedules-results"]')).not.toBeVisible();

    const starBtn = page.locator('[data-testid^="btn-view-leaderboard-"]').first();
    if (await starBtn.isVisible().catch(() => false)) {
      await starBtn.click();
      await expect(page).toHaveURL(/\/ranking/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await page.goto('/search?type=rankings', { waitUntil: 'domcontentloaded' });
    }

    // 5. Schedules tab
    const schedulesTab = page.locator('[data-testid="tab-filter-schedules"]');
    await schedulesTab.click();
    await expect(page).toHaveURL(/type=schedules/);

    await expect(page.locator('[data-testid="section-matches-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-players-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-colleges-results"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="section-stars-results"]')).not.toBeVisible();

    const schedBtn = page.locator('[data-testid^="btn-open-schedule-"]').first();
    if (await schedBtn.isVisible().catch(() => false)) {
      await schedBtn.click();
      await expect(page).toHaveURL(/\/explorer/);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    }
  });

  test('/search empty state displays across all tabs when query has zero matches', async ({ page }) => {
    const tabs: Array<{ tabId: string; typeParam: string }> = [
      { tabId: 'tab-filter-matches', typeParam: 'matches' },
      { tabId: 'tab-filter-players', typeParam: 'players' },
      { tabId: 'tab-filter-colleges', typeParam: 'colleges' },
      { tabId: 'tab-filter-rankings', typeParam: 'rankings' },
      { tabId: 'tab-filter-schedules', typeParam: 'schedules' },
    ];

    for (const { tabId, typeParam } of tabs) {
      await page.goto(`/search?q=xyznonexistent999&type=${typeParam}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('text=No Matching Records Found')).toBeVisible({ timeout: 6000 });
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    }
  });
});

test.describe('Adversarial Challenge 4: Route Aliases & 404 Prevention Exhaustive Check', () => {
  const ROUTE_ALIASES = [
    { source: '/tournaments', targetPattern: /\/explorer/ },
    { source: '/rankings', targetPattern: /\/ranking/ },
    { source: '/live/match-alias-id-456', targetPattern: /\/match\/match-alias-id-456/ },
    { source: '/live', targetPattern: /\/explorer/ },
    { source: '/brackets', targetPattern: /\/explorer/ },
    { source: '/standings', targetPattern: /\/ranking/ },
    { source: '/fixtures', targetPattern: /\/explorer/ },
    { source: '/query', targetPattern: /\/search/ },
  ];

  for (const alias of ROUTE_ALIASES) {
    test(`Route ${alias.source} redirects to ${alias.targetPattern} without 404 Arena Navigation Error`, async ({ page }) => {
      await page.goto(alias.source, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(alias.targetPattern);
      await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
      await expect(page.locator('text=404 Fixture Not Found')).not.toBeVisible();
    }
  );
  }
});
