/**
 * ISO 27001 Compliance Module for AfyaHero Health
 * 
 * Provides ISO 27001 compliance measures:
 * - Information security management
 * - Risk assessment and treatment
 * - Security controls implementation
 * - Security awareness and training
 */

import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecurityControl {
  id: string;
  category: string;
  control: string;
  implementationStatus: 'not_implemented' | 'partial' | 'fully_implemented' | 'not_applicable';
  evidence?: string;
  lastAudit: Date;
  responsiblePerson: string;
}

export interface RiskAssessment {
  id: string;
  riskId: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high' | 'critical';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  treatment: 'accept' | 'avoid' | 'transfer' | 'mitigate';
  mitigationPlan: string;
  residualRisk: 'low' | 'medium' | 'high' | 'critical';
  assessedBy: string;
  assessedAt: Date;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  affectedSystems: string[];
  detectedAt: Date;
  reportedBy: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  resolvedAt?: Date;
}

export interface SecurityTraining {
  id: string;
  employeeId: string;
  trainingType: string;
  completedAt: Date;
  expiresAt: Date;
  certified: boolean;
}

// ─── ISO 27001 Compliance Service ─────────────────────────────────────────────

class ISO27001ComplianceService {
  /**
   * Get security control status
   */
  async getSecurityControlStatus(
    controlId: string
  ): Promise<SecurityControl> {
    try {
      // In production, this would query a security_controls table
      // For now, return mock data
      return {
        id: controlId,
        category: 'Access Control',
        control: 'User access management',
        implementationStatus: 'fully_implemented',
        lastAudit: new Date(),
        responsiblePerson: 'Security Officer',
      };
    } catch (error) {
      logger.error('Failed to get security control status', {
        error: error instanceof Error ? error.message : String(error),
        controlId,
      });

      throw error;
    }
  }

  /**
   * Perform risk assessment
   */
  async performRiskAssessment(
    risk: {
      description: string;
      likelihood: 'low' | 'medium' | 'high' | 'critical';
      impact: 'low' | 'medium' | 'high' | 'critical';
      treatment: 'accept' | 'avoid' | 'transfer' | 'mitigate';
      mitigationPlan: string;
    },
    context: { assessedBy: string }
  ): Promise<RiskAssessment> {
    try {
      const riskId = crypto.randomUUID();

      // Calculate risk level
      const riskLevelMap: Record<string, Record<string, 'low' | 'medium' | 'high' | 'critical'>> = {
        low: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' },
        medium: { low: 'medium', medium: 'high', high: 'critical', critical: 'critical' },
        high: { low: 'high', medium: 'critical', high: 'critical', critical: 'critical' },
        critical: { low: 'critical', medium: 'critical', high: 'critical', critical: 'critical' },
      };

      const riskLevel = riskLevelMap[risk.likelihood][risk.impact];

      // Calculate residual risk (simplified)
      let residualRisk: 'low' | 'medium' | 'high' | 'critical' = riskLevel;
      if (risk.treatment === 'mitigate' && risk.mitigationPlan) {
        residualRisk = riskLevel === 'critical' ? 'high' : riskLevel === 'high' ? 'medium' : 'low';
      }

      const riskAssessment: RiskAssessment = {
        id: riskId,
        riskId,
        description: risk.description,
        likelihood: risk.likelihood,
        impact: risk.impact,
        riskLevel,
        treatment: risk.treatment,
        mitigationPlan: risk.mitigationPlan,
        residualRisk,
        assessedBy: context.assessedBy,
        assessedAt: new Date(),
      };

      // Save risk assessment
      await prisma.riskAssessment.create({
        data: {
          id: riskId,
          riskId,
          description: risk.description,
          likelihood: risk.likelihood,
          impact: risk.impact,
          riskLevel,
          treatment: risk.treatment,
          mitigationPlan: risk.mitigationPlan,
          residualRisk,
          assessedBy: context.assessedBy,
          assessedAt: riskAssessment.assessedAt,
        },
      });

      logger.info('Risk assessment performed', {
        riskId,
        description: risk.description,
        riskLevel,
        treatment: risk.treatment,
        assessedBy: context.assessedBy,
      });

      return riskAssessment;
    } catch (error) {
      logger.error('Failed to perform risk assessment', {
        error: error instanceof Error ? error.message : String(error),
        risk,
        context,
      });

      throw error;
    }
  }

  /**
   * Report security incident
   */
  async reportSecurityIncident(
    incident: {
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      category: string;
      affectedSystems: string[];
      reportedBy: string;
    }
  ): Promise<{ success: boolean; incidentId: string }> {
    try {
      const incidentId = crypto.randomUUID();

      const securityIncident: SecurityIncident = {
        id: incidentId,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        category: incident.category,
        affectedSystems: incident.affectedSystems,
        detectedAt: new Date(),
        reportedBy: incident.reportedBy,
        status: 'open',
      };

      await prisma.securityIncident.create({
        data: {
          id: incidentId,
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          category: incident.category,
          affectedSystems: incident.affectedSystems,
          detectedAt: securityIncident.detectedAt,
          reportedBy: incident.reportedBy,
          status: 'open',
        },
      });

      logger.warn('Security incident reported', {
        incidentId,
        title: incident.title,
        severity: incident.severity,
        category: incident.category,
        reportedBy: incident.reportedBy,
      });

      // For critical incidents, immediate notification
      if (incident.severity === 'critical') {
        await this.notifySecurityTeam(incident);
      }

      return {
        success: true,
        incidentId,
      };
    } catch (error) {
      logger.error('Failed to report security incident', {
        error: error instanceof Error ? error.message : String(error),
        incident,
      });

      return {
        success: false,
        incidentId: '',
      };
    }
  }

  /**
   * Notify security team about critical incidents
   */
  private async notifySecurityTeam(incident: {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    affectedSystems: string[];
    reportedBy: string;
  }): Promise<void> {
    // In production, this would send notification to security team
    logger.error('Critical security incident - immediate attention required', {
      title: incident.title,
      severity: incident.severity,
      category: incident.category,
      affectedSystems: incident.affectedSystems,
      reportedBy: incident.reportedBy,
    });

    // TODO: Implement actual notification (email, SMS, etc.)
  }

  /**
   * Get security training status
   */
  async getSecurityTrainingStatus(
    employeeId: string
  ): Promise<SecurityTraining[]> {
    try {
      // In production, this would query a security_training table
      // For now, return mock data
      return [
        {
          id: crypto.randomUUID(),
          employeeId,
          trainingType: 'Information Security Awareness',
          completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          expiresAt: new Date(Date.now() + 330 * 24 * 60 * 60 * 1000), // 11 months from now
          certified: true,
        },
        {
          id: crypto.randomUUID(),
          employeeId,
          trainingType: 'Data Protection and Privacy',
          completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
          expiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000), // 10 months from now
          certified: true,
        },
      ];
    } catch (error) {
      logger.error('Failed to get security training status', {
        error: error instanceof Error ? error.message : String(error),
        employeeId,
      });

      return [];
    }
  }

  /**
   * Generate ISO 27001 compliance report
   */
  async generateComplianceReport(
    period: { start: Date; end: Date }
  ): Promise<{
    totalControls: number;
    implementedControls: number;
    partiallyImplementedControls: number;
    notImplementedControls: number;
    complianceScore: number;
    totalRisks: number;
    highRisks: number;
    securityIncidents: number;
    reportDate: Date;
  }> {
    try {
      // Get security control statistics
      const controls = await prisma.securityControl.findMany({
        where: {
          lastAudit: { gte: period.start, lte: period.end },
        },
      });

      const totalControls = controls.length;
      const implementedControls = controls.filter((c) => c.implementationStatus === 'fully_implemented').length;
      const partiallyImplementedControls = controls.filter((c) => c.implementationStatus === 'partial').length;
      const notImplementedControls = controls.filter((c) => c.implementationStatus === 'not_implemented').length;

      // Calculate compliance score
      const complianceScore = (implementedControls / totalControls) * 100 || 0;

      // Get risk statistics
      const risks = await prisma.riskAssessment.findMany({
        where: {
          assessedAt: { gte: period.start, lte: period.end },
        },
      });

      const totalRisks = risks.length;
      const highRisks = risks.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').length;

      // Get security incident statistics
      const incidents = await prisma.securityIncident.findMany({
        where: {
          detectedAt: { gte: period.start, lte: period.end },
        },
      });

      const securityIncidents = incidents.length;

      return {
        totalControls,
        implementedControls,
        partiallyImplementedControls,
        notImplementedControls,
        complianceScore,
        totalRisks,
        highRisks,
        securityIncidents,
        reportDate: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate compliance report', {
        error: error instanceof Error ? error.message : String(error),
        period,
      });

      return {
        totalControls: 0,
        implementedControls: 0,
        partiallyImplementedControls: 0,
        notImplementedControls: 0,
        complianceScore: 0,
        totalRisks: 0,
        highRisks: 0,
        securityIncidents: 0,
        reportDate: new Date(),
      };
    }
  }

  /**
   * Check if security controls are up to date
   */
  async checkControlUpdates(): Promise<{
    outdatedControls: string[];
    upcomingReviews: string[];
    reviewSchedule: { controlId: string; nextReview: Date }[];
  }> {
    try {
      const controls = await prisma.securityControl.findMany({
        where: {
          lastAudit: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }, // Older than 1 year
        },
      });

      const outdatedControls = controls.map((c: { id: string }) => c.id);

      // Get controls due for review in next 30 days
      const upcomingReviews = await prisma.securityControl.findMany({
        where: {
          lastAudit: { gte: new Date(Date.now() - 335 * 24 * 60 * 60 * 1000) }, // Between 11 months and 1 year
        },
      });

      const reviewSchedule = upcomingReviews.map((c: { id: string; lastAudit: Date }) => ({
        controlId: c.id,
        nextReview: new Date(c.lastAudit.getTime() + 365 * 24 * 60 * 60 * 1000),
      }));

      return {
        outdatedControls,
        upcomingReviews: upcomingReviews.map((c: { id: string }) => c.id),
        reviewSchedule,
      };
    } catch (error) {
      logger.error('Failed to check control updates', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        outdatedControls: [],
        upcomingReviews: [],
        reviewSchedule: [],
      };
    }
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const iso27001Compliance = new ISO27001ComplianceService();
export default iso27001Compliance;
export { ISO27001ComplianceService };

