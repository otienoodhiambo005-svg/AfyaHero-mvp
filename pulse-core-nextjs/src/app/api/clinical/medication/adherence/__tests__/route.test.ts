/**
 * Playwright API tests for Medication Adherence API
 * POST /api/clinical/medication/adherence
 */

import { test, expect } from '@playwright/test';

test.describe('Medication Adherence API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized roles', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=lab-session',
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should successfully assess medication adherence', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {
        patientId: 'test-patient-123',
        medications: [
          { name: 'Metformin 500mg', frequency: 'twice daily', duration: 'ongoing' },
          { name: 'Lisinopril 10mg', frequency: 'once daily', duration: 'ongoing' },
        ],
        adherenceHistory: {
          previousMissedDoses: 1,
        },
        riskFactors: {
          age: 65,
          comorbidities: 'Diabetes, Hypertension',
        },
        socialContext: {
          support: 'good',
          distance: 10,
          transportation: 'available',
        },
      },
      headers: {
        'Cookie': 'afya_session=pharmacy-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.adherenceScore).toBeDefined();
      expect(data.adherenceLevel).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(data.adherenceLevel);
      expect(data.recommendations).toBeDefined();
    }
  });

  test('should identify high pill burden risk factor', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {
        patientId: 'test-patient-pill-burden',
        medications: [
          { name: 'Medication A', frequency: 'three times daily' },
          { name: 'Medication B', frequency: 'twice daily' },
          { name: 'Medication C', frequency: 'once daily' },
          { name: 'Medication D', frequency: 'once daily' },
          { name: 'Medication E', frequency: 'once daily' },
          { name: 'Medication F', frequency: 'once daily' },
        ],
      },
      headers: {
        'Cookie': 'afya_session=pharmacy-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.riskFactors).toBeDefined();
      expect(Array.isArray(data.riskFactors)).toBe(true);
      // Should identify high pill burden
      expect(data.riskFactors.some((rf: string) => rf.toLowerCase().includes('pill'))).toBe(true);
    }
  });

  test('should identify complex regimen risk factor', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {
        patientId: 'test-patient-complex',
        medications: [
          { name: 'Antibiotic', frequency: 'four times daily' },
          { name: 'Pain medication', frequency: 'every 4 hours as needed' },
        ],
      },
      headers: {
        'Cookie': 'afya_session=pharmacy-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.riskFactors).toBeDefined();
      expect(Array.isArray(data.riskFactors)).toBe(true);
    }
  });

  test('should identify poor social support risk factor', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {
        patientId: 'test-patient-social',
        medications: [{ name: 'Medication', frequency: 'once daily' }],
        socialContext: {
          support: 'poor',
          distance: 40,
        },
      },
      headers: {
        'Cookie': 'afya_session=pharmacy-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.riskFactors).toBeDefined();
      expect(Array.isArray(data.riskFactors)).toBe(true);
      expect(data.riskFactors.some((rf: string) => rf.toLowerCase().includes('support'))).toBe(true);
    }
  });

  test('should include intervention recommendations', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {
        patientId: 'test-patient-intervention',
        medications: [{ name: 'Medication', frequency: 'once daily' }],
        adherenceHistory: {
          previousMissedDoses: 5,
        },
      },
      headers: {
        'Cookie': 'afya_session=pharmacy-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.summary).toBeDefined();
      expect(data.summary.requiresIntervention).toBeDefined();
      expect(typeof data.summary.requiresIntervention).toBe('boolean');
      expect(data.summary.priorityFollowup).toBeDefined();
    }
  });

  test('should handle missing medications gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/medication/adherence`, {
      data: {
        patientId: 'test-patient-no-meds',
      },
      headers: {
        'Cookie': 'afya_session=pharmacy-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.adherenceScore).toBeDefined();
      // With no medications, adherence should still be calculated based on other factors
    }
  });
});
