import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { readIdempotencyCache, writeIdempotencyCache } from '@/lib/idempotency';
import logger from '@/lib/logger';

const ActionSchema = z.object({
  queueId: z.string().uuid(),
  action: z.enum(['call']),
});

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:queue-action',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid queue action payload.' }, { status: 400 });
  }

  const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  const scopedKey = idempotencyKey
    ? `medical-queue-action:${guard.session.hospitalId}:${guard.session.id}:${parsed.data.queueId}:${parsed.data.action}:${idempotencyKey}`
    : null;
  if (scopedKey) {
    const cached = readIdempotencyCache(scopedKey);
    if (cached) return NextResponse.json(cached.payload, { status: cached.status });
  }

  try {
    const updated = await prisma.hospitalQueue.updateMany({
      where: {
        id: parsed.data.queueId,
        hospitalId: guard.session.hospitalId,
        serviceType: { in: ['OPD', 'Triage'] },
        status: { notIn: ['completed', 'cancelled'] },
      },
      data: {
        status: 'in_progress',
        calledAt: new Date(),
        assignedTo: guard.session.id,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Queue item not found or not in this facility queue.' }, { status: 404 });
    }

    const payload = {
      ok: true as const,
      queueId: parsed.data.queueId,
      action: parsed.data.action,
      status: 'in_progress' as const,
    };
    if (scopedKey) writeIdempotencyCache(scopedKey, { status: 200, payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    logger.error('medical queue action failed', { err: e, hospitalId: guard.session.hospitalId });
    return NextResponse.json({ error: 'Unable to update queue.' }, { status: 500 });
  }
}
