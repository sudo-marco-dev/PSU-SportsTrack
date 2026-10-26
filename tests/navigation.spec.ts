import { test, expect } from '@playwright/test';

test.describe('Navigation and Layout Suite', () => {
  test('should load the homepage and display PSU SportsTrack branding', async ({ page }) => {
    await page.goto('/');

    // Check page title and primary brand presence
    await expect(page).toHaveTitle(/PSU SportsTrack|SportsTrack/i);

    // Sidebar/Navbar brand text
    const brandElement = page.locator('text=SportsTrack').first();
    await expect(brandElement).toBeVisible();
  });

  test('should open and close the authentication modal on demand', async ({ page }) => {
    await page.goto('/');

    // Locate and click the Log In button
    const loginButton = page.getByRole('button', { name: /Log In/i }).first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // Verify modal dialog appears with Sign In Portal title
    const modalHeading = page.getByRole('heading', { name: /Sign In|Portal/i }).first();
    await expect(modalHeading).toBeVisible();

    // Close the dialog using Escape key
    await page.keyboard.press('Escape');
    await expect(modalHeading).not.toBeVisible();
  });

  test('should navigate between public tabs seamlessly', async ({ page }) => {
    await page.goto('/');

    // Navigate to Match Center
    const matchCenterLink = page.getByRole('link', { name: /Match Center/i }).first();
    await matchCenterLink.click();
    await expect(page).toHaveURL(/\/explorer/);

    // Navigate to Ranking
    const rankingLink = page.getByRole('link', { name: /Ranking/i }).first();
    await rankingLink.click();
    await expect(page).toHaveURL(/\/ranking/);

    // Navigate to About
    const aboutLink = page.getByRole('link', { name: /About/i }).first();
    await aboutLink.click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.locator('text=Digital Arena for').first()).toBeVisible();
  });

  test('should reset to Sign In portal view when closed and reopened after switching to Create Account', async ({ page }) => {
    await page.goto('/');

    // 1. Click Log In in public view
    const loginButton = page.getByRole('button', { name: /Log In/i }).first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // 2. Verify Sign In Portal is displayed
    const signInHeading = page.getByRole('heading', { name: /Sign In/i }).first();
    await expect(signInHeading).toBeVisible();

    // 3. Accidentally click "Create Account"
    const createAccountPrompt = page.getByRole('button', { name: 'Create Account' });
    await expect(createAccountPrompt).toBeVisible();
    await createAccountPrompt.click();

    // 4. Verify Create Account view is shown
    const createAccountHeading = page.getByRole('heading', { name: /Create.*Account/i }).first();
    await expect(createAccountHeading).toBeVisible();

    // 5. Press the X button at the top
    const closeButton = page.locator('[data-slot="dialog-close"]').first();
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    // 6. Verify back to public view and modal is hidden
    await expect(createAccountHeading).not.toBeVisible();

    // 7. Click Log In again
    await loginButton.click();

    // 8. Must show Sign In Portal, NOT Create Account!
    await expect(signInHeading).toBeVisible();
    await expect(createAccountHeading).not.toBeVisible();
  });
});
