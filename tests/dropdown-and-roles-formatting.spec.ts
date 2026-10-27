import { test, expect } from '@playwright/test';
import { formatRole, formatSelectValue } from '../src/lib/utils';

test.describe('Role & Enum Formatting Engine Tests', () => {
  test('formatRole: should convert raw role enums into human-readable titles', () => {
    expect(formatRole('player_student')).toBe('Student Athlete');
    expect(formatRole('player_faculty')).toBe('Faculty Athlete');
    expect(formatRole('player_staff')).toBe('Staff Athlete');
    expect(formatRole('coach')).toBe('Athletic Coach');
    expect(formatRole('facilitator')).toBe('Facilitator');
    expect(formatRole('admin')).toBe('Admin');
    expect(formatRole('super_admin')).toBe('Admin');
    expect(formatRole('official')).toBe('Match Official');
    expect(formatRole('dev')).toBe('Developer');
    expect(formatRole(null)).toBe('Spectator');
    expect(formatRole(undefined)).toBe('Spectator');
    expect(formatRole('')).toBe('Spectator');
  });

  test('formatRole: should convert arbitrary snake_case strings to Title Case', () => {
    expect(formatRole('custom_tournament_coordinator')).toBe('Custom Tournament Coordinator');
    expect(formatRole('guest_speaker_lead')).toBe('Guest Speaker Lead');
  });

  test('formatSelectValue: should format known enums and remove underscores', () => {
    expect(formatSelectValue('player_student')).toBe('Student Athlete');
    expect(formatSelectValue('player_faculty')).toBe('Faculty Athlete');
    expect(formatSelectValue('player_staff')).toBe('Staff Athlete');
    expect(formatSelectValue('coach')).toBe('Athletic Coach');
    expect(formatSelectValue('single_elimination')).toBe('Single Elimination');
    expect(formatSelectValue('double_elimination')).toBe('Double Elimination');
    expect(formatSelectValue('round_robin')).toBe('Round Robin');
    expect(formatSelectValue('active')).toBe('Active');
    expect(formatSelectValue('injured')).toBe('Injured');
    expect(formatSelectValue('benched')).toBe('Benched');
    expect(formatSelectValue('soft_deleted')).toBe('Soft Deleted');
    expect(formatSelectValue('')).toBe('');
    expect(formatSelectValue(null)).toBe('');
    expect(formatSelectValue(undefined)).toBe('');
  });
});

test.describe('Registration Page Role Dropdown & Non-Overlapping Verification', () => {
  test('should display formatted role in input trigger without raw underscores', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('CREATE AN').first()).toBeVisible();

    // Verify role select dropdown trigger exists
    const roleSelect = page.getByRole('combobox').first();
    await expect(roleSelect).toBeVisible();

    // Default must show "Student Athlete" - never "player_student"
    await expect(roleSelect).toContainText('Student Athlete');
    await expect(roleSelect).not.toContainText('player_student');

    // Open dropdown
    await roleSelect.click();

    // Verify options are visible and formatted
    await expect(page.getByRole('option', { name: 'Student Athlete' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Faculty Athlete' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Staff Athlete' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Athletic Coach' })).toBeVisible();

    // Select Faculty Athlete
    await page.getByRole('option', { name: 'Faculty Athlete' }).click();
    await expect(roleSelect).toContainText('Faculty Athlete');
    await expect(roleSelect).not.toContainText('player_faculty');

    // Select Athletic Coach
    await roleSelect.click();
    await page.getByRole('option', { name: 'Athletic Coach' }).click();
    await expect(roleSelect).toContainText('Athletic Coach');
    await expect(roleSelect).not.toContainText('coach_');
  });

  test('should position dropdown content without overlapping trigger field', async ({ page }) => {
    await page.goto('/register');
    const roleSelect = page.getByRole('combobox').first();
    await expect(roleSelect).toBeVisible();

    const triggerBoxBefore = await roleSelect.boundingBox();
    expect(triggerBoxBefore).not.toBeNull();

    // Open dropdown
    await roleSelect.click();
    const dropdownPopup = page.locator('[data-slot="select-content"][data-open]');
    await expect(dropdownPopup).toBeVisible();

    const popupBox = await dropdownPopup.boundingBox();
    const triggerBoxAfter = await roleSelect.boundingBox();
    expect(popupBox).not.toBeNull();
    expect(triggerBoxAfter).not.toBeNull();

    if (popupBox && triggerBoxAfter) {
      // The popup must be positioned below the trigger (or above if flipped), NOT overlapping the trigger center
      const isBelow = popupBox.y >= triggerBoxAfter.y + triggerBoxAfter.height - 2;
      const isAbove = popupBox.y + popupBox.height <= triggerBoxAfter.y + 2;
      expect(isBelow || isAbove).toBe(true);
    }
  });
});

test.describe('Login Modal Create Account Role & Department Dropdowns', () => {
  test('should display formatted roles and non-overlapping Department dropdown in LoginModal', async ({ page }) => {
    await page.goto('/');

    // Locate and click Log In button
    const loginButton = page.getByRole('button', { name: /Log In/i }).first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // Verify modal dialog appears
    const modalHeading = page.getByRole('heading', { name: /Sign In|Portal/i }).first();
    await expect(modalHeading).toBeVisible();

    // Switch to "Create Account"
    const createAccountBtn = page.getByRole('button', { name: 'Create Account' });
    await createAccountBtn.click();

    // Locate Role Select in modal
    const roleSelect = page.locator('[data-slot="select-trigger"]').first();
    await expect(roleSelect).toBeVisible();

    // Initial role value must be "Student Athlete", NEVER raw "player_student"
    await expect(roleSelect).toContainText('Student Athlete');
    await expect(roleSelect).not.toContainText('player_student');

    // Open Role Dropdown
    await roleSelect.click();
    await expect(page.getByRole('option', { name: 'Faculty Athlete' })).toBeVisible();

    // Select Faculty Athlete
    await page.getByRole('option', { name: 'Faculty Athlete' }).click();
    await expect(roleSelect).toContainText('Faculty Athlete');
    await expect(roleSelect).not.toContainText('player_faculty');

    // Test Department dropdown
    const departmentTrigger = page.locator('[data-slot="select-trigger"]').nth(1);
    await expect(departmentTrigger).toBeVisible();

    const deptBox = await departmentTrigger.boundingBox();
    expect(deptBox).not.toBeNull();

    // Open Department dropdown
    await departmentTrigger.click();
    const deptPopup = page.locator('[data-slot="select-content"][data-open]');
    await expect(deptPopup).toBeVisible();

    const deptPopupBox = await deptPopup.boundingBox();
    expect(deptPopupBox).not.toBeNull();

    if (deptPopupBox && deptBox) {
      // The popup must open cleanly without overlapping the trigger face
      const isBelow = deptPopupBox.y >= deptBox.y + deptBox.height - 2;
      const isAbove = deptPopupBox.y + deptPopupBox.height <= deptBox.y + 2;
      expect(isBelow || isAbove).toBe(true);
    }
  });
});
