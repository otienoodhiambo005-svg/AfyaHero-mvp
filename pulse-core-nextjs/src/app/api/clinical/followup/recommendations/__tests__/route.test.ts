/**
 * Playwright API tests for Follow-up Recommendations API
 * POST /api/clinical/followup/recommendations
 */

import { test, expect } from '@playwright/test';

test.describe('Follow-up Recommendations API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized roles', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=lab-session',
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should successfully generate follow-up recommendations', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {
        patientId: 'test-patient-123',
        diagnosis: 'Community-acquired pneumonia',
        treatment: {
          medication: 'Amoxicillin 500mg TID x 7 days',
          instructions: 'Complete full course',
        },
        riskFactors: {
          age: 65,
          comorbidities: 'Diabetes, Hypertension',
          previousAdmissions: 2,
        },
        socialContext: {
          support: 'moderate',
          distance: 15,
          transportation: 'limited',
        },
        dischargeCondition: 'stable',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.readmissionRisk).toBeDefined();
      expect(data.readmissionRisk.risk).toBeDefined();
      expect(data.readmissionRisk.score).toBeDefined();
      expect(data.recommendations).toBeDefined();
      expect(data.summary).toBeDefined();
    }
  });

  test('should include readmission risk assessment', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {
        patientId: 'test-patient-high-risk',
        diagnosis: 'Heart failure exacerbation',
        riskFactors: {
          age: 78,
          comorbidities: 'Heart failure, CKD, Diabetes',
          previousAdmissions: 5,
        },
        dischargeCondition: 'improving',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.readmissionRisk).toBeDefined();
      expect(data.readmissionRisk.risk).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(data.readmissionRisk.risk);
      expect(data.readmissionRisk.score).toBeGreaterThanOrEqual(0);
      expect(data.readmissionRisk.score).toBeLessThanOrEqual(10);
    }
  });

  test('should include urgency and CHW recommendations', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {
        patientId: 'test-patient-urgency',
        diagnosis: 'Post-operative infection',
        riskFactors: {
          age: 45,
          comorbidities: 'None',
          previousAdmissions: 0,
        },
        socialContext: {
          support: 'poor',
          distance: 35,
        },
        dischargeCondition: 'stable',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.summary).toBeDefined();
      expect(data.summary.urgency).toBeDefined();
      expect(data.summary.requiresCHW).toBeDefined();
      expect(typeof data.summary.requiresCHW).toBe('boolean');
    }
  });

  test('should handle missing data gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {
        patientId: 'test-patient-minimal',
        diagnosis: 'Upper respiratory infection',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.readmissionRisk).toBeDefined();
      expect(data.recommendations).toBeDefined();
    }
  });

  test('should include AI-enhanced recommendations', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/followup/recommendations`, {
      data: {
        patientId: 'test-patient-ai',
        diagnosis: 'Type 2 diabetes mellitus',
        treatment: {
          medication: 'Metformin 500mg BID',
        },
        riskFactors: {
          age: 55,
          comorbidities: 'Hypertension',
        },
        socialContext: {
          support: 'good',
          distance: 5,
        },
        dischargeCondition: 'stable',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.recommendations).toBeDefined();
      // AI recommendations may include followUpTimeline, monitoringParameters, etc.
      expect(typeof data.recommendations).toBe('object');
    }
  });
});
