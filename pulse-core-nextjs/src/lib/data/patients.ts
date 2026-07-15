/**
 * Patient data access — Prisma (tenant-scoped), Supabase fallback, mock for demo.
 */
import type { ClinicalVital, Patient } from '@prisma/client';
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { supabaseServer, isSupabaseAvailable } from '../supabase-server';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import { isDatabaseAvailable } from './handover';
import { DataSourceUnavailableError } from './errors';

export interface PatientRow {
  id: string;
  pid: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  phone: string;
  SHIF_no?: string;
  national_id?: string;
  status: string;
  priority: string;
  checkin_time: string;
  complaint: string;
  assigned_doctor?: string;
  ward?: string;
  blood_group?: string;
  allergies?: string[];
  vitals?: Record<string, unknown>;
}

export interface VitalsRow {
  patient_id: string;
  bp: string;
  pulse: number;
  temp: number;
  spo2: number;
  rr: number;
  weight?: number;
  height?: number;
  recorded_at: string;
  recorded_by: string;
}

export const MOCK_PATIENTS: PatientRow[] = [
  {
    id: '1',
    pid: 'PID-11234',
    name: 'Hassan Ali',
    age: 52,
    gender: 'M',
    phone: '+254712345678',
    status: 'in-consult',
    priority: 'urgent',
    checkin_time: '08:15',
    complaint: 'Chest pain radiating to jaw, diaphoresis. Severe SOB.',
    assigned_doctor: 'Dr. Amina Osei',
    blood_group: 'A+',
    allergies: ['Penicillin', 'Sulfa drugs'],
    vitals: { bp: '158/96', pulse: 98, temp: 37.4, spo2: 94, rr: 20 },
  },
  {
    id: '2',
    pid: 'PID-11235',
    name: 'Fatuma Wanjiru',
    age: 34,
    gender: 'F',
    phone: '+254723456789',
    status: 'admitted',
    priority: 'urgent',
    checkin_time: '08:30',
    complaint: 'Severe anaemia, dizziness, conjunctival pallor. Hb 5.2 g/dL.',
    blood_group: 'O+',
    allergies: ['NSAIDs'],
    vitals: { bp: '90/60', pulse: 112, temp: 36.8, spo2: 98, rr: 18 },
    ward: 'Maternity',
  },
  {
    id: '3',
    pid: 'PID-11236',
    name: 'Peter Kamau',
    age: 45,
    gender: 'M',
    phone: '+254734567890',
    status: 'waiting',
    priority: 'normal',
    checkin_time: '09:00',
    complaint: 'Persistent cough > 3 weeks, evening fevers, night sweats.',
    blood_group: 'B+',
    allergies: [],
    vitals: { bp: '124/82', pulse: 78, temp: 38.2, spo2: 96, rr: 22 },
  },
  {
    id: '4',
    pid: 'PID-11237',
    name: 'Grace Muthoni',
    age: 28,
    gender: 'F',
    phone: '+254745678901',
    status: 'waiting',
    priority: 'normal',
    checkin_time: '09:15',
    complaint: 'Antenatal follow-up, 28 weeks. Reported reduced fetal movement.',
    blood_group: 'O-',
    allergies: [],
    vitals: { bp: '110/70', pulse: 82, temp: 36.6, spo2: 100, rr: 16 },
  },
  {
    id: '5',
    pid: 'PID-11238',
    name: 'James Odhiambo',
    age: 8,
    gender: 'M',
    phone: '+254756789012',
    status: 'done',
    priority: 'urgent',
    checkin_time: '07:45',
    complaint: 'Malaria symptoms. High fever, vomiting, lethargy.',
    blood_group: 'AB+',
    allergies: ['Erythromycin'],
    vitals: { bp: '100/60', pulse: 105, temp: 39.5, spo2: 97, rr: 24 },
  },
  {
    id: '6',
    pid: 'PID-11239',
    name: 'Amina Sheikh',
    age: 62,
    gender: 'F',
    phone: '+254767890123',
    status: 'admitted',
    priority: 'critical',
    checkin_time: '06:20',
    complaint: 'DKA presentation. Confusion, Kussmaul breathing.',
    ward: 'ICU',
    blood_group: 'A-',
    allergies: [],
    vitals: { bp: '105/65', pulse: 118, temp: 37.2, spo2: 95, rr: 28 },
  },
];

function ageFromDob(dob: Date): number {
  return Math.floor((Date.now() - dob.getTime()) / 31557600000);
}

function mapVitals(vital: ClinicalVital | undefined): Record<string, unknown> | undefined {
  if (!vital) return undefined;
  return {
    bp: vital.bloodPressure ?? undefined,
    pulse: vital.heartRate ?? undefined,
    temp: vital.tempC != null ? Number(vital.tempC) : undefined,
    spo2: vital.spo2 ?? undefined,
    rr: vital.respRate ?? undefined,
    weight: vital.weight != null ? Number(vital.weight) : undefined,
    height: vital.height != null ? Number(vital.height) : undefined,
  };
}

function mapPrismaPatient(
  p: Patient & {
    clinicalVitals: ClinicalVital[];
    hospitalBeds: { wardName: string }[];
    receptionCheckins: { chiefComplaint: string | null; checkedInAt: Date }[];
  },
  index: number,
): PatientRow {
  const latestVital = p.clinicalVitals[0];
  const latestCheckin = p.receptionCheckins[0];
  const genderChar = (p.gender ?? 'M').charAt(0).toUpperCase();
  return {
    id: p.id,
    pid: p.idNumber ? `PID-${p.idNumber}` : `PID-${String(10000 + index)}`,
    name: p.name,
    age: ageFromDob(p.dob),
    gender: genderChar === 'F' ? 'F' : 'M',
    phone: p.phone ?? '',
    SHIF_no: p.shifNumber ?? p.insuranceId ?? undefined,
    national_id: p.idNumber ?? undefined,
    status: (p.status ?? 'waiting').toLowerCase(),
    priority: 'normal',
    checkin_time: (latestCheckin?.checkedInAt ?? p.createdAt).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    complaint: latestCheckin?.chiefComplaint ?? '',
    blood_group: p.bloodGroup ?? undefined,
    allergies: p.allergies.length > 0 ? p.allergies : undefined,
    vitals: mapVitals(latestVital),
    ward: p.hospitalBeds[0]?.wardName,
  };
}

async function getPatientsFromPrisma(hospitalId: string): Promise<PatientRow[]> {
  const tenant = getTenantPrismaClient(hospitalId);
  const rows = await tenant.patient.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      clinicalVitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
      hospitalBeds: { take: 1, select: { wardName: true } },
      receptionCheckins: { orderBy: { checkedInAt: 'desc' }, take: 1, select: { chiefComplaint: true, checkedInAt: true } },
    },
  });
  return rows.map((p, i) => mapPrismaPatient(p, i));
}

async function getPatientsFromSupabase(hospitalId?: string): Promise<PatientRow[]> {
  let query = supabaseServer!
    .from('patients')
    .select('id, name, gender, dob, id_number, phone, insurance_provider, insurance_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (hospitalId) {
    query = query.eq('hospital_id', hospitalId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((row: Record<string, unknown>, i: number) => {
    const dob = row.dob as string;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : 0;
    return {
      id: row.id as string,
      pid: `PID-${String(10000 + i)}`,
      name: row.name as string,
      age,
      gender: (row.gender || 'M') as 'M' | 'F',
      phone: (row.phone || '') as string,
      SHIF_no: (row.insurance_id || undefined) as string | undefined,
      status: (row.status || 'waiting') as string,
      priority: 'normal',
      checkin_time: new Date(row.created_at as string).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      complaint: '',
      blood_group: undefined,
      allergies: [],
    };
  });
}

export async function getPatients(hospitalId?: string): Promise<PatientRow[]> {
  if (isDatabaseAvailable() && hospitalId) {
    try {
      const rows = await getPatientsFromPrisma(hospitalId);
      if (rows.length > 0) return rows;
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No patient data returned from database in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      logger.warn('Prisma patient query failed', {
        error: error instanceof Error ? error.message : String(error),
        hospitalId,
      });
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Patient data query failed in strict production mode.');
      }
    }
  }

  if (isSupabaseAvailable()) {
    try {
      const rows = await getPatientsFromSupabase(hospitalId);
      if (rows.length > 0) return rows;
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('No patient data returned from Supabase in strict production mode.');
      }
    } catch (error) {
      if (error instanceof DataSourceUnavailableError) throw error;
      if (isStrictProductionMode()) {
        throw new DataSourceUnavailableError('Patient data query failed in strict production mode.');
      }
    }
  }

  if (isStrictProductionMode()) {
    throw new DataSourceUnavailableError('Patient data source unavailable in strict production mode.');
  }
  return MOCK_PATIENTS;
}

export async function getPatientById(id: string, hospitalId?: string): Promise<PatientRow | null> {
  const patients = await getPatients(hospitalId);
  return patients.find((p) => p.id === id) ?? null;
}
