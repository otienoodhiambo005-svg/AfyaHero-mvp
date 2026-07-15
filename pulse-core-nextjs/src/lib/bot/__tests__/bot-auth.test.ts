/**
 * Bot Authentication Service Tests
 */

import { botAuthService, BotSession } from '../bot-auth';

describe('BotAuthService', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    (botAuthService as any).sessions.clear();
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      const session = botAuthService.getSession('+254700000000');
      expect(session).toBeNull();
    });

    it('should return existing session', () => {
      const testSession: BotSession = {
        phoneNumber: '+254700000000',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: new Date(),
      };

      (botAuthService as any).sessions.set('+254700000000', testSession);

      const session = botAuthService.getSession('+254700000000');
      expect(session).toEqual(testSession);
    });

    it('should clean phone number format', () => {
      const testSession: BotSession = {
        phoneNumber: '+254700000000',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: new Date(),
      };

      (botAuthService as any).sessions.set('+254700000000', testSession);

      const session = botAuthService.getSession('254700000000');
      expect(session).toEqual(testSession);
    });

    it('should update last activity on session access', () => {
      const oldActivity = new Date(Date.now() - 1000);
      const testSession: BotSession = {
        phoneNumber: '+254700000000',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: oldActivity,
      };

      (botAuthService as any).sessions.set('+254700000000', testSession);

      botAuthService.getSession('+254700000000');

      const session = (botAuthService as any).sessions.get('+254700000000');
      expect(session.lastActivity.getTime()).toBeGreaterThan(oldActivity.getTime());
    });

    it('should return null for expired session', () => {
      const oldActivity = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      const testSession: BotSession = {
        phoneNumber: '+254700000000',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: oldActivity,
      };

      (botAuthService as any).sessions.set('+254700000000', testSession);

      const session = botAuthService.getSession('+254700000000');
      expect(session).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should remove session', () => {
      const testSession: BotSession = {
        phoneNumber: '+254700000000',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: new Date(),
      };

      (botAuthService as any).sessions.set('+254700000000', testSession);

      botAuthService.invalidateSession('+254700000000');

      const session = (botAuthService as any).sessions.get('+254700000000');
      expect(session).toBeUndefined();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      const oldActivity = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      const recentActivity = new Date();

      const oldSession: BotSession = {
        phoneNumber: '+254700000001',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: oldActivity,
      };

      const recentSession: BotSession = {
        phoneNumber: '+254700000002',
        patientId: 'patient-456',
        authenticated: true,
        lastActivity: recentActivity,
      };

      (botAuthService as any).sessions.set('+254700000001', oldSession);
      (botAuthService as any).sessions.set('+254700000002', recentSession);

      botAuthService.cleanupExpiredSessions();

      expect((botAuthService as any).sessions.has('+254700000001')).toBe(false);
      expect((botAuthService as any).sessions.has('+254700000002')).toBe(true);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return count of active sessions', () => {
      const recentActivity = new Date();

      const session1: BotSession = {
        phoneNumber: '+254700000001',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: recentActivity,
      };

      const session2: BotSession = {
        phoneNumber: '+254700000002',
        patientId: 'patient-456',
        authenticated: true,
        lastActivity: recentActivity,
      };

      (botAuthService as any).sessions.set('+254700000001', session1);
      (botAuthService as any).sessions.set('+254700000002', session2);

      const count = botAuthService.getActiveSessionCount();
      expect(count).toBe(2);
    });

    it('should exclude expired sessions from count', () => {
      const oldActivity = new Date(Date.now() - 31 * 60 * 1000);
      const recentActivity = new Date();

      const expiredSession: BotSession = {
        phoneNumber: '+254700000001',
        patientId: 'patient-123',
        authenticated: true,
        lastActivity: oldActivity,
      };

      const activeSession: BotSession = {
        phoneNumber: '+254700000002',
        patientId: 'patient-456',
        authenticated: true,
        lastActivity: recentActivity,
      };

      (botAuthService as any).sessions.set('+254700000001', expiredSession);
      (botAuthService as any).sessions.set('+254700000002', activeSession);

      const count = botAuthService.getActiveSessionCount();
      expect(count).toBe(1);
    });
  });
});
