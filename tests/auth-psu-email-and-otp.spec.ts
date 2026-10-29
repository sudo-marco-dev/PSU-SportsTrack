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

test.describe('PSU Official Email Domain & OTP Verification Flow', () => {
  test('should reject non-PSU emails and enforce @psu.palawan.edu.ph strictly', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const submitBtn = page.getByRole('button', { name: /complete registration/i });

    // Fill other fields with valid data
    await page.locator('input[placeholder="Dela Cruz"]').fill('Dela Cruz');
    await page.locator('input[placeholder="Juan"]').fill('Juan');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuChampion2026!');
    await passwordInputs.nth(1).fill('PsuChampion2026!');

    // Accept mandatory terms via modal
    await page.getByTestId('register-terms-checkbox').click();
    await scrollLegalModalToAcceptance(page);
    await page.getByTestId('modal-legal-accept-btn').click();

    // 1. Test Gmail
    await emailInput.fill('juan.delacruz@gmail.com');
    await submitBtn.click();
    await expect(page.locator('text=Registration requires an official PSU email address ending with @psu.palawan.edu.ph')).toBeVisible();

    // 2. Test Yahoo
    await emailInput.fill('juan.delacruz@yahoo.com');
    await submitBtn.click();
    await expect(page.locator('text=Registration requires an official PSU email address ending with @psu.palawan.edu.ph')).toBeVisible();

    // 3. Test other university domain
    await emailInput.fill('juan@up.edu.ph');
    await submitBtn.click();
    await expect(page.locator('text=Registration requires an official PSU email address ending with @psu.palawan.edu.ph')).toBeVisible();

    // 4. Test deceptive subdomain / spoofing domain
    await emailInput.fill('juan@psu.palawan.edu.ph.fake.com');
    await submitBtn.click();
    await expect(page.locator('text=Registration requires an official PSU email address ending with @psu.palawan.edu.ph')).toBeVisible();

    // 5. Test valid PSU student email
    await emailInput.fill('202380123@psu.palawan.edu.ph');
    await expect(page.locator('text=Registration requires an official PSU email address ending with @psu.palawan.edu.ph')).not.toBeVisible();

    // 6. Test valid PSU faculty email
    await emailInput.fill('juan.delacruz@psu.palawan.edu.ph');
    await expect(page.locator('text=Registration requires an official PSU email address ending with @psu.palawan.edu.ph')).not.toBeVisible();
  });

  test('should transition to OTP verification view on signup and handle 6-digit input and paste', async ({ page }) => {
    // Intercept Supabase Auth signup call to simulate email confirmation flow (session: null)
    await page.route('**/auth/v1/signup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-uuid-1234',
          aud: 'authenticated',
          role: 'authenticated',
          email: '202380123@psu.palawan.edu.ph',
          confirmation_sent_at: new Date().toISOString(),
          user_metadata: {
            full_name: 'Dela Cruz, Juan',
            role: 'player_student',
          },
          session: null, // Indicates email confirmation is required!
        }),
      });
    });

    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.locator('input[placeholder="Dela Cruz"]').fill('Dela Cruz');
    await page.locator('input[placeholder="Juan"]').fill('Juan');
    await page.locator('input[type="email"]').fill('202380123@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.first().fill('PsuChampion2026!');
    await passwordInputs.nth(1).fill('PsuChampion2026!');
    // Click submit and accept mandatory legal modal
    await page.getByRole('button', { name: /complete registration/i }).click();
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();
    await scrollLegalModalToAcceptance(page);
    await acceptBtn.click();

    // Verify OTP Verification view appears
    await expect(page.locator('text=ENTER OTP CODE')).toBeVisible();
    await expect(page.locator('text=Official University Email Verification')).toBeVisible();
    await expect(page.locator('text=202380123@psu.palawan.edu.ph')).toBeVisible();
    await expect(page.locator('text=Two Ways to Verify:')).toBeVisible();

    // Verify 6 OTP inputs are rendered
    const digitInputs = page.locator('input[inputmode="numeric"]');
    await expect(digitInputs).toHaveCount(6);

    // Verify Resend countdown
    await expect(page.getByText(/resend code in/i)).toBeVisible();

    // Test typing digits sequentially
    await digitInputs.nth(0).fill('9');
    await expect(digitInputs.nth(0)).toHaveValue('9');

    // Test pasting a 6-digit OTP (e.g. 386714)
    await digitInputs.nth(0).evaluate((el) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', '386714');
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(pasteEvent);
    });

    await expect(digitInputs.nth(0)).toHaveValue('3');
    await expect(digitInputs.nth(1)).toHaveValue('8');
    await expect(digitInputs.nth(2)).toHaveValue('6');
    await expect(digitInputs.nth(3)).toHaveValue('7');
    await expect(digitInputs.nth(4)).toHaveValue('1');
    await expect(digitInputs.nth(5)).toHaveValue('4');

    // Test back button returns to the registration form
    const backBtn = page.getByRole('button', { name: /back to registration form/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify we are back on the registration form with values preserved
    await expect(page.locator('text=CREATE AN ACCOUNT')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue('202380123@psu.palawan.edu.ph');
  });

  test('should handle /auth/confirm link error states with clear user guidance', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=invalid_hash_12345&type=signup');
    await page.waitForLoadState('networkidle');

    // Expect error state
    await expect(page.locator('text=Verification Failed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Back to Registration')).toBeVisible();
  });
});
