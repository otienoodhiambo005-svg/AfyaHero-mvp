/**
 * Settings Validation Module
 * 
 * Provides validation rules for settings to ensure data integrity
 * and prevent invalid configurations.
 */

import logger from '@/lib/logger';

export interface ValidationRule {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'enum';
  required: boolean;
  enumValues?: string[];
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  value: unknown;
}

class SettingsValidator {
  private schemas: Map<string, ValidationRule[]> = new Map();

  /**
   * Register a validation schema for a role
   */
  registerSchema(role: string, rules: ValidationRule[]): void {
    this.schemas.set(role, rules);
    logger.info(`Validation schema registered for role: ${role}`);
  }

  /**
   * Validate settings against registered schema
   */
  validate(role: string, settings: Record<string, unknown>): ValidationResult {
    const rules = this.schemas.get(role);
    const errors: ValidationError[] = [];

    if (!rules) {
      logger.warn(`No validation schema found for role: ${role}`);
      return { valid: true, errors: [] };
    }

    for (const rule of rules) {
      const value = this.getNestedValue(settings, rule.path);
      
      // Check required
      if (rule.required && (value === undefined || value === null)) {
        errors.push({
          path: rule.path,
          message: `Field is required`,
          value,
        });
        continue;
      }

      // Skip validation if not required and value is undefined/null
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      const typeError = this.validateType(rule, value);
      if (typeError) {
        errors.push({
          path: rule.path,
          message: typeError,
          value,
        });
        continue;
      }

      // Range validation
      const rangeError = this.validateRange(rule, value);
      if (rangeError) {
        errors.push({
          path: rule.path,
          message: rangeError,
          value,
        });
        continue;
      }

      // Pattern validation
      const patternError = this.validatePattern(rule, value);
      if (patternError) {
        errors.push({
          path: rule.path,
          message: patternError,
          value,
        });
        continue;
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          errors.push({
            path: rule.path,
            message: typeof customResult === 'string' ? customResult : 'Validation failed',
            value,
          });
        }
      }
    }

    const valid = errors.length === 0;
    if (!valid) {
      logger.warn(`Settings validation failed for role: ${role}`, { errors });
    }

    return { valid, errors };
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = obj;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Validate value type
   */
  private validateType(rule: ValidationRule, value: unknown): string | null {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Expected string, got ${typeof value}`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `Expected number, got ${typeof value}`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Expected boolean, got ${typeof value}`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `Expected array, got ${typeof value}`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `Expected object, got ${typeof value}`;
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return `Expected valid email address`;
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !/^https?:\/\/.+/.test(value)) {
          return `Expected valid URL`;
        }
        break;
      case 'enum':
        if (typeof value !== 'string') {
          return `Expected string, got ${typeof value}`;
        }
        if (rule.enumValues && !rule.enumValues.includes(value)) {
          return `Expected one of: ${rule.enumValues.join(', ')}`;
        }
        break;
    }

    return null;
  }

  /**
   * Validate value range
   */
  private validateRange(rule: ValidationRule, value: unknown): string | null {
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return `Value must be at least ${rule.min}`;
      }

      if (rule.max !== undefined && value > rule.max) {
        return `Value must be at most ${rule.max}`;
      }
    }

    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.min !== undefined && value.length < rule.min) {
        return `Length must be at least ${rule.min}`;
      }

      if (rule.max !== undefined && value.length > rule.max) {
        return `Length must be at most ${rule.max}`;
      }
    }

    return null;
  }

  /**
   * Validate value pattern
   */
  private validatePattern(rule: ValidationRule, value: unknown): string | null {
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        return `Value does not match required pattern`;
      }
    }

    return null;
  }

  /**
   * Get all registered schemas
   */
  getSchemas(): Map<string, ValidationRule[]> {
    return this.schemas;
  }

  /**
   * Remove a schema
   */
  removeSchema(role: string): void {
    this.schemas.delete(role);
    logger.info(`Validation schema removed for role: ${role}`);
  }

  /**
   * Clear all schemas
   */
  clear(): void {
    this.schemas.clear();
    logger.info('All validation schemas cleared');
  }
}

// Singleton instance
export const settingsValidator = new SettingsValidator();

/**
 * Setup default validation schemas
 */
export function setupDefaultValidationSchemas(): void {
  // Doctor settings schema
  settingsValidator.registerSchema('doctor', [
    {
      path: 'profile.displayName',
      type: 'string',
      required: false,
      min: 1,
      max: 100,
    },
    {
      path: 'profile.email',
      type: 'email',
      required: false,
    },
    {
      path: 'profile.specialty',
      type: 'string',
      required: false,
    },
    {
      path: 'notifications.email',
      type: 'boolean',
      required: true,
    },
    {
      path: 'notifications.inApp',
      type: 'boolean',
      required: true,
    },
    {
      path: 'clinical.defaultView',
      type: 'enum',
      required: true,
      enumValues: ['list', 'grid', 'calendar'],
    },
  ]);

  // Pharmacy settings schema
  settingsValidator.registerSchema('pharmacy', [
    {
      path: 'dispensing.defaultQuantity',
      type: 'number',
      required: true,
      min: 1,
      max: 1000,
    },
    {
      path: 'dispensing.enableInteractionChecking',
      type: 'boolean',
      required: true,
    },
    {
      path: 'inventory.lowStockThreshold',
      type: 'number',
      required: true,
      min: 0,
      max: 1000,
    },
    {
      path: 'inventory.expiryWarningDays',
      type: 'number',
      required: true,
      min: 1,
      max: 365,
    },
  ]);

  // Laboratory settings schema
  settingsValidator.registerSchema('laboratory', [
    {
      path: 'testing.enableReflexTesting',
      type: 'boolean',
      required: true,
    },
    {
      path: 'testing.criticalValueAlerts',
      type: 'boolean',
      required: true,
    },
    {
      path: 'reporting.format',
      type: 'enum',
      required: true,
      enumValues: ['pdf', 'html', 'json'],
    },
  ]);

  // Admin settings schema
  settingsValidator.registerSchema('admin', [
    {
      path: 'facility.name',
      type: 'string',
      required: false,
      min: 1,
      max: 200,
    },
    {
      path: 'staffing.requireApprovalForNewUsers',
      type: 'boolean',
      required: true,
    },
    {
      path: 'staffing.sessionTimeout',
      type: 'number',
      required: true,
      min: 5,
      max: 1440,
    },
  ]);

  // Superadmin settings schema
  settingsValidator.registerSchema('superadmin', [
    {
      path: 'system.maintenanceMode',
      type: 'boolean',
      required: true,
    },
    {
      path: 'ai.defaultProvider',
      type: 'enum',
      required: true,
      enumValues: ['huggingface', 'groq', 'gemini', 'openai', 'claude'],
    },
    {
      path: 'compliance.dataRetentionDays',
      type: 'number',
      required: true,
      min: 30,
      max: 2555,
    },
  ]);

  // Reception settings schema
  settingsValidator.registerSchema('reception', [
    {
      path: 'checkIn.autoAssignQueue',
      type: 'boolean',
      required: true,
    },
    {
      path: 'checkIn.requirePatientId',
      type: 'boolean',
      required: true,
    },
    {
      path: 'appointments.defaultDuration',
      type: 'number',
      required: true,
      min: 5,
      max: 180,
    },
    {
      path: 'appointments.allowOverbooking',
      type: 'boolean',
      required: true,
    },
  ]);
}

// Initialize default schemas on module load
setupDefaultValidationSchemas();

