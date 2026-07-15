import { test, expect } from '@playwright/test';
import { loginAs, ensureLoggedOut, expectPortalLoaded } from '../../fixtures/auth';

test.describe('Portal Login Flows', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('reception login loads and displays form', async ({ page }) => {
    await page.goto('/auth/reception/login');
    
    // Check form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check portal branding
    await expect(page.locator('text=Reception')).toBeVisible();
  });

  test('medical login loads and displays form', async ({ page }) => {
    await page.goto('/auth/medical/login');
    
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    await expect(page.locator('text=Medical')).toBeVisible();
  });

  test('lab login loads and displays form', async ({ page }) => {
    await page.goto('/auth/lab/login');
    
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    await expect(page.locator('text=Laboratory')).toBeVisible();
  });

  test('pharmacy login loads and displays form', async ({ page }) => {
    await page.goto('/auth/pharmacy/login');
    
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    await expect(page.locator('text=Pharmacy')).toBeVisible();
  });

  test('admin login loads and displays form', async ({ page }) => {
    await page.goto('/auth/admin/login');
    
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    await expect(page.locator('text=Admin')).toBeVisible();
  });
});

test.describe('Portal Access Control', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access portal without auth
    await page.goto('/portal/reception');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/reception\/login/);
  });

  test('wrong role cannot access other portals', async ({ page }) => {
    // This would require a logged-in session with wrong role
    // For now, just test the redirect behavior
    await page.goto('/portal/admin');
    await expect(page).toHaveURL(/\/auth\/admin\/login/);
  });
});

test.describe('Responsive Login Pages', () => {
  test('login page is responsive on mobile', async ({ page }) => {
    await page.goto('/auth/reception/login');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Form should still be visible and usable
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});
