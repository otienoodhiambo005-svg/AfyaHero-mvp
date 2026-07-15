import { NextResponse } from 'next/server';

export interface DegradedResponseOptions {
  entity: string;
  detail: string;
  error?: string;
  source?: string;
  retryable?: boolean;
}

export function buildDegradedResponse({
  entity,
  detail,
  error,
  source = 'primary',
  retryable = true,
}: DegradedResponseOptions): NextResponse {
  return NextResponse.json(
    {
      error: error ?? `Data source unavailable for ${entity}`,
      code: 'DATA_SOURCE_UNAVAILABLE',
      source,
      retryable,
      detail,
      entity,
    },
    { status: 503 },
  );
}

