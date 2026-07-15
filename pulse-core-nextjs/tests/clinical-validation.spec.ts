import { test, expect } from '@playwright/test';

test.describe('Clinical Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as doctor
    await page.goto('/');
    await page.fill('input[type="email"]', 'doctor@afyahero.test');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should validate vital signs ranges', async ({ page }) => {
    await page.goto('/patients/1/vitals/new');

    // Test normal ranges (should pass)
    await page.fill('[data-testid="systolic"]', '120');
    await page.fill('[data-testid="diastolic"]', '80');
    await page.fill('[data-testid="temperature"]', '36.5');
    await page.fill('[data-testid="heart-rate"]', '72');
    await page.fill('[data-testid="respiratory-rate"]', '16');
    await page.fill('[data-testid="oxygen-saturation"]', '98');

    await page.click('[data-testid="save-vitals"]');

    // Should save successfully
    await expect(page.locator('text=Vital signs saved')).toBeVisible();
  });

  test('should flag abnormal vital signs', async ({ page }) => {
    await page.goto('/patients/1/vitals/new');

    // Enter critically abnormal values
    await page.fill('[data-testid="systolic"]', '50'); // Too low
    await page.fill('[data-testid="diastolic"]', '30'); // Too low
    await page.fill('[data-testid="temperature"]', '42'); // Fever
    await page.fill('[data-testid="heart-rate"]', '150'); // Tachycardia
    await page.fill('[data-testid="respiratory-rate"]', '35'); // Tachypnea

    await page.click('[data-testid="save-vitals"]');

    // Should show validation errors
    await expect(page.locator('text=Critically low blood pressure')).toBeVisible();
    await expect(page.locator('text=High fever detected')).toBeVisible();
    await expect(page.locator('text=Tachycardia detected')).toBeVisible();
    await expect(page.locator('text=Tachypnea detected')).toBeVisible();
  });

  test('should validate medication dosages', async ({ page }) => {
    await page.goto('/patients/1/medications/new');

    // Enter medication with excessive dose
    await page.fill('[data-testid="medication"]', 'Paracetamol');
    await page.fill('[data-testid="dosage"]', '5000'); // Excessive
    await page.selectOption('[data-testid="unit"]', 'mg');
    await page.selectOption('[data-testid="frequency"]', 'every 4 hours');

    await page.click('[data-testid="save-medication"]');

    // Should flag overdose risk
    await expect(page.locator('text=Potential overdose risk detected')).toBeVisible();
  });

  test('should convert brand to generic names', async ({ page }) => {
    await page.goto('/patients/1/medications/new');

    // Enter brand name
    await page.fill('[data-testid="medication"]', 'Tylenol');

    // Should suggest generic
    await expect(page.locator('text=Suggested generic: Paracetamol')).toBeVisible();

    // Should allow proceeding with generic
    await page.click('[data-testid="use-generic"]');
    await expect(page.locator('input[data-testid="medication"]')).toHaveValue('Paracetamol');
  });

  test('should validate lab results', async ({ page }) => {
    await page.goto('/patients/1/labs/new');

    // Enter abnormal lab values
    await page.fill('[data-testid="glucose"]', '25'); // mmol/L - very high
    await page.fill('[data-testid="hemoglobin"]', '5'); // g/dL - very low
    await page.fill('[data-testid="creatinine"]', '800'); // μmol/L - very high

    await page.click('[data-testid="save-labs"]');

    // Should flag critical values
    await expect(page.locator('text=Critical hyperglycemia')).toBeVisible();
    await expect(page.locator('text=Severe anemia')).toBeVisible();
    await expect(page.locator('text=Acute kidney injury')).toBeVisible();
  });
});