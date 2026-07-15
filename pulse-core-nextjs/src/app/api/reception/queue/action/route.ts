import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { readIdempotencyCache, writeIdempotencyCache } from '@/lib/idempotency';

const ActionSchema = z.object({
  queueId: z.string().min(3).max(64),
  action: z.enum(['call', 'start', 'done', 'escalate']),
});

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

function mapActionStatus(action: z.infer<typeof ActionSchema>['action']) {
  if (action === 'call') return 'in_progress';
  if (action === 'start') return 'in_progress';
  if (action === 'done') return 'completed';
  return 'in_progress';
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:queue-action',
    roles: ['reception', 'admin', 'super_admin'],
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
    ? `reception-queue-action:${guard.session.hospitalId}:${guard.session.id}:${parsed.data.queueId}:${parsed.data.action}:${idempotencyKey}`
    : null;
  if (scopedKey) {
    const cached = readIdempotencyCache(scopedKey);
    if (cached) return NextResponse.json(cached.payload, { status: cached.status });
  }

  const status = mapActionStatus(parsed.data.action);
  const updated = await prisma.hospitalQueue.updateMany({
    where: {
      id: parsed.data.queueId,
      hospitalId: guard.session.hospitalId,
    },
    data: {
      status,
      ...(status === 'in_progress' ? { calledAt: new Date() } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
      assignedTo: guard.session.id,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Queue item not found.' }, { status: 404 });
  }

  const payload = {
    ok: true,
    queueId: parsed.data.queueId,
    action: parsed.data.action,
    status,
  };
  if (scopedKey) writeIdempotencyCache(scopedKey, { status: 200, payload });
  return NextResponse.json(payload, { status: 200 });
}

