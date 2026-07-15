import { createHmac } from 'crypto';
import { expect, test } from '@playwright/test';

const APP_ID = 'patient-mobile-app';
const APP_KEY = 'patient-key';
const SIGNING_SECRET = 'patient-signing-secret';
const ISSUE_PATH = '/api/apps/auth/issue';
const REFRESH_PATH = '/api/apps/auth/refresh';
const INTROSPECT_PATH = '/api/apps/auth/introspect';

let timestampCounter = 0;

function nextTimestamp(): string {
  timestampCounter += 1;
  return String(Date.now() + timestampCounter);
}

function signRequest(path: string, timestamp: string, secret = SIGNING_SECRET): string {
  const payload = `POST\n${path}\n${timestamp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function signedHeaders(
  path: string,
  options?: {
    appKey?: string;
    signingSecret?: string;
  },
) {
  const timestamp = nextTimestamp();
  return {
    'content-type': 'application/json',
    'x-afyahero-app-id': APP_ID,
    'x-afyahero-app-key': options?.appKey ?? APP_KEY,
    'x-afyahero-timestamp': timestamp,
    'x-afyahero-signature': signRequest(path, timestamp, options?.signingSecret),
  };
}

test.describe('App auth lifecycle endpoints', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ browserName }) => browserName !== 'chromium', 'Run API lifecycle tests once');

  test('POST /api/apps/auth/issue returns token set for valid signed app request', async ({ request }) => {
    const response = await request.post(ISSUE_PATH, {
      headers: signedHeaders(ISSUE_PATH),
      data: { patientId: 'patient_123' },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.expiresIn).toBe(900);
  });

  test('POST /api/apps/auth/issue rejects invalid signature', async ({ request }) => {
    const response = await request.post(ISSUE_PATH, {
      headers: signedHeaders(ISSUE_PATH, { signingSecret: 'wrong-signing-secret' }),
      data: { patientId: 'patient_123' },
    });
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/apps/auth/issue rejects invalid app credentials', async ({ request }) => {
    const response = await request.post(ISSUE_PATH, {
      headers: signedHeaders(ISSUE_PATH, { appKey: 'wrong-app-key' }),
      data: { patientId: 'patient_123' },
    });
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/apps/auth/refresh rotates refresh token from issued token set', async ({ request }) => {
    const issueResponse = await request.post(ISSUE_PATH, {
      headers: signedHeaders(ISSUE_PATH),
      data: { patientId: 'patient_456' },
    });
    expect(issueResponse.status()).toBe(200);
    const issued = await issueResponse.json();

    const refreshResponse = await request.post(REFRESH_PATH, {
      data: { refreshToken: issued.refreshToken },
    });
    expect(refreshResponse.status()).toBe(200);

    const refreshed = await refreshResponse.json();
    expect(refreshed.ok).toBe(true);
    expect(typeof refreshed.accessToken).toBe('string');
    expect(typeof refreshed.refreshToken).toBe('string');
    expect(refreshed.refreshToken).not.toBe(issued.refreshToken);
    expect(refreshed.expiresIn).toBe(900);
  });

  test('POST /api/apps/auth/refresh rejects invalid refresh token', async ({ request }) => {
    const response = await request.post(REFRESH_PATH, {
      data: { refreshToken: 'not-a-valid-refresh-token' },
    });
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/apps/auth/introspect reports active token details', async ({ request }) => {
    const issueResponse = await request.post(ISSUE_PATH, {
      headers: signedHeaders(ISSUE_PATH),
      data: { patientId: 'patient_789' },
    });
    expect(issueResponse.status()).toBe(200);
    const issued = await issueResponse.json();

    const introspectResponse = await request.post(INTROSPECT_PATH, {
      data: { accessToken: issued.accessToken },
    });
    expect(introspectResponse.status()).toBe(200);

    const body = await introspectResponse.json();
    expect(body.ok).toBe(true);
    expect(body.active).toBe(true);
    expect(body.appId).toBe(APP_ID);
    expect(body.appType).toBe('patient_app');
    expect(body.subjectType).toBe('patient');
    expect(body.subjectId).toBe('patient_789');
  });

  test('POST /api/apps/auth/introspect marks invalid token as inactive', async ({ request }) => {
    const response = await request.post(INTROSPECT_PATH, {
      data: { accessToken: 'invalid-access-token' },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.active).toBe(false);
  });
});
