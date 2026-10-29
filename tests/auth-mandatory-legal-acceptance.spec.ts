import { test, expect, type Page } from '@playwright/test';

async function scrollLegalModalToAcceptance(page: Page) {
  const scrollContainer = page.getByTestId('modal-legal-scroll-container');
  // Scroll Terms to 100%
  await scrollContainer.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });

  // Advance to Privacy
  const nextBtn = page.getByTestId('modal-next-read-privacy-btn');
  await expect(nextBtn).toBeVisible();
  await nextBtn.click();

  // Scroll Privacy to 100%
  await scrollContainer.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });

  // Check both checkboxes
  const termsCheckbox = page.getByTestId('modal-legal-terms-checkbox');
  const privacyCheckbox = page.getByTestId('modal-legal-privacy-checkbox');
  await expect(termsCheckbox).toBeEnabled();
  await expect(privacyCheckbox).toBeEnabled();

  await termsCheckbox.click();
  await privacyCheckbox.click();
}

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

    // Verify mandatory legal modal immediately pops up without page redirect
    await expect(page).toHaveURL(/\/register$/);
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();

    // Verify Accept button is initially disabled
    await expect(acceptBtn).toBeDisabled();

    // Checkboxes are initially disabled before scrolling
    const termsCheckbox = page.getByTestId('modal-legal-terms-checkbox');
    const privacyCheckbox = page.getByTestId('modal-legal-privacy-checkbox');
    await expect(termsCheckbox).toBeDisabled();
    await expect(privacyCheckbox).toBeDisabled();

    // Step 1: Scroll Terms to bottom
    const scrollContainer = page.getByTestId('modal-legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Terms checkbox is now unlocked and enabled!
    await expect(termsCheckbox).toBeEnabled();
    await termsCheckbox.click();
    await expect(acceptBtn).toBeDisabled(); // Privacy not yet scrolled/accepted

    // Step 2: Advance to Privacy tab
    const nextBtn = page.getByTestId('modal-next-read-privacy-btn');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Scroll Privacy container to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Privacy checkbox is now enabled!
    await expect(privacyCheckbox).toBeEnabled();
    await privacyCheckbox.click();
    await expect(acceptBtn).toBeEnabled();

    // Click Decline & Cancel to test cancellation flow
    const declineBtn = page.getByTestId('modal-legal-decline-btn');
    await declineBtn.click();

    // Modal should close and user remains on register page
    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
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
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();

    // Complete scroll gating and accept
    await scrollLegalModalToAcceptance(page);
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
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();
    await expect(acceptBtn).toBeDisabled();

    // Complete scroll gating and accept
    await scrollLegalModalToAcceptance(page);
    await expect(acceptBtn).toBeEnabled();

    // Accept & Continue
    await acceptBtn.click();
    await expect(acceptBtn).not.toBeVisible();

    // Transition to OTP verification inside modal
    const otpHeading = page.getByRole('heading', { name: /ENTER OTP CODE/i });
    await expect(otpHeading).toBeVisible({ timeout: 10000 });
  });

  test('should open in-context modal directly when clicking unchecked terms checkbox on /register without redirecting to /legal', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Tap the unchecked terms checkbox
    const regCheckbox = page.getByTestId('register-terms-checkbox');
    await expect(regCheckbox).toBeVisible();
    await regCheckbox.click();

    // Verify modal pops up in-place, URL stays /register
    await expect(page).toHaveURL(/\/register$/);
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();

    // Complete scroll gating and accept
    await scrollLegalModalToAcceptance(page);
    await acceptBtn.click();

    // Modal closes, user is still on /register, and checkbox is checked in-place
    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId('register-terms-checkbox')).toHaveAttribute('data-checked', '');
  });

  test('should open in-context modal directly when clicking unchecked terms checkbox in LoginModal without redirecting to /legal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open Login Modal and switch to Create Account
    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Create Account/i }).click();

    // Tap the unchecked terms checkbox inside LoginModal
    const modalCheckbox = page.getByTestId('modal-register-terms-checkbox');
    await expect(modalCheckbox).toBeVisible();
    await modalCheckbox.click();

    // Verify modal pops up in-place, URL stays /
    await expect(page).toHaveURL(/\/$/);
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();

    // Complete scroll gating and accept
    await scrollLegalModalToAcceptance(page);
    await acceptBtn.click();

    // Modal closes, LoginModal remains open in Create Account view, and checkbox is checked in-place
    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('modal-register-terms-checkbox')).toHaveAttribute('data-checked', '');
  });

  test('should default checkboxes to collapsed on mobile (<640px) and auto-expand upon 100% reading progress', async ({ page }) => {
    // Set viewport to mobile phone width (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Trigger legal modal via Complete Registration
    await page.locator('input[placeholder="Dela Cruz"]').fill('Mobile');
    await page.locator('input[placeholder="Juan"]').fill('Tester');
    await page.locator('input[type="email"]').fill('mobile.test@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuSports#2026!');
    await passwordInputs.nth(1).fill('PsuSports#2026!');
    await page.getByRole('button', { name: /Complete Registration/i }).click();

    // Verify modal is open
    const toggleBtn = page.getByTestId('modal-legal-toggle-footer-btn');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText(/Expand/i);

    // Verify checkboxes container is collapsed (hidden) initially to maximize reading space
    const termsCheckbox = page.getByTestId('modal-legal-terms-checkbox');
    await expect(termsCheckbox).not.toBeVisible();

    // Scroll Terms to 100%
    const scrollContainer = page.getByTestId('modal-legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Still collapsed while only terms is read
    await expect(termsCheckbox).not.toBeVisible();

    // Advance to Privacy tab
    const nextBtn = page.getByTestId('modal-next-read-privacy-btn');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Scroll Privacy to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Checkboxes should auto-expand once both reach 100%
    await expect(termsCheckbox).toBeVisible({ timeout: 5000 });
    const privacyCheckbox = page.getByTestId('modal-legal-privacy-checkbox');
    await expect(privacyCheckbox).toBeVisible();
    await expect(toggleBtn).toContainText(/Collapse/i);

    // Can manually toggle collapsed/expanded
    await toggleBtn.click();
    await expect(termsCheckbox).not.toBeVisible();
    await toggleBtn.click();
    await expect(termsCheckbox).toBeVisible();
  });
});
