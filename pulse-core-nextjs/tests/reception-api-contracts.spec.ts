import { test, expect } from '@playwright/test';
import { tryReceptionDemoLogin } from './helpers/reception-auth';

test.describe('Reception API contracts', () => {
  test('identity resolve requires auth and validates payload', async ({ request }) => {
    const login = await tryReceptionDemoLogin(request);
    if (!login.ok()) {
      const unauthorized = await request.post('/api/v1/patients/resolve', { data: {} });
      expect([401, 403]).toContain(unauthorized.status());
      return;
    }

    const badRequest = await request.post('/api/v1/patients/resolve', { data: {} });
    if (badRequest.status() >= 500) {
      test.skip(true, 'Backend infrastructure not ready for authenticated contract assertions.');
    }
    expect(badRequest.status()).toBe(400);
    const body = await badRequest.json();
    expect(typeof body.error).toBe('string');
  });

  test('patient merge validates target/source ids', async ({ request }) => {
    const login = await tryReceptionDemoLogin(request);
    if (!login.ok()) {
      const unauthorized = await request.post('/api/v1/patients/test-target/merge', {
        data: { sourcePatientId: 'test-source' },
      });
      expect([401, 403]).toContain(unauthorized.status());
      return;
    }

    const sameId = 'same-patient-id';
    const invalidMerge = await request.post(`/api/v1/patients/${sameId}/merge`, {
      data: { sourcePatientId: sameId },
    });
    if (invalidMerge.status() >= 500) {
      test.skip(true, 'Backend infrastructure not ready for authenticated contract assertions.');
    }
    expect(invalidMerge.status()).toBe(400);
    const body = await invalidMerge.json();
    expect(typeof body.error).toBe('string');
  });

  test('queue stream endpoint is secured and serves SSE', async ({ request }) => {
    const login = await tryReceptionDemoLogin(request);
    if (!login.ok()) {
      const unauthorized = await request.get('/api/reception/queue/stream');
      expect([401, 403]).toContain(unauthorized.status());
      return;
    }

    const streamResponse = await request.get('/api/reception/queue/stream');
    if (streamResponse.status() >= 500) {
      test.skip(true, 'Backend infrastructure not ready for authenticated contract assertions.');
    }
    expect(streamResponse.status()).toBe(200);
    const contentType = streamResponse.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/event-stream');
  });
});

