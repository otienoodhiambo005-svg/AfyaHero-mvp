/**
 * Superadmin Demo Invitation - revoke endpoint.
 * DELETE /api/superadmin/demo/token/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireSuperAdminApi } from '@/lib/auth-guards';
import { isDemoEnabled } from '@/lib/env';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';
import { revokeDemoInvitation } from '@/lib/demo-invitations';
import { readJsonBody } from '@/lib/api-security';

interface RevokeBody {
  reason?: string;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireSuperAdminApi(req, {
      scope: 'api:superadmin:demo-token:revoke',
      denyDemo: false,
    });
    if (guard.response) return guard.response;
    if (!guard.session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (isStandaloneSuperAdminMode() || !isDemoEnabled()) {
      return NextResponse.json(
        { error: 'Demo invitation management is disabled in this environment.' },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invitation id is required.' }, { status: 400 });
    }

    let reason: string | undefined;
    if (req.headers.get('content-length') && Number(req.headers.get('content-length')) > 0) {
      const body = await readJsonBody<unknown>(req);
      if (body instanceof NextResponse) return body;
      const parsed = body as Partial<RevokeBody>;
      reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : undefined;
    }

    const updated = await revokeDemoInvitation({
      invitationId: id,
      revokedById: guard.session.id,
      reason,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    logger.info('Demo invitation revoked via API', {
      invitationId: updated.id,
      superAdminId: guard.session.id,
    });

    return NextResponse.json({
      ok: true,
      invitationId: updated.id,
      revokedAt: updated.revokedAt,
      revokedReason: updated.revokedReason,
    });
  } catch (error) {
    logger.error('Demo invitation revocation error', { error });
    return NextResponse.json({ error: 'Failed to revoke demo invitation.' }, { status: 500 });
  }
}
