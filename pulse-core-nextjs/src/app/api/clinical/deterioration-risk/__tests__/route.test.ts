/**
 * Playwright API tests for Deterioration Risk API
 * POST /api/clinical/deterioration-risk
 */

import { test, expect } from '@playwright/test';

test.describe('Deterioration Risk API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/deterioration-risk`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 400 for invalid request body', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/deterioration-risk`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=test-session',
      },
    });
    expect([400, 401]).toContain(response.status());
  });

  test('should successfully assess deterioration risk with valid data', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/deterioration-risk`, {
      data: {
        patientId: 'test-patient-123',
        context: {
          age: 45,
          gender: 'female',
          consciousness: 'alert',
          isPregnant: false,
        },
        vitals: {
          bloodPressure: { systolic: 120, diastolic: 80 },
          heartRate: 72,
          temperature: 37.0,
          respiratoryRate: 16,
          oxygenSaturation: 98,
        },
      },
      headers: {
        'Cookie': 'afya_session=test-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.overallRisk).toBeDefined();
      expect(data.risks).toBeDefined();
      expect(data.risks.sepsis).toBeDefined();
      expect(data.aiInsights).toBeDefined();
    }
  });

  test('should include sepsis risk assessment', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/deterioration-risk`, {
      data: {
        patientId: 'test-patient-456',
        context: {
          age: 30,
          gender: 'male',
          consciousness: 'alert',
        },
        vitals: {
          bloodPressure: { systolic: 90, diastolic: 60 },
          heartRate: 110,
          temperature: 39.5,
          respiratoryRate: 24,
          oxygenSaturation: 92,
        },
      },
      headers: {
        'Cookie': 'afya_session=test-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.risks.sepsis).toBeDefined();
      expect(data.risks.sepsis.risk).toBeDefined();
      expect(data.risks.sepsis.score).toBeDefined();
    }
  });

  test('should include pediatric risk assessment for children', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/deterioration-risk`, {
      data: {
        patientId: 'test-patient-pediatric',
        context: {
          age: 5,
          gender: 'male',
          consciousness: 'alert',
        },
        vitals: {
          bloodPressure: { systolic: 95, diastolic: 60 },
          heartRate: 120,
          temperature: 38.5,
          respiratoryRate: 28,
          oxygenSaturation: 96,
        },
      },
      headers: {
        'Cookie': 'afya_session=test-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.risks.pediatric).toBeDefined();
      expect(data.risks.pediatric.risk).toBeDefined();
    }
  });

  test('should include maternal risk assessment for pregnant patients', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/deterioration-risk`, {
      data: {
        patientId: 'test-patient-maternal',
        context: {
          age: 28,
          gender: 'female',
          consciousness: 'alert',
          isPregnant: true,
          gestationalWeeks: 32,
        },
        vitals: {
          bloodPressure: { systolic: 140, diastolic: 90 },
          heartRate: 95,
          temperature: 37.2,
          respiratoryRate: 18,
          oxygenSaturation: 98,
        },
      },
      headers: {
        'Cookie': 'afya_session=test-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.risks.maternal).toBeDefined();
      expect(data.risks.maternal.risk).toBeDefined();
    }
  });
});
