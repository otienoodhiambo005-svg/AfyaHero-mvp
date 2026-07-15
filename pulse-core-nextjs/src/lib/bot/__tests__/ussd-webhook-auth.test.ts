import crypto from 'crypto';
import { NextRequest } from 'next/server';
import {
  authenticateUssdRequest,
  verifyUssdWebhookSignature,
} from '../ussd-webhook-auth';

describe('ussd-webhook-auth', () => {
  beforeEach(() => {
    process.env.USSD_WEBHOOK_SECRET = 'test-secret';
    delete process.env.AFRICAS_TALKING_ALLOWED_IPS;
  });

  describe('verifyUssdWebhookSignature', () => {
    it('accepts valid HMAC-SHA256 signatures', () => {
      const payload = 'sessionId=abc&text=';
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('hex');

      expect(verifyUssdWebhookSignature(signature, payload)).toBe(true);
    });

    it('rejects invalid signatures', () => {
      expect(verifyUssdWebhookSignature('deadbeef', 'payload')).toBe(false);
    });
  });

  describe('authenticateUssdRequest', () => {
    it('accepts matching shared-secret header', () => {
      const req = new NextRequest('http://localhost/api/bot/ussd/webhook', {
        headers: { 'x-ussd-webhook-secret': 'test-secret' },
      });
      expect(authenticateUssdRequest(req)).toBe(true);
    });

    it('accepts valid HMAC on raw body', () => {
      const rawBody = 'sessionId=1&text=';
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(rawBody)
        .digest('hex');
      const req = new NextRequest('http://localhost/api/bot/ussd/webhook', {
        headers: { 'x-ussd-signature': signature },
      });
      expect(authenticateUssdRequest(req, { rawBody, signature })).toBe(true);
    });

    it('rejects when neither secret nor allowlist is configured', () => {
      delete process.env.USSD_WEBHOOK_SECRET;
      const req = new NextRequest('http://localhost/api/bot/ussd/webhook');
      expect(authenticateUssdRequest(req)).toBe(false);
    });
  });
});
