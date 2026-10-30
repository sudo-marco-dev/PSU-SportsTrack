import { test, expect } from '@playwright/test';

test.describe('FR-43 Institutional Report Generation (/admin/reports)', () => {
  const adminPersona = {
    id: '95f03009-c970-4840-9e90-5116237f0b5d',
    full_name: 'Dr. Ramon Bautista',
    email: 'sports.director@psu.palawan.edu.ph',
    role: 'admin',
    is_verified: true,
    department: 'University Sports Development Office',
    employee_id: 'EMP-2024-0001',
    persona_label: 'Admin (Sports Director)',
  };

  const studentPersona = {
    id: '22222222-3333-4444-5555-666666666666',
    full_name: 'Juan Dela Cruz',
    email: 'student.athlete@psu.palawan.edu.ph',
    role: 'player_student',
    is_verified: true,
    department: 'College of Engineering and Architecture',
    student_number: '2021-12345',
    persona_label: 'Student Athlete',
  };

  test('1. Unauthenticated guest is blocked and redirected away from /admin/reports', async ({ page }) => {
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Guest should be redirected away from the protected admin route
    await expect(page).not.toHaveURL(/\/admin\/reports/);
  });

  test('2. Student Athlete is blocked and redirected away from /admin/reports', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, studentPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Student should not have access to admin reports
    await expect(page).not.toHaveURL(/\/admin\/reports/);
  });

  test('3. Admin can access Institutional Reports from Admin Dashboard Quick Operations', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Verify Quick Operations button exists
    const reportsBtn = page.getByRole('button', { name: /Institutional Reports/i });
    await expect(reportsBtn).toBeVisible({ timeout: 10000 });
    await expect(reportsBtn.getByText(/Analytics & Exports/i)).toBeVisible();

    // Click button to navigate to /admin/reports
    await reportsBtn.click();
    await expect(page).toHaveURL(/\/admin\/reports/);
  });

  test('4. Institutional Reports page renders header, scope controls, and export buttons', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Header validation
    await expect(page.getByText('Administrative Compliance • FR-43')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Institutional Report Generation/i })).toBeVisible();

    // Export Buttons
    const downloadCsvBtn = page.getByRole('button', { name: /Download CSV/i });
    const printPdfBtn = page.getByRole('button', { name: /Print \/ Save as PDF/i });
    await expect(downloadCsvBtn).toBeVisible();
    await expect(printPdfBtn).toBeVisible();

    // Parameter Filter Deck
    await expect(page.getByText(/Report Parameters & Scope/i)).toBeVisible();
    await expect(page.getByText(/Audited Officer:/i)).toBeVisible();
    await expect(page.getByText('Strict 9 Ballgames')).toBeVisible();

    // Included modules toggles
    await expect(page.getByRole('button', { name: 'Winning Colleges', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Standings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MVP Records', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Event Participation', exact: true })).toBeVisible();
  });

  test('5. Section 1 (Winning College per Sport per Year) displays structured championship records', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('1. Winning College per Sport per Year')).toBeVisible({ timeout: 10000 });

    // Verify section table columns
    await expect(page.getByRole('columnheader', { name: 'Year' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Sport Discipline' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tournament Event' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Gold \/ Champion College/i })).toBeVisible();
  });

  test('6. Section 2 (Standings) toggles between Team Standings and Athlete Scorers', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('2. Athlete and Team Standings')).toBeVisible({ timeout: 10000 });

    // Initial sub-view is Team Standings
    await expect(page.getByText(/Section 2A: Squad & College Match Standings/i)).toBeVisible();

    // Switch to Athlete Scorers sub-tab
    const athleteTabBtn = page.getByRole('button', { name: /Athlete Scorers/i });
    await expect(athleteTabBtn).toBeVisible();
    await athleteTabBtn.click();

    // Verify sub-view updated
    await expect(page.getByText(/Section 2B: Top Individual Athlete Scorers/i)).toBeVisible();

    // Switch back to Team Standings
    const teamTabBtn = page.getByRole('button', { name: /Team Standings/i });
    await teamTabBtn.click();
    await expect(page.getByText(/Section 2A: Squad & College Match Standings/i)).toBeVisible();
  });

  test('7. Section 3 (MVP Records) and Section 4 (Event Participation) render properly', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Section 3: MVP Records
    await expect(page.getByText('3. Gold Star & Red Star MVP Award Records')).toBeVisible({ timeout: 10000 });

    // Section 4: Event Participation Summaries
    await expect(page.getByText('4. Event Participation Summaries')).toBeVisible();
    await expect(page.getByText(/Summary 4A: Participation Metrics by Official PSU Ballgame Discipline/i)).toBeVisible();
    await expect(page.getByText(/Summary 4B: Institutional College Participation/i)).toBeVisible();
  });

  test('8. Module visibility toggles dynamically show/hide report sections', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Section 3 title is initially visible
    const mvpSectionTitle = page.getByText('3. Gold Star & Red Star MVP Award Records');
    await expect(mvpSectionTitle).toBeVisible({ timeout: 10000 });

    // Toggle off MVP Records
    const mvpToggle = page.getByRole('button', { name: 'MVP Records', exact: true });
    await mvpToggle.click();

    // Section 3 should now be hidden
    await expect(mvpSectionTitle).not.toBeVisible();

    // Toggle it back on
    await mvpToggle.click();
    await expect(mvpSectionTitle).toBeVisible();
  });

  test('9. CSV Download triggers browser file download', async ({ page }) => {
    await page.addInitScript((persona) => {
      localStorage.setItem('psu_dev_impersonated_persona', JSON.stringify(persona));
    }, adminPersona);

    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    const downloadCsvBtn = page.getByRole('button', { name: /Download CSV/i });
    await expect(downloadCsvBtn).toBeEnabled({ timeout: 10000 });

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');
    await downloadCsvBtn.click();
    const download = await downloadPromise;

    // Verify filename format
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^psu-sportstrack-institutional-report-.*\.csv$/);
  });
});
