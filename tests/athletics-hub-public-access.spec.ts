import { test, expect } from '@playwright/test';

test.describe('Athletics Hub Public Access & Navigation Suite', () => {
  test('should allow unauthenticated visitors to access /athletics without verification lock', async ({ page }) => {
    // Clear any local storage/session to guarantee guest context
    await page.goto('/athletics');

    // Verify URL is /athletics
    await expect(page).toHaveURL(/\/athletics/);

    // Verify Athletics Hub hero header branding
    const hubHeading = page.getByRole('heading', { name: /ATHLETICS HUB/i });
    await expect(hubHeading).toBeVisible();

    const bannerBadge = page.locator('text=Official PSU Athletics Directory');
    await expect(bannerBadge).toBeVisible();

    // Verify lock screen is NOT rendered
    const lockScreen = page.locator('text=Verified University Access Required');
    await expect(lockScreen).not.toBeVisible();

    // Verify 4-entity navigation tabs exist
    await expect(page.getByRole('tab', { name: /Players/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Coaches/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Teams/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Matches/i })).toBeVisible();

    // Verify that direct coach recruitment actions are not presented to guests
    const recruitButtons = page.getByRole('button', { name: /^Recruit$/i });
    await expect(recruitButtons).toHaveCount(0);
  });

  test('should redirect legacy /scouting route directly to /athletics', async ({ page }) => {
    await page.goto('/scouting');

    // Expect automatic replacement redirect to /athletics
    await expect(page).toHaveURL(/\/athletics/);
    const hubHeading = page.getByRole('heading', { name: /ATHLETICS HUB/i });
    await expect(hubHeading).toBeVisible();
  });

  test('should render Athletics Hub in public navigation bar', async ({ page }) => {
    await page.goto('/');

    // Locate Athletics Hub in navigation
    const athleticsNavLink = page.getByRole('link', { name: /Athletics Hub/i }).first();
    await expect(athleticsNavLink).toBeVisible();

    // Click link and assert navigation to /athletics
    await athleticsNavLink.click();
    await expect(page).toHaveURL(/\/athletics/);
  });

  test('should switch between tabs on Athletics Hub', async ({ page }) => {
    await page.goto('/athletics');

    // Switch to Coaches tab
    const coachesTab = page.getByRole('tab', { name: /Coaches/i });
    await coachesTab.click();
    await expect(coachesTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Teams tab
    const teamsTab = page.getByRole('tab', { name: /Teams/i });
    await teamsTab.click();
    await expect(teamsTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Matches tab
    const matchesTab = page.getByRole('tab', { name: /Matches/i });
    await matchesTab.click();
    await expect(matchesTab).toHaveAttribute('aria-selected', 'true');

    // Switch back to Players tab
    const playersTab = page.getByRole('tab', { name: /Players/i });
    await playersTab.click();
    await expect(playersTab).toHaveAttribute('aria-selected', 'true');
  });
});
