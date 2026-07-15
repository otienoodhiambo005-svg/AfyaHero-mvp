/**
 * Superadmin AI cost trend — aggregates ai_audit_log by provider and day.
 * GET /api/superadmin/ai-costs
 */
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';
import { sanitizeError } from '@/lib/api-response';

/** USD per 1K tokens (rough estimates for dashboard visibility). */
const TOKEN_RATE_USD: Record<string, number> = {
  huggingface: 0.0002,
  groq: 0.0003,
  gemini: 0.0005,
  openai: 0.006,
  claude: 0.008,
  vertex: 0.0005,
  deepseek: 0.0004,
};

const PROVIDER_KEYS = ['huggingface', 'groq', 'gemini', 'openai', 'claude'] as const;

type AICostDay = {
  date: string;
  huggingface: number;
  groq: number;
  gemini: number;
  openai: number;
  claude: number;
};

function emptyWeek(): AICostDay[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((date) => ({
    date,
    huggingface: 0,
    groq: 0,
    gemini: 0,
    openai: 0,
    claude: 0,
  }));
}

function mapProviderKey(raw: string | null | undefined): keyof AICostDay | null {
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (p.includes('hf') || p.includes('hugging')) return 'huggingface';
  if (p.includes('groq')) return 'groq';
  if (p.includes('gemini') || p.includes('vertex')) return 'gemini';
  if (p.includes('openai') || p.includes('gpt')) return 'openai';
  if (p.includes('claude') || p.includes('anthropic')) return 'claude';
  return null;
}

function estimateCostUsd(
  provider: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
): number {
  const key = mapProviderKey(provider);
  const rate = key ? TOKEN_RATE_USD[key] ?? 0.001 : 0.001;
  return ((promptTokens + completionTokens) / 1000) * rate;
}

async function fetchFromSupabase(): Promise<AICostDay[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from('ai_audit_log')
      .select('provider_used, prompt_tokens, completion_tokens, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    if (error || !data?.length) return null;

    const buckets = emptyWeek();
    const dayIndex = new Map<string, number>();
    buckets.forEach((b, i) => dayIndex.set(b.date, i));

    for (const row of data) {
      const created = new Date(row.created_at as string);
      const weekday = created.toLocaleDateString('en-GB', { weekday: 'short' });
      const idx = dayIndex.get(weekday);
      if (idx === undefined) continue;
      const provider = mapProviderKey(row.provider_used as string);
      if (!provider || provider === 'date') continue;
      const cost = estimateCostUsd(
        row.provider_used as string,
        Number(row.prompt_tokens) || 0,
        Number(row.completion_tokens) || 0,
      );
      buckets[idx][provider] = Math.round((buckets[idx][provider] + cost) * 100) / 100;
    }
    return buckets;
  } catch (error) {
    logger.warn('[AI Costs] Supabase aggregation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:ai-costs',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const data = (await fetchFromSupabase()) ?? emptyWeek();
    const grandTotal = data.reduce(
      (sum, day) =>
        sum + PROVIDER_KEYS.reduce((s, k) => s + (day[k] ?? 0), 0),
      0,
    );

    return NextResponse.json({
      data,
      source: data.some((d) => PROVIDER_KEYS.some((k) => d[k] > 0)) ? 'ai_audit_log' : 'empty',
      budget: Number(process.env.AI_MONTHLY_BUDGET_USD ?? 100),
      grandTotal: Math.round(grandTotal * 100) / 100,
    });
  } catch (error) {
    return NextResponse.json(sanitizeError(error, { context: 'superadmin ai-costs' }), { status: 500 });
  }
}
