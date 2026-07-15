/**
 * Role-Based Access Control (RBAC) System for AfyaHero Health
 * 
 * Provides granular permission management:
 * - Define all roles and their permissions
 * - Resource-level access control
 * - Hospital-scoped permissions
 * - Permission validation middleware
 */

import type { PortalRole, UserSession } from '@/types';
import type { NextRequest } from 'next/server';
import { parseSignedSession } from '@/lib/session';

function validateSessionToken(token: string): Promise<UserSession | null> {
  return Promise.resolve(parseSignedSession(token));
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Permission categories for different resource types
 */
export type PermissionCategory = 
  | 'patients'
  | 'appointments'
  | 'labs'
  | 'pharmacy'
  | 'billing'
  | 'reports'
  | 'users'
  | 'settings'
  | 'inventory'
  | 'beds'
  | 'queue'
  | 'handover'
  | 'teleconsult'
  | 'ai'
  | 'audit';

/**
 * Permission actions that can be performed on resources
 */
export type PermissionAction = 
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'verify'
  | 'dispense'
  | 'prescribe'
  | 'bill'
  | 'refund'
  | 'export'
  | 'admin';

/**
 * A permission is a combination of category and action
 */
export interface Permission {
  category: PermissionCategory;
  actions: PermissionAction[];
}

/**
 * Role definition with all its permissions
 */
export interface RoleDefinition {
  role: PortalRole;
  label: string;
  description: string;
  permissions: Permission[];
  canAccessHospitalData: boolean;
  canAccessOwnData: boolean;
  canSuperviseRoles: PortalRole[];
}

/**
 * Resource access check result
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  missingPermissions?: string[];
}

// ─── Permission Definitions ───────────────────────────────────────────────────

/**
 * All available permissions in the system
 */
export const PERMISSIONS = {
  // Patient permissions
  PATIENT_CREATE: { category: 'patients', actions: ['create'] },
  PATIENT_READ: { category: 'patients', actions: ['read'] },
  PATIENT_UPDATE: { category: 'patients', actions: ['update'] },
  PATIENT_DELETE: { category: 'patients', actions: ['delete'] },
  
  // Appointment permissions
  APPOINTMENT_CREATE: { category: 'appointments', actions: ['create'] },
  APPOINTMENT_READ: { category: 'appointments', actions: ['read'] },
  APPOINTMENT_UPDATE: { category: 'appointments', actions: ['update'] },
  APPOINTMENT_DELETE: { category: 'appointments', actions: ['delete'] },
  
  // Lab permissions
  LAB_CREATE: { category: 'labs', actions: ['create'] },
  LAB_READ: { category: 'labs', actions: ['read'] },
  LAB_UPDATE: { category: 'labs', actions: ['update'] },
  LAB_VERIFY: { category: 'labs', actions: ['verify'] },
  LAB_DELETE: { category: 'labs', actions: ['delete'] },
  
  // Pharmacy permissions
  PHARMACY_READ: { category: 'pharmacy', actions: ['read'] },
  PHARMACY_PRESCRIBE: { category: 'pharmacy', actions: ['prescribe'] },
  PHARMACY_DISPENSE: { category: 'pharmacy', actions: ['dispense'] },
  PHARMACY_INVENTORY: { category: 'pharmacy', actions: ['read', 'update'] },
  
  // Billing permissions
  BILLING_CREATE: { category: 'billing', actions: ['create', 'bill'] },
  BILLING_READ: { category: 'billing', actions: ['read'] },
  BILLING_UPDATE: { category: 'billing', actions: ['update'] },
  BILLING_REFUND: { category: 'billing', actions: ['refund'] },
  
  // Report permissions
  REPORTS_READ: { category: 'reports', actions: ['read'] },
  REPORTS_EXPORT: { category: 'reports', actions: ['export'] },
  
  // User management permissions
  USERS_READ: { category: 'users', actions: ['read'] },
  USERS_CREATE: { category: 'users', actions: ['create'] },
  USERS_UPDATE: { category: 'users', actions: ['update'] },
  USERS_APPROVE: { category: 'users', actions: ['approve'] },
  USERS_DELETE: { category: 'users', actions: ['delete'] },
  
  // Settings permissions
  SETTINGS_READ: { category: 'settings', actions: ['read'] },
  SETTINGS_UPDATE: { category: 'settings', actions: ['update'] },
  
  // Inventory permissions
  INVENTORY_READ: { category: 'inventory', actions: ['read'] },
  INVENTORY_UPDATE: { category: 'inventory', actions: ['update'] },
  
  // Bed management permissions
  BEDS_READ: { category: 'beds', actions: ['read'] },
  BEDS_UPDATE: { category: 'beds', actions: ['update'] },
  
  // Queue management permissions
  QUEUE_READ: { category: 'queue', actions: ['read'] },
  QUEUE_UPDATE: { category: 'queue', actions: ['update'] },
  
  // Handover permissions
  HANDOVER_READ: { category: 'handover', actions: ['read'] },
  HANDOVER_CREATE: { category: 'handover', actions: ['create'] },
  HANDOVER_UPDATE: { category: 'handover', actions: ['update'] },
  
  // Teleconsult permissions
  TELECONSULT_READ: { category: 'teleconsult', actions: ['read'] },
  TELECONSULT_CREATE: { category: 'teleconsult', actions: ['create'] },
  TELECONSULT_UPDATE: { category: 'teleconsult', actions: ['update'] },
  
  // AI permissions
  AI_USE: { category: 'ai', actions: ['read'] },
  AI_ADMIN: { category: 'ai', actions: ['read', 'update', 'admin'] },
  
  // Audit permissions
  AUDIT_READ: { category: 'audit', actions: ['read'] },
  AUDIT_EXPORT: { category: 'audit', actions: ['export'] },
} as const;

// ─── Role Definitions ─────────────────────────────────────────────────────────

/**
 * Define permissions for each role
 */
export const ROLE_DEFINITIONS: Record<PortalRole, RoleDefinition> = {
  reception: {
    role: 'reception',
    label: 'Reception',
    description: 'Front desk staff responsible for patient registration and billing',
    canAccessHospitalData: true,
    canAccessOwnData: true,
    canSuperviseRoles: [],
    permissions: [
      // Patient management
      { category: 'patients', actions: ['create', 'read', 'update'] },
      // Appointment management
      { category: 'appointments', actions: ['create', 'read', 'update'] },
      // Queue management
      { category: 'queue', actions: ['read', 'update'] },
      // Billing
      { category: 'billing', actions: ['create', 'read', 'bill'] },
      // Reports (limited)
      { category: 'reports', actions: ['read'] },
      // Handover
      { category: 'handover', actions: ['read', 'create'] },
      // Own data
      { category: 'users', actions: ['read'] },
    ],
  },
  
  medical: {
    role: 'medical',
    label: 'Medical',
    description: 'Clinical staff including doctors and nurses',
    canAccessHospitalData: true,
    canAccessOwnData: true,
    canSuperviseRoles: ['reception'],
    permissions: [
      // Full patient access
      { category: 'patients', actions: ['create', 'read', 'update'] },
      // Appointment management
      { category: 'appointments', actions: ['create', 'read', 'update'] },
      // Lab orders and results
      { category: 'labs', actions: ['create', 'read', 'update'] },
      // Prescriptions
      { category: 'pharmacy', actions: ['read', 'prescribe'] },
      // Clinical reports
      { category: 'reports', actions: ['read'] },
      // Bed management
      { category: 'beds', actions: ['read', 'update'] },
      // Queue management
      { category: 'queue', actions: ['read', 'update'] },
      // Handover
      { category: 'handover', actions: ['read', 'create', 'update'] },
      // Teleconsult
      { category: 'teleconsult', actions: ['read', 'create', 'update'] },
      // AI assistance
      { category: 'ai', actions: ['read'] },
      // Vitals and clinical data
      { category: 'patients', actions: ['create', 'read', 'update'] },
    ],
  },
  
  lab: {
    role: 'lab',
    label: 'Laboratory',
    description: 'Lab technicians responsible for sample processing and results',
    canAccessHospitalData: true,
    canAccessOwnData: true,
    canSuperviseRoles: [],
    permissions: [
      // Patient info (read-only for lab context)
      { category: 'patients', actions: ['read'] },
      // Full lab access
      { category: 'labs', actions: ['create', 'read', 'update', 'verify'] },
      // Lab inventory
      { category: 'inventory', actions: ['read', 'update'] },
      // Reports (lab-related)
      { category: 'reports', actions: ['read'] },
      // Handover
      { category: 'handover', actions: ['read', 'create'] },
      // AI assistance for lab analysis
      { category: 'ai', actions: ['read'] },
    ],
  },
  
  pharmacy: {
    role: 'pharmacy',
    label: 'Pharmacy',
    description: 'Pharmacy staff responsible for dispensing and inventory',
    canAccessHospitalData: true,
    canAccessOwnData: true,
    canSuperviseRoles: [],
    permissions: [
      // Patient info (read-only for pharmacy context)
      { category: 'patients', actions: ['read'] },
      // Prescription dispensing
      { category: 'pharmacy', actions: ['read', 'dispense'] },
      // Full inventory access
      { category: 'inventory', actions: ['read', 'update'] },
      // Reports (pharmacy-related)
      { category: 'reports', actions: ['read'] },
      // Handover
      { category: 'handover', actions: ['read', 'create'] },
      // AI assistance for drug interactions
      { category: 'ai', actions: ['read'] },
    ],
  },
  
  admin: {
    role: 'admin',
    label: 'Administrator',
    description: 'Hospital administrator with full access to all systems',
    canAccessHospitalData: true,
    canAccessOwnData: true,
    canSuperviseRoles: ['reception', 'medical', 'lab', 'pharmacy'],
    permissions: [
      // Full patient access
      { category: 'patients', actions: ['create', 'read', 'update', 'delete'] },
      // Full appointment access
      { category: 'appointments', actions: ['create', 'read', 'update', 'delete'] },
      // Full lab access
      { category: 'labs', actions: ['create', 'read', 'update', 'verify', 'delete'] },
      // Full pharmacy access
      { category: 'pharmacy', actions: ['read', 'prescribe', 'dispense'] },
      // Full billing access
      { category: 'billing', actions: ['create', 'read', 'update', 'bill', 'refund'] },
      // Full reports access
      { category: 'reports', actions: ['read', 'export'] },
      // Full user management
      { category: 'users', actions: ['read', 'create', 'update', 'approve'] },
      // Full settings access
      { category: 'settings', actions: ['read', 'update'] },
      // Full inventory access
      { category: 'inventory', actions: ['read', 'update'] },
      // Full bed management
      { category: 'beds', actions: ['read', 'update'] },
      // Full queue management
      { category: 'queue', actions: ['read', 'update'] },
      // Full handover access
      { category: 'handover', actions: ['read', 'create', 'update'] },
      // Full teleconsult access
      { category: 'teleconsult', actions: ['read', 'create', 'update'] },
      // Full AI access
      { category: 'ai', actions: ['read', 'update', 'admin'] },
      // Audit logs
      { category: 'audit', actions: ['read', 'export'] },
    ],
  },
  
  super_admin: {
    role: 'super_admin',
    label: 'Super Administrator',
    description: 'Platform super administrator with cross-facility access',
    canAccessHospitalData: true,
    canAccessOwnData: true,
    canSuperviseRoles: ['reception', 'medical', 'lab', 'pharmacy', 'admin'],
    permissions: [
      // Full patient access
      { category: 'patients', actions: ['create', 'read', 'update', 'delete'] },
      // Full appointment access
      { category: 'appointments', actions: ['create', 'read', 'update', 'delete'] },
      // Full lab access
      { category: 'labs', actions: ['create', 'read', 'update', 'verify', 'delete'] },
      // Full pharmacy access
      { category: 'pharmacy', actions: ['read', 'prescribe', 'dispense'] },
      // Full billing access
      { category: 'billing', actions: ['create', 'read', 'update', 'bill', 'refund'] },
      // Full reports access
      { category: 'reports', actions: ['read', 'export'] },
      // Full user management
      { category: 'users', actions: ['read', 'create', 'update', 'approve'] },
      // Full settings access
      { category: 'settings', actions: ['read', 'update'] },
      // Full inventory access
      { category: 'inventory', actions: ['read', 'update'] },
      // Full bed management
      { category: 'beds', actions: ['read', 'update'] },
      // Full queue management
      { category: 'queue', actions: ['read', 'update'] },
      // Full handover access
      { category: 'handover', actions: ['read', 'create', 'update'] },
      // Full teleconsult access
      { category: 'teleconsult', actions: ['read', 'create', 'update'] },
      // Full AI access
      { category: 'ai', actions: ['read', 'update', 'admin'] },
      // Audit logs
      { category: 'audit', actions: ['read', 'export'] },
      // Platform settings
      { category: 'settings', actions: ['read', 'create', 'update', 'delete'] },
    ],
  },
};

// ─── Permission Checking Functions ────────────────────────────────────────────

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: PortalRole,
  category: PermissionCategory,
  action: PermissionAction
): boolean {
  const roleDef = ROLE_DEFINITIONS[role];
  if (!roleDef) return false;
  
  return roleDef.permissions.some(
    perm => perm.category === category && perm.actions.includes(action)
  );
}

/**
 * Check if a role has multiple permissions (all must be present)
 */
export function hasAllPermissions(
  role: PortalRole,
  requiredPermissions: Array<{ category: PermissionCategory; actions: PermissionAction[] }>
): boolean {
  return requiredPermissions.every(req => {
    const roleDef = ROLE_DEFINITIONS[role];
    if (!roleDef) return false;
    
    return req.actions.every(action =>
      roleDef.permissions.some(
        perm => perm.category === req.category && perm.actions.includes(action)
      )
    );
  });
}

/**
 * Check if a role has any of the required permissions
 */
export function hasAnyPermission(
  role: PortalRole,
  requiredPermissions: Array<{ category: PermissionCategory; actions: PermissionAction[] }>
): boolean {
  return requiredPermissions.some(req => {
    const roleDef = ROLE_DEFINITIONS[role];
    if (!roleDef) return false;
    
    return req.actions.some(action =>
      roleDef.permissions.some(
        perm => perm.category === req.category && perm.actions.includes(action)
      )
    );
  });
}

/**
 * Check if a role can access a specific resource
 */
export function canAccessResource(
  role: PortalRole,
  resourceType: string,
  action: PermissionAction = 'read'
): AccessCheckResult {
  const category = resourceTypeToCategory(resourceType);
  if (!category) {
    return {
      allowed: false,
      reason: `Unknown resource type: ${resourceType}`,
    };
  }
  
  const allowed = hasPermission(role, category, action);
  
  if (!allowed) {
    const _roleDef = ROLE_DEFINITIONS[role];
    return {
      allowed: false,
      reason: `Role '${role}' does not have '${action}' permission for '${category}'`,
      missingPermissions: [`${category}:${action}`],
    };
  }
  
  return { allowed: true };
}

/**
 * Map resource types to permission categories
 */
function resourceTypeToCategory(resourceType: string): PermissionCategory | null {
  const mapping: Record<string, PermissionCategory> = {
    patient: 'patients',
    patients: 'patients',
    appointment: 'appointments',
    appointments: 'appointments',
    lab: 'labs',
    labs: 'labs',
    'lab-request': 'labs',
    pharmacy: 'pharmacy',
    prescription: 'pharmacy',
    prescriptions: 'pharmacy',
    billing: 'billing',
    invoice: 'billing',
    invoices: 'billing',
    report: 'reports',
    reports: 'reports',
    user: 'users',
    users: 'users',
    profile: 'users',
    profiles: 'users',
    setting: 'settings',
    settings: 'settings',
    inventory: 'inventory',
    'pharmacy-inventory': 'inventory',
    bed: 'beds',
    beds: 'beds',
    queue: 'queue',
    'hospital-queue': 'queue',
    handover: 'handover',
    'handover-notes': 'handover',
    teleconsult: 'teleconsult',
    'teleconsult-appointment': 'teleconsult',
    ai: 'ai',
    audit: 'audit',
    'audit-log': 'audit',
  };
  
  return mapping[resourceType.toLowerCase()] || null;
}

// ─── Hospital-Scoped Access Control ───────────────────────────────────────────

/**
 * Check if a user can access data from a specific hospital
 * This is used in addition to role-based permissions
 */
export function canAccessHospitalData(
  userHospitalId: string | null,
  targetHospitalId: string,
  userRole?: PortalRole
): boolean {
  // Super admin has access for ANONYMISED AGGREGATE queries only
  // Individual record access remains blocked
  if (userRole === 'super_admin') return true;

  // No hospital ID means no access to hospital-scoped data
  if (!userHospitalId) return false;
  
  // User can only access data from their own hospital
  return userHospitalId === targetHospitalId;
}

/**
 * Verify if request is from an authenticated global super admin
 * Super admins have NO hospital association
 */
export async function verifySuperAdmin(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    const session = await validateSessionToken(token);

    if (!session) return false;
    
    // Super admin MUST NOT have a hospitalId assigned
    return session.role === 'super_admin' && !session.hospitalId;
  } catch {
    return false;
  }
}

/**
 * Check if a user can perform an action on a specific resource
 * Combines role-based and hospital-scoped permissions
 */
export function canPerformAction(options: {
  userRole: PortalRole;
  userHospitalId: string | null;
  targetHospitalId: string;
  resourceType: string;
  action: PermissionAction;
  isOwnResource?: boolean;
}): AccessCheckResult {
  const {
    userRole,
    userHospitalId,
    targetHospitalId,
    resourceType,
    action,
    isOwnResource = false,
  } = options;
  
  // Check if user can access their own data regardless of hospital
  if (isOwnResource) {
    const roleDef = ROLE_DEFINITIONS[userRole];
    if (roleDef?.canAccessOwnData) {
      return { allowed: true };
    }
  }
  
  // Check hospital-scoped access
  if (!canAccessHospitalData(userHospitalId, targetHospitalId)) {
    return {
      allowed: false,
      reason: 'Access denied: User does not belong to the target hospital',
    };
  }
  
  // Check role-based permission
  return canAccessResource(userRole, resourceType, action);
}

// ─── Supervision Hierarchy ────────────────────────────────────────────────────

/**
 * Check if a role can supervise another role
 */
export function canSuperviseRole(supervisorRole: PortalRole, subordinateRole: PortalRole): boolean {
  const roleDef = ROLE_DEFINITIONS[supervisorRole];
  if (!roleDef) return false;
  
  return roleDef.canSuperviseRoles.includes(subordinateRole);
}

/**
 * Get all roles that a given role can supervise
 */
export function getSupervisableRoles(role: PortalRole): PortalRole[] {
  const roleDef = ROLE_DEFINITIONS[role];
  if (!roleDef) return [];
  
  return roleDef.canSuperviseRoles;
}

// ─── Permission Utility Functions ─────────────────────────────────────────────

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: PortalRole): Permission[] {
  const roleDef = ROLE_DEFINITIONS[role];
  if (!roleDef) return [];
  
  return roleDef.permissions;
}

/**
 * Get a human-readable description of a permission
 */
export function getPermissionDescription(
  category: PermissionCategory,
  action: PermissionAction
): string {
  const actionLabels: Record<PermissionAction, string> = {
    create: 'Create',
    read: 'View',
    update: 'Edit',
    delete: 'Delete',
    approve: 'Approve',
    verify: 'Verify',
    dispense: 'Dispense',
    prescribe: 'Prescribe',
    bill: 'Bill',
    refund: 'Process Refund',
    export: 'Export',
    admin: 'Administer',
  };
  
  const categoryLabels: Record<PermissionCategory, string> = {
    patients: 'Patient Records',
    appointments: 'Appointments',
    labs: 'Laboratory',
    pharmacy: 'Pharmacy',
    billing: 'Billing',
    reports: 'Reports',
    users: 'User Management',
    settings: 'System Settings',
    inventory: 'Inventory',
    beds: 'Bed Management',
    queue: 'Queue Management',
    handover: 'Handover Notes',
    teleconsult: 'Teleconsultation',
    ai: 'AI Features',
    audit: 'Audit Logs',
  };
  
  return `${actionLabels[action]} ${categoryLabels[category]}`;
}

/**
 * Format permission as a string for logging/debugging
 */
export function formatPermission(category: PermissionCategory, action: PermissionAction): string {
  return `${category}:${action}`;
}

// ─── Export for API Route Validation ──────────────────────────────────────────

/**
 * Create a permission requirement object for API route validation
 */
export function requirePermission(
  category: PermissionCategory,
  action: PermissionAction
): { category: PermissionCategory; action: PermissionAction } {
  return { category, action };
}

/**
 * Create multiple permission requirements (all must pass)
 */
export function requireAllPermissions(
  ...permissions: Array<{ category: PermissionCategory; action: PermissionAction }>
): Array<{ category: PermissionCategory; action: PermissionAction }> {
  return permissions;
}

/**
 * Create permission requirements where any one passing is sufficient
 */
export function requireAnyPermission(
  ...permissions: Array<{ category: PermissionCategory; action: PermissionAction }>
): { anyOf: Array<{ category: PermissionCategory; action: PermissionAction }> } {
  return { anyOf: permissions };
}

// ─── Default Exports ──────────────────────────────────────────────────────────

const rbacModule = {
  ROLE_DEFINITIONS,
  PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canAccessResource,
  canAccessHospitalData,
  canPerformAction,
  canSuperviseRole,
  getSupervisableRoles,
  getRolePermissions,
  getPermissionDescription,
  formatPermission,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
};

export default rbacModule;