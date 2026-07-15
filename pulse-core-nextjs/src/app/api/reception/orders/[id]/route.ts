 
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, validateUuid } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

/**
 * Acknowledge a pending routing order (reception → department handoff logged).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:reception:orders-ack',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const { id: routeId } = await context.params;
  const id = validateUuid(routeId, 'id');
  if (id instanceof NextResponse) return id;

  try {
    const updated = await prisma.receptionRoutingOrder.updateMany({
      where: {
        id,
        hospitalId: guard.session.hospitalId,
        status: 'Pending',
      },
      data: {
        status: 'Acknowledged',
        acknowledgedBy: guard.session.id,
        acknowledgedAt: new Date(),
      },
    });

    if (updated.count > 0) {
      return NextResponse.json({ ok: true, id, status: 'Acknowledged' });
    }

    const existing = await prisma.receptionRoutingOrder.findFirst({
      where: { id, hospitalId: guard.session.hospitalId },
      select: { status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Routing order not found.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Only pending orders can be acknowledged.' },
      { status: 400 },
    );
  } catch (err) {
    logger.error('reception orders PATCH failed', { err });
    return NextResponse.json({ error: 'Could not update routing order.' }, { status: 500 });
  }
}
