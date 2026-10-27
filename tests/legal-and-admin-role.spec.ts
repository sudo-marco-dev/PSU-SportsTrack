import { test, expect } from '@playwright/test';
import { formatRole } from '../src/lib/utils';

test.describe('Legal Documents & Admin Role Standardization', () => {
  test('formatRole: should return Admin for both admin and super_admin, never Super Admin', () => {
    expect(formatRole('admin')).toBe('Admin');
    expect(formatRole('super_admin')).toBe('Admin');
    expect(formatRole('Admin')).toBe('Admin');
    expect(formatRole('ADMIN')).toBe('Admin');
  });

  test('Registration page: opens official Terms & Conditions and Privacy Policy modals with official PSU text', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('CREATE AN').first()).toBeVisible();

    // 1. Click Terms & Conditions link in registration form
    const termsLink = page.getByRole('button', { name: /Terms & Conditions/i });
    await expect(termsLink).toBeVisible();
    await termsLink.click();

    // 2. Verify Legal modal appears with Terms & Conditions tab active
    await expect(page.getByRole('heading', { name: /Terms and Conditions/i })).toBeVisible();
    await expect(page.getByText(/Palawan State University • Sports Department/i).first()).toBeVisible();
    await expect(page.getByText(/Official Collegiate Platform Agreement/i)).toBeVisible();
    await expect(page.getByText(/Spectator, Student Athlete, Faculty Athlete, Coach, Court-Side Facilitator, and Administrator/i)).toBeVisible();

    // 3. Switch to Privacy Policy tab within the modal
    const privacyTab = page.getByRole('tab', { name: /Privacy Policy/i });
    await expect(privacyTab).toBeVisible();
    await privacyTab.click();

    // 4. Verify Privacy Policy contents
    await expect(page.getByText(/Philippine Data Privacy Act of 2012/i).first()).toBeVisible();
    await expect(page.getByText(/janiceno@psu.palawan.edu.ph/i).first()).toBeVisible();
    await expect(page.getByText(/Certificate of Registration \(COR\)/i).first()).toBeVisible();

    // 5. Close modal
    const closeBtn = page.getByRole('button', { name: /^Close$/i }).first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.getByRole('heading', { name: /Terms and Conditions/i })).not.toBeVisible();
  });

  test('Login Modal: displays legal links and opens LegalModal', async ({ page }) => {
    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /Log In/i }).first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // Verify modal dialog appears
    await expect(page.getByRole('heading', { name: /Sign In|Portal/i }).first()).toBeVisible();

    // Check footer legal links exist
    const termsLink = page.getByRole('button', { name: /Terms of Service/i });
    await expect(termsLink).toBeVisible();
    await termsLink.click();

    // Verify Legal modal opens
    await expect(page.getByRole('heading', { name: /Terms and Conditions/i })).toBeVisible();
    await expect(page.getByText(/Palawan State University • Sports Department/i).first()).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /^Close$/i }).first().click();
  });

  test('/legal page: renders complete university policies and supports tab query param', async ({ page }) => {
    await page.goto('/legal');
    await expect(page.getByRole('heading', { name: /Official Legal & Governance Policies/i })).toBeVisible();
    await expect(page.getByText(/School Year 2026-2027/i).first()).toBeVisible();

    // Test direct navigation with tab=privacy
    await page.goto('/legal?tab=privacy');
    await expect(page.getByText(/Philippine Data Privacy Act of 2012 \(RA 10173\) Statement/i)).toBeVisible();
    await expect(page.getByText(/janiceno@psu.palawan.edu.ph/i).first()).toBeVisible();
  });

  test('About page: contains Official University Policies banner linking to legal pages', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByText(/Official University Policies & Data Privacy/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Terms & Conditions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Privacy Policy/i })).toBeVisible();
  });

  test('Profile view with role "admin": renders SYSTEM EXECUTIVE • ADMIN and Full Admin Access with zero "Super Admin" wording', async ({ page }) => {
    const adminId = 'admin-user-verify-001';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: adminId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin.sports@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Dr. Ramon Bautista' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-admin-token-valid-for-tests',
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
          full_name: 'Dr. Ramon Bautista',
          role: 'admin',
          is_verified: true,
          account_status: 'active',
          college_name: 'PSU Sports Directorate',
        }),
      });
    });

    await page.route('**/rest/v1/player_stars*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/team_roster*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/colleges*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/tournaments*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/teams*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/audit_logs*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/verification_documents*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.goto('/profile');
    await expect(page.getByText('SYSTEM EXECUTIVE • ADMIN')).toBeVisible();
    await expect(page.getByText('Full Admin Access')).toBeVisible();
    await expect(page.getByText(/Super Admin/i)).not.toBeVisible();
    await expect(page.getByText(/Superuser/i)).not.toBeVisible();

    // Check Settings tab has Legal & Governance Policies card
    const settingsTab = page.getByRole('tab', { name: /Settings/i });
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await expect(page.getByText('Legal & Governance Policies')).toBeVisible();
    }
  });

  test('Admin protected route: allows direct access to /admin when role is "admin"', async ({ page }) => {
    const adminId = 'admin-user-verify-002';
    const futureExpiresAt = Math.floor(Date.now() / 1000) + 7200;
    const mockUser = {
      id: adminId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin.director@psu.palawan.edu.ph',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Admin Director' },
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'fake-admin-token-valid-for-tests',
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
          full_name: 'Admin Director',
          role: 'admin',
          is_verified: true,
          account_status: 'active',
          college_name: 'PSU Sports Directorate',
        }),
      });
    });

    await page.route('**/rest/v1/tournaments*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/teams*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/matches*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/verification_documents*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.addInitScript(({ session }) => {
      localStorage.setItem('sb-kxnkdhznnpwvnljjmfwl-auth-token', JSON.stringify(session));
    }, { session: mockSession });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText(/Superadmin/i)).not.toBeVisible();
    await expect(page.getByText(/Super Admin/i)).not.toBeVisible();
  });
});
