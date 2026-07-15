/**
 * NewsAPI.org Client for AfyaHero Health News Feed
 * Provides region-aware health news retrieval for East African hospitals
 * Falls back gracefully to existing RSS feeds when unavailable
 */

import logger from './logger';

// Local FeedItem type definition (matches internal type in health news route)
interface FeedItem {
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  source: string;
  sourcePriority: number;
}

const NEWS_API_ENDPOINT = 'https://newsapi.org/v2/everything';
const FETCH_TIMEOUT_MS = 10000;
const DEFAULT_PAGE_SIZE = 20;

export interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

const HEALTH_KEYWORDS = [
  'health', 'medical', 'hospital', 'clinic', 'public health', 'disease',
  'vaccine', 'treatment', 'medicine', 'drug safety', 'pharmacy',
  'laboratory', 'diagnostics', 'maternal health', 'child health',
  'malaria', 'diabetes', 'hypertension', 'HIV', 'TB',
  'kenya health', 'uganda health', 'tanzania health', 'rwanda health',
  'east africa health', 'who africa', 'cdc africa'
];

const REGION_QUERIES: Record<string, string> = {
  KE: 'kenya OR nairobi OR mombasa OR kisumu',
  UG: 'uganda OR kampala',
  TZ: 'tanzania OR dar es salaam',
  RW: 'rwanda OR kigali',
};

function normalizeRegion(regionCode: string): string {
  const upper = regionCode.toUpperCase();
  return REGION_QUERIES[upper] ? upper : 'KE';
}

export async function fetchNewsApi(regionCode: string): Promise<FeedItem[]> {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return [];
  }

  const region = normalizeRegion(regionCode);
  const regionQuery = REGION_QUERIES[region];

  const query = `(${HEALTH_KEYWORDS.join(' OR ')}) AND (${regionQuery})`;

  const params = new URLSearchParams({
    q: query,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: String(DEFAULT_PAGE_SIZE),
    apiKey: apiKey,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${NEWS_API_ENDPOINT}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AfyaHero/1.0 (+https://afyahero.com)',
      },
      signal: controller.signal,
      next: { revalidate: 900 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`[NewsAPI] HTTP ${response.status}`, { status: response.status });
      return [];
    }

    const data = await response.json() as NewsApiResponse;

    if (data.status !== 'ok') {
      logger.warn('[NewsAPI] Response status not ok');
      return [];
    }

    return data.articles.map((article): FeedItem => ({
      title: article.title,
      summary: article.description || '',
      url: article.url,
      publishedAt: article.publishedAt,
      source: article.source.name,
      sourcePriority: 85,
    })).filter(item => item.title && item.url);

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('[NewsAPI] Request timed out');
    } else {
      logger.warn('[NewsAPI] Fetch failed', { error: error instanceof Error ? error.message : String(error) });
    }
    return [];
  }
}

export async function isNewsApiAvailable(): Promise<boolean> {
  const apiKey = process.env.NEWS_API_KEY;
  return !!apiKey && apiKey.trim().length > 20;
}
