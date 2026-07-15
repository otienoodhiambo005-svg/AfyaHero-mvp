/**
 * Settings Conflict Resolution
 * 
 * Handles concurrent updates to settings using last-write-wins
 * with timestamp comparison and conflict detection.
 */

import logger from '@/lib/logger';

export interface SettingsWithTimestamp {
  settings: Record<string, any>;
  timestamp: number;
  userId: string;
}

export interface ConflictResolution {
  resolved: boolean;
  winner: 'local' | 'remote';
  mergedSettings?: Record<string, any>;
  conflictDetected: boolean;
}

/**
 * Resolve conflicts between local and remote settings using last-write-wins
 */
export function resolveSettingsConflict(
  local: SettingsWithTimestamp,
  remote: SettingsWithTimestamp
): ConflictResolution {
  // If timestamps are the same (very rare), prefer local
  if (local.timestamp === remote.timestamp) {
    return {
      resolved: true,
      winner: 'local',
      conflictDetected: false,
    };
  }

  // Last-write-wins: the most recent update wins
  const winner = local.timestamp > remote.timestamp ? 'local' : 'remote';
  
  // Check if there's an actual conflict (both have overlapping changes)
  const conflictDetected = detectConflict(local.settings, remote.settings);

  if (conflictDetected) {
    logger.warn('[SettingsConflict] Conflict detected', {
      localTimestamp: local.timestamp,
      remoteTimestamp: remote.timestamp,
      winner,
    });
  }

  return {
    resolved: true,
    winner,
    conflictDetected,
    mergedSettings: winner === 'local' ? local.settings : remote.settings,
  };
}

/**
 * Detect if two settings objects have conflicting changes
 */
function detectConflict(local: Record<string, any>, remote: Record<string, any>): boolean {
  const localKeys = Object.keys(local);
  const remoteKeys = Object.keys(remote);
  
  // Check for overlapping keys with different values
  for (const key of localKeys) {
    if (remoteKeys.includes(key)) {
      if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Merge settings with conflict resolution
 * Uses a recursive merge strategy with last-write-wins for conflicts
 */
export function mergeSettings(
  base: Record<string, any>,
  local: Record<string, any>,
  remote: Record<string, any>
): Record<string, any> {
  const result = { ...base };
  
  // Merge local changes
  deepMerge(result, local);
  
  // Merge remote changes (overwrites local for conflicts)
  deepMerge(result, remote);
  
  return result;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): void {
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = { ...source[key] };
      } else {
        deepMerge(target[key], source[key]);
      }
    } else {
      target[key] = source[key];
    }
  }
}

/**
 * Generate a timestamp for settings updates
 */
export function generateTimestamp(): number {
  return Date.now();
}

/**
 * Validate settings structure
 */
export function validateSettings(settings: Record<string, any>, schema: Record<string, any>): boolean {
  try {
    // Basic validation - check that required keys exist
    for (const key in schema) {
      if (schema[key].required && !(key in settings)) {
        return false;
      }
    }
    return true;
  } catch (error) {
    logger.error('[ConflictResolution] Validation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Create a settings snapshot with timestamp
 */
export function createSettingsSnapshot(
  settings: Record<string, any>,
  userId: string
): SettingsWithTimestamp {
  return {
    settings: JSON.parse(JSON.stringify(settings)), // Deep clone
    timestamp: generateTimestamp(),
    userId,
  };
}
