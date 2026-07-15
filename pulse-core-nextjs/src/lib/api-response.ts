import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const DEFAULT_CLIENT_MESSAGE = 'An unexpected error occurred. Please try again.';

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, string[]>;
  requestId: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export function createErrorResponse(
  message: string,
  code: string,
  status: number,
  details?: Record<string, string[]>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      requestId: crypto.randomUUID(),
    },
    { status }
  );
}

/**
 * Logs the full error server-side and returns a safe message for API clients.
 * Never expose stack traces or internal error details in production responses.
 */
export function sanitizeError(
  error: unknown,
  options?: {
    context?: string;
    clientMessage?: string;
  },
): { error: string } {
  const context = options?.context ?? 'API error';

  logger.error(context, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return { error: options?.clientMessage ?? DEFAULT_CLIENT_MESSAGE };
}
