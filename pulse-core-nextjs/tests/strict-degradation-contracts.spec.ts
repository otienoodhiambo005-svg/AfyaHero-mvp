import { expect, test } from '@playwright/test';
import { requireReceptionDemoSession } from './helpers/reception-auth';

test.describe('Strict degradation contract', () => {
  test('data endpoint returns structured degradation payload when unavailable', async ({ request }) => {
    const hasSession = await requireReceptionDemoSession(request);
    test.skip(!hasSession, 'Demo session unavailable in this environment.');

    const response = await request.get('/api/data?entity=arrivals');

    if (response.status() !== 503) {
      test.skip(true, 'Strict degradation mode not active or primary data source is healthy.');
    }

    const body = await response.json();
    expect(body.code).toBe('DATA_SOURCE_UNAVAILABLE');
    expect(body.entity).toBe('arrivals');
    expect(body.source).toBe('primary');
    expect(body.retryable).toBe(true);
    expect(typeof body.error).toBe('string');
    expect(typeof body.detail).toBe('string');
  });

  test('teleconsult appointments endpoint returns structured degradation payload when unavailable', async ({ request }) => {
    const hasSession = await requireReceptionDemoSession(request);
    test.skip(!hasSession, 'Demo session unavailable in this environment.');

    const response = await request.get('/api/medical/teleconsultation/appointments');

    if (response.status() !== 503) {
      test.skip(true, 'Strict degradation mode not active or primary data source is healthy.');
    }

    const body = await response.json();
    expect(body.code).toBe('DATA_SOURCE_UNAVAILABLE');
    expect(body.entity).toBe('teleconsultAppointments');
    expect(body.source).toBe('primary');
    expect(body.retryable).toBe(true);
    expect(typeof body.error).toBe('string');
    expect(typeof body.detail).toBe('string');
  });

  test('ai analyze endpoint returns structured degradation payload when unavailable', async ({ request }) => {
    const hasSession = await requireReceptionDemoSession(request);
    test.skip(!hasSession, 'Demo session unavailable in this environment.');

    const response = await request.post('/api/ai/analyze', {
      data: {
        type: 'diagnostic',
        data: {
          symptoms: ['fever', 'headache'],
          context: 'Contract test request',
        },
      },
    });

    if (response.status() !== 503) {
      test.skip(true, 'Strict degradation mode not active or upstream AI providers are healthy.');
    }

    const body = await response.json();
    expect(body.code).toBe('DATA_SOURCE_UNAVAILABLE');
    expect(typeof body.entity).toBe('string');
    expect(body.entity).toContain('aiAnalyze');
    expect(body.source).toBe('primary');
    expect(body.retryable).toBe(true);
    expect(typeof body.error).toBe('string');
    expect(typeof body.detail).toBe('string');
  });
});

