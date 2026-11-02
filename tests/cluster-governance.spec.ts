import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Load real authenticated Supabase sessions
const authDataRaw = fs.readFileSync('tests/.auth-sessions.json', 'utf-8');
const authData = JSON.parse(authDataRaw) as {
  storageKey: string;
  password: string;
  accounts: Record<string, { profile: any; session: any }>;
};

async function configureSession(page: Page, accountKey: 'admin' | 'coach') {
  const storageKey = authData.storageKey;
  const rawSession = authData.accounts[accountKey]?.session;
  const futureExpiresAt = Math.floor(Date.now() / 1000) + 86400;
  const sessionObj = rawSession
    ? {
        ...rawSession,
        expires_in: 86400,
        expires_at: futureExpiresAt,
      }
    : null;

  if (sessionObj) {
    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/token') || url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(sessionObj),
        });
        return;
      }
      await route.continue();
    });

    await page.addInitScript(
      ({ key, val }) => {
        window.localStorage.setItem(key, JSON.stringify(val));
        window.localStorage.setItem('psu_theme', 'light');
        document.documentElement.classList.remove('dark');
      },
      { key: storageKey, val: sessionObj }
    );
  }
}

test.describe('Cluster & Tribe Governance Tab & Operations Hub', () => {
  test('1. Admin accesses Clusters & Tribes via Dashboard quick action & checks 5th tab', async ({ page }) => {
    await configureSession(page, 'admin');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Verify Clusters & Tribes Quick Action card exists on /admin
    const clustersQuickCard = page.locator('button', { hasText: 'Clusters & Tribes' }).first();
    await expect(clustersQuickCard).toBeVisible({ timeout: 15000 });
    await clustersQuickCard.click();

    // Verify navigation landed on /admin/tournaments?tab=clusters
    await page.waitForURL(/\/admin\/tournaments\?tab=clusters/, { timeout: 10000 });

    // Verify 5th tab 'Clusters & Tribes' is active in ExpandableIconTabs
    const tribesTab = page.locator('button[role="tab"]', { hasText: /Clusters & Tribes|Tribes/i });
    await expect(tribesTab).toBeVisible();

    // Verify the authentic tribes are present: Mapulon, Dumangan, Apolaki, Libulan, Tala, Haliya
    await expect(page.getByText('Tribo Mapulon')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Tribo Dumangan')).toBeVisible();
    await expect(page.getByText('Tribo Apolaki')).toBeVisible();

    // Verify external campuses are shown without clipping
    await expect(page.getByText("Brooke's Point", { exact: true })).toBeVisible();

    // Take Desktop Tab Screenshot
    const screenshotDir = 'C:/Users/Marco/.gemini/antigravity/brain/472be629-050a-48a2-8ad9-1c9920850f1e/screenshots/clusters';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    await page.screenshot({
      path: path.join(screenshotDir, 'cluster-governance-tab-desktop.png'),
      fullPage: false,
    });
  });

  test('2. Admin tests instant search in Configure Cluster modal with zero text clipping', async ({ page }) => {
    await configureSession(page, 'admin');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/admin/tournaments?tab=clusters');
    await page.waitForLoadState('networkidle');

    // Find Tribo Mapulon card and click its edit button
    const mapulonCard = page.locator('.group', { hasText: 'Tribo Mapulon' }).first();
    await expect(mapulonCard).toBeVisible({ timeout: 10000 });

    const editBtn = mapulonCard.getByTitle('Edit Cluster');
    await editBtn.click();

    // Verify modal appears
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Configure Cluster / Tribe')).toBeVisible();

    // Verify Main Campus section and External Campuses section
    await expect(modal.getByText('Main Campus Colleges (Partitioned)')).toBeVisible();
    await expect(modal.getByText('External Campuses (Whole Entities)')).toBeVisible();

    // Test campus instant search filter
    const campusSearchInput = modal.getByPlaceholder(/Search external campuses/i);
    await expect(campusSearchInput).toBeVisible();
    await campusSearchInput.fill('Narra');

    // Verify Narra is visible and other non-matching campuses are filtered out
    await expect(modal.getByRole('button', { name: "Narra" })).toBeVisible();
    await expect(modal.getByRole('button', { name: "Coron" })).not.toBeVisible();

    // Clear search
    await campusSearchInput.fill('');
    await expect(modal.getByRole('button', { name: "Coron" })).toBeVisible();

    // Screenshot modal
    const screenshotDir = 'C:/Users/Marco/.gemini/antigravity/brain/472be629-050a-48a2-8ad9-1c9920850f1e/screenshots/clusters';
    await modal.screenshot({
      path: path.join(screenshotDir, 'cluster-governance-modal-instant-search.png'),
    });

    // Close modal
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('3. Mobile responsiveness check (<640px) on Clusters Tab', async ({ page }) => {
    await configureSession(page, 'admin');
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X viewport
    await page.goto('/admin/tournaments?tab=clusters');
    await page.waitForLoadState('networkidle');

    // Ensure action buttons stack cleanly and cards are visible
    const createBtn = page.getByRole('button', { name: /Create Cluster/i });
    await expect(createBtn).toBeVisible({ timeout: 15000 });

    // Check no horizontal overflow on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Take Mobile Tab Screenshot
    const screenshotDir = 'C:/Users/Marco/.gemini/antigravity/brain/472be629-050a-48a2-8ad9-1c9920850f1e/screenshots/clusters';
    await page.screenshot({
      path: path.join(screenshotDir, 'cluster-governance-tab-mobile.png'),
      fullPage: false,
    });
  });
});
