import { NextRequest, NextResponse } from 'next/server';
import type { HandoverStatus } from '@/types';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  readJsonBody,
  validateEnumValue,
} from '@/lib/api-security';
import { buildDegradedResponse } from '@/lib/degraded-response';
import { updateHandoverStatus } from '@/lib/data/handover';
import { DataSourceUnavailableError } from '@/lib/data/errors';
import logger from '@/lib/logger';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimit = await enforceApiRateLimit(req, 'api:medical:handover:detail');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await readJsonBody<{ status: string }>(req);
  if (body instanceof NextResponse) return body;

  const status = validateEnumValue(
    body.status,
    'status',
    ['Acknowledged', 'Completed', 'Cancelled'] as const,
  );
  if (status instanceof NextResponse) return status;

  try {
    const { item, source } = await updateHandoverStatus(
      session.hospitalId,
      session.id,
      id,
      status as HandoverStatus,
      session.name,
    );

    if (!item) {
      return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: item.id,
      status: item.status,
      acknowledgedBy: session.name,
      acknowledgedAt: item.acknowledgedAt,
      source,
    });
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      return buildDegradedResponse({ entity: 'handovers', detail: error.message });
    }
    logger.error('[Medical Handover PATCH] failed', {
      error: error instanceof Error ? error.message : String(error),
      id,
    });
    return NextResponse.json({ error: 'Failed to update handover' }, { status: 500 });
  }
}
