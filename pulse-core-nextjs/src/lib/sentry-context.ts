import * as Sentry from '@sentry/nextjs';
import type { UserSession } from '@/types';

/**
 * Set multi-tenant context in Sentry for error grouping
 * Follows PII security guidelines - only includes safe non-identifiable fields
 */
export function setSentryContext(session: UserSession | null, requestId?: string) {
  if (!session) return;

  Sentry.setUser({
    id: session.id,
    hospitalId: session.hospitalId,
    role: session.role,
    // NO email, phone, name or other PII
  });

  Sentry.setTag('hospital_id', session.hospitalId);
  Sentry.setTag('user_role', session.role);
  Sentry.setTag('tenant', session.hospitalId);

  if (requestId) {
    Sentry.setTag('request_id', requestId);
    Sentry.setContext('request', { requestId });
  }
}

/**
 * Set operation context for tracing
 */
export function setOperationContext(operation: string, module: string) {
  Sentry.setTag('operation', operation);
  Sentry.setTag('module', module);
}

/**
 * Capture error with proper tenant context
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setExtras(context);
  }
  return Sentry.captureException(error);
}