/**
 * Request Deduplication Utility
 * 
 * Prevents processing duplicate concurrent requests by tracking
 * in-flight requests and returning the same promise for identical requests.
 */

interface PendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private cleanupInterval: number = 60000; // 1 minute
  private requestTimeout: number = 30000; // 30 seconds

  constructor() {
    // Clean up old pending requests periodically
    if (typeof window === 'undefined') {
      // Only run in server environment
      setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  /**
   * Generate request key from parameters
   */
  private generateKey(method: string, url: string, body?: unknown): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyStr}`;
  }

  /**
   * Execute request with deduplication
   */
  async execute<T>(
    method: string,
    url: string,
    requestFn: () => Promise<T>,
    body?: unknown
  ): Promise<T> {
    const key = this.generateKey(method, url, body);

    // Check if there's already a pending request
    const existing = this.pendingRequests.get(key);
    if (existing && Date.now() - existing.timestamp < this.requestTimeout) {
      // Return the existing promise
      return existing.promise as Promise<T>;
    }

    // Create new request
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key);
    });

    // Store the pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Clean up expired pending requests
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingRequests.entries()) {
      if (now - value.timestamp > this.requestTimeout) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): { pendingCount: number; keys: string[] } {
    this.cleanup();
    return {
      pendingCount: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys()),
    };
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Deduplication decorator for API route handlers
 */
export function withDeduplication<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    keyGenerator?: (...args: Parameters<T>) => string;
    timeout?: number;
  } = {}
): T {
  const { keyGenerator, timeout } = options;

  return (async (...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    // Check for existing request
    const existing = requestDeduplicator['pendingRequests'].get(key);
    if (existing && Date.now() - existing.timestamp < (timeout || 30000)) {
      return existing.promise as Promise<ReturnType<T>>;
    }

    // Execute new request
    const promise = fn(...args).finally(() => {
      requestDeduplicator['pendingRequests'].delete(key);
    });

    requestDeduplicator['pendingRequests'].set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }) as T;
}

/**
 * Deduplicate concurrent AI orchestration requests
 */
export function deduplicateAIRequest<T>(
  taskType: string,
  prompt: string,
  requestFn: () => Promise<T>
): Promise<T> {
  return requestDeduplicator.execute('POST', `ai:${taskType}`, requestFn, { taskType, prompt });
}

/**
 * Check if a request is currently pending
 */
export function isRequestPending(method: string, url: string, body?: unknown): boolean {
  const key = requestDeduplicator['generateKey'](method, url, body);
  const existing = requestDeduplicator['pendingRequests'].get(key);
  return existing !== undefined;
}

/**
 * Clear all pending requests
 */
export function clearPendingRequests(): void {
  requestDeduplicator['pendingRequests'].clear();
}
