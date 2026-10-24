import { test, expect } from '@playwright/test';

test.describe('Registration and Verification Clearance Suite', () => {
  test('should render registration page with role-adaptive fields for staff and faculty athletes', async ({ page }) => {
    await page.goto('/register');

    // Verify Register page presence
    await expect(page.getByText('CREATE AN').first()).toBeVisible();

    // Verify role select dropdown trigger exists
    const roleSelect = page.getByRole('combobox').first();
    await expect(roleSelect).toBeVisible();

    // Default should show Student Athlete
    await expect(roleSelect).toContainText('Student Athlete');

    // Click role selector to open dropdown
    await roleSelect.click();

    // Check all roles exist: Student Athlete, Faculty Athlete, Staff Athlete, Athletic Coach
    await expect(page.getByRole('option', { name: 'Student Athlete' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Faculty Athlete' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Staff Athlete' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Athletic Coach' })).toBeVisible();

    // Select Staff Athlete
    await page.getByRole('option', { name: 'Staff Athlete' }).click();

    // Verify Employee ID & Department inputs dynamically appear
    await expect(page.getByText('Employee / Faculty ID')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. EMP-2024-0123')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. HR, Registrar, ICTD')).toBeVisible();
  });

  test('should protect admin verifications route from unauthenticated access', async ({ page }) => {
    // Navigate directly to /admin/verifications
    await page.goto('/admin/verifications');

    // Expect to be redirected to home page or login prompt because not super_admin
    await page.waitForURL('**/');
    await expect(page).toHaveURL(/\/$/);
  });
});
