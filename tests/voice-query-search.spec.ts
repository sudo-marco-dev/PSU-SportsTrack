/**
 * Dedicated Voice Query Search Page Automated Test Suite
 * PSU SportsTrack - Multimodal Public Access Interface
 */

import { test, expect } from '@playwright/test';

test.describe('Dedicated Voice Query Search Page E2E Tests', () => {
  test('Search page mounts at /search with search bar and filter tabs', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const searchPage = page.locator('[data-testid="page-voice-query-search"]');
    await expect(searchPage).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('[data-testid="input-voice-search-page"]');
    await expect(searchInput).toBeVisible();

    // Verify category filter tabs
    await expect(page.locator('[data-testid="tab-filter-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-filter-matches"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-filter-players"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-filter-colleges"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-filter-rankings"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-filter-schedules"]')).toBeVisible();
  });

  test('Search page executes query from ?q= URL parameter', async ({ page }) => {
    await page.goto('/search?q=basketball', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('[data-testid="input-voice-search-page"]');
    await expect(searchInput).toHaveValue('basketball', { timeout: 8000 });

    // Expect no 404 error
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('Filter tabs switch active category views without 404 errors', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    // Click Matches tab
    await page.locator('[data-testid="tab-filter-matches"]').click();
    await expect(page).toHaveURL(/type=matches/);

    // Click Colleges tab
    await page.locator('[data-testid="tab-filter-colleges"]').click();
    await expect(page).toHaveURL(/type=colleges/);

    // Click Schedules tab
    await page.locator('[data-testid="tab-filter-schedules"]').click();
    await expect(page).toHaveURL(/type=schedules/);

    // Click All tab
    await page.locator('[data-testid="tab-filter-all"]').click();
    await expect(page).not.toHaveURL(/type=/);
  });

  test('Interactive search bar allows typing, submitting, and updating query', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('[data-testid="input-voice-search-page"]');
    await searchInput.fill('volleyball');
    await page.locator('[data-testid="btn-voice-search-submit"]').click();

    await expect(page).toHaveURL(/q=volleyball/);
  });

  test('Displays clear empty state when no matching records found with reset option', async ({ page }) => {
    await page.goto('/search?q=xyznonexistentterm123456', { waitUntil: 'domcontentloaded' });

    // Verify empty state title
    await expect(page.locator('text=No Matching Records Found')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Suggested searches:')).toBeVisible();

    // Verify Reset All Filters button works
    const resetBtn = page.locator('button:has-text("Reset All Filters")');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    await expect(page).not.toHaveURL(/xyznonexistentterm123456/);
  });

  test('End-to-end voice navigation flow: HUD -> Search Page -> Target Section', async ({ page }) => {
    // 1. Start on home page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. Open universal voice assistant HUD
    const voiceBtn = page.locator('[data-testid="btn-universal-voice-assistant"]');
    await voiceBtn.click();

    // 3. Search for a query in HUD
    const searchInput = page.locator('[data-testid="input-public-voice-search"]');
    await searchInput.fill('basketball');
    await page.locator('[data-testid="btn-submit-public-voice-search"]').click();

    // 4. Click "View All in Portal" in HUD preview header
    const viewAllBtn = page.locator('text=View All in Portal');
    await expect(viewAllBtn).toBeVisible({ timeout: 10000 });
    await viewAllBtn.click();

    // 5. Verify navigation to /search page without 404 errors
    await expect(page).toHaveURL(/\/search/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
    await expect(page.locator('[data-testid="page-voice-query-search"]')).toBeVisible();
  });

  test('Colleges tab queries database, reflects badge count 9, and renders all 9 college cards in the DOM', async ({
    page,
  }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    // Click Colleges Tab
    const collegeTab = page.locator('[data-testid="tab-filter-colleges"]');
    await collegeTab.click();
    await expect(page).toHaveURL(/type=colleges/);

    // Assert tab badge count reflects 9 active collegiate units
    const badge = collegeTab.locator('span, div').last();
    await expect(badge).toHaveText('9', { timeout: 10000 });

    // Assert Colleges section is rendered and visible
    const collegesSection = page.locator('[data-testid="section-colleges-results"]');
    await expect(collegesSection).toBeVisible();
    await expect(collegesSection.locator('h2')).toContainText('Colleges & Campuses (9)');

    // Assert all 9 college cards are rendered in the DOM
    const collegeCards = page.locator('[data-testid^="btn-view-college-"]');
    await expect(collegeCards).toHaveCount(9);

    // Assert authentic collegiate units appear in DOM
    await expect(page.locator('text=College of Engineering, Architecture and Technology (CEAT)')).toBeVisible();
    await expect(page.locator('text=College of Sciences (CS)')).toBeVisible();
    await expect(page.locator('text=College of Business and Accountancy (CBA)')).toBeVisible();

    // Verify "View Standings" button works and links to /ranking without 404
    const firstCollegeBtn = collegeCards.first();
    await firstCollegeBtn.click();
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });

  test('Searching for "colleges" or "CET" renders college cards with working View Standings button', async ({
    page,
  }) => {
    // 1. Searching for "colleges"
    await page.goto('/search?q=colleges&type=colleges', { waitUntil: 'domcontentloaded' });
    const collegesSection = page.locator('[data-testid="section-colleges-results"]');
    await expect(collegesSection).toBeVisible({ timeout: 10000 });
    const collegeCards = page.locator('[data-testid^="btn-view-college-"]');
    expect(await collegeCards.count()).toBeGreaterThan(0);
    await expect(page.locator('text=No Matching Records Found')).not.toBeVisible();

    // 2. Searching for "CET" (acronym alias for CEAT)
    await page.goto('/search?q=CET&type=colleges', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="section-colleges-results"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=College of Engineering, Architecture and Technology')).toBeVisible();

    // Verify View Standings button links to /ranking
    const viewStandingsBtn = page.locator('[data-testid^="btn-view-college-"]').first();
    await expect(viewStandingsBtn).toBeVisible();
    await viewStandingsBtn.click();
    await expect(page).toHaveURL(/\/ranking/);
    await expect(page.locator('text=Arena Navigation Error')).not.toBeVisible();
  });
});

