import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  readJsonBody,
  requireString,
  validateEnumValue,
  validateNumber,
} from '@/lib/api-security';
import { sanitizeError } from '@/lib/api-response';
import { buildDegradedResponse } from '@/lib/degraded-response';
import type { UserSession } from '@/types';
import {
  createTeleconsultWaitroomEntry,
  deleteTeleconsultWaitroomEntry,
  listTeleconsultWaitroom,
  type CreateTeleconsultWaitroomInput,
} from '@/lib/data/teleconsult';
import { DataSourceUnavailableError } from '@/lib/data/errors';

function getSession(req: NextRequest): UserSession | null {
  return getSessionFromRequest(req);
}

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:teleconsult:waitroom');
  if (rateLimit) return rateLimit;

  const session = getSession(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items, source } = await listTeleconsultWaitroom(session.hospitalId, session.id);
    return NextResponse.json({ items, source });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({
        entity: 'teleconsultWaitroom',
        detail: error.message,
      });
    }
    const { error: message } = sanitizeError(error, {
      context: '[Medical Teleconsult Waitroom GET]',
      clientMessage: 'Failed to fetch waitroom.',
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:teleconsult:waitroom');
  if (rateLimit) return rateLimit;

  const session = getSession(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = requireString(new URL(req.url).searchParams.get('id'), 'id', { min: 2, max: 120 });
  if (id instanceof NextResponse) return id;

  try {
    const { ok, source } = await deleteTeleconsultWaitroomEntry(session.hospitalId, session.id, id);
    if (!ok) {
      return NextResponse.json({ error: 'Waitroom entry not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, source });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({
        entity: 'teleconsultWaitroom',
        detail: error.message,
      });
    }
    const { error: message } = sanitizeError(error, {
      context: '[Medical Teleconsult Waitroom DELETE]',
      clientMessage: 'Failed to remove from waitroom.',
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:teleconsult:waitroom');
  if (rateLimit) return rateLimit;

  const session = getSession(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody<Partial<CreateTeleconsultWaitroomInput>>(req);
  if (body instanceof NextResponse) return body;
  const patient = requireString(body.patient, 'patient', { min: 2, max: 160 });
  if (patient instanceof NextResponse) return patient;
  const waitingFor = requireString(body.waitingFor, 'waitingFor', { min: 2, max: 240 });
  if (waitingFor instanceof NextResponse) return waitingFor;
  const mode = validateEnumValue(body.mode, 'mode', ['Video', 'Call', 'Text'] as const);
  if (mode instanceof NextResponse) return mode;
  const priority = validateEnumValue(body.priority, 'priority', ['Normal', 'Urgent'] as const);
  if (priority instanceof NextResponse) return priority;
  const safeWaitMinutes = validateNumber(body.waitMinutes ?? 0, 'waitMinutes', { min: 0, max: 24 * 60, integer: true });
  if (safeWaitMinutes instanceof NextResponse) return safeWaitMinutes;

  try {
    const { item, source } = await createTeleconsultWaitroomEntry(session.hospitalId, session.id, {
      patient,
      waitingFor,
      waitMinutes: safeWaitMinutes,
      mode,
      priority,
    });
    return NextResponse.json({ item, source }, { status: 201 });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({
        entity: 'teleconsultWaitroom',
        detail: error.message,
      });
    }
    const { error: message } = sanitizeError(error, {
      context: '[Medical Teleconsult Waitroom POST]',
      clientMessage: 'Failed to add to waitroom.',
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
