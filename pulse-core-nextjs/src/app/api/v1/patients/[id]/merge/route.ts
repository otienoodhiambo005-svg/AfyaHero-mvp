/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody, requireString, validateOptionalString } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const MERGE_ROLES = ['reception', 'admin', 'super_admin', 'medical'] as const;

type MergePatientBody = {
  sourcePatientId?: unknown;
  reason?: unknown;
};

type MergeRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

// Prisma transaction client type (client not generated, using documented type)
type PrismaTxClient = {
  patient: typeof prisma.patient;
  auditLog: typeof prisma.auditLog;
};

async function applySourceMergeMarker(
  tx: PrismaTxClient,
  sourcePatientId: string,
  targetPatientId: string,
  reason?: string,
): Promise<{ statusMarked: boolean; notesMarked: boolean }> {
  const statusText = `Merged into patient ${targetPatientId}`;
  const noteText = reason
    ? `Merged into patient ${targetPatientId}. Reason: ${reason}`
    : `Merged into patient ${targetPatientId}.`;

  try {
    await tx.patient.update({
      where: { id: sourcePatientId },
      data: {
        status: statusText,
      },
    });

    return { statusMarked: true, notesMarked: true };
  } catch {
    try {
      await tx.patient.update({
        where: { id: sourcePatientId },
        data: {
          status: statusText,
        },
      });

      return { statusMarked: true, notesMarked: false };
    } catch {
      return { statusMarked: false, notesMarked: false };
    }
  }
}

export async function POST(req: NextRequest, ctx: MergeRouteContext) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:v1:patients:merge',
    requireAuth: true,
    roles: [...MERGE_ROLES],
  });
  if (guard.response) return guard.response;

  const { id: targetPatientIdRaw } = await ctx.params;
  const targetPatientId = requireString(targetPatientIdRaw, 'id');
  if (targetPatientId instanceof NextResponse) return targetPatientId;

  const body = await readJsonBody<MergePatientBody>(req);
  if (body instanceof NextResponse) return body;

  const sourcePatientId = requireString(body.sourcePatientId, 'sourcePatientId');
  if (sourcePatientId instanceof NextResponse) return sourcePatientId;

  const reason = validateOptionalString(body.reason, 'reason', { max: 300 });
  if (reason instanceof NextResponse) return reason;

  if (normalizeId(sourcePatientId) === normalizeId(targetPatientId)) {
    return NextResponse.json({ error: 'sourcePatientId must be different from target patient id.' }, { status: 400 });
  }

  const session = guard.session;

  try {
    const result = await prisma.$transaction(async (tx: PrismaTxClient) => {
      const target = await tx.patient.findFirst({
        where: {
          id: targetPatientId,
          ...(session?.hospitalId ? { hospitalId: session.hospitalId } : {}),
        },
        select: { id: true },
      });

      if (!target) {
        return {
          ok: false as const,
          status: 404,
          error: 'Target patient not found.',
        };
      }

      const source = await tx.patient.findFirst({
        where: {
          id: sourcePatientId,
          ...(session?.hospitalId ? { hospitalId: session.hospitalId } : {}),
        },
        select: { id: true },
      });

      if (!source) {
        return {
          ok: false as const,
          status: 404,
          error: 'Source patient not found.',
        };
      }

      const actor = {
        id: session?.id ?? null,
        email: session?.email ?? null,
        role: session?.role ?? null,
      };

      const audit = await tx.auditLog.create({
        data: {
          action: 'PATIENT_MERGE_REQUESTED',
          actorId: actor.id ?? undefined,
          actorEmail: actor.email ?? undefined,
          actorRole: actor.role ?? undefined,
          hospitalId: session?.hospitalId ?? undefined,
          resourceType: 'Patient',
          resourceId: targetPatientId,
          detail: {
            targetPatientId,
            sourcePatientId,
            reason: reason ?? null,
            actor,
          },
        },
        select: { id: true },
      });

      const marker = await applySourceMergeMarker(tx, sourcePatientId, targetPatientId, reason);

      return {
        ok: true as const,
        mergeReference: audit.id,
        sourceMarker: marker,
      };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      mergeReference: result.mergeReference,
      targetPatientId,
      sourcePatientId,
      sourceMarked: result.sourceMarker,
    });
  } catch (error) {
    logger.error('patient merge request failed', {
      error: error instanceof Error ? error.message : String(error),
      targetPatientId,
      sourcePatientId,
      hospitalId: session?.hospitalId,
      actorId: session?.id,
      actorRole: session?.role,
    });

    return NextResponse.json(
      { error: 'Unable to process patient merge request at this time.' },
      { status: 500 },
    );
  }
}

