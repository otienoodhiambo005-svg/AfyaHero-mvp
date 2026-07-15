'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, ExternalLink, Clock, Tag, BookOpen, HeartPulse, Share2, BookmarkPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { EducationTopicData } from '@/lib/health-news';

interface HealthNewsSlidesProps {
  articles: EducationTopicData[];
  accentColor: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export default function HealthNewsSlides({
  articles,
  accentColor,
  autoPlay = true,
  autoPlayInterval = 5000,
}: HealthNewsSlidesProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!autoPlay || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % articles.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, isPaused, articles.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % articles.length);
    setIsPaused(true);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + articles.length) % articles.length);
    setIsPaused(true);
  };

  const toggleBookmark = (index: number) => {
    const newBookmarks = new Set(isBookmarked);
    if (newBookmarks.has(index)) {
      newBookmarks.delete(index);
    } else {
      newBookmarks.add(index);
    }
    setIsBookmarked(newBookmarks);
  };

  const shareArticle = (article: EducationTopicData) => {
    if (navigator.share && article.url) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: article.url,
      });
    }
  };

  const currentArticle = articles[currentIndex];

  if (!currentArticle) {
    return (
      <div className="rounded-card border border-content-border bg-content-surface p-8 text-center">
        <HeartPulse className="h-12 w-12 mx-auto text-slate-400 mb-4" />
        <p className="text-slate-600">No health news available at this time.</p>
      </div>
    );
  }

  const hasImage = Boolean(currentArticle.image);

  return (
    <div className="relative w-full overflow-hidden rounded-card bg-content-bg shadow-lg">
      {/* Main Slide */}
      <div
        className="relative min-h-[400px] transition-all duration-500 ease-in-out"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {hasImage && (
          <div className="absolute inset-0">
            <Image
              src={currentArticle.image || ''}
              alt={currentArticle.title}
              fill
              className="object-cover"
              priority={currentIndex === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          </div>
        )}

        <div className={cn('relative z-10 flex flex-col min-h-[400px]', hasImage && 'text-white')}>
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-2">
              <div
                className="rounded-full p-2"
                style={{ backgroundColor: `${accentColor}30` }}
              >
                <HeartPulse className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <span className="text-sm font-semibold uppercase tracking-wider">
                Health News
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => shareArticle(currentArticle)}
                className="rounded-full p-2 hover:bg-content-bg/20 transition-colors"
                aria-label="Share article"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => toggleBookmark(currentIndex)}
                className={cn(
                  'rounded-full p-2 transition-colors',
                  isBookmarked.has(currentIndex) ? 'text-yellow-400' : 'hover:bg-content-bg/20'
                )}
                aria-label="Bookmark article"
              >
                <BookmarkPlus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-end p-6">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ backgroundColor: accentColor, color: 'white' }}
              >
                {currentArticle.tag}
              </span>
              <span className="flex items-center gap-1 text-sm opacity-80">
                <Clock className="h-4 w-4" />
                {currentArticle.duration}
              </span>
              {currentArticle.source && (
                <span className="text-sm opacity-80">{currentArticle.source}</span>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-3 leading-tight">
              {currentArticle.title}
            </h2>

            <p className="text-base leading-relaxed mb-6 opacity-90 line-clamp-3">
              {currentArticle.summary}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentArticle.url ? (
                  <a
                    href={currentArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:opacity-80"
                    style={{ backgroundColor: accentColor, color: 'white' }}
                  >
                    <BookOpen className="h-4 w-4" />
                    Read More
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold opacity-50 cursor-not-allowed"
                    style={{ backgroundColor: accentColor, color: 'white' }}
                  >
                    <BookOpen className="h-4 w-4" />
                    Read More
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm opacity-70">
                  {currentIndex + 1} of {articles.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-t from-slate-900/80 to-transparent">
        <button
          onClick={prevSlide}
          className="rounded-full p-2 bg-content-bg/20 hover:bg-content-bg/30 transition-colors backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {articles.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'w-8'
                  : 'w-2 opacity-50 hover:opacity-100'
              )}
              style={{
                backgroundColor: index === currentIndex ? accentColor : 'white',
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          className="rounded-full p-2 bg-content-bg/20 hover:bg-content-bg/30 transition-colors backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Play/Pause Indicator */}
      {!isPaused && autoPlay && (
        <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 rounded-full bg-content-bg/20 backdrop-blur-sm">
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-content-bg rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-content-bg rounded-full animate-pulse delay-75" />
            <div className="w-1 h-1 bg-content-bg rounded-full animate-pulse delay-150" />
          </div>
          <span className="text-xs">Auto-playing</span>
        </div>
      )}

      {/* Thumbnail Strip */}
      {articles.length > 1 && (
        <div className="absolute bottom-20 left-0 right-0 flex gap-2 px-6 overflow-x-auto">
          {articles.map((article, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all border-2',
                index === currentIndex
                  ? 'border-white opacity-100'
                  : 'border-white/30 opacity-50 hover:opacity-80'
              )}
              aria-label={`View ${article.title}`}
            >
              {article.image ? (
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
