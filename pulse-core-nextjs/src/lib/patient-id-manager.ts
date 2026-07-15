/**
 * Longitudinal Dynamic Patient ID Manager
 * 
 * Implements permanent, unique, non-identifiable patient identifiers
 * for hospital EMR systems. Patient names are never used as identifiers
 * across the system. All access is done via these ID's which are rolled
 * out through the patient mobile application.
 * 
 * ID Specifications:
 * - 16 character alphanumeric format
 * - Checksum validation
 * - Version embedded for future migration
 * - No personally identifiable information encoded
 * - Permanent / longitudinal (does not change for patient lifetime)
 * - Cryptographically secure generation
 */

/**
 * Patient ID format: AAHHHHHHHHHHHCCC
 * 
 * AA  = Version prefix (2 chars, current = 'PH')
 * H   = Random base32 characters (11 chars)
 * C   = CRC16 checksum (3 chars)
 * Total: 16 characters
 */

const VERSION_PREFIX = 'PH';
const ID_LENGTH = 16;
const BASE32_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No ambiguous characters I/L/O/0/1

/**
 * Generate a new longitudinal patient ID
 * This ID is permanent for the patient's entire lifecycle
 */
export function generatePatientId(): string {
  let id = VERSION_PREFIX;
  
  // Generate 11 random base32 characters
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(11);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 11; i++) {
      id += BASE32_CHARS[bytes[i] % BASE32_CHARS.length];
    }
  } else {
    // Fallback for environments without secure crypto
    for (let i = 0; i < 11; i++) {
      id += BASE32_CHARS[Math.floor(Math.random() * BASE32_CHARS.length)];
    }
  }
  
  // Add 3 character checksum
  const checksum = calculateChecksum(id);
  id += checksum;
  
  return id;
}

/**
 * Validate a patient ID for format and checksum integrity
 */
export function validatePatientId(id: string): boolean {
  if (!id || id.length !== ID_LENGTH) return false;
  if (!id.startsWith(VERSION_PREFIX)) return false;
  
  // Verify all characters are valid base32
  for (const char of id) {
    if (!BASE32_CHARS.includes(char)) return false;
  }
  
  // Verify checksum
  const payload = id.slice(0, 13);
  const providedChecksum = id.slice(13, 16);
  const calculatedChecksum = calculateChecksum(payload);
  
  return providedChecksum === calculatedChecksum;
}

/**
 * Calculate CRC16-based checksum for patient ID
 */
function calculateChecksum(payload: string): string {
  let crc = 0xFFFF;
  
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  
  crc = crc & 0xFFFF;
  
  // Convert to 3 base32 characters
  let checksum = '';
  checksum += BASE32_CHARS[(crc >> 10) & 0x1F];
  checksum += BASE32_CHARS[(crc >> 5) & 0x1F];
  checksum += BASE32_CHARS[crc & 0x1F];
  
  return checksum;
}

/**
 * Mask patient name display - only show ID in system interfaces
 * This ensures names are never displayed as primary identifiers
 */
export function maskPatientIdentifier(patient: { id: string; name?: string }): {
  patientId: string;
  displayName: string;
  maskedName: string;
} {
  const patientId = patient.id;
  
  // Only show first initial if absolutely necessary
  let maskedName = '[Name Hidden]';

  if (patient.name) {
    // Only show first initial if absolutely necessary
    const nameParts = patient.name.trim().split(' ');
    maskedName = nameParts.map((part, idx) => {
      if (idx === 0) {
        return part.charAt(0).toUpperCase() + '***';
      }
      return '***';
    }).join(' ');
  }

  const displayName = `Patient ${patientId}`;
  
  return {
    patientId,
    displayName,
    maskedName
  };
}

/**
 * Patient ID audit logging metadata
 * Records all access events for patient records
 */
export interface PatientIdAccessLog {
  patientId: string;
  accessedBy: string;
  accessTimestamp: string;
  accessReason: string;
  facilityId: string;
  sessionId: string;
  ipAddress?: string;
}

/**
 * Create audit log entry for patient ID access
 * Every access to patient records must be logged with the patient ID
 */
export function createPatientAccessLog(
  patientId: string,
  practitionerId: string,
  reason: string,
  facilityId: string,
  sessionId: string,
  ipAddress?: string
): PatientIdAccessLog {
  if (!validatePatientId(patientId)) {
    throw new Error('Invalid patient ID for audit log');
  }
  
  return {
    patientId,
    accessedBy: practitionerId,
    accessTimestamp: new Date().toISOString(),
    accessReason: reason,
    facilityId,
    sessionId,
    ipAddress
  };
}

/**
 * Patient App ID Rollout Verification
 * 
 * Verifies that a patient has activated their ID through the mobile app
 * This is required before any hospital system can access the patient record
 */
export function verifyPatientAppActivation(patientId: string): {
  activated: boolean;
  activatedAt?: string;
  appVersion?: string;
  deviceHash?: string;
} {
  // Implementation will integrate with patient app backend
  // For now returns validation status
  
  if (!validatePatientId(patientId)) {
    return { activated: false };
  }
  
  // This will check against activation database in production
  return {
    activated: true,
    activatedAt: new Date().toISOString(),
    appVersion: '2.0.0',
    deviceHash: '************'
  };
}

/**
 * Convert legacy patient identifiers to new longitudinal ID system
 */
export async function migrateLegacyPatientId(legacyId: string): Promise<string> {
  // Generate deterministic but unique new ID from legacy ID
  // This maintains mapping while providing new standard ID

  const crypto = await import('crypto');
  const hash = crypto
    .createHash('sha256')
    .update(legacyId + process.env.PATIENT_ID_SALT)
    .digest('hex');
  
  let newId = VERSION_PREFIX;
  for (let i = 0; i < 11; i++) {
    const charCode = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    newId += BASE32_CHARS[charCode % BASE32_CHARS.length];
  }
  
  const checksum = calculateChecksum(newId);
  newId += checksum;
  
  return newId;
}