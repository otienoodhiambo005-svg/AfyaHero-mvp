/**
 * POST /api/medical/prescriptions
 *
 * Creates a prescription with drug interaction checking
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
    const rateLimit = await enforceApiRateLimit(request, 'api:medical:prescriptions');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['medical', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      patientId?: unknown;
      medications?: unknown;
      allergies?: unknown;
      currentMedications?: unknown;
      checkInteractions?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate required fields
    if (!body.patientId || typeof body.patientId !== 'string') {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.medications) || body.medications.length === 0) {
      return NextResponse.json(
        { error: 'medications array is required' },
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
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 },
      );
    }

    const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // Drug interaction checking (if requested)
    let interactionCheck = null;
    if (body.checkInteractions === true) {
      try {
        const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/api/ai/consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify({
            action: 'interactions',
            data: {
              newMedications: body.medications as string[],
              currentMedications: Array.isArray(body.currentMedications) ? body.currentMedications as string[] : [],
              allergies: Array.isArray(body.allergies) ? body.allergies as string[] : [],
              patientAge: age,
            },
          }),
        });

        if (aiResponse.ok) {
          interactionCheck = await aiResponse.json();
        }
      } catch (error) {
        logger.warn('[Prescription] Drug interaction check failed, continuing without it', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Generate RX number
    const rxNumber = `RX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    // Create prescription record
    const prescription = await prisma.prescription.create({
      data: {
        patientId: body.patientId,
        hospitalId: session.hospitalId,
        prescribedBy: session.id,
        rxNumber,
        items: body.medications,
        status: 'pending',
        priority: 'normal',
      },
    });

    // Link prescription to consultation if active
    const activeConsultation = await prisma.consultation.findFirst({
      where: {
        patientId: body.patientId,
        hospitalId: session.hospitalId,
        status: 'IN_PROGRESS',
      },
    });

    if (activeConsultation) {
      await prisma.consultation.update({
        where: { id: activeConsultation.id },
        data: { prescriptionId: prescription.id },
      });
    }

    return NextResponse.json(
      {
        success: true,
        prescription: {
          id: prescription.id,
          rxNumber: prescription.rxNumber,
          patientId: prescription.patientId,
          status: prescription.status,
          items: prescription.items,
          prescribedAt: prescription.prescribedAt,
        },
        patient: {
          id: patient.id,
          name: patient.name,
          age,
        },
        interactionCheck,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[Prescription POST] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/medical/prescriptions
 *
 * Retrieves prescription records
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['medical', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');

    const where: {
      hospitalId: string;
      patientId?: string;
      status?: string;
    } = {
      hospitalId: session.hospitalId,
    };

    if (patientId) {
      where.patientId = patientId;
    }

    if (status) {
      where.status = status;
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
          },
        },
        prescribedByProfile: {
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
      prescriptions: prescriptions.map((p) => ({
        id: p.id,
        rxNumber: p.rxNumber,
        patient: {
          id: p.patient.id,
          name: p.patient.name,
          age: Math.floor((Date.now() - new Date(p.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
        },
        prescribedBy: {
          id: p.prescribedByProfile.id,
          name: p.prescribedByProfile.fullName,
        },
        items: p.items,
        status: p.status,
        prescribedAt: p.prescribedAt,
      })),
    });
  } catch (err) {
    logger.error('[Prescription GET] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
