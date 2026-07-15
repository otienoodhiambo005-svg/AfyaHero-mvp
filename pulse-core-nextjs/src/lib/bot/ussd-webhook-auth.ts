/**
 * USSD webhook authentication helpers.
 * Supports HMAC-SHA256 body signatures and shared-secret header verification.
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

/**
 * Verify HMAC-SHA256 signature of the raw webhook body using USSD_WEBHOOK_SECRET.
 */
export function verifyUssdWebhookSignature(
  signature: string | null | undefined,
  payload: string
): boolean {
  const secret = process.env.USSD_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('USSD_WEBHOOK_SECRET is not configured; rejecting webhook');
    return false;
  }

  if (!signature || typeof signature !== 'string') {
    return false;
  }

  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const received = signature.replace(/^sha256=/, '').trim();

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(received, 'hex');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (error) {
    logger.error('USSD webhook signature verification error', { error });
    return false;
  }
}

/**
 * Authenticate an incoming USSD webhook request.
 *
 * Accepts any of:
 *   1. Valid HMAC signature on the raw body (x-africas-talking-signature or x-ussd-signature)
 *   2. Client IP in AFRICAS_TALKING_ALLOWED_IPS
 *   3. x-ussd-webhook-secret header matching USSD_WEBHOOK_SECRET (timing-safe)
 */
export function authenticateUssdRequest(
  request: NextRequest,
  options?: { rawBody?: string; signature?: string | null }
): boolean {
  const allowedIps = (process.env.AFRICAS_TALKING_ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  const sharedSecret = process.env.USSD_WEBHOOK_SECRET;

  if (allowedIps.length === 0 && !sharedSecret) {
    logger.error(
      '[USSD Webhook] Neither AFRICAS_TALKING_ALLOWED_IPS nor USSD_WEBHOOK_SECRET configured; rejecting'
    );
    return false;
  }

  const signature =
    options?.signature ??
    request.headers.get('x-africas-talking-signature') ??
    request.headers.get('x-ussd-signature');

  if (signature && options?.rawBody !== undefined && verifyUssdWebhookSignature(signature, options.rawBody)) {
    return true;
  }

  if (allowedIps.length > 0) {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const clientIp =
      forwardedFor.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '';
    if (clientIp && allowedIps.includes(clientIp)) {
      return true;
    }
    if (!sharedSecret && !signature) {
      logger.warn('[USSD Webhook] Client IP not in allowlist', { clientIp });
      return false;
    }
  }

  if (sharedSecret) {
    const provided = request.headers.get('x-ussd-webhook-secret') || '';
    try {
      const a = Buffer.from(provided);
      const b = Buffer.from(sharedSecret);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    } catch {
      return false;
    }
    logger.warn('[USSD Webhook] Shared secret mismatch');
    return false;
  }

  return false;
}
