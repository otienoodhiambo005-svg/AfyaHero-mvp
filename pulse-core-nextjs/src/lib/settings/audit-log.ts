/**
 * Settings Audit Log Module
 * 
 * Provides audit logging for settings changes, tracking who changed what
 * and when, with full history for compliance and debugging.
 */

import logger from '@/lib/logger';
import { settingsVersioning } from './versioning';

export interface AuditLogEntry {
  id: string;
  role: string;
  action: 'create' | 'update' | 'delete' | 'rollback' | 'import' | 'export';
  userId: string;
  timestamp: number;
  changes: {
    path: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  version?: number;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilter {
  role?: string;
  userId?: string;
  action?: AuditLogEntry['action'];
  since?: number;
  until?: number;
}

class SettingsAuditLog {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 1000;

  /**
   * Log a settings change
   */
  logChange(
    role: string,
    action: AuditLogEntry['action'],
    userId: string,
    changes: AuditLogEntry['changes'],
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: this.generateLogId(),
      role,
      action,
      userId,
      timestamp: Date.now(),
      changes,
      metadata,
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    logger.info(`Settings audit log: ${action}`, { role, userId, changes });
    return entry;
  }

  /**
   * Log a settings update with before/after comparison
   */
  logUpdate(
    role: string,
    userId: string,
    oldSettings: Record<string, any>,
    newSettings: Record<string, any>,
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    const changes = this.computeChanges(oldSettings, newSettings);
    return this.logChange(role, 'update', userId, changes, metadata);
  }

  /**
   * Log a settings rollback
   */
  logRollback(
    role: string,
    userId: string,
    fromVersion: number,
    toVersion: number,
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    const entry = this.logChange(role, 'rollback', userId, [], {
      ...metadata,
      fromVersion,
      toVersion,
    });
    entry.version = toVersion;
    return entry;
  }

  /**
   * Log a settings import
   */
  logImport(
    role: string,
    userId: string,
    importedSettings: Record<string, any>,
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    return this.logChange(role, 'import', userId, [], {
      ...metadata,
      settingsCount: Object.keys(importedSettings).length,
    });
  }

  /**
   * Log a settings export
   */
  logExport(
    role: string,
    userId: string,
    exportedSettings: Record<string, any>,
    metadata?: Record<string, unknown>
  ): AuditLogEntry {
    return this.logChange(role, 'export', userId, [], {
      ...metadata,
      settingsCount: Object.keys(exportedSettings).length,
    });
  }

  /**
   * Get audit logs with optional filtering
   */
  getLogs(filter?: AuditLogFilter): AuditLogEntry[] {
    let filtered = this.logs;

    if (filter) {
      if (filter.role) {
        filtered = filtered.filter(log => log.role === filter.role);
      }

      if (filter.userId) {
        filtered = filtered.filter(log => log.userId === filter.userId);
      }

      if (filter.action) {
        filtered = filtered.filter(log => log.action === filter.action);
      }

      const since = filter.since;
      if (typeof since === 'number') {
        filtered = filtered.filter(log => log.timestamp >= since);
      }

      const until = filter.until;
      if (typeof until === 'number') {
        filtered = filtered.filter(log => log.timestamp <= until);
      }
    }

    return filtered;
  }

  /**
   * Get audit logs for a specific role
   */
  getLogsForRole(role: string, since?: number): AuditLogEntry[] {
    return this.getLogs({ role, since });
  }

  /**
   * Get audit logs for a specific user
   */
  getLogsForUser(userId: string, since?: number): AuditLogEntry[] {
    return this.getLogs({ userId, since });
  }

  /**
   * Get recent audit logs
   */
  getRecentLogs(limit: number = 50): AuditLogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get audit log statistics
   */
  getStatistics(filter?: AuditLogFilter): {
    total: number;
    byAction: Record<string, number>;
    byRole: Record<string, number>;
    byUser: Record<string, number>;
    timeRange: { earliest: number; latest: number } | null;
  } {
    const logs = this.getLogs(filter);

    const byAction: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byRole[log.role] = (byRole[log.role] || 0) + 1;
      byUser[log.userId] = (byUser[log.userId] || 0) + 1;
    }

    const timeRange = logs.length > 0
      ? {
          earliest: logs[0].timestamp,
          latest: logs[logs.length - 1].timestamp,
        }
      : null;

    return {
      total: logs.length,
      byAction,
      byRole,
      byUser,
      timeRange,
    };
  }

  /**
   * Compute changes between two settings objects
   */
  private computeChanges(
    oldSettings: Record<string, any>,
    newSettings: Record<string, any>
  ): AuditLogEntry['changes'] {
    const changes: AuditLogEntry['changes'] = [];

    const allKeys = new Set([
      ...Object.keys(oldSettings),
      ...Object.keys(newSettings),
    ]);

    for (const key of allKeys) {
      const oldValue = oldSettings[key];
      const newValue = newSettings[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          path: key,
          oldValue,
          newValue,
        });
      }
    }

    return changes;
  }

  /**
   * Generate a unique log ID
   */
  private generateLogId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear audit logs
   */
  clear(): void {
    this.logs = [];
    logger.info('Settings audit logs cleared');
  }

  /**
   * Export audit logs as JSON
   */
  exportLogs(filter?: AuditLogFilter): string {
    const logs = this.getLogs(filter);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Import audit logs from JSON
   */
  importLogs(jsonString: string): { success: boolean; imported: number; errors: string[] } {
    const result = {
      success: false,
      imported: 0,
      errors: [] as string[],
    };

    try {
      const logs: AuditLogEntry[] = JSON.parse(jsonString);

      for (const log of logs) {
        this.logs.push(log);
        result.imported++;
      }

      // Keep only the most recent logs
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      result.success = true;
      logger.info('Audit logs imported', { imported: result.imported });
    } catch (error) {
      result.errors.push(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Failed to import audit logs', { error });
    }

    return result;
  }
}

// Singleton instance
export const settingsAuditLog = new SettingsAuditLog();

/**
 * React hook for settings audit logging
 */
export function useSettingsAuditLog(role: string) {
  return {
    logUpdate: (userId: string, oldSettings: Record<string, any>, newSettings: Record<string, any>) =>
      settingsAuditLog.logUpdate(role, userId, oldSettings, newSettings),
    logRollback: (userId: string, fromVersion: number, toVersion: number) =>
      settingsAuditLog.logRollback(role, userId, fromVersion, toVersion),
    logImport: (userId: string, importedSettings: Record<string, any>) =>
      settingsAuditLog.logImport(role, userId, importedSettings),
    logExport: (userId: string, exportedSettings: Record<string, any>) =>
      settingsAuditLog.logExport(role, userId, exportedSettings),
    getLogs: (filter?: AuditLogFilter) => settingsAuditLog.getLogs(filter),
    getStatistics: (filter?: AuditLogFilter) => settingsAuditLog.getStatistics(filter),
  };
}
