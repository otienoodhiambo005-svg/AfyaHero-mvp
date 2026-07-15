/**
 * Settings Versioning Module
 * 
 * Provides versioning and history tracking for settings changes,
 * enabling rollback to previous versions and audit trails.
 */

import logger from '@/lib/logger';

export interface SettingsVersion {
  id: string;
  role: string;
  settings: Record<string, any>;
  timestamp: number;
  userId: string;
  changeDescription?: string;
  version: number;
}

export interface VersionHistory {
  role: string;
  versions: SettingsVersion[];
  currentVersion: number;
}

class SettingsVersioning {
  private histories: Map<string, VersionHistory> = new Map();
  private maxVersionsPerRole: number = 50;

  /**
   * Create a new version of settings
   */
  createVersion(
    role: string,
    settings: Record<string, any>,
    userId: string,
    changeDescription?: string
  ): SettingsVersion {
    const history = this.getOrCreateHistory(role);
    const version = history.currentVersion + 1;

    const newVersion: SettingsVersion = {
      id: this.generateVersionId(),
      role,
      settings: JSON.parse(JSON.stringify(settings)), // Deep clone
      timestamp: Date.now(),
      userId,
      changeDescription,
      version,
    };

    history.versions.push(newVersion);
    history.currentVersion = version;

    // Keep only the most recent versions
    if (history.versions.length > this.maxVersionsPerRole) {
      history.versions.shift();
    }

    logger.info(`Settings version created`, { role, version, changeDescription });
    return newVersion;
  }

  /**
   * Get the current version of settings for a role
   */
  getCurrentVersion(role: string): SettingsVersion | null {
    const history = this.histories.get(role);
    if (!history || history.versions.length === 0) {
      return null;
    }

    const currentVersion = history.versions[history.versions.length - 1];
    return currentVersion;
  }

  /**
   * Get a specific version of settings
   */
  getVersion(role: string, versionNumber: number): SettingsVersion | null {
    const history = this.histories.get(role);
    if (!history) {
      return null;
    }

    return history.versions.find(v => v.version === versionNumber) || null;
  }

  /**
   * Get all versions for a role
   */
  getVersionHistory(role: string): SettingsVersion[] {
    const history = this.histories.get(role);
    return history ? history.versions : [];
  }

  /**
   * Rollback to a specific version
   */
  rollbackToVersion(role: string, versionNumber: number): SettingsVersion | null {
    const history = this.histories.get(role);
    if (!history) {
      logger.error(`No history found for role: ${role}`);
      return null;
    }

    const targetVersion = history.versions.find(v => v.version === versionNumber);
    if (!targetVersion) {
      logger.error(`Version ${versionNumber} not found for role: ${role}`);
      return null;
    }

    // Create a new version with the rolled-back settings
    const newVersion = this.createVersion(
      role,
      targetVersion.settings,
      'system',
      `Rollback to version ${versionNumber}`
    );

    logger.info(`Settings rolled back`, { role, toVersion: versionNumber, newVersion: newVersion.version });
    return newVersion;
  }

  /**
   * Get version history for all roles
   */
  getAllHistories(): Map<string, VersionHistory> {
    return this.histories;
  }

  /**
   * Clear version history for a role
   */
  clearHistory(role: string): void {
    this.histories.delete(role);
    logger.info(`Version history cleared for role: ${role}`);
  }

  /**
   * Clear all version histories
   */
  clearAllHistories(): void {
    this.histories.clear();
    logger.info('All version histories cleared');
  }

  /**
   * Get or create history for a role
   */
  private getOrCreateHistory(role: string): VersionHistory {
    if (!this.histories.has(role)) {
      this.histories.set(role, {
        role,
        versions: [],
        currentVersion: 0,
      });
    }
    return this.histories.get(role)!;
  }

  /**
   * Generate a unique version ID
   */
  private generateVersionId(): string {
    return `ver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Compare two versions to see what changed
   */
  compareVersions(version1: SettingsVersion, version2: SettingsVersion): {
    added: string[];
    removed: string[];
    modified: string[];
  } {
    const keys1 = new Set(Object.keys(version1.settings));
    const keys2 = new Set(Object.keys(version2.settings));

    const added: string[] = [...keys2].filter((k) => !keys1.has(k));
    const removed: string[] = [...keys1].filter((k) => !keys2.has(k));
    const modified: string[] = [...keys1].filter((k) => 
      keys2.has(k) && JSON.stringify(version1.settings[k]) !== JSON.stringify(version2.settings[k])
    );

    return { added, removed, modified };
  }

  /**
   * Get diff between versions
   */
  getDiff(role: string, fromVersion: number, toVersion: number): {
    from: SettingsVersion | null;
    to: SettingsVersion | null;
    changes: {
      added: string[];
      removed: string[];
      modified: string[];
    } | null;
  } | null {
    const from = this.getVersion(role, fromVersion);
    const to = this.getVersion(role, toVersion);

    if (!from || !to) {
      return null;
    }

    return {
      from,
      to,
      changes: this.compareVersions(from, to),
    };
  }
}

// Singleton instance
export const settingsVersioning = new SettingsVersioning();

/**
 * React hook for settings versioning
 */
export function useSettingsVersioning(role: string) {
  return {
    createVersion: (settings: Record<string, any>, userId: string, description?: string) =>
      settingsVersioning.createVersion(role, settings, userId, description),
    getCurrentVersion: () => settingsVersioning.getCurrentVersion(role),
    getVersionHistory: () => settingsVersioning.getVersionHistory(role),
    rollbackToVersion: (versionNumber: number) =>
      settingsVersioning.rollbackToVersion(role, versionNumber),
    compareVersions: (v1: number, v2: number) => {
      const version1 = settingsVersioning.getVersion(role, v1);
      const version2 = settingsVersioning.getVersion(role, v2);
      if (!version1 || !version2) return null;
      return settingsVersioning.compareVersions(version1, version2);
    },
  };
}
