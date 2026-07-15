import { NextRequest, NextResponse } from 'next/server';
import { PORTALS } from '@/types';
import type { PortalRole, UserSession } from '@/types';
import { SESSION_COOKIE, getInitials } from '@/lib/auth';
import { signSession } from '@/lib/session';
import { isDemoEnabled } from '@/lib/env';
import { enforceApiRateLimit, enforceRequestFirewall, enforceTrustedOrigin, readJsonBody, enforceLoginRateLimit } from '@/lib/api-security';
import { DemoLoginSchema } from '@/lib/schemas';
import { verifyPassword } from '@/lib/password';
import { auditAuthSuccess, auditAuthFailure } from '@/lib/audit-logging';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';

// Demo credentials — matched server-side so they never hit Supabase
const DEMO_USERS: Record<string, { role: PortalRole; subrole?: string; name: string; title: string }> = {
  'demo@reception.afyahero.com': { role: 'reception', name: 'Mary Njeri', title: 'Senior Receptionist' },
  'demo@billing.afyahero.com': { role: 'reception', subrole: 'billing', name: 'John Kamau', title: 'Senior Billing Officer' },
  'demo@medical.afyahero.com': { role: 'medical', subrole: 'doctor', name: 'Dr. Amina Osei', title: 'Senior Medical Officer' },
  'demo@nurse.afyahero.com': { role: 'medical', subrole: 'nurse', name: 'Nurse Jane Wambui', title: 'Registered Nurse' },
  'demo@lab.afyahero.com': { role: 'lab', name: 'Kevin Mwangi', title: 'Senior Lab Technician' },
  'demo@pharmacy.afyahero.com': { role: 'pharmacy', name: 'Grace Otieno', title: 'Clinical Pharmacist' },
  'demo@admin.afyahero.com': { role: 'admin', name: 'Dr. Samuel Kiprotich', title: 'Hospital Administrator' },
};

// Demo password hash must be set via DEMO_PASSWORD_HASH env var.
const DEMO_PASSWORD_HASH = process.env.DEMO_PASSWORD_HASH ?? '';
const HAS_CUSTOM_DEMO_PASSWORD_HASH = Boolean(process.env.DEMO_PASSWORD_HASH);

export async function POST(req: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(req);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(req);
    if (originCheck) return originCheck;

    if (isStandaloneSuperAdminMode()) {
      return NextResponse.json(
        { error: 'Demo login is disabled in standalone superadmin mode.' },
        { status: 403 },
      );
    }

    // ── Stricter rate limiting for login attempts (brute-force protection) ────
    const loginRateLimit = await enforceLoginRateLimit(req);
    if (loginRateLimit) return loginRateLimit;

    // ── General API rate limiting ────────────────────────────────────────────
    const rateLimit = await enforceApiRateLimit(req, 'api:auth:demo-login');
    if (rateLimit) return rateLimit;

    // Gate demo login in production unless explicitly enabled
    if (!isDemoEnabled()) {
      return NextResponse.json(
        { error: 'Demo login is disabled in this environment.' },
        { status: 403 }
      );
    }

    if (!DEMO_PASSWORD_HASH) {
      return NextResponse.json(
        { error: 'Demo login is not configured (DEMO_PASSWORD_HASH is missing).' },
        { status: 503 },
      );
    }

    if (process.env.NODE_ENV !== 'development' && !HAS_CUSTOM_DEMO_PASSWORD_HASH) {
      return NextResponse.json(
        { error: 'Demo login requires DEMO_PASSWORD_HASH in this environment.' },
        { status: 503 },
      );
    }

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    const parsed = DemoLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload.',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    if (!email) {
      return NextResponse.json({ error: 'Email is required for demo login.' }, { status: 400 });
    }
    const clientIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    const normalizedEmail = email.toLowerCase();
    const demo = DEMO_USERS[normalizedEmail];
    const passwordOk = await verifyPassword(password, DEMO_PASSWORD_HASH);
    if (!demo || !passwordOk) {
      // Log failed authentication attempt (KDPA audit trail)
      await auditAuthFailure(
        normalizedEmail,
        clientIp,
        userAgent,
        'Invalid credentials'
      );
      return NextResponse.json({ error: 'Invalid demo credentials.' }, { status: 401 });
    }

    const session: UserSession = {
      id: `demo-${demo.role}${demo.subrole ? `-${demo.subrole}` : ''}`,
      email: normalizedEmail,
      role: demo.role,
      ...(demo.subrole ? { subrole: demo.subrole } : {}),
      name: demo.name,
      title: demo.title,
      hospitalId: 'demo-hospital',
      hospitalName: 'Afya Demo Hospital',
      initials: getInitials(demo.name),
      demo: true,
      approved: true,
      issuedAt: Date.now(),
      lastActivityAt: Date.now(),
      aiConsentGiven: false,  // User must opt-in to external AI
    };

    // Log successful authentication (KDPA audit trail)
    await auditAuthSuccess(
      session.id,
      demo.role,
      session.hospitalId,
      clientIp,
      userAgent
    );

    const response = NextResponse.json({
      ok: true,
      redirect: PORTALS[demo.role].portalPath,
      session,
    });

    // Set session cookie (httpOnly, 8-hour session)
    response.cookies.set(SESSION_COOKIE, signSession(session), {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
