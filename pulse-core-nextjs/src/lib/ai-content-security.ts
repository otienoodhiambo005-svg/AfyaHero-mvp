/**
 * AI Content Security Policy
 * 
 * Provides content security policies for AI-generated content
 * to ensure safe display and prevent security risks.
 */

import { NextResponse } from 'next/server';

interface CSPConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  baseUri?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  reportUri?: string;
  reportOnly?: boolean;
}

/**
 * Default CSP configuration for AI-generated content
 */
const DEFAULT_AI_CSP: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https:'],
  fontSrc: ["'self'", 'data:'],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  reportOnly: false,
};

/**
 * Generate CSP header string from configuration
 */
export function generateCSPHeader(config: CSPConfig): string {
  const directives: string[] = [];

  if (config.defaultSrc) directives.push(`default-src ${config.defaultSrc.join(' ')}`);
  if (config.scriptSrc) directives.push(`script-src ${config.scriptSrc.join(' ')}`);
  if (config.styleSrc) directives.push(`style-src ${config.styleSrc.join(' ')}`);
  if (config.imgSrc) directives.push(`img-src ${config.imgSrc.join(' ')}`);
  if (config.connectSrc) directives.push(`connect-src ${config.connectSrc.join(' ')}`);
  if (config.fontSrc) directives.push(`font-src ${config.fontSrc.join(' ')}`);
  if (config.objectSrc) directives.push(`object-src ${config.objectSrc.join(' ')}`);
  if (config.mediaSrc) directives.push(`media-src ${config.mediaSrc.join(' ')}`);
  if (config.frameSrc) directives.push(`frame-src ${config.frameSrc.join(' ')}`);
  if (config.baseUri) directives.push(`base-uri ${config.baseUri.join(' ')}`);
  if (config.formAction) directives.push(`form-action ${config.formAction.join(' ')}`);
  if (config.frameAncestors) directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);
  if (config.reportUri) directives.push(`report-uri ${config.reportUri}`);

  const headerName = config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  return `${headerName}; ${directives.join('; ')}`;
}

/**
 * Add AI content security headers to response
 */
export function addAIContentSecurityHeaders(
  response: NextResponse,
  config: CSPConfig = DEFAULT_AI_CSP
): NextResponse {
  const cspHeader = generateCSPHeader(config);
  response.headers.set(cspHeader.split('; ')[0], cspHeader.split('; ').slice(1).join('; '));

  // Add AI-specific security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Add metadata about AI-generated content
  response.headers.set('X-Content-Generated-By', 'AI');
  response.headers.set('X-Content-Trust-Level', 'Low');

  return response;
}

/**
 * Sanitize AI-generated HTML content
 */
export function sanitizeAIContent(html: string): string {
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=[^\s>]+/gi, '');

  // Remove javascript: protocols
  sanitized = sanitized.replace(/javascript\s*:/gi, '');

  // Remove data URIs (potential XSS)
  sanitized = sanitized.replace(/data\s*:[^,]*;base64/gi, '');

  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(/<(iframe|object|embed)[^>]*>.*?<\/\1>/gi, '');

  return sanitized;
}

/**
 * Validate AI-generated content for security risks
 */
export function validateAIContent(content: string): {
  safe: boolean;
  risks: string[];
  sanitized: string;
} {
  const risks: string[] = [];

  // Check for script tags
  if (/<script\b/i.test(content)) {
    risks.push('Contains script tags');
  }

  // Check for event handlers
  if (/on\w+\s*=/i.test(content)) {
    risks.push('Contains event handlers');
  }

  // Check for javascript: protocol
  if (/javascript\s*:/i.test(content)) {
    risks.push('Contains javascript: protocol');
  }

  // Check for data URIs
  if (/data\s*:[^,]*;base64/i.test(content)) {
    risks.push('Contains data URIs');
  }

  // Check for iframe/object/embed
  if (/<(iframe|object|embed)/i.test(content)) {
    risks.push('Contains embedded objects');
  }

  // Check for CSS expressions (IE)
  if (/expression\s*\(/i.test(content)) {
    risks.push('Contains CSS expressions');
  }

  return {
    safe: risks.length === 0,
    risks,
    sanitized: sanitizeAIContent(content),
  };
}

/**
 * CSP presets for different AI content types
 */
export const AI_CSP_PRESETS: Record<string, CSPConfig> = {
  // For text-only AI responses
  text: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'none'"],
    styleSrc: ["'none'"],
    imgSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'none'"],
    frameSrc: ["'none'"],
  },

  // For AI-generated HTML with basic formatting
  html: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },

  // For AI-generated markdown that will be rendered
  markdown: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },

  // For AI diagnostic images
  images: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'none'"],
    styleSrc: ["'none'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
};

/**
 * Add nonce-based CSP for dynamic AI content
 */
export function addNonceBasedCSP(
  response: NextResponse,
  nonce: string,
  config: Partial<CSPConfig> = {}
): NextResponse {
  const cspConfig: CSPConfig = {
    ...DEFAULT_AI_CSP,
    ...config,
    scriptSrc: ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"],
    styleSrc: ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"],
  };

  return addAIContentSecurityHeaders(response, cspConfig);
}

/**
 * Generate a random nonce for CSP
 */
export function generateCSPNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  }
  // Fallback for environments without crypto.getRandomValues
  return Math.random().toString(36).substring(2, 18);
}
