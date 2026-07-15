/**
 * FHIR Utilities Index
 * 
 * Exports all FHIR-related types, mappers, and utilities
 */

// FHIR Resource Types
export type {
  FHIRResource,
  FHIRBundle,
  FHIRBundleEntry,
  FHIRBundleLink,
  FHIRPatient,
  FHIRObservation,
  FHIRMedicationRequest,
  FHIRPractitioner,
  FHIROrganization,
  FHIROperationOutcome,
  FHIROperationOutcomeIssue,
  // Data types
  FHIRCoding,
  FHIRCodeableConcept,
  FHIRIdentifier,
  FHIRReference,
  FHIRQuantity,
  FHIRRange,
  FHIRPeriod,
  FHIRHumanName,
  FHIRContactPoint,
  FHIRAddress,
  FHIRMeta,
  FHIRNarrative,
  FHIRExtension,
  FHIRDosage,
  FHIRTiming,
} from './fhir-types';

export type {
  FHIRCondition,
  FHIREncounter,
  FHIRAllergyIntolerance,
  FHIRDiagnosticReport,
  FHIRProcedure,
  FHIRImmunization,
  FHIRServiceRequest,
  FHIRMedicationDispense,
  FHIRClaim,
} from './fhir-extended-types';

// FHIR Mappers
export {
  mapPatientToFHIR,
  mapVitalsToFHIR,
  mapLabResultToFHIR,
  mapPrescriptionToFHIR,
  mapPractitionerToFHIR,
  mapOrganizationToFHIR,
  mapConditionToFHIR,
  mapEncounterToFHIR,
  mapMedicationRequestToFHIR,
  mapServiceRequestToFHIR,
  mapProcedureToFHIR,
  mapAllergyIntoleranceToFHIR,
  mapDiagnosticReportToFHIR,
  mapImmunizationToFHIR,
  mapMedicationDispenseToFHIR,
  mapClaimToFHIR,
  createFHIRBundle,
} from './fhir-mappers';

// FHIR Configuration
export const FHIR_BASE_URL = process.env.FHIR_BASE_URL || 'https://fhir.afyahero.com';
export const FHIR_VERSION = '4.0.1';
export const FHIR_SYSTEM_URL = 'https://afyahero.com/fhir';
