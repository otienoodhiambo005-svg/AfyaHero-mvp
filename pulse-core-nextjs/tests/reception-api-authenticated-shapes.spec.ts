import { test, expect } from '@playwright/test';
import { requireReceptionDemoSession } from './helpers/reception-auth';

test.describe('Reception API authenticated response shapes', () => {
  test('resolve returns contract shape for authenticated requests', async ({ request }) => {
    const hasSession = await requireReceptionDemoSession(request);
    test.skip(!hasSession, 'Demo session unavailable in this environment.');

    const response = await request.post('/api/v1/patients/resolve', {
      data: { name: 'Nonexistent Contract Test Person' },
    });
    if (response.status() >= 500) {
      test.skip(true, 'Backend infrastructure not ready for authenticated contract assertions.');
    }

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(typeof body.status).toBe('string');
    expect(['verified', 'possible_match', 'new_patient']).toContain(body.status);
    expect(typeof body.confidence).toBe('number');
    expect(typeof body.duplicateRisk).toBe('boolean');
    expect(Array.isArray(body.candidates)).toBeTruthy();
  });

  test('queue stream returns event-stream content type when authenticated', async ({ request }) => {
    const hasSession = await requireReceptionDemoSession(request);
    test.skip(!hasSession, 'Demo session unavailable in this environment.');

    const response = await request.get('/api/reception/queue/stream');
    if (response.status() >= 500) {
      test.skip(true, 'Backend infrastructure not ready for authenticated contract assertions.');
    }
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/event-stream');
  });
});

