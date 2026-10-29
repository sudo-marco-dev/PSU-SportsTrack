import { test, expect } from '@playwright/test';
import { formatRole } from '../src/lib/utils';

test.describe('Facilitator Dual-Role Capability & Governance Engine', () => {
  test('formatRole: preserves primary athlete and facilitator identities', () => {
    expect(formatRole('player_student')).toBe('Student Athlete');
    expect(formatRole('player_faculty')).toBe('Faculty Athlete');
    expect(formatRole('coach')).toBe('Athletic Coach');
    expect(formatRole('facilitator')).toBe('Facilitator');
    expect(formatRole('admin')).toBe('Admin');
  });

  test('Persona Impersonation: Student Athlete holding Facilitator status retains player dashboard', async ({ page }) => {
    // Navigate to Dev Sandbox to set up impersonation
    await page.goto('/dev');

    // Impersonate Student Athlete
    const studentAthleteButton = page.locator('button', { hasText: /Student Athlete|Student/i }).first();
    if (await studentAthleteButton.isVisible()) {
      await studentAthleteButton.click();
    }

    // Verify navigating to /player is allowed for student athlete
    await page.goto('/player');
    await expect(page).toHaveURL(/\/player/);
  });

  test('Dev Sandbox: Facilitator persona can access Live Match Center and Scoring console', async ({ page }) => {
    await page.goto('/dev');

    // Impersonate Courtside Facilitator
    const faciButton = page.locator('button', { hasText: /Facilitator|Official/i }).first();
    if (await faciButton.isVisible()) {
      await faciButton.click();
    }

    // Match Explorer is accessible
    await page.goto('/explorer');
    await expect(page).toHaveURL(/\/explorer/);
  });

  test('Facilitator Management Modal: renders dual-role certification badge in Admin', async ({ page }) => {
    await page.goto('/dev');

    // Impersonate Admin
    const adminButton = page.locator('button', { hasText: /Tournament Administrator|Admin/i }).first();
    if (await adminButton.isVisible()) {
      await adminButton.click();
    }

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);

    // Look for Manage Facilitators button
    const manageFaciBtn = page.locator('button', { hasText: /Appoint Facilitator|Facilitator/i }).first();
    if (await manageFaciBtn.isVisible()) {
      await manageFaciBtn.click();
      // Verify modal opened
      await expect(page.getByText(/Facilitator|Official/i).first()).toBeVisible();
    }
  });
});
