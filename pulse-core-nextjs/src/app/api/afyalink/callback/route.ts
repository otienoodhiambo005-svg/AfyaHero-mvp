/**
 * DHA AfyaLink Callback Endpoint
 * Receives and validates incoming requests from Kenya Digital Health Authority
 */

import { NextRequest, NextResponse } from 'next/server';
import { afyaLinkClient } from '@/lib/afyalink-sha';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    
    // Extract headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Validate request authenticity
    const isValid = afyaLinkClient.validateCallbackRequest(headers, body);
    
    if (!isValid) {
      // console.warn('Invalid AfyaLink callback request rejected');
      return NextResponse.json(
        { status: 'error', message: 'Invalid request signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { status: 'error', message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    // console.log('Received valid AfyaLink callback:', {
    //   type: payload.type,
    //   reference: payload.reference,
    //   timestamp: headers['x-timestamp']
    // });

    // TODO: Implement business logic handling here:
    // - Patient eligibility checks
    // - Service authorization
    // - Claim responses
    // - Notification processing

    return NextResponse.json({
      status: 'success',
      received: true,
      reference: payload.reference
    });

  } catch (error) {
    // console.error('AfyaLink callback error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // DHA uses GET for endpoint validation checks
  return NextResponse.json({
    status: 'online',
    service: 'AfyaHero AfyaLink SHA Integration',
    agentId: process.env.AFYALINK_AGENT_ID,
    timestamp: new Date().toISOString()
  });
}