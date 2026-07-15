/**
 * Pesapal Payment Gateway Integration for AfyaHero Health
 * 
 * Provides secure Pesapal payment processing:
 * - Payment request creation
 * - IPN (Instant Payment Notification)
 * - Transaction verification
 * - Refund processing
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PesapalConfig {
  consumerKey: string;
  consumerSecret: string;
  environment: 'sandbox' | 'production';
  ipnNotificationUrl: string;
}

export interface PesapalTokenResponse {
  token: string;
  expiry: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string; // KES, USD, TZS, UGX, ZAR
  email: string;
  phoneNumber: string;
  description: string;
  reference: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  callbackUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  redirectUrl?: string;
  orderTrackingId?: string;
  merchantReference?: string;
  errorMessage?: string;
}

export interface TransactionStatusResponse {
  success: boolean;
  status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'INVALID' | 'REVERSED';
  confirmationCode?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  errorMessage?: string;
}

export interface RefundRequest {
  orderTrackingId: string;
  amount: number;
  reason: string;
  reference: string;
}

export interface RefundResponse {
  success: boolean;
  refundTrackingId?: string;
  status?: string;
  errorMessage?: string;
}

export interface PesapalIPN {
  OrderTrackingId: string;
  OrderMerchantReference: string;
  Status: string;
  TransactionId: string;
  ConfirmationCode: string;
  Amount: number;
  Currency: string;
  Email: string;
  PhoneNumber: string;
  Description: string;
}

// ─── Pesapal Service Class ────────────────────────────────────────────────────

class PesapalService {
  private config: PesapalConfig;

  private httpClient: AxiosInstance;

  private tokenCache: {
    token: string;
    expiresAt: number;
  } | null = null;

  constructor(config: PesapalConfig) {
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
      ? 'https://pay.pesapal.com'
      : 'https://cybqa.pesapal.com';
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
      const response = await this.httpClient.post<PesapalTokenResponse>(
        '/api/v1/Auth/RequestToken',
        {
          consumer_key: this.config.consumerKey,
          consumer_secret: this.config.consumerSecret,
        }
      );

      const { token, expiry } = response.data;
      
      // Cache token
      const expiryDate = new Date(expiry);
      this.tokenCache = {
        token,
        expiresAt: expiryDate.getTime() - 60000, // Cache until 1 minute before expiry
      };

      logger.info('Pesapal access token obtained', {
        environment: this.config.environment,
        expiresAt: expiryDate.toISOString(),
      });

      return token;
    } catch (error) {
      logger.error('Failed to get Pesapal access token', {
        error: error instanceof Error ? error.message : String(error),
        environment: this.config.environment,
      });
      throw new Error('Failed to authenticate with Pesapal API');
    }
  }

  /**
   * Register IPN URL
   */
  async registerIpnUrl(url: string): Promise<{ success: boolean; ipnId?: string }> {
    try {
      const response = await this.httpClient.post(
        '/api/v1/URL/RegisterUrl',
        {
          url,
          ipn_notification_type: 'POST',
        }
      );

      return {
        success: true,
        ipnId: response.data.ipn_id,
      };
    } catch (error) {
      logger.error('Failed to register Pesapal IPN URL', {
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      return {
        success: false,
      };
    }
  }

  /**
   * Submit a payment order
   */
  async submitOrder(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Ensure IPN URL is registered
      const ipnResult = await this.registerIpnUrl(this.config.ipnNotificationUrl);
      if (!ipnResult.success) {
        logger.warn('Failed to register IPN URL, continuing anyway');
      }

      const payload = {
        id: crypto.randomUUID(),
        currency: request.currency,
        amount: request.amount,
        description: request.description,
        callback_url: request.callbackUrl || this.config.ipnNotificationUrl,
        notification_id: ipnResult.ipnId,
        billing_address: {
          email_address: request.email,
          phone_number: this.formatPhoneNumber(request.phoneNumber),
          country_code: 'KE',
          first_name: request.firstName,
          last_name: request.lastName,
          middle_name: request.middleName,
          line_1: '',
          line_2: '',
          city: '',
          state: '',
          postal_code: '',
          zip_code: '',
        },
        merchant_reference: request.reference,
        order_tracking_id: crypto.randomUUID(),
      };

      logger.info('Submitting Pesapal payment order', {
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
        email: request.email,
      });

      const response = await this.httpClient.post(
        '/api/v1/Merchants/SubmitOrder',
        payload
      );

      const data = response.data;

      if (data.status === 'SUCCESS' || data.redirect_url) {
        logger.info('Pesapal order submitted successfully', {
          orderTrackingId: data.order_tracking_id,
          redirectUrl: data.redirect_url,
        });

        return {
          success: true,
          redirectUrl: data.redirect_url,
          orderTrackingId: data.order_tracking_id,
          merchantReference: request.reference,
        };
      } else {
        logger.warn('Pesapal order submission failed', {
          status: data.status,
          message: data.message,
        });

        return {
          success: false,
          errorMessage: data.message || 'Order submission failed',
          merchantReference: request.reference,
        };
      }
    } catch (error) {
      logger.error('Pesapal order submission failed', {
        error: error instanceof Error ? error.message : String(error),
        amount: request.amount,
        reference: request.reference,
      });

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        merchantReference: request.reference,
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(
    orderTrackingId: string
  ): Promise<TransactionStatusResponse> {
    try {
      const response = await this.httpClient.get(
        `/api/v1/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`
      );

      const data = response.data;

      if (data.status === 'SUCCESS') {
        return {
          success: true,
          status: data.status_description || 'PENDING',
          confirmationCode: data.confirmation_code,
          transactionId: data.transaction_id,
          amount: data.amount,
          currency: data.currency,
        };
      } else {
        return {
          success: false,
          status: 'INVALID',
          errorMessage: data.message || 'Transaction not found',
        };
      }
    } catch (error) {
      logger.error('Failed to get Pesapal transaction status', {
        error: error instanceof Error ? error.message : String(error),
        orderTrackingId,
      });

      return {
        success: false,
        status: 'INVALID',
        errorMessage: error instanceof Error ? error.message : 'Query failed',
      };
    }
  }

  /**
   * Get transaction details by merchant reference
   */
  async getTransactionByMerchantReference(
    merchantReference: string
  ): Promise<TransactionStatusResponse> {
    try {
      const response = await this.httpClient.get(
        `/api/v1/Transactions/GetTransactionStatus?merchantReference=${merchantReference}`
      );

      const data = response.data;

      if (data.status === 'SUCCESS') {
        return {
          success: true,
          status: data.status_description || 'PENDING',
          confirmationCode: data.confirmation_code,
          transactionId: data.transaction_id,
          amount: data.amount,
          currency: data.currency,
        };
      } else {
        return {
          success: false,
          status: 'INVALID',
          errorMessage: data.message || 'Transaction not found',
        };
      }
    } catch (error) {
      logger.error('Failed to get transaction by merchant reference', {
        error: error instanceof Error ? error.message : String(error),
        merchantReference,
      });

      return {
        success: false,
        status: 'INVALID',
        errorMessage: error instanceof Error ? error.message : 'Query failed',
      };
    }
  }

  /**
   * Process IPN callback
   */
  processIpnCallback(callback: PesapalIPN): {
    success: boolean;
    orderTrackingId: string;
    merchantReference: string;
    status: 'COMPLETE' | 'PENDING' | 'FAILED' | 'INVALID' | 'REVERSED';
    transactionId: string;
    amount: number;
    currency: string;
  } {
    const statusMap: Record<string, 'COMPLETE' | 'PENDING' | 'FAILED' | 'INVALID' | 'REVERSED'> = {
      'COMPLETED': 'COMPLETE',
      'COMPLETE': 'COMPLETE',
      'PENDING': 'PENDING',
      'FAILED': 'FAILED',
      'INVALID': 'INVALID',
      'REVERSED': 'REVERSED',
    };

    const status = statusMap[callback.Status] || 'INVALID';
    const isSuccess = status === 'COMPLETE';

    const result = {
      success: isSuccess,
      orderTrackingId: callback.OrderTrackingId,
      merchantReference: callback.OrderMerchantReference,
      status,
      transactionId: callback.TransactionId,
      amount: callback.Amount,
      currency: callback.Currency,
    };

    logger.info('Pesapal IPN callback processed', {
      success: isSuccess,
      orderTrackingId: callback.OrderTrackingId,
      status: callback.Status,
      amount: callback.Amount,
      currency: callback.Currency,
    });

    return result;
  }

  /**
   * Process a refund
   */
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const payload = {
        order_tracking_id: request.orderTrackingId,
        amount: request.amount,
        reason: request.reason,
        merchant_reference: request.reference,
      };

      logger.info('Processing Pesapal refund', {
        orderTrackingId: request.orderTrackingId,
        amount: request.amount,
        reason: request.reason,
      });

      const response = await this.httpClient.post(
        '/api/v1/Refund/RequestRefund',
        payload
      );

      const data = response.data;

      if (data.status === 'SUCCESS') {
        logger.info('Pesapal refund initiated successfully', {
          refundTrackingId: data.refund_tracking_id,
          status: data.status_description,
        });

        return {
          success: true,
          refundTrackingId: data.refund_tracking_id,
          status: data.status_description,
        };
      } else {
        logger.warn('Pesapal refund failed', {
          status: data.status,
          message: data.message,
        });

        return {
          success: false,
          errorMessage: data.message || 'Refund failed',
        };
      }
    } catch (error) {
      logger.error('Pesapal refund failed', {
        error: error instanceof Error ? error.message : String(error),
        orderTrackingId: request.orderTrackingId,
        amount: request.amount,
      });

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '254' + cleaned.slice(1);
    } else if (cleaned.startsWith('+')) {
      return cleaned.slice(1);
    }
    
    return '254' + cleaned;
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create Pesapal service instance from environment variables
 */
export function createPesapalService(): PesapalService | null {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  const environment = (process.env.PESAPAL_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
  const ipnNotificationUrl = process.env.PESAPAL_IPN_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/pesapal/ipn`;

  if (!consumerKey || !consumerSecret) {
    logger.warn('Pesapal configuration incomplete, service disabled');
    return null;
  }

  return new PesapalService({
    consumerKey,
    consumerSecret,
    environment,
    ipnNotificationUrl,
  });
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default PesapalService;
export { PesapalService };