import { test, expect } from '@playwright/test';

test.describe('AI Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login as doctor
    await page.goto('/');
    await page.fill('input[type="email"]', 'doctor@afyahero.test');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should use local AI by default', async ({ page }) => {
    await page.goto('/ai-assistant');

    // AI consent modal should NOT appear (disabled)
    await expect(page.locator('text=AI Consent')).not.toBeVisible();

    // Should be able to use AI assistant immediately
    await page.fill('[data-testid="ai-input"]', 'What are normal vital sign ranges?');
    await page.click('[data-testid="ai-submit"]');

    // Should get response
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
  });

  test('should validate clinical data', async ({ page }) => {
    await page.goto('/patients/1/vitals');

    // Enter abnormal vital signs
    await page.fill('[data-testid="blood-pressure"]', '300/200');
    await page.fill('[data-testid="temperature"]', '45');
    await page.fill('[data-testid="heart-rate"]', '300');

    // Try to save
    await page.click('[data-testid="save-vitals"]');

    // Should show validation warnings
    await expect(page.locator('text=Abnormal blood pressure detected')).toBeVisible();
    await expect(page.locator('text=Temperature out of range')).toBeVisible();
    await expect(page.locator('text=Heart rate critically high')).toBeVisible();
  });

  test('should handle medication standardization', async ({ page }) => {
    await page.goto('/patients/1/medications');

    // Enter medication with brand name
    await page.fill('[data-testid="medication-input"]', 'Advil 200mg');

    // Should suggest generic equivalent
    await expect(page.locator('text=Suggested: Ibuprofen 200mg')).toBeVisible();
  });
});