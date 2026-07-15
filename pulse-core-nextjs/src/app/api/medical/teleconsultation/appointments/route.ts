import { NextRequest, NextResponse } from 'next/server';
import type { UserSession } from '@/types';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  readJsonBody,
  requireString,
  validateEnumValue,
} from '@/lib/api-security';
import { sanitizeError } from '@/lib/api-response';
import { buildDegradedResponse } from '@/lib/degraded-response';
import {
  createTeleconsultAppointment,
  listTeleconsultAppointments,
  updateTeleconsultAppointmentStatus,
  type AppointmentStatus,
  type CreateTeleconsultAppointmentInput,
} from '@/lib/data/teleconsult';
import { DataSourceUnavailableError } from '@/lib/data/errors';

function getSession(req: NextRequest): UserSession | null {
  return getSessionFromRequest(req);
}

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:teleconsult:appointments');
  if (rateLimit) return rateLimit;

  const session = getSession(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items, source } = await listTeleconsultAppointments(session.hospitalId, session.id);
    return NextResponse.json({ items, source });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({
        entity: 'teleconsultAppointments',
        detail: error.message,
      });
    }
    const { error: message } = sanitizeError(error, {
      context: '[Medical Teleconsult Appointments GET]',
      clientMessage: 'Failed to fetch appointments.',
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:teleconsult:appointments');
  if (rateLimit) return rateLimit;

  const session = getSession(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody<{ id?: unknown; status?: unknown }>(req);
  if (body instanceof NextResponse) return body;
  const id = requireString(body.id, 'id', { min: 2, max: 120 });
  if (id instanceof NextResponse) return id;
  const status = validateEnumValue(body.status, 'status', ['Scheduled', 'Confirmed', 'In Progress', 'Completed'] as const);
  if (status instanceof NextResponse) return status;

  try {
    const { item, source } = await updateTeleconsultAppointmentStatus(
      session.hospitalId,
      session.id,
      id,
      status as AppointmentStatus,
    );
    return NextResponse.json({ item, source });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({
        entity: 'teleconsultAppointments',
        detail: error.message,
      });
    }
    const { error: message } = sanitizeError(error, {
      context: '[Medical Teleconsult Appointments PATCH]',
      clientMessage: 'Failed to update appointment.',
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:teleconsult:appointments');
  if (rateLimit) return rateLimit;

  const session = getSession(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody<Partial<CreateTeleconsultAppointmentInput>>(req);
  if (body instanceof NextResponse) return body;
  const patient = requireString(body.patient, 'patient', { min: 2, max: 160 });
  if (patient instanceof NextResponse) return patient;
  const time = requireString(body.time, 'time', { min: 2, max: 40 });
  if (time instanceof NextResponse) return time;
  const mode = validateEnumValue(body.mode, 'mode', ['Video', 'Call', 'Text'] as const);
  if (mode instanceof NextResponse) return mode;
  const clinician = requireString(body.clinician, 'clinician', { min: 2, max: 160 });
  if (clinician instanceof NextResponse) return clinician;
  const status = body.status === undefined
    ? 'Scheduled'
    : validateEnumValue(body.status, 'status', ['Scheduled', 'Confirmed', 'In Progress', 'Completed'] as const);
  if (status instanceof NextResponse) return status;

  try {
    const { item, source } = await createTeleconsultAppointment(session.hospitalId, session.id, {
      patient,
      time,
      mode,
      clinician,
      status: status as AppointmentStatus,
    });
    return NextResponse.json({ item, source }, { status: 201 });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({
        entity: 'teleconsultAppointments',
        detail: error.message,
      });
    }
    const { error: message } = sanitizeError(error, {
      context: '[Medical Teleconsult Appointments POST]',
      clientMessage: 'Failed to create appointment.',
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
