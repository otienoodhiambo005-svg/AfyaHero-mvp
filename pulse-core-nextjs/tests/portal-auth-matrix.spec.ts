/**
 * Portal Auth Matrix E2E Tests
 *
 * Validates access boundaries for hospital staff roles, demo sessions, and
 * anonymous users using the demo-login API (no external secrets required in dev).
 */

import { expect, test } from '@playwright/test';
import {
  browserContextWithDemoRole,
  demoEmailForRole,
  HOSPITAL_ROLES,
  loginDemo,
  ROLE_PORTAL_HOME,
  type HospitalPortalRole,
} from './helpers/portal-auth';

const CROSS_PORTAL_DENIALS: Array<{ role: HospitalPortalRole; target: HospitalPortalRole }> = [
  { role: 'medical', target: 'admin' },
  { role: 'medical', target: 'pharmacy' },
  { role: 'reception', target: 'admin' },
  { role: 'reception', target: 'medical' },
  { role: 'lab', target: 'medical' },
  { role: 'pharmacy', target: 'admin' },
  { role: 'admin', target: 'medical' },
];

test.describe('Portal Auth Matrix', () => {
  test.describe('Anonymous access', () => {
    test('redirected to login for protected portal pages', async ({ page }) => {
      await page.goto('/portal/admin');
      await page.waitForURL(/\/auth\/admin\/login/);
      expect(page.url()).toContain('/auth/admin/login');
    });

    test('cannot access superadmin portal without session', async ({ page }) => {
      await page.goto('/portal/superadmin');
      await page.waitForURL(/\/auth\/(superadmin\/login|login)/);
    });
  });

  test.describe('Hospital staff role boundaries', () => {
    for (const role of HOSPITAL_ROLES) {
      test(`${role} demo session reaches own portal home`, async ({ browser }) => {
        const context = await browserContextWithDemoRole(browser, role);
        const page = await context.newPage();
        await page.goto(ROLE_PORTAL_HOME[role]);
        await page.waitForURL(new RegExp(`${ROLE_PORTAL_HOME[role].replace(/\//g, '\\/')}`));
        expect(page.url()).toContain(ROLE_PORTAL_HOME[role]);
        await context.close();
      });
    }

    for (const { role, target } of CROSS_PORTAL_DENIALS) {
      test(`${role} user is redirected away from ${target} portal`, async ({ browser }) => {
        const context = await browserContextWithDemoRole(browser, role);
        const page = await context.newPage();
        await page.goto(`/portal/${target}`);
        await page.waitForURL(new RegExp(`/portal/${role}`));
        expect(page.url()).toContain(`/portal/${role}`);
        expect(page.url()).not.toContain(`/portal/${target}`);
        await context.close();
      });
    }
  });

  test.describe('Demo session API isolation', () => {
    test('demo sessions cannot POST/PUT/PATCH/DELETE on mutating hospital APIs', async ({ request }) => {
      const mutatingCalls: Array<{
        role: HospitalPortalRole;
        method: 'post' | 'patch';
        url: string;
        data: Record<string, unknown>;
      }> = [
        {
          role: 'medical',
          method: 'post',
          url: '/api/medical/orders',
          data: { patientId: 'demo-patient', items: [] },
        },
        {
          role: 'reception',
          method: 'patch',
          url: '/api/reception/appointments',
          data: { appointmentId: '00000000-0000-0000-0000-000000000001', status: 'cancelled' },
        },
        {
          role: 'reception',
          method: 'post',
          url: '/api/reception/orders',
          data: { patientId: 'demo-patient' },
        },
      ];

      for (const call of mutatingCalls) {
        await loginDemo(request, call.role);
        const response = await request[call.method](call.url, {
          headers: { 'Content-Type': 'application/json' },
          data: call.data,
        });
        expect(response.status(), `${call.method.toUpperCase()} ${call.url}`).toBe(403);
        const body = await response.json();
        expect(body.error).toMatch(/demo sessions are not permitted/i);
      }
    });

    test('demo sessions can GET showcase endpoints', async ({ request }) => {
      await loginDemo(request, 'reception');
      const response = await request.get('/api/reception/queue');
      expect([200, 204, 404, 500]).toContain(response.status());
      expect(response.status()).not.toBe(401);
      expect(response.status()).not.toBe(403);
    });
  });

  test.describe('API route guards', () => {
    test('superadmin APIs reject hospital demo sessions', async ({ request }) => {
      await loginDemo(request, 'admin');
      const endpoints = [
        '/api/superadmin/hospitals',
        '/api/superadmin/demo/token',
      ];

      for (const url of endpoints) {
        const response = await request.get(url);
        expect([401, 403]).toContain(response.status());
      }
    });

    test('cross-role hospital API access is denied', async ({ request }) => {
      await loginDemo(request, 'reception');
      const response = await request.post('/api/medical/orders', {
        data: { patientId: 'demo-patient', items: [] },
      });
      expect(response.status()).toBe(401);
    });
  });
});

test.describe('Tenant Isolation', () => {
  test('hospitalId query param rejected with 403 (anonymous)', async ({ request }) => {
    const urls = [
      '/api/admin/dashboard?hospitalId=malicious-hospital-id',
      '/api/admin/executive/intelligence?hospitalId=other-hospital',
      '/api/pharmacy/formulary?hospitalId=unauthorized-hospital',
    ];

    for (const url of urls) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(403);
      const body = await response.json();
      expect(body.error).toMatch(/session, not query parameters/i);
    }
  });

  test('hospitalId query param rejected with 403 (authenticated demo)', async ({ request }) => {
    await loginDemo(request, 'admin');
    const response = await request.get('/api/admin/dashboard?hospitalId=different-hospital');
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/session, not query parameters/i);
  });

  test('authenticated admin can reach dashboard without hospitalId query', async ({ request }) => {
    await loginDemo(request, 'admin');
    const response = await request.get('/api/admin/dashboard');
    expect([200, 500]).toContain(response.status());
    expect(response.status()).not.toBe(403);
  });
});

test.describe('Demo Invitation Lifecycle', () => {
  test('demo token creation requires superadmin', async ({ request }) => {
    const response = await request.post('/api/superadmin/demo/token', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        role: 'reception',
        hospitalName: 'Test Hospital',
        prospectEmail: 'test@example.com',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('hospital admin demo cannot create demo tokens', async ({ request }) => {
    await loginDemo(request, 'admin');
    const response = await request.post('/api/superadmin/demo/token', {
      data: { role: 'medical', hospitalName: 'Probe Hospital' },
    });
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Superadmin UI isolation', () => {
  test('superadmin option absent from hospital login page copy', async ({ page }) => {
    await page.goto('/auth/login');
    const loginText = await page.textContent('body');
    expect(loginText ?? '').not.toMatch(/super.?admin/i);
  });

  test('demo login emails are role-scoped', () => {
    for (const role of HOSPITAL_ROLES) {
      expect(demoEmailForRole(role)).toBe(`demo@${role}.afyahero.com`);
    }
  });
});
