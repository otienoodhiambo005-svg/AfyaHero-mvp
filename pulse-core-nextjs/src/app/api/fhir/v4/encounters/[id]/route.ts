/**
 * GET /api/fhir/v4/encounters/[id]
 * 
 * Returns a FHIR R4 Encounter resource for the given encounter ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { mapEncounterToFHIR } from '@/lib/fhir-mappers';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Fetch encounter from database
    const encounter = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!encounter) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `Encounter not found: ${id}`,
            },
          ],
        },
        { status: 404 },
      );
    }

    // Check access
    if (encounter.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'forbidden',
              diagnostics: 'Access denied',
            },
          ],
        },
        { status: 403 },
      );
    }

    // Transform to FHIR
    const fhirEncounter = mapEncounterToFHIR({
      id: encounter.id,
      patientId: encounter.patientId,
      profileId: encounter.practitionerId,
      hospitalId: encounter.hospitalId,
      status: encounter.status,
      encounterType: 'GENERAL',
      startTime: encounter.createdAt,
      createdAt: encounter.createdAt,
      updatedAt: encounter.createdAt,
    });

    return NextResponse.json(fhirEncounter, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
      },
    });
  } catch (err) {
    logger.error('[FHIR Encounter GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : String(err),
          },
        ],
      },
      { status: 500 },
    );
  }
}
