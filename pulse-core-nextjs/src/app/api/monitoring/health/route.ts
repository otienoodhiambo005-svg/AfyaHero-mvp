import { NextResponse } from 'next/server';
import { monitoring } from '@/lib/monitoring';

/**
 * Health Check Endpoint
 * 
 * Returns the current health status of the application
 * including database, cache, and API status.
 */
export async function GET(request: Request) {
  try {
    const health = await monitoring.performHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now(),
      },
      { status: 503 }
    );
  }
}
