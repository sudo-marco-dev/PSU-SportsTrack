import { test, expect } from '@playwright/test';

test.describe('Sequential Legal Scroll Verification, In-Modal Acceptance & Multi-Device Responsive UX', () => {
  test('/register: clicking unchecked Terms checkbox pops up in-context LegalModal directly, enforces sequential scroll-to-bottom, and checks checkbox in-place without page redirect or premature submit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');

    // 1. Fill partial registration form fields before accepting terms
    await page.locator('input[placeholder="Dela Cruz"]').fill('Santos');
    await page.locator('input[placeholder="Juan"]').fill('Miguel');
    await page.locator('input[type="email"]').fill('miguel.santos@psu.palawan.edu.ph');
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await passwordInputs.nth(0).fill('StrongPass123!');
    await passwordInputs.nth(1).fill('StrongPass123!');

    // 2. Tap the unchecked Terms & Conditions checkbox on /register
    const regCheckbox = page.getByTestId('register-terms-checkbox');
    await expect(regCheckbox).toBeVisible();
    await regCheckbox.click();

    // 3. Must NOT redirect to /legal — stays directly on /register with pop-up modal
    await expect(page).toHaveURL(/\/register$/);

    // 4. In-context LegalModal is visible
    const acceptBtn = page.getByTestId('modal-legal-accept-btn');
    await expect(acceptBtn).toBeVisible();
    await expect(acceptBtn).toBeDisabled();

    // Both checkboxes inside modal must be disabled prior to scrolling
    const termsCheckbox = page.getByTestId('modal-legal-terms-checkbox');
    const privacyCheckbox = page.getByTestId('modal-legal-privacy-checkbox');
    await expect(termsCheckbox).toBeDisabled();
    await expect(privacyCheckbox).toBeDisabled();

    // 5. Step 1: Scroll Terms & Conditions container to 100%
    const scrollContainer = page.getByTestId('modal-legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Terms checkbox is now unlocked and enabled!
    await expect(termsCheckbox).toBeEnabled();

    // Click "Next: Read Privacy Policy" button at the bottom of Terms
    const nextPrivacyBtn = page.getByTestId('modal-next-read-privacy-btn');
    await expect(nextPrivacyBtn).toBeVisible();
    await nextPrivacyBtn.click();

    // Verify we are now on Privacy Policy tab inside modal
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    // 6. Step 2: Scroll Privacy Policy container to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Privacy checkbox is now enabled
    await expect(privacyCheckbox).toBeEnabled();
    await expect(acceptBtn).toBeDisabled(); // Still disabled until user checks both boxes

    // 7. Check both checkboxes
    await termsCheckbox.click();
    await expect(acceptBtn).toBeDisabled(); // Still disabled with only 1 checked
    await privacyCheckbox.click();
    await expect(acceptBtn).toBeEnabled();

    // 8. Click "Accept & Continue Registration"
    await acceptBtn.click();

    // 9. Modal closes, user remains on /register with all form fields preserved and checkbox checked in-place without premature submit
    await expect(acceptBtn).not.toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Santos');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Miguel');
    await expect(page.locator('input[type="email"]')).toHaveValue('miguel.santos@psu.palawan.edu.ph');
    await expect(passwordInputs.nth(0)).toHaveValue('StrongPass123!');
    await expect(passwordInputs.nth(1)).toHaveValue('StrongPass123!');

    // Checkbox on /register is now checked in-place
    await expect(page.getByTestId('register-terms-checkbox')).toHaveAttribute('data-checked', '');
    // Complete Registration button is still visible (form was not prematurely submitted)
    await expect(page.getByRole('button', { name: /Complete Registration/i })).toBeVisible();
  });

  test('LoginModal Sign-Up view: clicking unchecked Terms checkbox pops up in-context LegalModal directly, enforces sequential scroll-to-bottom, and checks checkbox in-place without page redirect', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Open LoginModal and switch to Create Account (Sign-Up) mode
    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Create Account/i }).click();

    // 2. Fill partial fields in LoginModal Sign-Up form
    await page.locator('input[placeholder="Dela Cruz"]').fill('Villanueva');
    await page.locator('input[placeholder="Juan"]').fill('Angela');
    await page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]').fill('angela.v@psu.palawan.edu.ph');

    // 3. Tap the unchecked Terms checkbox inside LoginModal
    const modalCheckbox = page.getByTestId('modal-register-terms-checkbox');
    await modalCheckbox.click();

    // 4. Must NOT redirect to /legal — stays directly on / with pop-up modal
    await expect(page).toHaveURL(/\/$/);

    // 5. Scroll Terms to 100%, advance to Privacy, scroll Privacy to 100%, check both boxes, and accept
    const scrollContainer = page.getByTestId('modal-legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.getByTestId('modal-next-read-privacy-btn').click();
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    await page.getByTestId('modal-legal-terms-checkbox').click();
    await page.getByTestId('modal-legal-privacy-checkbox').click();
    await page.getByTestId('modal-legal-accept-btn').click();

    // 6. Verify modal closes, LoginModal remains open in Create Account mode with fields preserved & checkbox checked in-place
    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Villanueva');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Angela');
    await expect(page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]')).toHaveValue('angela.v@psu.palawan.edu.ph');
    await expect(page.getByTestId('modal-register-terms-checkbox')).toHaveAttribute('data-checked', '');
  });

  test('Multi-device & In-App Browser Responsive Verification: Small Phone (320x568), In-App Short Viewport (375x520), and Tablet (768x1024)', async ({
    page,
  }) => {
    const viewports = [
      { name: 'small-phone-se', width: 320, height: 568 },
      { name: 'in-app-browser-short', width: 375, height: 520 },
      { name: 'tablet-portrait', width: 768, height: 1024 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Check /legal layout & no horizontal overflow
      await page.goto('/legal');
      await expect(page.getByRole('heading', { name: /Official Legal & Governance Policies/i })).toBeVisible();
      const legalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      });
      expect(legalOverflow, `Horizontal overflow on /legal at ${vp.name}`).toBe(false);

      // Check /ranking layout & no horizontal overflow
      await page.goto('/ranking');
      await expect(page.getByRole('heading', { name: /LEADERBOARD/i })).toBeVisible();
      const rankingsOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      });
      expect(rankingsOverflow, `Horizontal overflow on /ranking at ${vp.name}`).toBe(false);
    }

    // Also verify LegalModal header Effective badge does not overlap the Close (X) button on mobile
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Terms of Service/i }).click();

    const effectiveText = page.getByText(/Effective: SY 2026-2027/i).first();
    const dialogCloseBtn = page.locator('[data-slot="dialog-close"]').last();
    await expect(effectiveText).toBeVisible();
    await expect(dialogCloseBtn).toBeVisible();

    const effBox = await effectiveText.boundingBox();
    const closeBox = await dialogCloseBtn.boundingBox();
    if (effBox && closeBox) {
      const overlapsHorizontally =
        effBox.x < closeBox.x + closeBox.width && effBox.x + effBox.width > closeBox.x;
      const overlapsVertically =
        effBox.y < closeBox.y + closeBox.height && effBox.y + effBox.height > closeBox.y;
      expect(overlapsHorizontally && overlapsVertically).toBe(false);
    }
  });

  test('/legal page: pure reference document reader without sticky acceptance drawer, and Back/Close returns to previous page without kicking to /register', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 1. Visit /about first so there is a previous history entry
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: /Digital Arena/i })).toBeVisible();

    // 2. Navigate to /legal
    await page.goto('/legal');
    await expect(page.getByRole('heading', { name: /Official Legal & Governance Policies/i })).toBeVisible();

    // 3. Verify sticky bottom acceptance drawer does NOT exist on /legal
    const stickyBar = page.getByTestId('legal-sticky-bottom-bar');
    await expect(stickyBar).not.toBeVisible();
    await expect(page.getByTestId('legal-accept-btn')).not.toBeVisible();
    await expect(page.getByTestId('legal-decline-btn')).not.toBeVisible();
    await expect(page.getByTestId('legal-terms-checkbox')).not.toBeVisible();
    await expect(page.getByTestId('legal-privacy-checkbox')).not.toBeVisible();

    // 4. Tab switching between Terms and Privacy
    const privacyTab = page.getByRole('tab', { name: /Privacy Policy/i });
    await privacyTab.click();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    const termsTab = page.getByRole('tab', { name: /Terms & Conditions/i });
    await termsTab.click();
    await expect(page.getByRole('heading', { name: 'Terms and Conditions' })).toBeVisible();

    // 5. Test "Next: Read Privacy Policy" guided button at bottom of Terms
    const nextPrivacyBtn = page.getByTestId('next-read-privacy-btn');
    await expect(nextPrivacyBtn).toBeVisible();
    await nextPrivacyBtn.click();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    // 6. Test Back button returns user to /about (not /register!)
    const backBtn = page.getByRole('button', { name: /^Back$/i }).first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/\/about$/);

    // 7. Navigate directly to /legal (no history) and click Close button
    await page.goto('/legal');
    const closeBtn = page.getByRole('button', { name: /^Close$/i }).first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    // Must return to home '/' or previous, NEVER /register
    await expect(page).not.toHaveURL(/\/register$/);
  });

  test('/legal orientation change & FacilitatorKiosk tablet/short-screen responsiveness', async ({
    page,
  }) => {
    // 1. Start in portrait (375x667) on /legal and scroll partway
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/legal');

    const scrollContainer = page.getByTestId('legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * 0.45);
      el.dispatchEvent(new Event('scroll'));
    });

    // Rotate to landscape (667x375) and back to tall tablet (768x1024)
    await page.setViewportSize({ width: 667, height: 375 });
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: /Official Legal & Governance Policies/i })).toBeVisible();

    // 2. Verify FacilitatorKiosk on 768x1024 portrait tablet & 375x520 short mobile screen
    await page.route('**/rest/v1/matches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'match-kiosk-test-1',
          round: 'Semifinals',
          status: 'Ongoing',
          team_a_score: 42,
          team_b_score: 39,
          team_a_id: 'team-a-1',
          team_b_id: 'team-b-1',
          team_a: { name: 'CCJE Eagles', college_id: 'col-1' },
          team_b: { name: 'CEAT Titans', college_id: 'col-2' },
          tournament_id: 'tourn-1',
          tournament: { name: 'PSU Intramurals', sport: 'Basketball' },
        }),
      });
    });
    await page.route('**/rest/v1/match_events*', async (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/rest/v1/team_roster*', async (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/match/match-kiosk-test-1/kiosk');
    await expect(page.getByText('CCJE Eagles').first()).toBeVisible();
    await expect(page.getByText('CEAT Titans').first()).toBeVisible();
    // On 768x1024 portrait tablet, the portrait view switcher (Both / Team A / Team B) should be visible
    await expect(page.getByRole('button', { name: 'Both' })).toBeVisible();

    const kioskTabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(kioskTabletOverflow).toBe(false);

    await page.setViewportSize({ width: 375, height: 520 });
    const kioskShortOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(kioskShortOverflow).toBe(false);
  });
});
