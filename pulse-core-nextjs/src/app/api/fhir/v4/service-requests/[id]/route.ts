/**
 * GET /api/fhir/v4/service-requests/[id]
 * 
 * Returns a FHIR R4 ServiceRequest resource for the given lab request ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { mapServiceRequestToFHIR } from '@/lib/fhir-mappers';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireRoles(request, ['medical', 'lab', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Fetch lab request from database
    const labRequest = await prisma.labRequest.findUnique({
      where: { id },
    });

    if (!labRequest) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `ServiceRequest not found: ${id}`,
            },
          ],
        },
        { status: 404 },
      );
    }

    // Check access
    if (labRequest.hospitalId !== session.hospitalId && session.role !== 'admin') {
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
    const fhirServiceRequest = mapServiceRequestToFHIR({
      id: labRequest.id,
      patientId: labRequest.patientId,
      profileId: labRequest.orderedBy,
      hospitalId: labRequest.hospitalId,
      status: labRequest.status,
      testType: labRequest.testName,
      description: labRequest.notes || labRequest.panel || undefined,
      requestedDate: labRequest.orderedAt,
      createdAt: labRequest.createdAt,
      updatedAt: labRequest.verifiedAt || labRequest.completedAt || labRequest.collectedAt || labRequest.orderedAt,
    });

    return NextResponse.json(fhirServiceRequest, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
      },
    });
  } catch (err) {
    logger.error('[FHIR ServiceRequest GET] Error', {
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
