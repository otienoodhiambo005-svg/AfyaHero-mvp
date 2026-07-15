/**
 * Shared Type Definitions for the FastAPI DAWA AI orchestrator endpoints.
 * These types match the Pydantic schemas in gateway/app/api/v1/clinical_ai.py
 * to resolve implicit and explicit `any` casting across the frontend.
 */

export interface ClinicalQuery {
  patient_id?: string;
  symptoms: string[];
  age?: number;
  gender?: string;
  existing_conditions?: string[];
  current_medications?: string[];
  context?: string;
}

export interface DiagnosisResult {
  icd10_code: string;
  condition_name: string;
  confidence: number;
  severity: "mild" | "moderate" | "severe" | "critical";
  reasoning: string;
  swahili: string;
}

export interface DrugInteractionResult {
  drug1: string;
  drug2: string;
  severity: "low" | "moderate" | "major" | "critical";
  warning: string;
  swahili_warning: string;
}

export interface GuidelineResult {
  title: string;
  source: string;
  content: string;
  topic: string;
  relevance: number;
}

export interface DAWAResponse {
  diagnoses: DiagnosisResult[];
  suggested_tests: string[];
  suggested_medications: string[];
  drug_interactions: DrugInteractionResult[];
  guidelines: GuidelineResult[];
  severity: "low" | "medium" | "critical";
  swahili_summary: string;
}

export interface WsScribeProcessingResponse {
  status: "processing" | "complete" | "error";
  message: string;
  bytes: number;
}

export interface WsICD10Response {
  status: "processing" | "complete";
  diagnoses: Array<{
    icd10_code: string;
    condition_name: string;
    confidence: number;
  }>;
}

export interface WsDrugInteractionResponse {
  status: "processing" | "complete";
  drug_interactions: DrugInteractionResult[];
}

export interface RadiologyResult {
  confidence: number;
  urgency_level: number;
  findings: string[];
  recommendations: string[];
  vendor_used?: string;
  is_emergency: boolean;
  final_arbitration?: {
    model: string;
    verdict: string;
    confidence: number;
  };
}

export interface PathologyResult {
  path_findings: {
    description: string;
    abnormalities: string[];
    severity: 'normal' | 'mild' | 'moderate' | 'severe';
  };
  foundation_model: string;
  interpretive_agent: string;
  confidence: number;
  primary_recommendation: string;
}

export interface RadiologyScan {
  patient_id?: string;
  encounter_id?: string;
  modality: string;
  image_b64?: string;
  clinical_notes?: string;
}

export interface PathologyAnalysis {
  patient_id?: string;
  encounter_id?: string;
  specimen_id: string;
  description?: string;
  image_b64?: string;
}
