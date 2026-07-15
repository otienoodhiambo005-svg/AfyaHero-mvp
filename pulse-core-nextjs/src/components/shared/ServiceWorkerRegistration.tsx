'use client';

import { useEffect } from 'react';
import logger from '@/lib/logger';
import { flushQueue, queueRequest } from '@/lib/network-utils';

interface ServiceWorkerQueuedRequest {
    url: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: string;
}

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        // In development, avoid stale SW cache behavior that can break Next.js route transitions.
        if (process.env.NODE_ENV !== 'production') {
            navigator.serviceWorker.getRegistrations()
                .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                .then(async () => {
                    if (!('caches' in window)) return;
                    const keys = await caches.keys();
                    await Promise.all(
                        keys
                            .filter((key) => key.startsWith('afyahero-'))
                            .map((key) => caches.delete(key))
                    );
                })
                .catch(() => {
                    // Ignore cleanup failures in local dev.
                });

            return;
        }

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none',
                });

                // Check for updates immediately and then every 60s
                registration.update();
                const interval = setInterval(() => registration.update(), 60_000);

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Force activate the new SW immediately
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });

                // When a new SW takes over, reload the page seamlessly
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!refreshing) {
                        refreshing = true;
                        window.location.reload();
                    }
                });

                // Handle offline queue flush messages from SW
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data?.type === 'FLUSH_OFFLINE_QUEUE') {
                        window.dispatchEvent(new CustomEvent('afyahero:flush-offline-queue'));
                        flushQueue().catch((error) => {
                            logger.warn('[AfyaHero SW] Offline queue flush failed', { error });
                        });
                    }
                    if (event.data?.type === 'OFFLINE_QUEUE_UPDATED') {
                        window.dispatchEvent(
                            new CustomEvent('afyahero:offline-queue-updated', { detail: event.data.queue })
                        );
                    }
                    if (event.data?.type === 'OFFLINE_MUTATION_CAPTURED') {
                        const captured = event.data.request as ServiceWorkerQueuedRequest | undefined;
                        if (!captured) return;

                        queueRequest({
                            method: captured.method,
                            url: captured.url,
                            body: parseCapturedBody(captured.body),
                        });
                    }
                });

                return () => clearInterval(interval);
            } catch (err) {
                logger.warn('[AfyaHero SW] Registration failed', { error: err });
                return;
            }
        };

        register();
    }, []);

    return null;
}

function parseCapturedBody(body?: string): unknown {
    if (!body) {
        return undefined;
    }

    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}
