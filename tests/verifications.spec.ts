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

    // Expect to be redirected to home page or login prompt because not admin
    await page.waitForURL('**/');
    await expect(page).toHaveURL(/\/$/);
  });

  test('should enforce strict PDF-only policy for Student Athlete COR submissions and reject PNG, JPG, WEBP', async ({ page }) => {
    const playerId = 'test-student-id-1234';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: playerId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'student.athlete@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Juan Dela Cruz' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-player-token-valid-for-tests',
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
          id: playerId,
          full_name: 'Juan Dela Cruz',
          role: 'player_student',
          is_verified: false,
          account_status: 'active',
          student_number: '2023-12345',
        }),
      });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.goto('/player');
    await page.waitForLoadState('networkidle');

    // Verify input label does not offer ID image
    await expect(page.getByText('Certificate of Registration (PDF)', { exact: true })).toBeVisible();
    await expect(page.getByText('Certificate of Registration (PDF) or Official ID Image')).not.toBeVisible();

    // Verify formats notice displays Official PDF (.pdf) and excludes PNG, JPG, WEBP
    const formatNotice = page.locator('text=/Formats: Official PDF/i');
    await expect(formatNotice).toBeVisible();
    await expect(formatNotice).not.toContainText('PNG');
    await expect(formatNotice).not.toContainText('JPG');
    await expect(formatNotice).not.toContainText('WEBP');

    // Verify file input strictly specifies .pdf and application/pdf accept
    const fileInput = page.locator('input#cor');
    await expect(fileInput).toBeVisible();
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('.pdf');
    expect(acceptAttr).toContain('application/pdf');
    expect(acceptAttr).not.toContain('image/png');
    expect(acceptAttr).not.toContain('image/jpeg');
    expect(acceptAttr).not.toContain('image/webp');

    // Attempt to upload PNG image
    await fileInput.setInputFiles({
      name: 'cor_photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock png bytes'),
    });

    // Verify rejection toast specifically requiring official digital PDF
    await expect(page.getByText(/Certificate of Registration \(COR\) verification strictly accepts official digital PDF documents \(\.pdf\) only/i).first()).toBeVisible();

    // Attempt to upload JPG image
    await fileInput.setInputFiles({
      name: 'cor_photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('mock jpg bytes'),
    });
    await expect(page.getByText(/Certificate of Registration \(COR\) verification strictly accepts official digital PDF documents \(\.pdf\) only/i).first()).toBeVisible();

    // Attempt to upload WEBP image
    await fileInput.setInputFiles({
      name: 'cor_photo.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from('mock webp bytes'),
    });
    await expect(page.getByText(/Certificate of Registration \(COR\) verification strictly accepts official digital PDF documents \(\.pdf\) only/i).first()).toBeVisible();
  });
});
