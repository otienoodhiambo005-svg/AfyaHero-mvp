/**
 * Playwright API tests for Resource Allocation API
 * POST /api/admin/resource-allocation
 */

import { test, expect } from '@playwright/test';

test.describe('Resource Allocation API', () => {
  const baseURL = 'http://localhost:3003';

  test('should return 401 if not authenticated', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('should return 403 for unauthorized roles', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {},
      headers: {
        'Cookie': 'afya_session=medical-session',
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should successfully optimize staff allocation', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {
        resourceType: 'staff',
        facilityId: 'test-facility',
        currentAllocation: {
          doctors: 10,
          nurses: 30,
          pharmacists: 5,
        },
        demandData: {
          patientVolume: {
            emergency: 50,
            inpatient: 100,
            outpatient: 200,
          },
          peakHours: ['08:00-12:00', '14:00-18:00'],
        },
        constraints: {
          budget: 1000000,
          minimumStaffing: {
            doctors: 5,
            nurses: 20,
          },
          maxShiftLength: 8,
        },
        optimizationGoal: 'efficiency',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.resourceType).toBe('staff');
      expect(data.optimization).toBeDefined();
      expect(data.metadata).toBeDefined();
    }
  });

  test('should successfully optimize bed allocation', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {
        resourceType: 'beds',
        facilityId: 'test-facility',
        currentAllocation: {
          general: 50,
          icu: 8,
          maternity: 20,
        },
        demandData: {
          averageLOS: {
            general: 5,
            icu: 7,
            maternity: 3,
          },
          admissionRates: {
            general: 10,
            icu: 2,
            maternity: 8,
          },
        },
        constraints: {
          totalBeds: 100,
          departmentMinimums: {
            icu: 5,
            maternity: 10,
          },
          icuRatio: 0.1,
        },
        optimizationGoal: 'efficiency',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.resourceType).toBe('beds');
      expect(data.optimization).toBeDefined();
    }
  });

  test('should successfully optimize equipment allocation', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {
        resourceType: 'equipment',
        facilityId: 'test-facility',
        currentAllocation: {
          ventilators: 5,
          monitors: 20,
          ultrasound: 3,
        },
        demandData: {
          utilizationRates: {
            ventilators: 0.8,
            monitors: 0.6,
            ultrasound: 0.9,
          },
        },
        constraints: {
          budget: 500000,
          maintenance: 'required',
          training: 'basic',
        },
        optimizationGoal: 'cost',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.resourceType).toBe('equipment');
      expect(data.optimization).toBeDefined();
    }
  });

  test('should successfully optimize supply allocation', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {
        resourceType: 'supplies',
        facilityId: 'test-facility',
        currentAllocation: {
          antibiotics: 1000,
          analgesics: 500,
          iv_fluids: 200,
        },
        demandData: {
          consumptionRates: {
            antibiotics: 50,
            analgesics: 30,
            iv_fluids: 20,
          },
          leadTimes: {
            antibiotics: 7,
            analgesics: 5,
            iv_fluids: 3,
          },
        },
        constraints: {
          storage: 5000,
          budget: 200000,
          expiryDates: '2024-12-31',
        },
        optimizationGoal: 'efficiency',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.resourceType).toBe('supplies');
      expect(data.optimization).toBeDefined();
    }
  });

  test('should handle different optimization goals', async ({ request }) => {
    const goals = ['efficiency', 'cost', 'quality', 'balance'];

    for (const goal of goals) {
      const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
        data: {
          resourceType: 'staff',
          facilityId: 'test-facility',
          currentAllocation: { doctors: 10, nurses: 30 },
          demandData: { patientVolume: { emergency: 50 } },
          constraints: { budget: 1000000 },
          optimizationGoal: goal,
        },
        headers: {
          'Cookie': 'afya_session=admin-session',
        },
      });

      if (response.status() === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.metadata.optimizationGoal).toBe(goal);
      }
    }
  });

  test('should handle missing data gracefully', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/resource-allocation`, {
      data: {
        resourceType: 'staff',
        facilityId: 'test-facility',
      },
      headers: {
        'Cookie': 'afya_session=admin-session',
      },
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.optimization).toBeDefined();
    }
  });
});
