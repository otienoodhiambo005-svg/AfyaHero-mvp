/**
 * Unified Payment Gateway for AfyaHero Health
 * 
 * Provides payment orchestration:
 * - Multi-gateway support with fallback mechanisms
 * - Payment method selection
 * - Transaction logging
 * - Reconciliation
 * - PCI DSS compliance measures
 */

import { prisma } from '@/lib/database';
import type { Prisma } from '@prisma/client';
import logger from '@/lib/logger';
import { createMpesaService } from './mpesa';
import { createPesapalService } from './pesapal';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentProvider = 'mpesa' | 'pesapal' | 'SHIF' | 'insurance' | 'cash';

export interface PaymentInitiationRequest {
  hospitalId: string;
  patientId?: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  description: string;
  reference: string;
  // M-Pesa specific
  phoneNumber?: string;
  // Pesapal specific
  email?: string;
  firstName?: string;
  lastName?: string;
  // Metadata
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiationResponse {
  success: boolean;
  transactionId: string;
  reference: string;
  provider: PaymentProvider;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  redirectUrl?: string;
  message?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  transactionId: string;
  reference: string;
  provider: PaymentProvider;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
  reference: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
}

// ─── Payment Gateway Service ──────────────────────────────────────────────────

class PaymentGatewayService {
  private mpesaService = createMpesaService();

  private pesapalService = createPesapalService();
  // private shifService = createSHIFService();
  // private insuranceService = createInsuranceService();

  /**
   * Get available payment providers
   */
  getAvailableProviders(): PaymentProvider[] {
    // All payment methods are currently marked inactive
    const providers: PaymentProvider[] = [];
    
    // if (this.mpesaService) providers.push('mpesa');
    // if (this.pesapalService) providers.push('pesapal');
    
    // Always available providers are now disabled
    // providers.push('cash', 'SHIF', 'insurance');
    
    return providers;
  }

  /**
   * Initiate a payment
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const reference = this.generateReference();
    const transactionId = crypto.randomUUID();

    try {
      // Create transaction record
      await prisma.paymentTransaction.create({
        data: {
          id: transactionId,
          hospitalId: request.hospitalId,
          patientId: request.patientId,
          reference,
          provider: request.provider,
          amount: request.amount,
          currency: request.currency,
          status: 'pending',
          description: request.description,
          metadata: request.metadata as Prisma.InputJsonObject | undefined,
        },
      });

      logger.info('Payment initiated', {
        transactionId,
        reference,
        provider: request.provider,
        amount: request.amount,
        hospitalId: request.hospitalId,
      });

      // Route to appropriate provider
      switch (request.provider) {
        case 'mpesa':
          return await this.initiateMpesaPayment({
            ...request,
            reference,
            transactionId,
          });

        case 'pesapal':
          return await this.initiatePesapalPayment({
            ...request,
            reference,
            transactionId,
          });

        case 'cash':
          return await this.initiateCashPayment({
            ...request,
            reference,
            transactionId,
          });

        case 'SHIF':
          return await this.initiateSHIFPayment({
            ...request,
            reference,
            transactionId,
          });

        case 'insurance':
          return await this.initiateInsurancePayment({
            ...request,
            reference,
            transactionId,
          });

        default:
          throw new Error(`Unsupported payment provider: ${request.provider}`);
      }
    } catch (error) {
      logger.error('Payment initiation failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: request.provider,
        reference,
      });

      return {
        success: false,
        transactionId,
        reference,
        provider: request.provider,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Payment initiation failed',
      };
    }
  }

  /**
   * Initiate M-Pesa payment
   */
  private async initiateMpesaPayment(options: {
    reference: string;
    transactionId: string;
    amount: number;
    currency: string;
    phoneNumber?: string;
    description: string;
  }): Promise<PaymentInitiationResponse> {
    if (!this.mpesaService) {
      throw new Error('M-Pesa service is not configured');
    }

    if (!options.phoneNumber) {
      throw new Error('Phone number is required for M-Pesa payments');
    }

    const result = await this.mpesaService.initiateStkPush({
      phoneNumber: options.phoneNumber,
      amount: options.amount,
      accountReference: options.reference,
      transactionDesc: options.description,
    });

    if (result.success) {
      await prisma.paymentTransaction.update({
        where: { id: options.transactionId },
        data: {
          status: 'processing',
          transactionId: result.merchantRequestId,
        },
      });

      return {
        success: true,
        transactionId: options.transactionId,
        reference: options.reference,
        provider: 'mpesa',
        status: 'processing',
        message: 'STK Push sent. Please check your phone to complete payment.',
      };
    } else {
      await prisma.paymentTransaction.update({
        where: { id: options.transactionId },
        data: {
          status: 'failed',
        },
      });

      return {
        success: false,
        transactionId: options.transactionId,
        reference: options.reference,
        provider: 'mpesa',
        status: 'failed',
        message: result.responseDescription,
      };
    }
  }

  /**
   * Initiate Pesapal payment
   */
  private async initiatePesapalPayment(options: {
    reference: string;
    transactionId: string;
    amount: number;
    currency: string;
    email?: string;
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    description: string;
  }): Promise<PaymentInitiationResponse> {
    if (!this.pesapalService) {
      throw new Error('Pesapal service is not configured');
    }

    if (!options.email || !options.firstName || !options.lastName) {
      throw new Error('Email, first name, and last name are required for Pesapal payments');
    }

    const result = await this.pesapalService.submitOrder({
      amount: options.amount,
      currency: options.currency,
      email: options.email,
      phoneNumber: options.phoneNumber || '',
      description: options.description,
      reference: options.reference,
      firstName: options.firstName,
      lastName: options.lastName,
    });

    if (result.success && result.redirectUrl) {
      await prisma.paymentTransaction.update({
        where: { id: options.transactionId },
        data: {
          status: 'processing',
          transactionId: result.orderTrackingId,
        },
      });

      return {
        success: true,
        transactionId: options.transactionId,
        reference: options.reference,
        provider: 'pesapal',
        status: 'processing',
        redirectUrl: result.redirectUrl,
      };
    } else {
      await prisma.paymentTransaction.update({
        where: { id: options.transactionId },
        data: {
          status: 'failed',
        },
      });

      return {
        success: false,
        transactionId: options.transactionId,
        reference: options.reference,
        provider: 'pesapal',
        status: 'failed',
        message: result.errorMessage,
      };
    }
  }

  /**
   * Initiate cash payment (immediate completion)
   */
  private async initiateCashPayment(options: {
    reference: string;
    transactionId: string;
    amount: number;
  }): Promise<PaymentInitiationResponse> {
    await prisma.paymentTransaction.update({
      where: { id: options.transactionId },
      data: {
        status: 'completed',
        paidAt: new Date(),
      },
    });

    return {
      success: true,
      transactionId: options.transactionId,
      reference: options.reference,
      provider: 'cash',
      status: 'completed',
      message: 'Cash payment recorded successfully.',
    };
  }

  /**
   * Initiate SHIF payment (creates claim record)
   */
  private async initiateSHIFPayment(options: {
    reference: string;
    transactionId: string;
    patientId?: string;
    hospitalId: string;
    amount: number;
  }): Promise<PaymentInitiationResponse> {
    if (!options.patientId) {
      throw new Error('Patient ID is required for SHIF payments');
    }

    // Create SHIF claim record
    const claimNumber = `SHIF-${options.reference}`;
    
    await prisma.shifClaim.create({
      data: {
        id: crypto.randomUUID(),
        hospitalId: options.hospitalId,
        patientId: options.patientId,
        claimNumber,
        memberNumber: '', // To be filled by user
        status: 'pending',
        amountClaimed: options.amount,
      },
    });

    await prisma.paymentTransaction.update({
      where: { id: options.transactionId },
      data: {
        status: 'pending',
        description: `SHIF Claim: ${claimNumber}`,
      },
    });

    return {
      success: true,
      transactionId: options.transactionId,
      reference: options.reference,
      provider: 'SHIF',
      status: 'pending',
      message: `SHIF claim ${claimNumber} created. Awaiting verification.`,
    };
  }

  /**
   * Initiate insurance payment
   */
  private async initiateInsurancePayment(options: {
    reference: string;
    transactionId: string;
    patientId?: string;
    hospitalId: string;
    amount: number;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentInitiationResponse> {
    await prisma.paymentTransaction.update({
      where: { id: options.transactionId },
      data: {
        status: 'pending',
      },
    });

    return {
      success: true,
      transactionId: options.transactionId,
      reference: options.reference,
      provider: 'insurance',
      status: 'pending',
      message: 'Insurance verification pending. Please provide insurance details.',
    };
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(transactionId: string): Promise<PaymentVerificationResult> {
    try {
      const transaction = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: {
          patient: true,
        },
      });

      if (!transaction) {
        return {
          success: false,
          transactionId,
          reference: '',
          provider: 'cash',
          status: 'failed',
          amount: 0,
          currency: 'KES',
        };
      }

      // For pending/processing transactions, check with provider
      if (transaction.status === 'processing') {
        await this.checkProviderStatus(transaction);
      }

      // Refresh from database
      const updated = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!updated) {
        throw new Error('Transaction not found');
      }

      return {
        success: updated.status === 'completed',
        transactionId: updated.id,
        reference: updated.reference,
        provider: updated.provider as PaymentProvider,
        status: updated.status as 'pending' | 'completed' | 'failed' | 'refunded',
        amount: Number(updated.amount),
        currency: updated.currency,
        paidAt: updated.paidAt || undefined,
        metadata: typeof updated.metadata === 'string' ? JSON.parse(updated.metadata) : updated.metadata ?? undefined,
      };
    } catch (error) {
      logger.error('Payment verification failed', {
        error: error instanceof Error ? error.message : String(error),
        transactionId,
      });

      return {
        success: false,
        transactionId,
        reference: '',
        provider: 'cash',
        status: 'failed',
        amount: 0,
        currency: 'KES',
      };
    }
  }

  /**
   * Check payment status with provider
   */
  private async checkProviderStatus(transaction: {
    provider: string;
    transactionId: string | null;
    reference: string;
  }): Promise<void> {
    try {
      if (transaction.provider === 'mpesa' && this.mpesaService && transaction.transactionId) {
        const status = await this.mpesaService.queryStkStatus(transaction.transactionId);
        
        if (status.success && status.resultCode === '0') {
          await prisma.paymentTransaction.update({
            where: { id: transaction.reference },
            data: { status: 'completed', paidAt: new Date() },
          });
        }
      } else if (transaction.provider === 'pesapal' && this.pesapalService && transaction.transactionId) {
        const status = await this.pesapalService.getTransactionStatus(transaction.transactionId);
        
        if (status.success && status.status === 'COMPLETE') {
          await prisma.paymentTransaction.update({
            where: { id: transaction.reference },
            data: { status: 'completed', paidAt: new Date() },
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to check provider status', {
        error: error instanceof Error ? error.message : String(error),
        provider: transaction.provider,
        transactionId: transaction.transactionId,
      });
    }
  }

  /**
   * Process a refund
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    const refundId = crypto.randomUUID();

    try {
      const transaction = await prisma.paymentTransaction.findUnique({
        where: { id: request.transactionId },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'completed') {
        throw new Error('Can only refund completed transactions');
      }

      // Process refund based on provider
      let refundResult: { success: boolean; status: string; message?: string };

      switch (transaction.provider) {
        case 'mpesa':
          // M-Pesa doesn't support direct refunds via API
          // Would need manual processing
          refundResult = {
            success: false,
            status: 'failed',
            message: 'M-Pesa refunds require manual processing. Please contact support.',
          };
          break;

        case 'pesapal':
          if (!this.pesapalService || !transaction.transactionId) {
            refundResult = {
              success: false,
              status: 'failed',
              message: 'Pesapal service not available',
            };
            break;
          }

          const pesapalRefund = await this.pesapalService.processRefund({
            orderTrackingId: transaction.transactionId,
            amount: request.amount,
            reason: request.reason,
            reference: request.reference,
          });

          refundResult = pesapalRefund.success
            ? { success: true, status: 'completed' }
            : { success: false, status: 'failed', message: pesapalRefund.errorMessage };
          break;

        default:
          refundResult = {
            success: false,
            status: 'failed',
            message: `Refunds not supported for ${transaction.provider}`,
          };
      }

      // Update transaction record
      await prisma.paymentTransaction.update({
        where: { id: request.transactionId },
        data: {
          status: refundResult.success ? 'refunded' : 'completed',
          refundedAt: refundResult.success ? new Date() : null,
          refundReason: request.reason,
        },
      });

      return {
        success: refundResult.success,
        refundId,
        status: refundResult.status as 'pending' | 'completed' | 'failed',
        message: refundResult.message,
      };
    } catch (error) {
      logger.error('Refund processing failed', {
        error: error instanceof Error ? error.message : String(error),
        transactionId: request.transactionId,
      });

      return {
        success: false,
        refundId,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Get transaction history for a hospital
   */
  async getTransactionHistory(options: {
    hospitalId: string;
    patientId?: string;
    status?: string;
    provider?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      hospitalId,
      patientId,
      status,
      provider,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = options;

    const where: Record<string, unknown> = { hospitalId };

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (provider) where.provider = provider;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, unknown>).lte = endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Generate unique reference
   */
  private generateReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AFYA-${timestamp}-${random}`;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const paymentGateway = new PaymentGatewayService();
export default paymentGateway;
export { PaymentGatewayService };