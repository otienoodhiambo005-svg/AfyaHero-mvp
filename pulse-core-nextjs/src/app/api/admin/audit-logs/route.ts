/**
 * Audit Logs API — Prisma-backed
 * GET /api/admin/audit-logs — Paginated audit logs with filtering
 * POST /api/admin/audit-logs — Create audit log entry
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/database';
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';
import { verifyAdminToken } from '@/middleware/admin-auth';

async function verifyAdminRole(request: NextRequest): Promise<{ authorized: boolean; role?: string; error?: NextResponse }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  
  if (!verifyAdminToken(token)) {
    return { authorized: false, error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }

  const role = request.headers.get('x-admin-role');
  if (role !== 'super_admin' && role !== 'admin') {
    return { authorized: false, error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }

  return { authorized: true, role };
}

function sanitizeErrorResponse(error: unknown, isProduction: boolean): { error: string } {
  if (!isProduction) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  return { error: 'An error occurred. Please try again later.' };
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:admin:audit-logs',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    const authCheck = await verifyAdminRole(request);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resource');
    const actorId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (actorId) where.actorId = actorId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Audit logs API error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/admin/audit-logs', method: 'GET' } });
    const isProduction = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: 'Failed to retrieve audit logs', ...(isProduction ? {} : sanitizeErrorResponse(error, isProduction)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:admin:audit-logs',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    const authCheck = await verifyAdminRole(request);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }

    const body = await request.json();
    const { action, resourceType, resourceId, userId, details } = body;

    if (!action || !resourceType) {
      return NextResponse.json({ error: 'Missing required fields: action, resourceType' }, { status: 400 });
    }

    const log = await prisma.auditLog.create({
      data: {
        action,
        resourceType,
        resourceId,
        actorId: userId,
        detail: details ?? {},
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    logger.error('Audit logs API error', { error: error instanceof Error ? error.message : String(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: 'Failed to create audit log', ...(isProduction ? {} : sanitizeErrorResponse(error, isProduction)) },
      { status: 500 }
    );
  }
}
