import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { monitoring } from '@/lib/monitoring';

/**
 * Metrics Endpoint
 * 
 * Returns performance metrics and error statistics.
 * Requires authentication for access.
 */
export async function GET(request: NextRequest) {
  // Authentication check
  const guard = await enforceApiGuard(request, {
    scope: 'api:monitoring',
    requireAuth: true,
  });
  
  if (guard.response) {
    return guard.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const metricName = searchParams.get('metric') || undefined;
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? parseInt(sinceParam) : undefined;

    // Get metrics
    const metrics = monitoring.getMetrics(metricName, since);
    
    // Get metric statistics if specific metric requested
    const stats = metricName ? monitoring.getMetricStats(metricName) : null;
    
    // Get errors
    const errors = monitoring.getErrors(since);

    // Get summary
    const summary = monitoring.getSummary();

    return NextResponse.json({
      summary,
      metrics,
      stats,
      errors: errors.slice(-50), // Return last 50 errors
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
