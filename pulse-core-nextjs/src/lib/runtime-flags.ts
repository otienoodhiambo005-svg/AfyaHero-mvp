/**
 * Runtime feature controls shared across API/data layers.
 * Production defaults are strict to avoid silent data degradation.
 */

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return undefined;
}

export function shouldAllowMockFallbacks(): boolean {
  const override = parseBoolean(process.env.ALLOW_MOCK_FALLBACKS);
  if (override !== undefined) return override;
  return process.env.NODE_ENV !== 'production';
}

export function isStrictProductionMode(): boolean {
  return process.env.NODE_ENV === 'production' && !shouldAllowMockFallbacks();
}

