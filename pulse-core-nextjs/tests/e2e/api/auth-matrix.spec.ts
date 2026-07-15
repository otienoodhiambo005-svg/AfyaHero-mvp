/**
 * Auth Matrix API E2E Tests
 *
 * Network-only checks for enforceApiGuard, withAuthzAndTenant, and demo-login.
 * Uses demo credentials from /api/auth/demo-login (enabled in development / ENABLE_DEMO_LOGIN).
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import {
  demoEmailForRole,
  HOSPITAL_ROLES,
  loginDemo,
  ROLE_PROBE_API_GET,
  type HospitalPortalRole,
} from '../../helpers/portal-auth';

const WITH_AUTHZ_TENANT_PATHS = [
  '/api/admin/dashboard',
  '/api/admin/executive/intelligence',
  '/api/pharmacy/formulary',
] as const;

test.describe('Auth matrix — demo login', () => {
  for (const role of HOSPITAL_ROLES) {
    test(`demo-login succeeds for ${role}`, async ({ baseURL }) => {
      const ctx = await pwRequest.newContext({ baseURL });
      await loginDemo(ctx, role);
      const me = await ctx.get(ROLE_PROBE_API_GET[role]);
      expect(me.status()).not.toBe(401);
      expect(me.status()).not.toBe(403);
      await ctx.dispose();
    });
  }
});

test.describe('Auth matrix — superadmin endpoints', () => {
  test('anonymous user cannot list demo invitations', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    const res = await ctx.get('/api/superadmin/demo/token');
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test('anonymous user cannot generate a demo token', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    const res = await ctx.post('/api/superadmin/demo/token', {
      data: { role: 'medical', hospitalName: 'Probe Hospital' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test('hospital admin demo session cannot generate demo tokens', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    await loginDemo(ctx, 'admin');
    const res = await ctx.post('/api/superadmin/demo/token', {
      data: { role: 'medical', hospitalName: 'Probe Hospital' },
    });
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });
});

test.describe('Auth matrix — demo isolation', () => {
  const mutatingCases = [
    { role: 'medical' as const, method: 'post' as const, url: '/api/medical/orders', data: { patientId: 'demo-patient', items: [] } },
    { role: 'reception' as const, method: 'post' as const, url: '/api/reception/orders', data: { patientId: 'demo-patient' } },
    { role: 'pharmacy' as const, method: 'post' as const, url: '/api/pharmacy/formulary', data: { genericName: 'Probe Drug' } },
    { role: 'admin' as const, method: 'patch' as const, url: '/api/reception/appointments', data: { appointmentId: '00000000-0000-0000-0000-000000000001', status: 'cancelled' } },
  ];

  for (const { role, method, url, data } of mutatingCases) {
    test(`demo ${role} session is blocked on ${method.toUpperCase()} ${url}`, async ({ baseURL }) => {
      const ctx = await pwRequest.newContext({ baseURL });
      await loginDemo(ctx, role);
      const res = await ctx[method](url, { data });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/demo sessions are not permitted/i);
      await ctx.dispose();
    });
  }

  test('demo session can GET reception queue', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    await loginDemo(ctx, 'reception');
    const res = await ctx.get('/api/reception/queue');
    expect([200, 204, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(403);
    await ctx.dispose();
  });
});

test.describe('Auth matrix — cross-role API', () => {
  const crossRoleCases: Array<{ actor: HospitalPortalRole; method: 'get' | 'post'; url: string; data?: Record<string, unknown> }> = [
    { actor: 'reception', method: 'post', url: '/api/medical/orders', data: { patientId: 'x', items: [] } },
    { actor: 'lab', method: 'get', url: '/api/admin/dashboard' },
    { actor: 'pharmacy', method: 'get', url: '/api/admin/dashboard' },
    { actor: 'medical', method: 'get', url: '/api/admin/dashboard' },
  ];

  for (const { actor, method, url, data } of crossRoleCases) {
    test(`${actor} cannot ${method.toUpperCase()} ${url}`, async ({ baseURL }) => {
      const ctx = await pwRequest.newContext({ baseURL });
      await loginDemo(ctx, actor);
      const res = data ? await ctx[method](url, { data }) : await ctx[method](url);
      expect([401, 403]).toContain(res.status());
      await ctx.dispose();
    });
  }
});

test.describe('Auth matrix — tenant query injection', () => {
  test('anonymous requests with hospitalId query return 403', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    for (const path of WITH_AUTHZ_TENANT_PATHS) {
      const res = await ctx.get(`${path}?hospitalId=evil-tenant`);
      expect(res.status(), path).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/session, not query parameters/i);
    }
    await ctx.dispose();
  });

  test('authenticated demo with hospitalId query still returns 403', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    await loginDemo(ctx, 'admin');
    const res = await ctx.get('/api/admin/dashboard?hospitalId=other-hospital');
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });
});

test.describe('Auth matrix — demo redemption lifecycle', () => {
  test('demo-setup with missing token returns 400', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    const res = await ctx.post('/api/auth/demo-setup', { data: {} });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });

  test('demo-setup with garbage token returns 400', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    const res = await ctx.post('/api/auth/demo-setup', {
      data: { token: 'not-a-real-token' },
    });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });
});

test.describe('Auth matrix — credential validation', () => {
  test('demo-login rejects unknown email', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    const res = await ctx.post('/api/auth/demo-login', {
      data: { email: 'not-a-demo-user@afyahero.com', password: 'Demo@1234' },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('demo-login accepts configured role emails', async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL });
    await loginDemo(ctx, 'reception');
    await ctx.dispose();
  });
});
