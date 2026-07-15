 
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { requireSharedAppPrincipal, sharedAppInternalError } from '@/lib/apps/shared-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSharedAppPrincipal(req, 'api:apps:medications', 'fhir:read');
  if (auth.response) return auth.response;

  try {
    const medications = await prisma.pharmacyInventory.findMany({
      where: {
        hospitalId: auth.principal.hospitalId,
      },
      orderBy: [{ medicationName: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        medicationName: true,
        genericName: true,
        status: true,
      },
    });

    return NextResponse.json(
      {
        medications: medications.map((medication: any) => ({
          id: medication.id,
          name: medication.medicationName,
          code: medication.genericName ?? null,
          status: medication.status,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('shared app medications GET failed', {
      appId: auth.principal.appId,
      appType: auth.principal.appType,
      hospitalId: auth.principal.hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return sharedAppInternalError('Unable to load medications.');
  }
}
