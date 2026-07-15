/**
 * Application Constants
 * Centralized constants to avoid magic numbers throughout the codebase
 */

// Time constants (in milliseconds)
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

// API & Network
export const API = {
  DEFAULT_TIMEOUT: 15000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 100,
} as const;

// UI/UX
export const UI = {
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 5000,
  TOAST_EXIT_DURATION: 300,
  MODAL_TRANSITION: 200,
  DROPDOWN_DELAY: 150,
  SCROLL_THRESHOLD: 100,
  MIN_TOUCH_TARGET: 44, // iOS HIG recommendation
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// File uploads
export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain'],
} as const;

// Session & Auth
export const AUTH = {
  SESSION_DURATION: 8 * 60 * 60 * 1000, // 8 hours
  TOKEN_REFRESH_BUFFER: 5 * 60 * 1000, // 5 minutes before expiry
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
} as const;

// Clinical thresholds
export const CLINICAL = {
  VITALS_STORAGE_DAYS: 90,
  MAX_TRIAGE_WAIT_MINUTES: 15,
  FOLLOWUP_DEFAULT_DAYS: 7,
  APPOINTMENT_BUFFER_MINUTES: 15,
} as const;
