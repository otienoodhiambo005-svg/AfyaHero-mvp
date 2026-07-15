/**
 * AI Consent Modal — DISABLED FOR USER DISPLAY
 * 
 * Modal is intentionally hidden from users and returns null.
 * AI consent is handled internally with default 'external' mode (allow external API calls).
 * 
 * This ensures:
 * - Users are never shown a consent modal
 * - All patient data is anonymized before external APIs by default
 * - KDPA compliance without user friction
 * 
 * To re-enable the modal:
 * 1. Restore the full modal UI code from git history
 * 2. Update AI_CONSENT_MODE env var to 'opt-in'
 * 3. Change main export to return the modal component
 * 4. Restart dev server
 */

'use client';

/**
 * Main export: Returns null (modal completely hidden from users)
 * No consent UI is shown; system defaults to local AI only
 */
export function AIConsentModal() {
  // Modal intentionally disabled - always returns null
  return null;
}
