import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { supabaseServer } from '@/lib/supabase-server';
import { readIdempotencyCache, writeIdempotencyCache } from '@/lib/idempotency';
import { sanitizeError } from '@/lib/api-response';

const RegisterPatientSchema = z.object({
  name: z.string().min(2).max(120),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['M', 'F', 'Other']),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  national_id: z.string().min(5).max(20),
  shif_number: z.string().min(5).max(30),
  emergency_contact_name: z.string().min(2).max(120),
  emergency_contact_phone: z.string().min(10).max(15),
  chief_complaint: z.string().min(5).max(1000),
  county: z.string().min(2).max(200),
});

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export async function POST(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:patients:register',
      roles: ['reception', 'medical', 'admin', 'super_admin'],
    });
    if (guard.response) return guard.response;

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    const parsed = RegisterPatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid patient registration data.', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
    if (idempotencyKey) {
      const cached = readIdempotencyCache(idempotencyKey);
      if (cached) {
        return NextResponse.json(cached.payload, { status: cached.status });
      }
    }

    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Patient registration backend is unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }

    const data = parsed.data;
    const payload = {
      ...data,
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    const { data: patient, error } = await supabaseServer
      .from('patients')
      .insert([payload])
      .select()
      .single();

    if (error) {
      sanitizeError(error, {
        context: 'Patient registration insert failed',
        clientMessage: 'Failed to register patient. Please try again.',
      });
      return NextResponse.json({ error: 'Failed to register patient. Please try again.' }, { status: 500 });
    }

    const responsePayload = { success: true, patient };
    if (idempotencyKey) {
      writeIdempotencyCache(idempotencyKey, { status: 201, payload: responsePayload });
    }

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    const { error } = sanitizeError(err, {
      context: 'Patient registration',
      clientMessage: 'Failed to register patient. Please try again.',
    });
    return NextResponse.json({ error }, { status: 500 });
  }
}
