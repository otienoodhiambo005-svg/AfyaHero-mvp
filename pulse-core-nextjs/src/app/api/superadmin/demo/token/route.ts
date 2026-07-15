/**
 * Demo Session Token Management
 * Only superadmins can generate demo tokens for hospital showcases.
 *
 * Tokens are signed sessions distributed to prospects; their SHA-256 hash
 * is persisted in the DemoInvitation table to enable revocation, expiry
 * enforcement, and usage tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { signSession, generateToken } from '@/lib/session';
import type { UserSession, PortalRole } from '@/types';
import { readJsonBody } from '@/lib/api-security';
import { requireSuperAdminApi } from '@/lib/auth-guards';
import { isDemoEnabled } from '@/lib/env';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';
import {
  createDemoInvitation,
  hashDemoToken,
  listRecentDemoInvitations,
} from '@/lib/demo-invitations';

const DEMO_TOKEN_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

interface DemoTokenPayload {
  token: string;
  role: PortalRole;
  hospitalName: string;
  expiresAt: string;
  showcaseUrl: string;
  invitationId: string;
}

const DEMO_PERSONAS: Record<PortalRole, { name: string; title: string }> = {
  reception: { name: 'Mary Njeri', title: 'Senior Receptionist' },
  medical: { name: 'Dr. Amina Osei', title: 'Senior Medical Officer' },
  lab: { name: 'Kevin Mwangi', title: 'Senior Lab Technician' },
  pharmacy: { name: 'Grace Otieno', title: 'Clinical Pharmacist' },
  admin: { name: 'Dr. Samuel Kiprotich', title: 'Hospital Administrator' },
  super_admin: { name: 'System Administrator', title: 'Super Administrator' },
};

const SHOWCASEABLE_ROLES: PortalRole[] = ['reception', 'medical', 'lab', 'pharmacy', 'admin'];

export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdminApi(req, {
      scope: 'api:superadmin:demo-token',
      denyDemo: false,
    });
    if (guard.response) return guard.response;
    if (!guard.session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (isStandaloneSuperAdminMode() || !isDemoEnabled()) {
      return NextResponse.json(
        { error: 'Demo token generation is disabled in this environment.' },
        { status: 403 },
      );
    }

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    const parsedBody = body as Record<string, unknown>;
    const role = typeof parsedBody.role === 'string' ? parsedBody.role : undefined;
    const hospitalName = typeof parsedBody.hospitalName === 'string' ? parsedBody.hospitalName : undefined;
    const prospectEmail = typeof parsedBody.prospectEmail === 'string' ? parsedBody.prospectEmail : undefined;
    const prospectName = typeof parsedBody.prospectName === 'string' ? parsedBody.prospectName : undefined;
    const notes = typeof parsedBody.notes === 'string' ? parsedBody.notes : undefined;

    if (!role || !SHOWCASEABLE_ROLES.includes(role as PortalRole)) {
      return NextResponse.json({ error: 'Invalid demo role' }, { status: 400 });
    }

    const persona = DEMO_PERSONAS[role as PortalRole];
    const expiresAtMs = Date.now() + DEMO_TOKEN_EXPIRY_MS;
    const expiresAt = new Date(expiresAtMs);

    const demoSession: UserSession = {
      id: `demo-${role}-${generateToken(8)}`,
      email: prospectEmail || `demo+${generateToken(6)}@afyahero.com`,
      role: role as PortalRole,
      name: persona.name,
      title: persona.title,
      hospitalId: 'demo-hospital',
      hospitalName: hospitalName || 'Afya Demo Hospital',
      demo: true,
      approved: true,
      issuedAt: Date.now(),
      lastActivityAt: Date.now(),
      aiConsentGiven: false,
      initials: persona.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    };

    const token = signSession(demoSession);
    const tokenHash = hashDemoToken(token);

    const invitation = await createDemoInvitation({
      tokenHash,
      portalRole: role as PortalRole,
      hospitalName: demoSession.hospitalName,
      prospectEmail: prospectEmail ?? null,
      prospectName: prospectName ?? null,
      notes: notes ?? null,
      createdById: guard.session.id,
      expiresAt,
    });

    const showcaseUrl = `/demo?token=${encodeURIComponent(token)}`;

    logger.info('Demo invitation issued', {
      invitationId: invitation.id,
      superAdminId: guard.session.id,
      demoRole: role,
    });

    const payload: DemoTokenPayload = {
      token,
      role: role as PortalRole,
      hospitalName: demoSession.hospitalName,
      expiresAt: expiresAt.toISOString(),
      showcaseUrl,
      invitationId: invitation.id,
    };

    return NextResponse.json(payload);
  } catch (error) {
    logger.error('Demo token generation error', { error });
    return NextResponse.json({ error: 'Failed to generate demo token' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSuperAdminApi(req, {
      scope: 'api:superadmin:demo-token',
      denyDemo: false,
    });
    if (guard.response) return guard.response;

    if (isStandaloneSuperAdminMode() || !isDemoEnabled()) {
      return NextResponse.json(
        { error: 'Demo token inspection is disabled in this environment.' },
        { status: 403 },
      );
    }

    const recentDemos = await listRecentDemoInvitations({ withinDays: 30, limit: 100 });

    return NextResponse.json({
      recentDemos: recentDemos.map((inv) => ({
        id: inv.id,
        createdAt: inv.createdAt,
        createdBy: inv.createdById,
        role: inv.portalRole,
        hospitalName: inv.hospitalName,
        prospectEmail: inv.prospectEmail,
        prospectName: inv.prospectName,
        expiresAt: inv.expiresAt,
        revokedAt: inv.revokedAt,
        useCount: inv.useCount,
        firstUsedAt: inv.firstUsedAt,
        lastUsedAt: inv.lastUsedAt,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch demo sessions', { error });
    return NextResponse.json({ error: 'Failed to fetch demo sessions' }, { status: 500 });
  }
}
