/**
 * Insurance Provider Integration for AfyaHero Health
 * 
 * Provides insurance verification and claims processing:
 * - Insurance provider verification
 * - Pre-authorization workflow
 * - Claim submission
 * - EOB (Explanation of Benefits) processing
 */

import axios, { AxiosInstance } from 'axios';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsuranceProvider {
  id: string;
  name: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  isActive: boolean;
}

export interface InsuranceConfig {
  providers: InsuranceProvider[];
}

export interface InsuranceVerificationRequest {
  providerId: string;
  memberNumber: string;
  patientName: string;
  dateOfBirth: string;
}

export interface InsuranceVerificationResponse {
  success: boolean;
  providerId: string;
  memberNumber: string;
  memberName: string;
  isValid: boolean;
  coverageType?: string;
  expiryDate?: string;
  limit?: number;
  errorMessage?: string;
}

export interface InsurancePreauthRequest {
  providerId: string;
  memberNumber: string;
  patientName: string;
  diagnosis: string;
  treatment: string;
  estimatedCost: number;
  hospitalCode: string;
}

export interface InsurancePreauthResponse {
  success: boolean;
  preauthNumber: string;
  status: 'approved' | 'pending' | 'rejected';
  approvedAmount?: number;
  rejectionReason?: string;
  errorMessage?: string;
}

export interface InsuranceClaimRequest {
  providerId: string;
  preauthNumber: string;
  memberNumber: string;
  patientName: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  hospitalCode: string;
  serviceDate: string;
  attachments?: string[];
}

export interface InsuranceClaimResponse {
  success: boolean;
  claimNumber: string;
  status: 'submitted' | 'approved' | 'rejected' | 'pending';
  approvedAmount?: number;
  patientResponsibility?: number;
  rejectionReason?: string;
  eobData?: EOBData;
  errorMessage?: string;
}

export interface EOBData {
  totalCharges: number;
  allowedAmount: number;
  patientResponsibility: number;
  deductible: number;
  copay: number;
  coinsurance: number;
  adjustments: number;
  denialCodes?: string[];
  remarks?: string[];
}

// ─── Insurance Service Class ──────────────────────────────────────────────────

class InsuranceService {
  private config: InsuranceConfig;

  private providerClients: Map<string, { httpClient: AxiosInstance; token: string | null; tokenExpiresAt: number }> = new Map();

  constructor(config: InsuranceConfig) {
    this.config = config;
    
    // Initialize provider clients
    for (const provider of config.providers) {
      if (provider.isActive) {
        this.initializeProviderClient(provider);
      }
    }
  }

  /**
   * Initialize HTTP client for a provider
   */
  private initializeProviderClient(provider: InsuranceProvider): void {
    const httpClient = axios.create({
      baseURL: provider.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    // Add auth interceptor
    httpClient.interceptors.request.use(async (config) => {
      const token = await this.getProviderToken(provider.id);
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.providerClients.set(provider.id, {
      httpClient,
      token: null,
      tokenExpiresAt: 0,
    });
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): InsuranceProvider | undefined {
    return this.config.providers.find(p => p.id === providerId && p.isActive);
  }

  /**
   * List available providers
   */
  listProviders(): InsuranceProvider[] {
    return this.config.providers.filter(p => p.isActive);
  }

  /**
   * Get access token for a provider
   */
  private async getProviderToken(providerId: string): Promise<string> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    const clientData = this.providerClients.get(providerId);
    if (!clientData) {
      throw new Error(`Client not initialized for provider ${providerId}`);
    }

    // Check cache
    if (clientData.token && Date.now() < clientData.tokenExpiresAt) {
      return clientData.token;
    }

    try {
      const response = await clientData.httpClient.post('/oauth/token', {
        grant_type: 'client_credentials',
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
      });

      const { access_token, expires_in } = response.data;
      
      clientData.token = access_token;
      clientData.tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;

      logger.info('Insurance provider token obtained', {
        providerId,
        providerName: provider.name,
      });

      return access_token;
    } catch (error) {
      logger.error('Failed to get insurance provider token', {
        error: error instanceof Error ? error.message : String(error),
        providerId,
      });
      throw new Error(`Failed to authenticate with ${provider.name}`);
    }
  }

  /**
   * Verify insurance membership
   */
  async verifyInsurance(request: InsuranceVerificationRequest): Promise<InsuranceVerificationResponse> {
    const provider = this.getProvider(request.providerId);
    if (!provider) {
      return {
        success: false,
        providerId: request.providerId,
        memberNumber: request.memberNumber,
        memberName: '',
        isValid: false,
        errorMessage: `Provider ${request.providerId} not found`,
      };
    }

    try {
      const clientData = this.providerClients.get(request.providerId);
      if (!clientData) {
        throw new Error(`Client not initialized for provider ${request.providerId}`);
      }

      const response = await clientData.httpClient.post('/api/v1/members/verify', {
        member_number: request.memberNumber,
        patient_name: request.patientName,
        date_of_birth: request.dateOfBirth,
      });

      const data = response.data;

      if (data.status === 'success' || data.is_valid) {
        return {
          success: true,
          providerId: request.providerId,
          memberNumber: request.memberNumber,
          memberName: data.member_name || request.patientName,
          isValid: data.is_valid ?? true,
          coverageType: data.coverage_type,
          expiryDate: data.expiry_date,
          limit: data.coverage_limit,
        };
      } else {
        return {
          success: false,
          providerId: request.providerId,
          memberNumber: request.memberNumber,
          memberName: '',
          isValid: false,
          errorMessage: data.message || 'Insurance verification failed',
        };
      }
    } catch (error) {
      logger.error('Insurance verification failed', {
        error: error instanceof Error ? error.message : String(error),
        providerId: request.providerId,
        memberNumber: request.memberNumber,
      });

      return {
        success: false,
        providerId: request.providerId,
        memberNumber: request.memberNumber,
        memberName: '',
        isValid: false,
        errorMessage: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Request pre-authorization
   */
  async requestPreauthorization(request: InsurancePreauthRequest): Promise<InsurancePreauthResponse> {
    const provider = this.getProvider(request.providerId);
    if (!provider) {
      return {
        success: false,
        preauthNumber: '',
        status: 'rejected',
        errorMessage: `Provider ${request.providerId} not found`,
      };
    }

    try {
      const clientData = this.providerClients.get(request.providerId);
      if (!clientData) {
        throw new Error(`Client not initialized for provider ${request.providerId}`);
      }

      const response = await clientData.httpClient.post('/api/v1/preauth/request', {
        member_number: request.memberNumber,
        patient_name: request.patientName,
        diagnosis: request.diagnosis,
        treatment: request.treatment,
        estimated_cost: request.estimatedCost,
        hospital_code: request.hospitalCode,
      });

      const data = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          preauthNumber: data.preauth_number,
          status: data.status_description || 'pending',
          approvedAmount: data.approved_amount,
          rejectionReason: data.rejection_reason,
        };
      } else {
        return {
          success: false,
          preauthNumber: '',
          status: 'rejected',
          rejectionReason: data.message || 'Pre-authorization failed',
        };
      }
    } catch (error) {
      logger.error('Insurance pre-authorization failed', {
        error: error instanceof Error ? error.message : String(error),
        providerId: request.providerId,
        memberNumber: request.memberNumber,
      });

      return {
        success: false,
        preauthNumber: '',
        status: 'rejected',
        rejectionReason: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  /**
   * Submit insurance claim
   */
  async submitClaim(request: InsuranceClaimRequest): Promise<InsuranceClaimResponse> {
    const provider = this.getProvider(request.providerId);
    if (!provider) {
      return {
        success: false,
        claimNumber: '',
        status: 'rejected',
        errorMessage: `Provider ${request.providerId} not found`,
      };
    }

    try {
      const clientData = this.providerClients.get(request.providerId);
      if (!clientData) {
        throw new Error(`Client not initialized for provider ${request.providerId}`);
      }

      const response = await clientData.httpClient.post('/api/v1/claims/submit', {
        preauth_number: request.preauthNumber,
        member_number: request.memberNumber,
        patient_name: request.patientName,
        diagnosis: request.diagnosis,
        treatment: request.treatment,
        amount: request.amount,
        hospital_code: request.hospitalCode,
        service_date: request.serviceDate,
        attachments: request.attachments,
      });

      const data = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          claimNumber: data.claim_number,
          status: data.status_description || 'submitted',
          approvedAmount: data.approved_amount,
          patientResponsibility: data.patient_responsibility,
          rejectionReason: data.rejection_reason,
          eobData: data.eob ? this.parseEOB(data.eob) : undefined,
        };
      } else {
        return {
          success: false,
          claimNumber: '',
          status: 'rejected',
          rejectionReason: data.message || 'Claim submission failed',
        };
      }
    } catch (error) {
      logger.error('Insurance claim submission failed', {
        error: error instanceof Error ? error.message : String(error),
        providerId: request.providerId,
        preauthNumber: request.preauthNumber,
      });

      return {
        success: false,
        claimNumber: '',
        status: 'rejected',
        rejectionReason: error instanceof Error ? error.message : 'Submission failed',
      };
    }
  }

  /**
   * Parse EOB data
   */
  private parseEOB(eobData: unknown): EOBData {
    if (typeof eobData === 'object' && eobData !== null) {
      const data = eobData as Record<string, unknown>;
      return {
        totalCharges: Number(data.total_charges) || 0,
        allowedAmount: Number(data.allowed_amount) || 0,
        patientResponsibility: Number(data.patient_responsibility) || 0,
        deductible: Number(data.deductible) || 0,
        copay: Number(data.copay) || 0,
        coinsurance: Number(data.coinsurance) || 0,
        adjustments: Number(data.adjustments) || 0,
        denialCodes: Array.isArray(data.denial_codes) ? data.denial_codes : undefined,
        remarks: Array.isArray(data.remarks) ? data.remarks : undefined,
      };
    }
    
    return {
      totalCharges: 0,
      allowedAmount: 0,
      patientResponsibility: 0,
      deductible: 0,
      copay: 0,
      coinsurance: 0,
      adjustments: 0,
    };
  }

  /**
   * Check claim status
   */
  async checkClaimStatus(providerId: string, claimNumber: string): Promise<{
    success: boolean;
    status: string;
    approvedAmount?: number;
    patientResponsibility?: number;
    rejectionReason?: string;
  }> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        success: false,
        status: 'unknown',
      };
    }

    try {
      const clientData = this.providerClients.get(providerId);
      if (!clientData) {
        throw new Error(`Client not initialized for provider ${providerId}`);
      }

      const response = await clientData.httpClient.get(`/api/v1/claims/status/${claimNumber}`);
      const data = response.data;

      return {
        success: true,
        status: data.status_description || data.status,
        approvedAmount: data.approved_amount,
        patientResponsibility: data.patient_responsibility,
        rejectionReason: data.rejection_reason,
      };
    } catch (error) {
      logger.error('Insurance claim status check failed', {
        error: error instanceof Error ? error.message : String(error),
        providerId,
        claimNumber,
      });

      return {
        success: false,
        status: 'unknown',
      };
    }
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create Insurance service instance from environment variables
 */
export function createInsuranceService(): InsuranceService | null {
  try {
    const providersJson = process.env.INSURANCE_PROVIDERS_JSON;
    
    if (!providersJson) {
      logger.warn('Insurance providers not configured, service disabled');
      return null;
    }

    const providers = JSON.parse(providersJson) as InsuranceProvider[];
    
    return new InsuranceService({ providers });
  } catch (error) {
    logger.error('Failed to initialize insurance service', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default InsuranceService;
export { InsuranceService };