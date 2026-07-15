import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { getSession } from '@/lib/auth';
import logger from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * GET /api/admin/hospitals
 * List active hospitals on the platform.
 * Protected: Superadmin only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { location: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ]
    } : {};

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
            }
          }
        }
      }),
      prisma.hospital.count({ where }),
    ]);

    return NextResponse.json({
      hospitals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to list hospitals', { error: err.message });
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Failed to fetch hospitals' }, { status: 500 });
  }
}
