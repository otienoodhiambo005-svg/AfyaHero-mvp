/**
 * GDPR Compliance Module for AfyaHero Health
 * 
 * Provides GDPR compliance measures:
 * - Data subject rights
 * - Consent management
 * - Data breach notification
 * - Data protection impact assessments
 * - Privacy by design and default
 */

import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { canPerformAction } from '@/lib/rbac';
import type { PortalRole } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GDPRDataSubjectRight = 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'object';

export interface GDPRDataSubjectRequest {
  patientId: string;
  requestType: GDPRDataSubjectRight;
  requestedBy: string;
  details?: string;
}

export interface GDPRConsentRecord {
  patientId: string;
  consentType: string;
  granted: boolean;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, unknown>;
}

export interface GDPRDataBreach {
  breachType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedDataSubjects: number;
  categoriesOfData: string[];
  likelyConsequences: string;
  remedialMeasures: string;
  dataProtectionOfficer: string;
}

export interface DataProtectionImpactAssessment {
  id: string;
  assessmentType: string;
  description: string;
  dataCategories: string[];
  processingActivities: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationMeasures: string;
  completedBy: string;
  completedAt: Date;
}

// ─── GDPR Compliance Service ──────────────────────────────────────────────────

class GDPRComplianceService {
  /**
   * Process data subject request
   */
  async processDataSubjectRequest(
    request: GDPRDataSubjectRequest,
    userRole: PortalRole,
    hospitalId: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    // Verify admin access
    const accessCheck = canPerformAction({
      userRole,
      userHospitalId: hospitalId,
      targetHospitalId: hospitalId,
      resourceType: 'audit',
      action: 'read',
    });

    if (!accessCheck.allowed) {
      return {
        success: false,
        requestId: '',
        message: 'Insufficient permissions to process data subject requests',
      };
    }

    try {
      const requestId = crypto.randomUUID();

      // Create data access request record
      await prisma.dataAccessRequest.create({
        data: {
          id: requestId,
          patientId: request.patientId,
          requestType: request.requestType,
          status: 'pending',
          requestedBy: request.requestedBy,
          requestData: request.details ? { details: request.details } : undefined,
        },
      });

      logger.info('GDPR data subject request created', {
        requestId,
        patientId: request.patientId,
        requestType: request.requestType,
        requestedBy: request.requestedBy,
      });

      // Process based on request type
      switch (request.requestType) {
        case 'access':
          return await this.processAccessRequest(requestId, request.patientId);
        case 'rectification':
          return await this.processRectificationRequest(requestId, request.patientId, request.details);
        case 'erasure':
          return await this.processErasureRequest(requestId, request.patientId);
        case 'portability':
          return await this.processPortabilityRequest(requestId, request.patientId);
        case 'restriction':
          return await this.processRestrictionRequest(requestId, request.patientId);
        case 'object':
          return await this.processObjectRequest(requestId, request.patientId);
        default:
          return {
            success: false,
            requestId,
            message: `Unknown request type: ${request.requestType}`,
          };
      }
    } catch (error) {
      logger.error('Failed to process GDPR data subject request', {
        error: error instanceof Error ? error.message : String(error),
        request,
      });

      return {
        success: false,
        requestId: '',
        message: 'Failed to process data subject request',
      };
    }
  }

  /**
   * Process right to access request
   */
  private async processAccessRequest(
    requestId: string,
    patientId: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    try {
      // Gather all patient data
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          appointments: true,
          labRequests: true,
          prescriptions: true,
          clinicalVitals: true,
          consultations: true,
          hospitalBeds: true,
          reminders: true,
          dataConsents: true,
        },
      });

      if (!patient) {
        await this.updateRequestStatus(requestId, 'rejected', 'Patient not found');
        return {
          success: false,
          requestId,
          message: 'Patient not found',
        };
      }

      // Compile data for export
      const exportData = {
        patient: {
          id: patient.id,
          name: patient.name,
          gender: patient.gender,
          dob: patient.dob,
          phone: patient.phone,
          insuranceProvider: patient.insuranceProvider,
          insuranceId: patient.insuranceId,
          bloodGroup: patient.bloodGroup,
          allergies: patient.allergies,
        },
        medicalRecords: {
          appointments: patient.appointments,
          labResults: patient.labRequests,
          prescriptions: patient.prescriptions,
          vitals: patient.clinicalVitals,
          consultations: patient.consultations,
        },
        otherData: {
          bedAssignments: patient.hospitalBeds,
          reminders: patient.reminders,
          consents: patient.dataConsents,
        },
        exportDate: new Date().toISOString(),
      };

      await prisma.dataAccessRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          responseData: JSON.stringify(exportData),
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        requestId,
        message: 'Data access request completed. Data compiled for export.',
      };
    } catch (error) {
      await this.updateRequestStatus(requestId, 'rejected', error instanceof Error ? error.message : 'Processing failed');
      throw error;
    }
  }

  /**
   * Process right to rectification request
   */
  private async processRectificationRequest(
    requestId: string,
    patientId: string,
    details?: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    // Rectification requires manual review
    await prisma.dataAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'processing',
        requestData: details ? { details } : undefined,
      },
    });

    return {
      success: true,
      requestId,
      message: 'Rectification request submitted for review. A data administrator will process your request.',
    };
  }

  /**
   * Process right to erasure request
   */
  private async processErasureRequest(
    requestId: string,
    patientId: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    // Check if patient has active medical records (erasure may be restricted)
    const activeRecords = await prisma.appointment.count({
      where: {
        patientId,
        status: { in: ['Pending', 'Confirmed'] },
      },
    });

    if (activeRecords > 0) {
      await this.updateRequestStatus(requestId, 'rejected', 'Cannot erase patient data with active appointments');
      return {
        success: false,
        requestId,
        message: 'Cannot process erasure request: Patient has active medical appointments. Please complete or cancel all appointments first.',
      };
    }

    // Erasure requires manual review for medical data
    await prisma.dataAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'processing',
      },
    });

    return {
      success: true,
      requestId,
      message: 'Erasure request submitted for review. Medical data retention requirements will be evaluated.',
    };
  }

  /**
   * Process right to data portability request
   */
  private async processPortabilityRequest(
    requestId: string,
    patientId: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    // Similar to access request but in machine-readable format
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        appointments: true,
        labRequests: true,
        prescriptions: true,
        clinicalVitals: true,
      },
    });

    if (!patient) {
      await this.updateRequestStatus(requestId, 'rejected', 'Patient not found');
      return {
        success: false,
        requestId,
        message: 'Patient not found',
      };
    }

    // Create FHIR-compatible export
    const fhirExport = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: patient.id,
            name: [{ text: patient.name }],
            gender: patient.gender,
            birthDate: patient.dob.toISOString().split('T')[0],
            telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : [],
          },
        },
        ...patient.appointments.map((apt) => ({
          resource: {
            resourceType: 'Appointment',
            id: apt.id,
            status: apt.status.toLowerCase(),
            start: (apt.scheduledAt ?? apt.appointmentDate).toISOString(),
            description: apt.type ?? 'appointment',
          },
        })),
      ],
    };

    await prisma.dataAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        responseData: fhirExport,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      requestId,
      message: 'Data portability request completed. Data exported in FHIR format.',
    };
  }

  /**
   * Process right to restriction request
   */
  private async processRestrictionRequest(
    requestId: string,
    _patientId: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    // Restriction requires manual review
    await prisma.dataAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'processing',
      },
    });

    return {
      success: true,
      requestId,
      message: 'Restriction request submitted for review. Processing will be restricted pending review.',
    };
  }

  /**
   * Process right to object request
   */
  private async processObjectRequest(
    requestId: string,
    _patientId: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    // Objection requires manual review
    await prisma.dataAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'processing',
      },
    });

    return {
      success: true,
      requestId,
      message: 'Objection request submitted for review. Data processing will be evaluated.',
    };
  }

  /**
   * Update request status
   */
  private async updateRequestStatus(
    requestId: string,
    status: string,
    reason?: string
  ): Promise<void> {
    await prisma.dataAccessRequest.update({
      where: { id: requestId },
      data: {
        status,
        rejectionReason: reason,
        completedAt: status !== 'pending' && status !== 'processing' ? new Date() : undefined,
      },
    });
  }

  /**
   * Record data breach
   */
  async recordDataBreach(
    breach: GDPRDataBreach,
    hospitalId: string
  ): Promise<{ success: boolean; breachId: string }> {
    try {
      const breachId = crypto.randomUUID();

      await prisma.dataBreachLog.create({
        data: {
          id: breachId,
          hospitalId,
          breachType: breach.breachType,
          severity: breach.severity,
          description: breach.description,
          affectedRecords: breach.affectedDataSubjects,
          detectedAt: new Date(),
          status: 'investigating',
        },
      });

      logger.warn('GDPR data breach recorded', {
        breachId,
        type: breach.breachType,
        severity: breach.severity,
        affectedDataSubjects: breach.affectedDataSubjects,
        hospitalId,
      });

      // For high/critical breaches, immediate notification is required
      if (breach.severity === 'high' || breach.severity === 'critical') {
        await this.notifyDataProtectionAuthority({
          breachId,
          ...breach,
          hospitalId,
        });
      }

      return { success: true, breachId };
    } catch (error) {
      logger.error('Failed to record GDPR data breach', {
        error: error instanceof Error ? error.message : String(error),
        breach,
      });

      return { success: false, breachId: '' };
    }
  }

  /**
   * Notify Data Protection Authority
   */
  private async notifyDataProtectionAuthority(data: GDPRDataBreach & { breachId: string; hospitalId: string }): Promise<void> {
    // In production, this would send notification to relevant authority
    logger.error('GDPR data breach notification to authority required', {
      breachId: data.breachId,
      severity: data.severity,
      description: data.description,
      affectedDataSubjects: data.affectedDataSubjects,
      dpoContact: {
        name: process.env.DPO_NAME || 'Data Protection Officer',
        email: process.env.DPO_EMAIL || 'dpo@afyahero.com',
        phone: process.env.DPO_PHONE || '+254-700-000-000',
      },
    });

    // TODO: Implement actual notification to authority
  }

  /**
   * Record GDPR consent
   */
  async recordConsent(consent: GDPRConsentRecord): Promise<{ success: boolean; consentId: string }> {
    try {
      const consentId = crypto.randomUUID();

      await prisma.dataConsent.create({
        data: {
          id: consentId,
          patientId: consent.patientId,
          consentType: consent.consentType,
          granted: consent.granted,
          grantedAt: consent.granted ? new Date() : null,
          withdrawnAt: !consent.granted ? new Date() : null,
          ipAddress: consent.ipAddress,
          userAgent: consent.userAgent,
        },
      });

      logger.info('GDPR consent recorded', {
        consentId,
        patientId: consent.patientId,
        consentType: consent.consentType,
        granted: consent.granted,
      });

      return { success: true, consentId };
    } catch (error) {
      logger.error('Failed to record GDPR consent', {
        error: error instanceof Error ? error.message : String(error),
        consent,
      });

      return { success: false, consentId: '' };
    }
  }

  /**
   * Get current consent status for a patient
   */
  async getConsentStatus(patientId: string): Promise<Record<string, boolean>> {
    const consents = await prisma.dataConsent.findMany({
      where: { patientId },
      select: {
        consentType: true,
        granted: true,
      },
    });

    const status: Record<string, boolean> = {};
    for (const consent of consents) {
      status[consent.consentType] = consent.granted;
    }

    return status;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    patientId: string,
    consentType: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find active consent
      const existingConsent = await prisma.dataConsent.findFirst({
        where: {
          patientId,
          consentType,
          granted: true,
          withdrawnAt: null,
        },
      });

      if (!existingConsent) {
        return {
          success: false,
          message: 'No active consent found to withdraw',
        };
      }

      // Update consent
      await prisma.dataConsent.update({
        where: { id: existingConsent.id },
        data: {
          granted: false,
          withdrawnAt: new Date(),
        },
      });

      logger.info('GDPR consent withdrawn', {
        patientId,
        consentType,
        consentId: existingConsent.id,
      });

      return {
        success: true,
        message: 'Consent withdrawn successfully',
      };
    } catch (error) {
      logger.error('Failed to withdraw GDPR consent', {
        error: error instanceof Error ? error.message : String(error),
        patientId,
        consentType,
      });

      return {
        success: false,
        message: 'Failed to withdraw consent',
      };
    }
  }

  /**
   * Perform Data Protection Impact Assessment (DPIA)
   */
  async performDPIA(
    assessment: {
      assessmentType: string;
      description: string;
      dataCategories: string[];
      processingActivities: string[];
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      mitigationMeasures: string;
    },
    context: { completedBy: string }
  ): Promise<DataProtectionImpactAssessment> {
    try {
      const assessmentId = crypto.randomUUID();

      const dpiA: DataProtectionImpactAssessment = {
        id: assessmentId,
        assessmentType: assessment.assessmentType,
        description: assessment.description,
        dataCategories: assessment.dataCategories,
        processingActivities: assessment.processingActivities,
        riskLevel: assessment.riskLevel,
        mitigationMeasures: assessment.mitigationMeasures,
        completedBy: context.completedBy,
        completedAt: new Date(),
      };

      await prisma.dataProtectionImpactAssessment.create({
        data: {
          id: assessmentId,
          assessmentType: assessment.assessmentType,
          description: assessment.description,
          dataCategories: assessment.dataCategories,
          processingActivities: assessment.processingActivities,
          riskLevel: assessment.riskLevel,
          mitigationMeasures: assessment.mitigationMeasures,
          completedBy: context.completedBy,
          completedAt: dpiA.completedAt,
        },
      });

      logger.info('DPIA performed', {
        assessmentId,
        assessmentType: assessment.assessmentType,
        riskLevel: assessment.riskLevel,
        completedBy: context.completedBy,
      });

      return dpiA;
    } catch (error) {
      logger.error('Failed to perform DPIA', {
        error: error instanceof Error ? error.message : String(error),
        assessment,
        context,
      });

      throw error;
    }
  }

  /**
   * Generate GDPR compliance report
   */
  async generateComplianceReport(hospitalId: string): Promise<{
    totalPatients: number;
    activeConsents: number;
    pendingRequests: number;
    dataBreaches: number;
    completedDPIAs: number;
    reportDate: string;
  }> {
    const [
      totalPatients,
      activeConsents,
      pendingRequests,
      dataBreaches,
      completedDPIAs,
    ] = await Promise.all([
      prisma.patient.count({ where: { hospitalId } }),
      prisma.dataConsent.count({
        where: { granted: true, withdrawnAt: null },
      }),
      prisma.dataAccessRequest.count({
        where: { status: { in: ['pending', 'processing'] } },
      }),
      prisma.dataBreachLog.count({
        where: { hospitalId, detectedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.dataProtectionImpactAssessment.count({
        where: { completedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return {
      totalPatients,
      activeConsents,
      pendingRequests,
      dataBreaches,
      completedDPIAs,
      reportDate: new Date().toISOString(),
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const gdprCompliance = new GDPRComplianceService();
export default gdprCompliance;
export { GDPRComplianceService };
