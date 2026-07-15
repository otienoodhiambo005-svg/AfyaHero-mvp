/**
 * GET /api/fhir/v4/patients/[id]
 * 
 * Returns a FHIR R4 Patient resource for the given patient ID.
 * Transforms the internal Patient model to FHIR format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { mapPatientToFHIR } from '@/lib/fhir-mappers';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Fetch patient from database
    const patient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!patient) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `Patient not found: ${id}`,
            },
          ],
        },
        { status: 404 },
      );
    }

    // Check if user has access to this hospital's data
    if (patient.hospitalId !== session.hospitalId && session.role !== 'admin') {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'forbidden',
              diagnostics: 'Access denied to patient from another hospital',
            },
          ],
        },
        { status: 403 },
      );
    }

    // Transform to FHIR
    const fhirPatient = mapPatientToFHIR(patient);

    return NextResponse.json(fhirPatient, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
      },
    });
  } catch (err) {
    logger.error('[FHIR Patient GET] Error', {
      error: err instanceof Error ? err.message : String(err),
      params,
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
