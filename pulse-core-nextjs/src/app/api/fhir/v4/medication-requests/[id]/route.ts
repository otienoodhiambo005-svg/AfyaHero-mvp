/**
 * GET /api/fhir/v4/medication-requests/[id]
 * 
 * Returns a FHIR R4 MedicationRequest resource for the given prescription ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { mapMedicationRequestToFHIR } from '@/lib/fhir-mappers';
import logger from '@/lib/logger';

function getPrescriptionItemValue(items: unknown, key: 'medicationName' | 'name' | 'drug' | 'dosage' | 'frequency' | 'duration'): string | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const firstItem = items[0] as Record<string, unknown>;
  const value = firstItem[key];
  return typeof value === 'string' ? value : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireRoles(request, ['medical', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Fetch prescription from database
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `MedicationRequest not found: ${id}`,
            },
          ],
        },
        { status: 404 },
      );
    }

    // Check access
    if (prescription.hospitalId !== session.hospitalId && session.role !== 'admin') {
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
    const fhirMedicationRequest = mapMedicationRequestToFHIR({
      id: prescription.id,
      patientId: prescription.patientId,
      profileId: prescription.prescribedBy,
      hospitalId: prescription.hospitalId,
      status: prescription.status,
      medicationName: getPrescriptionItemValue(prescription.items, 'medicationName') || getPrescriptionItemValue(prescription.items, 'name') || getPrescriptionItemValue(prescription.items, 'drug') || 'Medication',
      dosage: getPrescriptionItemValue(prescription.items, 'dosage'),
      frequency: getPrescriptionItemValue(prescription.items, 'frequency'),
      duration: getPrescriptionItemValue(prescription.items, 'duration'),
      prescribedDate: prescription.prescribedAt,
      createdAt: prescription.createdAt,
      updatedAt: prescription.dispensedAt || prescription.prescribedAt,
    });

    return NextResponse.json(fhirMedicationRequest, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
      },
    });
  } catch (err) {
    logger.error('[FHIR MedicationRequest GET] Error', {
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
