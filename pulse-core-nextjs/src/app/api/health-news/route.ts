import { NextRequest, NextResponse } from 'next/server';
import type { EducationTopicData, HealthNewsRole, LiveHealthNewsPayload } from '@/lib/health-news';
import {
  enforceApiRateLimit,
  getSessionFromRequest,
  validateEnumValue,
} from '@/lib/api-security';
import type { UserSession } from '@/types';
import { applyEpidemiologyGuardrails, isRestrictedClinicalQuery } from '@/lib/epidemiology-rules';
import { logAIInteraction } from '@/lib/ai-audit';
import { fetchNewsApi } from '@/lib/news-api';

type FeedSource = {
  name: string;
  url: string;
  priority?: number;
};

type ManagedFeedSourceRow = {
  name: string;
  url: string;
  priority: number | null;
  role: string | null;
  enabled: boolean | null;
  region_codes: string[] | null;
};

type FeedItem = {
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  source: string;
  sourcePriority: number;
};

type RoleProfile = {
  keywords: string[];
  tagRules: Array<{ label: string; keywords: string[] }>;
  audienceFocus: string;
  sources: FeedSource[];
};

const COMMON_SOURCES: FeedSource[] = [
  { name: 'WHO News', url: 'https://www.who.int/rss-feeds/news-english.xml', priority: 100 },
  { name: 'MedlinePlus Health News', url: 'https://medlineplus.gov/feeds/news_en.xml', priority: 80 },
];

const ROLE_EXTRA_SOURCES: Partial<Record<HealthNewsRole, FeedSource[]>> = {
  medical: [{ name: 'CDC Public Health Media', url: 'https://tools.cdc.gov/api/v2/resources/media/132608.rss', priority: 90 }],
  lab: [{ name: 'CDC Laboratory Outreach', url: 'https://tools.cdc.gov/api/v2/resources/media/316422.rss', priority: 90 }],
  pharmacy: [{ name: 'FDA Drug Safety', url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch-safety-alerts-human-medical-products-rss-feed', priority: 95 }],
};

const STATIC_SAFE_FEED_HOSTS = new Set([
  'www.who.int',
  'medlineplus.gov',
  'tools.cdc.gov',
  'www.fda.gov',
]);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FETCH_TIMEOUT_MS = 8000;

const REGION_KEYWORDS: Record<string, string[]> = {
  KE: ['kenya', 'nairobi', 'mombasa', 'kisumu', 'east africa', 'africa', 'african region'],
  UG: ['uganda', 'kampala', 'east africa', 'africa'],
  TZ: ['tanzania', 'dar es salaam', 'east africa', 'africa'],
  RW: ['rwanda', 'kigali', 'east africa', 'africa'],
};

const ROLE_PROFILES: Record<HealthNewsRole, RoleProfile> = {
  reception: {
    keywords: ['triage', 'maternal', 'vaccin', 'child', 'fever', 'respiratory', 'screening', 'patient', 'clinic', 'prevention'],
    tagRules: [
      { label: 'Prevention', keywords: ['vaccin', 'prevent', 'screening'] },
      { label: 'Maternal Care', keywords: ['maternal', 'pregnan', 'antenatal'] },
      { label: 'Queue Prep', keywords: ['respiratory', 'fever', 'patient', 'clinic'] },
    ],
    audienceFocus: 'front-desk screening, triage prep, and patient guidance',
    sources: COMMON_SOURCES,
  },
  medical: {
    keywords: ['clinical', 'diagnos', 'therapy', 'treatment', 'disease', 'hypertension', 'diabetes', 'malaria', 'infection', 'patient'],
    tagRules: [
      { label: 'Clinical Update', keywords: ['clinical', 'treatment', 'therapy', 'diagnos'] },
      { label: 'Chronic Care', keywords: ['hypertension', 'diabetes', 'cardio'] },
      { label: 'Acute Care', keywords: ['infection', 'malaria', 'emergency', 'fever'] },
    ],
    audienceFocus: 'clinical teaching, discharge counseling, and bedside decision support',
    sources: COMMON_SOURCES,
  },
  lab: {
    keywords: ['test', 'laboratory', 'diagnostic', 'sample', 'screening', 'pathogen', 'infection', 'specimen', 'surveillance'],
    tagRules: [
      { label: 'Diagnostics', keywords: ['diagnostic', 'test', 'screening'] },
      { label: 'Collection', keywords: ['sample', 'specimen'] },
      { label: 'Surveillance', keywords: ['pathogen', 'infection', 'surveillance'] },
    ],
    audienceFocus: 'sample quality, diagnostic preparation, and lab escalation guidance',
    sources: COMMON_SOURCES,
  },
  pharmacy: {
    keywords: ['drug', 'medication', 'medicine', 'dose', 'pharmacy', 'antibiotic', 'insulin', 'adverse', 'safety'],
    tagRules: [
      { label: 'Medication Safety', keywords: ['safety', 'adverse', 'dose'] },
      { label: 'Adherence', keywords: ['medication', 'medicine', 'antibiotic'] },
      { label: 'Storage', keywords: ['insulin', 'vaccine', 'cold'] },
    ],
    audienceFocus: 'dispensing counseling, adherence, and safe medication use',
    sources: COMMON_SOURCES,
  },
  admin: {
    keywords: ['health system', 'patient safety', 'hospital', 'quality', 'workforce', 'capacity', 'care delivery', 'public health'],
    tagRules: [
      { label: 'Quality', keywords: ['quality', 'patient safety'] },
      { label: 'Operations', keywords: ['hospital', 'capacity', 'workforce'] },
      { label: 'Population Health', keywords: ['public health', 'health system'] },
    ],
    audienceFocus: 'quality oversight, hospital operations, and public-health communication',
    sources: COMMON_SOURCES,
  },
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const REFRESH_MINUTES = 5;

const responseCache = new Map<string, { expiresAt: number; payload: LiveHealthNewsPayload }>();

function normalizeRegion(region?: string | null): string {
  const configured = region || process.env.NEXT_PUBLIC_HEALTH_NEWS_REGION || process.env.HEALTH_NEWS_REGION;
  return (configured ?? 'KE').trim().toUpperCase();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2019;/g, "'")
    .replace(/&#8217;/g, "'")
    .trim();
}

function stripHtml(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function extractTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'i'));
  return match ? stripHtml(match[1]) : '';
}

function extractLink(block: string): string {
  const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
  if (hrefMatch) {
    return decodeXmlEntities(hrefMatch[1]);
  }

  const textMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  return textMatch ? decodeXmlEntities(textMatch[1].trim()) : '';
}

function parseFeed(xml: string, source: FeedSource): FeedItem[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

  return itemMatches
    .map((block) => {
      const title = extractTag(block, 'title');
      const summary = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content');
      const url = extractLink(block);
      const publishedAt = extractTag(block, 'pubDate') || extractTag(block, 'updated') || extractTag(block, 'published');

      return {
        title,
        summary,
        url,
        publishedAt,
        source: source.name,
        sourcePriority: source.priority ?? 50,
      } satisfies FeedItem;
    })
    .filter((item) => item.title && item.url);
}

function scoreItemForRole(item: FeedItem, profile: RoleProfile, regionCode: string): number {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  const keywordHits = profile.keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
  const regionBoost = (REGION_KEYWORDS[regionCode] ?? []).some((keyword) => haystack.includes(keyword)) ? 1.5 : 0;

  let recencyBoost = 0;
  if (item.publishedAt) {
    const publishedTime = Date.parse(item.publishedAt);
    if (!Number.isNaN(publishedTime)) {
      const ageHours = (Date.now() - publishedTime) / (1000 * 60 * 60);
      if (ageHours <= 24) {
        recencyBoost = 1.5;
      } else if (ageHours <= 24 * 7) {
        recencyBoost = 1;
      } else if (ageHours <= 24 * 30) {
        recencyBoost = 0.5;
      }
    }
  }

  const sourceBoost = Math.min(2, (item.sourcePriority ?? 50) / 100);

  return keywordHits + recencyBoost + regionBoost + sourceBoost;
}

function deriveTag(item: FeedItem, profile: RoleProfile): string {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  const matchedRule = profile.tagRules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
  return matchedRule?.label ?? 'Health Update';
}

function formatRelativeAge(publishedAt?: string): string {
  if (!publishedAt) {
    return 'Recent update';
  }

  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) {
    return 'Recent update';
  }

  const diffHours = Math.max(1, Math.round((Date.now() - timestamp) / (1000 * 60 * 60)));
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function summarize(value: string): string {
  const clean = value.trim();
  if (!clean) {
    return 'Read the full update for the latest guidance and operational implications.';
  }

  return clean.length > 180 ? `${clean.slice(0, 177).trimEnd()}...` : clean;
}

function isAllowedFeedSource(source: FeedSource, dynamicHosts: Set<string>): boolean {
  try {
    const host = new URL(source.url).host.toLowerCase();
    return STATIC_SAFE_FEED_HOSTS.has(host) || dynamicHosts.has(host);
  } catch {
    return false;
  }
}

async function loadManagedSources(role: HealthNewsRole, regionCode: string): Promise<{ sources: FeedSource[]; allowedHosts: Set<string> }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { sources: [], allowedHosts: new Set<string>() };
  }

  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/health_news_feed_sources?select=name,url,priority,role,enabled,region_codes&enabled=eq.true`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return { sources: [], allowedHosts: new Set<string>() };
    }

    const rows = (await response.json()) as ManagedFeedSourceRow[];
    const filtered = rows.filter((row) => {
      const roleMatches = !row.role || row.role === 'all' || row.role === role;
      const regions = row.region_codes ?? [];
      const regionMatches = regions.length === 0 || regions.includes(regionCode);
      return roleMatches && regionMatches && row.enabled !== false;
    });

    const sources = filtered
      .map((row): FeedSource => ({
        name: row.name,
        url: row.url,
        priority: row.priority ?? 70,
      }))
      .filter((source) => source.name && source.url)
      .filter((source, index, array) => array.findIndex((candidate) => candidate.url === source.url) === index)
      .sort((left, right) => (right.priority ?? 50) - (left.priority ?? 50));

    const allowedHosts = new Set<string>();
    for (const source of sources) {
      try {
        allowedHosts.add(new URL(source.url).host.toLowerCase());
      } catch {
        // Skip malformed URLs from managed config.
      }
    }

    return { sources, allowedHosts };
  } catch {
    return { sources: [], allowedHosts: new Set<string>() };
  }
}

async function fetchSource(source: FeedSource): Promise<FeedItem[]> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'AfyaHero/1.0 (+https://afyahero.local)',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      next: { revalidate: 900 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseFeed(xml, source);
  } catch {
    return [];
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function validateFeedItemWithDAWA(item: FeedItem, _role: string): Promise<{ valid: boolean; reason?: string }> {
  const content = `${item.title} ${item.summary}`;
  
  // Check for restricted clinical content
  const restrictedCheck = isRestrictedClinicalQuery(content);
  if (restrictedCheck.restricted) {
    return { valid: false, reason: `Restricted clinical content: ${restrictedCheck.category}` };
  }
  
  // Apply epidemiology guardrails
  const guardrailResult = applyEpidemiologyGuardrails(content, {});
  if (guardrailResult.shouldBlock) {
    return { valid: false, reason: guardrailResult.blockReason };
  }
  
  return { valid: true };
}

async function filterItemsWithDAWA(items: FeedItem[], role: HealthNewsRole, session: UserSession | null): Promise<FeedItem[]> {
  const validatedItems: FeedItem[] = [];
  const filteredItems: { item: FeedItem; reason: string }[] = [];
  
  for (const item of items) {
    const validation = await validateFeedItemWithDAWA(item, role);
    if (validation.valid) {
      validatedItems.push(item);
    } else {
      filteredItems.push({ item, reason: validation.reason || 'Failed DAWA content validation' });
    }
  }
  
  // Log filtered items for audit
  if (filteredItems.length > 0) {
    void logAIInteraction({
      userRole: session?.role || role,
      userSubrole: session?.subrole,
      userName: session?.name,
      hospitalId: session?.hospitalId,
      aiType: 'health-feed-validation',
      providerUsed: 'gemini',
      modelUsed: 'epidemiology-rule-v1',
      latencyMs: 0,
      success: true,
      inputSummary: `Health feed validation filtered ${filteredItems.length} items`,
      outputSummary: filteredItems.map(f => `[${f.reason}] ${f.item.title}`).join(' | '),
      dawaPersona: 'DAWA-Clinical'
    });
  }
  
  return validatedItems;
}

async function buildPayload(role: HealthNewsRole, regionCode: string, items: FeedItem[], session: any): Promise<LiveHealthNewsPayload> {
  const profile = ROLE_PROFILES[role];
  
  // First apply DAWA content controls
  const validatedItems = await filterItemsWithDAWA(items, role, session);

  const ranked = validatedItems
    .map((item) => ({ item, score: scoreItemForRole(item, profile, regionCode) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title));

  const selected = (ranked.length > 0 ? ranked : items.map((item) => ({ item, score: 0 })))
    .filter((entry, index, array) => array.findIndex((candidate) => candidate.item.title === entry.item.title) === index)
    .slice(0, 3)
    .map(({ item }): EducationTopicData => ({
      title: item.title,
      tag: deriveTag(item, profile),
      duration: formatRelativeAge(item.publishedAt),
      summary: summarize(item.summary),
      actionLabel: 'Read latest guidance',
      url: item.url,
      source: item.source,
      publishedAt: item.publishedAt,
      isLive: true,
    }));

  const topHeadline = selected[0]?.title ?? 'Online guidance is being refreshed from trusted public health sources.';
  const topSource = selected[0]?.source ?? 'WHO and MedlinePlus';

  return {
    updatedAt: new Date().toISOString(),
    regionCode,
    refreshMinutes: REFRESH_MINUTES,
    sourceNames: Array.from(new Set(selected.map((item) => item.source).filter(Boolean) as string[])),
    insightText: `Latest online update from ${topSource}: ${topHeadline}. Review these items for ${profile.audienceFocus}.`,
    items: selected,
  };
}

function resolveSources(role: HealthNewsRole, managedSources: FeedSource[], managedAllowedHosts: Set<string>): FeedSource[] {
  const base = ROLE_PROFILES[role].sources;
  const extras = ROLE_EXTRA_SOURCES[role] ?? [];

  return [...base, ...extras, ...managedSources]
    .filter((source) => isAllowedFeedSource(source, managedAllowedHosts))
    .filter((source, index, array) => array.findIndex((candidate) => candidate.url === source.url) === index)
    .sort((left, right) => (right.priority ?? 50) - (left.priority ?? 50));
}

export async function GET(request: NextRequest) {
  const rateLimit = await enforceApiRateLimit(request, 'api:health-news');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get('role');
  const regionCode = normalizeRegion(searchParams.get('region'));

  const role = validateEnumValue(roleParam, 'role', ['reception', 'medical', 'lab', 'pharmacy', 'admin'] as const);
  if (role instanceof NextResponse) {
    return NextResponse.json({ error: 'Invalid or missing role' }, { status: 400 });
  }

  if (session.role !== 'admin' && session.role !== role) {
    return NextResponse.json({ error: 'Unauthorized role access' }, { status: 403 });
  }

  const cacheKey = `${role}:${regionCode}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const managed = await loadManagedSources(role, regionCode);
  const sources = resolveSources(role, managed.sources, managed.allowedHosts);
  
  // Fetch from both NewsAPI and existing RSS feeds
  const [newsApiResults, feedResults] = await Promise.all([
    fetchNewsApi(regionCode),
    Promise.all(sources.map((source) => fetchSource(source)))
  ]);
  
  const allItems = [...newsApiResults, ...feedResults.flat()];
  const payload = await buildPayload(role, regionCode, allItems, session);

  responseCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });

  return NextResponse.json(payload);
}
