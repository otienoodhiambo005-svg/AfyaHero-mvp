/**
 * Input Validation Utility for AfyaHero Health
 * 
 * Provides comprehensive input validation and sanitization:
 * - XSS prevention
 * - SQL injection prevention
 * - HTML sanitization
 * - File upload validation
 * - API request validation
 * - Zod schema validation helpers
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  sanitized?: T;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  allowedTags?: string[];
}

// ─── Dangerous Patterns ───────────────────────────────────────────────────────

/**
 * Patterns that indicate potential XSS attacks
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
  /data\s*:[^,]*;base64/gi,
];

/**
 * Patterns that indicate potential SQL injection
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
  /(--|;|\/\*|\*\/)/g,
  /(\b(UNION|JOIN|WHERE|FROM|INTO|VALUES|SET)\b)/gi,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
  /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/gi,
  /(['"])\s*(OR|AND)\s*\1/gi,
];

/**
 * Sensitive fields that should never be logged or exposed
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'credit_card',
  'ssn',
  'nationalId',
  'national_id',
  'cvv',
];

// ─── XSS Prevention ───────────────────────────────────────────────────────────

/**
 * Detect potential XSS attacks in a string
 */
export function detectXSS(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize a string by removing potential XSS content
 */
export function sanitizeXSS(input: string, options: SanitizationOptions = {}): string {
  if (typeof input !== 'string') return String(input);
  
  let sanitized = input;
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=[^\s>]+/gi, '');
  
  // Remove potentially dangerous tags if not explicitly allowed
  const defaultDisallowedTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
  const disallowedTags = options.allowedTags
    ? defaultDisallowedTags.filter((tag) => !options.allowedTags!.includes(tag))
    : defaultDisallowedTags;
  
  disallowedTags.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>|<\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  // Remove base64 data URIs (potential XSS vector)
  sanitized = sanitized.replace(/data\s*:[^,]*;base64/gi, '');
  
  // Apply length limit
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  return sanitized;
}

// ─── SQL Injection Prevention ─────────────────────────────────────────────────

/**
 * Detect potential SQL injection patterns in a string
 */
export function detectSQLInjection(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Escape special characters for safe SQL usage
 * Note: This is a fallback - always use parameterized queries with Prisma
 */
export function escapeSQLValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  
  // Escape single quotes and backslashes
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/"/g, '\\"')
    .replace(/;/g, '')
    .replace(/--/g, '');
}

// ─── HTML Sanitization ────────────────────────────────────────────────────────

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return String(input);
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize HTML, optionally allowing specific tags
 */
export function sanitizeHtml(input: string, allowedTags: string[] = []): string {
  if (typeof input !== 'string') return String(input);
  
  let sanitized = input;
  
  if (allowedTags.length === 0) {
    // Strip all HTML
    return stripHtml(sanitized);
  }
  
  // Remove all tags except allowed ones
  const allTags = sanitized.match(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi) || [];
  allTags.forEach(tag => {
    const tagName = tag.match(/<\/?([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
    if (tagName && !allowedTags.includes(tagName)) {
      sanitized = sanitized.replace(tag, '');
    }
  });
  
  return sanitized;
}

// ─── Input Validation Helpers ─────────────────────────────────────────────────

/**
 * Validate and sanitize a string input
 */
export function validateString(
  input: unknown,
  options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
    sanitizeXss?: boolean;
  } = {}
): ValidationResult<string> {
  const {
    minLength = 0,
    maxLength = 10000,
    pattern,
    allowEmpty = false,
    sanitizeXss = true,
  } = options;
  
  const errors: ValidationError[] = [];
  
  // Type check
  if (typeof input !== 'string') {
    return {
      success: false,
      errors: [{ field: 'input', message: 'Must be a string', code: 'INVALID_TYPE' }],
    };
  }
  
  let value = input;
  
  // Check empty
  if (!allowEmpty && value.trim().length === 0) {
    errors.push({ field: 'input', message: 'Cannot be empty', code: 'EMPTY_VALUE' });
  }
  
  // Length validation
  if (value.length < minLength) {
    errors.push({
      field: 'input',
      message: `Must be at least ${minLength} characters`,
      code: 'TOO_SHORT',
    });
  }
  
  if (value.length > maxLength) {
    errors.push({
      field: 'input',
      message: `Must be at most ${maxLength} characters`,
      code: 'TOO_LONG',
    });
  }
  
  // Pattern validation
  if (pattern && !pattern.test(value)) {
    errors.push({
      field: 'input',
      message: 'Does not match required pattern',
      code: 'INVALID_PATTERN',
    });
  }
  
  // XSS detection
  if (detectXSS(value)) {
    errors.push({
      field: 'input',
      message: 'Contains potentially dangerous content',
      code: 'XSS_DETECTED',
    });
  }
  
  // SQL injection detection
  if (detectSQLInjection(value)) {
    errors.push({
      field: 'input',
      message: 'Contains potentially dangerous SQL patterns',
      code: 'SQL_INJECTION_DETECTED',
    });
  }
  
  // Sanitize if requested
  if (sanitizeXss) {
    value = sanitizeXSS(value, { maxLength });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, data: value, sanitized: value };
}

/**
 * Validate an email address
 */
export function validateEmail(email: unknown): ValidationResult<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return validateString(email, {
    maxLength: 255,
    pattern: emailRegex,
    allowEmpty: false,
  });
}

/**
 * Validate a phone number (Kenyan format)
 */
export function validatePhone(phone: unknown): ValidationResult<string> {
  // Kenyan phone formats: +254XXXXXXXXX, 07XXXXXXXX, 01XXXXXXXX
  const phoneRegex = /^(\+254|0)[71]\d{8}$/;
  return validateString(phone, {
    pattern: phoneRegex,
    allowEmpty: false,
  });
}

/**
 * Validate a UUID
 */
export function validateUUID(uuid: unknown): ValidationResult<string> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return validateString(uuid, {
    pattern: uuidRegex,
    allowEmpty: false,
  });
}

// ─── File Upload Validation ───────────────────────────────────────────────────

export interface FileValidationOptions {
  maxFileSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export interface ValidatedFile {
  name: string;
  size: number;
  type: string;
  sanitized: string;
}

/**
 * Validate file upload metadata
 */
export function validateFile(
  fileName: string,
  fileSize: number,
  mimeType: string,
  options: FileValidationOptions = {}
): ValidationResult<ValidatedFile> {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = [],
    allowedExtensions = [],
  } = options;
  
  const errors: ValidationError[] = [];
  
  // File size validation
  if (fileSize > maxFileSize) {
    errors.push({
      field: 'file',
      message: `File size exceeds maximum of ${maxFileSize} bytes`,
      code: 'FILE_TOO_LARGE',
    });
  }
  
  // MIME type validation
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
    errors.push({
      field: 'file',
      message: `File type ${mimeType} is not allowed`,
      code: 'INVALID_FILE_TYPE',
    });
  }
  
  // Extension validation
  if (allowedExtensions.length > 0) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push({
        field: 'file',
        message: `File extension .${extension} is not allowed`,
        code: 'INVALID_EXTENSION',
      });
    }
  }
  
  // Sanitize filename
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: { name: sanitized, size: fileSize, type: mimeType, sanitized },
    sanitized: { name: sanitized, size: fileSize, type: mimeType, sanitized },
  };
}

// ─── Request Body Validation ──────────────────────────────────────────────────

/**
 * Recursively sanitize an object, removing sensitive fields and XSS content
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    removeSensitive?: boolean;
    sanitizeStrings?: boolean;
    maxDepth?: number;
  } = {}
): T {
  const {
    removeSensitive = true,
    sanitizeStrings = true,
    maxDepth = 10,
  } = options;
  
  function sanitize(value: unknown, depth: number): unknown {
    if (depth > maxDepth) return '[MAX_DEPTH_EXCEEDED]';
    
    if (typeof value === 'string') {
      if (sanitizeStrings) {
        return sanitizeXSS(value);
      }
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => sanitize(item, depth + 1));
    }
    
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (removeSensitive && SENSITIVE_FIELDS.includes(key.toLowerCase())) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(val, depth + 1);
        }
      }
      return result;
    }
    
    return value;
  }
  
  return sanitize(obj, 0) as T;
}

/**
 * Validate request body against a Zod schema with additional security checks
 */
export function validateRequestBody<T extends z.ZodType>(
  body: unknown,
  schema: T,
  options: {
    sanitize?: boolean;
    strict?: boolean;
  } = {}
): ValidationResult<z.infer<T>> {
  const { sanitize: shouldSanitize = true, strict: _strict = true } = options;
  
  const errors: ValidationError[] = [];
  
  // Check for XSS in string fields before validation
  if (typeof body === 'object' && body !== null) {
    const checkForXSS = (obj: unknown, path: string = ''): void => {
      if (typeof obj === 'string') {
        if (detectXSS(obj)) {
          errors.push({
            field: path || 'body',
            message: 'Contains potentially dangerous content',
            code: 'XSS_DETECTED',
          });
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          checkForXSS(value, path ? `${path}.${key}` : key);
        }
      }
    };
    checkForXSS(body);
  }
  
  // Sanitize if requested
  let processedBody = body;
  if (shouldSanitize && typeof body === 'object' && body !== null) {
    processedBody = sanitizeObject(body as Record<string, unknown>);
  }
  
  // Validate with Zod
  const result = schema.safeParse(processedBody);
  
  if (!result.success) {
     
    (result.error as any).issues.forEach((err: { path: PropertyKey[]; message: string; code: string }) => {
      errors.push({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      });
    });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    data: result.data as z.infer<T>,
    sanitized: result.data as z.infer<T>,
  };
}

// ─── Zod Schema Helpers ───────────────────────────────────────────────────────

/**
 * Create a Zod string schema with built-in XSS sanitization
 */
export function xssSafeString(options?: {
  min?: number;
  max?: number;
  pattern?: RegExp;
   
}): any {
  return z.string()
    .min(options?.min ?? 0)
    .max(options?.max ?? 10000)
    .regex(options?.pattern ?? /.*/)
    .transform((val: string) => sanitizeXSS(val));
}

/**
 * Create a Zod schema for email validation
 */
export const emailSchema = z.string().email('Invalid email address').max(255);

/**
 * Create a Zod schema for UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID');

/**
 * Create a Zod schema for phone validation (Kenyan format)
 */
export const phoneSchema = z.string().regex(/^(\+254|0)[71]\d{8}$/, 'Invalid phone number');

/**
 * Lab interpretation request validation schema
 */
export const labInterpretationSchema = z.object({
  labResults: z.record(z.string(), z.string()),
  testName: z.string().min(1).max(255),
  patientAge: z.number().min(0).max(150).optional(),
  patientGender: z.enum(['male', 'female', 'other']).optional(),
  patientContext: z.string().max(1000).optional(),
});

/**
 * Deterioration risk assessment request validation schema
 */
export const deteriorationRiskSchema = z.object({
  patientId: z.string().uuid().optional(),
  context: z.object({
    age: z.number().min(0).max(150),
    gender: z.enum(['male', 'female', 'other']),
    consciousness: z.string().max(50).optional(),
    isPregnant: z.boolean().optional(),
    gestationalWeeks: z.number().min(0).max(42).optional(),
  }),
  vitals: z.record(z.string(), z.any()).optional(),
});

/**
 * Clinical alerts request validation schema
 */
export const clinicalAlertsSchema = z.object({
  patientId: z.string().uuid().optional(),
  context: z.record(z.string(), z.any()).optional(),
  vitals: z.record(z.string(), z.any()).optional(),
  medications: z.array(z.string()).optional(),
  labResults: z.record(z.string(), z.any()).optional(),
  allergies: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
});

/**
 * Documentation suggestions request validation schema
 */
export const documentationSuggestionsSchema = z.object({
  documentType: z.enum(['soap_note', 'discharge_summary', 'progress_note', 'icd10_codes']),
  patientContext: z.record(z.string(), z.any()).optional(),
  partialContent: z.string().max(10000).optional(),
  suggestionsFor: z.enum(['completion', 'structure', 'terminology', 'codes']),
});

/**
 * Follow-up recommendations request validation schema
 */
export const followUpRecommendationsSchema = z.object({
  patientId: z.string().uuid().optional(),
  diagnosis: z.string().max(1000).optional(),
  treatment: z.record(z.string(), z.any()).optional(),
  riskFactors: z.record(z.string(), z.any()).optional(),
  socialContext: z.record(z.string(), z.any()).optional(),
  dischargeCondition: z.string().max(100).optional(),
});

/**
 * Medication adherence request validation schema
 */
export const medicationAdherenceSchema = z.object({
  patientId: z.string().uuid().optional(),
  medications: z.array(z.object({
    name: z.string().min(1).max(255),
    frequency: z.string().max(100).optional(),
    duration: z.string().max(100).optional(),
  })).optional(),
  adherenceHistory: z.record(z.string(), z.any()).optional(),
  riskFactors: z.record(z.string(), z.any()).optional(),
  socialContext: z.record(z.string(), z.any()).optional(),
});

/**
 * Resource allocation request validation schema
 */
export const resourceAllocationSchema = z.object({
  resourceType: z.enum(['staff', 'beds', 'equipment', 'supplies']),
  facilityId: z.string().uuid().optional(),
  currentAllocation: z.record(z.string(), z.any()).optional(),
  demandData: z.record(z.string(), z.any()).optional(),
  constraints: z.record(z.string(), z.any()).optional(),
  optimizationGoal: z.enum(['efficiency', 'cost', 'quality', 'balance']),
});

/**
 * Population analytics request validation schema
 */
export const populationAnalyticsSchema = z.object({
  facilityId: z.string().uuid().optional(),
  timeframe: z.enum(['week', 'month', 'quarter', 'year']),
  reportType: z.enum(['ahi', 'outbreak', 'amr', 'performance']),
});

/**
 * AI prompt validation - prevents prompt injection attacks
 */
export function validateAIPrompt(prompt: string): ValidationResult<string> {
  const errors: ValidationError[] = [];

  // Check for prompt injection patterns
  const injectionPatterns = [
    /ignore (previous|all) instructions/gi,
    /override (previous|all) instructions/gi,
    /new (instruction|command|role)/gi,
    /forget (previous|all) (instruction|command)/gi,
    /system: /gi,
    /assistant: /gi,
    /user: /gi,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(prompt)) {
      errors.push({
        field: 'prompt',
        message: 'Contains potentially dangerous instruction override pattern',
        code: 'PROMPT_INJECTION',
      });
    }
  }

  // Length validation
  if (prompt.length > 50000) {
    errors.push({
      field: 'prompt',
      message: 'Prompt exceeds maximum length of 50000 characters',
      code: 'TOO_LONG',
    });
  }

  // XSS check
  if (detectXSS(prompt)) {
    errors.push({
      field: 'prompt',
      message: 'Contains potentially dangerous content',
      code: 'XSS_DETECTED',
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Sanitize the prompt
  const sanitized = sanitizeXSS(prompt, { maxLength: 50000 });

  return { success: true, data: sanitized, sanitized };
}

// ─── Middleware Helper ────────────────────────────────────────────────────────

/**
 * Create a validation middleware for API routes
 */
export function createValidator<T extends z.ZodType>(schema: T) {
  return {
    validate: (body: unknown): ValidationResult<z.infer<T>> => {
      return validateRequestBody(body, schema);
    },
    
    validateOrThrow: (body: unknown): z.infer<T> => {
      const result = validateRequestBody(body, schema);
      if (!result.success) {
        const errorMessages = result.errors?.map(e => `${e.field}: ${e.message}`).join(', ') || 'Validation failed';
        throw new Error(errorMessages);
      }
      return result.data as z.infer<T>;
    },
  };
}

// ─── Export Default ───────────────────────────────────────────────────────────

const inputValidationModule = {
  detectXSS,
  sanitizeXSS,
  detectSQLInjection,
  escapeSQLValue,
  stripHtml,
  sanitizeHtml,
  validateString,
  validateEmail,
  validatePhone,
  validateUUID,
  validateFile,
  sanitizeObject,
  validateRequestBody,
  xssSafeString,
  emailSchema,
  uuidSchema,
  phoneSchema,
  createValidator,
  SENSITIVE_FIELDS,
};

export default inputValidationModule;