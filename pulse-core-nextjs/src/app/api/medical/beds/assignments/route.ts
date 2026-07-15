import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

type BedAssignmentRow = {
  id: string;
  ward_id: string | null;
  ward_name: string | null;
  status: string | null;
};

type WardAssignmentSummary = {
  id: string;
  name: string;
  occupied: number;
  total: number;
  critical: number;
  pending: number;
};

export async function GET(req: NextRequest) {
  const { session, response } = await enforceApiGuard(req, {
    roles: ['medical', 'admin', 'super_admin'],
    scope: 'api:medical:beds',
  });
  if (response) return response;
  if (!session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('hospital_beds')
      .select('id, ward_id, ward_name, status')
      .eq('hospital_id', session.hospitalId);

    if (error) throw error;

    const rows = (data ?? []) as BedAssignmentRow[];
    const wardMap = new Map<string, WardAssignmentSummary>();

    for (const bed of rows) {
      const wardId = bed.ward_id ?? bed.ward_name ?? 'unassigned';
      const wardName = bed.ward_name ?? 'General Ward';
      const status = (bed.status ?? '').toLowerCase();

      if (!wardMap.has(wardId)) {
        wardMap.set(wardId, {
          id: wardId,
          name: wardName,
          occupied: 0,
          total: 0,
          critical: 0,
          pending: 0,
        });
      }

      const ward = wardMap.get(wardId);
      if (!ward) continue;
      ward.total += 1;
      if (status === 'occupied') ward.occupied += 1;
      if (status === 'reserved') ward.pending += 1;
    }

    const wards = Array.from(wardMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ wards }, { status: 200 });
  } catch (err) {
    logger.error('medical bed assignments GET failed', { err, hospitalId: session.hospitalId });
    return NextResponse.json(
      { error: 'Unable to load bed assignments for your hospital.' },
      { status: 500 },
    );
  }
}
