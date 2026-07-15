import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const TZ = 'Africa/Nairobi';

const timeFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatCheckinTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return timeFmt.format(d);
}

function mapPriority(p: string, triageSeverity: string | null): 'Urgent' | 'High' | 'Normal' | 'Low' {
  const pr = (p ?? 'normal').toLowerCase();
  if (pr === 'critical') return 'Urgent';
  if (pr === 'urgent') return 'High';
  if (pr === 'low') return 'Low';
  const sev = (triageSeverity ?? '').toLowerCase();
  if (sev === 'high') return 'High';
  if (sev === 'medium') return 'Normal';
  return 'Normal';
}

function ageFromDob(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function waitMinutesLive(arrivedAt: Date | null | undefined, stored: number): number {
  if (!arrivedAt) return stored;
  const mins = Math.round((Date.now() - arrivedAt.getTime()) / 60_000);
  return Math.max(0, mins);
}

export type MedicalQueueApiItem = {
  queueId: string;
  token: string;
  patient: string;
  age: number | null;
  complaint: string;
  checkinTime: string;
  waitMinutes: number;
  priority: 'Urgent' | 'High' | 'Normal' | 'Low';
  status: string;
  vitals?: {
    temp: string;
    bp: string;
    pulse: string;
    spo2: string;
  };
};

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:queue',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const hospitalId = guard.session.hospitalId;

  try {
    const rows = await prisma.hospitalQueue.findMany({
      where: {
        hospitalId,
        serviceType: { in: ['OPD', 'Triage'] },
        status: { notIn: ['completed', 'cancelled'] },
      },
      include: {
        patient: { select: { dob: true } },
      },
      orderBy: [{ arrivedAt: 'asc' }, { tokenNumber: 'asc' }],
      take: 150,
    });

    const patientIds = rows.map(r => r.patientId).filter((id): id is string => Boolean(id));
    const vitalsByPatient = new Map<string, { tempC: unknown; bloodPressure: string | null; heartRate: number | null; spo2: number | null }>();

    if (patientIds.length > 0) {
      const vitalsRows = await prisma.clinicalVital.findMany({
        where: { hospitalId, patientId: { in: patientIds } },
        orderBy: { recordedAt: 'desc' },
        select: {
          patientId: true,
          tempC: true,
          bloodPressure: true,
          heartRate: true,
          spo2: true,
        },
      });
      for (const v of vitalsRows) {
        if (!vitalsByPatient.has(v.patientId)) {
          vitalsByPatient.set(v.patientId, v);
        }
      }
    }

    const items: MedicalQueueApiItem[] = rows.map(q => {
      const token = q.ticketNumber ?? `M-${String(q.tokenNumber).padStart(3, '0')}`;
      const age = q.patient ? ageFromDob(q.patient.dob) : null;
      const complaint = q.chiefComplaint?.trim() || '—';
      const vit = q.patientId ? vitalsByPatient.get(q.patientId) : undefined;
      let vitals: MedicalQueueApiItem['vitals'] | undefined;
      if (vit && (vit.tempC != null || vit.bloodPressure || vit.heartRate != null || vit.spo2 != null)) {
        const tempNum = vit.tempC != null ? Number(vit.tempC) : null;
        vitals = {
          temp: tempNum != null && !Number.isNaN(tempNum) ? `${tempNum.toFixed(1)}°C` : '—',
          bp: vit.bloodPressure?.trim() || '—',
          pulse: vit.heartRate != null ? String(vit.heartRate) : '—',
          spo2: vit.spo2 != null ? `${vit.spo2}%` : '—',
        };
      }

      return {
        queueId: q.id,
        token,
        patient: q.patientName,
        age,
        complaint,
        checkinTime: formatCheckinTime(q.arrivedAt),
        waitMinutes: waitMinutesLive(q.arrivedAt, q.waitMinutes),
        priority: mapPriority(q.priority, q.triageSeverity),
        status: q.status,
        vitals,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    logger.error('medical queue GET failed', { err: e, hospitalId });
    return NextResponse.json({ error: 'Unable to load medical queue.' }, { status: 500 });
  }
}
