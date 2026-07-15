const DEMO_SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export function isDemoSessionExpired(issuedAtMs: number): boolean {
  return Date.now() - issuedAtMs > DEMO_SESSION_MAX_AGE_MS;
}
