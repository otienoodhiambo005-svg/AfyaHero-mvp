/**
 * Twilio Communication Service
 * 
 * Handles SMS, WhatsApp, and Voice calls via Twilio.
 * Integrates with the existing communication queue system.
 * 
 * Environment Variables Required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (WhatsApp Business verified number)
 * - TWILIO_WHATSAPP_PHONE_NUMBER (for WhatsApp messages)
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP_PHONE_NUMBER = process.env.TWILIO_WHATSAPP_PHONE_NUMBER;

export interface TwilioMessageRequest {
  to: string;
  message: string;
  channel: 'sms' | 'whatsapp' | 'voice';
  mediaUrl?: string;
}

export interface TwilioMessageResponse {
  success: boolean;
  messageId?: string;
  status: string;
  error?: string;
}

export interface TwilioCallRequest {
  to: string;
  twiml: string;
  callbackUrl?: string;
}

export interface TwilioCallResponse {
  success: boolean;
  callSid?: string;
  status: string;
  error?: string;
}

/**
 * Send SMS or WhatsApp message via Twilio
 */
export async function sendTwilioMessage(
  request: TwilioMessageRequest
): Promise<TwilioMessageResponse> {
  const { to, message, channel, mediaUrl } = request;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    logger.error('Twilio credentials not configured');
    return { success: false, status: 'error', error: 'Twilio not configured' };
  }

  try {
    const formattedTo = formatPhoneNumber(to, channel);
    
    const formData = new URLSearchParams();
    formData.append('To', formattedTo);
    formData.append('From', channel === 'whatsapp' ? TWILIO_WHATSAPP_PHONE_NUMBER! : TWILIO_PHONE_NUMBER!);
    formData.append('Body', message);
    
    if (mediaUrl) {
      formData.append('MediaUrl', mediaUrl);
    }

    const url = channel === 'whatsapp' 
      ? `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
      : `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('Twilio API error', { result });
      return { 
        success: false, 
        status: 'failed', 
        error: result.message || 'Failed to send message' 
      };
    }

    logger.info('Twilio message sent', { 
      messageId: result.sid, 
      channel,
      to: formattedTo 
    });

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error) {
    logger.error('Twilio send error', { error });
    return { 
      success: false, 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Initiate a voice call
 */
export async function initiateTwilioCall(
  request: TwilioCallRequest
): Promise<TwilioCallResponse> {
  const { to, twiml, callbackUrl } = request;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    logger.error('Twilio credentials not configured');
    return { success: false, status: 'error', error: 'Twilio not configured' };
  }

  try {
    const formattedTo = formatPhoneNumber(to, 'sms');

    const formData = new URLSearchParams();
    formData.append('To', formattedTo);
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('Twiml', twiml);
    
    if (callbackUrl) {
      formData.append('StatusCallback', callbackUrl);
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('Twilio call API error', { result });
      return { 
        success: false, 
        status: 'failed', 
        error: result.message || 'Failed to initiate call' 
      };
    }

    logger.info('Twilio call initiated', { 
      callSid: result.sid, 
      to: formattedTo 
    });

    return {
      success: true,
      callSid: result.sid,
      status: result.status,
    };
  } catch (error) {
    logger.error('Twilio call error', { error });
    return { 
      success: false, 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Generate TwiML for interactive voice response
 */
export function generateTwiml(prompts: string[], actions: Record<string, string>): string {
  let response = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  
  for (const prompt of prompts) {
    response += `<Say voice="Polly.Neural.Ambassador.en-US" language="en-US">${prompt}</Say>`;
  }
  
  // Add gather for user input
  if (Object.keys(actions).length > 0) {
    const digits = Object.keys(actions).join('');
    response += '<Gather numDigits="1" action="/api/twilio/gather" method="POST">';
    for (const prompt of prompts) {
      response += `<Say voice="Polly.Neural.Ambassador.en-US" language="en-US">${prompt}</Say>`;
    }
    response += '</Gather>';
  }
  
  response += '</Response>';
  return response;
}

/**
 * Generate TwiML for appointment reminder
 */
export function generateAppointmentReminderTwiml(
  patientName: string,
  appointmentTime: string,
  department: string
): string {
  const prompts = [
    `Hello ${patientName}. This is a reminder from AfyaHero.`,
    `Your appointment at ${department} is scheduled for ${appointmentTime}.`,
    'Please arrive 15 minutes early.',
    'To confirm, press 1. To cancel, press 2. To reschedule, press 3.',
  ];
  
  return generateTwiml(prompts, {
    '1': 'confirm',
    '2': 'cancel',
    '3': 'reschedule',
  });
}

/**
 * Format phone number for Twilio (E.164 format)
 */
function formatPhoneNumber(phone: string, channel: 'sms' | 'whatsapp' | 'voice'): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle Kenya numbers
  if (cleaned.startsWith('254') || cleaned.startsWith('0')) {
    if (cleaned.startsWith('0')) {
      return `+254${cleaned.substring(1)}`;
    }
    return `+${cleaned}`;
  }
  
  // If no country code, assume Kenya
  if (cleaned.length === 9) {
    return `+254${cleaned}`;
  }
  
  // Default: add + if not present
  return phone.startsWith('+') ? phone : `+${phone}`;
}

/**
 * Handle incoming Twilio webhook (SMS/WhatsApp/Voice)
 */
export async function handleTwilioWebhook(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData);

    const messageSid = body.MessageSid as string;
    const from = body.From as string;
    const bodyText = body.Body as string;
    const channel = body.Channel as string || 'sms';

    logger.info('Twilio webhook received', { 
      messageSid, 
      from, 
      channel,
      bodyText 
    });

    // Detect language for response
    const detectedLang = detectLanguage(bodyText);

    // Route to appropriate handler
    const routingResult = await routeIncomingMessage({
      from,
      message: bodyText,
      channel,
      lang: detectedLang,
      messageSid,
    });

    // Return TwiML for voice or JSON for SMS/WhatsApp
    if (channel === 'voice') {
      const twiml = generateTwiml([routingResult.response], { '1': 'confirm', '2': 'cancel', '3': 'reschedule' });
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    return NextResponse.json(routingResult);
  } catch (error) {
    logger.error('Twilio webhook error', { error });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Route incoming message based on conversation state
 */
async function routeIncomingMessage(params: {
  from: string;
  message: string;
  channel: string;
  lang: string;
  messageSid: string;
}) {
  const { from, message, channel, lang } = params;

  // Simple keyword-based routing for MVP
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('appointment') || lowerMessage.includes('appointment') || lowerMessage.includes('booking')) {
    return {
      response: getLocalizedResponse('appointment', lang),
      action: 'appointment_flow',
    };
  }
  
  if (lowerMessage.includes('lab') || lowerMessage.includes('result') || lowerMessage.includes('matokeo')) {
    return {
      response: getLocalizedResponse('lab_results', lang),
      action: 'lab_results_flow',
    };
  }
  
  if (lowerMessage.includes('pharmacy') || lowerMessage.includes('dawa') || lowerMessage.includes('medicine')) {
    return {
      response: getLocalizedResponse('pharmacy', lang),
      action: 'pharmacy_flow',
    };
  }
  
  if (lowerMessage.includes('pay') || lowerMessage.includes('lipa') || lowerMessage.includes('payment')) {
    return {
      response: getLocalizedResponse('payment', lang),
      action: 'payment_flow',
    };
  }

  // Default menu
  return {
    response: getLocalizedResponse('menu', lang),
    action: 'main_menu',
  };
}

/**
 * Get localized response
 */
function getLocalizedResponse(type: string, lang: string): string {
  const responses: Record<string, Record<string, string>> = {
    menu: {
      en: 'AfyaHero: Welcome! Choose:\n1. Appointment\n2. Lab Results\n3. Pharmacy\n4. Payment\n5. Talk to Doctor',
      sw: 'AfyaHero: Karibu! Chagua:\n1. Appointment\n2. Matokeo ya Lab\n3. Dawa\n4. Malipo\n5. Njia ya Daktari',
      sheng: 'AfyaHero: Welcome! Choose:\n1. Appointment\n2. Lab results\n3. Pharmacy\n4. Payment\n5. Doctor',
    },
    appointment: {
      en: 'To book an appointment, please provide:\n- Your name\n- Preferred department\n- Preferred date',
      sw: 'Kwa booking ya appointment, tafadhali toa:\n- Jina lako\n- idara unayopenda\n- tarehe unayopenda',
      sheng: 'For appointment, provide:\n- Your name\n- Department\n- Date',
    },
    lab_results: {
      en: 'To view your lab results, please provide your Patient ID or National ID number.',
      sw: 'Kuangalia matokeo ya lab, tafadhali toa Namba ya Mgonjwa au Namba ya Kitambulisho.',
      sheng: 'For lab results, provide your Patient ID or National ID.',
    },
    pharmacy: {
      en: 'For pharmacy services, visit our pharmacy or call:',
      sw: 'Kwa huduma za pharmacy, hudhuria duka letu la dawa au piga:',
      sheng: 'For pharmacy, visit our pharmacy or call:',
    },
    payment: {
      en: 'For payment inquiries, please provide your Invoice Number or Patient ID.',
      sw: 'Kwa maswali ya malipo, tafadhali toa Namba ya Invoice au Namba ya Mgonjwa.',
      sheng: 'For payment, provide Invoice Number or Patient ID.',
    },
  };

  const langKey = lang === 'sw' ? 'sw' : lang === 'sheng' ? 'sheng' : 'en';
  return responses[type]?.[langKey] || responses[type]?.en || 'Welcome to AfyaHero';
}

/**
 * Detect language from message
 */
function detectLanguage(message: string): string {
  const swahiliWords = ['habari', 'karibu', 'poa', 'msee', 'noma', 'asante', 'heri', 'dawa', 'lab', 'matokeo', 'appointment', 'tarehe', 'jina'];
  const shengWords = ['sasa', 'msee', 'boi', 'sema', 'nia', 'hio', 'gide', 'kaa'];
  
  const lowerMessage = message.toLowerCase();
  
  if (swahiliWords.some(word => lowerMessage.includes(word))) {
    return 'sw';
  }
  
  if (shengWords.some(word => lowerMessage.includes(word))) {
    return 'sheng';
  }
  
  return 'en';
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}