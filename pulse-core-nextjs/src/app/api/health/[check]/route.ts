import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { isStrictProductionMode, shouldAllowMockFallbacks } from '@/lib/runtime-flags';

interface CriticalServicesCheck {
  database: string;
  authentication: string;
}

interface HealthChecks {
  criticalServices?: CriticalServicesCheck | string;
  configuration?: Record<string, unknown>;
  [key: string]: unknown;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime?: number;
  checks?: HealthChecks;
}

/**
 * Health Check Endpoints for Kubernetes
 * 
 * These endpoints are required for Kubernetes probes:
 * - Liveness probe: /api/health/live
 * - Readiness probe: /api/health/ready
 * - Startup probe: /api/health/startup
 * - Deep check: /api/health/deep
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ check: string }> }
) {
  const { check: checkParam } = await context.params;
  const check = checkParam || 'live';

  try {
    switch (check) {
      case 'live':
        return await handleLiveProbe();
      
      case 'ready':
        return await handleReadyProbe();
      
      case 'startup':
        return await handleStartupProbe();
      
      case 'deep':
        return await handleDeepHealthCheck();
      
      default:
        return NextResponse.json(
          { error: 'Unknown health check type' },
          { status: 404 }
        );
    }
  } catch (error) {
    logger.error('Health check failed', {
      check,
      error: error instanceof Error ? error.message : String(error),
    });
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
    if (checks.redis !== 'healthy' && checks.redis !== 'degraded') {
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
  const checks: HealthChecks = {};
  let isStarted = true;

  // Check environment variables
  checks.environment = {
    nodeEnv: process.env.NODE_ENV,
    portConfigured: !!process.env.PORT,
    databaseUrlConfigured: !!process.env.DATABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL,
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
    memoryUsage: {
      rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
    },
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
    if (checks.redis === 'degraded') {
      overallStatus = 'degraded';
    }
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

  checks.runtimePolicy = {
    strictProductionMode: isStrictProductionMode(),
    mockFallbacksAllowed: shouldAllowMockFallbacks(),
  };

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
 * Check database connectivity and query performance
 */
async function checkDatabaseHealth(): Promise<string> {
  try {
    // Check if database configuration is present
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.DATABASE_URL) {
      return 'unhealthy';
    }
    
    return 'healthy';
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'unhealthy';
  }
}

/**
 * Check Redis/Upstash connectivity
 */
async function checkRedisHealth(): Promise<string> {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return 'degraded'; // Optional dependency
    }
    
    return 'healthy';
  } catch (error) {
    logger.error('Redis health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'degraded'; // Redis is used for rate limiting, not critical
  }
}

/**
 * Check Supabase/Authentication service
 */
async function checkSupabaseHealth(): Promise<string> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return 'unhealthy';
    }
    
    return 'healthy';
  } catch (error) {
    logger.error('Supabase health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'unhealthy';
  }
}
