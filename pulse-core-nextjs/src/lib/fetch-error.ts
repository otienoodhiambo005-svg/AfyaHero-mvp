export async function readResponseErrorMessage(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as unknown;
      if (data && typeof data === 'object') {
        const maybeError = (data as { error?: unknown; message?: unknown }).error ?? (data as { message?: unknown }).message;
        if (typeof maybeError === 'string' && maybeError.trim()) return maybeError;
      }
      return `Request failed (${res.status})`;
    }

    const text = (await res.text()).trim();
    return text ? text.slice(0, 500) : `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

