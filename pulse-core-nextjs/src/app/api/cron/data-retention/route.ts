/**
 * GDPR / compliance data retention job.
 * POST /api/cron/data-retention
 *
 * Requires Authorization: Bearer <DATA_RETENTION_CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { sanitizeError } from '@/lib/api-response';
import { isDatabaseAvailable } from '@/lib/data/handover';

const DEFAULT_AUDIT_RETENTION_DAYS = 2555;
const DEFAULT_GENERAL_RETENTION_DAYS = 365;

function authorize(request: NextRequest): boolean {
  const secret = process.env.DATA_RETENTION_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!authorize(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable()) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      auditLogRetentionDays?: number;
      generalRetentionDays?: number;
      dryRun?: boolean;
    };

    const auditDays = body.auditLogRetentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
    const generalDays = body.generalRetentionDays ?? DEFAULT_GENERAL_RETENTION_DAYS;
    const dryRun = body.dryRun === true;

    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - auditDays);

    const generalCutoff = new Date();
    generalCutoff.setDate(generalCutoff.getDate() - generalDays);

    const [auditCandidates, botCandidates] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { lt: auditCutoff } } }),
      prisma.botMessage.count({ where: { timestamp: { lt: generalCutoff } } }),
    ]);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        auditLogsToDelete: auditCandidates,
        botMessagesToDelete: botCandidates,
        auditCutoff: auditCutoff.toISOString(),
        generalCutoff: generalCutoff.toISOString(),
      });
    }

    const [auditResult, botResult] = await Promise.all([
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
      prisma.botMessage.deleteMany({ where: { timestamp: { lt: generalCutoff } } }),
    ]);

    logger.info('[DataRetention] Purge completed', {
      auditDeleted: auditResult.count,
      botDeleted: botResult.count,
      auditCutoff: auditCutoff.toISOString(),
      generalCutoff: generalCutoff.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        auditLogs: auditResult.count,
        botMessages: botResult.count,
      },
      cutoffs: {
        audit: auditCutoff.toISOString(),
        general: generalCutoff.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(sanitizeError(error, { context: 'data-retention cron' }), { status: 500 });
  }
}
