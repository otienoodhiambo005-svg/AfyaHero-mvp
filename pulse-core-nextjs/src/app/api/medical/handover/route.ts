import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  readJsonBody,
  requireString,
} from '@/lib/api-security';
import { buildDegradedResponse } from '@/lib/degraded-response';
import {
  createHandover,
  listHandovers,
} from '@/lib/data/handover';
import { DataSourceUnavailableError } from '@/lib/data/errors';
import logger from '@/lib/logger';

export async function GET(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:handover');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items, source } = await listHandovers(session.hospitalId, session.id);
    return NextResponse.json({ items, source });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({ entity: 'handovers', detail: error.message });
    }
    logger.error('[Medical Handover GET] failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch handovers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:handover');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody<{
    patientId?: unknown;
    patientName?: unknown;
    situation?: unknown;
    background?: unknown;
    assessment?: unknown;
    recommendation?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const patientId = requireString(body.patientId, 'patientId');
  const patientName = requireString(body.patientName, 'patientName');
  const situation = requireString(body.situation, 'situation');
  const background = requireString(body.background, 'background');
  const assessment = requireString(body.assessment, 'assessment');
  const recommendation = requireString(body.recommendation, 'recommendation');

  if (patientId instanceof NextResponse) return patientId;
  if (patientName instanceof NextResponse) return patientName;
  if (situation instanceof NextResponse) return situation;
  if (background instanceof NextResponse) return background;
  if (assessment instanceof NextResponse) return assessment;
  if (recommendation instanceof NextResponse) return recommendation;

  try {
    const { item, source } = await createHandover(session.hospitalId, session.id, {
      patientId,
      patientName,
      senderId: session.id,
      senderName: session.name,
      situation,
      background,
      assessment,
      recommendation,
    });
    return NextResponse.json({ item, source }, { status: 201 });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({ entity: 'handovers', detail: error.message });
    }
    logger.error('[Medical Handover POST] failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create handover' }, { status: 500 });
  }
}
