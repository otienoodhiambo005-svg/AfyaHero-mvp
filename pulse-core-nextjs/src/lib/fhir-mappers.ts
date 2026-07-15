/**
 * FHIR R4 Resource Mappers
 * 
 * Converts internal Prisma models to FHIR R4 resources at the API layer.
 * This approach avoids database schema changes while providing FHIR compliance.
 * 
 * Supported Resources:
 * - Patient
 * - Encounter
 * - Condition
 * - Procedure
 * - MedicationRequest
 * - ServiceRequest
 * - Observation (vitals, lab results)
 * - Practitioner
 * - Organization
 */

import { prisma } from '@/lib/database';

// ============================================================================
// Type Definitions
// ============================================================================

interface FHIRReference {
  reference: string;
  type?: string;
  identifier?: {
    system: string;
    value: string;
  };
  display?: string;
}

interface FHIRCoding {
  system: string;
  version?: string;
  code: string;
  display: string;
  userSelected?: boolean;
}

interface FHIRCodeableConcept {
  coding: FHIRCoding[];
  text?: string;
}

interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system: string;
  value: string;
  period?: {
    start: string;
    end?: string;
  };
  assigner?: FHIRReference;
}

interface FHIRMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  tag?: FHIRCoding[];
}

interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: FHIRMeta;
  implicitRules?: string;
  language?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a FHIR reference
 */
function createReference(
  resourceType: string,
  id: string,
  display?: string,
): FHIRReference {
  return {
    reference: `${resourceType}/${id}`,
    type: resourceType,
    display,
  };
}

/**
 * Generate a FHIR identifier
 */
function createIdentifier(
  system: string,
  value: string,
  use: FHIRIdentifier['use'] = 'official',
): FHIRIdentifier {
  return {
    use,
    system,
    value,
  };
}

/**
 * Generate a FHIR coding
 */
function createCoding(
  system: string,
  code: string,
  display: string,
): FHIRCoding {
  return {
    system,
    code,
    display,
  };
}

/**
 * Generate a FHIR codeable concept
 */
function createCodeableConcept(
  codings: FHIRCoding[],
  text?: string,
): FHIRCodeableConcept {
  return {
    coding: codings,
    text,
  };
}

/**
 * Generate FHIR meta
 */
function createMeta(versionId?: string, lastUpdated?: Date): FHIRMeta {
  return {
    versionId,
    lastUpdated: lastUpdated?.toISOString(),
    source: 'AfyaHero-Hospital-OS',
  };
}

// ============================================================================
// Patient Mapper
// ============================================================================

export function mapPatientToFHIR(patient: {
  id: string;
  name: string;
  dob: Date;
  gender: string | null;
  phone?: string | null;
  shifNumber?: string | null;
  hospitalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const [firstName, ...remainingNames] = patient.name.split(' ');
  const lastName = remainingNames.join(' ') || firstName;

  return {
    resourceType: 'Patient',
    id: patient.id,
    meta: createMeta(undefined, patient.updatedAt),
    identifier: [
      ...(patient.shifNumber
        ? [
            createIdentifier(
              'https://shif.go.ke/patient-number',
              patient.shifNumber,
              'official',
            ),
          ]
        : []),
      createIdentifier('https://afyahero.com/patient-id', patient.id, 'usual'),
    ],
    name: [
      {
        use: 'official',
        family: lastName,
        given: [firstName],
      },
    ],
    telecom: [
      ...(patient.phone
        ? [
            {
              system: 'phone' as const,
              value: patient.phone,
              use: 'mobile' as const,
            },
          ]
        : []),
    ],
    gender: patient.gender === 'MALE' || patient.gender === 'M' ? 'male' : patient.gender === 'FEMALE' || patient.gender === 'F' ? 'female' : 'other',
    birthDate: patient.dob.toISOString().split('T')[0],
    ...(patient.hospitalId && { managingOrganization: createReference('Organization', patient.hospitalId) }),
  };
}

// ============================================================================
// Encounter Mapper
// ============================================================================

export function mapEncounterToFHIR(encounter: {
  id: string;
  patientId: string;
  profileId: string;
  hospitalId: string;
  status: string;
  encounterType?: string;
  startTime: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const statusMap: Record<string, string> = {
    PLANNED: 'planned',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'finished',
    CANCELLED: 'cancelled',
    ENTERED_IN_ERROR: 'entered-in-error',
  };

  return {
    resourceType: 'Encounter',
    id: encounter.id,
    meta: createMeta(undefined, encounter.updatedAt),
    status: statusMap[encounter.status] || 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounter.encounterType === 'EMERGENCY' ? 'EMER' : 'AMB',
      display: encounter.encounterType === 'EMERGENCY' ? 'emergency' : 'ambulatory',
    },
    subject: createReference('Patient', encounter.patientId),
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'ATND',
                display: 'attender',
              },
            ],
          },
        ],
        individual: createReference('Practitioner', encounter.profileId),
      },
    ],
    period: {
      start: encounter.startTime.toISOString(),
      ...(encounter.endTime && { end: encounter.endTime.toISOString() }),
    },
    serviceProvider: createReference('Organization', encounter.hospitalId),
  };
}

// ============================================================================
// Condition Mapper
// ============================================================================

export function mapConditionToFHIR(condition: {
  id: string;
  patientId: string;
  profileId?: string;
  hospitalId: string;
  clinicalStatus: string;
  verificationStatus: string;
  code?: string;
  description?: string;
  onsetDate?: Date;
  recordedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const clinicalStatusMap: Record<string, string> = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    RESOLVED: 'resolved',
    REMISSION: 'remission',
  };

  const verificationStatusMap: Record<string, string> = {
    CONFIRMED: 'confirmed',
    PROVISIONAL: 'provisional',
    DIFFERENTIAL: 'differential',
    RULED_OUT: 'refuted',
    UNKNOWN: 'unconfirmed',
  };

  return {
    resourceType: 'Condition',
    id: condition.id,
    meta: createMeta(undefined, condition.updatedAt),
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: clinicalStatusMap[condition.clinicalStatus] || 'unknown',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: verificationStatusMap[condition.verificationStatus] || 'unconfirmed',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
            display: 'Encounter Diagnosis',
          },
        ],
      },
    ],
    code: condition.code
      ? createCodeableConcept([
          createCoding(
            'http://hl7.org/fhir/sid/icd-10',
            condition.code,
            condition.description || condition.code,
          ),
        ])
      : {
          text: condition.description || 'Unknown condition',
        },
    subject: createReference('Patient', condition.patientId),
    ...(condition.profileId && {
      assessor: createReference('Practitioner', condition.profileId),
    }),
    onsetDateTime: condition.onsetDate?.toISOString(),
    recordedDate: condition.recordedDate.toISOString(),
  };
}

// ============================================================================
// Procedure Mapper
// ============================================================================

export function mapProcedureToFHIR(procedure: {
  id: string;
  patientId: string;
  profileId: string;
  hospitalId: string;
  status: string;
  code?: string;
  description?: string;
  performedDate?: Date;
  recordedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const statusMap: Record<string, string> = {
    PREPARATION: 'preparation',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ENTERED_IN_ERROR: 'entered-in-error',
  };

  return {
    resourceType: 'Procedure',
    id: procedure.id,
    meta: createMeta(undefined, procedure.updatedAt),
    status: statusMap[procedure.status] || 'unknown',
    category: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '387713003',
          display: 'Surgical procedure',
        },
      ],
    },
    code: procedure.code
      ? createCodeableConcept([
          createCoding(
            'http://snomed.info/sct',
            procedure.code,
            procedure.description || procedure.code,
          ),
        ])
      : {
          text: procedure.description || 'Unknown procedure',
        },
    subject: createReference('Patient', procedure.patientId),
    performer: [
      {
        function: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'PPRF',
              display: 'primary performer',
            },
          ],
        },
        actor: createReference('Practitioner', procedure.profileId),
      },
    ],
    performedDateTime: procedure.performedDate?.toISOString(),
    recordedDate: procedure.recordedDate.toISOString(),
    reasonCode: [],
  };
}

// ============================================================================
// MedicationRequest Mapper
// ============================================================================

export function mapMedicationRequestToFHIR(prescription: {
  id: string;
  patientId: string;
  profileId: string;
  hospitalId: string;
  status: string;
  medicationName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  prescribedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const statusMap: Record<string, string> = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    STOPPED: 'stopped',
    ENTERED_IN_ERROR: 'entered-in-error',
    DRAFT: 'draft',
  };

  return {
    resourceType: 'MedicationRequest',
    id: prescription.id,
    meta: createMeta(undefined, prescription.updatedAt),
    status: statusMap[prescription.status] || 'unknown',
    intent: 'order',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category',
            code: 'inpatient',
            display: 'Inpatient',
          },
        ],
      },
    ],
    medicationCodeableConcept: createCodeableConcept([
      createCoding(
        'http://www.nlm.nih.gov/research/umls/rxnorm',
        prescription.medicationName,
        prescription.medicationName,
      ),
    ]),
    subject: createReference('Patient', prescription.patientId),
    requester: createReference('Practitioner', prescription.profileId),
    dosageInstruction: [
      {
        ...(prescription.dosage && {
          dose: {
            value: parseFloat(prescription.dosage.split(' ')[0]) || 0,
            unit: prescription.dosage.split(' ')[1] || 'mg',
            system: 'http://unitsofmeasure.org',
            code: 'mg',
          },
        }),
        ...(prescription.frequency && {
          timing: {
            repeat: {
              frequency: parseInt(prescription.frequency.split(' ')[0]) || 1,
              period: parseInt(prescription.frequency.split(' ')[1]) || 1,
              periodUnit: prescription.frequency.split(' ')[2] || 'd',
            },
          },
        }),
        ...(prescription.duration && {
          timing: {
            repeat: {
              boundsDuration: {
                value: parseInt(prescription.duration.split(' ')[0]) || 7,
                unit: prescription.duration.split(' ')[1] || 'd',
                system: 'http://unitsofmeasure.org',
                code: 'd',
              },
            },
          },
        }),
      },
    ],
    authoredOn: prescription.prescribedDate.toISOString(),
  };
}

// ============================================================================
// ServiceRequest Mapper
// ============================================================================

export function mapServiceRequestToFHIR(labRequest: {
  id: string;
  patientId: string;
  profileId: string;
  hospitalId: string;
  status: string;
  testType?: string;
  description?: string;
  requestedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const statusMap: Record<string, string> = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ENTERED_IN_ERROR: 'entered-in-error',
    SUSPENDED: 'suspended',
  };

  return {
    resourceType: 'ServiceRequest',
    id: labRequest.id,
    meta: createMeta(undefined, labRequest.updatedAt),
    status: statusMap[labRequest.status] || 'unknown',
    intent: 'order',
    category: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '108252007',
            display: 'Laboratory procedure',
          },
        ],
      },
    ],
    code: labRequest.testType
      ? createCodeableConcept([
          createCoding(
            'http://loinc.org',
            labRequest.testType,
            labRequest.description || labRequest.testType,
          ),
        ])
      : {
          text: labRequest.description || 'Unknown test',
        },
    subject: createReference('Patient', labRequest.patientId),
    requester: createReference('Practitioner', labRequest.profileId),
    authoredOn: labRequest.requestedDate.toISOString(),
  };
}

// ============================================================================
// Observation Mapper (Vitals, Lab Results)
// ============================================================================

export function mapObservationToFHIR(observation: {
  id: string;
  patientId: string;
  profileId?: string;
  hospitalId: string;
  observationType: string;
  value?: string | number;
  unit?: string;
  code?: string;
  description?: string;
  recordedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const loincCodes: Record<string, string> = {
    TEMPERATURE: '8310-5',
    HEART_RATE: '8867-4',
    RESPIRATORY_RATE: '9279-1',
    BLOOD_PRESSURE_SYSTOLIC: '8480-6',
    BLOOD_PRESSURE_DIASTOLIC: '8462-4',
    OXYGEN_SATURATION: '59408-5',
    GLUCOSE: '2345-7',
    HEMOGLOBIN: '718-7',
  };

  return {
    resourceType: 'Observation',
    id: observation.id,
    meta: createMeta(undefined, observation.updatedAt),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: observation.observationType === 'VITAL' ? 'vital-signs' : 'laboratory',
            display: observation.observationType === 'VITAL' ? 'Vital Signs' : 'Laboratory',
          },
        ],
      },
    ],
    code: createCodeableConcept([
      createCoding(
        'http://loinc.org',
        loincCodes[observation.observationType] || observation.code || 'unknown',
        observation.description || observation.observationType,
      ),
    ]),
    subject: createReference('Patient', observation.patientId),
    ...(observation.profileId && {
      performer: [createReference('Practitioner', observation.profileId)],
    }),
    effectiveDateTime: observation.recordedDate.toISOString(),
    valueQuantity:
      observation.value !== undefined
        ? {
            value: Number(observation.value),
            unit: observation.unit || '',
            system: 'http://unitsofmeasure.org',
            code: observation.unit || '',
          }
        : undefined,
    issued: observation.recordedDate.toISOString(),
  };
}

// ============================================================================
// Practitioner Mapper
// ============================================================================

export function mapPractitionerToFHIR(profile: {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  hospitalId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const roleCodes: Record<string, string> = {
    doctor: 'doctor',
    nurse: 'nurse',
    reception: 'receptionist',
    lab: 'lab-technician',
    pharmacy: 'pharmacist',
    admin: 'administrator',
  };

  return {
    resourceType: 'Practitioner',
    id: profile.id,
    meta: createMeta(undefined, profile.updatedAt),
    identifier: [
      createIdentifier('https://afyahero.com/practitioner-id', profile.id, 'usual'),
    ],
    name: [
      {
        use: 'official',
        family: profile.lastName,
        given: [profile.firstName],
      },
    ],
    telecom: [
      ...(profile.phoneNumber
        ? [
            {
              system: 'phone' as const,
              value: profile.phoneNumber,
              use: 'work' as const,
            },
          ]
        : []),
      ...(profile.email
        ? [
            {
              system: 'email' as const,
              value: profile.email,
              use: 'work' as const,
            },
          ]
        : []),
    ],
    ...(profile.role && {
      code: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: roleCodes[profile.role] || 'unknown',
              display: profile.role,
            },
          ],
        },
      ],
    }),
  };
}

// ============================================================================
// Organization Mapper
// ============================================================================

export function mapOrganizationToFHIR(hospital: {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    resourceType: 'Organization',
    id: hospital.id,
    meta: createMeta(undefined, hospital.updatedAt),
    identifier: [
      createIdentifier('https://afyahero.com/hospital-id', hospital.id, 'official'),
    ],
    name: hospital.name,
    telecom: [
      ...(hospital.phoneNumber
        ? [
            {
              system: 'phone' as const,
              value: hospital.phoneNumber,
              use: 'work' as const,
            },
          ]
        : []),
      ...(hospital.email
        ? [
            {
              system: 'email' as const,
              value: hospital.email,
              use: 'work' as const,
            },
          ]
        : []),
    ],
    ...(hospital.address && {
      address: [
        {
          use: 'work',
          text: hospital.address,
          type: 'both',
        },
      ],
    }),
  };
}

// ============================================================================
// Bundle Creator
// ============================================================================

export function createFHIRBundle(
  resources: any[],
  type: 'collection' | 'document' | 'message' = 'collection',
): {
  resourceType: string;
  type: string;
  entry: Array<{
    fullUrl: string;
    resource: any;
    request?: { method: string; url: string };
  }>;
} {
  return {
    resourceType: 'Bundle',
    type,
    entry: resources.map((resource) => ({
      fullUrl: `${resource.resourceType}/${resource.id}`,
      resource,
      request: {
        method: 'POST',
        url: resource.resourceType,
      },
    })),
  };
}
