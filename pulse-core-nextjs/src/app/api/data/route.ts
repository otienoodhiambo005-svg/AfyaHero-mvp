import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, enforceApiRateLimit } from '@/lib/api-security';
import {
  getPatients, getPatientById, getLabQueue,
  getRxQueue, getTopDrugs, getArrivals, getReceptionKPI,
  getWards, getAlerts, getStaffCounts,
} from '@/lib/data';
import { DataSourceUnavailableError } from '@/lib/data/errors';
import { buildDegradedResponse } from '@/lib/degraded-response';
import logger from '@/lib/logger';

const VALID_ENTITIES = [
  'patients',
  'labQueue',
  'rxQueue',
  'topDrugs',
  'arrivals',
  'receptionKPI',
  'wards',
  'alerts',
  'staffCounts',
] as const;

// Role → allowed entities
const ROLE_ACCESS: Record<string, string[]> = {
  medical:   ['patients', 'labQueue'],
  lab:       ['labQueue', 'patients'],
  pharmacy:  ['rxQueue', 'topDrugs', 'patients'],
  reception: ['arrivals', 'receptionKPI', 'patients'],
  admin:     [...VALID_ENTITIES],
};

export async function GET(req: NextRequest) {
  const limited = await enforceApiRateLimit(req, 'data');
  if (limited) return limited;

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entity = req.nextUrl.searchParams.get('entity');
  if (!entity || !VALID_ENTITIES.includes(entity as (typeof VALID_ENTITIES)[number])) {
    return NextResponse.json(
      { error: 'Invalid entity', valid: VALID_ENTITIES },
      { status: 400 },
    );
  }

  const allowed = ROLE_ACCESS[session.role] ?? [];
  if (!allowed.includes(entity)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Special case: single patient by id
    if (entity === 'patients') {
      const id = req.nextUrl.searchParams.get('id');
      if (id) {
        const patient = await getPatientById(id, session.hospitalId);
        return NextResponse.json(patient || null);
      }
    }

    let data: unknown;
    switch (entity) {
      case 'patients':
        data = await getPatients(session.hospitalId);
        break;
      case 'labQueue':
        data = await getLabQueue();
        break;
      case 'rxQueue':
        data = await getRxQueue(session.hospitalId);
        break;
      case 'topDrugs':
        data = await getTopDrugs(session.hospitalId);
        break;
      case 'arrivals':
        data = await getArrivals();
        break;
      case 'receptionKPI':
        data = await getReceptionKPI();
        break;
      case 'wards':
        data = await getWards(session.hospitalId);
        break;
      case 'alerts':
        data = await getAlerts();
        break;
      case 'staffCounts':
        data = await getStaffCounts();
        break;
      default:
        return NextResponse.json({ error: 'Invalid entity' }, { status: 400 });
    }
    return NextResponse.json(data || []);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      logger.error(`Strict data source failure for ${entity}`, { error: error.message });
      return buildDegradedResponse({ entity, detail: error.message });
    }
    logger.error(`Error fetching ${entity} data`, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: `Failed to fetch ${entity}` },
      { status: 500 },
    );
  }
}
