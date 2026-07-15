import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';
import { createMpesaService } from '@/lib/payment/mpesa';
import logger from '@/lib/logger';
import { prisma } from '@/lib/database';

const CALLBACK_WINDOW_SECONDS = 300;
const CALLBACK_TTL_SECONDS = 24 * 60 * 60;

function verifySignedCallback(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  const unixSeconds = Number(timestamp);
  if (!Number.isFinite(unixSeconds)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - unixSeconds) > CALLBACK_WINDOW_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

async function markCallbackSeen(idempotencyKey: string): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return process.env.NODE_ENV !== 'production';
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const result = await redis.set(`callback:mpesa:${idempotencyKey}`, '1', { nx: true, ex: CALLBACK_TTL_SECONDS });
  return result === 'OK';
}

// POST /api/payments/callback/mpesa
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-afyahero-signature') ?? '';
    const timestamp = req.headers.get('x-afyahero-timestamp') ?? '';
    const callbackSecret = process.env.MPESA_CALLBACK_HMAC_SECRET;

    if (callbackSecret) {
      if (!verifySignedCallback(rawBody, timestamp, signature, callbackSecret)) {
        logger.warn('Rejected M-Pesa callback due to invalid signature or replay window');
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      logger.error('M-Pesa callback secret is missing in production');
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const body = JSON.parse(rawBody) as {
      Body?: {
        stkCallback?: {
          MerchantRequestID?: string;
          ResultCode?: number;
          ResultDesc?: string;
          CallbackMetadata?: {
            Item?: Array<{ Name?: string; Value?: string | number }>;
          };
        };
      };
    };

    // Handle STK push callback
    if (body.Body && body.Body.stkCallback) {
      const { MerchantRequestID, ResultCode, ResultDesc, CallbackMetadata } = body.Body.stkCallback;

      if (!MerchantRequestID || typeof ResultCode !== 'number') {
        logger.warn('Malformed M-Pesa callback payload');
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      const firstSeen = await markCallbackSeen(`${MerchantRequestID}:${ResultCode}`);
      if (!firstSeen) {
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }
      
      const success = ResultCode === 0;
      let transactionId = '';
      
       if (success && CallbackMetadata?.Item) {
         // Find MpesaReceiptNumber safely
         const receiptItem = CallbackMetadata.Item.find((item) => item?.Name === 'MpesaReceiptNumber');
         if (receiptItem?.Value !== undefined) {
           transactionId = String(receiptItem.Value);
         }
         
         // Find Amount safely
         const amountItem = CallbackMetadata.Item.find((item) => item?.Name === 'Amount');
         if (amountItem?.Value !== undefined) {
           // Amount can be used for validation if needed
         }
       }

      const mpesaService = createMpesaService();
      if (mpesaService) {
        const parsed = mpesaService.processCallback(body as never);
        await prisma.paymentTransaction.updateMany({
          where: { transactionId: MerchantRequestID },
          data: {
            status: parsed.status === 'completed' ? 'completed' : 'failed',
            paidAt: parsed.status === 'completed' ? new Date() : null,
            metadata: {
              mpesaReceiptNumber: transactionId,
              resultCode: ResultCode,
              resultDesc: ResultDesc,
            },
          },
        });
      }

      logger.info('M-Pesa callback processed', {
        merchantRequestId: MerchantRequestID,
        success,
      });
      
      return NextResponse.json({ success: true });
    }
    
    // Handle standard C2B validation/confirmation
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });
  } catch (error) {
    logger.error('Error in M-Pesa callback', { error: error instanceof Error ? error.message : String(error) });
    // Always return 200 to M-Pesa to prevent retries
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted'
    });
  }
}
