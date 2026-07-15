/**
 * Network Connectivity Detection & Offline Handling
 *
 * Detects when internet connection is lost and notifies the app.
 * Caches critical data for offline access (patient lists, medications).
 * Syncs data when connection restored.
 *
 * Graceful degradation:
 * - Offline: Use cached data, show warning banner
 * - Slow 3G: Queue requests, batch API calls
 * - Reconnected: Auto-sync queued changes
 */

export type ConnectivityStatus = 'online' | 'offline' | 'slow' | 'unknown';

/**
 * Detect current network status
 */
export function getNetworkStatus(): ConnectivityStatus {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  if (navigator.connection) {
    const conn = navigator.connection;
    const effectiveType = conn.effectiveType;
    
    // 4g = fast, 3g = slow, 2g/slow-2g = very slow
    if (effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g') {
      return 'slow';
    }
  }

  return navigator.onLine ? 'online' : 'offline';
}

/**
 * Monitor network changes and invoke callback
 * Returns unsubscribe function
 */
export function subscribeToNetworkChanges(
  callback: (status: ConnectivityStatus) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => callback('online');
  const handleOffline = () => callback('offline');
  const handleConnectionChange = () => {
    const status = getNetworkStatus();
    callback(status);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Some browsers support connection change events
  if (navigator.connection) {
    navigator.connection.addEventListener('change', handleConnectionChange);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (navigator.connection) {
      navigator.connection.removeEventListener('change', handleConnectionChange);
    }
  };
}

/**
 * Test connectivity by making a HEAD request to a lightweight endpoint
 */
export async function testConnectivity(timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Request queue for offline-first apps
 * Queues API writes when offline, syncs when online
 */
export interface QueuedRequest {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

const QUEUE_STORAGE_KEY = 'afya_request_queue';

/**
 * Add request to offline queue
 */
export function queueRequest(
  req: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount' | 'lastError'> & Partial<Pick<QueuedRequest, 'retryCount' | 'lastError'>>
): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const queued: QueuedRequest = {
    ...req,
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    retryCount: req.retryCount ?? 0,
  };

  const queue = getQueue();
  queue.push(queued);
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  notifyQueueUpdated(queue);
}

/**
 * Get offline request queue
 */
export function getQueue(): QueuedRequest[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isQueuedRequest)
      .map((request) => ({
        ...request,
        retryCount: request.retryCount ?? 0,
      }));
  } catch {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    return [];
  }
}

/**
 * Flush queued requests when online
 */
export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const queue = getQueue();
  let success = 0;
  let failed = 0;

  for (const req of queue) {
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: { 'content-type': 'application/json' },
        body: req.body ? JSON.stringify(req.body) : undefined,
      });

      if (response.ok) {
        success++;
        removeQueuedRequest(req.id);
      } else {
        failed++;
        markQueuedRequestFailed(req.id, `HTTP ${response.status}`);
      }
    } catch {
      failed++;
      markQueuedRequestFailed(req.id, 'Network request failed');
    }
  }

  return { success, failed };
}

/**
 * Remove item from queue
 */
export function removeQueuedRequest(id: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const queue = getQueue();
  const filtered = queue.filter(r => r.id !== id);
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filtered));
  notifyQueueUpdated(filtered);
}

/**
 * Clear entire queue
 */
export function clearQueue(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(QUEUE_STORAGE_KEY);
  notifyQueueUpdated([]);
}

export function getQueueSize(): number {
  return getQueue().length;
}

function markQueuedRequestFailed(id: string, lastError: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const queue = getQueue().map((request) => (
    request.id === id
      ? { ...request, retryCount: request.retryCount + 1, lastError }
      : request
  ));
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  notifyQueueUpdated(queue);
}

function notifyQueueUpdated(queue: QueuedRequest[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('afyahero:offline-queue-updated', { detail: queue }));
}

function isQueuedRequest(value: unknown): value is QueuedRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<QueuedRequest>;
  return (
    typeof request.id === 'string' &&
    typeof request.url === 'string' &&
    typeof request.timestamp === 'number' &&
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE')
  );
}

/**
 * Cache-first fetch with offline fallback
 * Used for read operations (GET)
 */
export async function fetchWithCache(
  url: string,
  options: { cacheKey?: string; ttl?: number } = {}
): Promise<Response> {
  const _cacheKey = options.cacheKey || url;
  const _ttl = options.ttl || 5 * 60 * 1000;  // 5 min default

  try {
    // Try network first
    const response = await fetch(url);
    if (response.ok) {
      // Cache response
      const cache = await caches.open('afya-http-cache');
      cache.put(url, response.clone());
      return response;
    }
  } catch {
    // Network error — try cache
    const cache = await caches.open('afya-http-cache');
    const cached = await cache.match(url);
    if (cached) {
      return cached;
    }
  }

  // Fallback: 503 Service Unavailable
  return new Response(JSON.stringify({ error: 'Offline: Network unavailable' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });
}
