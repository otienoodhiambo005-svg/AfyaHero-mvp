/**
 * Twilio API Routes
 * 
 * POST /api/twilio/webhook - Handle incoming Twilio messages/calls
 * POST /api/twilio/send - Send SMS/WhatsApp message
 * POST /api/twilio/call - Initiate voice call
 * POST /api/twilio/gather - Handle voice input (Gather action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  sendTwilioMessage, 
  initiateTwilioCall, 
  handleTwilioWebhook,
  generateAppointmentReminderTwiml,
  isTwilioConfigured,
  type TwilioMessageRequest,
  type TwilioCallRequest
} from '@/lib/twilio-service';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';

// POST /api/twilio/webhook - Handle incoming messages from Twilio
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle incoming voice calls with TwiML
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return await handleTwilioWebhook(request);
    }
    
    // Handle incoming messages (SMS/WhatsApp)
    return await handleTwilioWebhook(request);
  } catch (error) {
    logger.error('Twilio webhook error', { error });
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

// GET /api/twilio/webhook - Twilio sends GET for initial voice call setup
export async function GET(request: NextRequest) {
  try {
    const formData = request.nextUrl.searchParams;
    
    // Return TwiML for initial voice response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Neural.Ambassador.en-US">
    Welcome to AfyaHero. Please hold while we connect you to our system.
  </Say>
  <Redirect method="POST">/api/twilio/webhook</Redirect>
</Response>`;
    
    return new NextResponse(twiml, {
      headers: { 
        'Content-Type': 'text/xml',
        'X-Twilio-Signature': request.headers.get('x-twilio-signature') || '',
      },
    });
  } catch (error) {
    logger.error('Twilio voice initial error', { error });
    return NextResponse.json({ error: 'Failed to setup call' }, { status: 500 });
  }
}

// POST /api/twilio/send - Send SMS/WhatsApp message
export async function PUT(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:twilio:send',
    requireAuth: true,
  });
  if (guard.response) return guard.response;

  if (!isTwilioConfigured()) {
    return NextResponse.json({ 
      error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER' 
    }, { status: 503 });
  }

  try {
    const body = await request.json() as TwilioMessageRequest;
    
    const { to, message, channel, mediaUrl } = body;
    
    if (!to || !message) {
      return NextResponse.json({ 
        error: 'Missing required fields: to, message' 
      }, { status: 400 });
    }

    // Log to communication_queue table
    const messageId = `msg_${Date.now()}`;
    try {
      await prisma.$executeRaw`
        INSERT INTO communication_queue (id, phone, channel, message, status, created_at)
        VALUES (${messageId}, ${to}, ${channel || 'sms'}, ${message}, 'pending', NOW())
      `;
    } catch {
      // Table might not exist yet - continue without logging
    }

    const result = await sendTwilioMessage({
      to,
      message,
      channel: channel || 'sms',
      mediaUrl,
    });

    if (result.success) {
      // Update status in queue
      try {
        await prisma.$executeRaw`
          UPDATE communication_queue 
          SET status = ${result.status}, message_id = ${result.messageId}
          WHERE id = ${messageId}
        `;
      } catch {
        // Ignore queue update errors
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Twilio send error', { error });
    return NextResponse.json({ 
      error: 'Failed to send message' 
    }, { status: 500 });
  }
}

// POST /api/twilio/call - Initiate voice call
export async function PATCH(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:twilio:call',
    requireAuth: true,
  });
  if (guard.response) return guard.response;

  if (!isTwilioConfigured()) {
    return NextResponse.json({ 
      error: 'Twilio not configured' 
    }, { status: 503 });
  }

  try {
    const body = await request.json() as TwilioCallRequest;
    
    const { to, twiml, callbackUrl } = body;
    
    if (!to || !twiml) {
      return NextResponse.json({ 
        error: 'Missing required fields: to, twiml' 
      }, { status: 400 });
    }

    const result = await initiateTwilioCall({
      to,
      twiml,
      callbackUrl: callbackUrl || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Twilio call error', { error });
    return NextResponse.json({ 
      error: 'Failed to initiate call' 
    }, { status: 500 });
  }
}

// POST /api/twilio/gather - Handle voice menu input
export async function HEAD(request: NextRequest) {
  try {
    const formData = await request.formData();
    const digits = formData.get('Digits') as string;
    const callSid = formData.get('CallSid') as string;
    
    logger.info('Twilio gather', { digits, callSid });

    let response = '';
    
    switch (digits) {
      case '1':
        response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You selected to confirm your appointment. Please hold.</Say>
  <Redirect method="POST">/api/twilio/appointment/confirm</Redirect>
</Response>`;
        break;
      case '2':
        response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You selected to cancel. Are you sure? Press 1 to confirm cancellation, 2 to go back.</Say>
  <Gather numDigits="1" action="/api/twilio/gather" method="POST"/>
</Response>`;
        break;
      case '3':
        response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You selected to reschedule. Please visit our website or call reception to reschedule.</Say>
  <Hangup/>
</Response>`;
        break;
      default:
        response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Invalid selection. Please try again.</Say>
  <Redirect method="POST">/api/twilio/webhook</Redirect>
</Response>`;
    }

    return new NextResponse(response, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    logger.error('Twilio gather error', { error });
    return NextResponse.json({ error: 'Failed to process input' }, { status: 500 });
  }
}