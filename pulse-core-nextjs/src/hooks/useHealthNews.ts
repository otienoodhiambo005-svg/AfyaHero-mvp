'use client';

import { useState, useEffect, useCallback } from 'react';
import { HealthNewsArticle, fetchHealthNews } from '@/lib/health-news-service';

export function useHealthNews() {
  const [articles, setArticles] = useState<HealthNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchHealthNews();

    if (result.success) {
      setArticles(result.articles);
      setLastFetched(new Date());
    } else {
      setError(result.error || 'Failed to load news');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // Defer initial load to avoid synchronous setState in effect
    setTimeout(() => loadNews(), 0);

    // Auto refresh every 15 minutes
    const interval = setInterval(() => {
      loadNews();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadNews]);

  return {
    articles,
    loading,
    error,
    lastFetched,
    refresh: loadNews
  };
}