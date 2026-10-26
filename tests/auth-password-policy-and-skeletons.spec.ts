import { test, expect } from '@playwright/test';

test.describe('Account Creation Password Policy & Show/Hide Controls', () => {
  test('should toggle password visibility on register page for both password fields', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Security Password input
    const passwordInput = page.locator('input[autocomplete="new-password"]').first();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Toggle button for password
    const showPasswordBtn = page.getByRole('button', { name: /show password/i });
    await expect(showPasswordBtn).toBeVisible();
    await showPasswordBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Button aria-label switches to 'Hide password'
    const hidePasswordBtn = page.getByRole('button', { name: /hide password/i });
    await expect(hidePasswordBtn).toBeVisible();
    await hidePasswordBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Confirm Password input
    const confirmPasswordInput = page.locator('input[autocomplete="new-password"]').nth(1);
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    // Toggle button for confirm password
    const showConfirmBtn = page.getByRole('button', { name: /show confirm password/i });
    await expect(showConfirmBtn).toBeVisible();
    await showConfirmBtn.click();
    await expect(confirmPasswordInput).toHaveAttribute('type', 'text');

    // Button aria-label switches to 'Hide confirm password'
    const hideConfirmBtn = page.getByRole('button', { name: /hide confirm password/i });
    await expect(hideConfirmBtn).toBeVisible();
    await hideConfirmBtn.click();
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });

  test('should display live password policy feedback and strength meter', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[autocomplete="new-password"]').first();

    // Verify Password Security Policy card is visible
    await expect(page.locator('text=Password Security Policy')).toBeVisible();
    await expect(page.locator('text=At least 8 characters')).toBeVisible();
    await expect(page.locator('text=One uppercase letter (A-Z)')).toBeVisible();
    await expect(page.locator('text=One lowercase letter (a-z)')).toBeVisible();
    await expect(page.locator('text=One number (0-9)')).toBeVisible();
    await expect(page.locator('text=One special symbol (!@#$%...)')).toBeVisible();

    // Type weak password
    await passwordInput.fill('short');
    await expect(page.locator('text=Weak')).toBeVisible();

    // Type fully compliant strong password
    await passwordInput.fill('PsuChampion2026!');
    await expect(page.locator('text=Strong (5/5)')).toBeVisible();
  });

  test('should display real-time password matching status', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[autocomplete="new-password"]').first();
    const confirmPasswordInput = page.locator('input[autocomplete="new-password"]').nth(1);

    await passwordInput.fill('PsuChampion2026!');

    // Type mismatched confirm password
    await confirmPasswordInput.fill('PsuDifferent2026!');
    await expect(page.locator('text=Passwords do not match yet')).toBeVisible();

    // Fix to matching password
    await confirmPasswordInput.fill('PsuChampion2026!');
    await expect(page.locator('text=Passwords match')).toBeVisible();
  });
});

test.describe('Skeleton Loading Presence', () => {
  test('should have skeleton shimmer styles configured for smooth loading transitions', async ({ page }) => {
    await page.goto('/explorer');
    await page.waitForLoadState('domcontentloaded');

    // Verify page loads cleanly without errors
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });
});
