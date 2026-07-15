/**
 * Lightweight trend projection for capacity planner (UTC day buckets).
 */

/** Oldest→newest daily counts; project sum for x = n..n+6 */
export function forecastNext7Total(dailyLast7: number[]): {
  projectedTotal: number;
  last7Total: number;
  deltaPctVsLast7: number;
} {
  const y = dailyLast7;
  const n = y.length;
  if (n === 0) {
    return { projectedTotal: 0, last7Total: 0, deltaPctVsLast7: 0 };
  }
  const sumY = y.reduce((a, b) => a + b, 0);
  if (sumY === 0) {
    return { projectedTotal: 0, last7Total: 0, deltaPctVsLast7: 0 };
  }
  const xs = y.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * y[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  let projected = 0;
  for (let x = n; x < n + 7; x += 1) {
    projected += Math.max(0, Math.round(intercept + slope * x));
  }
  const deltaPctVsLast7 = Math.round(((projected - sumY) / sumY) * 100);
  return { projectedTotal: projected, last7Total: sumY, deltaPctVsLast7 };
}

/** Next UTC-day bucket (n = series length). */
export function forecastNextDay(dailyLast7: number[]): {
  projectedNextDay: number;
  lastDay: number;
  deltaPctVsPriorDay: number;
} {
  const y = dailyLast7;
  const n = y.length;
  if (n === 0) {
    return { projectedNextDay: 0, lastDay: 0, deltaPctVsPriorDay: 0 };
  }
  const lastDay = y[n - 1] ?? 0;
  const priorDay = n >= 2 ? (y[n - 2] ?? 0) : lastDay;
  const sumY = y.reduce((a, b) => a + b, 0);
  const xs = y.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * y[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const projectedNextDay = Math.max(0, Math.round(intercept + slope * n));
  const deltaPctVsPriorDay =
    priorDay <= 0 ? (projectedNextDay > 0 ? 100 : 0) : Math.round(((projectedNextDay - priorDay) / priorDay) * 100);
  return { projectedNextDay, lastDay, deltaPctVsPriorDay };
}

export function utcDayKeysLast7(nowMs: number): string[] {
  const keys: string[] = [];
  const base = new Date(nowMs);
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - i));
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function seriesFromDayMap(dayMap: Map<string, number>, keys: string[]): number[] {
  return keys.map((k) => dayMap.get(k) ?? 0);
}
