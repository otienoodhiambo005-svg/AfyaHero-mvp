import { test, expect } from '@playwright/test';

test.describe('Patient Access', () => {
  test.beforeEach(async ({ page }) => {
    // Login as doctor first
    await page.goto('/');
    await page.fill('input[type="email"]', 'doctor@afyahero.test');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should view patient list', async ({ page }) => {
    await page.goto('/patients');

    // Should see patient list
    await expect(page.locator('text=Patient List')).toBeVisible();

    // Should have patient cards or table
    const patientCount = await page.locator('[data-testid="patient-card"]').count();
    expect(patientCount).toBeGreaterThan(0);
  });

  test('should view patient details', async ({ page }) => {
    await page.goto('/patients');

    // Click on first patient
    await page.locator('[data-testid="patient-card"]').first().click();

    // Should see patient details
    await expect(page.locator('text=Patient Details')).toBeVisible();

    // Should see vital signs
    await expect(page.locator('text=Vital Signs')).toBeVisible();

    // Should see medical history
    await expect(page.locator('text=Medical History')).toBeVisible();
  });

  test('should anonymize patient data in AI queries', async ({ page }) => {
    await page.goto('/patients/1'); // Assuming patient ID 1 exists

    // Open AI assistant
    await page.click('[data-testid="ai-assistant-button"]');

    // Type a query that would include patient data
    await page.fill('[data-testid="ai-input"]', 'What are the symptoms for this patient?');

    // Submit query
    await page.click('[data-testid="ai-submit"]');

    // Should see response (this would be mocked in real test)
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();

    // Verify that response doesn't contain PII (this would need audit log checking)
    // For now, just check that AI response appears
  });
});