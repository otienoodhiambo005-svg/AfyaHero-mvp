import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { readIdempotencyCache, writeIdempotencyCache } from '@/lib/idempotency';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const ActionSchema = z.object({
  labId: z.string().min(3).max(64),
  action: z.enum(['process', 'enter', 'reject']),
});

type LabStatus = 'Ordered' | 'Processing' | 'Completed';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const statusStore = new Map<string, { status: LabStatus; updatedAt: string; updatedBy: string }>();

function mapActionToStatus(action: z.infer<typeof ActionSchema>['action']): LabStatus {
  if (action === 'process') return 'Processing';
  if (action === 'enter') return 'Completed';
  return 'Ordered';
}

function mapStatusToLabRequestStatus(status: LabStatus): string {
  if (status === 'Processing') return 'processing';
  if (status === 'Completed') return 'completed';
  return 'ordered';
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-queue-action',
    roles: ['lab', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { labId, action } = parsed.data;
  const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  const cacheKey = idempotencyKey
    ? `lab-queue-action:${guard.session.id}:${labId}:${action}:${idempotencyKey}`
    : null;

  if (cacheKey) {
    const cached = readIdempotencyCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached.payload, { status: cached.status });
    }
  }

  const nextStatus = mapActionToStatus(action);
  const updatedAt = new Date().toISOString();
  const mappedDbStatus = mapStatusToLabRequestStatus(nextStatus);
  const actorId = guard.session.id;
  const hospitalId = guard.session.hospitalId;
  let persisted = false;
  let escalationRequired = false;
  let escalationEventId: string | null = null;

  try {
    if (hospitalId) {
      const existing = await prisma.labRequest.findFirst({
        where: {
          hospitalId,
          labId,
        },
        select: {
          id: true,
          critical: true,
          patientId: true,
          testName: true,
        },
      });

      escalationRequired = Boolean(existing?.critical) && action === 'enter';

      const updateResult = await prisma.labRequest.updateMany({
        where: {
          hospitalId,
          labId,
        },
        data: {
          status: mappedDbStatus,
          ...(mappedDbStatus === 'processing' ? { collectedAt: new Date(updatedAt) } : {}),
          ...(mappedDbStatus === 'completed' ? { completedAt: new Date(updatedAt) } : {}),
          notes: `Queue action=${action} by ${actorId} at ${updatedAt}`,
        },
      });

      persisted = updateResult.count > 0;

      if (persisted && escalationRequired && existing) {
        const escalation = await prisma.auditLog.create({
          data: {
            action: 'lab_critical_result_escalation_required',
            actorId,
            actorRole: guard.session.role,
            actorEmail: guard.session.email ?? undefined,
            hospitalId,
            resourceType: 'LabRequest',
            resourceId: existing.id,
            detail: {
              labId,
              patientId: existing.patientId,
              testName: existing.testName,
              action,
              reason: 'critical_result_completed',
              requiredBy: 'ai-native-lab-safety',
            },
          },
        });
        escalationEventId = escalation.id;
      }
    }
  } catch (error) {
    logger.error('Failed to persist lab queue action', {
      labId,
      action,
      hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const previousStatus = statusStore.get(labId)?.status;
  const aiHints = [
    action === 'reject' ? 'Trigger recollection protocol and contamination checklist.' : null,
    action === 'enter' ? 'Route completed result to clinician verification queue.' : null,
    previousStatus === 'Ordered' && action === 'process'
      ? 'Track pre-analytical turnaround and prioritize STAT bench.'
      : null,
  ].filter((hint): hint is string => Boolean(hint));

  const payload = {
    ok: true,
    labId,
    status: nextStatus,
    action,
    updatedAt,
    updatedBy: actorId,
    persisted,
    escalationRequired,
    escalationEventId,
    aiHints,
  };

  statusStore.set(labId, {
    status: nextStatus,
    updatedAt,
    updatedBy: actorId,
  });

  if (cacheKey) {
    writeIdempotencyCache(cacheKey, { status: 200, payload });
  }

  return NextResponse.json(payload, { status: 200 });
}

