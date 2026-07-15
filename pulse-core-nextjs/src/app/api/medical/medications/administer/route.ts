import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const BodySchema = z.object({
  patientId: z.string().uuid().optional(),
  patientName: z.string().trim().min(2).max(120).optional(),
  medicationName: z.string().trim().min(2).max(160),
  dose: z.string().trim().max(80).optional(),
  quantity: z.number().int().min(1).max(1000),
  route: z.enum(['IV', 'IM', 'PO', 'SC', 'SL', 'TOP']).optional(),
  notes: z.string().trim().max(1200).optional(),
  givenAt: z.string().datetime().optional(),
}).superRefine((data, ctx) => {
  if (!data.patientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'patientId is required. patientName-based writes are no longer accepted; migrate to patientId for medication administration.',
      path: ['patientId'],
    });
  }
});

function deriveInventoryStatus(stock: number, minStockLevel?: number | null): string {
  if (stock <= 0) return 'out-of-stock';
  if (typeof minStockLevel === 'number' && minStockLevel > 0) {
    if (stock <= minStockLevel) return 'critical';
    if (stock <= Math.ceil(minStockLevel * 1.5)) return 'low';
  }
  return 'adequate';
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:medications-administer',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid medication administration payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const hospitalId = guard.session.hospitalId;
  const actorId = guard.session.id;
  const payload = parsed.data;

  try {
    const patient = await prisma.patient.findFirst({
      where: { id: payload.patientId, hospitalId },
      select: { id: true, name: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found in your hospital.' }, { status: 404 });
    }

    const inventory = await prisma.pharmacyInventory.findFirst({
      where: {
        hospitalId,
        medicationName: { equals: payload.medicationName, mode: 'insensitive' },
      },
      select: {
        id: true,
        medicationName: true,
        stockQuantity: true,
        minStockLevel: true,
      },
    });

    if (!inventory) {
      return NextResponse.json({ error: 'Medication not found in pharmacy inventory.' }, { status: 404 });
    }

    if (inventory.stockQuantity < payload.quantity) {
      return NextResponse.json(
        {
          error: 'Insufficient stock for medication administration.',
          available: inventory.stockQuantity,
          requested: payload.quantity,
        },
        { status: 409 },
      );
    }

    const remaining = inventory.stockQuantity - payload.quantity;
    const nextStatus = deriveInventoryStatus(remaining, inventory.minStockLevel);
    const givenAt = payload.givenAt ? new Date(payload.givenAt) : new Date();

    const updated = await prisma.$transaction(async (tx: any) => {
      const decremented = await tx.pharmacyInventory.updateMany({
        where: {
          id: inventory.id,
          hospitalId,
          stockQuantity: { gte: payload.quantity },
        },
        data: {
          stockQuantity: { decrement: payload.quantity },
          status: nextStatus,
        },
      });

      if (decremented.count === 0) {
        throw new Error('Medication stock changed before update.');
      }

      await tx.auditLog.create({
        data: {
          action: 'medical_medication_administered',
          actorId,
          actorEmail: guard.session?.email ?? undefined,
          actorRole: guard.session?.role,
          hospitalId,
          resourceType: 'PharmacyInventory',
          resourceId: inventory.id,
          detail: {
            patientId: patient.id,
            patientName: patient.name,
            medicationName: inventory.medicationName,
            dose: payload.dose ?? null,
            route: payload.route ?? null,
            quantity: payload.quantity,
            notes: payload.notes ?? null,
            givenAt: givenAt.toISOString(),
          },
        },
      });

      return tx.pharmacyInventory.findUnique({
        where: { id: inventory.id },
        select: {
          id: true,
          medicationName: true,
          stockQuantity: true,
          status: true,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        patient: { id: patient.id, name: patient.name },
        administration: {
          medicationName: inventory.medicationName,
          quantity: payload.quantity,
          dose: payload.dose ?? null,
          route: payload.route ?? null,
          givenAt: givenAt.toISOString(),
        },
        inventory: updated,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error('medical medication administer failed', { err });
    return NextResponse.json(
      { error: 'Unable to record medication administration.' },
      { status: 500 },
    );
  }
}
