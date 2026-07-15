/**
 * PATCH /api/medical/consultation/[id]
 *
 * Updates a consultation record (status, notes, diagnosis, prescription)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:medical:consultation');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Parse + validate body
    const body = await readJsonBody<{
      status?: unknown;
      notes?: unknown;
      diagnosis?: unknown;
      prescriptionId?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate status
    const validStatuses = ['IN_PROGRESS', 'Completed', 'Cancelled'];
    if (body.status && typeof body.status === 'string' && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Fetch consultation
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!consultation) {
      return NextResponse.json(
        { error: 'Consultation not found' },
        { status: 404 },
      );
    }

    // Check hospital access
    if (consultation.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update consultation
    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.notes) updateData.notes = body.notes;
    if (body.diagnosis) updateData.diagnosis = body.diagnosis;
    if (body.prescriptionId) updateData.prescriptionId = body.prescriptionId;

    const updatedConsultation = await prisma.consultation.update({
      where: { id },
      data: updateData,
    });

    // If consultation is completed, update queue status
    if (body.status === 'Completed') {
      const queueEntry = await prisma.hospitalQueue.findFirst({
        where: {
          patientId: consultation.patientId,
          hospitalId: session.hospitalId,
          status: 'in_progress',
        },
      });

      if (queueEntry) {
        await prisma.hospitalQueue.update({
          where: { id: queueEntry.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      consultation: {
        id: updatedConsultation.id,
        status: updatedConsultation.status,
        notes: updatedConsultation.notes,
        diagnosis: updatedConsultation.diagnosis,
        prescriptionId: updatedConsultation.prescriptionId,
      },
    });
  } catch (err) {
    logger.error('[Medical Consultation PATCH] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/medical/consultation/[id]
 *
 * Retrieves a specific consultation record
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireRoles(request, ['medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
            gender: true,
            phone: true,
          },
        },
        practitioner: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!consultation) {
      return NextResponse.json(
        { error: 'Consultation not found' },
        { status: 404 },
      );
    }

    // Check hospital access
    if (consultation.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const age = Math.floor((Date.now() - new Date(consultation.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    return NextResponse.json({
      consultation: {
        id: consultation.id,
        patient: {
          id: consultation.patient.id,
          name: consultation.patient.name,
          age,
          gender: consultation.patient.gender,
          phoneNumber: consultation.patient.phone,
        },
        practitioner: {
          id: consultation.practitioner.id,
          name: consultation.practitioner.fullName,
        },
        notes: consultation.notes,
        diagnosis: consultation.diagnosis,
        prescriptionId: consultation.prescriptionId,
        status: consultation.status,
        createdAt: consultation.createdAt,
      },
    });
  } catch (err) {
    logger.error('[Medical Consultation GET] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
