/**
 * Real-time Settings Sync Manager
 * 
 * Manages real-time synchronization of settings across multiple clients
 * using Server-Sent Events (SSE) for push notifications.
 */

import logger from '@/lib/logger';

export interface SettingsUpdate {
  role: string;
  settings: Record<string, any>;
  timestamp: number;
  userId: string;
}

export interface SyncSubscription {
  role: string;
  callback: (update: SettingsUpdate) => void;
  unsubscribe: () => void;
}

class SettingsSyncManager {
  private subscribers: Map<string, Set<(update: SettingsUpdate) => void>> = new Map();
  private eventSource: EventSource | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  /**
   * Subscribe to settings updates for a specific role
   */
  subscribe(role: string, callback: (update: SettingsUpdate) => void): SyncSubscription {
    if (!this.subscribers.has(role)) {
      this.subscribers.set(role, new Set());
    }
    this.subscribers.get(role)!.add(callback);

    // Start SSE connection if not already connected
    if (!this.eventSource) {
      this.connect();
    }

    return {
      role,
      callback,
      unsubscribe: () => this.unsubscribe(role, callback),
    };
  }

  /**
   * Unsubscribe from settings updates
   */
  unsubscribe(role: string, callback: (update: SettingsUpdate) => void): void {
    const roleSubscribers = this.subscribers.get(role);
    if (roleSubscribers) {
      roleSubscribers.delete(callback);
      if (roleSubscribers.size === 0) {
        this.subscribers.delete(role);
      }
    }

    // Disconnect if no subscribers
    if (this.subscribers.size === 0 && this.eventSource) {
      this.disconnect();
    }
  }

  /**
   * Connect to SSE endpoint for real-time updates
   */
  private connect(): void {
    try {
      this.eventSource = new EventSource('/api/settings/events');

      this.eventSource.onmessage = (event) => {
        try {
          const update: SettingsUpdate = JSON.parse(event.data);
          this.notifySubscribers(update);
        } catch (error) {
          logger.error('[SettingsSync] Failed to parse SSE message', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      this.eventSource.onerror = (error) => {
        logger.error('[SettingsSync] SSE connection error', { error });
        this.handleReconnect();
      };

      this.eventSource.onopen = () => {
        logger.info('[SettingsSync] SSE connection established');
        this.reconnectAttempts = 0;
      };

      logger.info('[SettingsSync] Connecting to SSE endpoint');
    } catch (error) {
      logger.error('[SettingsSync] Failed to establish SSE connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      logger.info('[SettingsSync] Disconnected from SSE endpoint');
    }
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[SettingsSync] Max reconnection attempts reached');
      this.disconnect();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info(`[SettingsSync] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }

  /**
   * Notify all subscribers of a settings update
   */
  private notifySubscribers(update: SettingsUpdate): void {
    const roleSubscribers = this.subscribers.get(update.role);
    if (roleSubscribers) {
      roleSubscribers.forEach((callback) => {
        try {
          callback(update);
        } catch (error) {
          logger.error('[SettingsSync] Error in subscriber callback', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }
  }

  /**
   * Broadcast a settings update to all connected clients
   * (This would be called by the server when settings change)
   */
  broadcast(update: SettingsUpdate): void {
    // In a real implementation, this would be called by the server
    // For now, we'll just log it for demonstration
    logger.info('[SettingsSync] Broadcasting settings update', { update });
  }
}

// Singleton instance
export const settingsSyncManager = new SettingsSyncManager();

/**
 * React hook for subscribing to real-time settings updates
 */
export function useSettingsSync(role: string, callback: (update: SettingsUpdate) => void) {
  // This would be a React hook in a real implementation
  // For now, we'll just use the manager directly
  return settingsSyncManager.subscribe(role, callback);
}
