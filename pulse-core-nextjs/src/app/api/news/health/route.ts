import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE = 'https://newsapi.org/v2';

export const revalidate = 900; // 15 minutes cache

export async function GET() {
  if (!NEWS_API_KEY) {
    return NextResponse.json({ articles: [], note: 'NEWS_API_KEY not configured' });
  }

  try {
    const response = await fetch(
      `${NEWS_API_BASE}/everything?q=health+medical+clinical+hospital&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`,
      {
        next: {
          revalidate: 900
        }
      }
    );

    if (!response.ok) {
      throw new Error(`News API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter and clean up articles
    const articles = data.articles
       
      .filter((article: { title?: string; description?: string; url?: string; source?: { name?: string }; publishedAt?: string; urlToImage?: string; author?: string }) => article.title && article.description && !article.title.includes('[Removed]'))
       
      .map((article) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
        image: article.urlToImage,
        author: article.author
      }));

    return NextResponse.json({
      success: true,
      count: articles.length,
      articles
    });

  } catch (error) {
    logger.error('Health news fetch error', { error: error instanceof Error ? error.message : String(error) });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch health news',
      articles: []
    }, { status: 500 });
  }
}