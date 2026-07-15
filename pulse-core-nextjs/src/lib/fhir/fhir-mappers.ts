/**
 * FHIR Map PERS - Convert AfyaHero internal data models to FHIR resources
 *
 * This module provides functions to transform internal data structures
 * into standard FHIR R4 resources for interoperability.
 */

import {
  FHIRPatient,
  FHIRObservation,
  FHIRMedicationRequest,
  FHIRPractitioner,
  FHIROrganization,
  FHIRBundle,
  FHIRBundleEntry,
  FHIRIdentifier,
  FHIRContactPoint,
  FHIRExtension,
} from './fhir-types';
import {
  FHIRCondition,
  FHIREncounter,
  FHIRAllergyIntolerance,
  FHIRDiagnosticReport,
  FHIRProcedure,
  FHIRImmunization,
  FHIRServiceRequest,
  FHIRMedicationDispense,
  FHIRClaim
} from './fhir-extended-types';

import { generatePatientId, validatePatientId } from '../patient-id-manager';

// ─── FHIR Configuration ────────────────────────────────────────────────

const FHIR_CONFIG = {
  baseUrl: process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com',
  organizationId: process.env.FHIR_ORG_ID || 'afyahero-facility',
  systemUrl: 'https://afyahero.com/fhir',
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Patient ID is now primary identifier - names are never used for identification
function getPatientDisplayId(patient: InternalPatient): string {
  // Use existing ID if it is already valid longitudinal format
  if (validatePatientId(patient.id)) {
    return patient.id;
  }
  // Generate new standard ID for new patients
  return generatePatientId();
}

// ─── Patient Mapper ───────────────────────────────────────────────────

interface InternalPatient {
  id: string;
  name: string;
  gender: 'M' | 'F';
  dob: string;
  phone?: string;
  id_number?: string;
  blood_group?: string;
  allergies?: string[];
  insurance_provider?: string;
  insurance_id?: string;
  created_at?: string;
  updated_at?: string;
}

export function mapPatientToFHIR(patient: InternalPatient): FHIRPatient {
  const [firstName, ...lastNameParts] = patient.name.split(' ');
  const lastName = lastNameParts.join(' ');
  
  const patientId = getPatientDisplayId(patient);
  
  const identifiers: FHIRIdentifier[] = [
    {
      system: `${FHIR_CONFIG.systemUrl}/patient-id`,
      value: patientId,
      use: 'official',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'PI',
            display: 'Patient Internal Identifier'
          }
        ]
      }
    },
  ];

  if (patient.id_number) {
    identifiers.push({
      system: `${FHIR_CONFIG.systemUrl}/national-id`,
      value: patient.id_number,
      use: 'official',
    });
  }

  if (patient.insurance_id) {
    identifiers.push({
      system: `${FHIR_CONFIG.systemUrl}/insurance-id`,
      value: patient.insurance_id,
      use: 'secondary',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'INE',
            display: 'Insurance Member Number',
          },
        ],
      },
    });
  }

  const extensions: FHIRExtension[] = [];
  if (patient.blood_group) {
    extensions.push({
      url: `${FHIR_CONFIG.systemUrl}/StructureDefinition/blood-group`,
      valueCode: patient.blood_group,
    });
  }
  if (patient.allergies?.length) {
    extensions.push({
      url: `${FHIR_CONFIG.systemUrl}/StructureDefinition/allergies`,
      valueString: patient.allergies.join(', '),
    });
  }

  const telecom: FHIRContactPoint[] | undefined = patient.phone
    ? [
        {
          system: 'phone',
          value: patient.phone,
          use: 'mobile',
        },
      ]
    : undefined;

  return {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      lastUpdated: patient.updated_at || new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroPatient`],
    },
    identifier: identifiers,
    active: true,
    name: [
      {
        use: 'official',
        given: [firstName],
        family: lastName || firstName,
      },
    ],
    gender: patient.gender === 'M' ? 'male' : 'female',
    birthDate: patient.dob,
    ...(telecom ? { telecom } : {}),
    ...(extensions.length ? { extension: extensions } : {}),
  };
}

// ─── Vitals/Observation Mapper ────────────────────────────────────────

interface InternalVitals {
  bp: string;
  pulse: number;
  temp: number;
  spo2: number;
  rr: number;
  weight?: number;
  height?: number;
  recordedAt: string;
  recordedBy: string;
}

export function mapVitalsToFHIR(
  patientId: string,
  vitals: InternalVitals,
  practitionerId?: string,
): FHIRObservation[] {
  const vitalSigns: Array<{
    code: string;
    display: string;
    value: number | string;
    unit: string;
    system: string;
  }> = [
    {
      code: '8480-6',
      display: 'Systolic Blood Pressure',
      value: vitals.bp.split('/')[0],
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
    },
    {
      code: '8462-4',
      display: 'Diastolic Blood Pressure',
      value: vitals.bp.split('/')[1],
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
    },
    {
      code: '8867-4',
      display: 'Heart Rate',
      value: vitals.pulse,
      unit: '/min',
      system: 'http://unitsofmeasure.org',
    },
    {
      code: '8310-5',
      display: 'Body Temperature',
      value: vitals.temp,
      unit: 'Cel',
      system: 'http://unitsofmeasure.org',
    },
    {
      code: '59408-5',
      display: 'Oxygen Saturation',
      value: vitals.spo2,
      unit: '%',
      system: 'http://unitsofmeasure.org',
    },
    {
      code: '9279-1',
      display: 'Respiratory Rate',
      value: vitals.rr,
      unit: '/min',
      system: 'http://unitsofmeasure.org',
    },
  ];

  if (vitals.weight) {
    vitalSigns.push({
      code: '3141-9',
      display: 'Body Weight',
      value: vitals.weight,
      unit: 'kg',
      system: 'http://unitsofmeasure.org',
    });
  }

  if (vitals.height) {
    vitalSigns.push({
      code: '8302-2',
      display: 'Body Height',
      value: vitals.height,
      unit: 'cm',
      system: 'http://unitsofmeasure.org',
    });
  }

  return vitalSigns.map((vital) => ({
    resourceType: 'Observation',
    id: generateId(),
    meta: {
      lastUpdated: vitals.recordedAt,
      profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns'],
    },
    status: 'final' as const,
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: vital.code,
          display: vital.display,
        },
      ],
      text: vital.display,
    },
    subject: {
      reference: `Patient/${patientId}`,
      type: 'Patient',
    },
    effectiveDateTime: vitals.recordedAt,
    issued: vitals.recordedAt,
    ...(practitionerId && {
      performer: [
        {
          reference: `Practitioner/${practitionerId}`,
          type: 'Practitioner',
        },
      ],
    }),
    valueQuantity: {
      value: typeof vital.value === 'number' ? vital.value : parseFloat(vital.value),
      unit: vital.unit,
      system: vital.system,
    },
  }));
}

// ─── Lab Result Mapper ────────────────────────────────────────────────

interface InternalLabResult {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag?: 'H' | 'L' | 'HH' | 'LL' | 'A';
}

export function mapLabResultToFHIR(
  patientId: string,
  labResults: InternalLabResult[],
  testName: string,
  practitionerId?: string,
): FHIRObservation {
  return {
    resourceType: 'Observation',
    id: generateId(),
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroLabObservation`],
    },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: `${FHIR_CONFIG.systemUrl}/lab-test`,
          code: testName.toLowerCase().replace(/\s+/g, '-'),
          display: testName,
        },
      ],
      text: testName,
    },
    subject: {
      reference: `Patient/${patientId}`,
      type: 'Patient',
    },
    issued: new Date().toISOString(),
    ...(practitionerId && {
      performer: [
        {
          reference: `Practitioner/${practitionerId}`,
          type: 'Practitioner',
        },
      ],
    }),
    component: labResults.map((result) => ({
      code: {
        coding: [
          {
            system: `${FHIR_CONFIG.systemUrl}/lab-parameter`,
            code: result.parameter.toLowerCase().replace(/\s+/g, '-'),
            display: result.parameter,
          },
        ],
        text: result.parameter,
      },
      valueQuantity: {
        value: parseFloat(result.value),
        unit: result.unit,
      },
      referenceRange: [
        {
          text: result.referenceRange,
        },
      ],
      ...(result.flag && {
        interpretation: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: result.flag,
                display:
                  result.flag === 'H'
                    ? 'High'
                    : result.flag === 'L'
                      ? 'Low'
                      : result.flag === 'HH'
                        ? 'CriticallyHigh'
                        : result.flag === 'LL'
                          ? 'CriticallyLow'
                          : 'Abnormal',
              },
            ],
          },
        ],
      }),
    })),
  };
}

// ─── Medication Request Mapper ────────────────────────────────────────

interface InternalMedication {
  drug: string;
  genericName?: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
  notes?: string;
}

export function mapPrescriptionToFHIR(
  patientId: string,
  medications: InternalMedication[],
  prescriptionId: string,
  requesterId?: string,
): FHIRMedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    id: prescriptionId,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroMedicationRequest`],
    },
    status: 'active',
    intent: 'order',
    priority: 'routine',
    medicationCodeableConcept: {
      coding: medications.map((med) => ({
        system: `${FHIR_CONFIG.systemUrl}/medication`,
        code: med.drug.toLowerCase().replace(/\s+/g, '-'),
        display: med.drug,
      })),
      text: medications.map((m) => m.drug).join(', '),
    },
    subject: {
      reference: `Patient/${patientId}`,
      type: 'Patient',
    },
    authoredOn: new Date().toISOString(),
    ...(requesterId && {
      requester: {
        reference: `Practitioner/${requesterId}`,
        type: 'Practitioner',
      },
    }),
    dosageInstruction: medications.map((med) => ({
      text: `${med.dose} ${med.frequency} for ${med.duration}`,
      timing: {
        repeat: {
          frequency: parseFrequency(med.frequency),
          period: 1,
          periodUnit: 'd',
        },
      },
      route: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v4-0-3/routes-of-administration',
            code: mapRouteToFHIR(med.route),
            display: med.route,
          },
        ],
      },
      doseAndRate: [
        {
          doseQuantity: {
            value: parseDose(med.dose),
            unit: extractDoseUnit(med.dose),
          },
        },
      ],
    })),
    dispenseRequest: {
      quantity: {
        value: medications.reduce((total, m) => total + m.quantity, 0),
        unit: 'tablet',
      },
      validityPeriod: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    note:
      medications[0]?.notes || []
        ? [
            {
              text: medications.map((m) => m.notes).join('; '),
              time: new Date().toISOString(),
            },
          ]
        : undefined,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────

function parseFrequency(frequency: string): number {
  const freq = frequency.toLowerCase();
  if (freq.includes('once')) return 1;
  if (freq.includes('twice') || freq.includes('bd')) return 2;
  if (freq.includes('trice') || freq.includes('td')) return 3;
  if (freq.includes('four') || freq.includes('qid')) return 4;
  const match = frequency.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

function parseDose(dose: string): number {
  const match = dose.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function extractDoseUnit(dose: string): string {
  const unitMatch = dose.match(/(\w+)$/);
  return unitMatch ? unitMatch[1] : 'mg';
}

function mapRouteToFHIR(route: string): string {
  const routeMap: Record<string, string> = {
    oral: 'PO',
    iv: 'IV',
    im: 'IM',
    sc: 'SC',
    topical: 'TOP',
    inhaled: 'INH',
    rectal: 'RECT',
  };
  return routeMap[route.toLowerCase()] || 'PO';
}

// ─── Practitioner Mapper ──────────────────────────────────────────────

interface InternalPractitioner {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

export function mapPractitionerToFHIR(practitioner: InternalPractitioner): FHIRPractitioner {
  const [firstName, ...lastNameParts] = practitioner.name.split(' ');
  const lastName = lastNameParts.join(' ');
  const telecom: FHIRContactPoint[] = [];

  if (practitioner.email) {
    telecom.push({
      system: 'email',
      value: practitioner.email,
    });
  }
  if (practitioner.phone) {
    telecom.push({
      system: 'phone',
      value: practitioner.phone,
    });
  }

  return {
    resourceType: 'Practitioner',
    id: practitioner.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroPractitioner`],
    },
    identifier: [
      {
        system: `${FHIR_CONFIG.systemUrl}/practitioner-id`,
        value: practitioner.id,
        use: 'official',
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        given: [firstName],
        family: lastName || firstName,
      },
    ],
    ...(telecom.length ? { telecom } : {}),
    ...(practitioner.title && {
      qualification: [
        {
          code: {
            text: practitioner.title,
          },
        },
      ],
    }),
  };
}

// ─── Organization Mapper ──────────────────────────────────────────────

interface InternalOrganization {
  id: string;
  name: string;
  type?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export function mapOrganizationToFHIR(org: InternalOrganization): FHIROrganization {
  const telecom: FHIRContactPoint[] = [];
  if (org.phone) {
    telecom.push({
      system: 'phone',
      value: org.phone,
    });
  }
  if (org.email) {
    telecom.push({
      system: 'email',
      value: org.email,
    });
  }

  return {
    resourceType: 'Organization',
    id: org.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroOrganization`],
    },
    identifier: [
      {
        system: `${FHIR_CONFIG.systemUrl}/organization-id`,
        value: org.id,
        use: 'official',
      },
    ],
    active: true,
    type: org.type
      ? [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/organization-type',
                code: org.type.toLowerCase().replace(/\s+/g, '-'),
                display: org.type,
              },
            ],
          },
        ]
      : undefined,
    name: org.name,
    ...(telecom.length ? { telecom } : {}),
  };
}

// ─── Bundle Generator ─────────────────────────────────────────────────

export function createFHIRBundle(entries: FHIRBundleEntry[], bundleType: string = 'searchset'): FHIRBundle {
  return {
    resourceType: 'Bundle',
    id: generateId(),
    type: bundleType as any,
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries,
    link: [
      {
        relation: 'self',
        url: `${FHIR_CONFIG.baseUrl}`,
      },
    ],
  };
}

// ─── Condition Mapper ─────────────────────────────────────────────────────

interface InternalCondition {
  id: string;
  clinical_status: string;
  verification_status?: string;
  category?: string;
  severity?: string;
  code: string;
  code_system: string;
  code_display: string;
  body_site?: string;
  onset_date_time?: string;
  recorded_date: string;
  recorder?: string;
  asserter?: string;
  subject: string;
  encounter?: string;
  notes?: string[];
}

export function mapConditionToFHIR(condition: InternalCondition): FHIRCondition {
  return {
    resourceType: 'Condition',
    id: condition.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroCondition`],
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: condition.clinical_status,
        },
      ],
    },
    ...(condition.verification_status && {
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: condition.verification_status,
          },
        ],
      },
    }),
    ...(condition.category && {
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: condition.category,
            },
          ],
        },
      ],
    }),
    ...(condition.severity && {
      severity: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: condition.severity === 'mild' ? '255604002' : condition.severity === 'moderate' ? '6736007' : '24484000',
            display: condition.severity,
          },
        ],
      },
    }),
    code: {
      coding: [
        {
          system: condition.code_system,
          code: condition.code,
          display: condition.code_display,
        },
      ],
    },
    ...(condition.body_site && {
      bodySite: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: condition.body_site,
            },
          ],
        },
      ],
    }),
    ...(condition.onset_date_time && {
      onsetDateTime: condition.onset_date_time,
    }),
    recordedDate: condition.recorded_date,
    ...(condition.recorder && {
      recorder: {
        reference: `Practitioner/${condition.recorder}`,
      },
    }),
    ...(condition.asserter && {
      asserter: {
        reference: `Practitioner/${condition.asserter}`,
      },
    }),
    subject: {
      reference: `Patient/${condition.subject}`,
    },
    ...(condition.encounter && {
      encounter: {
        reference: `Encounter/${condition.encounter}`,
      },
    }),
    ...(condition.notes && condition.notes.length > 0 && {
      note: condition.notes.map(n => ({ text: n })),
    }),
  };
}

// ─── Encounter Mapper ─────────────────────────────────────────────────────

interface InternalEncounter {
  id: string;
  status: string;
  class: string;
  type?: string;
  priority?: string;
  subject: string;
  participant?: string[];
  period_start: string;
  period_end?: string;
  length?: number;
  reason?: string[];
  diagnosis?: string[];
  hospitalization?: string;
  discharge_disposition?: string;
  service_provider?: string;
  location?: string;
  notes?: string[];
}

export function mapEncounterToFHIR(encounter: InternalEncounter): FHIREncounter {
  return {
    resourceType: 'Encounter',
    id: encounter.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroEncounter`],
    },
    status: encounter.status as any,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounter.class,
      display: encounter.class.charAt(0).toUpperCase() + encounter.class.slice(1),
    },
    ...(encounter.type && {
      type: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: encounter.type === 'admission' ? '32485007' : encounter.type === 'consultation' ? '11429006' : encounter.type === 'followup' ? '185389003' : encounter.type === 'wellness' ? '185349003' : encounter.type === 'urgent' ? '50849000' : '308335008',
              display: encounter.type,
            },
          ],
        },
      ],
    }),
    ...(encounter.priority && {
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
            code: encounter.priority,
          },
        ],
      },
    }),
    subject: {
      reference: `Patient/${encounter.subject}`,
    },
    ...(encounter.participant && encounter.participant.length > 0 && {
      participant: encounter.participant.map(p => ({
        individual: {
          reference: `Practitioner/${p}`,
        },
      })),
    }),
    period: {
      start: encounter.period_start,
      ...(encounter.period_end && { end: encounter.period_end }),
    },
    ...(encounter.length && {
      length: {
        value: encounter.length,
        unit: 'min',
        system: 'http://unitsofmeasure.org',
        code: 'min',
      },
    }),
    ...(encounter.reason && encounter.reason.length > 0 && {
      reason: encounter.reason.map(r => ({
        text: r,
      })),
    }),
    ...(encounter.diagnosis && encounter.diagnosis.length > 0 && {
      diagnosis: encounter.diagnosis.map((d, i) => ({
        condition: {
          reference: `Condition/${d}`,
        },
        rank: i + 1,
        use: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
              code: 'AD',
              display: 'Admission diagnosis',
            },
          ],
        },
      })),
    }),
    ...(encounter.hospitalization && {
      hospitalization: {
        ...(encounter.hospitalization !== 'outpatient' && {
          admitSource: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/admit-source',
                code: encounter.hospitalization,
              },
            ],
          },
        }),
        ...(encounter.discharge_disposition && {
          dischargeDisposition: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/discharge-disposition',
                code: encounter.discharge_disposition,
              },
            ],
          },
        }),
      },
    }),
    ...(encounter.service_provider && {
      serviceProvider: {
        reference: `Organization/${encounter.service_provider}`,
      },
    }),
    ...(encounter.location && {
      location: [
        {
          location: {
            display: encounter.location,
          },
        },
      ],
    }),
    ...(encounter.notes && encounter.notes.length > 0 && {
      note: encounter.notes.map(n => ({ text: n })),
    }),
  };
}

// ─── MedicationRequest Mapper ─────────────────────────────────────────────────

interface InternalMedicationRequest {
  id: string;
  status: string;
  intent: string;
  category?: string;
  priority?: string;
  medication_code: string;
  medication_system: string;
  medication_display: string;
  dosage_text?: string;
  dosage_instruction?: string[];
  quantity?: number;
  quantity_unit?: string;
  reason_code?: string[];
  reason_display?: string[];
  subject: string;
  encounter?: string;
  requester?: string;
  performer?: string;
  authored_on: string;
  dispense_request: boolean;
  substitution: boolean;
  notes?: string[];
}

export function mapMedicationRequestToFHIR(medication: InternalMedicationRequest): FHIRMedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    id: medication.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroMedicationRequest`],
    },
    status: medication.status as any,
    intent: medication.intent as any,
    ...(medication.category && {
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/medication-request-category',
              code: medication.category,
            },
          ],
        },
      ],
    }),
    ...(medication.priority && {
      priority: medication.priority as 'routine' | 'urgent' | 'asap' | 'stat',
    }),
    medicationCodeableConcept: {
      coding: [
        {
          system: medication.medication_system,
          code: medication.medication_code,
          display: medication.medication_display,
        },
      ],
    },
    ...(medication.dosage_text && {
      dosageInstruction: [
        {
          text: medication.dosage_text,
          ...(medication.dosage_instruction && medication.dosage_instruction.length > 0 && {
            additionalInstruction: medication.dosage_instruction.map(di => ({ text: di })),
          }),
        },
      ],
    }),
    ...(medication.quantity && {
      dispenseRequest: {
        ...(medication.dispense_request && {
          validityPeriod: {
            start: medication.authored_on,
          },
        }),
        quantity: {
          value: medication.quantity,
          unit: medication.quantity_unit,
          system: 'http://unitsofmeasure.org',
          code: medication.quantity_unit,
        },
      },
    }),
    ...(medication.substitution !== undefined && {
      substitution: {
        allowed: medication.substitution,
      },
    }),
    ...(medication.reason_code && medication.reason_code.length > 0 && {
      reason: {
        code: medication.reason_code.map((rc, i) => ({
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: rc,
              display: medication.reason_display?.[i],
            },
          ],
        })),
      },
    }),
    subject: {
      reference: `Patient/${medication.subject}`,
    },
    ...(medication.encounter && {
      encounter: {
        reference: `Encounter/${medication.encounter}`,
      },
    }),
    ...(medication.requester && {
      requester: {
        reference: `Practitioner/${medication.requester}`,
      },
    }),
    ...(medication.performer && {
      performer: {
        reference: `Practitioner/${medication.performer}`,
      },
    }),
    authoredOn: medication.authored_on,
    ...(medication.notes && medication.notes.length > 0 && {
      note: medication.notes.map(n => ({ text: n })),
    }),
  };
}

// ─── ServiceRequest Mapper ───────────────────────────────────────────────────

interface InternalServiceRequest {
  id: string;
  status: string;
  intent: string;
  category?: string;
  priority?: string;
  code: string;
  code_system: string;
  code_display: string;
  body_site?: string;
  quantity?: number;
  occurrence_date_time?: string;
  occurrence_period?: string;
  as_needed: boolean;
  as_needed_code?: string;
  subject: string;
  encounter?: string;
  requester?: string;
  performer?: string;
  performer_type?: string;
  reason_code?: string[];
  reason_display?: string[];
  supporting_info?: string[];
  notes?: string[];
  specimen?: string;
}

export function mapServiceRequestToFHIR(service: InternalServiceRequest): FHIRServiceRequest {
  return {
    resourceType: 'ServiceRequest',
    id: service.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroServiceRequest`],
    },
    status: service.status as any,
    intent: service.intent as any,
    ...(service.category && {
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: service.category === 'diagnostic' ? '363679005' : service.category === 'therapeutic' ? '363698007' : service.category === 'surgical' ? '387713003' : '409010008',
              display: service.category,
            },
          ],
        },
      ],
    }),
    ...(service.priority && {
      priority: service.priority as 'routine' | 'urgent' | 'asap' | 'stat',
    }),
    code: {
      coding: [
        {
          system: service.code_system,
          code: service.code,
          display: service.code_display,
        },
      ],
    },
    ...(service.body_site && {
      bodySite: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: service.body_site,
            },
          ],
        },
      ],
    }),
    ...(service.quantity && {
      quantity: {
        value: service.quantity,
      },
    }),
    ...(service.occurrence_date_time && {
      occurrenceDateTime: service.occurrence_date_time,
    }),
    ...(service.occurrence_period && {
      occurrencePeriod: JSON.parse(service.occurrence_period),
    }),
    ...(service.as_needed && {
      asNeededBoolean: true,
      ...(service.as_needed_code && {
        asNeededCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: service.as_needed_code,
            },
          ],
        },
      }),
    }),
    subject: {
      reference: `Patient/${service.subject}`,
    },
    ...(service.encounter && {
      encounter: {
        reference: `Encounter/${service.encounter}`,
      },
    }),
    ...(service.requester && {
      requester: {
        reference: `Practitioner/${service.requester}`,
      },
    }),
    ...(service.performer && {
      performer: [
        {
          reference: `${service.performer_type === 'organization' ? 'Organization' : 'Practitioner'}/${service.performer}`,
        },
      ],
    }),
    ...(service.reason_code && service.reason_code.length > 0 && {
      reason: {
        code: service.reason_code.map((rc, i) => ({
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: rc,
              display: service.reason_display?.[i],
            },
          ],
        })),
      },
    }),
    ...(service.supporting_info && service.supporting_info.length > 0 && {
      supportingInfo: service.supporting_info.map(info => ({
        reference: info,
      })),
    }),
    ...(service.notes && service.notes.length > 0 && {
      note: service.notes.map(n => ({ text: n })),
    }),
    ...(service.specimen && {
      specimen: [
        {
          reference: service.specimen,
        },
      ],
    }),
  };
}

// ─── Procedure Mapper ───────────────────────────────────────────────────────

interface InternalProcedure {
  id: string;
  status: string;
  status_reason?: string;
  category?: string;
  code: string;
  code_system: string;
  code_display: string;
  body_site?: string;
  subject: string;
  encounter?: string;
  performed_date_time?: string;
  performer?: string[];
  reason_code?: string[];
  reason_display?: string[];
  outcome?: string;
  complication?: string[];
  follow_up?: string;
  notes?: string[];
  focal_device?: string;
  used_reference?: string[];
}

export function mapProcedureToFHIR(procedure: InternalProcedure): FHIRProcedure {
  return {
    resourceType: 'Procedure',
    id: procedure.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroProcedure`],
    },
    status: procedure.status as any,
    ...(procedure.status_reason && {
      statusReason: {
        text: procedure.status_reason,
      },
    }),
    ...(procedure.category && {
      category: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: procedure.category === 'diagnostic' ? '363679005' : procedure.category === 'therapeutic' ? '363698007' : procedure.category === 'surgical' ? '387713003' : procedure.category === 'exploration' ? '370997008' : '409010008',
            display: procedure.category,
          },
        ],
      },
    }),
    code: {
      coding: [
        {
          system: procedure.code_system,
          code: procedure.code,
          display: procedure.code_display,
        },
      ],
    },
    ...(procedure.body_site && {
      bodySite: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: procedure.body_site,
            },
          ],
        },
      ],
    }),
    subject: {
      reference: `Patient/${procedure.subject}`,
    },
    ...(procedure.encounter && {
      encounter: {
        reference: `Encounter/${procedure.encounter}`,
      },
    }),
    ...(procedure.performed_date_time && {
      performedDateTime: procedure.performed_date_time,
    }),
    ...(procedure.performer && procedure.performer.length > 0 && {
      performer: procedure.performer.map(p => ({
        actor: {
          reference: `Practitioner/${p}`,
        },
      })),
    }),
    ...(procedure.reason_code && procedure.reason_code.length > 0 && {
      reason: {
        code: procedure.reason_code.map((rc, i) => ({
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: rc,
              display: procedure.reason_display?.[i],
            },
          ],
        })),
      },
    }),
    ...(procedure.outcome && {
      outcome: {
        text: procedure.outcome,
      },
    }),
    ...(procedure.complication && procedure.complication.length > 0 && {
      complication: procedure.complication.map(c => ({
        text: c,
      })),
    }),
    ...(procedure.follow_up && {
      followUp: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '225908001',
              display: procedure.follow_up,
            },
          ],
        },
      ],
    }),
    ...(procedure.notes && procedure.notes.length > 0 && {
      note: procedure.notes.map(n => ({ text: n })),
    }),
    ...(procedure.focal_device && {
      focalDevice: [
        {
          action: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '129265001',
                display: 'Inserted',
              },
            ],
          },
          manipulated: {
            reference: procedure.focal_device,
          },
        },
      ],
    }),
    ...(procedure.used_reference && procedure.used_reference.length > 0 && {
      used: procedure.used_reference.map(ref => ({
        reference: ref,
      })),
    }),
  };
}

// ─── AllergyIntolerance Mapper ─────────────────────────────────────────────────

interface InternalAllergyIntolerance {
  id: string;
  clinical_status: string;
  verification_status: string;
  type: string;
  category?: string;
  criticality?: string;
  code: string;
  code_system: string;
  code_display: string;
  substance: string;
  patient: string;
  onset_date_time?: string;
  onset_age?: number;
  reaction?: string[];
  note?: string;
  recorder?: string;
  last_occurrence?: string;
}

export function mapAllergyIntoleranceToFHIR(allergy: InternalAllergyIntolerance): FHIRAllergyIntolerance {
  return {
    resourceType: 'AllergyIntolerance',
    id: allergy.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroAllergyIntolerance`],
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: allergy.clinical_status,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: allergy.verification_status,
        },
      ],
    },
    type: allergy.type as any,
    ...(allergy.category && {
      category: [allergy.category as any],
    }),
    ...(allergy.criticality && {
      criticality: allergy.criticality as any,
    }),
    code: {
      coding: [
        {
          system: allergy.code_system,
          code: allergy.code,
          display: allergy.code_display,
        },
      ],
      text: allergy.substance,
    },
    patient: {
      reference: `Patient/${allergy.patient}`,
    },
    ...(allergy.onset_date_time && {
      onsetDateTime: allergy.onset_date_time,
    }),
    ...(allergy.onset_age && {
      onsetAge: {
        value: allergy.onset_age,
        system: 'http://unitsofmeasure.org',
        code: 'a',
        unit: 'years',
      },
    }),
    ...(allergy.reaction && allergy.reaction.length > 0 && {
      reaction: allergy.reaction.map(r => ({
        manifestation: [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: r,
              },
            ],
          },
        ],
      })),
    }),
    ...(allergy.note && {
      note: [{ text: allergy.note }],
    }),
    ...(allergy.recorder && {
      recorder: {
        reference: `Practitioner/${allergy.recorder}`,
      },
    }),
    ...(allergy.last_occurrence && {
      lastOccurrence: allergy.last_occurrence,
    }),
  };
}

// ─── DiagnosticReport Mapper ───────────────────────────────────────────────────

interface InternalDiagnosticReport {
  id: string;
  status: string;
  category?: string;
  code: string;
  code_system: string;
  code_display: string;
  subject: string;
  encounter?: string;
  effective_date_time: string;
  issued: string;
  performer?: string;
  results_interpreter?: string;
  specimen?: string;
  result?: string[];
  conclusion?: string;
  conclusion_code?: string[];
  attachment?: string[];
  notes?: string[];
}

export function mapDiagnosticReportToFHIR(report: InternalDiagnosticReport): FHIRDiagnosticReport {
  return {
    resourceType: 'DiagnosticReport',
    id: report.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroDiagnosticReport`],
    },
    status: report.status as any,
    ...(report.category && {
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: report.category === 'laboratory' ? '394578004' : report.category === 'radiology' ? '394914008' : report.category === 'cardiology' ? '394581002' : report.category === 'pathology' ? '394580003' : '394579002',
              display: report.category,
            },
          ],
        },
      ],
    }),
    code: {
      coding: [
        {
          system: report.code_system,
          code: report.code,
          display: report.code_display,
        },
      ],
    },
    subject: {
      reference: `Patient/${report.subject}`,
    },
    ...(report.encounter && {
      encounter: {
        reference: `Encounter/${report.encounter}`,
      },
    }),
    effectiveDateTime: report.effective_date_time,
    issued: report.issued,
    ...(report.performer && {
      performer: [
        {
          reference: `Practitioner/${report.performer}`,
        },
      ],
    }),
    ...(report.results_interpreter && {
      resultsInterpreter: [
        {
          reference: `Practitioner/${report.results_interpreter}`,
        },
      ],
    }),
    ...(report.specimen && {
      specimen: [
        {
          reference: report.specimen,
        },
      ],
    }),
    ...(report.result && report.result.length > 0 && {
      result: report.result.map(r => ({
        reference: r,
      })),
    }),
    ...(report.conclusion && {
      conclusion: report.conclusion,
    }),
    ...(report.conclusion_code && report.conclusion_code.length > 0 && {
      conclusionCode: report.conclusion_code.map(cc => ({
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: cc,
          },
        ],
      })),
    }),
    ...(report.attachment && report.attachment.length > 0 && {
      attachment: report.attachment.map(att => ({
        url: att,
      })),
    }),
    ...(report.notes && report.notes.length > 0 && {
      note: report.notes.map(n => ({ text: n })),
    }),
  };
}

// ─── Immunization Mapper ─────────────────────────────────────────────────────

interface InternalImmunization {
  id: string;
  status: string;
  status_reason?: string;
  vaccine_code: string;
  vaccine_system: string;
  vaccine_display: string;
  patient: string;
  encounter?: string;
  occurrence_date_time: string;
  recorded: string;
  report_origin?: string;
  location?: string;
  site?: string;
  route?: string;
  dose_quantity?: number;
  dose_unit?: string;
  lot_number?: string;
  expiration_date?: string;
  performer?: string;
  note?: string[];
  subpotent?: string[];
  reaction?: string[];
  program_eligibility?: string[];
  funding_source?: string;
}

export function mapImmunizationToFHIR(immunization: InternalImmunization): FHIRImmunization {
  return {
    resourceType: 'Immunization',
    id: immunization.id,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroImmunization`],
    },
    status: immunization.status as any,
    ...(immunization.status_reason && {
      statusReason: {
        text: immunization.status_reason,
      },
    }),
    vaccineCode: {
      coding: [
        {
          system: immunization.vaccine_system,
          code: immunization.vaccine_code,
          display: immunization.vaccine_display,
        },
      ],
    },
    patient: {
      reference: `Patient/${immunization.patient}`,
    },
    ...(immunization.encounter && {
      encounter: {
        reference: `Encounter/${immunization.encounter}`,
      },
    }),
    occurrenceDateTime: immunization.occurrence_date_time,
    recorded: immunization.recorded,
    ...(immunization.report_origin && {
      reportOrigin: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/immunization-origin',
            code: immunization.report_origin,
          },
        ],
      },
    }),
    ...(immunization.location && {
      location: {
        display: immunization.location,
      },
    }),
    ...(immunization.site && {
      site: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
            code: immunization.site,
          },
        ],
      },
    }),
    ...(immunization.route && {
      route: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
            code: immunization.route,
          },
        ],
      },
    }),
    ...(immunization.dose_quantity && {
      doseQuantity: {
        value: immunization.dose_quantity,
        unit: immunization.dose_unit,
        system: 'http://unitsofmeasure.org',
        code: immunization.dose_unit,
      },
    }),
    ...(immunization.lot_number && {
      lotNumber: immunization.lot_number,
    }),
    ...(immunization.expiration_date && {
      expirationDate: immunization.expiration_date,
    }),
    ...(immunization.performer && {
      performer: [
        {
          actor: {
            reference: `Practitioner/${immunization.performer}`,
          },
        },
      ],
    }),
    ...(immunization.note && immunization.note.length > 0 && {
      note: immunization.note.map(n => ({ text: n })),
    }),
    ...(immunization.subpotent && immunization.subpotent.length > 0 && {
      subpotentReason: immunization.subpotent.map(sp => ({
        text: sp,
      })),
    }),
    ...(immunization.reaction && immunization.reaction.length > 0 && {
      reaction: immunization.reaction.map(r => ({
        detail: {
          reference: r,
        },
      })),
    }),
    ...(immunization.program_eligibility && immunization.program_eligibility.length > 0 && {
      programEligibility: immunization.program_eligibility.map(pe => ({
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/immunization-program-eligibility',
            code: pe,
            display: pe,
          },
        ],
      })),
    }),
    ...(immunization.funding_source && {
      fundingSource: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/immunization-funding-source',
            code: immunization.funding_source,
          },
        ],
      },
    }),
  };
}

// ─── Medication Dispense Mapper ──────────────────────────────────────

interface InternalMedicationDispense {
  id: string;
  prescriptionId: string;
  rxNumber: string;
  patientId: string;
  dispensedBy?: string;
  dispensedAt?: string;
  status: string; // e.g. 'completed', 'entered-in-error', 'stopped'
  items: Array<{
    drug: string;
    quantity: number;
    dose?: string;
    frequency?: string;
  }>;
  notes?: string;
}

export function mapMedicationDispenseToFHIR(dispense: InternalMedicationDispense): FHIRMedicationDispense {
  return {
    resourceType: 'MedicationDispense',
    id: dispense.id,
    meta: {
      lastUpdated: dispense.dispensedAt || new Date().toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroMedicationDispense`],
    },
    status: (dispense.status === 'dispensed' ? 'completed' : dispense.status) as any,
    medicationCodeableConcept: {
      coding: dispense.items.map((med) => ({
        system: `${FHIR_CONFIG.systemUrl}/medication`,
        code: med.drug.toLowerCase().replace(/\s+/g, '-'),
        display: med.drug,
      })),
      text: dispense.items.map((m) => m.drug).join(', '),
    },
    subject: {
      reference: `Patient/${dispense.patientId}`,
      type: 'Patient',
    },
    authorizingPrescription: [
      {
        reference: `MedicationRequest/${dispense.prescriptionId}`,
        type: 'MedicationRequest',
        display: dispense.rxNumber,
      },
    ],
    ...(dispense.dispensedBy && {
      performer: [
        {
          actor: {
            reference: `Practitioner/${dispense.dispensedBy}`,
            type: 'Practitioner',
          },
        },
      ],
    }),
    whenHandedOver: dispense.dispensedAt || new Date().toISOString(),
    quantity: {
      value: dispense.items.reduce((total, m) => total + m.quantity, 0),
      unit: 'tablet',
    },
    note: dispense.notes
      ? [
          {
            text: dispense.notes,
            time: dispense.dispensedAt || new Date().toISOString(),
          },
        ]
      : undefined,
  };
}

// ─── Claim Mapper ───────────────────────────────────────────────────

interface InternalShifClaim {
  id: string;
  hospitalId: string;
  patientId: string;
  claimNumber: string;
  memberNumber: string;
  status: string; // 'pending', 'submitted', 'approved', 'rejected', 'paid'
  preauthNumber?: string | null;
  preauthStatus?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  amountClaimed: number | string | any;
  amountApproved?: number | string | any | null;
  rejectionReason?: string | null;
  submittedAt?: string | Date | null;
  decidedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export function mapClaimToFHIR(claim: InternalShifClaim): FHIRClaim {
  const amountClaimedVal = typeof claim.amountClaimed === 'number'
    ? claim.amountClaimed
    : parseFloat(String(claim.amountClaimed)) || 0;

  const fhirStatus: 'active' | 'cancelled' | 'draft' =
    claim.status === 'rejected' ? 'cancelled' : 'active';

  return {
    resourceType: 'Claim',
    id: claim.id,
    meta: {
      lastUpdated: new Date(claim.updatedAt).toISOString(),
      profile: [`${FHIR_CONFIG.systemUrl}/StructureDefinition/AfyaHeroClaim`],
    },
    status: fhirStatus,
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'institutional',
          display: 'Institutional',
        },
      ],
    },
    use: 'claim',
    patient: {
      reference: `Patient/${claim.patientId}`,
      type: 'Patient',
    },
    created: new Date(claim.createdAt).toISOString(),
    provider: {
      reference: `Organization/${claim.hospitalId}`,
      type: 'Organization',
    },
    insurer: {
      display: 'Social Health Authority (SHA)',
    },
    priority: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: 'normal',
          display: 'Normal',
        },
      ],
    },
    identifier: [
      {
        system: `${FHIR_CONFIG.systemUrl}/claim-number`,
        value: claim.claimNumber,
        use: 'official',
      },
      {
        system: `${FHIR_CONFIG.systemUrl}/member-number`,
        value: claim.memberNumber,
        use: 'secondary',
      },
    ],
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          display: 'SHA Coverage',
        },
        ...(claim.preauthNumber && {
          preAuthRef: [claim.preauthNumber],
        }),
      },
    ],
    ...(claim.diagnosis && {
      diagnosis: [
        {
          sequence: 1,
          diagnosisCodeableConcept: {
            text: claim.diagnosis,
          },
        },
      ],
    }),
    item: [
      {
        sequence: 1,
        productOrService: {
          text: claim.treatment || 'Medical Services',
        },
        net: {
          value: amountClaimedVal,
          system: 'http://unitsofmeasure.org',
          code: 'KES',
        },
      },
    ],
    total: {
      value: amountClaimedVal,
      system: 'http://unitsofmeasure.org',
      code: 'KES',
    },
  };
}
