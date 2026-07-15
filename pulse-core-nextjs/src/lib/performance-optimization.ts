/**
 * Performance Optimization Module
 * 
 * Provides performance optimization utilities for the AfyaHero application,
 * including caching strategies, lazy loading, and bundle optimization.
 */

import logger from '@/lib/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class InMemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats = { hits: 0, misses: 0 };

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton cache instances
export const apiCache = new InMemoryCache<any>();
export const settingsCache = new InMemoryCache<any>();
export const patientDataCache = new InMemoryCache<any>();

/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit how often a function can be called
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Memoize function to cache expensive computations
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, ReturnType<T>>();

  return function executedFunction(...args: Parameters<T>): ReturnType<T> {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  };
}

/**
 * Lazy load a component or module
 */
export function lazyLoad<T>(
  loader: () => Promise<T>,
  fallback?: T
): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return () => {
    if (cached) {
      return Promise.resolve(cached);
    }

    if (loading) {
      return loading;
    }

    loading = loader()
      .then((result) => {
        cached = result;
        return result;
      })
      .catch((error) => {
        logger.error('Lazy load failed', { error });
        if (fallback !== undefined) {
          return fallback;
        }
        throw error;
      })
      .finally(() => {
        loading = null;
      });

    return loading;
  };
}

/**
 * Optimize image loading with WebP support
 */
export function optimizeImageUrl(url: string, options?: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}): string {
  if (!url) return '';

  // If using Next.js Image component, this is handled automatically
  // This is for manual URL optimization
  const params = new URLSearchParams();

  if (options?.width) params.set('w', options.width.toString());
  if (options?.height) params.set('h', options.height.toString());
  if (options?.quality) params.set('q', options.quality.toString());
  if (options?.format) params.set('f', options.format);

  const paramString = params.toString();
  return paramString ? `${url}?${paramString}` : url;
}

/**
 * Batch API requests to reduce network calls
 */
export class RequestBatcher<T, I = unknown> {
  private queue: Array<{ resolve: (value: T) => void; reject: (error: Error) => void; item: I }> = [];
  private timer: NodeJS.Timeout | null = null;
  private batchFn: (items: I[]) => Promise<T[]>;
  private batchSize: number;
  private batchDelay: number;

  constructor(batchFn: (items: I[]) => Promise<T[]>, batchSize: number = 10, batchDelay: number = 100) {
    this.batchFn = batchFn;
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
  }

  /**
   * Add item to batch
   */
  add(item: I): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, item });

      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  /**
   * Flush the batch
   */
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const items = this.queue.map(q => q.item);
    const promises = this.queue.map(q => ({ resolve: q.resolve, reject: q.reject }));

    this.queue = [];

    try {
      const results = await this.batchFn(items);
      results.forEach((result, index) => {
        promises[index].resolve(result);
      });
    } catch (error) {
      promises.forEach(p => p.reject(error as Error));
    }
  }
}

/**
 * Performance monitor for tracking component render times
 */
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  private maxMeasurements: number = 100;

  /**
   * Record a measurement
   */
  record(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }

    const measurements = this.measurements.get(name)!;
    measurements.push(duration);

    // Keep only the most recent measurements
    if (measurements.length > this.maxMeasurements) {
      measurements.shift();
    }

    // Warn if measurement is slow
    if (duration > 100) {
      logger.warn(`Slow performance: ${name}`, { duration });
    }
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];

    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return { count, avg, min, max, p50, p95, p99 };
  }

  /**
   * Get all measurements
   */
  getAllMeasurements(): Map<string, number[]> {
    return this.measurements;
  }

  /**
   * Clear measurements
   */
  clear(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }
}

// Singleton performance monitor
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  return {
    startMeasurement: () => {
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        performanceMonitor.record(componentName, duration);
      };
    },
    getStats: () => performanceMonitor.getStats(componentName),
  };
}

/**
 * Optimize bundle by splitting code dynamically
 */
export function dynamicImport<T>(modulePath: string): Promise<T> {
  return import(modulePath) as Promise<T>;
}

/**
 * Prefetch resources for better performance
 */
export function prefetchResources(urls: string[]): void {
  if (typeof window === 'undefined') return;

  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });

  logger.info(`Prefetched ${urls.length} resources`);
}

/**
 * Preload critical resources
 */
export function preloadResources(urls: string[]): void {
  if (typeof window === 'undefined') return;

  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = url.endsWith('.js') ? 'script' : url.endsWith('.css') ? 'style' : 'fetch';
    document.head.appendChild(link);
  });

  logger.info(`Preloaded ${urls.length} resources`);
}

/**
 * Clean up cache periodically
 */
export function startCacheCleanup(intervalMs: number = 300000): () => void {
  const interval = setInterval(() => {
    let cleaned = apiCache.cleanup();
    cleaned += settingsCache.cleanup();
    cleaned += patientDataCache.cleanup();

    if (cleaned > 0) {
      logger.info(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Get cache statistics for all caches
 */
export function getAllCacheStats(): {
  api: CacheStats;
  settings: CacheStats;
  patientData: CacheStats;
} {
  return {
    api: apiCache.getStats(),
    settings: settingsCache.getStats(),
    patientData: patientDataCache.getStats(),
  };
}
