 
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatYmdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** First UTC instant where the hospital-local calendar date is `ymd`. */
function startOfYmdUtc(ymd: string, timeZone: string): Date {
  const [yy, mm, dd] = ymd.split('-').map(Number);
  let lo = Date.UTC(yy, mm - 1, dd) - 3 * 86_400_000;
  let hi = Date.UTC(yy, mm - 1, dd) + 3 * 86_400_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const my = formatYmdInTz(new Date(mid), timeZone);
    if (my < ymd) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

/** First UTC instant on the next local calendar day after `ymd`. */
function endOfYmdExclusiveUtc(ymd: string, timeZone: string): Date {
  const start = startOfYmdUtc(ymd, timeZone).getTime();
  let lo = start;
  let hi = start + 2 * 86_400_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (formatYmdInTz(new Date(mid), timeZone) === ymd) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

export type FrontDeskPatientStatus = 'Waiting' | 'Processing' | 'Registered' | 'Cleared';

function mapCheckinStatus(raw: string): FrontDeskPatientStatus {
  const s = raw.trim().toLowerCase();
  if (s === 'in consultation') return 'Processing';
  if (s === 'checked out' || s === 'no show') return 'Cleared';
  if (s === 'checked in') return 'Registered';
  if (s === 'in queue') return 'Waiting';
  return 'Waiting';
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:patients',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: guard.session.hospitalId },
      select: { timezone: true },
    });
    const tz = hospital?.timezone ?? 'Africa/Nairobi';

    const dateParam = req.nextUrl.searchParams.get('date')?.trim();
    const targetYmd =
      dateParam && ISO_DATE.test(dateParam) ? dateParam : formatYmdInTz(new Date(), tz);

    const dayStart = startOfYmdUtc(targetYmd, tz);
    const dayEnd = endOfYmdExclusiveUtc(targetYmd, tz);

    const checkins = await prisma.receptionCheckin.findMany({
      where: {
        hospitalId: guard.session.hospitalId,
        checkedInAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: [{ checkedInAt: 'desc' }],
      take: 200,
    });

    const checkinIds = checkins.map(c => c.id);
    const queues =
      checkinIds.length > 0
        ? await prisma.hospitalQueue.findMany({
            where: {
              hospitalId: guard.session.hospitalId,
              checkinId: { in: checkinIds },
            },
            select: {
              checkinId: true,
              ticketNumber: true,
              tokenNumber: true,
              room: true,
              serviceType: true,
              status: true,
            },
          })
        : [];

    type QueueRow = { checkinId: string | null; ticketNumber: string | null; tokenNumber: number | null; room: string | null; serviceType: string | null; status: string | null };
    const queueByCheckin = new Map<string, QueueRow>(
      queues
        .filter(q => q.checkinId != null)
        .map(q => [q.checkinId as string, q]),
    );

    const patients = checkins.map(c => {
      const q = c.id ? queueByCheckin.get(c.id) : undefined;
      const ticket = q?.ticketNumber ?? (c.tokenNumber != null ? `A${String(c.tokenNumber).padStart(3, '0')}` : null);
      const counter =
        q?.room?.trim() ||
        (ticket ? `Desk ${String((q?.tokenNumber ?? c.tokenNumber ?? 1) % 3 || 3)}` : '—');
      const insurance =
        c.insuranceProvider?.trim() ||
        (c.paymentMethod?.toLowerCase().includes('insurance') ? 'Insurance' : 'Cash');
      const visitType = c.visitType || 'OPD';
      const arrivalTime = new Intl.DateTimeFormat('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(c.checkedInAt);

      const uiStatus =
        q?.status === 'in_progress'
          ? ('Processing' as const)
          : q?.status === 'completed' || q?.status === 'cancelled'
            ? ('Cleared' as const)
            : q?.status === 'waiting'
              ? ('Waiting' as const)
              : mapCheckinStatus(c.status);

      return {
        id: c.id,
        pid: c.patientId ? `PID-${c.patientId.slice(0, 8).toUpperCase()}` : `CHK-${c.id.slice(0, 8).toUpperCase()}`,
        name: c.patientName,
        phone: c.phone?.trim() || '—',
        visitType,
        counter,
        status: uiStatus,
        arrivalTime,
        insurance,
      };
    });

    return NextResponse.json({
      date: targetYmd,
      timezone: tz,
      patients,
    });
  } catch (e) {
    logger.error('reception patients list failed', {
      hospitalId: guard.session.hospitalId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Could not load front-desk register.' }, { status: 500 });
  }
}
