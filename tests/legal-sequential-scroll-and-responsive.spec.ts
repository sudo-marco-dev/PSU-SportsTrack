import { test, expect } from '@playwright/test';

test.describe('Sequential Legal Scroll Verification, Form Persistence & Multi-Device Responsive UX', () => {
  test('/register: clicking unchecked Terms checkbox saves form state, redirects to /legal, enforces sequential scroll-to-bottom, and restores form on accept without premature submit', async ({
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

    // 3. Should redirect to full-page /legal in acceptance mode
    await expect(page).toHaveURL(/\/legal\?mode=accept&from=register&tab=terms/);

    // 4. Verify slim collapsible sticky bottom bar is visible and compact while reading
    const stickyBar = page.getByTestId('legal-sticky-bottom-bar');
    await expect(stickyBar).toBeVisible();
    const initialBarBox = await stickyBar.boundingBox();
    expect(initialBarBox).not.toBeNull();
    expect(initialBarBox!.height).toBeLessThanOrEqual(72);

    // 5. Expand drawer manually to verify both checkboxes and accept button are strictly disabled before scrolling
    await page.getByTestId('toggle-legal-drawer-btn').click();
    const termsCheckbox = page.getByTestId('legal-terms-checkbox');
    const privacyCheckbox = page.getByTestId('legal-privacy-checkbox');
    const acceptBtn = page.getByTestId('legal-accept-btn');

    await expect(termsCheckbox).toBeDisabled();
    await expect(privacyCheckbox).toBeDisabled();
    await expect(acceptBtn).toBeDisabled();

    // Collapse drawer again while reading
    await page.getByTestId('toggle-legal-drawer-btn').click();

    // 6. Step 1: Scroll Terms & Conditions container to 100%
    const scrollContainer = page.getByTestId('legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    await expect(stickyBar).toContainText('Terms: 100%');

    // Click "Next: Read Privacy Policy" button at the bottom of Terms
    const nextPrivacyBtn = page.getByTestId('next-read-privacy-btn');
    await expect(nextPrivacyBtn).toBeVisible();
    await nextPrivacyBtn.click();

    // Verify we are now on Privacy Policy tab and Privacy checkbox is still locked until scrolled
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();

    // 7. Step 2: Scroll Privacy Policy container to 100%
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    await expect(stickyBar).toContainText('Privacy: 100%');

    // Drawer should auto-expand once both reach 100%, and both checkboxes should now be enabled
    await expect(termsCheckbox).toBeEnabled();
    await expect(privacyCheckbox).toBeEnabled();
    await expect(acceptBtn).toBeDisabled(); // Still disabled until user checks both boxes

    // 8. Check both checkboxes
    await termsCheckbox.click();
    await expect(acceptBtn).toBeDisabled(); // Still disabled with only 1 checked
    await privacyCheckbox.click();
    await expect(acceptBtn).toBeEnabled();

    // 9. Click "Accept & Return to Registration"
    await acceptBtn.click();

    // 10. Verify navigation back to /register with all form fields preserved and checkbox checked without premature submit
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Santos');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Miguel');
    await expect(page.locator('input[type="email"]')).toHaveValue('miguel.santos@psu.palawan.edu.ph');
    await expect(passwordInputs.nth(0)).toHaveValue('StrongPass123!');
    await expect(passwordInputs.nth(1)).toHaveValue('StrongPass123!');

    // Checkbox on /register is now checked (data-checked attribute present on @base-ui Checkbox)
    await expect(page.getByTestId('register-terms-checkbox')).toHaveAttribute('data-checked', '');
    // Complete Registration button is still visible (form was not prematurely submitted)
    await expect(page.getByRole('button', { name: /Complete Registration/i })).toBeVisible();
  });

  test('LoginModal Sign-Up view: clicking unchecked Terms checkbox saves modal draft, redirects to /legal, and re-opens Sign-Up modal with fields restored upon acceptance', async ({
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

    // 4. Verify redirect to /legal with from=login-modal
    await expect(page).toHaveURL(/\/legal\?mode=accept&from=login-modal/);

    // 5. Scroll Terms to 100%, advance to Privacy, scroll Privacy to 100%, check both boxes, and accept
    const scrollContainer = page.getByTestId('legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.getByTestId('next-read-privacy-btn').click();
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    await page.getByTestId('legal-terms-checkbox').click();
    await page.getByTestId('legal-privacy-checkbox').click();
    await page.getByTestId('legal-accept-btn').click();

    // 6. Verify return to / and automatic re-opening of LoginModal in Create Account mode with fields restored & checkbox checked
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
      await page.goto('/legal?mode=accept&from=register');
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

  test('LoginModal Sign-Up view: pressing native browser Back button from /legal re-opens Sign-Up modal with draft fields preserved', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.getByRole('button', { name: /Log In/i }).first().click();
    await page.getByRole('button', { name: /Create Account/i }).click();

    await page.locator('input[placeholder="Dela Cruz"]').fill('Bautista');
    await page.locator('input[placeholder="Juan"]').fill('Carlo');
    await page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]').fill('carlo.b@psu.palawan.edu.ph');

    await page.getByTestId('modal-register-terms-checkbox').click();
    await expect(page).toHaveURL(/\/legal\?mode=accept&from=login-modal/);
    await expect(page.getByRole('heading', { name: /Official Legal & Governance Policies/i })).toBeVisible();

    // Press the browser's native Back button instead of in-page buttons
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    // LoginModal must automatically re-open on Create Account view with draft fields intact
    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.locator('input[placeholder="Dela Cruz"]')).toHaveValue('Bautista');
    await expect(page.locator('input[placeholder="Juan"]')).toHaveValue('Carlo');
    await expect(page.locator('input[placeholder="202381234@psu.palawan.edu.ph"]')).toHaveValue('carlo.b@psu.palawan.edu.ph');
    // Since user backed out without accepting, checkbox remains unchecked
    await expect(page.getByTestId('modal-register-terms-checkbox')).not.toHaveAttribute('data-checked', '');
  });

  test('/legal orientation change & FacilitatorKiosk tablet/short-screen responsiveness', async ({
    page,
  }) => {
    // 1. Start in portrait (375x667) on /legal and scroll partway
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/legal?mode=accept&from=register');

    const scrollContainer = page.getByTestId('legal-scroll-container');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * 0.45);
      el.dispatchEvent(new Event('scroll'));
    });

    const stickyBar = page.getByTestId('legal-sticky-bottom-bar');
    await expect(stickyBar).not.toContainText('Terms: 0%');

    // Rotate to landscape (667x375) and back to tall tablet (768x1024)
    await page.setViewportSize({ width: 667, height: 375 });
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(stickyBar).toBeVisible();

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

