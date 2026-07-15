/**
 * Medical handover data access — Prisma (tenant-scoped), memory fallback for demo without DATABASE_URL.
 */
import type { HandoverNote, Prisma } from '@prisma/client';
import { getTenantPrismaClient } from '@/lib/database';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import type { HandoverRecord, HandoverStatus } from '@/types';
import { DataSourceUnavailableError } from './errors';

const UUID_V4ISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** SBAR + patient context stored in criticalPatients[0] */
type CriticalPatientSbar = {
  patientId: string;
  patientName: string;
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
};

type PendingActionsPayload =
  | string[]
  | {
      recommendation?: string;
      cancelled?: boolean;
      apiStatus?: HandoverStatus;
    };

export function isDatabaseAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const HANDOVER_SEED: HandoverRecord[] = [
  {
    id: 'HO-101',
    patientId: 'P-001',
    patientName: 'Hassan Ali',
    senderId: 'D-001',
    senderName: 'Dr. Amina',
    situation: 'Acute STEMI, hyperkalaemia confirmed (K+ 6.8)',
    background: 'Admitted 2 hours ago via ER. Hx of HTN and DM II.',
    assessment: 'Critical condition. Stabilized with calcium gluconate.',
    recommendation: 'Monitor ECG every 15 mins. Repeat lytes in 2 hours.',
    status: 'Pending',
    createdAt: new Date().toISOString(),
  },
];

const memoryHandoverStore = new Map<string, HandoverRecord[]>();

function getMemoryKey(hospitalId: string | undefined, userId: string): string {
  return hospitalId ? `hospital:${hospitalId}` : `user:${userId}`;
}

function getMemoryHandovers(hospitalId: string | undefined, userId: string): HandoverRecord[] {
  const key = getMemoryKey(hospitalId, userId);
  if (!memoryHandoverStore.has(key)) {
    memoryHandoverStore.set(key, HANDOVER_SEED.map((item) => ({ ...item })));
  }
  return memoryHandoverStore.get(key) ?? [];
}

function setMemoryHandovers(
  hospitalId: string | undefined,
  userId: string,
  items: HandoverRecord[],
): void {
  memoryHandoverStore.set(getMemoryKey(hospitalId, userId), items);
}

function parseCriticalPatients(value: Prisma.JsonValue | null): CriticalPatientSbar[] {
  if (!value || !Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CriticalPatientSbar =>
      typeof entry === 'object'
      && entry !== null
      && 'patientId' in entry
      && typeof (entry as CriticalPatientSbar).patientId === 'string',
  );
}

function parseRecommendation(pendingActions: Prisma.JsonValue | null): string {
  if (!pendingActions) return '';
  if (Array.isArray(pendingActions)) {
    return pendingActions.filter((item): item is string => typeof item === 'string').join('\n');
  }
  if (typeof pendingActions === 'object' && pendingActions !== null && 'recommendation' in pendingActions) {
    const rec = (pendingActions as { recommendation?: unknown }).recommendation;
    return typeof rec === 'string' ? rec : '';
  }
  return '';
}

function mapPrismaStatusToApi(
  prismaStatus: string,
  pendingActions: Prisma.JsonValue | null,
  acknowledgedAt: Date | null,
): HandoverStatus {
  if (
    pendingActions
    && typeof pendingActions === 'object'
    && !Array.isArray(pendingActions)
    && (pendingActions as { cancelled?: boolean }).cancelled
  ) {
    return 'Cancelled';
  }
  if (
    pendingActions
    && typeof pendingActions === 'object'
    && !Array.isArray(pendingActions)
    && (pendingActions as { apiStatus?: HandoverStatus }).apiStatus === 'Completed'
  ) {
    return 'Completed';
  }
  if (prismaStatus === 'acknowledged' && acknowledgedAt) {
    return 'Acknowledged';
  }
  if (prismaStatus === 'acknowledged') {
    return 'Acknowledged';
  }
  if (prismaStatus === 'submitted' || prismaStatus === 'draft') {
    return 'Pending';
  }
  return 'Pending';
}

function toHandoverRecord(row: HandoverNote): HandoverRecord {
  const critical = parseCriticalPatients(row.criticalPatients);
  const patient = critical[0];
  const recommendation = parseRecommendation(row.pendingActions);

  return {
    id: row.id,
    patientId: patient?.patientId ?? '',
    patientName: patient?.patientName ?? '',
    senderId: row.handingOverStaffId ?? '',
    senderName: row.handingOverName ?? '',
    receiverId: row.receivingStaffId ?? undefined,
    receiverName: row.receivingName ?? undefined,
    situation: row.summary ?? patient?.situation ?? '',
    background: row.generalNotes ?? patient?.background ?? '',
    assessment: row.department ?? patient?.assessment ?? '',
    recommendation: recommendation || patient?.recommendation || '',
    status: mapPrismaStatusToApi(row.status, row.pendingActions, row.acknowledgedAt),
    createdAt: row.createdAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString(),
  };
}

function inferShiftType(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Morning';
  if (hour >= 14 && hour < 22) return 'Afternoon';
  return 'Night';
}

function buildCreatePayload(
  hospitalId: string,
  input: Omit<HandoverRecord, 'id' | 'createdAt' | 'status' | 'acknowledgedAt'> & { status?: HandoverStatus },
): Prisma.HandoverNoteUncheckedCreateInput {
  const staffId = UUID_V4ISH.test(input.senderId) ? input.senderId : null;
  const receiverStaffId =
    input.receiverId && UUID_V4ISH.test(input.receiverId) ? input.receiverId : null;

  const criticalPatients: CriticalPatientSbar[] = [
    {
      patientId: input.patientId,
      patientName: input.patientName,
      situation: input.situation,
      background: input.background,
      assessment: input.assessment,
      recommendation: input.recommendation,
    },
  ];

  const pendingActions: PendingActionsPayload = {
    recommendation: input.recommendation,
    apiStatus: input.status ?? 'Pending',
  };

  return {
    hospitalId,
    shiftType: inferShiftType(),
    summary: input.situation,
    generalNotes: input.background,
    department: input.assessment,
    pendingActions,
    criticalPatients,
    handingOverStaffId: staffId,
    handingOverName: input.senderName,
    receivingStaffId: receiverStaffId,
    receivingName: input.receiverName,
    status: 'submitted',
    submittedAt: new Date(),
  };
}

function buildStatusUpdateData(
  status: HandoverStatus,
  receiverName?: string,
): Prisma.HandoverNoteUpdateInput {
  const now = new Date();

  if (status === 'Cancelled') {
    return {
      status: 'draft',
      pendingActions: { cancelled: true, apiStatus: 'Cancelled' },
    };
  }

  if (status === 'Completed') {
    return {
      status: 'acknowledged',
      acknowledgedAt: now,
      receivingName: receiverName,
      pendingActions: { apiStatus: 'Completed' },
    };
  }

  if (status === 'Acknowledged') {
    return {
      status: 'acknowledged',
      acknowledgedAt: now,
      receivingName: receiverName,
      pendingActions: { apiStatus: 'Acknowledged' },
    };
  }

  return {
    status: 'submitted',
    submittedAt: now,
    pendingActions: { apiStatus: 'Pending' },
  };
}

export async function listHandovers(
  hospitalId: string | undefined,
  userId: string,
): Promise<{ items: HandoverRecord[]; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for handover data in strict production mode.',
      );
    }
    return { items: getMemoryHandovers(hospitalId, userId), source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('hospitalId is required for handover queries in strict production mode.');
    }
    return { items: getMemoryHandovers(hospitalId, userId), source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const rows = await tenant.handoverNote.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: rows.map(toHandoverRecord), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma handover list failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Handover list query failed in strict production mode.');
    }
    return { items: getMemoryHandovers(hospitalId, userId), source: 'memory' };
  }
}

export async function getHandoverById(
  hospitalId: string | undefined,
  userId: string,
  id: string,
): Promise<HandoverRecord | null> {
  const { items, source } = await listHandovers(hospitalId, userId);
  if (source === 'memory') {
    return items.find((item) => item.id === id) ?? null;
  }

  if (!hospitalId) return null;

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const row = await tenant.handoverNote.findFirst({ where: { id } });
    return row ? toHandoverRecord(row) : null;
  } catch (error) {
    logger.warn('Prisma handover getById failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
      id,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Handover fetch failed in strict production mode.');
    }
    return items.find((item) => item.id === id) ?? null;
  }
}

export type CreateHandoverInput = {
  patientId: string;
  patientName: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  receiverName?: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
};

export async function createHandover(
  hospitalId: string | undefined,
  userId: string,
  input: CreateHandoverInput,
): Promise<{ item: HandoverRecord; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for handover create in strict production mode.',
      );
    }
    const items = getMemoryHandovers(hospitalId, userId);
    const newHandover: HandoverRecord = {
      id: `HO-${Date.now().toString().slice(-6)}`,
      ...input,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    setMemoryHandovers(hospitalId, userId, [...items, newHandover]);
    return { item: newHandover, source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('hospitalId is required to create handover in strict production mode.');
    }
    const items = getMemoryHandovers(hospitalId, userId);
    const newHandover: HandoverRecord = {
      id: `HO-${Date.now().toString().slice(-6)}`,
      ...input,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    setMemoryHandovers(hospitalId, userId, [...items, newHandover]);
    return { item: newHandover, source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const row = await tenant.handoverNote.create({
      data: buildCreatePayload(hospitalId, input),
    });
    return { item: toHandoverRecord(row), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma handover create failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Handover create failed in strict production mode.');
    }
    const items = getMemoryHandovers(hospitalId, userId);
    const newHandover: HandoverRecord = {
      id: `HO-${Date.now().toString().slice(-6)}`,
      ...input,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    setMemoryHandovers(hospitalId, userId, [...items, newHandover]);
    return { item: newHandover, source: 'memory' };
  }
}

export async function updateHandoverStatus(
  hospitalId: string | undefined,
  userId: string,
  id: string,
  status: HandoverStatus,
  receiverName?: string,
): Promise<{ item: HandoverRecord | null; source: 'prisma' | 'memory' }> {
  if (!isDatabaseAvailable()) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError(
        'DATABASE_URL is not configured for handover updates in strict production mode.',
      );
    }
    const items = getMemoryHandovers(hospitalId, userId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      return { item: null, source: 'memory' };
    }
    const updated: HandoverRecord = {
      ...items[index],
      status,
      receiverName: receiverName ?? items[index].receiverName,
      acknowledgedAt:
        status === 'Acknowledged' || status === 'Completed'
          ? new Date().toISOString()
          : items[index].acknowledgedAt,
    };
    const next = [...items];
    next[index] = updated;
    setMemoryHandovers(hospitalId, userId, next);
    return { item: updated, source: 'memory' };
  }

  if (!hospitalId) {
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('hospitalId is required to update handover in strict production mode.');
    }
    const items = getMemoryHandovers(hospitalId, userId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return { item: null, source: 'memory' };
    const updated: HandoverRecord = {
      ...items[index],
      status,
      receiverName: receiverName ?? items[index].receiverName,
      acknowledgedAt:
        status === 'Acknowledged' || status === 'Completed'
          ? new Date().toISOString()
          : items[index].acknowledgedAt,
    };
    const next = [...items];
    next[index] = updated;
    setMemoryHandovers(hospitalId, userId, next);
    return { item: updated, source: 'memory' };
  }

  try {
    const tenant = getTenantPrismaClient(hospitalId);
    const existing = await tenant.handoverNote.findFirst({ where: { id } });
    if (!existing) {
      return { item: null, source: 'prisma' };
    }

    const row = await tenant.handoverNote.update({
      where: { id },
      data: buildStatusUpdateData(status, receiverName),
    });
    return { item: toHandoverRecord(row), source: 'prisma' };
  } catch (error) {
    logger.warn('Prisma handover status update failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
      id,
    });
    if (isStrictProductionMode()) {
      throw new DataSourceUnavailableError('Handover status update failed in strict production mode.');
    }
    const items = getMemoryHandovers(hospitalId, userId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return { item: null, source: 'memory' };
    const updated: HandoverRecord = {
      ...items[index],
      status,
      receiverName: receiverName ?? items[index].receiverName,
      acknowledgedAt:
        status === 'Acknowledged' || status === 'Completed'
          ? new Date().toISOString()
          : items[index].acknowledgedAt,
    };
    const next = [...items];
    next[index] = updated;
    setMemoryHandovers(hospitalId, userId, next);
    return { item: updated, source: 'memory' };
  }
}
