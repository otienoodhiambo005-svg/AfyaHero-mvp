import { NextRequest, NextResponse } from 'next/server';
import { withAuthzAndTenant } from '@/lib/middleware/withAuthzAndTenant';
import type { UserSession } from '@/types';

const getSessionFromRequest = jest.fn<UserSession | null, [NextRequest]>();
const enforceApiGuard = jest.fn<Promise<{ session: UserSession | null; response: NextResponse | null }>, [NextRequest, unknown]>();

jest.mock('@/lib/api-security', () => ({
  enforceApiGuard: (req: NextRequest, options: unknown) => enforceApiGuard(req, options),
  getSessionFromRequest: (req: NextRequest) => getSessionFromRequest(req),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

function makeRequest(url = 'http://localhost:3003/api/admin/dashboard'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Admin User',
    title: 'Administrator',
    hospitalId: 'hospital-1',
    hospitalName: 'Afya Hospital',
    issuedAt: 1,
    lastActivityAt: 1,
    ...overrides,
  };
}

describe('withAuthzAndTenant', () => {
  beforeEach(() => {
    getSessionFromRequest.mockReset();
    enforceApiGuard.mockReset();
    enforceApiGuard.mockResolvedValue({ session: null, response: null });
  });

  it('passes normalized tenant context from a valid hospital session', async () => {
    getSessionFromRequest.mockReturnValue(makeSession({ hospitalId: ' hospital-1 ' }));
    const handler = jest.fn(async (_req: NextRequest, ctx) => NextResponse.json(ctx));
    const guarded = withAuthzAndTenant(handler, ['admin']);

    const response = await guarded(makeRequest());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.any(NextRequest), {
      hospitalId: 'hospital-1',
      userId: 'user-1',
      role: 'admin',
    });
  });

  it('rejects sessions with placeholder hospital tenant context', async () => {
    getSessionFromRequest.mockReturnValue(makeSession({ hospitalId: 'unknown' }));
    const handler = jest.fn(async () => NextResponse.json({ ok: true }));
    const guarded = withAuthzAndTenant(handler, ['admin']);

    const response = await guarded(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects non-hospital tenant roles on tenant-scoped routes', async () => {
    getSessionFromRequest.mockReturnValue(makeSession({ role: 'super_admin' }));
    const handler = jest.fn(async () => NextResponse.json({ ok: true }));
    const guarded = withAuthzAndTenant(handler, ['admin']);

    const response = await guarded(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
  });
});
