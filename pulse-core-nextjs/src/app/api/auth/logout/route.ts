import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { enforceApiRateLimit, enforceRequestFirewall, enforceTrustedOrigin } from '@/lib/api-security';

function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    maxAge: 0,
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function POST(request: NextRequest) {
  const firewall = enforceRequestFirewall(request);
  if (firewall) return firewall;
  const originCheck = enforceTrustedOrigin(request);
  if (originCheck) return originCheck;
  const rateLimit = await enforceApiRateLimit(request, 'api:auth:logout');
  if (rateLimit) return rateLimit;
  return clearSessionCookie(NextResponse.json({ ok: true }));
}

export async function GET(request: NextRequest) {
  const firewall = enforceRequestFirewall(request);
  if (firewall) return firewall;
  const rateLimit = await enforceApiRateLimit(request, 'api:auth:logout');
  if (rateLimit) return rateLimit;
  const redirectParam = request.nextUrl.searchParams.get('redirect');
  const redirectTarget = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/';
  const response = NextResponse.redirect(new URL(redirectTarget, request.url));
  return clearSessionCookie(response);
}
