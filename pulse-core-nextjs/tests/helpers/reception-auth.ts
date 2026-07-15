import type { APIRequestContext } from '@playwright/test';
import { demoEmailForRole, DEMO_PASSWORD, loginDemo } from './portal-auth';

export async function tryReceptionDemoLogin(request: APIRequestContext) {
  return request.post('/api/auth/demo-login', {
    data: {
      email: demoEmailForRole('reception'),
      password: DEMO_PASSWORD,
    },
  });
}

export async function requireReceptionDemoSession(request: APIRequestContext): Promise<boolean> {
  const login = await tryReceptionDemoLogin(request);
  return login.ok();
}
