import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { sanitizeError } from '@/lib/api-response';

export interface ReceptionQueueItem {
  id: string;
  token: string;
  name: string;
  ageSex: string;
  wait: string;
  priority: 'Normal' | 'Urgent' | 'Critical';
  status: 'In Progress' | 'Done' | 'Waiting' | 'Called';
  service: 'Lab' | 'Pharmacy' | 'Triage' | 'OPD';
  queueId: string;
}

export async function readReceptionQueueSnapshot(
  hospitalId: string,
  service?: string | null,
): Promise<ReceptionQueueItem[]> {
  const where = {
    hospitalId,
    ...(service ? { serviceType: service } : {}),
    status: { notIn: ['completed', 'cancelled'] },
  };

  const queue = await prisma.hospitalQueue.findMany({
    where,
    orderBy: [{ arrivedAt: 'asc' }],
    take: 150,
  });

  return queue.map(q => ({
    id: q.id,
    token: q.ticketNumber ?? `A${String(q.tokenNumber).padStart(3, '0')}`,
    name: q.patientName,
    ageSex: 'N/A',
    wait: `${q.waitMinutes ?? 0} min`,
    priority:
      q.priority === 'critical'
        ? 'Critical'
        : q.priority === 'urgent'
          ? 'Urgent'
          : 'Normal',
    status:
      q.status === 'in_progress'
        ? 'In Progress'
        : q.status === 'completed'
          ? 'Done'
          : q.status === 'waiting'
            ? 'Waiting'
            : 'Called',
    service:
      q.serviceType === 'Lab'
        ? 'Lab'
        : q.serviceType === 'Pharmacy'
          ? 'Pharmacy'
          : q.serviceType === 'Triage'
            ? 'Triage'
            : 'OPD',
    queueId: q.id,
  }));
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:queue',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const service = req.nextUrl.searchParams.get('service');
  try {
    const queue = await readReceptionQueueSnapshot(guard.session.hospitalId, service);
    return NextResponse.json(queue);
  } catch (error) {
    const { error: message } = sanitizeError(error, {
      context: 'Failed to load reception queue',
      clientMessage: 'Failed to load reception queue',
    });

    if (guard.session.demo) {
      return NextResponse.json([]);
    }

    return NextResponse.json({ error: message }, { status: 503 });
  }
}


