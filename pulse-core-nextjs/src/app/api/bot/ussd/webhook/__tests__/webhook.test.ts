/**
 * USSD Webhook API Integration Tests
 *
 * Tests for the /api/bot/ussd/webhook endpoint including:
 * - POST requests for receiving USSD requests
 * - GET requests for webhook verification
 * - Request processing
 * - Error handling
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

jest.mock('@/lib/bot/uussd-service', () => ({
  ussdService: {
    handleRequest: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const { ussdService } = require('@/lib/bot/uussd-service');

function authorizedInit(body: string) {
  return {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-ussd-webhook-secret': 'test-secret',
    },
  };
}

describe('/api/bot/ussd/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USSD_WEBHOOK_SECRET = 'test-secret';
  });

  describe('POST', () => {
    it('should process USSD request successfully', async () => {
      const response = {
        response: 'CON Welcome to AfyaHero Hospital OS\n1. Appointments',
        shouldClose: false,
      };

      ussdService.handleRequest.mockResolvedValue(response);

      const body =
        'sessionId=session-123&serviceCode=*123%23&phoneNumber=%2B254700000000&text=';
      const request = new NextRequest(
        'http://localhost:3000/api/bot/ussd/webhook',
        authorizedInit(body)
      );

      const result = await POST(request);

      expect(result).toBeInstanceOf(Response);
      expect(ussdService.handleRequest).toHaveBeenCalledWith({
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '',
      });
    });

    it('should return correct response format', async () => {
      const response = {
        response: 'CON Welcome to AfyaHero Hospital OS\n1. Appointments',
        shouldClose: false,
      };

      ussdService.handleRequest.mockResolvedValue(response);

      const body =
        'sessionId=session-123&serviceCode=*123%23&phoneNumber=%2B254700000000&text=';
      const request = new NextRequest(
        'http://localhost:3000/api/bot/ussd/webhook',
        authorizedInit(body)
      );

      const result = await POST(request);
      const text = await result.text();

      expect(text).toBe('CON Welcome to AfyaHero Hospital OS\n1. Appointments');
      expect(result.headers.get('Freeflow')).toBe('true');
    });

    it('should set Freeflow header to false for closing responses', async () => {
      const response = {
        response: 'END Thank you for using AfyaHero',
        shouldClose: true,
      };

      ussdService.handleRequest.mockResolvedValue(response);

      const body =
        'sessionId=session-123&serviceCode=*123%23&phoneNumber=%2B254700000000&text=';
      const request = new NextRequest(
        'http://localhost:3000/api/bot/ussd/webhook',
        authorizedInit(body)
      );

      const result = await POST(request);

      expect(result.headers.get('Freeflow')).toBe('false');
    });

    it('should reject unauthorized requests', async () => {
      const body =
        'sessionId=session-123&serviceCode=*123%23&phoneNumber=%2B254700000000&text=';
      const request = new NextRequest('http://localhost:3000/api/bot/ussd/webhook', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const result = await POST(request);

      expect(result.status).toBe(401);
      expect(ussdService.handleRequest).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      ussdService.handleRequest.mockRejectedValue(new Error('Processing error'));

      const body =
        'sessionId=session-123&serviceCode=*123%23&phoneNumber=%2B254700000000&text=';
      const request = new NextRequest(
        'http://localhost:3000/api/bot/ussd/webhook',
        authorizedInit(body)
      );

      const result = await POST(request);
      const text = await result.text();

      expect(text).toContain('An error occurred');
      expect(result.headers.get('Freeflow')).toBe('true');
    });
  });

  describe('GET', () => {
    it('should return active status for webhook verification', async () => {
      const request = new NextRequest('http://localhost:3000/api/bot/ussd/webhook');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('active');
    });
  });
});
