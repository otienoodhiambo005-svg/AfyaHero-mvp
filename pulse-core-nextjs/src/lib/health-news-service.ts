import logger from '@/lib/logger';

export interface HealthNewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image: string | null;
  author: string | null;
}

export interface HealthNewsResponse {
  success: boolean;
  count: number;
  articles: HealthNewsArticle[];
  error?: string;
}

/**
 * Fetch latest health and medical news
 * Cached at 15 minute intervals on the server
 */
export async function fetchHealthNews(): Promise<HealthNewsResponse> {
  try {
    const response = await fetch('/api/news/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Failed to load health news', { error });
    return {
      success: false,
      count: 0,
      articles: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Format published date to human readable format
 */
export function formatNewsDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}