import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite for Phase 3 Components
 * 
 * Tests the new AI-powered components:
 * - OutbreakDetectionPanel
 * - PredictiveBedManagementPanel
 * - ExecutiveIntelligenceDashboard
 * - ReferralMatchingPanel
 * - PredictiveFlowPanel
 * - DischargePlanningPanel
 * - PredictiveInventoryPanel
 * - InsuranceOptimizationPanel
 * - QualityIntelligenceDashboard
 */

const DEMO_CREDENTIALS = {
  medical: { email: 'demo@medical.afyahero.com', password: 'Demo@1234' },
  admin: { email: 'demo@admin.afyahero.com', password: 'Demo@1234' },
  pharmacy: { email: 'demo@pharmacy.afyahero.com', password: 'Demo@1234' },
  reception: { email: 'demo@reception.afyahero.com', password: 'Demo@1234' },
};

async function loginAsRole(page: any, role: keyof typeof DEMO_CREDENTIALS) {
  const creds = DEMO_CREDENTIALS[role];
  await page.goto(`/auth/${role}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*portal\/.*/, { timeout: 10000 });
}

test.describe('Phase 3: Admin Dashboard Components', () => {
  test('should display OutbreakDetectionPanel with data', async ({ page }) => {
    await loginAsRole(page, 'admin');
    
    // Navigate to admin dashboard
    await page.goto('/portal/admin');
    await page.waitForLoadState('networkidle');
    
    // Check if OutbreakDetectionPanel is present
    const outbreakPanel = page.locator('[data-testid="outbreak-detection-panel"]');
    await expect(outbreakPanel).toBeVisible();
    
    // Verify it has disease cluster data
    const diseaseClusters = page.locator('[data-testid="disease-clusters"]');
    await expect(diseaseClusters).toBeVisible();
  });

  test('should display PredictiveBedManagementPanel with predictions', async ({ page }) => {
    await loginAsRole(page, 'admin');
    
    // Navigate to admin dashboard
    await page.goto('/portal/admin');
    await page.waitForLoadState('networkidle');
    
    // Check if PredictiveBedManagementPanel is present
    const bedPanel = page.locator('[data-testid="predictive-bed-management-panel"]');
    await expect(bedPanel).toBeVisible();
    
    // Verify it has bed allocation predictions
    const bedPredictions = page.locator('[data-testid="bed-predictions"]');
    await expect(bedPredictions).toBeVisible();
  });

  test('should display ExecutiveIntelligenceDashboard with KPIs', async ({ page }) => {
    await loginAsRole(page, 'admin');
    
    // Navigate to admin dashboard
    await page.goto('/portal/admin');
    await page.waitForLoadState('networkidle');
    
    // Check if ExecutiveIntelligenceDashboard is present
    const executivePanel = page.locator('[data-testid="executive-intelligence-dashboard"]');
    await expect(executivePanel).toBeVisible();
    
    // Verify it has KPI metrics
    const kpiMetrics = page.locator('[data-testid="kpi-metrics"]');
    await expect(kpiMetrics).toBeVisible();
  });

  test('should display QualityIntelligenceDashboard with quality metrics', async ({ page }) => {
    await loginAsRole(page, 'admin');
    
    // Navigate to admin dashboard
    await page.goto('/portal/admin');
    await page.waitForLoadState('networkidle');
    
    // Check if QualityIntelligenceDashboard is present
    const qualityPanel = page.locator('[data-testid="quality-intelligence-dashboard"]');
    await expect(qualityPanel).toBeVisible();
    
    // Verify it has quality metrics
    const qualityMetrics = page.locator('[data-testid="quality-metrics"]');
    await expect(qualityMetrics).toBeVisible();
  });
});

test.describe('Phase 3: Medical Dashboard Components', () => {
  test('should display DischargePlanningPanel with patient data', async ({ page }) => {
    await loginAsRole(page, 'medical');
    
    // Navigate to medical dashboard
    await page.goto('/portal/medical');
    await page.waitForLoadState('networkidle');
    
    // Check if DischargePlanningPanel is present
    const dischargePanel = page.locator('[data-testid="discharge-planning-panel"]');
    await expect(dischargePanel).toBeVisible();
    
    // Verify it has patient discharge predictions
    const dischargePredictions = page.locator('[data-testid="discharge-predictions"]');
    await expect(dischargePredictions).toBeVisible();
  });

  test('should display ReferralMatchingPanel with hospital options', async ({ page }) => {
    await loginAsRole(page, 'medical');
    
    // Navigate to medical dashboard
    await page.goto('/portal/medical');
    await page.waitForLoadState('networkidle');
    
    // Check if ReferralMatchingPanel is present
    const referralPanel = page.locator('[data-testid="referral-matching-panel"]');
    await expect(referralPanel).toBeVisible();
    
    // Verify it has hospital recommendations
    const hospitalRecommendations = page.locator('[data-testid="hospital-recommendations"]');
    await expect(hospitalRecommendations).toBeVisible();
  });
});

test.describe('Phase 3: Pharmacy Dashboard Components', () => {
  test('should display PredictiveInventoryPanel with demand forecasts', async ({ page }) => {
    await loginAsRole(page, 'pharmacy');
    
    // Navigate to pharmacy dashboard
    await page.goto('/portal/pharmacy');
    await page.waitForLoadState('networkidle');
    
    // Check if PredictiveInventoryPanel is present
    const inventoryPanel = page.locator('[data-testid="predictive-inventory-panel"]');
    await expect(inventoryPanel).toBeVisible();
    
    // Verify it has demand forecasts
    const demandForecasts = page.locator('[data-testid="demand-forecasts"]');
    await expect(demandForecasts).toBeVisible();
  });

  test('should display InsuranceOptimizationPanel with claim validation', async ({ page }) => {
    await loginAsRole(page, 'pharmacy');
    
    // Navigate to pharmacy dashboard
    await page.goto('/portal/pharmacy');
    await page.waitForLoadState('networkidle');
    
    // Check if InsuranceOptimizationPanel is present
    const insurancePanel = page.locator('[data-testid="insurance-optimization-panel"]');
    await expect(insurancePanel).toBeVisible();
    
    // Verify it has claim validation features
    const claimValidation = page.locator('[data-testid="claim-validation"]');
    await expect(claimValidation).toBeVisible();
  });
});

test.describe('Phase 3: Offline Support', () => {
  test('should display offline indicators when network is offline', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);
    
    await loginAsRole(page, 'medical');
    
    // Navigate to medical dashboard
    await page.goto('/portal/medical');
    await page.waitForLoadState('networkidle');
    
    // Check for offline indicator
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible();
    
    // Restore online mode
    await context.setOffline(false);
  });

  test('should queue form submissions when offline', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);
    
    await loginAsRole(page, 'reception');
    
    // Navigate to patient registration
    await page.goto('/portal/reception/patient-registration');
    await page.waitForLoadState('networkidle');
    
    // Check for queue indicator
    const queueIndicator = page.locator('[data-testid="queue-indicator"]');
    await expect(queueIndicator).toBeVisible();
    
    // Restore online mode
    await context.setOffline(false);
  });
});

test.describe('Phase 3: API Endpoints', () => {
  test('should fetch outbreak detection data from API', async ({ request }) => {
    const response = await request.get('/api/admin/public-health/outbreak-detection');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('diseaseClusters');
  });

  test('should fetch bed management predictions from API', async ({ request }) => {
    const response = await request.get('/api/admin/beds/predictive-management');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('bedPredictions');
  });

  test('should fetch executive intelligence from API', async ({ request }) => {
    const response = await request.get('/api/admin/executive/intelligence');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('kpiMetrics');
  });

  test('should fetch referral matching from API', async ({ request }) => {
    const response = await request.get('/api/medical/referrals/match');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('hospitalRecommendations');
  });

  test('should fetch patient flow prediction from API', async ({ request }) => {
    const response = await request.get('/api/analytics/patient-flow-prediction');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('predictedArrivals');
  });

  test('should fetch discharge prediction from API', async ({ request }) => {
    const response = await request.get('/api/medical/patients/test-patient-id/discharge-prediction');
    // May return 404 for test patient, but should not be 500
    expect(response.status()).not.toBe(500);
  });

  test('should fetch inventory prediction from API', async ({ request }) => {
    const response = await request.get('/api/pharmacy/inventory/predict-demand');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('demandForecasts');
  });

  test('should fetch insurance optimization from API', async ({ request }) => {
    const response = await request.get('/api/billing/insurance/optimize-claim');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('validationResults');
  });

  test('should fetch quality intelligence from API', async ({ request }) => {
    const response = await request.get('/api/admin/quality/intelligence');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('qualityMetrics');
  });
});
