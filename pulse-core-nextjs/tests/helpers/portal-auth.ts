import { expect, type APIRequestContext, type Browser } from '@playwright/test';

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@1234';

export const HOSPITAL_ROLES = ['reception', 'medical', 'lab', 'pharmacy', 'admin'] as const;
export type HospitalPortalRole = (typeof HOSPITAL_ROLES)[number];

/** Default landing path per role (portal home / dashboard). */
export const ROLE_PORTAL_HOME: Record<HospitalPortalRole, string> = {
  reception: '/portal/reception',
  medical: '/portal/medical',
  lab: '/portal/lab',
  pharmacy: '/portal/pharmacy',
  admin: '/portal/admin',
};

/** Role-scoped GET endpoint used to verify demo session cookies after login. */
export const ROLE_PROBE_API_GET: Record<HospitalPortalRole, string> = {
  reception: '/api/reception/queue',
  medical: '/api/medical/orders',
  lab: '/api/lab/orders',
  pharmacy: '/api/pharmacy/queue',
  admin: '/api/admin/dashboard',
};

export function demoEmailForRole(role: HospitalPortalRole): string {
  return `demo@${role}.afyahero.com`;
}

/**
 * Establish a demo session on an API request context (sets session cookie).
 */
export async function loginDemo(
  request: APIRequestContext,
  role: HospitalPortalRole,
): Promise<void> {
  const response = await request.post('/api/auth/demo-login', {
    data: { email: demoEmailForRole(role), password: DEMO_PASSWORD },
    headers: { 'x-afyahero-test-skip-rate-limit': '1' },
  });
  expect(response.status(), `demo-login for ${role}`).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.redirect).toBe(ROLE_PORTAL_HOME[role]);
}

/**
 * Browser context with demo session cookies (shared with pages in the context).
 */
export async function browserContextWithDemoRole(browser: Browser, role: HospitalPortalRole) {
  const context = await browser.newContext();
  await loginDemo(context.request, role);
  return context;
}

/** Every ordered pair (actor, foreign portal) where actor is not the portal owner. */
export function crossPortalDenialCases(): Array<{ role: HospitalPortalRole; target: HospitalPortalRole }> {
  const out: Array<{ role: HospitalPortalRole; target: HospitalPortalRole }> = [];
  for (const role of HOSPITAL_ROLES) {
    for (const target of HOSPITAL_ROLES) {
      if (role !== target) out.push({ role, target });
    }
  }
  return out;
}
