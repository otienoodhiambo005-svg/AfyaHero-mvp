/**
 * Microservices Client Library
 * 
 * Provides HTTP clients for communicating with AI microservices.
 * Supports both local development and production deployment.
 */

import logger from '@/lib/logger';

// Service configuration
const SERVICE_CONFIG = {
  triage: {
    url: process.env.TRIAGE_SERVICE_URL || 'http://localhost:8001',
    timeout: 15000, // 15 seconds
  },
  diagnosis: {
    url: process.env.DIAGNOSIS_SERVICE_URL || 'http://localhost:8002',
    timeout: 20000, // 20 seconds
  },
  imaging: {
    url: process.env.IMAGING_SERVICE_URL || 'http://localhost:8003',
    timeout: 30000, // 30 seconds (vision takes longer)
  },
  billing: {
    url: process.env.BILLING_SERVICE_URL || 'http://localhost:8004',
    timeout: 10000,
  },
  operational: {
    url: process.env.OPERATIONAL_SERVICE_URL || 'http://localhost:8005',
    timeout: 15000,
  },
  pharmacy: {
    url: process.env.PHARMACY_SERVICE_URL || 'http://localhost:8006',
    timeout: 15000,
  },
  orchestration: {
    url: process.env.ORCHESTRATION_SERVICE_URL || 'http://localhost:8007',
    timeout: 60000, // 60 seconds (orchestration can take time)
  },
  hl7Gateway: {
    url: process.env.HL7_GATEWAY_URL || 'http://localhost:8008',
    timeout: 10000,
  },
};

type ServiceName = keyof typeof SERVICE_CONFIG;

/**
 * Generic HTTP client for microservices
 */
async function callService<T>(
  serviceName: ServiceName,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const config = SERVICE_CONFIG[serviceName];
  const url = `${config.url}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Service ${serviceName} returned ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(`[Microservices Client] ${serviceName} timeout after ${config.timeout}ms`);
      throw new Error(`Service ${serviceName} timed out after ${config.timeout}ms`);
    }

    logger.error(`[Microservices Client] ${serviceName} error`, {
      error: error instanceof Error ? error.message : String(error),
      service: serviceName,
      endpoint,
    });

    throw error;
  }
}

/**
 * AI Triage Service Client
 */
export const triageService = {
  /**
   * Perform AI triage assessment
   */
  async analyze(request: {
    patient_id?: string;
    age: number;
    gender: 'male' | 'female';
    chief_complaint: string;
    vitals?: {
      heart_rate?: number;
      blood_pressure_systolic?: number;
      blood_pressure_diastolic?: number;
      respiratory_rate?: number;
      temperature?: number;
      oxygen_saturation?: number;
    };
    is_pregnant?: boolean;
    gestational_weeks?: number;
  }) {
    return callService<{
      priority: number;
      priority_label: string;
      confidence: number;
      reasoning: string;
      pews_score?: number;
      moews_score?: number;
      recommended_actions: string[];
    }>('triage', '/triage/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get FHIR-compliant triage observation
   */
  async getFHIR(request: {
    patient_id: string;
    age: number;
    gender: 'male' | 'female';
    chief_complaint: string;
    vitals?: {
      heart_rate?: number;
      blood_pressure_systolic?: number;
      blood_pressure_diastolic?: number;
      respiratory_rate?: number;
      temperature?: number;
      oxygen_saturation?: number;
    };
  }, format: 'resource' | 'bundle' = 'resource') {
    return callService('triage', `/triage/fhir?format=${format}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Health check
   */
  async health() {
    return callService<{ status: string; model_loaded: boolean }>('triage', '/health');
  },
};

/**
 * AI Diagnosis Service Client
 */
export const diagnosisService = {
  /**
   * Get AI diagnosis suggestions
   */
  async analyze(request: {
    patient_id?: string;
    age: number;
    gender: 'male' | 'female';
    symptoms: string[];
    vitals?: {
      temperature?: number;
      heart_rate?: number;
      blood_pressure_systolic?: number;
      blood_pressure_diastolic?: number;
      respiratory_rate?: number;
    };
    medical_history?: string[];
  }) {
    return callService<{
      diagnosis: string[];
      differential_diagnosis: string[];
      confidence: number;
      reasoning: string;
      recommended_tests: string[];
    }>('diagnosis', '/diagnosis/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get FHIR-compliant condition resources
   */
  async getFHIR(request: {
    patient_id: string;
    symptoms: string[];
  }, format: 'resource' | 'bundle' = 'resource') {
    return callService('diagnosis', `/diagnosis/fhir?format=${format}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Health check
   */
  async health() {
    return callService<{ status: string }>('diagnosis', '/health');
  },
};

/**
 * AI Imaging Service Client
 */
export const imagingService = {
  /**
   * Analyze medical image
   */
  async analyze(request: {
    image_data: string; // base64 encoded
    modality: 'xray' | 'ct' | 'mri' | 'ultrasound';
    body_part: string;
    patient_id?: string;
  }) {
    return callService<{
      findings: string[];
      impression: string;
      confidence: number;
      abnormalities: string[];
    }>('imaging', '/imaging/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Store DICOM image
   */
  async storeDicom(request: {
    dicom_data: string; // base64 encoded
    study_id: string;
    series_id: string;
    instance_id: string;
  }) {
    return callService<{ storage_path: string; dicom_store_id: string }>(
      'imaging',
      '/dicom/store',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  },

  /**
   * Get FHIR-compliant diagnostic report
   */
  async getFHIR(request: {
    patient_id: string;
    study_id: string;
  }, format: 'resource' | 'bundle' = 'resource') {
    return callService('imaging', `/imaging/fhir?format=${format}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Health check
   */
  async health() {
    return callService<{ status: string; google_cloud_configured: boolean }>(
      'imaging',
      '/health'
    );
  },
};

/**
 * AI Pharmacy Service Client
 */
export const pharmacyService = {
  /**
   * Check drug interactions
   */
  async checkInteractions(request: {
    medications: string[];
    patient_id?: string;
  }) {
    return callService<{
      interactions: Array<{
        drug1: string;
        drug2: string;
        severity: 'minor' | 'moderate' | 'major' | 'severe';
        description: string;
      }>;
      recommendations: string[];
    }>('pharmacy', '/pharmacy/interactions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Lookup drug in formulary
   */
  async lookupDrug(request: {
    drug_name: string;
    hospital_id?: string;
  }) {
    return callService<{
      available: boolean;
      alternatives: string[];
      dosage_forms: string[];
      contraindications: string[];
    }>('pharmacy', '/pharmacy/formulary', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get FHIR-compliant observation (drug interaction)
   */
  async getInteractionFHIR(request: {
    medications: string[];
    patient_id: string;
  }) {
    return callService('pharmacy', '/pharmacy/interactions/fhir', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Health check
   */
  async health() {
    return callService<{ status: string }>('pharmacy', '/health');
  },
};

/**
 * HL7 Gateway Service Client
 */
export const hl7Gateway = {
  /**
   * Parse HL7 v2 message
   */
  async parse(message: string) {
    return callService<{
      message_type: string;
      segments: Record<string, any>;
      parsed: boolean;
    }>('hl7Gateway', '/parse', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Validate HL7 v2 message
   */
  async validate(message: string) {
    return callService<{
      valid: boolean;
      errors: string[];
      warnings: string[];
    }>('hl7Gateway', '/validate', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Convert HL7 ADT message to FHIR
   */
  async convertADT(message: string) {
    return callService<{
      patient?: Record<string, unknown>;
      encounter?: Record<string, unknown>;
      related_persons?: Record<string, unknown>[];
    }>('hl7Gateway', '/convert/adt', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Convert HL7 ORM message to FHIR
   */
  async convertORM(message: string) {
    return callService<{
      service_request?: Record<string, unknown>;
      patient?: Record<string, unknown>;
    }>('hl7Gateway', '/convert/orm', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Health check
   */
  async health() {
    return callService<{ status: string }>('hl7Gateway', '/health');
  },
};

/**
 * Check health of all microservices
 */
export async function checkAllServicesHealth() {
  const results = await Promise.allSettled([
    triageService.health().catch(() => ({ status: 'unreachable' })),
    diagnosisService.health().catch(() => ({ status: 'unreachable' })),
    imagingService.health().catch(() => ({ status: 'unreachable' })),
    pharmacyService.health().catch(() => ({ status: 'unreachable' })),
    hl7Gateway.health().catch(() => ({ status: 'unreachable' })),
  ]);

  return {
    triage: results[0],
    diagnosis: results[1],
    imaging: results[2],
    pharmacy: results[3],
    hl7Gateway: results[4],
  };
}
