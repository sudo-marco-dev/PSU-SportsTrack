import { test, expect } from '@playwright/test';

test.describe('Friendly Games Visibility & Role Restrictions', () => {
  test('Unauthenticated Public Visitor: Match Center hides Friendly Games division and tournaments', async ({ page }) => {
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // 1. Division filter dropdown must NOT include Friendly Games
    const divisionSelect = page.getByRole('combobox').filter({ hasText: /All Divisions|Binturungan|Inter-Collegiate/i }).first();
    await expect(divisionSelect).toBeVisible();
    await divisionSelect.click();

    // Friendly Games option should not exist
    await expect(page.getByRole('option', { name: /Friendly Games/i })).not.toBeVisible();
    await expect(page.getByRole('option', { name: /Binturungan/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Inter-Collegiate/i })).toBeVisible();

    // Close select
    await page.keyboard.press('Escape');

    // 2. Tournament selector should not contain any friendly or faculty/staff tournaments
    const tournSelect = page.getByRole('combobox').filter({ hasText: /All Tournaments/i }).first();
    await expect(tournSelect).toBeVisible();
    await tournSelect.click();
    await expect(page.getByRole('option', { name: /Friendly/i })).not.toBeVisible();
    await expect(page.getByRole('option', { name: /Faculty & Staff/i })).not.toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Unauthenticated Public Visitor: Rankings page hides Friendly options from Category filter', async ({ page }) => {
    await page.goto('/ranking');
    await page.waitForLoadState('networkidle');

    // Open filters on desktop or mobile
    const filterToggle = page.getByRole('button', { name: /Filters/i });
    if (await filterToggle.isVisible()) {
      await filterToggle.click();
    }

    // Category dropdown
    const categorySelect = page.getByRole('combobox').filter({ hasText: /Championship|All Competitions|Binturungan/i }).first();
    await expect(categorySelect).toBeVisible();
    await categorySelect.click();

    // Friendly options must NOT exist
    await expect(page.getByRole('option', { name: /Friendly Match/i })).not.toBeVisible();
    await expect(page.getByRole('option', { name: /Faculty & Staff Friendly Games/i })).not.toBeVisible();
    await expect(page.getByRole('option', { name: /Championship Competitions/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Unauthenticated Public Visitor: Player Dashboard hides Friendly Division switcher', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify public hero is shown
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Role-specific Friendly Games division switcher should NOT be visible to public guests
    const friendlyDivisionBtn = page.getByRole('button', { name: /Friendly Games \(Staff & Faculty\)/i });
    await expect(friendlyDivisionBtn).not.toBeVisible();
  });

  test('Faculty Athlete / Admin Role: Sees Friendly Games division and options', async ({ page }) => {
    const adminId = '11111111-2222-3333-4444-555555555555';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;

    const mockUser = {
      id: adminId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'faculty.sports@psu.palawan.edu.ph',
      user_metadata: { full_name: 'Dr. Faculty Member' },
      app_metadata: { provider: 'email' },
    };

    const mockSession = {
      access_token: 'fake-faculty-token',
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
          id: adminId,
          full_name: 'Dr. Faculty Member',
          role: 'player_faculty',
          is_verified: true,
          account_status: 'active',
        }),
      });
    });

    await page.addInitScript(({ session }) => {
      const storageKey = 'sb-kxnkdhznnpwvnljjmfwl-auth-token';
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    }, { session: mockSession });

    // Visit Match Center as Faculty Athlete
    await page.goto('/explorer');
    await page.waitForLoadState('networkidle');

    // Faculty Athlete sees Friendly Games in the Division selector
    const divisionSelect = page.getByRole('combobox').filter({ hasText: /Friendly Games|All Divisions|Binturungan/i }).first();
    await expect(divisionSelect).toBeVisible();
    await divisionSelect.click();
    await expect(page.getByRole('option', { name: /Friendly Games/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
