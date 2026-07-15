import { NextRequest } from 'next/server';
import { enforceTrustedOrigin, readJsonBody } from '@/lib/api-security';

const ORIGINAL_ENV = process.env;

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(),
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(jest.fn(), {
    slidingWindow: jest.fn(),
  }),
}));

function makeRequest(
  method: string,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest('http://localhost:3003/api/patients', {
    method,
    headers,
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('enforceTrustedOrigin', () => {
  it('allows safe methods without origin headers', () => {
    const response = enforceTrustedOrigin(makeRequest('GET'));

    expect(response).toBeNull();
  });

  it('blocks cross-site mutating requests that omit the Origin header', async () => {
    const response = enforceTrustedOrigin(makeRequest('POST', {
      'sec-fetch-site': 'cross-site',
    }));

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: 'Forbidden origin' });
  });

  it('allows mutating requests from the request origin', () => {
    const response = enforceTrustedOrigin(makeRequest('POST', {
      origin: 'http://localhost:3003',
      'sec-fetch-site': 'same-origin',
    }));

    expect(response).toBeNull();
  });

  it('blocks mutating requests from untrusted origins', () => {
    const response = enforceTrustedOrigin(makeRequest('POST', {
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
    }));

    expect(response?.status).toBe(403);
  });
});

describe('readJsonBody', () => {
  it('rejects invalid Content-Length headers', async () => {
    const response = await readJsonBody<Record<string, unknown>>(
      new NextRequest('http://localhost:3003/api/patients', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': 'abc',
        },
        body: JSON.stringify({ ok: true }),
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Content-Length must be a valid byte count.',
    });
  });

  it('enforces payload size after reading JSON bodies without a length header', async () => {
    process.env.MAX_API_BODY_BYTES = '16';

    const response = await readJsonBody<Record<string, unknown>>(
      new NextRequest('http://localhost:3003/api/patients', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ value: 'this body is too large' }),
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(413);
  });
});
