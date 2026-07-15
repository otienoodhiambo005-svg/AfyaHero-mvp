/**
 * Super Admin Audit Logs — session-backed (portal cookie).
 * GET /api/superadmin/audit-logs — platform-wide audit trail (super_admin only).
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/database';
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:audit-logs',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 100);
    const actionParam = searchParams.get('action');
    const resourceType = searchParams.get('resource');
    const actorId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const q = (searchParams.get('q') || '').trim().slice(0, 200);

    const filters: Prisma.AuditLogWhereInput[] = [];

    if (actionParam && actionParam !== 'all') {
      filters.push({ action: actionParam });
    }
    if (resourceType) {
      filters.push({ resourceType });
    }
    if (actorId) {
      filters.push({ actorId });
    }
    if (startDate || endDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      filters.push({ createdAt });
    }
    if (q) {
      filters.push({
        OR: [
          { actorId: { contains: q, mode: 'insensitive' } },
          { resourceId: { contains: q, mode: 'insensitive' } },
          { actorEmail: { contains: q, mode: 'insensitive' } },
          { action: { contains: q, mode: 'insensitive' } },
          { resourceType: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.AuditLogWhereInput =
      filters.length === 0 ? {} : filters.length === 1 ? (filters[0] as Prisma.AuditLogWhereInput) : { AND: filters };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin audit logs API error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/superadmin/audit-logs', method: 'GET' } });
    return NextResponse.json({ error: 'Failed to retrieve audit logs' }, { status: 500 });
  }
}
