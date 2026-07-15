import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import {
  buildApiIdempotencyScopeKey,
  cacheIdempotentSuccessResponse,
  getCachedIdempotentResponse,
  validateIdempotencyKey,
} from '@/lib/api-idempotency';
import logger from '@/lib/logger';

const CheckinSchema = z.object({
  fullName: z.string().min(2).max(120),
  dob: z.string().min(8).max(40),
  gender: z.string().min(1).max(16),
  phone: z.string().min(7).max(24),
  nationalId: z.string().max(40).optional().default(''),
  shif: z.string().max(40).optional().default(''),
  complaint: z.string().min(3).max(500),
  priority: z.enum(['Normal', 'Urgent', 'Critical']),
  serviceType: z.enum(['OPD', 'Lab', 'Pharmacy']),
  insuranceProvider: z.string().max(80).optional().default(''),
  memberNumber: z.string().max(80).optional().default(''),
});

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const CHECKIN_IDEMPOTENCY_SCOPE = 'reception-checkin';

type CheckinResponsePayload = {
  id: string;
  token: string;
  patient: string;
  shif: string;
  phone: string;
  priority: 'Normal' | 'Urgent' | 'Critical';
  time: string;
  status: 'Checked In';
};

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:checkin',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = CheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid check-in payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const idempotencyValidation = validateIdempotencyKey(req.headers.get(IDEMPOTENCY_HEADER));
  const scopedIdempotencyKey = idempotencyValidation.isValid && idempotencyValidation.key
    ? buildApiIdempotencyScopeKey({
        scope: CHECKIN_IDEMPOTENCY_SCOPE,
        idempotencyKey: idempotencyValidation.key,
        actorKey: `${guard.session.hospitalId}:${guard.session.id}`,
      })
    : null;
  if (idempotencyValidation.key && !idempotencyValidation.isValid) {
    logger.warn('Ignoring invalid idempotency key for reception check-in', {
      reason: idempotencyValidation.reason,
      hospitalId: guard.session.hospitalId,
      actorId: guard.session.id,
    });
  }
  if (scopedIdempotencyKey) {
    const cached = getCachedIdempotentResponse<CheckinResponsePayload>(scopedIdempotencyKey);
    if (cached) {
      return NextResponse.json(
        {
          ...cached,
          idempotentReplay: true,
        },
        { status: 200 },
      );
    }
  }

  const payload = parsed.data;
  const priorityNormalized = payload.priority.toLowerCase();
  const queuePriority =
    priorityNormalized === 'critical'
      ? 'critical'
      : priorityNormalized === 'urgent'
        ? 'urgent'
        : 'normal';

  let aiSuggestion: 'normal' | 'urgent' | 'critical' | null = null;
  try {
    const triagePrompt = `Reception intake complaint: ${payload.complaint}. Service: ${payload.serviceType}. Suggest one priority label only: normal, urgent, or critical.`;
    const triageResponse = await fetch(new URL('/api/ai/orchestrate', req.url), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        taskType: 'triage',
        prompt: triagePrompt,
        priority: 'urgent',
        requireConsensus: true,
      }),
    });
    if (triageResponse.ok) {
      const triageData = await triageResponse.json() as { text?: string };
      const normalized = (triageData.text ?? '').toLowerCase();
      if (normalized.includes('critical')) aiSuggestion = 'critical';
      else if (normalized.includes('urgent')) aiSuggestion = 'urgent';
      else if (normalized.includes('normal')) aiSuggestion = 'normal';
    }
  } catch {
    // Non-blocking: check-in must still work if AI is unavailable.
  }

  const effectivePriority = aiSuggestion === 'critical'
    ? 'critical'
    : aiSuggestion === 'urgent'
      ? 'urgent'
      : queuePriority;

  const created = await prisma.receptionCheckin.create({
    data: {
      hospitalId: guard.session.hospitalId,
      patientName: payload.fullName,
      phone: payload.phone,
      idNumber: payload.nationalId || null,
      insuranceProvider: payload.insuranceProvider || (payload.shif ? 'SHIF' : null),
      insuranceId: payload.memberNumber || payload.shif || null,
      visitReason: payload.complaint,
      visitType: payload.serviceType,
      paymentMethod: payload.insuranceProvider || payload.shif ? 'Insurance' : 'Cash',
      chiefComplaint: payload.complaint,
      priority: effectivePriority,
      checkedInBy: guard.session.id,
      status: 'Checked In',
      notes: `DOB: ${payload.dob}; Gender: ${payload.gender}; aiPriority=${aiSuggestion ?? 'n/a'}`,
    },
  });

  const activeQueueCount = await prisma.hospitalQueue.count({
    where: {
      hospitalId: guard.session.hospitalId,
      status: {
        in: ['waiting', 'in_progress'],
      },
    },
  });

  const queueEntry = await prisma.hospitalQueue.create({
    data: {
      hospitalId: guard.session.hospitalId,
      checkinId: created.id,
      patientName: created.patientName,
      tokenNumber: activeQueueCount + 1,
      ticketNumber: `A${created.id.slice(0, 4).toUpperCase()}`,
      serviceType: payload.serviceType,
      priority: effectivePriority,
      chiefComplaint: payload.complaint,
      status: 'waiting',
      arrivedAt: created.checkedInAt,
      waitMinutes: 0,
    },
  });

  const responsePayload: CheckinResponsePayload = {
    id: created.id,
    token: queueEntry.ticketNumber ?? `A${created.id.slice(0, 4).toUpperCase()}`,
    patient: created.patientName,
    shif: created.insuranceId ?? 'N/A',
    phone: created.phone ?? '-',
    priority: payload.priority,
    time: new Date(created.checkedInAt).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: 'Checked In' as const,
  };

  if (scopedIdempotencyKey) {
    cacheIdempotentSuccessResponse(scopedIdempotencyKey, responsePayload);
  }

  logger.info('Reception check-in created', {
    id: created.id,
    hospitalId: guard.session.hospitalId,
    actorId: guard.session.id,
  });

  return NextResponse.json(
    {
      ...responsePayload,
      idempotentReplay: false,
    },
    { status: 200 },
  );
}

