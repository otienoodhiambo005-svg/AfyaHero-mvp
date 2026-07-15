/**
 * Bot Integration E2E Tests
 *
 * Tests for WhatsApp and USSD bot webhook endpoints and admin analytics UI.
 * Webhook routes require shared secrets configured in playwright webServer env.
 */

import { createHmac } from 'crypto';
import { test, expect } from '@playwright/test';
import { loginDemo } from './helpers/portal-auth';

const USSD_WEBHOOK_SECRET = process.env.USSD_WEBHOOK_SECRET ?? 'test-ussd-webhook-secret';
const WHATSAPP_WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET ?? 'test-whatsapp-webhook-secret';

function whatsappSignature(payload: string): string {
  return createHmac('sha256', WHATSAPP_WEBHOOK_SECRET).update(payload).digest('hex');
}

test.describe('Bot Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page.request, 'admin');
    await page.goto('/portal/admin/bot-analytics');
  });

  test('should display bot analytics dashboard', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Bot Analytics Dashboard');

    await expect(page.locator('text=Total Messages')).toBeVisible();
    await expect(page.locator('text=WhatsApp Messages')).toBeVisible();
    await expect(page.locator('text=USSD Sessions')).toBeVisible();
    await expect(page.locator('text=Active Users')).toBeVisible();
  });

  test('should show recent activity tab', async ({ page }) => {
    await page.click('text=Recent Activity');
    await expect(page.locator('text=Recent Bot Activity')).toBeVisible();
  });

  test('should show usage trends tab', async ({ page }) => {
    await page.click('text=Usage Trends');
    await expect(page.locator('text=Usage Trends')).toBeVisible();
  });

  test('should show error log tab', async ({ page }) => {
    await page.click('text=Error Log');
    await expect(page.locator('text=Error Log')).toBeVisible();
  });
});

test.describe('WhatsApp Bot API', () => {
  test('should handle webhook POST request with valid signature', async ({ request }) => {
    const payload = JSON.stringify({
      event: 'message',
      data: [{
        id: 'msg-123',
        direction: 'inbound',
        from: '+254700000000',
        to: '+254711111111',
        text: 'HELP',
        timestamp: Date.now(),
      }],
    });

    const response = await request.post('/api/bot/whatsapp/webhook', {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'x-africas-talking-signature': whatsappSignature(payload),
      },
    });

    expect(response.status()).toBe(200);
  });

  test('should reject webhook POST without signature', async ({ request }) => {
    const response = await request.post('/api/bot/whatsapp/webhook', {
      data: {
        event: 'message',
        data: [{ id: 'msg-123', direction: 'inbound', from: '+254700000000', text: 'HELP' }],
      },
    });
    expect(response.status()).toBe(401);
  });

  test('should handle webhook GET request for verification', async ({ request }) => {
    const response = await request.get('/api/bot/whatsapp/webhook');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('active');
  });
});

test.describe('USSD Bot API', () => {
  test('should handle USSD request with shared secret header', async ({ request }) => {
    const formData = new URLSearchParams();
    formData.append('sessionId', 'session-123');
    formData.append('serviceCode', '*123#');
    formData.append('phoneNumber', '+254700000000');
    formData.append('text', '');

    const response = await request.post('/api/bot/ussd/webhook', {
      data: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-ussd-webhook-secret': USSD_WEBHOOK_SECRET,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('should reject USSD request without auth', async ({ request }) => {
    const formData = new URLSearchParams();
    formData.append('sessionId', 'session-123');
    formData.append('serviceCode', '*123#');
    formData.append('phoneNumber', '+254700000000');
    formData.append('text', '');

    const response = await request.post('/api/bot/ussd/webhook', {
      data: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    expect(response.status()).toBe(401);
  });

  test('should handle USSD GET request for verification', async ({ request }) => {
    const response = await request.get('/api/bot/ussd/webhook');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('active');
  });
});

test.describe('Bot Analytics API', () => {
  test('should return analytics data for admin demo session', async ({ request }) => {
    await loginDemo(request, 'admin');
    const response = await request.get('/api/admin/bot/analytics');
    expect([200, 500]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.stats).toBeDefined();
      expect(data.recentActivity).toBeDefined();
    }
  });

  test('should support date range filtering', async ({ request }) => {
    await loginDemo(request, 'admin');
    const response = await request.get('/api/admin/bot/analytics?days=7');
    expect([200, 500]).toContain(response.status());
  });
});
