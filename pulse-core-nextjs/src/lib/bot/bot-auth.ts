/**
 * Bot Authentication Service
 * Handles patient authentication via WhatsApp and USSD
 */

import crypto from 'crypto';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(otp: string, phone: string): string {
  const salt = process.env.OTP_HASH_SECRET || 'afyahero-default-otp-salt-change-me';
  return crypto.createHmac('sha256', salt).update(`${phone}:${otp}`).digest('hex');
}

function generateSecureOtp(): string {
  // 6-digit OTP using cryptographically secure RNG
  return crypto.randomInt(100000, 1000000).toString();
}

export interface BotSession {
  phoneNumber: string;
  patientId?: string;
  authenticated: boolean;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export class BotAuthService {
  private sessions: Map<string, BotSession> = new Map();
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  /**
   * Authenticate patient via phone number
   */
  async authenticatePatient(phoneNumber: string): Promise<BotSession | null> {
    try {
      // Clean phone number (remove +, spaces, dashes)
      const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, '');

      // Find patient by phone number
      const patient = await prisma.patient.findFirst({
        where: {
          phone: {
            contains: cleanPhone,
          },
        },
      });

      if (!patient) {
        logger.info('[BotAuth] Patient not found', { phoneNumber });
        return null;
      }

      // Create or update session
      const session: BotSession = {
        phoneNumber: cleanPhone,
        patientId: patient.id,
        authenticated: true,
        lastActivity: new Date(),
        metadata: {
          patientName: patient.name,
          userId: patient.userId,
        },
      };

      this.sessions.set(cleanPhone, session);

      logger.info('[BotAuth] Patient authenticated', {
        phoneNumber: cleanPhone,
        patientId: patient.id,
      });

      return session;
    } catch (error) {
      logger.error('[BotAuth] Error authenticating patient', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Authenticate patient via patient ID
   */
  async authenticateById(patientId: string): Promise<BotSession | null> {
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        logger.info('[BotAuth] Patient not found by ID', { patientId });
        return null;
      }

      const session: BotSession = {
        phoneNumber: patient.phone || '',
        patientId: patient.id,
        authenticated: true,
        lastActivity: new Date(),
        metadata: {
          patientName: patient.name,
          userId: patient.userId,
        },
      };

      if (patient.phone) {
        this.sessions.set(patient.phone.replace(/[\s\-\+]/g, ''), session);
      }

      logger.info('[BotAuth] Patient authenticated by ID', {
        patientId,
        phoneNumber: patient.phone,
      });

      return session;
    } catch (error) {
      logger.error('[BotAuth] Error authenticating by ID', {
        patientId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get session by phone number
   */
  getSession(phoneNumber: string): BotSession | null {
    const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, '');
    const sessionKey = this.sessions.has(cleanPhone)
      ? cleanPhone
      : this.sessions.has(phoneNumber)
        ? phoneNumber
        : `+${cleanPhone}`;
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (Date.now() - session.lastActivity.getTime() > this.sessionTimeout) {
      this.sessions.delete(sessionKey);
      return null;
    }

    // Update last activity
    const nextActivity = new Date();
    if (nextActivity.getTime() <= session.lastActivity.getTime()) {
      nextActivity.setTime(session.lastActivity.getTime() + 1);
    }
    session.lastActivity = nextActivity;
    this.sessions.set(sessionKey, session);

    return session;
  }

  /**
   * Verify patient OTP.
   * Uses a timing-safe comparison against the HMAC hash stored on the session,
   * enforces expiry and caps attempts to {@link OTP_MAX_ATTEMPTS}.
   */
  async verifyOTP(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, '');
      const session = this.getSession(cleanPhone);

      if (!session || !session.metadata?.otpHash) {
        return false;
      }

      const expiry = session.metadata.otpExpiry as number | undefined;
      const attempts = (session.metadata.otpAttempts as number | undefined) ?? 0;

      if (!expiry || Date.now() > expiry) {
        this.clearOtp(cleanPhone);
        logger.info('[BotAuth] OTP expired', { phoneNumber: cleanPhone });
        return false;
      }

      if (attempts >= OTP_MAX_ATTEMPTS) {
        this.clearOtp(cleanPhone);
        logger.warn('[BotAuth] OTP attempts exceeded', { phoneNumber: cleanPhone });
        return false;
      }

      const providedHash = hashOtp(otp, cleanPhone);
      const storedHash = session.metadata.otpHash as string;

      const providedBuf = Buffer.from(providedHash, 'hex');
      const storedBuf = Buffer.from(storedHash, 'hex');
      const isValid =
        providedBuf.length === storedBuf.length &&
        crypto.timingSafeEqual(providedBuf, storedBuf);

      if (isValid) {
        this.clearOtp(cleanPhone);
        logger.info('[BotAuth] OTP verified', { phoneNumber: cleanPhone });
        return true;
      }

      session.metadata.otpAttempts = attempts + 1;
      this.sessions.set(cleanPhone, session);
      logger.warn('[BotAuth] OTP mismatch', {
        phoneNumber: cleanPhone,
        attempts: attempts + 1,
      });
      return false;
    } catch (error) {
      logger.error('[BotAuth] Error verifying OTP', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Generate an OTP for the given phone number and store only its HMAC hash
   * on the session. The caller is responsible for delivery (SMS/WhatsApp).
   *
   * Returns the plaintext OTP so it can be dispatched; it is NEVER persisted.
   */
  async sendOTP(phoneNumber: string): Promise<string> {
    try {
      const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, '');
      const otp = generateSecureOtp();
      const otpHash = hashOtp(otp, cleanPhone);

      const session = this.getSession(cleanPhone);
      if (session) {
        session.metadata = {
          ...session.metadata,
          otpHash,
          otpExpiry: Date.now() + OTP_EXPIRY_MS,
          otpAttempts: 0,
        };
        this.sessions.set(cleanPhone, session);
      } else {
        // Create a pre-authentication session to hold the OTP hash
        this.sessions.set(cleanPhone, {
          phoneNumber: cleanPhone,
          authenticated: false,
          lastActivity: new Date(),
          metadata: {
            otpHash,
            otpExpiry: Date.now() + OTP_EXPIRY_MS,
            otpAttempts: 0,
          },
        });
      }

      logger.info('[BotAuth] OTP generated', { phoneNumber: cleanPhone });

      return otp;
    } catch (error) {
      logger.error('[BotAuth] Error sending OTP', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Remove OTP material from a session (after success or exhaustion).
   */
  private clearOtp(cleanPhone: string): void {
    const session = this.sessions.get(cleanPhone);
    if (!session?.metadata) return;
    delete session.metadata.otpHash;
    delete session.metadata.otpExpiry;
    delete session.metadata.otpAttempts;
    this.sessions.set(cleanPhone, session);
  }

  /**
   * Invalidate session
   */
  invalidateSession(phoneNumber: string): void {
    const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, '');
    this.sessions.delete(cleanPhone);
    this.sessions.delete(phoneNumber);

    logger.info('[BotAuth] Session invalidated', { phoneNumber: cleanPhone });
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [phone, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.sessionTimeout) {
        this.sessions.delete(phone);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('[BotAuth] Cleaned up expired sessions', {
        count: cleanedCount,
      });
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    this.cleanupExpiredSessions();
    return this.sessions.size;
  }
}

export const botAuthService = new BotAuthService();

// Clean up expired sessions every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    botAuthService.cleanupExpiredSessions();
  }, 5 * 60 * 1000);
}

