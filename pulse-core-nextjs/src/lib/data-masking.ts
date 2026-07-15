/**
 * Data Masking Utility for AI Prompts
 * 
 * Masks sensitive patient data before sending to external AI providers
 * to ensure HIPAA/GDPR compliance and patient privacy.
 */

import inputValidationModule from '@/lib/input-validation';
const { SENSITIVE_FIELDS } = inputValidationModule;

interface MaskingOptions {
  maskNames?: boolean;
  maskAddresses?: boolean;
  maskPhoneNumbers?: boolean;
  maskEmails?: boolean;
  maskIds?: boolean;
  customPatterns?: Array<{ pattern: RegExp; replacement: string }>;
}

interface MaskedData {
  original: unknown;
  masked: unknown;
  maskCount: number;
  maskedFields: string[];
}

/**
 * Mask sensitive data in an object or string
 */
export function maskSensitiveData(
  data: unknown,
  options: MaskingOptions = {}
): MaskedData {
  const {
    maskNames = true,
    maskAddresses = true,
    maskPhoneNumbers = true,
    maskEmails = true,
    maskIds = true,
    customPatterns = [],
  } = options;

  let maskCount = 0;
  const maskedFields: string[] = [];

  function maskValue(value: unknown, path: string = ''): unknown {
    if (typeof value === 'string') {
      let masked = value;

      // Mask names (simple pattern)
      if (maskNames) {
        masked = masked.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, (match) => {
          maskCount++;
          maskedFields.push(path || 'name');
          return match.split(' ').map(part => part[0] + '*'.repeat(part.length - 1)).join(' ');
        });
      }

      // Mask phone numbers
      if (maskPhoneNumbers) {
        masked = masked.replace(/(\+254|0)?[71]\d{8}/g, (match) => {
          maskCount++;
          maskedFields.push(path || 'phone');
          return match.substring(0, 4) + '****' + match.substring(match.length - 2);
        });
      }

      // Mask emails
      if (maskEmails) {
        masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
          maskCount++;
          maskedFields.push(path || 'email');
          const [local, domain] = match.split('@');
          return local[0] + '***@' + domain;
        });
      }

      // Mask IDs (UUIDs, national IDs, etc.)
      if (maskIds) {
        masked = masked.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, (match) => {
          maskCount++;
          maskedFields.push(path || 'uuid');
          return match.substring(0, 8) + '****';
        });
        masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, (match) => {
          maskCount++;
          maskedFields.push(path || 'ssn');
          return '***-**-****';
        });
      }

      // Mask addresses
      if (maskAddresses) {
        masked = masked.replace(/\d+\s+[A-Za-z]+\s+[A-Za-z]+/g, (match) => {
          maskCount++;
          maskedFields.push(path || 'address');
          return '*** ADDRESS ***';
        });
      }

      // Apply custom patterns
      for (const { pattern, replacement } of customPatterns) {
        const before = masked;
        masked = masked.replace(pattern, replacement);
        if (masked !== before) {
          maskCount++;
          maskedFields.push(path || 'custom');
        }
      }

      return masked;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => maskValue(item, path ? `${path}[${index}]` : `[${index}]`));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        // Check if this is a sensitive field
        if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
          maskCount++;
          maskedFields.push(path ? `${path}.${key}` : key);
          result[key] = '[REDACTED]';
        } else {
          result[key] = maskValue(val, path ? `${path}.${key}` : key);
        }
      }
      return result;
    }

    return value;
  }

  const masked = maskValue(data);

  return {
    original: data,
    masked,
    maskCount,
    maskedFields,
  };
}

/**
 * Mask patient data specifically for AI prompts
 */
export function maskPatientDataForAI(patientData: Record<string, unknown>): {
  maskedData: Record<string, unknown>;
  maskSummary: string;
} {
  const result = maskSensitiveData(patientData, {
    maskNames: true,
    maskPhoneNumbers: true,
    maskEmails: true,
    maskIds: true,
    maskAddresses: true,
  });

  const maskSummary = `Masked ${result.maskCount} instances of sensitive data in fields: ${result.maskedFields.join(', ')}`;

  return {
    maskedData: result.masked as Record<string, unknown>,
    maskSummary,
  };
}

/**
 * Create a safe AI prompt with masked data
 */
export function createSafePrompt(
  template: string,
  data: Record<string, unknown>
): { prompt: string; maskSummary: string } {
  const { maskedData, maskSummary } = maskPatientDataForAI(data);

  // Replace placeholders in template
  let prompt = template;
  for (const [key, value] of Object.entries(maskedData)) {
    const placeholder = `{{${key}}}`;
    prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
  }

  return {
    prompt,
    maskSummary,
  };
}

/**
 * Reversible masking for internal use (can be unmasked with a key)
 * Note: This is a simplified version. In production, use proper encryption.
 */
export function reversibleMask(value: string, key: string): string {
  // Simple XOR-based reversible masking
  // In production, use AES encryption with proper key management
  let result = '';
  for (let i = 0; i < value.length; i++) {
    result += String.fromCharCode(value.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

/**
 * Unmask reversibly masked data
 */
export function reversibleUnmask(masked: string, key: string): string {
  const decoded = Buffer.from(masked, 'base64').toString();
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}
