/**
 * WhatsApp Webhook API Route
 * Handles incoming WhatsApp messages from Africa's Talking
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappBotService, WhatsAppWebhookPayload } from '@/lib/bot/whatsapp-bot';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Read raw body text first — signature must be verified against the exact
    // bytes the sender signed, not a re-serialized JSON payload.
    const rawBody = await request.text();

    // Verify webhook signature BEFORE any processing
    const signature = request.headers.get('x-africas-talking-signature');
    if (!whatsappBotService.verifyWebhookSignature(signature, rawBody)) {
      logger.warn('[WhatsApp Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    logger.info('[WhatsApp Webhook] Received webhook', {
      event: payload.event,
      messageCount: payload.data?.length || 0,
    });

    await whatsappBotService.handleIncomingMessage(payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[WhatsApp Webhook] Error processing webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Africa's Talking requires GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  logger.info('[WhatsApp Webhook] Verification request');
  return NextResponse.json({ status: 'active' });
}
