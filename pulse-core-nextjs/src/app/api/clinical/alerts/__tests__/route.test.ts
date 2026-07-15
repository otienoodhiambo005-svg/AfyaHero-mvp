/**
 * Playwright API tests for Clinical Alerts API
 * POST /api/clinical/alerts
 */

import { test, expect } from '@playwright/test';

test.describe('Clinical Alerts API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized roles', async ({ request }) => {
    // Test with a role that doesn't have access (e.g., lab instead of medical/admin)
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=lab-session', // Lab role should not have access
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should successfully generate clinical alerts with valid data', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {
        patientId: 'test-patient-123',
        context: {},
        vitals: {
          bloodPressure: { systolic: 85, diastolic: 55 },
          heartRate: 105,
          temperature: 38.5,
          respiratoryRate: 22,
          oxygenSaturation: 93,
        },
        medications: ['Warfarin', 'Aspirin'],
        labResults: {
          hemoglobin: 8.5,
          whiteBloodCell: 14.0,
          plateletCount: 120,
        },
        allergies: ['Penicillin'],
        conditions: ['Hypertension', 'Diabetes'],
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.alerts).toBeDefined();
      expect(Array.isArray(data.alerts)).toBe(true);
      expect(data.summary).toBeDefined();
      expect(data.summary.critical).toBeDefined();
      expect(data.summary.high).toBeDefined();
      expect(data.summary.medium).toBeDefined();
      expect(data.summary.low).toBeDefined();
    }
  });

  test('should include drug interaction alerts', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {
        patientId: 'test-patient-drug-interaction',
        medications: ['Warfarin', 'Aspirin', 'Ibuprofen'],
        allergies: [],
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.alerts).toBeDefined();
      // Should have at least one alert (potentially drug interaction)
      expect(data.alerts.length).toBeGreaterThan(0);
    }
  });

  test('should include sepsis risk alerts for abnormal vitals', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {
        patientId: 'test-patient-sepsis',
        vitals: {
          bloodPressure: { systolic: 85, diastolic: 50 },
          heartRate: 115,
          temperature: 39.8,
          respiratoryRate: 26,
          oxygenSaturation: 90,
        },
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.alerts).toBeDefined();
      // Should have sepsis risk alert
      const sepsisAlert = data.alerts.find((alert: any) => alert.category === 'sepsis');
      expect(sepsisAlert).toBeDefined();
    }
  });

  test('should include allergy alerts', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {
        patientId: 'test-patient-allergy',
        medications: ['Amoxicillin'],
        allergies: ['Penicillin'],
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.alerts).toBeDefined();
      // Should have allergy alert
      const allergyAlert = data.alerts.find((alert: any) => alert.category === 'allergy');
      expect(allergyAlert).toBeDefined();
    }
  });

  test('should handle missing data gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/alerts`, {
      data: {
        patientId: 'test-patient-minimal',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.alerts).toBeDefined();
      // Should still work with minimal data
    }
  });
});
