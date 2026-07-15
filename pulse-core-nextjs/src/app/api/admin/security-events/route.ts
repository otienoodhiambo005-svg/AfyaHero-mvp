/**
 * Security Events API — Prisma-backed
 * GET /api/admin/security-events — Security incidents with filtering
 * POST /api/admin/security-events — block_ip, unblock_ip, acknowledge_event
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { Prisma, SecurityIncident } from '@prisma/client';
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
      scope: 'api:admin:security-events',
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
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');

    const where: Prisma.SecurityIncidentWhereInput = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;

    const [incidents, total] = await Promise.all([
      prisma.securityIncident.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.securityIncident.count({ where }),
    ]);

     const blockedRecords = await prisma.securityIncident.findMany({
       where: {
         category: 'IP_BLOCKED',
         status: {
           in: ['open', 'investigating'],
         },
       },
       orderBy: { detectedAt: 'desc' },
       take: 200,
     });
 
       const blockedIPs = blockedRecords
         .map((record: SecurityIncident): { 
           ip: string | undefined; 
           reason: string; 
           blockedAt: string; 
           blockedBy: string; 
           expiresAt: string | undefined 
         } => {
           const ip = record.affectedSystems[0];
           return {
             ip: typeof ip === 'string' ? ip : undefined,
             reason: record.description,
              blockedAt: record.detectedAt.toISOString(),
              blockedBy: record.reportedBy,
              expiresAt: undefined as unknown as string | undefined,
            };
          })
          .filter((entry: { 
            ip: string | undefined; 
            reason: string; 
            blockedAt: string; 
            blockedBy: string; 
            expiresAt: string | undefined 
          }): entry is { 
            ip: string; 
            reason: string; 
            blockedAt: string; 
            blockedBy: string; 
            expiresAt: string | undefined 
          } => 
            typeof entry.ip === 'string' && entry.ip.length > 0);

    return NextResponse.json({
      events: incidents,
      blockedIPs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Security events API error', { error: error instanceof Error ? error.message : String(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: 'Failed to retrieve security events', ...(isProduction ? {} : sanitizeErrorResponse(error, isProduction)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:admin:security-events',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    const authCheck = await verifyAdminRole(request);
    if (!authCheck.authorized) {
      return authCheck.error!;
    }

    const body = await request.json();
    const { action, ...payload } = body;

    switch (action) {
      case 'block_ip': return await blockIP(payload, request);
      case 'unblock_ip': return await unblockIP(payload);
      case 'acknowledge_event': return await acknowledgeEvent(payload);
      default:
        return NextResponse.json(
          { error: 'Unknown action. Supported: block_ip, unblock_ip, acknowledge_event' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Security events API error', { error: error instanceof Error ? error.message : String(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: 'Failed to process security action', ...(isProduction ? {} : sanitizeErrorResponse(error, isProduction)) },
      { status: 500 }
    );
  }
}

async function blockIP(payload: { ip: string; reason: string; duration?: number }, request: NextRequest) {
  const { ip, reason, duration } = payload;
  if (!ip || !reason) {
    return NextResponse.json({ error: 'Missing required fields: ip, reason' }, { status: 400 });
  }

  const blockedBy = request.headers.get('x-user-email') || 'admin';
  const expiresAt = duration ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;

   await prisma.securityIncident.create({
     data: {
       title: `IP Blocked: ${ip}`,
       description: reason,
       severity: 'high',
       category: 'IP_BLOCKED',
       affectedSystems: [ip],
       reportedBy: blockedBy,
       status: 'open',
       resolution: expiresAt ? `ExpiresAt:${expiresAt}` : null,
     },
   });
 
   const currentBlocks = await prisma.securityIncident.findMany({
     where: {
       category: 'IP_BLOCKED',
       status: { in: ['open', 'investigating'] },
     },
     orderBy: { detectedAt: 'desc' },
     take: 200,
   });
 
     return NextResponse.json({
       success: true,
       message: `IP ${ip} has been blocked`,
       blockedIPs: currentBlocks.map((record: SecurityIncident): { 
         ip: string | undefined; 
         reason: string; 
         blockedAt: string; 
         blockedBy: string; 
       } => {
         const ip = record.affectedSystems[0];
         return {
           ip: typeof ip === 'string' ? ip : undefined,
           reason: record.description,
           blockedAt: record.detectedAt.toISOString(),
           blockedBy: record.reportedBy,
         };
        }).filter((entry: { ip: string | undefined; reason: string; blockedAt: string; blockedBy: string }): entry is { ip: string; reason: string; blockedAt: string; blockedBy: string } => 
          typeof entry.ip === 'string' && entry.ip.length > 0),
     });
}

async function unblockIP(payload: { ip: string }) {
  const { ip } = payload;
  if (!ip) {
    return NextResponse.json({ error: 'Missing required field: ip' }, { status: 400 });
  }

  const updated = await prisma.securityIncident.updateMany({
    where: {
      category: 'IP_BLOCKED',
      status: { in: ['open', 'investigating'] },
      affectedSystems: { has: ip },
    },
    data: {
      status: 'resolved',
      resolution: 'Unblocked by administrator',
      resolvedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'IP not found in blocked list' }, { status: 404 });
  }

   const currentBlocks = await prisma.securityIncident.findMany({
     where: {
       category: 'IP_BLOCKED',
       status: { in: ['open', 'investigating'] },
     },
     orderBy: { detectedAt: 'desc' },
     take: 200,
   });
 
    return NextResponse.json({
      success: true,
      message: `IP ${ip} has been unblocked`,
      blockedIPs: currentBlocks.map((record: SecurityIncident): { 
        ip: string | undefined; 
        reason: string; 
        blockedAt: string; 
        blockedBy: string; 
      } => {
        const ip = record.affectedSystems[0];
        return {
          ip: typeof ip === 'string' ? ip : undefined,
          reason: record.description,
          blockedAt: record.detectedAt.toISOString(),
          blockedBy: record.reportedBy,
        };
      }).filter((entry: { ip: string | undefined; reason: string; blockedAt: string; blockedBy: string }): entry is { ip: string; reason: string; blockedAt: string; blockedBy: string } => 
        typeof entry.ip === 'string' && entry.ip.length > 0),
    });
}

async function acknowledgeEvent(payload: { eventId: string; notes?: string }) {
  const { eventId, notes } = payload;
  if (!eventId) {
    return NextResponse.json({ error: 'Missing required field: eventId' }, { status: 400 });
  }

  await prisma.securityIncident.updateMany({
    where: { id: eventId },
    data: { status: 'resolved', resolution: notes },
  });

  return NextResponse.json({ success: true, message: 'Event acknowledged successfully' });
}
