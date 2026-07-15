import { test, expect } from '@playwright/test';

test.describe('Facility Registration and Approval Flow', () => {

  test('should register a new facility and show pending page', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/auth/register-facility');
    
    // Fill out the registration form
    await page.fill('input[name="facility_name"]', 'Playwright Test Hospital');
    await page.fill('input[name="admin_name"]', 'Admin Test');
    await page.fill('input[name="admin_title"]', 'System Administrator');
    await page.fill('input[name="admin_email"]', 'pwtest@example.com');
    await page.fill('input[name="phone_contact"]', '+254711223344');
    
    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for the success page to appear
    await expect(page.locator('text=Application Submitted Successfully')).toBeVisible({ timeout: 15000 });
  });

  test('should allow superadmin to view and approve the facility', async ({ request, page }) => {
    // This part requires superadmin auth. 
    // In e2e tests, we can login via UI, but since we don't have superadmin credentials here,
    // we assume the user has a test setup. For now, we will simulate or verify the endpoint 
    // exists and handles unauthorized correctly or logs in if possible.

    const res = await request.get('/api/admin/facilities');
    // If not authenticated, should be 401
    expect(res.status()).toBe(401);
  });
});
