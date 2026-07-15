/**
 * Population Health Analytics API
 * 
 * POST /api/population/analytics
 * 
 * Provides AI-driven population health analytics dashboards with:
 * - Disease surveillance and trends
 * - Health system performance metrics
 * - Outbreak detection alerts
 * - AMR surveillance data
 * - Cross-facility referral patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { AIPopulationHealth } from '@/lib/ai-population-health';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:population:analytics');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['admin', 'super_admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    facilityId?: unknown;
    region?: unknown;
    period?: unknown;
    reportType?: unknown;
    data?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const facilityId = typeof body.facilityId === 'string' ? body.facilityId : session.hospitalId;
  const region = typeof body.region === 'string' ? body.region : undefined;
  const reportType = (typeof body.reportType === 'string' && 
    ['epidemiological', 'operational', 'financial', 'quality'].includes(body.reportType))
    ? body.reportType : 'operational';
  
  const period = body.period && typeof body.period === 'object' ? body.period as { start: string; end: string } : {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  };

  const data = body.data && typeof body.data === 'object' ? body.data : {};

  try {
    // Generate AHI report based on parameters
    const report = await AIPopulationHealth.generateAHIReport({
      reportType: reportType as any,
      facilityId,
      region,
      period,
      data: data as any,
    });

    return NextResponse.json({
      success: true,
      report,
      metadata: {
        facilityId,
        region,
        reportType,
        period,
        generatedAt: report.generatedAt,
      },
    });
  } catch (error) {
    logger.error('[Population Analytics] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate population health analytics' }, { status: 500 });
  }
}

/**
 * GET /api/population/analytics
 * 
 * Returns available analytics types and metadata
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['admin', 'super_admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Population Health Analytics',
    version: '1.0.0',
    description: 'AI-driven population health analytics dashboards for AfyaHero',
    reportTypes: [
      { type: 'epidemiological', description: 'Disease surveillance and outbreak detection' },
      { type: 'operational', description: 'Health system performance and capacity metrics' },
      { type: 'financial', description: 'Resource utilization and cost analysis' },
      { type: 'quality', description: 'Clinical quality indicators and outcomes' },
    ],
    capabilities: [
      'Outbreak detection and early warning',
      'AMR surveillance monitoring',
      'Cross-facility referral coordination',
      'Health system performance tracking',
      'AI-powered insights and recommendations',
    ],
  });
}
