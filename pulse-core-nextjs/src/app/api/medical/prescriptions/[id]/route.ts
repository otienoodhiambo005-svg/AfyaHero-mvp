/**
 * PATCH /api/medical/prescriptions/[id]
 *
 * Updates prescription status
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
    const rateLimit = await enforceApiRateLimit(request, 'api:medical:prescriptions');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['medical', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Parse + validate body
    const body = await readJsonBody<{
      status?: unknown;
      items?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate status
    const validStatuses = ['pending', 'dispensing', 'dispensed', 'partial', 'cancelled', 'on-hold'];
    if (body.status && typeof body.status === 'string' && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Fetch prescription
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 },
      );
    }

    // Check hospital access
    if (prescription.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update prescription
    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.items) updateData.items = body.items;

    // Add dispensed metadata when status is dispensed
    if (body.status === 'dispensed') {
      updateData.dispensedBy = session.id;
      updateData.dispensedAt = new Date();
    }

    const updatedPrescription = await prisma.prescription.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      prescription: {
        id: updatedPrescription.id,
        rxNumber: updatedPrescription.rxNumber,
        status: updatedPrescription.status,
        items: updatedPrescription.items,
      },
    });
  } catch (err) {
    logger.error('[Prescription PATCH] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/medical/prescriptions/[id]
 *
 * Retrieves a specific prescription
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireRoles(request, ['medical', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
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
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 },
      );
    }

    // Check hospital access
    if (prescription.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const age = Math.floor((Date.now() - new Date(prescription.patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    return NextResponse.json({
      prescription: {
        id: prescription.id,
        rxNumber: prescription.rxNumber,
        patient: {
          id: prescription.patient.id,
          name: prescription.patient.name,
          age,
        },
        prescribedBy: {
          id: prescription.prescribedByProfile.id,
          name: prescription.prescribedByProfile.fullName,
        },
        items: prescription.items,
        status: prescription.status,
        prescribedAt: prescription.prescribedAt,
      },
    });
  } catch (err) {
    logger.error('[Prescription GET] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
