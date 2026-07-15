import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody, requireString, validateUuid } from '@/lib/api-security';
import { supabase } from '@/lib/supabase';
import { auditLog } from '@/lib/audit-logging';
import logger from '@/lib/logger';

interface BedAllocationRequest {
  bedId: string;
  patientId: string;
  patientName: string;
  notes?: string;
  expectedDischarge?: string;
}

/**
 * POST /api/medical/beds/allocate
 * 
 * Atomically allocates a bed to a patient.
 * Requires 'medical' or 'admin' role.
 */
export async function POST(req: NextRequest) {
  // 1. Auth & RBAC Guard
  const { session, response: guardResponse } = await enforceApiGuard(req, {
    roles: ['medical', 'admin'],
    scope: 'api:write'
  });
  if (guardResponse) return guardResponse;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse Body
  const body = await readJsonBody<BedAllocationRequest>(req);
  if (body instanceof NextResponse) return body;

  const bedId = validateUuid(body.bedId, 'bedId');
  if (bedId instanceof NextResponse) return bedId;

  const patientId = validateUuid(body.patientId, 'patientId');
  if (patientId instanceof NextResponse) return patientId;

  const patientName = requireString(body.patientName, 'patientName');
  if (patientName instanceof NextResponse) return patientName;

  try {
    // 3. Atomic conditional claim to avoid TOCTOU between read and write.
    const { data: updatedBed, error: updateError } = await supabase
      .from('hospital_beds')
      .update({
        status: 'occupied',
        patient_id: patientId,
        patient_name: patientName,
        admitted_at: new Date().toISOString(),
        expected_discharge: body.expectedDischarge,
        notes: body.notes
      })
      .eq('id', bedId)
      .eq('hospital_id', session.hospitalId)
      .eq('status', 'available')
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedBed) {
      const { data: bedMeta, error: metaError } = await supabase
        .from('hospital_beds')
        .select('hospital_id, status')
        .eq('id', bedId)
        .maybeSingle();

      if (metaError || !bedMeta) {
        return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
      }

      if (bedMeta.hospital_id !== session.hospitalId) {
        return NextResponse.json({ error: 'Unauthorized facility access' }, { status: 403 });
      }

      return NextResponse.json({ error: 'Bed is no longer available' }, { status: 409 });
    }

    // 5. Audit Log
    await auditLog({
      type: 'data_modify',
      userId: session.id,
      role: session.role,
      hospitalId: session.hospitalId,
      patientId,
      description: `Allocated bed ${updatedBed.bed_number ?? bedId} to patient ${patientName}`,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: req.headers.get('user-agent') ?? 'unknown',
      metadata: { bedId, bedNumber: updatedBed.bed_number, wardName: updatedBed.ward_name },
      recordedAt: new Date(),
    });

    return NextResponse.json(updatedBed);

  } catch (error) {
    logger.error('Bed allocation failed', { 
      error: error instanceof Error ? error.message : String(error),
      patientId, 
      bedId 
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
