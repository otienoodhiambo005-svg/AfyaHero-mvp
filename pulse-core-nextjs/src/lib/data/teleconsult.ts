/**
 * Teleconsultation appointments & waitroom — Prisma (tenant-scoped), memory fallback for demo without DATABASE_URL.
 */
import type { TeleconsultAppointment, TeleconsultWaitroom } from '@prisma/client';
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import { DataSourceUnavailableError } from './errors';

export type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed';

export type TeleconsultAppointmentRecord = {
  id: string;
  patient: string;
  time: string;
  mode: 'Video' | 'Call' | 'Text';
  clinician: string;
  status: AppointmentStatus;
};

export type TeleconsultWaitroomRecord = {
  id: string;
  patient: string;
  waitingFor: string;
  waitMinutes: number;
  mode: 'Video' | 'Call' | 'Text';
  priority: 'Normal' | 'Urgent';
};

export type CreateTeleconsultAppointmentInput = {
  patient: string;
  time: string;
  mode: 'Video' | 'Call' | 'Text';
  clinician: string;
  status?: AppointmentStatus;
};

export type CreateTeleconsultWaitroomInput = {
  patient: string;
  waitingFor: string;
  waitMinutes: number;
  mode: 'Video' | 'Call' | 'Text';
  priority: 'Normal' | 'Urgent';
};

export function isDatabaseAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const APPOINTMENTS_SEED: TeleconsultAppointmentRecord[] = [
  { id: 'TC-301', patient: 'Grace Muthoni', time: '14:00', mode: 'Video', clinician: 'Dr. Amina', status: 'Scheduled' },
  { id: 'TC-302', patient: 'David Otieno', time: '14:30', mode: 'Call', clinician: 'Dr. Amina', status: 'Confirmed' },
  { id: 'TC-303', patient: 'Linet Njeri', time: '15:00', mode: 'Text', clinician: 'Dr. Amina', status: 'In Progress' },
  { id: 'TC-304', patient: 'Musa Abdi', time: '15:30', mode: 'Video', clinician: 'Dr. Amina', status: 'Completed' },
];

const WAITROOM_SEED: TeleconsultWaitroomRecord[] = [
  { id: 'WR-11', patient: 'Peter Kamau', waitingFor: 'Respiratory follow-up', waitMinutes: 9, mode: 'Video', priority: 'Normal' },
  { id: 'WR-12', patient: 'Fatuma Ali', waitingFor: 'Medication side-effect review', waitMinutes: 22, mode: 'Call', priority: 'Urgent' },
  { id: 'WR-13', patient: 'Joseph Njoroge', waitingFor: 'Lab result clarification', waitMinutes: 5, mode: 'Text', priority: 'Normal' },
];

const memoryAppointmentsStore = new Map<string, TeleconsultAppointmentRecord[]>();
const memoryWaitroomStore = new Map<string, TeleconsultWaitroomRecord[]>();

function getMemoryKey(hospitalId: string | undefined, userId: string): string {
  return hospitalId ? `hospital:${hospitalId}` : `user:${userId}`;
}

function getMemoryAppointments(hospitalId: string | undefined, userId: string): TeleconsultAppointmentRecord[] {
  const key = getMemoryKey(hospitalId, userId);
  if (!memoryAppointmentsStore.has(key)) {
    memoryAppointmentsStore.set(key, APPOINTMENTS_SEED.map((item) => ({ ...item })));
  }
  return memoryAppointmentsStore.get(key) ?? [];
}

function setMemoryAppointments(
  hospitalId: string | undefined,
  userId: string,
  items: TeleconsultAppointmentRecord[],
): void {
  memoryAppointmentsStore.set(getMemoryKey(hospitalId, userId), items);
}

function getMemoryWaitroom(hospitalId: string | undefined, userId: string): TeleconsultWaitroomRecord[] {
  const key = getMemoryKey(hospitalId, userId);
  if (!memoryWaitroomStore.has(key)) {
    memoryWaitroomStore.set(key, WAITROOM_SEED.map((item) => ({ ...item })));
  }
  return memoryWaitroomStore.get(key) ?? [];
}

function setMemoryWaitroom(
  hospitalId: string | undefined,
  userId: string,
  items: TeleconsultWaitroomRecord[],
): void {
  memoryWaitroomStore.set(getMemoryKey(hospitalId, userId), items);
}

function toAppointmentRecord(row: TeleconsultAppointment): TeleconsultAppointmentRecord {
  return {
    id: row.appointmentCode,
    patient: row.patientName,
    time: row.appointmentTime,
    mode: row.mode as TeleconsultAppointmentRecord['mode'],
    clinician: row.clinicianName,
    status: row.status as AppointmentStatus,
  };
}

function toWaitroomRecord(row: TeleconsultWaitroom): TeleconsultWaitroomRecord {
  return {
    id: row.waitroomCode,
    patient: row.patientName,
    waitingFor: row.waitingFor,
    waitMinutes: row.waitMinutes,
    mode: row.mode as TeleconsultWaitroomRecord['mode'],
    priority: row.priority as TeleconsultWaitroomRecord['priority'],
  };
}

export function generateAppointmentCode(existing: TeleconsultAppointmentRecord[]): string {
  const max = existing.reduce((currentMax, item) => {
    const match = item.id.match(/TC-(\d+)/i);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 300);

  return `TC-${max + 1}`;
}

export function generateWaitroomCode(existing: TeleconsultWaitroomRecord[]): string {
  const max = existing.reduce((currentMax, item) => {
    const match = item.id.match(/WR-(\d+)/i);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 10);

  return `WR-${max + 1}`;
}

export async function listTeleconsultAppointments(
  hospitalId: string | undefined,
  userId: string,
): Promise<{ items: TeleconsultAppointmentRecord[]; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for teleconsult appointments in strict production mode.',
      );
    }
    return { items: getMemoryAppointments(hospitalId, userId), source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'hospitalId is required for teleconsult appointment queries in strict production mode.',
      );
    }
    return { items: getMemoryAppointments(hospitalId, userId), source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const rows = await tenant.teleconsultAppointment.findMany({
      orderBy: { appointmentTime: 'asc' },
      take: 100,
    });
    return { items: rows.map(toAppointmentRecord), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma teleconsult appointment list failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'Teleconsult appointment list query failed in strict production mode.',
      );
    }
    return { items: getMemoryAppointments(hospitalId, userId), source: 'memory' };
  }
}

export async function createTeleconsultAppointment(
  hospitalId: string | undefined,
  userId: string,
  input: CreateTeleconsultAppointmentInput,
): Promise<{ item: TeleconsultAppointmentRecord; source: 'prisma' | 'memory' }> {
  const status = input.status ?? 'Scheduled';

  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for teleconsult appointment create in strict production mode.',
      );
    }
    const items = getMemoryAppointments(hospitalId, userId);
    const newItem: TeleconsultAppointmentRecord = {
      id: generateAppointmentCode(items),
      patient: input.patient,
      time: input.time,
      mode: input.mode,
      clinician: input.clinician,
      status,
    };
    setMemoryAppointments(hospitalId, userId, [...items, newItem]);
    return { item: newItem, source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'hospitalId is required to create teleconsult appointment in strict production mode.',
      );
    }
    const items = getMemoryAppointments(hospitalId, userId);
    const newItem: TeleconsultAppointmentRecord = {
      id: generateAppointmentCode(items),
      patient: input.patient,
      time: input.time,
      mode: input.mode,
      clinician: input.clinician,
      status,
    };
    setMemoryAppointments(hospitalId, userId, [...items, newItem]);
    return { item: newItem, source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const appointmentCode = `TC-${Date.now().toString().slice(-6)}`;
    const row = await tenant.teleconsultAppointment.create({
      data: {
        hospitalId,
        appointmentCode,
        patientName: input.patient,
        appointmentTime: input.time,
        mode: input.mode,
        clinicianName: input.clinician,
        status,
      },
    });
    return { item: toAppointmentRecord(row), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma teleconsult appointment create failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'Teleconsult appointment create failed in strict production mode.',
      );
    }
    const items = getMemoryAppointments(hospitalId, userId);
    const newItem: TeleconsultAppointmentRecord = {
      id: generateAppointmentCode(items),
      patient: input.patient,
      time: input.time,
      mode: input.mode,
      clinician: input.clinician,
      status,
    };
    setMemoryAppointments(hospitalId, userId, [...items, newItem]);
    return { item: newItem, source: 'memory' };
  }
}

export async function updateTeleconsultAppointmentStatus(
  hospitalId: string | undefined,
  userId: string,
  appointmentCode: string,
  status: AppointmentStatus,
): Promise<{ item: TeleconsultAppointmentRecord | null; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for teleconsult appointment updates in strict production mode.',
      );
    }
    const items = getMemoryAppointments(hospitalId, userId);
    const index = items.findIndex((item) => item.id === appointmentCode);
    if (index < 0) {
      return { item: null, source: 'memory' };
    }
    const updated = { ...items[index], status };
    const next = [...items];
    next[index] = updated;
    setMemoryAppointments(hospitalId, userId, next);
    return { item: updated, source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'hospitalId is required to update teleconsult appointment in strict production mode.',
      );
    }
    const items = getMemoryAppointments(hospitalId, userId);
    const index = items.findIndex((item) => item.id === appointmentCode);
    if (index < 0) return { item: null, source: 'memory' };
    const updated = { ...items[index], status };
    const next = [...items];
    next[index] = updated;
    setMemoryAppointments(hospitalId, userId, next);
    return { item: updated, source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const existing = await tenant.teleconsultAppointment.findFirst({
      where: { appointmentCode },
    });
    if (!existing) {
      return { item: null, source: 'prisma' };
    }

    const row = await tenant.teleconsultAppointment.update({
      where: { appointmentCode },
      data: { status },
    });
    return { item: toAppointmentRecord(row), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma teleconsult appointment status update failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
      appointmentCode,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'Teleconsult appointment status update failed in strict production mode.',
      );
    }
    const items = getMemoryAppointments(hospitalId, userId);
    const index = items.findIndex((item) => item.id === appointmentCode);
    if (index < 0) return { item: null, source: 'memory' };
    const updated = { ...items[index], status };
    const next = [...items];
    next[index] = updated;
    setMemoryAppointments(hospitalId, userId, next);
    return { item: updated, source: 'memory' };
  }
}

export async function listTeleconsultWaitroom(
  hospitalId: string | undefined,
  userId: string,
): Promise<{ items: TeleconsultWaitroomRecord[]; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for teleconsult waitroom in strict production mode.',
      );
    }
    return { items: getMemoryWaitroom(hospitalId, userId), source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'hospitalId is required for teleconsult waitroom queries in strict production mode.',
      );
    }
    return { items: getMemoryWaitroom(hospitalId, userId), source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const rows = await tenant.teleconsultWaitroom.findMany({
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return { items: rows.map(toWaitroomRecord), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma teleconsult waitroom list failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Teleconsult waitroom list query failed in strict production mode.');
    }
    return { items: getMemoryWaitroom(hospitalId, userId), source: 'memory' };
  }
}

export async function createTeleconsultWaitroomEntry(
  hospitalId: string | undefined,
  userId: string,
  input: CreateTeleconsultWaitroomInput,
): Promise<{ item: TeleconsultWaitroomRecord; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for teleconsult waitroom create in strict production mode.',
      );
    }
    const items = getMemoryWaitroom(hospitalId, userId);
    const newItem: TeleconsultWaitroomRecord = {
      id: generateWaitroomCode(items),
      patient: input.patient,
      waitingFor: input.waitingFor,
      waitMinutes: input.waitMinutes,
      mode: input.mode,
      priority: input.priority,
    };
    setMemoryWaitroom(hospitalId, userId, [...items, newItem]);
    return { item: newItem, source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'hospitalId is required to create teleconsult waitroom entry in strict production mode.',
      );
    }
    const items = getMemoryWaitroom(hospitalId, userId);
    const newItem: TeleconsultWaitroomRecord = {
      id: generateWaitroomCode(items),
      patient: input.patient,
      waitingFor: input.waitingFor,
      waitMinutes: input.waitMinutes,
      mode: input.mode,
      priority: input.priority,
    };
    setMemoryWaitroom(hospitalId, userId, [...items, newItem]);
    return { item: newItem, source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const waitroomCode = `WR-${Date.now().toString().slice(-6)}`;
    const row = await tenant.teleconsultWaitroom.create({
      data: {
        hospitalId,
        waitroomCode,
        patientName: input.patient,
        waitingFor: input.waitingFor,
        waitMinutes: input.waitMinutes,
        mode: input.mode,
        priority: input.priority,
      },
    });
    return { item: toWaitroomRecord(row), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma teleconsult waitroom create failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Teleconsult waitroom create failed in strict production mode.');
    }
    const items = getMemoryWaitroom(hospitalId, userId);
    const newItem: TeleconsultWaitroomRecord = {
      id: generateWaitroomCode(items),
      patient: input.patient,
      waitingFor: input.waitingFor,
      waitMinutes: input.waitMinutes,
      mode: input.mode,
      priority: input.priority,
    };
    setMemoryWaitroom(hospitalId, userId, [...items, newItem]);
    return { item: newItem, source: 'memory' };
  }
}

export async function deleteTeleconsultWaitroomEntry(
  hospitalId: string | undefined,
  userId: string,
  waitroomCode: string,
): Promise<{ ok: boolean; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for teleconsult waitroom delete in strict production mode.',
      );
    }
    const items = getMemoryWaitroom(hospitalId, userId);
    setMemoryWaitroom(hospitalId, userId, items.filter((item) => item.id !== waitroomCode));
    return { ok: true, source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'hospitalId is required to delete teleconsult waitroom entry in strict production mode.',
      );
    }
    const items = getMemoryWaitroom(hospitalId, userId);
    setMemoryWaitroom(hospitalId, userId, items.filter((item) => item.id !== waitroomCode));
    return { ok: true, source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const existing = await tenant.teleconsultWaitroom.findFirst({
      where: { waitroomCode },
    });
    if (!existing) {
      return { ok: false, source: 'prisma' };
    }

    await tenant.teleconsultWaitroom.delete({
      where: { waitroomCode },
    });
    return { ok: true, source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma teleconsult waitroom delete failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
      waitroomCode,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Teleconsult waitroom delete failed in strict production mode.');
    }
    const items = getMemoryWaitroom(hospitalId, userId);
    setMemoryWaitroom(hospitalId, userId, items.filter((item) => item.id !== waitroomCode));
    return { ok: true, source: 'memory' };
  }
}
