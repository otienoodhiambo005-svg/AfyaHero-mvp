/**
 * Extended FHIR Resource Types and Interfaces
 *
 * Implements additional FHIR (R4) resource definitions for AfyaHero.
 */

import {
  FHIRResource,
  FHIRCoding,
  FHIRCodeableConcept,
  FHIRReference,
  FHIRPeriod,
  FHIRAnnotation,
  FHIRIdentifier,
  FHIRAddress,
  FHIRDosage
} from './fhir-types';

// ─── FHIR Condition ───────────────────────────────────────────────────

export interface FHIRCondition extends FHIRResource {
  resourceType: 'Condition';
  identifier?: FHIRIdentifier[];
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  severity?: FHIRCodeableConcept;
  code: FHIRCodeableConcept;
  bodySite?: FHIRCodeableConcept[];
  subject: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  onsetAge?: any; // Age type
  onsetPeriod?: FHIRPeriod;
  onsetRange?: FHIRRange;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: any; // Age type
  abatementBoolean?: boolean;
  abatementPeriod?: FHIRPeriod;
  abatementRange?: FHIRRange;
  abatementString?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
  asserter?: FHIRReference;
  stage?: FHIRConditionStage[];
  evidence?: FHIRConditionEvidence[];
  note?: FHIRAnnotation[];
}

export interface FHIRRange {
  low?: FHIRQuantity;
  high?: FHIRQuantity;
}

export interface FHIRQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRConditionStage {
  summary?: FHIRCodeableConcept;
  assessment?: FHIRReference[];
  type?: FHIRCodeableConcept;
}

export interface FHIRConditionEvidence {
  code?: FHIRCodeableConcept[];
  detail?: FHIRReference[];
}

// ─── FHIR Encounter ───────────────────────────────────────────────────

export interface FHIREncounter extends FHIRResource {
  resourceType: 'Encounter';
  identifier?: FHIRIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: FHIREncounterStatusHistory[];
  class: FHIRCoding;
  classHistory?: FHIREncounterClassHistory[];
  type?: FHIRCodeableConcept[];
  serviceType?: FHIRCodeableConcept;
  priority?: FHIRCodeableConcept;
  subject: FHIRReference;
  episodeOfCare?: FHIRReference[];
  basedOn?: FHIRReference[];
  participant?: FHIREncounterParticipant[];
  appointment?: FHIRReference[];
  period?: FHIRPeriod;
  length?: FHIRDuration;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  diagnosis?: FHIREncounterDiagnosis[];
  account?: FHIRReference[];
  hospitalization?: FHIREncounterHospitalization;
  location?: FHIREncounterLocation[];
  serviceProvider?: FHIRReference;
  partOf?: FHIRReference;
}

export interface FHIRDuration {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIREncounterStatusHistory {
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  period: FHIRPeriod;
}

export interface FHIREncounterClassHistory {
  class: FHIRCoding;
  period: FHIRPeriod;
}

export interface FHIREncounterParticipant {
  type?: FHIRCodeableConcept[];
  period?: FHIRPeriod;
  individual?: FHIRReference;
}

export interface FHIREncounterDiagnosis {
  condition: FHIRReference;
  use?: FHIRCodeableConcept;
  rank?: number;
}

export interface FHIREncounterHospitalization {
  preAdmissionIdentifier?: FHIRIdentifier;
  origin?: FHIRReference;
  admitSource?: FHIRCodeableConcept;
  reAdmission?: FHIRCodeableConcept;
  dietPreference?: FHIRCodeableConcept[];
  specialCourtesy?: FHIRCodeableConcept[];
  specialArrangement?: FHIRCodeableConcept[];
  destination?: FHIRReference;
  dischargeDisposition?: FHIRCodeableConcept;
}

export interface FHIREncounterLocation {
  location: FHIRReference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: FHIRCodeableConcept;
  period?: FHIRPeriod;
}

// ─── FHIR AllergyIntolerance ──────────────────────────────────────────

export interface FHIRAllergyIntolerance extends FHIRResource {
  resourceType: 'AllergyIntolerance';
  identifier?: FHIRIdentifier[];
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code: FHIRCodeableConcept;
  patient: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  onsetAge?: any; // Age type
  onsetPeriod?: FHIRPeriod;
  onsetRange?: FHIRRange;
  onsetString?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
  asserter?: FHIRReference;
  lastOccurrence?: string;
  note?: FHIRAnnotation[];
  reaction?: FHIRAllergyIntoleranceReaction[];
}

export interface FHIRAllergyIntoleranceReaction {
  substance?: FHIRCodeableConcept;
  manifestation: FHIRCodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: FHIRCodeableConcept;
  note?: FHIRAnnotation[];
}

// ─── FHIR DiagnosticReport ────────────────────────────────────────────

export interface FHIRDiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued?: string;
  performer?: FHIRReference[];
  resultsInterpreter?: FHIRReference[];
  specimen?: FHIRReference[];
  result?: FHIRReference[];
  imagingStudy?: FHIRReference[];
  media?: FHIRDiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
  presentedForm?: FHIRAttachment[];
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

export interface FHIRDiagnosticReportMedia {
  comment?: string;
  link: FHIRReference;
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

// ─── FHIR Immunization ────────────────────────────────────────────────

export interface FHIRImmunization extends FHIRResource {
  resourceType: 'Immunization';
  identifier?: FHIRIdentifier[];
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: FHIRCodeableConcept;
  vaccineCode: FHIRCodeableConcept;
  patient: FHIRReference;
  encounter?: FHIRReference;
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: FHIRCodeableConcept;
  location?: FHIRReference;
  manufacturer?: FHIRReference;
  lotNumber?: string;
  expirationDate?: string;
  site?: FHIRCodeableConcept;
  route?: FHIRCodeableConcept;
  doseQuantity?: FHIRQuantity;
  performer?: FHIRImmunizationPerformer[];
  note?: FHIRAnnotation[];
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  isSubpotent?: boolean;
  subpotentReason?: FHIRCodeableConcept[];
  education?: FHIRImmunizationEducation[];
  programEligibility?: FHIRCodeableConcept[];
  fundingSource?: FHIRCodeableConcept;
  reaction?: FHIRImmunizationReaction[];
  protocolApplied?: FHIRImmunizationProtocolApplied[];
}

export interface FHIRImmunizationPerformer {
  function?: FHIRCodeableConcept;
  actor: FHIRReference;
}

export interface FHIRImmunizationEducation {
  documentType?: string;
  reference?: string;
  publicationDate?: string;
  presentationDate?: string;
}

export interface FHIRImmunizationReaction {
  date?: string;
  detail?: FHIRReference;
  reported?: boolean;
}

export interface FHIRImmunizationProtocolApplied {
  series?: string;
  authority?: FHIRReference;
  targetDisease?: FHIRCodeableConcept[];
  doseNumberPositiveInt?: number;
  doseNumberString?: string;
  seriesDosesPositiveInt?: number;
  seriesDosesString?: string;
}

// ─── FHIR MedicationRequest ─────────────────────────────────────────────

export interface FHIRMedicationRequest extends FHIRResource {
  resourceType: 'MedicationRequest';
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: FHIRCodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'device';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  medicationCodeableConcept?: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject: FHIRReference;
  encounter?: FHIRReference;
  supportingInfo?: FHIRReference[];
  authoredOn?: string;
  requester?: FHIRReference;
  performer?: FHIRReference[];
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  note?: FHIRAnnotation[];
  dosageInstruction?: FHIRMedicationRequestDosageInstruction[];
  dispenseRequest?: FHIRMedicationRequestDispenseRequest;
  substitution?: FHIRMedicationRequestSubstitution;
  insurance?: FHIRReference[];
  detectedIssue?: FHIRReference[];
  eventHistory?: FHIRMedicationRequestEvent[];
}

export interface FHIRMedicationRequestDosageInstruction {
  sequence?: number;
  text?: string;
  additionalInstruction?: FHIRCodeableConcept[];
  patientInstruction?: string;
  timing?: FHIRTiming;
  asNeeded?: boolean;
  asNeededFor?: FHIRCodeableConcept;
  site?: FHIRCodeableConcept;
  route?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  doseAndRate?: FHIRMedicationRequestDosageAndRate;
}

export interface FHIRTiming {
  event?: FHIRTimingEvent[];
  repeat?: FHIRTimingRepeat;
  code?: FHIRCodeableConcept;
}

export interface FHIRTimingEvent {
  when?: string;
  offset?: number;
}

export interface FHIRTimingRepeat {
  boundsDuration?: string;
  boundsRange?: FHIRRange;
  boundsPeriod?: FHIRPeriod;
  count?: number;
  countMax?: number;
  duration?: string;
  durationMax?: string;
  durationUnit?: string;
  frequency?: number;
  frequencyMax?: number;
  period?: string;
  periodMax?: string;
  periodUnit?: string;
  dayOfWeek?: number[];
  timeOfDay?: string[];
  when?: string;
  offset?: number;
}

export interface FHIRMedicationRequestDosageAndRate {
  type?: FHIRCodeableConcept;
  doseQuantity?: FHIRQuantity;
  doseRange?: FHIRRange;
  rateQuantity?: FHIRQuantity;
  rateRange?: FHIRRange;
}

export interface FHIRMedicationRequestDispenseRequest {
  validityPeriod?: FHIRPeriod;
  numberOfRepeatsAllowed?: number;
  quantity?: FHIRQuantity;
  expectedSupplyDuration?: FHIRDuration;
  performer?: FHIRReference;
  dispenser?: FHIRReference;
  destination?: FHIRReference;
  dispenseCondition?: FHIRMedicationRequestDispenseCondition[];
}

export interface FHIRMedicationRequestDispenseCondition {
  expectation: 'none' | 'conditional' | 'early' | 'late' | 'asap';
  condition?: FHIRCodeableConcept;
}

export interface FHIRMedicationRequestSubstitution {
  allowed: FHIRCodeableConcept;
  reason?: FHIRCodeableConcept[];
}

export interface FHIRMedicationRequestEvent {
  status?: 'preparation' | 'in-progress' | 'cancelled' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped';
  statusReason?: FHIRCodeableConcept;
  prevented?: boolean;
  statusChangedBy?: FHIRReference;
  date?: string;
}

// ─── FHIR ServiceRequest ───────────────────────────────────────────────

export interface FHIRServiceRequest extends FHIRResource {
  resourceType: 'ServiceRequest';
  identifier?: FHIRIdentifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: FHIRReference[];
  replaces?: FHIRReference[];
  requisition?: FHIRIdentifier;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  code: FHIRCodeableConcept;
  orderDetail?: string[];
  quantity?: FHIRQuantity;
  subject: FHIRReference;
  encounter?: FHIRReference;
  occurrenceDateTime?: string;
  occurrencePeriod?: FHIRPeriod;
  occurrenceTiming?: FHIRTiming;
  asNeeded?: boolean;
  asNeededFor?: FHIRCodeableConcept;
  authoredOn?: string;
  requester?: FHIRReference;
  performerType?: FHIRCodeableConcept;
  performer?: FHIRReference[];
  locationCode?: FHIRCodeableConcept;
  locationReference?: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  insurance?: FHIRReference[];
  supportingInfo?: FHIRReference[];
  specimen?: FHIRReference[];
  bodySite?: FHIRCodeableConcept[];
  note?: FHIRAnnotation[];
  patientInstruction?: string;
  relevantHistory?: FHIRReference[];
}

// ─── FHIR MedicationDispense ───────────────────────────────────────────

export interface FHIRMedicationDispense extends FHIRResource {
  resourceType: 'MedicationDispense';
  identifier?: FHIRIdentifier[];
  partOf?: FHIRReference[];
  status: 'preparation' | 'in-progress' | 'on-hold' | 'completed' | 'entered-in-error' | 'stopped' | 'declined' | 'unknown';
  statusReasonCodeableConcept?: FHIRCodeableConcept;
  statusReasonReference?: FHIRReference;
  category?: FHIRCodeableConcept;
  medicationCodeableConcept?: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject?: FHIRReference;
  context?: FHIRReference;
  supportingInformation?: FHIRReference[];
  performer?: FHIRMedicationDispensePerformer[];
  location?: FHIRReference;
  authorizingPrescription?: FHIRReference[];
  type?: FHIRCodeableConcept;
  quantity?: FHIRQuantity;
  daysSupply?: FHIRQuantity;
  whenPrepared?: string;
  whenHandedOver?: string;
  destination?: FHIRReference;
  receiver?: FHIRReference[];
  note?: FHIRAnnotation[];
  dosageInstruction?: FHIRDosage[];
  substitution?: FHIRMedicationDispenseSubstitution;
  detectedIssue?: FHIRReference[];
  eventHistory?: FHIRReference[];
}

export interface FHIRMedicationDispensePerformer {
  function?: FHIRCodeableConcept;
  actor: FHIRReference;
}

export interface FHIRMedicationDispenseSubstitution {
  wasSubstituted: boolean;
  type?: FHIRCodeableConcept;
  reason?: FHIRCodeableConcept[];
  responsibleParty?: FHIRReference[];
}

// ─── FHIR Claim ────────────────────────────────────────────────────────

export interface FHIRClaim extends FHIRResource {
  resourceType: 'Claim';
  identifier?: FHIRIdentifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: FHIRCodeableConcept;
  subType?: FHIRCodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: FHIRReference;
  billablePeriod?: FHIRPeriod;
  created: string;
  enterer?: FHIRReference;
  insurer?: FHIRReference;
  provider: FHIRReference;
  priority: FHIRCodeableConcept;
  fundsReserve?: FHIRCodeableConcept;
  related?: FHIRClaimRelated[];
  prescription?: FHIRReference;
  originalPrescription?: FHIRReference;
  payee?: FHIRClaimPayee;
  referral?: FHIRReference;
  facility?: FHIRReference;
  careTeam?: FHIRClaimCareTeam[];
  supportingInfo?: FHIRClaimSupportingInfo[];
  diagnosis?: FHIRClaimDiagnosis[];
  procedure?: FHIRClaimProcedure[];
  insurance: FHIRClaimInsurance[];
  accident?: FHIRClaimAccident;
  item?: FHIRClaimItem[];
  total?: FHIRQuantity;
}

export interface FHIRClaimRelated {
  claim?: FHIRReference;
  relationship?: FHIRCodeableConcept;
  reference?: FHIRIdentifier;
}

export interface FHIRClaimPayee {
  type: FHIRCodeableConcept;
  party?: FHIRReference;
}

export interface FHIRClaimCareTeam {
  sequence: number;
  provider: FHIRReference;
  responsible?: boolean;
  role?: FHIRCodeableConcept;
  qualification?: FHIRCodeableConcept;
}

export interface FHIRClaimSupportingInfo {
  sequence: number;
  category: FHIRCodeableConcept;
  code?: FHIRCodeableConcept;
  timingDate?: string;
  timingPeriod?: FHIRPeriod;
  valueString?: string;
  valueQuantity?: FHIRQuantity;
  valueAttachment?: FHIRAttachment;
  valueReference?: FHIRReference;
  reason?: FHIRCodeableConcept;
}

export interface FHIRClaimDiagnosis {
  sequence: number;
  diagnosisCodeableConcept?: FHIRCodeableConcept;
  diagnosisReference?: FHIRReference;
  type?: FHIRCodeableConcept[];
  onAdmission?: FHIRCodeableConcept;
  packageCode?: FHIRCodeableConcept;
}

export interface FHIRClaimProcedure {
  sequence: number;
  type?: FHIRCodeableConcept[];
  date?: string;
  procedureCodeableConcept?: FHIRCodeableConcept;
  procedureReference?: FHIRReference;
  udi?: FHIRReference[];
}

export interface FHIRClaimInsurance {
  sequence: number;
  focal: boolean;
  identifier?: FHIRIdentifier;
  coverage: FHIRReference;
  businessArrangement?: string;
  preAuthRef?: string[];
  claimResponse?: FHIRReference;
}

export interface FHIRClaimAccident {
  date: string;
  type?: FHIRCodeableConcept;
  locationAddress?: FHIRAddress;
  locationReference?: FHIRReference;
}

export interface FHIRClaimItem {
  sequence: number;
  careTeamSequence?: number[];
  diagnosisSequence?: number[];
  procedureSequence?: number[];
  informationSequence?: number[];
  revenue?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept;
  productOrService: FHIRCodeableConcept;
  modifier?: FHIRCodeableConcept[];
  programCode?: FHIRCodeableConcept[];
  servicedDate?: string;
  servicedPeriod?: FHIRPeriod;
  locationCodeableConcept?: FHIRCodeableConcept;
  locationReference?: FHIRReference;
  locationAddress?: FHIRAddress;
  quantity?: FHIRQuantity;
  unitPrice?: FHIRQuantity;
  factor?: number;
  net?: FHIRQuantity;
  udi?: FHIRReference[];
  bodySite?: FHIRCodeableConcept;
  subSite?: FHIRCodeableConcept[];
  encounter?: FHIRReference[];
  detail?: FHIRClaimItemDetail[];
}

export interface FHIRClaimItemDetail {
  sequence: number;
  revenue?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept;
  productOrService: FHIRCodeableConcept;
  modifier?: FHIRCodeableConcept[];
  programCode?: FHIRCodeableConcept[];
  quantity?: FHIRQuantity;
  unitPrice?: FHIRQuantity;
  factor?: number;
  net?: FHIRQuantity;
  udi?: FHIRReference[];
  subDetail?: FHIRClaimItemSubDetail[];
}

export interface FHIRClaimItemSubDetail {
  sequence: number;
  revenue?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept;
  productOrService: FHIRCodeableConcept;
  modifier?: FHIRCodeableConcept[];
  programCode?: FHIRCodeableConcept[];
  quantity?: FHIRQuantity;
  unitPrice?: FHIRQuantity;
  factor?: number;
  net?: FHIRQuantity;
  udi?: FHIRReference[];
}