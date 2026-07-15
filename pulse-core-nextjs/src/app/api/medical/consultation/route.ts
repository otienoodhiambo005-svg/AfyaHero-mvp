/**
 * POST /api/medical/consultation
 *
 * Creates a consultation record with AI-assisted diagnosis.
 * This endpoint integrates with the AI consultation service to provide
 * differential diagnosis and SOAP note generation.
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

export async function POST(request: NextRequest) {
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

    // Parse + validate body
    const body = await readJsonBody<{
      patientId?: unknown;
      chiefComplaint?: unknown;
      historyOfPresentIllness?: unknown;
      pastMedicalHistory?: unknown;
      physicalExam?: unknown;
      vitals?: unknown;
      assessment?: unknown;
      plan?: unknown;
      useAiDiagnosis?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate required fields
    if (!body.patientId || typeof body.patientId !== 'string') {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 },
      );
    }

    if (!body.chiefComplaint || typeof body.chiefComplaint !== 'string') {
      return NextResponse.json(
        { error: 'chiefComplaint is required' },
        { status: 400 },
      );
    }

    // Get patient information
    const patient = await prisma.patient.findUnique({
      where: { id: body.patientId },
      select: {
        id: true,
        name: true,
        dob: true,
        gender: true,
        phone: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 },
      );
    }

    // Calculate patient age
    const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // AI Diagnosis (if requested)
    let aiDiagnosis = null;
    if (body.useAiDiagnosis === true) {
      try {
        const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/api/ai/consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify({
            action: 'differential',
            data: {
              patientAge: age,
              patientGender: (patient.gender || 'other').toLowerCase() as 'male' | 'female',
              chiefComplaint: body.chiefComplaint,
              symptoms: [], // Could be extracted from historyOfPresentIllness
              vitals: body.vitals as Record<string, number> | undefined,
              history: body.historyOfPresentIllness as string | undefined,
            },
          }),
        });

        if (aiResponse.ok) {
          aiDiagnosis = await aiResponse.json();
        }
      } catch (error) {
        logger.warn('[Consultation] AI diagnosis failed, continuing without it', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Create consultation record
    const consultation = await prisma.consultation.create({
      data: {
        patientId: body.patientId,
        practitionerId: session.id,
        hospitalId: session.hospitalId,
        notes: body.historyOfPresentIllness as string | undefined,
        diagnosis: aiDiagnosis ? JSON.stringify(aiDiagnosis) : body.assessment as string | undefined,
        status: 'IN_PROGRESS',
      },
    });

    // Update queue status if patient is in queue
    const queueEntry = await prisma.hospitalQueue.findFirst({
      where: {
        patientId: body.patientId,
        hospitalId: session.hospitalId,
        status: 'waiting',
      },
    });

    if (queueEntry) {
      await prisma.hospitalQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: 'in_progress',
          calledAt: new Date(),
          assignedTo: session.id,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        consultation: {
          id: consultation.id,
          patientId: consultation.patientId,
          practitionerId: consultation.practitionerId,
          status: consultation.status,
          createdAt: consultation.createdAt,
        },
        patient: {
          id: patient.id,
          name: patient.name,
          age,
          gender: patient.gender,
        },
        aiDiagnosis,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[Medical Consultation POST] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/medical/consultation
 *
 * Retrieves consultation records for a patient or practitioner
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const practitionerId = searchParams.get('practitionerId');

    const where: {
      hospitalId: string;
      patientId?: string;
      practitionerId?: string;
    } = {
      hospitalId: session.hospitalId,
    };

    if (patientId) {
      where.patientId = patientId;
    }

    if (practitionerId) {
      where.practitionerId = practitionerId;
    }

    const consultations = await prisma.consultation.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
            gender: true,
          },
        },
        practitioner: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return NextResponse.json({
      consultations: consultations.map((c) => ({
        id: c.id,
        patient: {
          id: c.patient.id,
          name: c.patient.name,
          age: Math.floor((Date.now() - new Date(c.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
          gender: c.patient.gender,
        },
        practitioner: {
          id: c.practitioner.id,
          name: c.practitioner.fullName,
        },
        notes: c.notes,
        diagnosis: c.diagnosis,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    logger.error('[Medical Consultation GET] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
