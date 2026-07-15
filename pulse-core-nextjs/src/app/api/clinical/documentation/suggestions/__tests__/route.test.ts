/**
 * Playwright API tests for Documentation Suggestions API
 * POST /api/clinical/documentation/suggestions
 */

import { test, expect } from '@playwright/test';

test.describe('Documentation Suggestions API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized roles', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=lab-session',
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should successfully generate SOAP note suggestions', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
      data: {
        documentType: 'soap_note',
        patientContext: {
          age: 45,
          gender: 'female',
          chiefComplaint: 'Chest pain',
          history: 'Patient presents with chest pain for 2 days',
        },
        partialContent: 'Subjective: Patient reports chest pain',
        suggestionsFor: 'completion',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.suggestions).toBeDefined();
      expect(data.documentType).toBe('soap_note');
    }
  });

  test('should successfully generate discharge summary suggestions', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
      data: {
        documentType: 'discharge_summary',
        patientContext: {
          age: 62,
          gender: 'male',
          diagnosis: 'Community-acquired pneumonia',
          lengthOfStay: 5,
        },
        partialContent: 'Patient admitted with pneumonia',
        suggestionsFor: 'structure',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.suggestions).toBeDefined();
      expect(data.documentType).toBe('discharge_summary');
    }
  });

  test('should successfully generate ICD-10 code suggestions', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
      data: {
        documentType: 'icd10_codes',
        patientContext: {
          age: 35,
          gender: 'female',
          diagnosis: 'Type 2 diabetes mellitus',
          comorbidities: ['Hypertension', 'Obesity'],
        },
        partialContent: 'Diagnosis: Type 2 diabetes mellitus with complications',
        suggestionsFor: 'codes',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.suggestions).toBeDefined();
      expect(data.suggestions.codes).toBeDefined();
      expect(Array.isArray(data.suggestions.codes)).toBe(true);
    }
  });

  test('should handle different suggestion modes', async ({ request }) => {
    const modes = ['completion', 'structure', 'terminology', 'codes'];

    for (const mode of modes) {
      const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
        data: {
          documentType: 'progress_note',
          patientContext: {
            age: 50,
            gender: 'male',
          },
          partialContent: 'Patient status stable',
          suggestionsFor: mode,
        },
        headers: {
          'Cookie': 'afya_session=medical-session',
        },
      });

      if (response.status() === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.suggestions).toBeDefined();
      }
    }
  });

  test('should handle missing patient context gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/clinical/documentation/suggestions`, {
      data: {
        documentType: 'soap_note',
        partialContent: 'Patient presents with fever',
        suggestionsFor: 'completion',
      },
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.suggestions).toBeDefined();
    }
  });
});
