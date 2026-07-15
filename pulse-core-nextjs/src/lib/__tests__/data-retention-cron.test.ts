import { NextRequest } from 'next/server';
import { POST } from '@/app/api/cron/data-retention/route';

const ORIGINAL_ENV = process.env;

describe('POST /api/cron/data-retention', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 401 when Authorization bearer is missing or wrong', async () => {
    process.env.DATA_RETENTION_CRON_SECRET = 'test-retention-secret';

    const req = new NextRequest('http://localhost/api/cron/data-retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when cron secret is not configured', async () => {
    delete process.env.DATA_RETENTION_CRON_SECRET;

    const req = new NextRequest('http://localhost/api/cron/data-retention', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer anything',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dryRun: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 503 when DATABASE_URL is not configured', async () => {
    process.env.DATA_RETENTION_CRON_SECRET = 'test-retention-secret';
    delete process.env.DATABASE_URL;

    const req = new NextRequest('http://localhost/api/cron/data-retention', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-retention-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dryRun: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/DATABASE_URL/i);
  });
});
