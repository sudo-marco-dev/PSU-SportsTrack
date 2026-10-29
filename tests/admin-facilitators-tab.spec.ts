import { test, expect } from '@playwright/test';

test.describe('Admin Facilitator Operations Hub (/admin/tournaments)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed dev impersonation persona for Dr. Ramon Bautista (Admin)
    await page.addInitScript(() => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify({
        id: '95f03009-c970-4840-9e90-5116237f0b5d',
        full_name: 'Dr. Ramon Bautista',
        email: 'sports.director@psu.palawan.edu.ph',
        role: 'admin',
        is_verified: true,
        department: 'University Sports Development Office',
        employee_id: 'EMP-2024-0001',
        persona_label: 'Admin (Sports Director)',
      }));
    });
  });

  test('1. Match Officials tab appears in Tournament Operations navigation', async ({ page }) => {
    await page.goto('/admin/tournaments');
    await expect(page).toHaveURL(/\/admin\/tournaments/);

    // Look for Match Officials / Officials tab in ExpandableIconTabs
    const officialsTab = page.locator('button[role="tab"]', { hasText: /Officials|Match Officials/i }).first();
    await expect(officialsTab).toBeVisible({ timeout: 10000 });
  });

  test('2. Facilitators operations hub renders dual sub-views', async ({ page }) => {
    await page.goto('/admin/tournaments');

    // Click Officials tab
    const officialsTab = page.locator('button[role="tab"]', { hasText: /Officials|Match Officials/i }).first();
    await officialsTab.click();

    // Verify header and sub-view buttons exist
    await expect(page.getByText('Courtside Facilitator Operations Hub')).toBeVisible({ timeout: 10000 });
    const matchAssignmentsBtn = page.getByRole('button', { name: /Match Assignments/i });
    const rosterBtn = page.getByRole('button', { name: /Officials Roster & Recruitment/i });

    await expect(matchAssignmentsBtn).toBeVisible();
    await expect(rosterBtn).toBeVisible();
  });

  test('3. Match Assignment Board displays bulk assign action and filters', async ({ page }) => {
    await page.goto('/admin/tournaments');

    const officialsTab = page.locator('button[role="tab"]', { hasText: /Officials|Match Officials/i }).first();
    await officialsTab.click();

    // Check Bulk Assign Round button
    const bulkBtn = page.getByRole('button', { name: /Bulk Assign Round/i });
    await expect(bulkBtn).toBeVisible({ timeout: 10000 });
  });

  test('4. Officials Roster & Recruitment displays instant candidate recruitment panel', async ({ page }) => {
    await page.goto('/admin/tournaments');

    const officialsTab = page.locator('button[role="tab"]', { hasText: /Officials|Match Officials/i }).first();
    await officialsTab.click();

    // Switch to Roster sub-view
    const rosterBtn = page.getByRole('button', { name: /Officials Roster & Recruitment/i });
    await rosterBtn.click();

    // Verify search input exists
    const searchInput = page.getByPlaceholder(/Type name to recruit/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Verify roster header
    await expect(page.getByText(/Certified Match Officials Roster/i)).toBeVisible();
  });
});
