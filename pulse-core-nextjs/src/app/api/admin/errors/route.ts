/**
 * Super Admin Error Monitoring API
 * GET /api/admin/errors - Fetch Sentry errors with multi-tenant grouping
 * Only accessible by global super administrators
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/rbac';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';

const SENTRY_API_BASE = 'https://sentry.io/api/0';

async function fetchSentryErrors(params: URLSearchParams) {
  const headers = {
    'Authorization': `Bearer ${process.env.SENTRY_AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const query = new URLSearchParams();
  query.set('statsPeriod', params.get('period') || '24h');
  query.set('query', params.get('query') || '');
  query.set('cursor', params.get('cursor') || '');

  const response = await fetch(
    `${SENTRY_API_BASE}/organizations/${process.env.SENTRY_ORG}/projects/${process.env.SENTRY_PROJECT}/issues/?${query}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Sentry API returned ${response.status}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:admin:errors',
      requireAuth: true,
    });
    if (guard.response) return guard.response;

    // Verify super admin access
    const isSuperAdmin = await verifySuperAdmin(request);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const errors = await fetchSentryErrors(searchParams);

    // Enhance with hospital grouping information
    const enhancedErrors = errors.map((error: Record<string, unknown>) => ({
      id: error.id,
      title: error.title,
      message: (error.metadata as Record<string, unknown>)?.value || error.culprit,
      count: error.count,
      userCount: error.userCount,
      firstSeen: error.firstSeen,
      lastSeen: error.lastSeen,
      level: error.level,
      status: error.status,
      platform: error.platform,
      culprit: error.culprit,
      hospitals: (error.tags as Array<{ key: string; value: string }>)?.filter(tag => tag.key === 'hospital_id').map(tag => tag.value) || [],
      affectedRoles: (error.tags as Array<{ key: string; value: string }>)?.filter(tag => tag.key === 'user_role').map(tag => tag.value) || [],
      permalink: error.permalink,
    }));

    return NextResponse.json({
      errors: enhancedErrors,
      pagination: {
        next: null,
        previous: null,
      }
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error monitoring API failure', { error: err.message });
    return NextResponse.json(
      { error: 'Failed to retrieve error monitoring data' },
      { status: 500 }
    );
  }
}
