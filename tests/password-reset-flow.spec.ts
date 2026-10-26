import { test, expect } from '@playwright/test';

test.describe('Password Reset Recovery Flow Suite', () => {
  test('should redirect to /reset-password when verifying recovery token on /auth/confirm', async ({ page }) => {
    // Intercept Supabase verifyOtp call to simulate successful recovery token verification
    await page.route('**/auth/v1/verify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock_recovery_access_token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock_recovery_refresh_token',
          user: {
            id: 'mock-recovery-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'athlete.recovery@psu.palawan.edu.ph',
            email_confirmed_at: '2026-10-26T00:00:00Z',
          },
        }),
      });
    });

    // Navigate to /auth/confirm with recovery parameters
    await page.goto('/auth/confirm?token_hash=mock_recovery_hash&type=recovery');

    // Should display the dedicated recovery authorized state
    await expect(page.locator('text=Password Reset Authorized!')).toBeVisible({ timeout: 5000 });

    // Should redirect automatically to /reset-password
    await page.waitForURL('**/reset-password', { timeout: 6000 });
    expect(page.url()).toContain('/reset-password');
  });

  test('should intercept type=recovery hash on root route and navigate to /reset-password', async ({ page }) => {
    // Simulate user landing on the site root with Supabase hash fragment
    await page.goto('/#access_token=mock_token&refresh_token=mock_refresh&type=recovery');

    // AppRoutes recovery interceptor should catch this and navigate to /reset-password
    await page.waitForURL('**/reset-password**', { timeout: 6000 });
    expect(page.url()).toContain('/reset-password');
  });

  test('should render password creation form and password policy checks on /reset-password', async ({ page }) => {
    await page.goto('/reset-password');

    // If no session and no token, displays the email request form
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Send Reset Link')).toBeVisible();

    // Now visit /reset-password with a simulated recovery hash
    await page.goto('/reset-password#access_token=mock_session_token&type=recovery');

    // Should transition to the "New Password" form
    const passwordInput = page.locator('input[name="password"]');
    const confirmInput = page.locator('input[name="confirmPassword"]');

    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await expect(confirmInput).toBeVisible({ timeout: 5000 });

    // Verify password visibility toggle
    const toggleButton = page.locator('button[aria-label="Show password"]');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('should continue redirecting standard signup confirmations to /', async ({ page }) => {
    await page.route('**/auth/v1/verify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock_signup_access_token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock_signup_refresh_token',
          user: {
            id: 'mock-signup-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'new.student@psu.palawan.edu.ph',
            email_confirmed_at: '2026-10-26T00:00:00Z',
          },
        }),
      });
    });

    await page.goto('/auth/confirm?token_hash=mock_signup_hash&type=signup');

    // Should display Account Confirmed!
    await expect(page.locator('text=Account Confirmed!')).toBeVisible({ timeout: 5000 });

    // Should redirect to root /
    await page.waitForURL('**/', { timeout: 6000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
