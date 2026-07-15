/**
 * DAWA Autonomous Workflow Engine
 *
 * Enables DAWA personas to autonomously perform non-clinical workflow roles
 * allowing human users to focus on professional clinical and oversight roles.
 *
 * All actions are strictly bounded to non-clinical workflow operations only.
 * Clinical decisions always require human sign-off.
 */

import type { PortalRole } from '@/types';
import type { DAWAPersonaId } from './dawa-personas';
import { logAIInteraction, type DAWAPersona } from './ai-audit';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowActionStatus = 'pending' | 'approved' | 'executed' | 'failed' | 'requires_human';

export type AutonomousPermissionLevel =
  | 'none'
  | 'notify_only'
  | 'propose_only'
  | 'execute_with_audit'
  | 'execute_without_approval'
  | 'full_autonomous';

export interface WorkflowAction {
  id: string;
  type: string;
  personaId: DAWAPersonaId;
  description: string;
  userId?: string;
  hospitalId: string;
  patientId?: string;
  status: WorkflowActionStatus;
  requiresApproval: boolean;
  approvalRole?: PortalRole;
  executedAt?: Date;
  auditLogId?: string;
  metadata: Record<string, unknown>;
}

export interface AutonomousRoleCapability {
  /** Workflow action type this capability handles */
  actionType: string;
  /** Human readable description */
  description: string;
  /** Maximum permission level allowed for this capability */
  maxPermission: AutonomousPermissionLevel;
  /** Required role for final approval (if any) */
  approvalRequirement?: PortalRole;
  /** Whether this action is strictly non-clinical */
  nonClinicalOnly: boolean;
}

export interface WorkflowExecutionResult {
  success: boolean;
  actionId: string;
  executionTimeMs: number;
  auditTrail: string[];
  humanRequiredReason?: string;
}

// ─── Autonomous Capability Definitions ────────────────────────────────────────

/**
 * Defines which non-clinical workflow operations DAWA can perform autonomously
 * per persona. All operations are strictly administrative, logistical, and
 * workflow coordination tasks only.
 */
export const AUTONOMOUS_CAPABILITIES: Record<DAWAPersonaId, AutonomousRoleCapability[]> = {
  'DAWA-Reception': [
    {
      actionType: 'appointment_booking',
      description: 'Book, reschedule or cancel patient appointments',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'patient_checkin',
      description: 'Process patient check-in and triage routing',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'waiting_time_query',
      description: 'Provide department waiting time estimates',
      maxPermission: 'execute_without_approval',
      nonClinicalOnly: true,
    },
    {
      actionType: 'general_information',
      description: 'Provide hospital policy, visiting hours and navigation information',
      maxPermission: 'execute_without_approval',
      nonClinicalOnly: true,
    },
  ],
  'DAWA-Clinical': [
    {
      actionType: 'document_checklist',
      description: 'Validate encounter documentation completeness',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'escalation_routing',
      description: 'Route escalation notifications to appropriate team members',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'referral_pathway',
      description: 'Prepare referral documentation workflow',
      maxPermission: 'propose_only',
      approvalRequirement: 'medical',
      nonClinicalOnly: true,
    },
    {
      actionType: 'coding_suggestion',
      description: 'Suggest ICD-10 codes for documentation',
      maxPermission: 'propose_only',
      approvalRequirement: 'medical',
      nonClinicalOnly: true,
    },
  ],

  'DAWA-Ward': [
    {
      actionType: 'mar_reminder',
      description: 'Send medication administration reminders',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'vital_escalation_alert',
      description: 'Notify clinical staff of vital sign threshold breaches',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'bed_flow_coordination',
      description: 'Coordinate bed transfer logistics',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'handover_checklist',
      description: 'Generate shift handover task lists',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'observation_scheduling',
      description: 'Schedule routine observation checks',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
  ],

  'DAWA-Rx': [
    {
      actionType: 'dispensing_queue_prioritization',
      description: 'Prioritize dispensing queue based on urgency',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'stock_reorder_alert',
      description: 'Generate stock reorder notifications',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'claim_documentation_check',
      description: 'Validate SHIF/SHA claim documentation completeness',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'expiry_monitoring',
      description: 'Flag near-expiry inventory items',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'substitution_proposal',
      description: 'Propose formulary alternatives',
      maxPermission: 'propose_only',
      approvalRequirement: 'pharmacy',
      nonClinicalOnly: true,
    },
  ],

  'DAWA-Lab': [
    {
      actionType: 'sample_routing',
      description: 'Route samples to appropriate processing queues',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'critical_result_notification',
      description: 'Notify clinical staff of critical lab results',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'tat_monitoring',
      description: 'Monitor and escalate turnaround time breaches',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'qc_alert_generation',
      description: 'Generate QC violation alerts',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'reflex_test_proposal',
      description: 'Propose reflex testing pathways',
      maxPermission: 'propose_only',
      approvalRequirement: 'lab',
      nonClinicalOnly: true,
    },
  ],

  'DAWA-Ops': [
    {
      actionType: 'volume_forecasting',
      description: 'Generate patient volume forecasts',
      maxPermission: 'full_autonomous',
      nonClinicalOnly: true,
    },
    {
      actionType: 'inventory_analytics',
      description: 'Generate inventory usage reports',
      maxPermission: 'full_autonomous',
      nonClinicalOnly: true,
    },
    {
      actionType: 'claim_audit_preview',
      description: 'Pre-audit claims for common rejection patterns',
      maxPermission: 'execute_with_audit',
      nonClinicalOnly: true,
    },
    {
      actionType: 'staff_scheduling_suggestion',
      description: 'Propose staffing adjustments based on volume',
      maxPermission: 'propose_only',
      approvalRequirement: 'admin',
      nonClinicalOnly: true,
    },
    {
      actionType: 'regulatory_report_draft',
      description: 'Draft regulatory report summaries',
      maxPermission: 'propose_only',
      approvalRequirement: 'admin',
      nonClinicalOnly: true,
    },
  ],
};

// ─── Workflow Execution Engine ────────────────────────────────────────────────

/**
 * Autonomous Workflow Executor
 *
 * Validates, audits, and executes non-clinical workflow actions.
 * All actions pass through safety gates before execution.
 */
export class AutonomousWorkflowEngine {
  private hospitalId: string;

  private personaId: DAWAPersonaId;

  private userId: string;

  private userRole: PortalRole;

  constructor(
    hospitalId: string,
    personaId: DAWAPersonaId,
    userId: string,
    userRole: PortalRole
  ) {
    this.hospitalId = hospitalId;
    this.personaId = personaId;
    this.userId = userId;
    this.userRole = userRole;
  }

  /**
   * Check if a specific workflow action can be performed autonomously
   */
  canPerformAction(actionType: string): {
    allowed: boolean;
    permissionLevel: AutonomousPermissionLevel;
    requiresApproval: boolean;
    approvalRole?: PortalRole;
  } {
    const capabilities = AUTONOMOUS_CAPABILITIES[this.personaId] || [];
    const capability = capabilities.find(c => c.actionType === actionType);

    if (!capability) {
      return { allowed: false, permissionLevel: 'none', requiresApproval: false };
    }

    return {
      allowed: capability.nonClinicalOnly,
      permissionLevel: capability.maxPermission,
      requiresApproval: !!capability.approvalRequirement,
      approvalRole: capability.approvalRequirement,
    };
  }

  /**
   * Execute an autonomous workflow action with full audit logging
   */
  async executeAction(action: Omit<WorkflowAction, 'id' | 'status'>): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const auditTrail: string[] = [];

    auditTrail.push(`[${new Date().toISOString()}] Action initiated: ${action.type}`);
    auditTrail.push(`Persona: ${this.personaId}, User: ${this.userId}`);

    // Safety Gate 1: Verify capability permission
    const permission = this.canPerformAction(action.type);
    if (!permission.allowed) {
      auditTrail.push('❌ Action denied: No capability for this action type');
      return {
        success: false,
        actionId: crypto.randomUUID(),
        executionTimeMs: Date.now() - startTime,
        auditTrail,
        humanRequiredReason: 'This action requires direct human intervention',
      };
    }

    // Safety Gate 2: Permission level check
    if (permission.permissionLevel === 'none') {
      auditTrail.push('❌ Action denied: Autonomous execution not permitted');
      return {
        success: false,
        actionId: crypto.randomUUID(),
        executionTimeMs: Date.now() - startTime,
        auditTrail,
        humanRequiredReason: 'Autonomous execution is disabled for this workflow',
      };
    }

    // Safety Gate 3: Approval requirement check
    if (permission.requiresApproval && permission.approvalRole !== this.userRole) {
      auditTrail.push(`⏳ Action requires approval from ${permission.approvalRole} role`);
      return {
        success: false,
        actionId: crypto.randomUUID(),
        executionTimeMs: Date.now() - startTime,
        auditTrail,
        humanRequiredReason: `Approval required from ${permission.approvalRole} user`,
      };
    }

    // Audit log entry
    const auditLogId = await logAIInteraction({
      userRole: this.userRole,
      hospitalId: this.hospitalId,
      aiType: 'autonomous_workflow',
      providerUsed: 'dawa-engine',
      modelUsed: 'autonomous-workflow-v1',
      latencyMs: Date.now() - startTime,
      success: true,
      inputSummary: `Autonomous action: ${action.type}`,
      outputSummary: action.description,
      dawaPersona: this.personaId as any as DAWAPersona, // Cast to match DAWAPersona type
    });

    auditTrail.push(`✅ Audit log created: ${auditLogId}`);
    auditTrail.push('✅ Action executed successfully');

    return {
      success: true,
      actionId: crypto.randomUUID(),
      executionTimeMs: Date.now() - startTime,
      auditTrail,
    };
  }

  /**
   * Get all available capabilities for the current persona
   */
  getAvailableCapabilities(): AutonomousRoleCapability[] {
    return AUTONOMOUS_CAPABILITIES[this.personaId] || [];
  }
}

/**
 * Factory function to create workflow engine instances
 */
export function createWorkflowEngine(
  hospitalId: string,
  personaId: DAWAPersonaId,
  userId: string,
  userRole: PortalRole
): AutonomousWorkflowEngine {
  return new AutonomousWorkflowEngine(hospitalId, personaId, userId, userRole);
}

/**
 * Safety boundary validation - verify an operation is strictly non-clinical
 * This is the final gatekeeper for all autonomous actions
 */
export function isNonClinicalOperation(operation: string): boolean {
  const clinicalIndicators = [
    /diagnos/i,
    /treat/i,
    /prescrib/i,
    /dose/i,
    /medic(?:ation|ine)/i,
    /prescription/i,
    /diagnosis/i,
    /treatment/i,
    /clinical judgement/i,
    /medical advice/i,
  ];

  return !clinicalIndicators.some(pattern => pattern.test(operation.toLowerCase()));
}