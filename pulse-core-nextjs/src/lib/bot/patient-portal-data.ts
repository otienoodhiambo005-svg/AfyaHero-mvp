/**
 * Patient-facing bot data — lookups by phone for USSD / WhatsApp menus.
 */
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { isDatabaseAvailable } from '@/lib/data/handover';

function normalizePhone(phone: string): string[] {
  const digits = phone.replace(/[\s\-+]/g, '');
  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (digits.startsWith('254')) variants.add(`0${digits.slice(3)}`);
  if (digits.startsWith('0')) variants.add(`254${digits.slice(1)}`);
  if (digits.length === 9) variants.add(`254${digits}`);
  return [...variants];
}

export type BotPatientContext = {
  id: string;
  hospitalId: string;
  name: string;
  phone: string | null;
  bloodGroup: string | null;
  allergies: string[];
};

export async function findPatientByPhone(phoneNumber: string): Promise<BotPatientContext | null> {
  if (!isDatabaseAvailable()) return null;

  const variants = normalizePhone(phoneNumber);
  try {
    const patient = await prisma.patient.findFirst({
      where: {
        OR: variants.flatMap((v) => [
          { phone: v },
          { phone: { contains: v.slice(-9) } },
        ]),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!patient?.hospitalId) return null;
    return {
      id: patient.id,
      hospitalId: patient.hospitalId,
      name: patient.name,
      phone: patient.phone,
      bloodGroup: patient.bloodGroup,
      allergies: patient.allergies,
    };
  } catch (error) {
    logger.warn('[Bot] Patient lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getUpcomingAppointmentsForPatient(
  patientId: string,
  hospitalId: string,
  limit = 5,
): Promise<Array<{ date: string; notes: string }>> {
  if (!isDatabaseAvailable()) return [];

  try {
    const now = new Date();
    const rows = await prisma.appointment.findMany({
      where: {
        patientId,
        hospitalId,
        appointmentDate: { gte: now },
        status: { notIn: ['Cancelled', 'Completed'] },
      },
      orderBy: { appointmentDate: 'asc' },
      take: limit,
    });
    return rows.map((a) => ({
      date: a.appointmentDate.toLocaleDateString('en-GB'),
      notes: a.type ?? a.notes ?? 'Appointment',
    }));
  } catch (error) {
    logger.warn('[Bot] Appointment lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function getActivePrescriptionsForPatient(
  patientId: string,
  hospitalId: string,
  limit = 5,
): Promise<Array<{ summary: string }>> {
  if (!isDatabaseAvailable()) return [];

  try {
    const rows = await prisma.prescription.findMany({
      where: {
        patientId,
        hospitalId,
        status: { in: ['pending', 'dispensing', 'partial'] },
      },
      orderBy: { prescribedAt: 'desc' },
      take: limit,
    });
    return rows.map((rx) => {
      const items = Array.isArray(rx.items) ? rx.items : [];
      const first = items[0] as { name?: string; drug?: string; dose?: string } | undefined;
      const label = first?.name ?? first?.drug ?? rx.rxNumber;
      const dose = first?.dose ? ` - ${first.dose}` : '';
      return { summary: `${label}${dose}` };
    });
  } catch (error) {
    logger.warn('[Bot] Prescription lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function getRecentLabResultsForPatient(
  patientId: string,
  hospitalId: string,
  limit = 5,
): Promise<Array<{ test: string; date: string; flag: string }>> {
  if (!isDatabaseAvailable()) return [];

  try {
    const rows = await prisma.labRequest.findMany({
      where: { patientId, hospitalId, status: { in: ['completed', 'verified'] } },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
    return rows.map((lab) => ({
      test: lab.testName,
      date: (lab.completedAt ?? lab.orderedAt).toLocaleDateString('en-GB'),
      flag: lab.critical ? 'Critical' : lab.abnormal ? 'Abnormal' : 'Normal',
    }));
  } catch (error) {
    logger.warn('[Bot] Lab results lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
