import { createHmac } from 'crypto';
import { expect, test } from '@playwright/test';
import type { APIResponse } from '@playwright/test';

import { loginDemo } from './helpers/portal-auth';

const TOKEN_SECRET = 'test-token-secret-0123456789abcdef-0123456789abcdef';

const appConfigs = {
  patientRead: {
    appId: 'patient-mobile-app',
    appKey: 'patient-key',
    signingSecret: 'patient-signing-secret',
    hospitalId: 'hospital_test',
    appType: 'patient_app' as const,
    scopes: ['fhir:read'] as const,
  },
  chpReadWrite: {
    appId: 'chp-mobile-app',
    appKey: 'chp-key',
    signingSecret: 'chp-signing-secret',
    hospitalId: 'hospital_test',
    appType: 'chp_app' as const,
    scopes: ['fhir:read', 'fhir:write'] as const,
  },
  chpReadOnly: {
    appId: 'chp-readonly-app',
    appKey: 'chp-readonly-key',
    signingSecret: 'chp-readonly-signing-secret',
    hospitalId: 'hospital_test',
    appType: 'chp_app' as const,
    scopes: ['fhir:read'] as const,
  },
} as const;

function signatureFor(method: string, pathAndQuery: string, timestampMs: string, signingSecret: string): string {
  const payload = `${method.toUpperCase()}\n${pathAndQuery}\n${timestampMs}`;
  return createHmac('sha256', signingSecret).update(payload).digest('hex');
}

function signedHeaders(
  method: string,
  pathAndQuery: string,
  app: (typeof appConfigs)[keyof typeof appConfigs],
  extra?: Record<string, string>,
): Record<string, string> {
  const timestampMs = Date.now().toString();
  return {
    'x-afyahero-app-id': app.appId,
    'x-afyahero-app-key': app.appKey,
    'x-afyahero-timestamp': timestampMs,
    'x-afyahero-signature': signatureFor(method, pathAndQuery, timestampMs, app.signingSecret),
    ...extra,
  };
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function bearerToken(params: {
  appId: string;
  hospitalId: string;
  appType: 'patient_app' | 'chp_app';
  scopes: Array<'fhir:read' | 'fhir:write'>;
  subjectType?: 'patient' | 'chp';
  subjectId?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    appId: params.appId,
    appType: params.appType,
    hospitalId: params.hospitalId,
    scopes: params.scopes,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    iss: 'afyahero-hospital-os',
    aud: 'afyahero-v1-app-api',
    iat: now,
    exp: now + 15 * 60,
    kind: 'access',
    nonce: `nonce-${Date.now()}`,
  };
  const headerPart = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', TOKEN_SECRET).update(`${headerPart}.${payloadPart}`).digest('base64url');
  return `${headerPart}.${payloadPart}.${signature}`;
}

async function json(response: APIResponse): Promise<unknown> {
  return response.json();
}

test.describe('App routes auth matrix', () => {
  test('Bearer-first: invalid bearer does not fall back to signed headers', async ({ request }) => {
    const patientMeResponse = await request.get('/api/apps/patient/me', {
      headers: signedHeaders('GET', '/api/apps/patient/me', appConfigs.patientRead, {
        'x-afyahero-patient-id': 'patient-123',
        authorization: 'Bearer definitely-invalid',
      }),
    });
    expect(patientMeResponse.status()).toBe(401);
    await expect(json(patientMeResponse)).resolves.toMatchObject({ error: { status: 401 } });

    const appointmentsResponse = await request.get('/api/apps/patient/appointments?limit=1', {
      headers: signedHeaders('GET', '/api/apps/patient/appointments?limit=1', appConfigs.patientRead, {
        'x-afyahero-patient-id': 'patient-123',
        authorization: 'Bearer definitely-invalid',
      }),
    });
    expect(appointmentsResponse.status()).toBe(401);
    await expect(json(appointmentsResponse)).resolves.toMatchObject({ error: { status: 401 } });

    const chpPatientsResponse = await request.get('/api/apps/chp/patients?region=na', {
      headers: signedHeaders('GET', '/api/apps/chp/patients?region=na', appConfigs.chpReadWrite, {
        authorization: 'Bearer definitely-invalid',
      }),
    });
    expect(chpPatientsResponse.status()).toBe(401);
    await expect(json(chpPatientsResponse)).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });

    const chpVisitResponse = await request.post('/api/apps/chp/visit-notes', {
      headers: signedHeaders('POST', '/api/apps/chp/visit-notes', appConfigs.chpReadWrite, {
        authorization: 'Bearer definitely-invalid',
        'content-type': 'application/json',
      }),
      data: { patientId: '00000000-0000-0000-0000-000000000000', note: 'hello world' },
    });
    expect(chpVisitResponse.status()).toBe(401);
    await expect(json(chpVisitResponse)).resolves.toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  });

  test('Signed-header fallback works when bearer is missing', async ({ request }) => {
    const patientMeResponse = await request.get('/api/apps/patient/me', {
      headers: signedHeaders('GET', '/api/apps/patient/me', appConfigs.patientRead, {
        'x-afyahero-patient-id': 'patient-123',
      }),
    });
    expect(patientMeResponse.status()).toBe(200);
    await expect(json(patientMeResponse)).resolves.toMatchObject({
      patient: { id: 'patient-123', hospitalId: appConfigs.patientRead.hospitalId },
      app: { id: appConfigs.patientRead.appId, authMethod: 'signed_headers' },
    });

    const appointmentsResponse = await request.get('/api/apps/patient/appointments?limit=abc', {
      headers: signedHeaders('GET', '/api/apps/patient/appointments?limit=abc', appConfigs.patientRead, {
        'x-afyahero-patient-id': 'patient-123',
      }),
    });
    expect(appointmentsResponse.status()).toBe(400);
    await expect(json(appointmentsResponse)).resolves.toMatchObject({ error: 'Invalid query parameters.' });

    const chpPatientsResponse = await request.get('/api/apps/chp/patients?region=a', {
      headers: signedHeaders('GET', '/api/apps/chp/patients?region=a', appConfigs.chpReadWrite),
    });
    expect(chpPatientsResponse.status()).toBe(400);
    await expect(json(chpPatientsResponse)).resolves.toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });

    const chpVisitResponse = await request.post('/api/apps/chp/visit-notes', {
      headers: signedHeaders('POST', '/api/apps/chp/visit-notes', appConfigs.chpReadWrite, {
        'content-type': 'application/json',
      }),
      data: '{',
    });
    expect(chpVisitResponse.status()).toBe(400);
    await expect(json(chpVisitResponse)).resolves.toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
  });

  test('Deny wrong app type or scope for bearer and signed-header auth', async ({ request }) => {
    const wrongTypeForPatient = bearerToken({
      appId: appConfigs.chpReadWrite.appId,
      hospitalId: appConfigs.chpReadWrite.hospitalId,
      appType: 'chp_app',
      scopes: ['fhir:read', 'fhir:write'],
      subjectType: 'chp',
      subjectId: 'chp-01',
    });
    const patientBearerDeny = await request.get('/api/apps/patient/me', {
      headers: { authorization: `Bearer ${wrongTypeForPatient}` },
    });
    expect(patientBearerDeny.status()).toBe(403);
    await expect(json(patientBearerDeny)).resolves.toMatchObject({ error: { status: 403 } });

    const patientSignedWrongType = await request.get('/api/apps/patient/appointments?limit=abc', {
      headers: signedHeaders('GET', '/api/apps/patient/appointments?limit=abc', appConfigs.chpReadWrite, {
        'x-afyahero-patient-id': 'patient-123',
      }),
    });
    expect(patientSignedWrongType.status()).toBe(403);
    await expect(json(patientSignedWrongType)).resolves.toMatchObject({ error: { status: 403 } });

    const wrongTypeForChp = bearerToken({
      appId: appConfigs.patientRead.appId,
      hospitalId: appConfigs.patientRead.hospitalId,
      appType: 'patient_app',
      scopes: ['fhir:read'],
      subjectType: 'patient',
      subjectId: 'patient-123',
    });
    const chpBearerWrongType = await request.get('/api/apps/chp/patients?region=na', {
      headers: { authorization: `Bearer ${wrongTypeForChp}` },
    });
    expect(chpBearerWrongType.status()).toBe(403);
    await expect(json(chpBearerWrongType)).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const insufficientScopeForWrite = bearerToken({
      appId: appConfigs.chpReadOnly.appId,
      hospitalId: appConfigs.chpReadOnly.hospitalId,
      appType: 'chp_app',
      scopes: ['fhir:read'],
      subjectType: 'chp',
      subjectId: 'chp-01',
    });
    const chpWriteBearerDeny = await request.post('/api/apps/chp/visit-notes', {
      headers: {
        authorization: `Bearer ${insufficientScopeForWrite}`,
        'content-type': 'application/json',
      },
      data: { patientId: '00000000-0000-0000-0000-000000000000', note: 'hello world' },
    });
    expect(chpWriteBearerDeny.status()).toBe(403);
    await expect(json(chpWriteBearerDeny)).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const chpWriteSignedDeny = await request.post('/api/apps/chp/visit-notes', {
      headers: signedHeaders('POST', '/api/apps/chp/visit-notes', appConfigs.chpReadOnly, {
        'content-type': 'application/json',
      }),
      data: { patientId: '00000000-0000-0000-0000-000000000000', note: 'hello world' },
    });
    expect(chpWriteSignedDeny.status()).toBe(403);
    await expect(json(chpWriteSignedDeny)).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  test('Rate-limit returns deterministic 429 with expected payload shape', async ({ request }) => {
    const response = await request.get('/api/apps/patient/me', {
      headers: signedHeaders('GET', '/api/apps/patient/me', appConfigs.patientRead, {
        'x-afyahero-patient-id': 'patient-123',
        'x-afyahero-test-force-rate-limit': '1',
      }),
    });

    expect(response.status()).toBe(429);
    await expect(json(response)).resolves.toMatchObject({
      error: {
        status: 429,
        message: expect.any(String),
      },
    });
  });

  test('Portal demo session cookie does not authorize developer app APIs', async ({ request }) => {
    await loginDemo(request, 'admin');
    const response = await request.get('/api/apps/patient/me', {
      headers: { 'x-afyahero-patient-id': 'patient-123' },
    });
    expect(response.status()).toBe(401);
  });
});
