/**
 * WhatsApp Webhook API Integration Tests
 * 
 * Tests for the /api/bot/whatsapp/webhook endpoint including:
 * - POST requests for receiving WhatsApp messages
 * - GET requests for webhook verification
 * - Signature verification
 * - Error handling
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
jest.mock('@/lib/bot/whatsapp-bot', () => ({
  whatsappBotService: {
    handleIncomingMessage: jest.fn(),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('@/lib/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const { whatsappBotService } = require('@/lib/bot/whatsapp-bot');

describe('/api/bot/whatsapp/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    whatsappBotService.verifyWebhookSignature.mockReturnValue(true);
  });

  describe('POST', () => {
    it('should process incoming WhatsApp message successfully', async () => {
      const payload = {
        event: 'message',
        data: [{
          id: 'msg-123',
          direction: 'inbound',
          from: '+254700000000',
          to: '+254711111111',
          text: 'HELP',
          timestamp: Date.now(),
        }],
      };

      whatsappBotService.handleIncomingMessage.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/bot/whatsapp/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(whatsappBotService.handleIncomingMessage).toHaveBeenCalledWith(payload);
    });

    it('should verify webhook signature', async () => {
      const payload = {
        event: 'message',
        data: [{
          id: 'msg-123',
          direction: 'inbound',
          from: '+254700000000',
          to: '+254711111111',
          text: 'HELP',
          timestamp: Date.now(),
        }],
      };

      whatsappBotService.handleIncomingMessage.mockResolvedValue(undefined);
      whatsappBotService.verifyWebhookSignature.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/bot/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'x-africas-talking-signature': 'valid-signature',
        },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      expect(whatsappBotService.verifyWebhookSignature).toHaveBeenCalledWith(
        'valid-signature',
        JSON.stringify(payload)
      );
    });

    it('should return 401 for invalid signature', async () => {
      const payload = {
        event: 'message',
        data: [],
      };

      whatsappBotService.verifyWebhookSignature.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/bot/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'x-africas-talking-signature': 'invalid-signature',
        },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should handle processing errors gracefully', async () => {
      const payload = {
        event: 'message',
        data: [],
      };

      whatsappBotService.handleIncomingMessage.mockRejectedValue(
        new Error('Processing error')
      );

      const request = new NextRequest('http://localhost:3000/api/bot/whatsapp/webhook', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle invalid JSON payload', async () => {
      const request = new NextRequest('http://localhost:3000/api/bot/whatsapp/webhook', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET', () => {
    it('should return active status for webhook verification', async () => {
      const request = new NextRequest('http://localhost:3000/api/bot/whatsapp/webhook');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('active');
    });
  });
});
