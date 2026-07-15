/**
 * PATCH /api/hospital/queue/[id]
 * 
 * Update queue entry status (e.g., call patient to consultation, mark as completed, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    const rateLimit = await enforceApiRateLimit(request, 'api:hospital:queue');
    if (rateLimit) return rateLimit;

    const session = requireRoles(request, ['reception', 'medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    const body = await readJsonBody<{
      status?: unknown;
      notes?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    const validStatuses = ['waiting', 'in_progress', 'completed', 'cancelled', 'transferred'];

    if (!body.status || typeof body.status !== 'string' || !validStatuses.includes(body.status.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Fetch queue entry
    const queueEntry = await prisma.hospitalQueue.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!queueEntry) {
      return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
    }

    // Check hospital access
    if (queueEntry.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update queue entry
    const updatedQueue = await prisma.hospitalQueue.update({
      where: { id },
      data: {
        status: body.status.toLowerCase(),
        ...(body.status.toLowerCase() === 'in_progress' && { calledAt: new Date() }),
        ...(body.status.toLowerCase() === 'completed' && { completedAt: new Date() }),
      },
    });

    // If moving to consultation, create a consultation record
    if (body.status.toLowerCase() === 'in_progress' && queueEntry.patientId) {
      await prisma.consultation.create({
        data: {
          patientId: queueEntry.patientId,
          practitionerId: session.id,
          hospitalId: session.hospitalId || queueEntry.hospitalId,
          status: 'IN_PROGRESS',
          notes: 'GENERAL',
        },
      });
    }

    return NextResponse.json({
      success: true,
      queue: updatedQueue,
      patient: {
        id: queueEntry.patient?.id,
        name: queueEntry.patient?.name,
        phoneNumber: queueEntry.patient?.phone,
      },
    });
  } catch (err) {
    logger.error('[Hospital Queue PATCH] Error', {
      error: err instanceof Error ? err.message : String(err),
      params,
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
