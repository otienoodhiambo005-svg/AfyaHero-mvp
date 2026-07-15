/**
 * FHIR Resource Types and Interfaces
 * 
 * Implements core FHIR (R4) resource definitions for AfyaHero.
 * Ref: https://www.hl7.org/fhir/resourcelist.html
 */

// ─── FHIR Bundle ──────────────────────────────────────────────────────

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: FHIRBundleLink[];
  entry?: FHIRBundleEntry[];
}

export interface FHIRBundleLink {
  relation: string;
  url: string;
}

export interface FHIRBundleEntry {
  fullUrl?: string;
  resource: FHIRResource;
  search?: {
    mode: 'match' | 'include' | 'outcome';
    score?: number;
  };
  request?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
  };
  response?: {
    status: string;
    location?: string;
    etag?: string;
    lastModified?: string;
  };
}

// ─── FHIR Base Resource ────────────────────────────────────────────────

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: FHIRMeta;
  implicitRules?: string;
  language?: string;
  text?: FHIRNarrative;
  contained?: FHIRResource[];
  extension?: FHIRExtension[];
  modifierExtension?: FHIRExtension[];
}

export interface FHIRMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: FHIRCoding[];
  tag?: FHIRCoding[];
}

export interface FHIRNarrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

export interface FHIRExtension {
  url: string;
  valueString?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueDateTime?: string;
  valueCode?: string;
  valueCoding?: FHIRCoding;
  valueQuantity?: FHIRQuantity;
  valueReference?: FHIRReference;
  [key: string]: unknown;
}

// ─── FHIR Data Types ──────────────────────────────────────────────────

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system?: string;
  value?: string;
  period?: FHIRPeriod;
  assigner?: FHIRReference;
}

export interface FHIRReference {
  reference?: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
}

export interface FHIRRatio {
  numerator?: FHIRQuantity;
  denominator?: FHIRQuantity;
}

export interface FHIRPeriod {
  start?: string;
  end?: string;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: FHIRPeriod;
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: FHIRPeriod;
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: FHIRPeriod;
}

// ─── FHIR Patient ────────────────────────────────────────────────────

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: FHIRAttachment[];
  contact?: FHIRPatientContact[];
  generalPractitioner?: FHIRReference[];
  managingOrganization?: FHIRReference;
}

export interface FHIRPatientContact {
  relationship?: FHIRCodeableConcept[];
  name?: FHIRHumanName;
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: FHIRReference;
  period?: FHIRPeriod;
}

export interface FHIRAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

// ─── FHIR Observation ────────────────────────────────────────────────

export interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  partOf?: FHIRReference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  focus?: FHIRReference[];
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued?: string;
  performer?: FHIRReference[];
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueSampledData?: FHIRSampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: FHIRPeriod;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  note?: FHIRAnnotation[];
  bodySite?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  specimen?: FHIRReference;
  device?: FHIRReference;
  referenceRange?: FHIRObservationReferenceRange[];
  hasMember?: FHIRReference[];
  derivedFrom?: FHIRReference[];
  component?: FHIRObservationComponent[];
}

export interface FHIRSampledData {
  origin: FHIRQuantity;
  period: number;
  factor?: number;
  lowerLimit?: number;
  upperLimit?: number;
  dimensions: number;
  data: string;
}

export interface FHIRAnnotation {
  authorReference?: FHIRReference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface FHIRObservationReferenceRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
  type?: FHIRCodeableConcept;
  appliesTo?: FHIRCodeableConcept[];
  age?: FHIRRange;
  text?: string;
}

export interface FHIRObservationComponent {
  code: FHIRCodeableConcept;
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: FHIRRange;
  valueRatio?: FHIRRatio;
  valueSampledData?: FHIRSampledData;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: FHIRPeriod;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  referenceRange?: FHIRObservationReferenceRange[];
}

// ─── FHIR Procedure ───────────────────────────────────────────────────

export interface FHIRProcedure extends FHIRResource {
  resourceType: 'Procedure';
  identifier?: FHIRIdentifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: FHIRReference[];
  partOf?: FHIRReference[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept;
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  performedDateTime?: string;
  performedPeriod?: FHIRPeriod;
  performedString?: string;
  performedAge?: any; // Age type
  performedRange?: FHIRRange;
  recorder?: FHIRReference;
  performer?: FHIRProcedurePerformer[];
  location?: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  bodySite?: FHIRCodeableConcept[];
  outcome?: FHIRCodeableConcept;
  report?: FHIRReference[];
  complication?: FHIRCodeableConcept[];
  complicationDetail?: FHIRReference[];
  followUp?: FHIRCodeableConcept[];
  note?: FHIRAnnotation[];
  focalDevice?: FHIRProcedureFocalDevice[];
  usedReference?: FHIRReference[];
  usedCode?: FHIRCodeableConcept[];
}

export interface FHIRProcedurePerformer {
  function?: FHIRCodeableConcept;
  actor: FHIRReference;
  onBehalfOf?: FHIRReference;
}

export interface FHIRProcedureFocalDevice {
  action?: FHIRCodeableConcept;
  manipulated: FHIRReference;
}

// ─── FHIR Medication Request (Prescription) ──────────────────────────

export interface FHIRMedicationRequest extends FHIRResource {
  resourceType: 'MedicationRequest';
  identifier?: FHIRIdentifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: FHIRCodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  medicationCodeableConcept: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject: FHIRReference;
  encounter?: FHIRReference;
  supportingInformation?: FHIRReference[];
  authoredOn?: string;
  requester?: FHIRReference;
  performer?: FHIRReference;
  performerType?: FHIRCodeableConcept;
  recorder?: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: FHIRReference[];
  groupIdentifier?: FHIRIdentifier;
  courseOfTherapyType?: FHIRCodeableConcept;
  insurance?: FHIRReference[];
  note?: FHIRAnnotation[];
  dosageInstruction?: FHIRDosage[];
  dispenseRequest?: FHIRMedicationRequestDispenseRequest;
  substitution?: FHIRMedicationRequestSubstitution;
  priorPrescription?: FHIRReference;
  detectedIssue?: FHIRReference[];
  eventHistory?: FHIRReference[];
}

export interface FHIRDosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: FHIRCodeableConcept[];
  patientInstruction?: string;
  timing?: FHIRTiming;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: FHIRCodeableConcept;
  site?: FHIRCodeableConcept;
  route?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  doseAndRate?: FHIRDoseAndRate[];
  maxDosePerPeriod?: FHIRRatio;
  maxDosePerAdministration?: FHIRQuantity;
  maxDosePerLifetime?: FHIRQuantity;
}

export interface FHIRTiming {
  event?: string[];
  repeat?: FHIRTimingRepeat;
  code?: FHIRCodeableConcept;
}

export interface FHIRTimingRepeat {
  boundsDuration?: any;
  boundsRange?: FHIRRange;
  boundsPeriod?: FHIRPeriod;
  count?: number;
  countMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dayOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  timeOfDay?: string[];
  when?: ('MORN' | 'MORN.early' | 'MORN.late' | 'NOON' | 'AFT' | 'AFT.early' | 'AFT.late' | 'EVE' | 'EVE.early' | 'EVE.late' | 'NIGHT' | 'PHS')[];
  offset?: number;
}

export interface FHIRDoseAndRate {
  type?: FHIRCodeableConcept;
  doseRange?: FHIRRange;
  doseQuantity?: FHIRQuantity;
  rateRatio?: FHIRRatio;
  rateRange?: FHIRRange;
  rateQuantity?: FHIRQuantity;
}

export interface FHIRMedicationRequestDispenseRequest {
  initialFill?: FHIRMedicationRequestInitialFill;
  dispenseInterval?: FHIRDuration;
  validityPeriod?: FHIRPeriod;
  numberOfRepeatsAllowed?: number;
  quantity?: FHIRQuantity;
  expectedSupplyDuration?: FHIRDuration;
  performer?: FHIRReference;
}

export interface FHIRMedicationRequestInitialFill {
  quantity?: FHIRQuantity;
  duration?: FHIRDuration;
}

export interface FHIRDuration {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRMedicationRequestSubstitution {
  allowed: boolean;
  reason?: FHIRCodeableConcept;
}

// ─── FHIR Organization ────────────────────────────────────────────────

export interface FHIROrganization extends FHIRResource {
  resourceType: 'Organization';
  identifier?: FHIRIdentifier[];
  active?: boolean;
  type?: FHIRCodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  partOf?: FHIRReference;
  contact?: FHIROrganizationContact[];
  endpoint?: FHIRReference[];
}

export interface FHIROrganizationContact {
  purpose?: FHIRCodeableConcept;
  name?: FHIRHumanName;
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
}

// ─── FHIR Practitioner ────────────────────────────────────────────────

export interface FHIRPractitioner extends FHIRResource {
  resourceType: 'Practitioner';
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  photo?: FHIRAttachment[];
  qualification?: FHIRPractitionerQualification[];
  communication?: FHIRCodeableConcept[];
}

export interface FHIRPractitionerQualification {
  identifier?: FHIRIdentifier[];
  code: FHIRCodeableConcept;
  period?: FHIRPeriod;
  issuer?: FHIRReference;
}

// ─── FHIR OperationOutcome ─────────────────────────────────────────────

export interface FHIROperationOutcome extends FHIRResource {
  resourceType: 'OperationOutcome';
  issue: FHIROperationOutcomeIssue[];
}

export interface FHIRDevice extends FHIRResource {
  resourceType: 'Device';
  identifier?: FHIRIdentifier[];
  definition?: FHIRReference;
  udiCarrier?: FHIRDeviceUdiCarrier[];
  status?: 'active' | 'inactive' | 'entered-in-error' | 'unknown';
  statusReason?: FHIRCodeableConcept[];
  distinctIdentifier?: string;
  manufacturer?: string;
  manufactureDate?: string;
  expirationDate?: string;
  lotNumber?: string;
  serialNumber?: string;
  deviceName?: FHIRDeviceName[];
  modelNumber?: string;
  partNumber?: string;
  type?: FHIRCodeableConcept;
  specialization?: FHIRDeviceSpecialization[];
  version?: FHIRDeviceVersion[];
  property?: FHIRDeviceProperty[];
  owner?: FHIRReference;
  contact?: FHIRContactPoint[];
  location?: FHIRReference;
  url?: string;
  note?: FHIRAnnotation[];
  safety?: FHIRCodeableConcept[];
  parent?: FHIRReference;
}

export interface FHIRDeviceUdiCarrier {
  deviceIdentifier?: string;
  issuer?: string;
  jurisdiction?: string;
  carrierAIDC?: string;
  carrierHRF?: string;
  entryType?: 'barcode' | 'rfid' | 'manual' | 'card' | 'self-reported' | 'unknown';
}

export interface FHIRDeviceName {
  name: string;
  type: 'registered-name' | 'user-friendly-name' | 'patient-reported-name' | 'manufacturer-name' | 'model-name' | 'other';
}

export interface FHIRDeviceSpecialization {
  systemType: FHIRCodeableConcept;
  version?: string;
}

export interface FHIRDeviceVersion {
  type?: FHIRCodeableConcept;
  component?: FHIRIdentifier;
  value: string;
}

export interface FHIRDeviceProperty {
  type: FHIRCodeableConcept;
  valueQuantity?: FHIRQuantity[];
  valueCode?: FHIRCodeableConcept[];
}

export interface FHIROperationOutcomeIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code:
    | 'invalid'
    | 'structure'
    | 'required'
    | 'value'
    | 'invariant'
    | 'security'
    | 'login'
    | 'unknown'
    | 'expired'
    | 'forbidden'
    | 'suppressed'
    | 'processing'
    | 'not-supported'
    | 'conflict'
    | 'transient'
    | 'lock-error'
    | 'no-store'
    | 'exception'
    | 'timeout'
    | 'throttled'
    | 'informational'
    | 'not-found'
    | string;
  details?: FHIRCodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}
