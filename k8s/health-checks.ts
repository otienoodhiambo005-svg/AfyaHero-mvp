/**
 * Health Check Endpoints for Kubernetes
 * 
 * These endpoints are required for Kubernetes probes:
 * - Liveness probe: /api/health/live
 * - Readiness probe: /api/health/ready
 * - Startup probe: /api/health/startup
 * 
 * Add these routes to your Next.js application at:
 * src/app/api/health/route.ts
 */

// src/app/api/health/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/health-checks/database';
import { checkRedisHealth } from '@/lib/health-checks/redis';
import { checkSupabaseHealth } from '@/lib/health-checks/supabase';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime?: number;
  checks?: Record<string, unknown>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { check?: string } }
) {
  const check = params?.check || 'live';

  try {
    switch (check) {
      case 'live':
        return handleLiveProbe();
      
      case 'ready':
        return handleReadyProbe();
      
      case 'startup':
        return handleStartupProbe();
      
      case 'deep':
        return handleDeepHealthCheck();
      
      default:
        return NextResponse.json(
          { error: 'Unknown health check type' },
          { status: 404 }
        );
    }
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Internal server error' },
      { status: 503 }
    );
  }
}

/**
 * Liveness Probe - Is the pod running?
 * Used by: Kubernetes livenessProbe
 * Response time: < 5s
 * Failure threshold: 3
 * 
 * Returns 200 if pod is alive, 503 otherwise
 */
async function handleLiveProbe(): Promise<NextResponse<HealthStatus>> {
  const uptime = process.uptime();
  
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime,
    },
    { status: 200 }
  );
}

/**
 * Readiness Probe - Can the pod receive traffic?
 * Used by: Kubernetes readinessProbe
 * Response time: < 3s
 * Failure threshold: 2
 * 
 * Checks critical dependencies:
 * - Database connection
 * - Cache/Redis connection
 * - Authentication service
 */
async function handleReadyProbe(): Promise<NextResponse<HealthStatus>> {
  const checks: Record<string, unknown> = {};
  let isReady = true;

  // Check database
  try {
    checks.database = await checkDatabaseHealth();
    if (checks.database !== 'healthy') {
      isReady = false;
    }
  } catch (error) {
    checks.database = 'unhealthy';
    isReady = false;
  }

  // Check Redis/cache
  try {
    checks.redis = await checkRedisHealth();
    if (checks.redis !== 'healthy') {
      isReady = false;
    }
  } catch (error) {
    checks.redis = 'unhealthy';
    isReady = false;
  }

  // Check authentication
  try {
    checks.auth = await checkSupabaseHealth();
    if (checks.auth !== 'healthy') {
      isReady = false;
    }
  } catch (error) {
    checks.auth = 'unhealthy';
    isReady = false;
  }

  const status = isReady ? 'healthy' : 'unhealthy';
  const statusCode = isReady ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: statusCode }
  );
}

/**
 * Startup Probe - Has the pod finished initializing?
 * Used by: Kubernetes startupProbe
 * Response time: < 3s
 * Failure threshold: 30 (5 minutes to startup)
 * 
 * Checks if application initialization is complete:
 * - Environment variables loaded
 * - Configuration initialized
 * - Database migrations completed (if any)
 */
async function handleStartupProbe(): Promise<NextResponse<HealthStatus>> {
  const checks: Record<string, unknown> = {};
  let isStarted = true;

  // Check environment variables
  checks.environment = {
    nodeEnv: process.env.NODE_ENV,
    portConfigured: !!process.env.PORT,
    databaseUrlConfigured: !!process.env.DATABASE_URL,
    redisConfigured: !!process.env.UPSTASH_REDIS_REST_URL,
  };

  // Check configuration
  checks.configuration = {
    fhirEnabled: process.env.ENABLE_FHIR_API === 'true',
    bandwidthOptimizationEnabled: process.env.ENABLE_BANDWIDTH_OPTIMIZATION === 'true',
    metricsEnabled: process.env.ENABLE_METRICS === 'true',
  };

  // Check critical services
  try {
    checks.criticalServices = {
      database: await checkDatabaseHealth(),
      authentication: await checkSupabaseHealth(),
    };
    
    if (
      checks.criticalServices.database !== 'healthy' ||
      checks.criticalServices.authentication !== 'healthy'
    ) {
      isStarted = false;
    }
  } catch (error) {
    checks.criticalServices = 'unhealthy';
    isStarted = false;
  }

  const status = isStarted ? 'healthy' : 'unhealthy';
  const statusCode = isStarted ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: statusCode }
  );
}

/**
 * Deep Health Check - Comprehensive system status
 * Used by: Monitoring dashboards, manual diagnostics
 * Response time: < 10s
 * 
 * Provides detailed information about all system components
 */
async function handleDeepHealthCheck(): Promise<NextResponse<HealthStatus>> {
  const checks: Record<string, unknown> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // System information
  checks.system = {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };

  // Database health
  try {
    checks.database = await checkDatabaseHealth();
  } catch (error) {
    checks.database = 'unhealthy';
    overallStatus = 'degraded';
  }

  // Cache/Redis health
  try {
    checks.redis = await checkRedisHealth();
  } catch (error) {
    checks.redis = 'unhealthy';
    overallStatus = 'degraded';
  }

  // Authentication service
  try {
    checks.authentication = await checkSupabaseHealth();
  } catch (error) {
    checks.authentication = 'unhealthy';
    overallStatus = 'degraded';
  }

  // FHIR API status (if enabled)
  if (process.env.ENABLE_FHIR_API === 'true') {
    checks.fhir = {
      enabled: true,
      version: process.env.FHIR_VERSION || '4.0.1',
    };
  }

  // Bandwidth optimization status
  if (process.env.ENABLE_BANDWIDTH_OPTIMIZATION === 'true') {
    checks.bandwidth = {
      enabled: true,
      imageCacheTTL: process.env.IMAGE_CACHE_TTL,
      serviceWorkerEnabled: process.env.ENABLE_SERVICE_WORKER === 'true',
    };
  }

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: statusCode }
  );
}

/**
 * Health check helper functions
 * 
 * These should be implemented in:
 * src/lib/health-checks/
 */

// Example implementations (add to src/lib/health-checks/):

/**
 * Check database connectivity and query performance
 */
export async function checkDatabaseHealth(): Promise<string> {
  try {
    // Query the database with a simple health check query
    // const client = await db.connect();
    // const result = await client.query('SELECT 1');
    // await client.end();
    
    // For now, just check if URL is configured
    if (!process.env.DATABASE_URL) {
      return 'unhealthy';
    }
    
    return 'healthy';
  } catch (error) {
    console.error('Database health check failed:', error);
    return 'unhealthy';
  }
}

/**
 * Check Redis/Upstash connectivity
 */
export async function checkRedisHealth(): Promise<string> {
  try {
    // Check if Redis client can connect and ping
    // const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL);
    // await redis.ping();
    
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return 'degraded'; // Optional dependency
    }
    
    return 'healthy';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return 'degraded'; // Redis is used for rate limiting, not critical
  }
}

/**
 * Check Supabase/Authentication service
 */
export async function checkSupabaseHealth(): Promise<string> {
  try {
    // Check if Supabase client is initialized
    // const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`);
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      return 'unhealthy';
    }
    
    return 'healthy';
  } catch (error) {
    console.error('Supabase health check failed:', error);
    return 'unhealthy';
  }
}
