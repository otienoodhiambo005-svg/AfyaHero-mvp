/**
 * Settings Import/Export Module
 * 
 * Provides functionality to import and export settings as JSON,
 * enabling users to backup, restore, and share their settings configurations.
 */

import logger from '@/lib/logger';

export interface SettingsExport {
  version: string;
  exportedAt: string;
  settings: {
    doctor?: Record<string, unknown>;
    pharmacy?: Record<string, unknown>;
    laboratory?: Record<string, unknown>;
    admin?: Record<string, unknown>;
    superadmin?: Record<string, unknown>;
    reception?: Record<string, unknown>;
  };
  metadata?: {
    userId?: string;
    hospitalId?: string;
    environment?: string;
  };
}

export interface ImportResult {
  success: boolean;
  imported: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Export settings to JSON
 */
export function exportSettings(settings: Record<string, any>, metadata?: Record<string, string>): string {
  const exportData: SettingsExport = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings,
    metadata,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import settings from JSON
 */
export function importSettings(
  jsonString: string,
  currentSettings: Record<string, any>
): ImportResult {
  const result: ImportResult = {
    success: false,
    imported: [],
    skipped: [],
    errors: [],
  };

  try {
    const imported: SettingsExport = JSON.parse(jsonString);

    // Validate version
    if (!imported.version) {
      result.errors.push('Missing version in export');
      return result;
    }

    // Import each settings type
    const roles = ['doctor', 'pharmacy', 'laboratory', 'admin', 'superadmin', 'reception'] as const;

    for (const role of roles) {
      if (imported.settings[role]) {
        // Merge with current settings
        currentSettings[role] = {
          ...currentSettings[role],
          ...imported.settings[role],
        };
        result.imported.push(role);
      } else {
        result.skipped.push(role);
      }
    }

    result.success = true;
    logger.info('Settings imported successfully', { result });
  } catch (error) {
    result.errors.push(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('Settings import failed', { error, result });
  }

  return result;
}

/**
 * Validate settings export format
 */
export function validateExport(jsonString: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const imported: SettingsExport = JSON.parse(jsonString);

    if (!imported.version) {
      errors.push('Missing version');
    }

    if (!imported.exportedAt) {
      errors.push('Missing exportedAt timestamp');
    }

    if (!imported.settings || typeof imported.settings !== 'object') {
      errors.push('Missing or invalid settings object');
    }

    if (imported.settings && typeof imported.settings === 'object') {
      const validRoles = ['doctor', 'pharmacy', 'laboratory', 'admin', 'superadmin', 'reception'];
      for (const key in imported.settings) {
        if (!validRoles.includes(key as any)) {
          errors.push(`Invalid settings role: ${key}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, errors };
  }
}

/**
 * Download settings as JSON file
 */
export function downloadSettings(settings: Record<string, any>, filename: string = 'afyahero-settings.json'): void {
  const jsonString = exportSettings(settings);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  logger.info('Settings downloaded', { filename });
}

/**
 * Read settings file from user input
 */
export async function readSettingsFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        resolve(content);
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('File reading error'));
    };

    reader.readAsText(file);
  });
}

/**
 * Create settings template
 */
export function createSettingsTemplate(role: string): string {
  const templates: Record<string, any> = {
    doctor: {
      profile: {
        displayName: '',
        email: '',
        specialty: '',
      },
      notifications: {
        email: true,
        inApp: true,
        sms: false,
      },
      clinical: {
        defaultView: 'list',
        showVitals: true,
        showLabs: true,
      },
    },
    pharmacy: {
      profile: {
        displayName: '',
        email: '',
      },
      dispensing: {
        defaultQuantity: 30,
        allowSubstitution: true,
        enableInteractionChecking: true,
      },
      inventory: {
        lowStockThreshold: 10,
        expiryWarningDays: 30,
      },
    },
    laboratory: {
      profile: {
        displayName: '',
        email: '',
      },
      testing: {
        defaultPanels: [],
        enableReflexTesting: true,
        criticalValueAlerts: true,
      },
      reporting: {
        format: 'pdf',
        includeReferenceRanges: true,
      },
    },
    admin: {
      profile: {
        displayName: '',
        email: '',
      },
      facility: {
        name: '',
        address: '',
        phone: '',
        email: '',
      },
      staffing: {
        requireApprovalForNewUsers: true,
        sessionTimeout: 30,
      },
    },
    superadmin: {
      profile: {
        displayName: '',
        email: '',
      },
      system: {
        maintenanceMode: false,
        apiVersion: '2.0.0',
      },
      ai: {
        defaultProvider: 'gemini',
        enableBiasMonitoring: true,
      },
    },
    reception: {
      profile: {
        displayName: '',
        email: '',
      },
      checkIn: {
        autoAssignQueue: false,
        requirePatientId: true,
        defaultQueue: 'general',
      },
      appointments: {
        defaultDuration: 30,
        allowOverbooking: false,
        showCalendar: true,
      },
    },
  };

  const template = templates[role];
  if (!template) {
    throw new Error(`Unknown role: ${role}`);
  }

  return exportSettings({ [role]: template });
}
