export interface DataSourceUnavailablePayload {
  error: string;
  code: 'DATA_SOURCE_UNAVAILABLE';
  source?: string;
  retryable?: boolean;
  detail?: string;
  entity?: string;
}

export function isDataSourceUnavailablePayload(
  payload: unknown,
): payload is DataSourceUnavailablePayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    candidate.code === 'DATA_SOURCE_UNAVAILABLE' &&
    typeof candidate.error === 'string'
  );
}

export async function readDataSourceUnavailablePayload(
  response: Response,
): Promise<DataSourceUnavailablePayload | null> {
  try {
    const payload = (await response.json()) as unknown;
    if (isDataSourceUnavailablePayload(payload)) {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}
