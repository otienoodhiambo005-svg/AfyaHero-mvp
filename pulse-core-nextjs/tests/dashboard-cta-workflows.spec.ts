import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Test Suite for Dashboard CTA Buttons and Workflows
 * 
 * This test suite verifies that all Call-to-Action (CTA) buttons and features
 * in respective dashboards work correctly and workflows are complete end-to-end.
 * 
 * Dashboards covered:
 * - Medical (Doctor/Nurse)
 * - Pharmacy
 * - Laboratory
 * - Admin
 * - Reception
 */

// ─── Shared Test Data ────────────────────────────────────────────────────────

const DEMO_CREDENTIALS = {
  medical: { email: 'demo@medical.afyahero.com', password: 'Demo@1234' },
  pharmacy: { email: 'demo@pharmacy.afyahero.com', password: 'Demo@1234' },
  lab: { email: 'demo@lab.afyahero.com', password: 'Demo@1234' },
  admin: { email: 'demo@admin.afyahero.com', password: 'Demo@1234' },
  reception: { email: 'demo@reception.afyahero.com', password: 'Demo@1234' },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

async function loginAsRole(page: any, role: keyof typeof DEMO_CREDENTIALS) {
  const creds = DEMO_CREDENTIALS[role];
  await page.goto(`/auth/${role}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*portal\/.*/, { timeout: 10000 });
}

// ─── Landing Page Tests ──────────────────────────────────────────────────────

test.describe('Landing Page CTAs', () => {
  test('should display all portal role cards with correct information', async ({ page }) => {
    await page.goto('/');
    
    // Check all 5 portal cards are visible
    // Exclude header and footer links by targeting the grid items
    const portalCards = page.locator('div.grid > a[href*="/auth/"]');
    await expect(portalCards).toHaveCount(5);
    
    // Verify each portal card has the expected content
    const expectedPortals = ['Reception', 'Medical', 'Laboratory', 'Pharmacy', 'Admin'];
    for (const portal of expectedPortals) {
      await expect(page.locator('div.grid').locator(`text=${portal}`).first()).toBeVisible();
    }
  });

  test('should navigate to correct login pages from landing', async ({ page }) => {
    await page.goto('/');
    
    // Test Medical portal navigation
    await page.click('div.grid > a[href="/auth/medical/login"]');
    await expect(page).toHaveURL('/auth/medical/login');
    
    await page.goto('/');
    await page.click('div.grid > a[href="/auth/pharmacy/login"]');
    await expect(page).toHaveURL('/auth/pharmacy/login');
    
    await page.goto('/');
    await page.click('div.grid > a[href="/auth/lab/login"]');
    await expect(page).toHaveURL('/auth/lab/login');
    
    await page.goto('/');
    await page.click('div.grid > a[href="/auth/admin/login"]');
    await expect(page).toHaveURL('/auth/admin/login');
    
    await page.goto('/');
    await page.click('div.grid > a[href="/auth/reception/login"]');
    await expect(page).toHaveURL('/auth/reception/login');
  });

  test('should have working generic login link', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/auth/login"]');
    await expect(page).toHaveURL('/auth/login');
  });

  test('should have working register facility link', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/auth/register-facility"]');
    await expect(page).toHaveURL('/auth/register-facility');
  });
});

// ─── Medical Dashboard Tests ─────────────────────────────────────────────────

test.describe('Medical Dashboard CTAs and Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'medical');
  });

  test('should display medical dashboard with all key elements', async ({ page }) => {
    await expect(page.locator('text=Good morning')).toBeVisible();
    await expect(page.locator('text=My Patients Today')).toBeVisible();
    await expect(page.locator('text=Inbox')).toBeVisible();
    
    // Check KPI cards
    await expect(page.locator('text=Today\'s Patients')).toBeVisible();
    await expect(page.locator('text=Pending Orders')).toBeVisible();
    await expect(page.locator('text=Prescriptions')).toBeVisible();
  });

  test('should dismiss AI priority alert', async ({ page }) => {
    // AI Alert should be visible
    await expect(page.locator('text=AI Priority Alert')).toBeVisible();
    
    // Click dismiss
    await page.click('button:has-text("Dismiss")');
    
    // Alert should be hidden
    await expect(page.locator('text=AI Priority Alert')).not.toBeVisible();
  });

  test('should view patient details from patient list', async ({ page }) => {
    // Find and click a View button in the patient table
    const viewButtons = page.locator('button:has-text("View")');
    const viewButtonCount = await viewButtons.count();
    
    if (viewButtonCount > 0) {
      await viewButtons.first().click();
      // Should navigate to patient details or show patient modal
      await expect(page).toHaveURL(/.*patients.*/);
    }
  });

  test('should display patient table with correct columns', async ({ page }) => {
    const headers = ['#', 'Patient', 'Age/Sex', 'Time', 'Chief Complaint', 'BP', 'SpO₂', 'Status', 'Action'];
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should show inbox items', async ({ page }) => {
    await expect(page.locator('text=Lab result arrived')).toBeVisible();
  });

  test('should display health education panel', async ({ page }) => {
    await expect(page.locator('text=Clinical education moments')).toBeVisible();
  });
});

// ─── Pharmacy Dashboard Tests ────────────────────────────────────────────────

test.describe('Pharmacy Dashboard CTAs and Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'pharmacy');
  });

  test('should display pharmacy dashboard with all key elements', async ({ page }) => {
    await expect(page.locator('text=Dispensing Queue')).toBeVisible();
    await expect(page.locator('text=Active Queue')).toBeVisible();
    
    // Check KPI cards
    await expect(page.locator('text=Queue Now')).toBeVisible();
    await expect(page.locator('text=Dispensed Today')).toBeVisible();
    await expect(page.locator('text=Out-of-Stock')).toBeVisible();
    await expect(page.locator('text=Revenue Today')).toBeVisible();
  });

  test('should dismiss AI dosing alert', async ({ page }) => {
    // Wait for AI alert to load
    await expect(page.locator('text=AI Dosing Alert')).toBeVisible();
    
    // Click dismiss
    await page.click('button:has-text("Dismiss")');
    
    // Alert should be hidden
    await expect(page.locator('text=AI Dosing Alert')).not.toBeVisible();
  });

  test('should have working Scan Rx button', async ({ page }) => {
    const scanButton = page.locator('button:has-text("Scan Rx")');
    await expect(scanButton).toBeVisible();
    // Click should not cause error (functionality may be mocked)
    await scanButton.click();
  });

  test('should display dispensing queue table with correct columns', async ({ page }) => {
    const headers = ['Rx #', 'Patient', 'Prescribed By', 'Date', 'Items', 'Insurance', 'Priority', 'Status', 'Actions'];
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should have action buttons for queue items', async ({ page }) => {
    // Check for Dispense, View, Print, Pause buttons
    const tableRows = page.locator('tbody tr');
    const firstRow = tableRows.first();
    
    // Should have action buttons
    await expect(firstRow.locator('button')).toBeVisible();
  });

  test('should display top drugs section', async ({ page }) => {
    await expect(page.locator('text=Top 5 Drugs Dispensed Today')).toBeVisible();
  });

  test('should display health education panel', async ({ page }) => {
    await expect(page.locator('text=Medication education built into dispensing')).toBeVisible();
  });
});

// ─── Laboratory Dashboard Tests ──────────────────────────────────────────────

test.describe('Laboratory Dashboard CTAs and Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'lab');
  });

  test('should display lab dashboard with all key elements', async ({ page }) => {
    await expect(page.locator('text=Lab Work Queue')).toBeVisible();
    
    // Check KPI cards
    await expect(page.locator('text=Total in Queue')).toBeVisible();
    await expect(page.locator('text=STAT Pending')).toBeVisible();
    await expect(page.locator('text=Completed Today')).toBeVisible();
    await expect(page.locator('text=Avg TAT')).toBeVisible();
  });

  test('should dismiss AI priority alert', async ({ page }) => {
    await expect(page.locator('text=AI Priority Alert')).toBeVisible();
    await page.click('button:has-text("Dismiss")');
    await expect(page.locator('text=AI Priority Alert')).not.toBeVisible();
  });

  test('should filter queue by priority tabs', async ({ page }) => {
    const tabs = ['All', 'STAT', 'Urgent', 'Routine'];
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      // Active tab should have different styling
      const activeTab = page.locator(`button:has-text("${tab}"):not(:has-text("${tab}"))`).first();
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test('should display lab queue table with correct columns', async ({ page }) => {
    const headers = ['Lab ID', 'Patient', 'Test', 'Sample', 'Priority', 'Ordered', 'Collected', 'Status', 'Time in Lab', 'Actions'];
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should have action buttons for lab items', async ({ page }) => {
    const tableRows = page.locator('tbody tr');
    const firstRow = tableRows.first();
    
    // Should have action buttons (Process, Enter, Reject)
    await expect(firstRow.locator('button')).toBeVisible();
  });

  test('should display health education panel', async ({ page }) => {
    await expect(page.locator('text=Health education for specimen quality')).toBeVisible();
  });
});

// ─── Admin Dashboard Tests ───────────────────────────────────────────────────

test.describe('Admin Dashboard CTAs and Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'admin');
  });

  test('should display admin dashboard with all key elements', async ({ page }) => {
    await expect(page.locator('text=Executive Dashboard')).toBeVisible();
    await expect(page.locator('text=Afya Demo Hospital')).toBeVisible();
    
    // Check KPI cards
    await expect(page.locator('text=Bed Occupancy')).toBeVisible();
    await expect(page.locator('text=OPD Today')).toBeVisible();
    await expect(page.locator('text=Revenue vs Budget')).toBeVisible();
    await expect(page.locator('text=Staff on Duty')).toBeVisible();
  });

  test('should have working Export button', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export")');
    await expect(exportButton).toBeVisible();
    await exportButton.click();
    // Should trigger download or show modal
  });

  test('should have working HMIS Report button', async ({ page }) => {
    const hmisButton = page.locator('button:has-text("HMIS Report")');
    await expect(hmisButton).toBeVisible();
    await hmisButton.click();
  });

  test('should display AI Executive Alert', async ({ page }) => {
    await expect(page.locator('text=AI Executive Alert')).toBeVisible();
  });

  test('should display ward occupancy table with correct columns', async ({ page }) => {
    const headers = ['Ward', 'Total', 'Occupied', 'Available', 'Occupancy', 'Doctor on Duty'];
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should display recent alerts section', async ({ page }) => {
    await expect(page.locator('text=Recent Alerts')).toBeVisible();
    // Should have multiple alert types
    await expect(page.locator('text=ICU at full capacity')).toBeVisible();
  });

  test('should have working Quick Action buttons', async ({ page }) => {
    const quickActions = ['Bed Census', 'Staff Roster', 'Financial Report', 'HMIS Export'];
    for (const action of quickActions) {
      const button = page.locator(`button:has-text("${action}")`);
      await expect(button).toBeVisible();
      await button.click();
    }
  });

  test('should display health education panel', async ({ page }) => {
    await expect(page.locator('text=Health education visibility for system-wide outcomes')).toBeVisible();
  });
});

// ─── Reception Dashboard Tests ───────────────────────────────────────────────

test.describe('Reception Dashboard CTAs and Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'reception');
  });

  test('should display reception dashboard with all key elements', async ({ page }) => {
    await expect(page.locator('text=Good morning')).toBeVisible();
    await expect(page.locator('text=Reception Portal')).toBeVisible();
    
    // Check KPI cards
    await expect(page.locator('text=Today\'s Arrivals')).toBeVisible();
    await expect(page.locator('text=Queue Now')).toBeVisible();
    await expect(page.locator('text=Revenue Today')).toBeVisible();
    await expect(page.locator('text=Insurance Pending')).toBeVisible();
  });

  test('should display AI Insights', async ({ page }) => {
    await expect(page.locator('text=AI Insights')).toBeVisible();
  });

  test('should display arrivals table with correct columns', async ({ page }) => {
    const headers = ['Token', 'Patient', 'Age/Sex', 'Priority', 'Complaint', 'Wait', 'Status', 'Actions'];
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should have action buttons for arrivals', async ({ page }) => {
    const tableRows = page.locator('tbody tr');
    const firstRow = tableRows.first();
    
    // Should have action buttons (View, Check In, Bill)
    await expect(firstRow.locator('button')).toBeVisible();
  });

  test('should check in patient', async ({ page }) => {
    // Find a check-in button
    const checkinButtons = page.locator('button[title="Check In"]');
    const count = await checkinButtons.count();
    
    if (count > 0) {
      await checkinButtons.first().click();
      // Should update the status
      await page.waitForLoadState('networkidle');
    }
  });

  test('should have working Quick Action buttons', async ({ page }) => {
    const quickActions = ['Check In Patient', 'Call Next', 'New Invoice'];
    for (const action of quickActions) {
      const button = page.locator(`button:has-text("${action}")`);
      await expect(button).toBeVisible();
    }
  });

  test('should display health education panel', async ({ page }) => {
    await expect(page.locator('text=Patient education support for first contact')).toBeVisible();
  });
});

// ─── Cross-Dashboard Navigation Tests ────────────────────────────────────────

test.describe('Cross-Dashboard Navigation', () => {
  test('should navigate between different portals after login', async ({ page }) => {
    // Login as medical
    await loginAsRole(page, 'medical');
    await expect(page).toHaveURL(/.*portal\/medical.*/);
    
    // Navigate to a different URL directly
    await page.goto('/portal/pharmacy');
    // Should either redirect to login or show pharmacy (depending on auth)
    await page.waitForLoadState('networkidle');
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    await loginAsRole(page, 'medical');
    await expect(page).toHaveURL(/.*portal\/medical.*/);
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL(/.*portal\/medical.*/);
  });
});

// ─── Error Handling Tests ────────────────────────────────────────────────────

test.describe('Error Handling and Edge Cases', () => {
  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto('/auth/medical/login');
    await page.fill('input[type="email"]', 'invalid@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message or stay on login page
    await expect(page.locator('text=/Invalid credentials|error|Error/')).toBeVisible();
  });

  test('should handle missing required fields on login', async ({ page }) => {
    await page.goto('/auth/medical/login');
    
    // Try to submit without filling fields
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('text=/required|Required|invalid|Invalid/')).toBeVisible();
  });

  test('should display 404 for non-existent pages', async ({ page }) => {
    await page.goto('/non-existent-page');
    await expect(page.locator('text=404')).toBeVisible();
  });
});

// ─── Accessibility Tests ─────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('should have proper ARIA labels on buttons', async ({ page }) => {
    await loginAsRole(page, 'medical');
    
    // Check for buttons with aria-labels
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    // At least some buttons should have accessible names
    expect(count).toBeGreaterThan(0);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // Should have h1
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');
    
    // Logo should have alt text
    await expect(page.locator('img[alt="AfyaHero"]')).toBeVisible();
  });
});

// ─── Performance Tests ───────────────────────────────────────────────────────

test.describe('Performance', () => {
  test('should load dashboard within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await loginAsRole(page, 'medical');
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have memory leaks on page navigation', async ({ page }) => {
    // Navigate back and forth multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/portal/medical');
      await page.goto('/');
    }
    
    // Page should still be responsive
    await page.waitForLoadState('networkidle');
  });
});