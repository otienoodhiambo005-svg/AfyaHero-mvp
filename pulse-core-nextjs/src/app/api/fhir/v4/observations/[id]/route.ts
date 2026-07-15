/**
 * GET /api/fhir/v4/observations/[id]
 * 
 * Returns a FHIR R4 Observation resource for the given clinical vital ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { mapObservationToFHIR } from '@/lib/fhir-mappers';
import logger from '@/lib/logger';

function resolveVitalObservation(vital: {
  tempC: { toString(): string } | null;
  heartRate: number | null;
  respRate: number | null;
  spo2: number | null;
  bloodPressure: string | null;
  recordedBy: string | null;
}) {
  if (vital.tempC !== null) {
    return { observationType: 'TEMPERATURE', value: Number(vital.tempC), unit: 'Cel' };
  }

  if (vital.heartRate !== null) {
    return { observationType: 'HEART_RATE', value: vital.heartRate, unit: '/min' };
  }

  if (vital.respRate !== null) {
    return { observationType: 'RESPIRATORY_RATE', value: vital.respRate, unit: '/min' };
  }

  if (vital.spo2 !== null) {
    return { observationType: 'OXYGEN_SATURATION', value: vital.spo2, unit: '%' };
  }

  if (vital.bloodPressure) {
    return { observationType: 'BLOOD_PRESSURE', value: vital.bloodPressure, unit: 'mmHg' };
  }

  return { observationType: 'VITAL', value: undefined, unit: undefined };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireRoles(request, ['medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    // Fetch clinical vital from database
    const vital = await prisma.clinicalVital.findUnique({
      where: { id },
    });

    if (!vital) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `Observation not found: ${id}`,
            },
          ],
        },
        { status: 404 },
      );
    }

    // Check access
    if (vital.hospitalId !== session.hospitalId && session.role !== 'admin') {
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

    const resolvedVital = resolveVitalObservation(vital);
    const observationType = resolvedVital.observationType;
    const loincMap: Record<string, string> = {
      TEMPERATURE: '8310-5',
      HEART_RATE: '8867-4',
      RESPIRATORY_RATE: '9279-1',
      BLOOD_PRESSURE_SYSTOLIC: '8480-6',
      BLOOD_PRESSURE_DIASTOLIC: '8462-4',
      BLOOD_PRESSURE: '85354-9',
      OXYGEN_SATURATION: '59408-5',
    };

    // Transform to FHIR
    const fhirObservation = mapObservationToFHIR({
      id: vital.id,
      patientId: vital.patientId,
      profileId: vital.recordedBy || undefined,
      hospitalId: vital.hospitalId,
      observationType,
      value: resolvedVital.value,
      unit: resolvedVital.unit,
      code: loincMap[observationType] || observationType,
      description: observationType,
      recordedDate: vital.recordedAt,
      createdAt: vital.createdAt,
      updatedAt: vital.recordedAt,
    });

    return NextResponse.json(fhirObservation, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
      },
    });
  } catch (err) {
    logger.error('[FHIR Observation GET] Error', {
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
