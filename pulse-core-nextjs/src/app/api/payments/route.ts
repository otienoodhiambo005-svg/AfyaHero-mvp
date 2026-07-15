import { NextRequest, NextResponse } from 'next/server';
import paymentGateway from '@/lib/payment/payment-gateway';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

// POST /api/payments - Process a payment
export async function POST(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:payments',
      roles: ['admin', 'reception', 'medical', 'pharmacy', 'lab'],
    });
    if (guard.response) return guard.response;
    const user = guard.session;

    if (!user || !user.hospitalId) {
      return NextResponse.json({ error: 'Unauthorized or missing hospital context' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      amount, 
      currency = 'KES', 
      method, 
      patientId, 
      reference,
      description,
      metadata
    } = body;

    if (!amount || !method || !patientId || !reference) {
      return NextResponse.json(
        { error: 'Missing required payment fields' }, 
        { status: 400 }
      );
    }

    const result = await paymentGateway.initiatePayment({
      amount,
      currency,
      provider: method,
      patientId,
      reference,
      description: description || `Payment for ${reference}`,
      hospitalId: user.hospitalId,
      metadata: {
        ...metadata,
        processedBy: user.id,
      }
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Payment processing failed', details: result },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Payment API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error processing payment' },
      { status: 500 }
    );
  }
}
