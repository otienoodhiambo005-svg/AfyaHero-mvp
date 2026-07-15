/**
 * Demo Invitation Service
 *
 * DB-backed lifecycle for superadmin-issued demo showcase sessions.
 * Tokens themselves are signed sessions and are NOT stored — only their
 * SHA-256 hashes — so revocation/usage can be tracked without exposing
 * raw tokens server-side.
 */

import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';
import type { PortalRole } from '@/types';

export interface DemoInvitationCreateInput {
  tokenHash: string;
  portalRole: PortalRole;
  hospitalName: string;
  prospectEmail?: string | null;
  prospectName?: string | null;
  notes?: string | null;
  createdById: string;
  expiresAt: Date;
}

export interface DemoInvitationRecord {
  id: string;
  tokenHash: string;
  portalRole: string;
  hospitalName: string;
  prospectEmail: string | null;
  prospectName: string | null;
  notes: string | null;
  createdById: string;
  expiresAt: Date;
  firstUsedAt: Date | null;
  lastUsedAt: Date | null;
  useCount: number;
  revokedAt: Date | null;
  revokedById: string | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DemoRedemptionResult {
  ok: boolean;
  reason?: 'not_found' | 'revoked' | 'expired';
  invitation?: DemoInvitationRecord;
}

const globalForDemoInvitations = globalThis as unknown as {
  afyaDemoInvitationsById?: Map<string, DemoInvitationRecord>;
  afyaDemoInvitationIdsByTokenHash?: Map<string, string>;
};

const memoryInvitationsById = globalForDemoInvitations.afyaDemoInvitationsById ?? new Map<string, DemoInvitationRecord>();
const memoryInvitationIdsByTokenHash = globalForDemoInvitations.afyaDemoInvitationIdsByTokenHash ?? new Map<string, string>();

globalForDemoInvitations.afyaDemoInvitationsById = memoryInvitationsById;
globalForDemoInvitations.afyaDemoInvitationIdsByTokenHash = memoryInvitationIdsByTokenHash;

function logDemoInvitationFallback(operation: string, error: unknown): void {
  logger.warn('Prisma demo invitation operation failed; using memory fallback', {
    operation,
    error: error instanceof Error ? error.message : String(error),
  });
}

function persistMemoryInvitation(record: DemoInvitationRecord): DemoInvitationRecord {
  memoryInvitationsById.set(record.id, record);
  memoryInvitationIdsByTokenHash.set(record.tokenHash, record.id);
  return record;
}

function createMemoryInvitation(input: DemoInvitationCreateInput): DemoInvitationRecord {
  const now = new Date();
  return persistMemoryInvitation({
    id: randomUUID(),
    tokenHash: input.tokenHash,
    portalRole: input.portalRole,
    hospitalName: input.hospitalName,
    prospectEmail: input.prospectEmail ?? null,
    prospectName: input.prospectName ?? null,
    notes: input.notes ?? null,
    createdById: input.createdById,
    expiresAt: input.expiresAt,
    firstUsedAt: null,
    lastUsedAt: null,
    useCount: 0,
    revokedAt: null,
    revokedById: null,
    revokedReason: null,
    createdAt: now,
    updatedAt: now,
  });
}

function getMemoryInvitationByTokenHash(tokenHash: string): DemoInvitationRecord | null {
  const id = memoryInvitationIdsByTokenHash.get(tokenHash);
  return id ? memoryInvitationsById.get(id) ?? null : null;
}

function redeemMemoryInvitation(tokenHash: string): DemoRedemptionResult {
  const invitation = getMemoryInvitationByTokenHash(tokenHash);
  if (!invitation) {
    if (!isStrictProductionMode()) {
      const memoryRedemption = redeemMemoryInvitation(tokenHash);
      if (memoryRedemption.ok || memoryRedemption.reason !== 'not_found') {
        return memoryRedemption;
      }
    }
    return { ok: false, reason: 'not_found' };
  }

  if (invitation.revokedAt) {
    return { ok: false, reason: 'revoked', invitation };
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired', invitation };
  }

  const now = new Date();
  const updated: DemoInvitationRecord = {
    ...invitation,
    firstUsedAt: invitation.firstUsedAt ?? now,
    lastUsedAt: now,
    useCount: invitation.useCount + 1,
    updatedAt: now,
  };

  persistMemoryInvitation(updated);
  return { ok: true, invitation: updated };
}

function revokeMemoryInvitation(params: {
  invitationId: string;
  revokedById: string;
  reason?: string;
}): DemoInvitationRecord | null {
  const existing = memoryInvitationsById.get(params.invitationId);
  if (!existing) return null;
  if (existing.revokedAt) return existing;

  const updated = persistMemoryInvitation({
    ...existing,
    revokedAt: new Date(),
    revokedById: params.revokedById,
    revokedReason: params.reason ?? null,
    updatedAt: new Date(),
  });

  return updated;
}

/**
 * Compute SHA-256 hex hash of a signed demo token.
 * The same hash is stored at issue-time and looked up at redeem-time.
 */
export function hashDemoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Persist a new demo invitation. Returns the created record.
 */
export async function createDemoInvitation(
  input: DemoInvitationCreateInput,
): Promise<DemoInvitationRecord> {
  let record: DemoInvitationRecord;

  try {
    record = (await prisma.demoInvitation.create({
      data: {
        tokenHash: input.tokenHash,
        portalRole: input.portalRole,
        hospitalName: input.hospitalName,
        prospectEmail: input.prospectEmail ?? null,
        prospectName: input.prospectName ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById,
        expiresAt: input.expiresAt,
      },
    })) as DemoInvitationRecord;
  } catch (error) {
    if (isStrictProductionMode()) {
      throw error;
    }
    logDemoInvitationFallback('create', error);
    record = createMemoryInvitation(input);
  }

  logger.info('Demo invitation created', {
    invitationId: record.id,
    portalRole: input.portalRole,
    hospitalName: input.hospitalName,
  });

  return record;
}

/**
 * Validate a token at redemption time. Records usage on success.
 * Does not throw — returns a structured reason on failure.
 */
export async function redeemDemoInvitation(token: string): Promise<DemoRedemptionResult> {
  const tokenHash = hashDemoToken(token);
  let invitation: DemoInvitationRecord | null;

  try {
    invitation = (await prisma.demoInvitation.findUnique({
      where: { tokenHash },
    })) as DemoInvitationRecord | null;
  } catch (error) {
    if (isStrictProductionMode()) {
      throw error;
    }
    logDemoInvitationFallback('redeem:find', error);
    return redeemMemoryInvitation(tokenHash);
  }

  if (!invitation) {
    return { ok: false, reason: 'not_found' };
  }

  if (invitation.revokedAt) {
    return { ok: false, reason: 'revoked', invitation };
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired', invitation };
  }

  const now = new Date();
  let updated: DemoInvitationRecord;

  try {
    updated = (await prisma.demoInvitation.update({
      where: { id: invitation.id },
      data: {
        firstUsedAt: invitation.firstUsedAt ?? now,
        lastUsedAt: now,
        useCount: { increment: 1 },
      },
    })) as DemoInvitationRecord;
  } catch (error) {
    if (isStrictProductionMode()) {
      throw error;
    }
    logDemoInvitationFallback('redeem:update', error);
    return redeemMemoryInvitation(tokenHash);
  }

  return { ok: true, invitation: updated };
}

/**
 * Mark a demo invitation as revoked. Idempotent.
 */
export async function revokeDemoInvitation(params: {
  invitationId: string;
  revokedById: string;
  reason?: string;
}): Promise<DemoInvitationRecord | null> {
  let existing: DemoInvitationRecord | null;

  try {
    existing = (await prisma.demoInvitation.findUnique({
      where: { id: params.invitationId },
    })) as DemoInvitationRecord | null;
  } catch (error) {
    if (isStrictProductionMode()) {
      throw error;
    }
    logDemoInvitationFallback('revoke:find', error);
    return revokeMemoryInvitation(params);
  }

  if (!existing) return null;
  if (existing.revokedAt) return existing;

  let updated: DemoInvitationRecord;

  try {
    updated = (await prisma.demoInvitation.update({
      where: { id: params.invitationId },
      data: {
        revokedAt: new Date(),
        revokedById: params.revokedById,
        revokedReason: params.reason ?? null,
      },
    })) as DemoInvitationRecord;
  } catch (error) {
    if (isStrictProductionMode()) {
      throw error;
    }
    logDemoInvitationFallback('revoke:update', error);
    return revokeMemoryInvitation(params);
  }

  logger.info('Demo invitation revoked', {
    invitationId: updated.id,
    revokedById: params.revokedById,
    reason: params.reason,
  });

  return updated;
}

/**
 * List recent demo invitations for the superadmin dashboard.
 */
export async function listRecentDemoInvitations(opts: {
  withinDays?: number;
  limit?: number;
} = {}): Promise<DemoInvitationRecord[]> {
  const withinDays = opts.withinDays ?? 30;
  const limit = opts.limit ?? 100;
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);

  try {
    const rows = (await prisma.demoInvitation.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })) as DemoInvitationRecord[];

    return rows;
  } catch (error) {
    if (isStrictProductionMode()) {
      throw error;
    }
    logDemoInvitationFallback('list', error);
    return [...memoryInvitationsById.values()]
      .filter((invitation) => invitation.createdAt >= since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
