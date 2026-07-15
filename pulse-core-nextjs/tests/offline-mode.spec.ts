import { test, expect } from '@playwright/test';

test.describe('Offline Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Login as doctor
    await page.goto('/');
    await page.fill('input[type="email"]', 'doctor@afyahero.test');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show offline banner when connection lost', async ({ page }) => {
    // Simulate offline
    await page.context().setOffline(true);

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Should show offline banner
    await expect(page.locator('text=You are currently offline')).toBeVisible();
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
  });

  test('should queue requests when offline', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);

    await page.goto('/patients/1');

    // Try to update patient data
    await page.fill('[data-testid="notes"]', 'Test note while offline');
    await page.click('[data-testid="save-notes"]');

    // Should show queued message
    await expect(page.locator('text=Request queued for when connection returns')).toBeVisible();
  });

  test('should sync queued requests when back online', async ({ page }) => {
    // Start offline
    await page.context().setOffline(true);

    await page.goto('/patients/1');
    await page.fill('[data-testid="notes"]', 'Offline note');
    await page.click('[data-testid="save-notes"]');

    // Go back online
    await page.context().setOffline(false);

    // Wait for sync
    await page.waitForSelector('text=Data synchronized');

    // Should show sync success
    await expect(page.locator('text=Data synchronized')).toBeVisible();
  });

  test('should cache patient data for offline viewing', async ({ page }) => {
    // First load patient data while online
    await page.goto('/patients/1');
    await expect(page.locator('text=Patient Details')).toBeVisible();

    // Go offline
    await page.context().setOffline(true);

    // Refresh page
    await page.reload();

    // Should still show cached patient data
    await expect(page.locator('text=Patient Details')).toBeVisible();
    await expect(page.locator('[data-testid="cached-data-indicator"]')).toBeVisible();
  });
});