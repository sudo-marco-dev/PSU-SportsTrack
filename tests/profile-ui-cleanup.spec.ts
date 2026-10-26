import { test, expect } from '@playwright/test';

test.describe('Profile UI Cleanup & In-Profile Password Reset Suite', () => {
  test('should render clean profile UI without icon-stuffed labels and without duplicate clearance upload', async ({ page }) => {
    const playerId = 'test-player-cleanup-123';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: playerId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'student.athlete@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Maria Santos' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-player-token-cleanup',
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
          full_name: 'Maria Santos',
          role: 'player_student',
          college_id: 'col-1',
          college_name: 'College of Sciences (CS)',
          student_number: '2023-8-0999',
          program: 'BS Computer Science',
          year_level: 'Third Year',
          age: 21,
          is_verified: false,
        }),
      });
    });

    await page.route('**/rest/v1/verification_documents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'doc-rejected-1',
            user_id: playerId,
            status: 'Rejected',
            rejection_reason: 'Non-parsable file (Image converted to PDF)',
            confidence_score: 15,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/colleges*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'col-1', college_name: 'College of Sciences (CS)' }]),
      });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    // Navigate to Profile page
    await page.goto('/profile');

    // Click on Account & Prefs tab
    const accountTab = page.getByRole('tab', { name: /Account/i });
    await expect(accountTab).toBeVisible();
    await accountTab.click();

    // 1. Verify that duplicate file upload form (VerificationUpload) is NOT rendered on Profile
    // There should be NO file input for certificate of registration
    const fileInputs = page.locator('input[type="file"]');
    await expect(fileInputs).toHaveCount(0);

    // 2. Verify that the clean read-only clearance status card is rendered with link to dashboard
    await expect(page.getByText('Previous Clearance Rejected')).toBeVisible();
    await expect(page.getByText('Non-parsable file (Image converted to PDF)')).toBeVisible();
    await expect(page.getByRole('button', { name: /Submit Replacement Document on Dashboard/i })).toBeVisible();

    // 3. Verify clean form labels without prepended icons
    const studentNumberLabel = page.locator('label[for="studentNumber"]');
    await expect(studentNumberLabel).toHaveText('Student Number');
    // Ensure no SVG icon is inside the label
    await expect(studentNumberLabel.locator('svg')).toHaveCount(0);

    const programLabel = page.locator('label[for="program"]');
    await expect(programLabel).toHaveText('Degree Program');
    await expect(programLabel.locator('svg')).toHaveCount(0);

    const yearLevelLabel = page.locator('label[for="yearLevel"]');
    await expect(yearLevelLabel).toHaveText('Year Level');
    await expect(yearLevelLabel.locator('svg')).toHaveCount(0);

    const ageLabel = page.locator('label[for="age"]');
    await expect(ageLabel).toHaveText('Athlete Age');
    await expect(ageLabel.locator('svg')).toHaveCount(0);

    // 4. Verify presence of Security & Password card directly in Profile
    await expect(page.getByText('Security & Password')).toBeVisible();
    await expect(page.getByText('Update account password directly without logging out')).toBeVisible();

    const newPasswordInput = page.locator('#profile-new-password');
    const confirmPasswordInput = page.locator('#profile-confirm-password');
    const submitBtn = page.getByRole('button', { name: 'Update Password' });

    await expect(newPasswordInput).toBeVisible();
    await expect(confirmPasswordInput).toBeVisible();
    // Submit button should be disabled initially
    await expect(submitBtn).toBeDisabled();

    // Type weak password
    await newPasswordInput.fill('weak');
    await confirmPasswordInput.fill('weak');
    await expect(page.getByText('Password Security Policy')).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Type valid institutional policy password
    await newPasswordInput.fill('SportsTrack2026!');
    await confirmPasswordInput.fill('SportsTrack2026!');

    // Password policy criteria should pass and submit button should be enabled
    await expect(submitBtn).toBeEnabled();
  });

  test('should provide direct password reset card on coach profile view', async ({ page }) => {
    const coachId = 'test-coach-cleanup-456';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: coachId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'coach.ramirez@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Coach Ricardo Ramirez' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-coach-token-cleanup',
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
          id: coachId,
          full_name: 'Ricardo Ramirez',
          role: 'coach',
          college_name: 'College of Arts and Humanities (CAH)',
          is_verified: true,
        }),
      });
    });

    await page.route('**/rest/v1/teams*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/team_roster*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.goto('/profile');

    // Verify coach header
    await expect(page.getByText('ATHLETIC STAFF • LEAD COACH')).toBeVisible();

    // Verify Security & Password card is present
    await expect(page.getByText('Security & Password')).toBeVisible();
    await expect(page.locator('#profile-new-password')).toBeVisible();
    await expect(page.locator('#profile-confirm-password')).toBeVisible();
  });
});
