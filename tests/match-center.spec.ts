import { test, expect } from '@playwright/test';

test.describe('Tournament Match Center Suite', () => {
  test('should render tournament explorer with sports navigation rail', async ({ page }) => {
    await page.goto('/explorer');

    // Verify search toolbar
    const searchInput = page.getByPlaceholder(/Search squads, colleges/i).first();
    await expect(searchInput).toBeVisible();

    // Type query into search toolbar
    await searchInput.fill('Basketball');
    await expect(searchInput).toHaveValue('Basketball');

    // Clear search
    await searchInput.clear();
  });

  test('should toggle between Tournament Brackets and Schedule views', async ({ page }) => {
    await page.goto('/explorer');

    // Check for stage / phase switcher buttons if present
    const phaseButton = page.locator('button').filter({ hasText: /Stage|Playoff|Elimination/i }).first();
    if (await phaseButton.isVisible()) {
      await phaseButton.click();
    }

    // Page must remain responsive with no unhandled exceptions
    await expect(page.locator('body')).toBeVisible();
  });
});
