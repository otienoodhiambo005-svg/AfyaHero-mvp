import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createPesapalService } from '@/lib/payment/pesapal';
import logger from '@/lib/logger';
import { prisma } from '@/lib/database';

const CALLBACK_TTL_SECONDS = 24 * 60 * 60;

async function markCallbackSeen(idempotencyKey: string): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return process.env.NODE_ENV !== 'production';
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const result = await redis.set(`callback:pesapal:${idempotencyKey}`, '1', { nx: true, ex: CALLBACK_TTL_SECONDS });
  return result === 'OK';
}

function isPesapalAuthorized(request: NextRequest): boolean {
  const configuredToken = process.env.PESAPAL_CALLBACK_TOKEN;
  if (!configuredToken) return process.env.NODE_ENV !== 'production';

  const headerToken = request.headers.get('x-pesapal-token');
  const queryToken = new URL(request.url).searchParams.get('token');
  return configuredToken === headerToken || configuredToken === queryToken;
}

// GET/POST /api/payments/callback/pesapal
export async function GET(req: NextRequest) {
  return handlePesapalCallback(req);
}

export async function POST(req: NextRequest) {
  return handlePesapalCallback(req);
}

async function handlePesapalCallback(req: NextRequest) {
  try {
    if (!isPesapalAuthorized(req)) {
      logger.warn('Rejected Pesapal callback due to invalid token');
      return NextResponse.json({ success: true });
    }

    const url = new URL(req.url);
    const orderTrackingId = url.searchParams.get('OrderTrackingId');
    const merchantReference = url.searchParams.get('OrderMerchantReference');
    
    if (!orderTrackingId) {
      return NextResponse.json(
        { error: 'Missing OrderTrackingId' },
        { status: 400 }
      );
    }

    const firstSeen = await markCallbackSeen(orderTrackingId);
    if (!firstSeen) {
      return NextResponse.json({ success: true });
    }

    const pesapalService = createPesapalService();
    let statusDesc = 'PENDING';
    const transactionIdStr = orderTrackingId;

    if (pesapalService) {
      const status = await pesapalService.getTransactionStatus(orderTrackingId);
      statusDesc = status.status;

      await prisma.paymentTransaction.updateMany({
        where: { transactionId: orderTrackingId },
        data: {
          status: status.status === 'COMPLETE' ? 'completed' : status.status === 'FAILED' ? 'failed' : 'processing',
          paidAt: status.status === 'COMPLETE' ? new Date() : null,
          metadata: {
            pesapalStatus: status.status,
            merchantReference,
            confirmationCode: status.confirmationCode ?? null,
          },
        },
      });
    }

    logger.info('Pesapal callback processed', { orderTrackingId, status: statusDesc });
    
    return NextResponse.json({ 
      success: true, 
      status: statusDesc,
      transactionId: transactionIdStr
    });
  } catch (error) {
    logger.error('Error in Pesapal callback:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error processing Pesapal callback' },
      { status: 500 }
    );
  }
}
