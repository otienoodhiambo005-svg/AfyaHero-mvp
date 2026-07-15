'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Newspaper, RefreshCw, Clock, ExternalLink, AlertCircle } from 'lucide-react';
import { useHealthNews } from '@/hooks/useHealthNews';
import { formatNewsDate } from '@/lib/health-news-service';
import { cn } from '@/lib/utils';

export function HealthNewsFeed() {
  const { articles, loading, error, lastFetched, refresh } = useHealthNews();

  if (loading) {
    return (
      <div className="w-full p-6 bg-content-bg rounded-lg border shadow-card">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-slate">Loading medical news...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6 bg-content-bg rounded-lg border shadow-card">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-gray-600 mb-3">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-content-bg rounded-lg border shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b bg-content-surface flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Health & Medical News</h3>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-slate flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {formatNewsDate(lastFetched.toISOString())}
            </span>
          )}
          <button
            onClick={refresh}
            className="p-1.5 rounded-md hover:bg-content-surface transition-colors"
            title="Refresh news"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {articles.length === 0 ? (
          <div className="p-8 text-center text-slate">
            No health news available at this time
          </div>
        ) : (
          <div className="divide-y">
            {articles.slice(0, 8).map((article, index) => (
              <a
                key={article.url || `${article.source}-${article.publishedAt}-${index}`}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 hover:bg-content-surface transition-colors group"
              >
                <div className="flex gap-4">
                  {article.image && (
                    <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-gray-100">
                      <Image
                        src={article.image}
                        alt={article.title ? `Thumbnail image for: ${article.title}` : 'Health news thumbnail image'}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      'font-medium text-ink mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors',
                      !article.image && 'line-clamp-3'
                    )}>
                      {article.title}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {article.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate">
                      <span>{article.source}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatNewsDate(article.publishedAt)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}