import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import {
  mapPatientToFHIR,
  mapPrescriptionToFHIR,
  mapVitalsToFHIR,
} from '@/lib/fhir/fhir-mappers';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ patientId: string }> },
) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:fhir-summary',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const { patientId } = await context.params;

  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      hospitalId: guard.session.hospitalId,
    },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  }

  const [vitals, prescriptions] = await Promise.all([
    prisma.clinicalVital.findMany({
      where: {
        patientId: patient.id,
        hospitalId: guard.session.hospitalId,
      },
      orderBy: [{ recordedAt: 'desc' }],
      take: 5,
    }),
    prisma.prescription.findMany({
      where: {
        patientId: patient.id,
        hospitalId: guard.session.hospitalId,
      },
      orderBy: [{ prescribedAt: 'desc' }],
      take: 5,
    }),
  ]);

  const patientResource = mapPatientToFHIR({
    id: patient.id,
    name: patient.name,
    gender: patient.gender === 'F' ? 'F' : 'M',
    dob: patient.dob.toISOString().slice(0, 10),
    phone: patient.phone ?? undefined,
    id_number: patient.idNumber ?? undefined,
    blood_group: patient.bloodGroup ?? undefined,
    allergies: patient.allergies ?? [],
    insurance_provider: patient.insuranceProvider ?? undefined,
    insurance_id: patient.insuranceId ?? undefined,
    updated_at: patient.updatedAt.toISOString(),
  });

  const observations = vitals.flatMap((vital: any) =>
    mapVitalsToFHIR(patient.id, {
      bp: vital.bloodPressure ?? '0/0',
      pulse: vital.heartRate ?? 0,
      temp: Number(vital.tempC ?? 0),
      spo2: vital.spo2 ?? 0,
      rr: vital.respRate ?? 0,
      weight: vital.weight ? Number(vital.weight) : undefined,
      height: vital.height ? Number(vital.height) : undefined,
      recordedAt: vital.recordedAt.toISOString(),
      recordedBy: vital.recordedBy ?? 'unknown',
    }),
  );

  const medicationRequests = prescriptions.map((rx: any) =>
    mapPrescriptionToFHIR(
      patient.id,
      Array.isArray(rx.items) ? (rx.items as Array<{
        drug: string;
        genericName?: string;
        dose: string;
        frequency: string;
        duration: string;
        route: string;
        quantity: number;
        notes?: string;
      }>) : [],
      rx.rxNumber,
      rx.prescribedBy,
    ),
  );

  return NextResponse.json({
    patient: patientResource,
    observations,
    medicationRequests,
  });
}

