/**
 * GET /api/superadmin/hospitals — platform-wide hospital directory with governance overlay.
 * super_admin only (session cookie + API guard).
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';
import {
  governanceSummaryOrEmpty,
  loadGovernanceSummariesForHospitals,
} from '@/lib/superadmin/hospital-governance';

type HospitalWithGovernance = {
  id: string;
  name: string;
  location: string | null;
  email: string | null;
  specialisation: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    profiles: number;
    patients: number;
  };
  governance?: ReturnType<typeof governanceSummaryOrEmpty>;
};

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:hospitals',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '12', 10) || 12), 100);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { location: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [hospitals, total] = await Promise.all([
      prisma.hospital.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              profiles: true,
              patients: true,
            },
          },
        },
      }),
      prisma.hospital.count({ where }),
    ]);

    const govMap = await loadGovernanceSummariesForHospitals(prisma, hospitals);

    const hospitalsOut = hospitals.map((h): HospitalWithGovernance => ({
      ...h,
      governance: governanceSummaryOrEmpty(govMap, h.id),
    }));

    return NextResponse.json({
      hospitals: hospitalsOut,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin hospitals API error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/superadmin/hospitals', method: 'GET' } });
    return NextResponse.json({ error: 'Failed to load hospitals' }, { status: 500 });
  }
}
