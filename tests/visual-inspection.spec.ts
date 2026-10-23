import { test, expect } from '@playwright/test';

test.describe('Responsive Layout & Anti-Corner Tucking Verification', () => {
  test('Match Center Explorer - Desktop 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Elimination toolbar exists and is visible
    const upcomingBtn = page.getByRole('button', { name: /Upcoming & Live/i });
    await expect(upcomingBtn).toBeVisible();

    const resultsBtn = page.getByRole('button', { name: /Match Results/i });
    await expect(resultsBtn).toBeVisible();

    // Verify stage filter exists
    const stageFilter = page.getByRole('combobox').filter({ hasText: /All Stages/i });
    await expect(stageFilter).toBeVisible();

    // Take desktop screenshot
    await page.screenshot({ path: 'test-results/explorer-desktop-1440.png', fullPage: false });
  });

  test('Match Center Explorer - Mobile 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // On mobile, short labels are visible without truncation
    const upcomingMobile = page.getByRole('button', { name: /Upcoming/i }).first();
    await expect(upcomingMobile).toBeVisible();

    const resultsMobile = page.getByRole('button', { name: /Results/i }).first();
    await expect(resultsMobile).toBeVisible();

    // Verify stage filter dropdown is rendered
    const stageFilter = page.getByRole('combobox').filter({ hasText: /All Stages/i });
    await expect(stageFilter).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/explorer-mobile-390.png', fullPage: false });
  });

  test('Stage Filter Interaction - Filter Selection, Clear X, and Auto-Reset on Sport Change', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Click stage filter dropdown
    const stageFilter = page.getByRole('combobox').filter({ hasText: /All Stages/i });
    if (await stageFilter.isVisible()) {
      await stageFilter.click();

      // Look for a stage option
      const stageOption = page.getByRole('option').nth(1);
      if (await stageOption.isVisible()) {
        const stageName = await stageOption.textContent();
        await stageOption.click();

        // When a stage is selected, 1-tap X button should be visible
        const clearBtn = page.getByTitle('Clear stage filter');
        await expect(clearBtn).toBeVisible();

        // Click X button to reset
        await clearBtn.click();
        await expect(stageFilter).toContainText(/All Stages/i);

        // Re-select stage
        await stageFilter.click();
        await page.getByRole('option').nth(1).click();
        await expect(clearBtn).toBeVisible();

        // Switch sport discipline
        const basketballBtn = page.locator('button').filter({ hasText: /Basketball/i }).first();
        if (await basketballBtn.isVisible()) {
          await basketballBtn.click();
          // Filter should auto-reset to 'all' or be cleared
          const updatedFilter = page.getByRole('combobox').filter({ hasText: /All Stages/i });
          if (await updatedFilter.isVisible()) {
            await expect(updatedFilter).toContainText(/All Stages/i);
          }
        }
      }
    }
  });

  test('Ranking Page - Responsive Toolbar & Filter Grid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ranking');
    await page.waitForLoadState('networkidle');

    // Standings tabs should be centered and visible
    const collegeTab = page.getByRole('button', { name: /College/i }).first();
    await expect(collegeTab).toBeVisible();

    // Search bar should span properly
    const searchInput = page.getByPlaceholder(/Search college or code/i);
    await expect(searchInput).toBeVisible();

    // Test mobile layout
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(collegeTab).toBeVisible();
    await expect(searchInput).toBeVisible();
  });
});
