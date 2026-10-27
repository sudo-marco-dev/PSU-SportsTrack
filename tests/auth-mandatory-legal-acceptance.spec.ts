import { test, expect } from '@playwright/test';

test.describe('Mandatory Terms & Privacy Policy Pop-up on Account Creation', () => {
  test('should mandatorily pop up legal modal upon clicking Complete Registration on /register', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Fill valid registration fields
    await page.locator('input[placeholder="Dela Cruz"]').fill('Reyes');
    await page.locator('input[placeholder="Juan"]').fill('Maria');
    await page.locator('input[type="email"]').fill('test.student@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuSports#2026!');
    await passwordInputs.nth(1).fill('PsuSports#2026!');

    // Do NOT check the terms checkbox
    // Click Complete Registration submit button
    const submitBtn = page.getByRole('button', { name: /Complete Registration/i });
    await submitBtn.click();

    // Verify mandatory legal modal immediately pops up
    const acceptBtn = page.getByRole('button', { name: /Accept & Continue Registration/i });
    await expect(acceptBtn).toBeVisible();

    // Verify Accept button is initially disabled
    await expect(acceptBtn).toBeDisabled();

    // Verify the two explicit checkboxes inside the modal
    const termsCheck = page.locator('label').filter({ hasText: /Terms and Conditions of Palawan State University/i });
    const privacyCheck = page.locator('label').filter({ hasText: /Privacy Policy in accordance with Philippine RA 10173/i });

    await expect(termsCheck).toBeVisible();
    await expect(privacyCheck).toBeVisible();

    // Check only the Terms checkbox -> Accept button should remain disabled
    await termsCheck.click();
    await expect(acceptBtn).toBeDisabled();

    // Switch between tabs inside modal to review Privacy Policy
    const privacyTab = page.getByRole('tab', { name: /Privacy Policy/i });
    await privacyTab.click();
    await expect(page.locator('text=Philippine Data Privacy Act of 2012').first()).toBeVisible();

    // Check the Privacy Policy checkbox -> Accept button should now be enabled!
    await privacyCheck.click();
    await expect(acceptBtn).toBeEnabled();

    // Click Decline & Cancel to test cancellation flow
    const declineBtn = page.getByRole('button', { name: /Decline & Cancel/i });
    await declineBtn.click();

    // Modal should close and user remains on register page
    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should accept both terms & privacy and seamlessly proceed to OTP verification', async ({ page }) => {
    // Intercept Supabase Auth signup call to simulate email confirmation flow (session: null)
    await page.route('**/auth/v1/signup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-legal-user-uuid',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'legal.test@psu.palawan.edu.ph',
          confirmation_sent_at: new Date().toISOString(),
          user_metadata: {
            full_name: 'Santos, Elena',
            role: 'player_student',
            terms_accepted_at: new Date().toISOString(),
          },
          session: null,
        }),
      });
    });

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Fill valid registration fields
    await page.locator('input[placeholder="Dela Cruz"]').fill('Santos');
    await page.locator('input[placeholder="Juan"]').fill('Elena');
    await page.locator('input[type="email"]').fill('legal.test@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuSports#2026!');
    await passwordInputs.nth(1).fill('PsuSports#2026!');

    // Click Complete Registration
    await page.getByRole('button', { name: /Complete Registration/i }).click();

    // Verify modal pops up
    const acceptBtn = page.getByRole('button', { name: /Accept & Continue Registration/i });
    await expect(acceptBtn).toBeVisible();

    // Check both checkboxes
    const termsCheck = page.locator('label').filter({ hasText: /Terms and Conditions of Palawan State University/i });
    const privacyCheck = page.locator('label').filter({ hasText: /Privacy Policy in accordance with Philippine RA 10173/i });

    await termsCheck.click();
    await privacyCheck.click();
    await expect(acceptBtn).toBeEnabled();

    // Click Accept & Continue Registration
    await acceptBtn.click();

    // Modal should close and proceed to OTP verification step
    await expect(acceptBtn).not.toBeVisible();

    // Verify transition to 8-digit OTP step
    const otpHeading = page.getByRole('heading', { name: /ENTER OTP CODE/i });
    await expect(otpHeading).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=legal.test@psu.palawan.edu.ph')).toBeVisible();
  });

  test('should mandatorily pop up legal modal in LoginModal register view', async ({ page }) => {
    // Intercept Supabase Auth signup call
    await page.route('**/auth/v1/signup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-modal-legal-user-uuid',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'modal.legal@psu.palawan.edu.ph',
          confirmation_sent_at: new Date().toISOString(),
          user_metadata: {
            full_name: 'Mendoza, Carlos',
            role: 'player_student',
            terms_accepted_at: new Date().toISOString(),
          },
          session: null,
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open Login Modal
    await page.getByRole('button', { name: /Log In/i }).first().click();

    // Switch to Register / Create Account mode
    const createAccountTab = page.getByRole('button', { name: /Create Account/i }).first();
    await createAccountTab.click();

    // Fill register form inside modal
    await page.locator('input[placeholder="Dela Cruz"]').fill('Mendoza');
    await page.locator('input[placeholder="Juan"]').fill('Carlos');
    await page.locator('input[type="email"]').last().fill('modal.legal@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuSports#2026!');
    await passwordInputs.nth(1).fill('PsuSports#2026!');

    // Click Create Account submit button without checking terms
    const submitAccountBtn = page.getByRole('button', { name: /^Create Account$/i }).last();
    await submitAccountBtn.click();

    // Verify mandatory legal modal appears
    const acceptBtn = page.getByRole('button', { name: /Accept & Continue Registration/i });
    await expect(acceptBtn).toBeVisible();
    await expect(acceptBtn).toBeDisabled();

    // Check both
    const termsCheck = page.locator('label').filter({ hasText: /Terms and Conditions of Palawan State University/i });
    const privacyCheck = page.locator('label').filter({ hasText: /Privacy Policy in accordance with Philippine RA 10173/i });

    await termsCheck.click();
    await privacyCheck.click();
    await expect(acceptBtn).toBeEnabled();

    // Accept & Continue
    await acceptBtn.click();
    await expect(acceptBtn).not.toBeVisible();

    // Transition to OTP verification inside modal
    const otpHeading = page.getByRole('heading', { name: /ENTER OTP CODE/i });
    await expect(otpHeading).toBeVisible({ timeout: 10000 });
  });
});
