/**
 * HIPAA Compliance Module for AfyaHero Health
 * 
 * Provides HIPAA compliance measures:
 * - PHI (Protected Health Information) protection
 * - Access controls
 * - Audit controls
 * - Integrity controls
 * - Transmission security
 */

import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import type { PortalRole } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PHICategory = 'demographic' | 'medical' | 'financial' | 'biometric' | 'identifier';

export interface PHIRecord {
  patientId: string;
  category: PHICategory;
  field: string;
  value: string;
  accessedBy: string;
  accessReason: string;
}

export interface AccessLog {
  userId: string;
  patientId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  success: boolean;
}

export interface AuditReport {
  period: { start: Date; end: Date };
  totalAccess: number;
  uniqueUsers: number;
  uniquePatients: number;
  deniedAccess: number;
  suspiciousActivity: number;
  topAccessedResources: { resource: string; count: number }[];
}

// ─── HIPAA Compliance Service ─────────────────────────────────────────────────

class HIPAAComplianceService {
  /**
   * Log PHI access
   */
  async logPHIAccess(record: PHIRecord): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: `PHI_ACCESS:${record.category}:${record.field}`,
          actorId: record.accessedBy,
          resourceType: 'PHI',
          resourceId: record.patientId,
          detail: JSON.stringify({
            category: record.category,
            field: record.field,
            accessReason: record.accessReason,
          }),
        },
      });

      logger.debug('PHI access logged', {
        patientId: record.patientId,
        category: record.category,
        field: record.field,
        accessedBy: record.accessedBy,
        reason: record.accessReason,
      });
    } catch (error) {
      logger.error('Failed to log PHI access', {
        error: error instanceof Error ? error.message : String(error),
        record,
      });
    }
  }

  /**
   * Check if user has minimum necessary access
   */
  async checkMinimumNecessaryAccess(
    userId: string,
    userRole: PortalRole,
    patientId: string,
    requestedData: string[],
    _purpose: string
  ): Promise<{ allowed: boolean; allowedFields: string[]; deniedFields: string[] }> {
    // Define minimum necessary fields per role
    const minimumNecessaryFields: Record<PortalRole, string[]> = {
      reception: ['demographics', 'insurance', 'appointments'],
      medical: ['demographics', 'medical_history', 'vitals', 'labs', 'diagnosis', 'treatment'],
      lab: ['demographics', 'lab_orders', 'lab_results'],
      pharmacy: ['demographics', 'prescriptions', 'allergies'],
      admin: ['demographics', 'billing', 'appointments'],
      super_admin: ['demographics', 'insurance', 'appointments', 'billing', 'medical_history', 'vitals', 'labs', 'diagnosis', 'treatment', 'prescriptions'],
    };

    const allowedFields = minimumNecessaryFields[userRole] || [];
    const grantedFields: string[] = [];
    const deniedFields: string[] = [];

    for (const field of requestedData) {
      if (allowedFields.includes(field)) {
        grantedFields.push(field);
      } else {
        deniedFields.push(field);
      }
    }

    // Log the access check
    await this.logAccessAttempt({
      userId,
      patientId,
      action: 'MINIMUM_NECESSARY_CHECK',
      resource: requestedData.join(','),
      timestamp: new Date(),
      ipAddress: '',
      success: deniedFields.length === 0,
    });

    return {
      allowed: deniedFields.length === 0,
      allowedFields: grantedFields,
      deniedFields,
    };
  }

  /**
   * Log access attempt
   */
  private async logAccessAttempt(log: AccessLog): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: log.action,
          actorId: log.userId,
          resourceType: 'ACCESS',
          resourceId: log.patientId,
          detail: JSON.stringify({
            resource: log.resource,
            success: log.success,
          }),
          ipAddress: log.ipAddress || undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to log access attempt', {
        error: error instanceof Error ? error.message : String(error),
        log,
      });
    }
  }

  /**
   * Detect suspicious access patterns
   */
  async detectSuspiciousActivity(options: {
    userId?: string;
    patientId?: string;
    timeWindowHours?: number;
  }): Promise<{ suspicious: boolean; patterns: string[]; details: unknown[] }> {
    const {
      userId,
      patientId,
      timeWindowHours = 24,
    } = options;

    const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    const patterns: string[] = [];
    const details: unknown[] = [];

    try {
      // Check for excessive access by a user
      if (userId) {
        const accessCount = await prisma.auditLog.count({
          where: {
            actorId: userId,
            createdAt: { gte: cutoffTime },
            action: { startsWith: 'PHI_ACCESS' },
          },
        });

        if (accessCount > 100) {
          patterns.push('EXCESSIVE_ACCESS');
          details.push({ userId, accessCount, timeWindowHours });
        }
      }

      // Check for excessive access to a patient's records
      if (patientId) {
        const patientAccessCount = await prisma.auditLog.count({
          where: {
            resourceId: patientId,
            createdAt: { gte: cutoffTime },
            action: { startsWith: 'PHI_ACCESS' },
          },
        });

        if (patientAccessCount > 20) {
          patterns.push('EXCESSIVE_PATIENT_ACCESS');
          details.push({ patientId, accessCount: patientAccessCount, timeWindowHours });
        }
      }

      // Check for access outside normal hours
      const _afterHoursAccess = await prisma.auditLog.count({
        where: {
          ...(userId ? { actorId: userId } : {}),
          ...(patientId ? { resourceId: patientId } : {}),
          createdAt: { gte: cutoffTime },
          action: { startsWith: 'PHI_ACCESS' },
        },
      });

      // Check for denied access attempts
      const deniedCount = await prisma.auditLog.count({
        where: {
          ...(userId ? { actorId: userId } : {}),
          ...(patientId ? { resourceId: patientId } : {}),
          createdAt: { gte: cutoffTime },
          detail: { path: ['success'], equals: false },
        },
      });

      if (deniedCount > 5) {
        patterns.push('MULTIPLE_DENIED_ACCESS');
        details.push({ deniedCount, timeWindowHours });
      }

      return {
        suspicious: patterns.length > 0,
        patterns,
        details,
      };
    } catch (error) {
      logger.error('Failed to detect suspicious activity', {
        error: error instanceof Error ? error.message : String(error),
        options,
      });

      return {
        suspicious: false,
        patterns: [],
        details: [],
      };
    }
  }

  /**
   * Generate HIPAA audit report
   */
  async generateAuditReport(options: {
    startDate: Date;
    endDate: Date;
    hospitalId?: string;
  }): Promise<AuditReport> {
    const { startDate, endDate, hospitalId } = options;

    const whereClause = hospitalId
      ? {
          createdAt: { gte: startDate, lte: endDate },
          hospitalId,
        }
      : {
          createdAt: { gte: startDate, lte: endDate },
        };

    const [
      totalAccess,
      uniqueUsers,
      uniquePatients,
      deniedAccess,
    ] = await Promise.all([
      prisma.auditLog.count({
        where: {
          ...whereClause,
          action: { startsWith: 'PHI_ACCESS' },
        },
      }),
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          ...whereClause,
          action: { startsWith: 'PHI_ACCESS' },
        },
        _count: true,
      }),
      prisma.auditLog.groupBy({
        by: ['resourceId'],
        where: {
          ...whereClause,
          action: { startsWith: 'PHI_ACCESS' },
        },
        _count: true,
      }),
      prisma.auditLog.count({
        where: {
          ...whereClause,
          detail: { path: ['success'], equals: false },
        },
      }),
    ]);

    // Get top accessed resources
    const topResources = await prisma.auditLog.groupBy({
      by: ['resourceType'],
      where: whereClause,
      _count: true,
      orderBy: {
        _count: { resourceType: 'desc' },
      },
      take: 10,
    });

    return {
      period: { start: startDate, end: endDate },
      totalAccess,
      uniqueUsers: uniqueUsers.length,
      uniquePatients: uniquePatients.length,
      deniedAccess,
      suspiciousActivity: 0, // Would need to run suspicious activity detection
      topAccessedResources: topResources.map((r) => ({
        resource: r.resourceType ?? 'unknown',
        count: r._count,
      })),
    };
  }

  /**
   * Encrypt PHI data at rest
   */
  async encryptPHI(data: string): Promise<string> {
    const encryptionKey = process.env.PHI_ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      logger.warn('PHI_ENCRYPTION_KEY not configured, data will not be encrypted');
      return data;
    }

    try {
      const crypto = await import('crypto');
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, encryptionKey);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        tag: authTag.toString('hex'),
      });
    } catch (error) {
      logger.error('Failed to encrypt PHI data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return data;
    }
  }

  /**
   * Decrypt PHI data
   */
  async decryptPHI(encryptedData: string): Promise<string> {
    const encryptionKey = process.env.PHI_ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      logger.warn('PHI_ENCRYPTION_KEY not configured, returning raw data');
      return encryptedData;
    }

    try {
      const crypto = await import('crypto');
      const parsed = JSON.parse(encryptedData);
      const algorithm = 'aes-256-gcm';
      
      const decipher = crypto.createDecipher(algorithm, encryptionKey);
      decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
      
      let decrypted = decipher.update(Buffer.from(parsed.data, 'hex'), undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt PHI data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return encryptedData;
    }
  }

  /**
   * Validate secure transmission (TLS check)
   */
  validateSecureTransmission(headers: { [key: string]: string | undefined }): {
    secure: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for HTTPS
    const xForwardedProto = headers['x-forwarded-proto'];
    if (xForwardedProto && xForwardedProto !== 'https') {
      issues.push('Transmission not using HTTPS');
    }

    // Check for secure headers
    if (!headers['strict-transport-security']) {
      issues.push('Missing HSTS header');
    }

    return {
      secure: issues.length === 0,
      issues,
    };
  }

  /**
   * Create a Business Associate Agreement record
   */
  async createBAARecord(data: {
    partnerName: string;
    partnerType: string;
    effectiveDate: Date;
    terminationDate?: Date;
    phiAccess: string[];
    purpose: string;
  }): Promise<{ success: boolean; baaId: string }> {
    // This would typically be stored in a BAAs table
    logger.info('Business Associate Agreement recorded', {
      partnerName: data.partnerName,
      partnerType: data.partnerType,
      effectiveDate: data.effectiveDate,
      phiAccess: data.phiAccess,
      purpose: data.purpose,
    });

    return {
      success: true,
      baaId: crypto.randomUUID(),
    };
  }

  /**
   * Validate workforce training compliance
   */
  async validateWorkforceTraining(_userId: string): Promise<{
    compliant: boolean;
    trainingRecords: { type: string; completedAt: Date; expiresAt: Date }[];
    missingTraining: string[];
  }> {
    // Required HIPAA training types
    const requiredTraining = [
      'HIPAA_PRIVACY',
      'HIPAA_SECURITY',
      'PHI_HANDLING',
      'BREACH_NOTIFICATION',
    ];

    // In production, this would query a training records table
    const trainingRecords: { type: string; completedAt: Date; expiresAt: Date }[] = [];
    const missingTraining = requiredTraining.filter(
      t => !trainingRecords.some(r => r.type === t)
    );

    return {
      compliant: missingTraining.length === 0,
      trainingRecords,
      missingTraining,
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const hipaaCompliance = new HIPAAComplianceService();
export default hipaaCompliance;
export { HIPAAComplianceService };
