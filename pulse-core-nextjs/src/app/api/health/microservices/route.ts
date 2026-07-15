/**
 * GET /api/health/microservices
 * 
 * Health check endpoint for all AI microservices.
 * Returns the status of each service and whether it's reachable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAllServicesHealth } from '@/lib/microservices-client';
import { requireRoles } from '@/lib/api-security';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['admin']);
    if (session instanceof NextResponse) return session;

    const healthResults = await checkAllServicesHealth();

    const summary = {
      overall: 'healthy' as 'healthy' | 'degraded' | 'down',
      services: {
        triage: healthResults.triage.status === 'fulfilled' ? 
          { ...healthResults.triage.value, status: 'healthy' as const } : 
          { status: 'unreachable' as const, error: healthResults.triage.reason },
        diagnosis: healthResults.diagnosis.status === 'fulfilled' ? 
          { ...healthResults.diagnosis.value, status: 'healthy' as const } : 
          { status: 'unreachable' as const, error: healthResults.diagnosis.reason },
        imaging: healthResults.imaging.status === 'fulfilled' ? 
          { ...healthResults.imaging.value, status: 'healthy' as const } : 
          { status: 'unreachable' as const, error: healthResults.imaging.reason },
        pharmacy: healthResults.pharmacy.status === 'fulfilled' ? 
          { ...healthResults.pharmacy.value, status: 'healthy' as const } : 
          { status: 'unreachable' as const, error: healthResults.pharmacy.reason },
        hl7Gateway: healthResults.hl7Gateway.status === 'fulfilled' ? 
          { ...healthResults.hl7Gateway.value, status: 'healthy' as const } : 
          { status: 'unreachable' as const, error: healthResults.hl7Gateway.reason },
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };

    // Determine overall health
    const healthyCount = Object.values(summary.services).filter(
      (s: any) => s.status === 'healthy'
    ).length;
    const totalCount = Object.keys(summary.services).length;

    if (healthyCount === totalCount) {
      summary.overall = 'healthy';
    } else if (healthyCount > 0) {
      summary.overall = 'degraded';
    } else {
      summary.overall = 'down';
    }

    return NextResponse.json(summary);
  } catch (err) {
    logger.error('[Microservices Health Check] Error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      {
        overall: 'down',
        error: 'Failed to check microservices health',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
