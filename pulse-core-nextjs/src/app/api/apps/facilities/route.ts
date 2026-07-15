 
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { requireSharedAppPrincipal, sharedAppInternalError } from '@/lib/apps/shared-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSharedAppPrincipal(req, 'api:apps:facilities', 'fhir:read');
  if (auth.response) return auth.response;

  try {
    const facilities = await prisma.hospital.findMany({
      where: {
        id: auth.principal.hospitalId,
      },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        isActive: true,
      },
      take: 1,
    });

    return NextResponse.json(
      {
        facilities: facilities.map((facility: any) => ({
          id: facility.id,
          name: facility.name,
          code: facility.licenseNumber ?? null,
          status: facility.isActive ? 'active' : 'inactive',
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('shared app facilities GET failed', {
      appId: auth.principal.appId,
      appType: auth.principal.appType,
      hospitalId: auth.principal.hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return sharedAppInternalError('Unable to load facilities.');
  }
}
