/**
 * USSD Service Tests
 */

import { ussdService, USSDRequest } from '../uussd-service';

describe('USSDService', () => {
  describe('handleRequest', () => {
    it('should show main menu on first request', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Welcome to AfyaHero Hospital OS');
      expect(response.response).toContain('Appointments');
      expect(response.shouldClose).toBe(false);
    });

    it('should handle main menu selection', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '1',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Appointments');
      expect(response.response).toContain('Book Appointment');
      expect(response.shouldClose).toBe(false);
    });

    it('should handle invalid selection', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '9',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Invalid selection');
      expect(response.shouldClose).toBe(true);
    });

    it('should show appointments submenu', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '1',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Book Appointment');
      expect(response.response).toContain('View Upcoming');
      expect(response.shouldClose).toBe(false);
    });

    it('should show prescriptions submenu', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '2',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('My Prescriptions');
      expect(response.response).toContain('View Active Prescriptions');
      expect(response.shouldClose).toBe(false);
    });

    it('should show lab results submenu', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '3',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Lab Results');
      expect(response.response).toContain('View Recent Results');
      expect(response.shouldClose).toBe(false);
    });

    it('should handle back to main menu', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '1*0',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Welcome to AfyaHero Hospital OS');
      expect(response.shouldClose).toBe(false);
    });

    it('should handle emergency menu', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: '6',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Emergency Services');
      expect(response.response).toContain('Call Emergency');
      expect(response.shouldClose).toBe(false);
    });

    it('should handle error gracefully', async () => {
      const request: USSDRequest = {
        sessionId: 'session-123',
        serviceCode: '*123#',
        phoneNumber: '+254700000000',
        text: 'invalid',
      };

      const response = await ussdService.handleRequest(request);

      expect(response.response).toContain('Welcome to AfyaHero Hospital OS');
      expect(response.shouldClose).toBe(false);
    });
  });

  describe('getMenuLevel', () => {
    it('should return 0 for empty text', () => {
      const level = (ussdService as any).getMenuLevel('');
      expect(level).toBe(0);
    });

    it('should return 1 for single selection', () => {
      const level = (ussdService as any).getMenuLevel('1');
      expect(level).toBe(1);
    });

    it('should return 2 for double selection', () => {
      const level = (ussdService as any).getMenuLevel('1*2');
      expect(level).toBe(2);
    });

    it('should return 3 for triple selection', () => {
      const level = (ussdService as any).getMenuLevel('1*2*3');
      expect(level).toBe(3);
    });
  });
});
