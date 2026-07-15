/**
 * Test authentication fixtures for Playwright E2E tests
 * Provides helper functions for login/logout and session management
 */

import { Page, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  role: 'reception' | 'medical' | 'lab' | 'pharmacy' | 'admin';
}

export const testUsers: Record<string, TestUser> = {
  reception: {
    email: 'reception@test.hospital',
    password: 'TestPassword123!',
    role: 'reception',
  },
  medical: {
    email: 'doctor@test.hospital',
    password: 'TestPassword123!',
    role: 'medical',
  },
  lab: {
    email: 'labtech@test.hospital',
    password: 'TestPassword123!',
    role: 'lab',
  },
  pharmacy: {
    email: 'pharmacist@test.hospital',
    password: 'TestPassword123!',
    role: 'pharmacy',
  },
  admin: {
    email: 'admin@test.hospital',
    password: 'TestPassword123!',
    role: 'admin',
  },
};

/**
 * Login as a specific role
 */
export async function loginAs(page: Page, role: keyof typeof testUsers): Promise<void> {
  const user = testUsers[role];
  const loginPath = `/auth/${role}/login`;
  
  await page.goto(loginPath);
  
  // Fill login form
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to portal
  await page.waitForURL(`**/portal/${role}/**`);
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  // Click user menu
  await page.click('[data-testid="user-menu-trigger"]');
  
  // Click logout
  await page.click('[data-testid="logout-button"]');
  
  // Wait for redirect to login
  await page.waitForURL('**/auth/**/login');
}

/**
 * Ensure user is logged out
 */
export async function ensureLoggedOut(page: Page): Promise<void> {
  // Clear cookies and storage after navigating to the app origin.
  await page.context().clearCookies();
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  } catch {
    // The caller will navigate to the login page next; storage is origin-bound.
  }
}

/**
 * Setup authenticated page context for a role
 */
export async function setupAuthenticatedContext(page: Page, role: keyof typeof testUsers): Promise<void> {
  await ensureLoggedOut(page);
  await loginAs(page, role);
}

/**
 * Common assertions for portal pages
 */
export async function expectPortalLoaded(page: Page, _role: string): Promise<void> {
  // Check portal shell is rendered
  await expect(page.locator('[data-testid="portal-shell"]')).toBeVisible();
  
  // Check sidebar navigation
  await expect(page.locator('[data-testid="portal-sidebar"]')).toBeVisible();
  
  // Check user menu
  await expect(page.locator('[data-testid="user-menu-trigger"]')).toBeVisible();
}
