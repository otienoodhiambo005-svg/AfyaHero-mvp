import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { VitalsSchema } from '@/lib/schemas';

interface PatientLookup {
  id: string;
}

interface CreatedVital {
  id: string;
  patientId: string;
  recordedAt: Date;
}

interface VitalsDbClient {
  patient: {
    findFirst: (args: {
      where: { id?: string; hospitalId: string; name?: string };
      select: { id: true };
    }) => Promise<PatientLookup | null>;
  };
  clinicalVital: {
    create: (args: {
      data: {
        hospitalId: string;
        patientId: string;
        recordedBy: string;
        bloodPressure?: string;
        tempC?: number;
        heartRate?: number;
        respRate?: number;
        spo2?: number;
        weight?: number;
        height?: number;
        bmi?: number;
      };
      select: { id: true; patientId: true; recordedAt: true };
    }) => Promise<CreatedVital>;
  };
}

export async function POST(req: NextRequest) {
  const { session, response } = await enforceApiGuard(req, {
    roles: ['medical', 'admin', 'super_admin'],
    scope: 'api:medical:vitals',
  });
  if (response) return response;
  if (!session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await req.json();
  const validated = VitalsSchema.parse(body);

  const {
    patient_id: patientIdCandidate,
    sbp,
    dbp,
    temperature: tempValue,
    heart_rate: heartRateValue,
    respiratory_rate: respRateValue,
    spo2,
    weight,
    height,
  } = validated;

  let bloodPressure: string | undefined = undefined;
  if (sbp !== undefined && dbp !== undefined) {
    bloodPressure = `${sbp}/${dbp}`;
  } else if (sbp !== undefined) {
    bloodPressure = `${sbp}/?`;
  } else if (dbp !== undefined) {
    bloodPressure = `?/${dbp}`;
  }

  try {
    const db = prisma as unknown as VitalsDbClient;

    const patient = await db.patient.findFirst({
      where: { id: patientIdCandidate, hospitalId: session.hospitalId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found in this hospital.' },
        { status: 404 },
      );
    }

    const bmi =
      weight !== undefined && height !== undefined
        ? weight / Math.pow(height / 100, 2)
        : undefined;

    const vital = await db.clinicalVital.create({
      data: {
        hospitalId: session.hospitalId,
        patientId: patient.id,
        recordedBy: session.id,
        bloodPressure,
        tempC: tempValue,
        heartRate: heartRateValue !== undefined ? Math.round(heartRateValue) : undefined,
        respRate: respRateValue !== undefined ? Math.round(respRateValue) : undefined,
        spo2: spo2 !== undefined ? Math.round(spo2) : undefined,
        weight,
        height,
        bmi,
      },
      select: {
        id: true,
        patientId: true,
        recordedAt: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Vitals recorded successfully.',
        vital,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('medical vitals POST failed', { err, hospitalId: session.hospitalId });
    return NextResponse.json(
      { error: 'Unable to record vitals at this time.' },
      { status: 500 },
    );
  }
}
