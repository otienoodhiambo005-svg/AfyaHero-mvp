/**
 * GET /api/hospital/queue
 * 
 * Returns the current hospital queue sorted by priority.
 * Supports filtering by priority and status.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  requireRoles,
} from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    const rateLimit = await enforceApiRateLimit(request, 'api:hospital:queue');
    if (rateLimit) return rateLimit;

    const session = requireRoles(request, ['reception', 'medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const priorityFilter = searchParams.get('priority');
    const statusFilter = searchParams.get('status') || 'WAITING';

    // Build where clause
    const where: any = {
      hospitalId: session.hospitalId,
    };

    if (statusFilter) {
      where.status = statusFilter.toLowerCase();
    }

    if (priorityFilter) {
      where.priority = priorityFilter;
    }

    // Fetch queue entries with patient info
    const queueEntries = await prisma.hospitalQueue.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            dob: true,
            gender: true,
          },
        },
      },
      orderBy: [
        { priority: 'asc' }, // Higher priority (critical, urgent, normal)
        { arrivedAt: 'asc' }, // Earlier arrivals first within same priority
      ],
      take: 50, // Limit to last 50 patients
    });

    // Calculate queue positions
    const queueWithPositions = queueEntries.map((entry, index) => ({
      ...entry,
      position: index + 1,
      timeInQueue: entry.arrivedAt ? Math.floor((Date.now() - entry.arrivedAt.getTime()) / 60000) : 0, // minutes
    }));

    // Get queue statistics
    const stats = await prisma.hospitalQueue.groupBy({
      by: ['priority', 'status'],
      where: {
        hospitalId: session.hospitalId,
        status: 'waiting',
      },
      _count: true,
    });

    const priorityCounts = {
      critical: 0,
      urgent: 0,
      normal: 0,
    };

    stats.forEach((stat) => {
      priorityCounts[stat.priority as keyof typeof priorityCounts] = stat._count;
    });

    return NextResponse.json({
      queue: queueWithPositions,
      statistics: {
        totalWaiting: queueEntries.filter((e) => e.status === 'waiting').length,
        byPriority: priorityCounts,
        averageWaitTime: calculateAverageWaitTime(queueEntries),
      },
    });
  } catch (err) {
    logger.error('[Hospital Queue GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Calculate average wait time in minutes
 */
function calculateAverageWaitTime(queueEntries: any[]): number {
  if (queueEntries.length === 0) return 0;

  const totalWaitTime = queueEntries.reduce((sum, entry) => {
    return sum + (Date.now() - entry.arrivedAt.getTime()) / 60000;
  }, 0);

  return Math.round(totalWaitTime / queueEntries.length);
}
