import * as crypto from 'crypto';
import { createHash, createHmac } from 'crypto';

/**
 * Two Factor Authentication (TOTP) implementation for Hospital Admin Portal
 * Compliant with RFC 6238 / HOTP RFC 4226
 */

// Configuration for hospital admin security level
const TOTP_CONFIG = {
  digits: 6,
  period: 30, // seconds
  algorithm: 'sha1' as 'sha1' | 'sha256' | 'sha512',
  window: 1, // Allow 1 period before/after for clock drift
} as const;

/**
 * Generate a secure random secret key for TOTP
 * Returns base32 encoded string for compatibility with authenticator apps
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20);
  return buffer.toString('base64');
}

/**
 * Generate TOTP code for given secret and timestamp
 */
export function generateTOTPCode(secret: string, timestamp: number = Date.now()): string {
  const decodedSecret = Buffer.from(secret, 'base64');
  const counter = Math.floor(timestamp / 1000 / TOTP_CONFIG.period);
  
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);
  
  const hmac = createHmac(TOTP_CONFIG.algorithm, decodedSecret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_CONFIG.digits);
  
  return code.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify TOTP code against secret
 * Allows for clock drift within configured window
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  const timestamp = Date.now();
  const period = TOTP_CONFIG.period * 1000;
  
  // Check current, previous, and next time windows for clock drift
  for (let i = -TOTP_CONFIG.window; i <= TOTP_CONFIG.window; i++) {
    const windowTime = timestamp + (i * period);
    const generatedCode = generateTOTPCode(secret, windowTime);
    
    if (generatedCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate 8 backup codes for account recovery
 * Each code is 12 characters with hyphen separators for readability
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < 8; i++) {
    const randomBytes = crypto.randomBytes(6);
    const code = randomBytes.toString('hex').toUpperCase();
    // Format as XXXX-XXXX-XXXX
    const formattedCode = code.match(/.{4}/g)?.join('-') || code;
    codes.push(formattedCode);
  }
  
  return codes;
}

/**
 * Hash backup code for secure storage
 * Use slow hash for security even if database is compromised
 */
export function hashBackupCode(code: string): string {
  const normalizedCode = code.replace(/-/g, '').toLowerCase();
  return createHash('sha256')
    .update(normalizedCode)
    .digest('hex');
}

/**
 * Timing safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Verify backup code against stored hash
 */
export function verifyBackupCode(inputCode: string, storedHash: string): boolean {
  const inputHash = hashBackupCode(inputCode);
  return timingSafeEqual(inputHash, storedHash);
}

/**
 * Generate provisioning URI for authenticator apps (Google Authenticator, Authy, etc.)
 */
export function generateAuthenticatorURI(
  secret: string,
  email: string,
  _hospitalName: string = 'AfyaHero Hospital'
): string {
  const issuer = encodeURIComponent('AfyaHero Admin');
  const accountName = encodeURIComponent(email);
  const encodedSecret = secret.replace(/=/g, ''); // Remove padding for authenticator compatibility
  
  return `otpauth://totp/${issuer}:${accountName}?secret=${encodedSecret}&issuer=${issuer}&algorithm=${TOTP_CONFIG.algorithm.toUpperCase()}&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;
}