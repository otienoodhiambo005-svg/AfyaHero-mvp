/**
 * SHIF Integration for AfyaHero Health
 * 
 * Provides SHIF claims processing:
 * - Member verification
 * - Pre-authorization requests
 * - Claim submission
 * - Status tracking
 * - Rejection handling
 */

import axios, { AxiosInstance } from 'axios';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SHIFConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

export interface SHIFMemberVerificationRequest {
  idNumber: string;
  memberNumber: string;
}

export interface SHIFMemberVerificationResponse {
  success: boolean;
  memberNumber: string;
  memberName: string;
  isValid: boolean;
  employer?: string;
  status?: string;
  errorMessage?: string;
}

export interface SHIFPreauthRequest {
  memberNumber: string;
  patientName: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  hospitalCode: string;
}

export interface SHIFPreauthResponse {
  success: boolean;
  preauthNumber: string;
  status: 'approved' | 'pending' | 'rejected';
  approvedAmount?: number;
  rejectionReason?: string;
  errorMessage?: string;
}

export interface SHIFClaimRequest {
  preauthNumber: string;
  memberNumber: string;
  patientName: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  hospitalCode: string;
  serviceDate: string;
}

export interface SHIFClaimResponse {
  success: boolean;
  claimNumber: string;
  status: 'submitted' | 'approved' | 'rejected' | 'pending';
  approvedAmount?: number;
  rejectionReason?: string;
  errorMessage?: string;
}

// ─── SHIF Service Class ───────────────────────────────────────────────────────

class SHIFService {
  private config: SHIFConfig;

  private httpClient: AxiosInstance;

  private tokenCache: {
    token: string;
    expiresAt: number;
  } | null = null;

  constructor(config: SHIFConfig) {
    this.config = config;
    
    this.httpClient = axios.create({
      baseURL: this.getBaseUrl(),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    // Add auth interceptor
    this.httpClient.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * Get base URL based on environment
   */
  private getBaseUrl(): string {
    return this.config.environment === 'production'
      ? this.config.apiUrl || 'https://api.SHIF.or.ke'
      : 'https://uat.SHIF.or.ke';
  }

  /**
   * Get OAuth access token
   */
  async getAccessToken(): Promise<string> {
    // Check cache first
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    try {
      const response = await this.httpClient.post('/oauth/token', {
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const { access_token, expires_in } = response.data;
      
      // Cache token
      this.tokenCache = {
        token: access_token,
        expiresAt: Date.now() + (expires_in - 60) * 1000,
      };

      logger.info('SHIF access token obtained', {
        environment: this.config.environment,
      });

      return access_token;
    } catch (error) {
      logger.error('Failed to get SHIF access token', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to authenticate with SHIF API');
    }
  }

  /**
   * Verify SHIF member
   */
  async verifyMember(request: SHIFMemberVerificationRequest): Promise<SHIFMemberVerificationResponse> {
    try {
      const response = await this.httpClient.post(
        '/api/v1/members/verify',
        {
          id_number: request.idNumber,
          member_number: request.memberNumber,
        }
      );

      const data = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          memberNumber: data.member_number,
          memberName: data.member_name,
          isValid: data.is_active,
          employer: data.employer,
          status: data.employment_status,
        };
      } else {
        return {
          success: false,
          memberNumber: request.memberNumber,
          memberName: '',
          isValid: false,
          errorMessage: data.message || 'Member verification failed',
        };
      }
    } catch (error) {
      logger.error('SHIF member verification failed', {
        error: error instanceof Error ? error.message : String(error),
        memberNumber: request.memberNumber,
      });

      return {
        success: false,
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
  async requestPreauthorization(request: SHIFPreauthRequest): Promise<SHIFPreauthResponse> {
    try {
      const response = await this.httpClient.post(
        '/api/v1/preauth/request',
        {
          member_number: request.memberNumber,
          patient_name: request.patientName,
          diagnosis: request.diagnosis,
          treatment: request.treatment,
          amount: request.amount,
          hospital_code: request.hospitalCode,
        }
      );

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
      logger.error('SHIF pre-authorization request failed', {
        error: error instanceof Error ? error.message : String(error),
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
   * Submit SHIF claim
   */
  async submitClaim(request: SHIFClaimRequest): Promise<SHIFClaimResponse> {
    try {
      const response = await this.httpClient.post(
        '/api/v1/claims/submit',
        {
          preauth_number: request.preauthNumber,
          member_number: request.memberNumber,
          patient_name: request.patientName,
          diagnosis: request.diagnosis,
          treatment: request.treatment,
          amount: request.amount,
          hospital_code: request.hospitalCode,
          service_date: request.serviceDate,
        }
      );

      const data = response.data;

      if (data.status === 'success') {
        return {
          success: true,
          claimNumber: data.claim_number,
          status: data.status_description || 'submitted',
          approvedAmount: data.approved_amount,
          rejectionReason: data.rejection_reason,
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
      logger.error('SHIF claim submission failed', {
        error: error instanceof Error ? error.message : String(error),
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
   * Check claim status
   */
  async checkClaimStatus(claimNumber: string): Promise<{
    success: boolean;
    status: string;
    approvedAmount?: number;
    rejectionReason?: string;
  }> {
    try {
      const response = await this.httpClient.get(
        `/api/v1/claims/status/${claimNumber}`
      );

      const data = response.data;

      return {
        success: true,
        status: data.status_description || data.status,
        approvedAmount: data.approved_amount,
        rejectionReason: data.rejection_reason,
      };
    } catch (error) {
      logger.error('SHIF claim status check failed', {
        error: error instanceof Error ? error.message : String(error),
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
 * Create SHIF service instance from environment variables
 */
export function createSHIFService(): SHIFService | null {
  const apiUrl = process.env.SHIF_API_URL;
  const clientId = process.env.SHIF_CLIENT_ID;
  const clientSecret = process.env.SHIF_CLIENT_SECRET;
  const environment = (process.env.SHIF_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';

  if (!apiUrl || !clientId || !clientSecret) {
    logger.warn('SHIF configuration incomplete, service disabled');
    return null;
  }

  return new SHIFService({
    apiUrl,
    clientId,
    clientSecret,
    environment,
  });
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default SHIFService;
export { SHIFService };