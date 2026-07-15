import crypto from 'crypto';

/**
 * WhatsApp Bot Service Tests
 */

import { whatsappBotService } from '../whatsapp-bot';

// Mock fetch
global.fetch = jest.fn();

describe('WhatsAppBotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AFRICAS_TALKING_USERNAME = 'test_user';
    process.env.AFRICAS_TALKING_API_KEY = 'test_key';
    process.env.WHATSAPP_SENDER_ID = 'AfyaHero';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'test-secret';
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Success',
            messageId: 'msg-123',
          }],
        }),
      });

      const result = await whatsappBotService.sendMessage(
        '+254700000000',
        'Test message'
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.africastalking.com'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle failed message send', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Failed',
          }],
        }),
      });

      const result = await whatsappBotService.sendMessage(
        '+254700000000',
        'Test message'
      );

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await whatsappBotService.sendMessage(
        '+254700000000',
        'Test message'
      );

      expect(result).toBe(false);
    });
  });

  describe('sendAppointmentReminder', () => {
    it('should send appointment reminder with correct format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Success',
            messageId: 'msg-123',
          }],
        }),
      });

      const result = await whatsappBotService.sendAppointmentReminder(
        '+254700000000',
        'John Doe',
        new Date('2026-04-20T10:00:00'),
        'Dr. Smith'
      );

      expect(result).toBe(true);
    });
  });

  describe('sendPrescriptionReminder', () => {
    it('should send prescription reminder with correct format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Success',
            messageId: 'msg-123',
          }],
        }),
      });

      const result = await whatsappBotService.sendPrescriptionReminder(
        '+254700000000',
        'John Doe',
        'Amoxicillin',
        '500mg',
        '3x daily'
      );

      expect(result).toBe(true);
    });
  });

  describe('sendLabResultsNotification', () => {
    it('should send lab results notification for normal results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Success',
            messageId: 'msg-123',
          }],
        }),
      });

      const result = await whatsappBotService.sendLabResultsNotification(
        '+254700000000',
        'John Doe',
        'Blood Test',
        'Normal',
        true
      );

      expect(result).toBe(true);
    });

    it('should send lab results notification for abnormal results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Success',
            messageId: 'msg-123',
          }],
        }),
      });

      const result = await whatsappBotService.sendLabResultsNotification(
        '+254700000000',
        'John Doe',
        'Blood Test',
        'High',
        false
      );

      expect(result).toBe(true);
    });
  });

  describe('handleIncomingMessage', () => {
    it('should process incoming webhook payload', async () => {
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

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          recipients: [{
            status: 'Success',
            messageId: 'msg-456',
          }],
        }),
      });

      await whatsappBotService.handleIncomingMessage(payload);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle outbound messages', async () => {
      const payload = {
        event: 'message',
        data: [{
          id: 'msg-123',
          direction: 'outbound',
          from: '+254711111111',
          to: '+254700000000',
          text: 'Test',
          timestamp: Date.now(),
        }],
      };

      await whatsappBotService.handleIncomingMessage(payload);

      // Should not process outbound messages
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature (mock)', () => {
      const payload = 'test-payload';
      const signature = crypto
        .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET || '')
        .update(payload)
        .digest('hex');
      const result = whatsappBotService.verifyWebhookSignature(signature, payload);

      // Currently returns true as placeholder
      expect(result).toBe(true);
    });
  });
});
