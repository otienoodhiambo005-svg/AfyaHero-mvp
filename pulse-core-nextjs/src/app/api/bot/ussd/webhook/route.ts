/**
 * USSD Webhook API Route
 * Handles incoming USSD requests from Africa's Talking
 */

import { NextRequest, NextResponse } from 'next/server';
import { ussdService, USSDRequest } from '@/lib/bot/uussd-service';
import { authenticateUssdRequest } from '@/lib/bot/ussd-webhook-auth';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    if (!authenticateUssdRequest(request, { rawBody })) {
      return new NextResponse('END Unauthorized.', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const params = new URLSearchParams(rawBody);
    const ussdRequest: USSDRequest = {
      sessionId: params.get('sessionId') as string,
      serviceCode: params.get('serviceCode') as string,
      phoneNumber: params.get('phoneNumber') as string,
      text: params.get('text') as string,
    };

    logger.info('[USSD Webhook] Received request', {
      sessionId: ussdRequest.sessionId,
      phoneNumber: ussdRequest.phoneNumber,
      text: ussdRequest.text,
    });

    const response = await ussdService.handleRequest(ussdRequest);

    logger.info('[USSD Webhook] Sending response', {
      sessionId: ussdRequest.sessionId,
      shouldClose: response.shouldClose,
    });

    return new NextResponse(response.response, {
      headers: {
        'Content-Type': 'text/plain',
        Freeflow: response.shouldClose ? 'false' : 'true',
      },
    });
  } catch (error) {
    logger.error('[USSD Webhook] Error processing request', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new NextResponse('END An error occurred. Please try again later.', {
      headers: {
        'Content-Type': 'text/plain',
        Freeflow: 'true',
      },
    });
  }
}

export async function GET(request: NextRequest) {
  logger.info('[USSD Webhook] Verification request');
  return NextResponse.json({ status: 'active' });
}
