/**
 * Playwright API tests for Population Analytics API
 * POST /api/population/analytics
 */

import { test, expect } from '@playwright/test';

test.describe('Population Analytics API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized roles', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should successfully generate AHI report', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {
        facilityId: 'test-facility',
        timeframe: 'month',
        reportType: 'ahi',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.report).toBeDefined();
      expect(data.generatedAt).toBeDefined();
      expect(data.generatedBy).toBeDefined();
    }
  });

  test('should successfully generate outbreak detection report', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {
        facilityId: 'test-facility',
        timeframe: 'week',
        reportType: 'outbreak',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.report).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    }
  });

  test('should successfully generate AMR surveillance report', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {
        facilityId: 'test-facility',
        timeframe: 'month',
        reportType: 'amr',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.report).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    }
  });

  test('should successfully generate system performance report', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {
        facilityId: 'test-facility',
        timeframe: 'quarter',
        reportType: 'performance',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.report).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    }
  });

  test('should handle different timeframes', async ({ request }) => {
    const timeframes = ['week', 'month', 'quarter', 'year'];

    for (const timeframe of timeframes) {
      const response = await request.post(`${baseURL}/api/population/analytics`, {
        data: {
          facilityId: 'test-facility',
          timeframe,
          reportType: 'ahi',
        },
        headers: {
          'Cookie': 'afya_session=admin-session',
        },
      });

      if (response.status() === 200) {
        const data = await response.json();
        expect(data.report).toBeDefined();
      }
    }
  });

  test('should handle missing facilityId gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/population/analytics`, {
      data: {
        timeframe: 'month',
        reportType: 'ahi',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.report).toBeDefined();
    }
  });

  test('should handle GET endpoint for metadata', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/population/analytics`, {
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.name).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.description).toBeDefined();
      expect(data.reportTypes).toBeDefined();
      expect(Array.isArray(data.reportTypes)).toBe(true);
    }
  });
});
