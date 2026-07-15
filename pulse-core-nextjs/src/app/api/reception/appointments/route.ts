 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
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

function formatTimeKe(d: Date): string {
  return new Intl.DateTimeFormat('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

type UiStatus = 'Confirmed' | 'Walk-In' | 'Cancelled' | 'Arrived' | 'No Show';

function toUiStatus(dbStatus: string | null | undefined): UiStatus {
  const s = (dbStatus ?? '').trim().toLowerCase();
  if (s === 'completed') return 'Arrived';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'no show' || s === 'noshow') return 'No Show';
  if (s === 'walk-in' || s === 'walk in') return 'Walk-In';
  return 'Confirmed';
}

const TIME_HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Map civil date + wall clock in `timeZone` to a UTC Date (1-minute search; handles DST). */
function wallTimeToUtc(ymd: string, hm: string, timeZone: string): Date | null {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const matches = (ts: number) => {
    const parts = formatter.formatToParts(new Date(ts));
    const get = (type: Intl.DateTimeFormatPart['type']) =>
      parts.find((p) => p.type === type)?.value;
    const py = Number(get('year'));
    const pm = Number(get('month'));
    const pd = Number(get('day'));
    const ph = Number(get('hour'));
    const pmin = Number(get('minute'));
    return py === y && pm === mo && pd === d && ph === h && pmin === mi;
  };

  const anchor = Date.UTC(y, mo - 1, d, h, mi, 0);
  for (let ms = anchor - 14 * 3600 * 1000; ms <= anchor + 14 * 3600 * 1000; ms += 60 * 1000) {
    if (matches(ms)) return new Date(ms);
  }
  return null;
}

const PatchBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('check_in'),
    appointmentId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('cancel'),
    appointmentId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('reschedule'),
    appointmentId: z.string().uuid(),
    newDate: z.string().regex(ISO_DATE),
    newTime: z.string().regex(TIME_HM),
  }),
]);

function normalizePatchBody(body: unknown): unknown {
  if (body && typeof body === 'object' && 'appointmentId' in body && !('action' in body)) {
    return { ...body, action: 'check_in' as const };
  }
  return body;
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:appointments',
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

    const center = new Date(`${targetYmd}T12:00:00.000Z`);
    const from = new Date(center.getTime() - 2 * 86_400_000);
    const to = new Date(center.getTime() + 2 * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: {
        hospitalId: guard.session.hospitalId,
        OR: [
          { scheduledAt: { gte: from, lt: to } },
          { AND: [{ scheduledAt: null }, { appointmentDate: { gte: from, lt: to } }] },
        ],
      },
      include: {
        patient: { select: { name: true, phone: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { appointmentDate: 'asc' }],
      take: 200,
    });

    const practitionerIds = [
      ...new Set(rows.map(r => r.practitionerId).filter((id): id is string => Boolean(id))),
    ];
    const practitioners =
      practitionerIds.length > 0
        ? await prisma.profile.findMany({
            where: { id: { in: practitionerIds } },
            select: { id: true, fullName: true, title: true },
          })
        : [];
    const clinicianById = new Map<string, { id: string; fullName: string | null; title: string | null }>(practitioners.map(p => [p.id, p]));

    const forDay = rows.filter(r => {
      const when = r.scheduledAt ?? r.appointmentDate;
      return formatYmdInTz(when, tz) === targetYmd;
    });

    const appointments = forDay.map(a => {
      const when = a.scheduledAt ?? a.appointmentDate;
      const clinician = a.practitionerId ? clinicianById.get(a.practitionerId) : undefined;
      const title = clinician?.title?.trim();
      const doctorName = clinician?.fullName ?? 'Unassigned';
      const doctor = title ? `${title} ${doctorName}`.replace(/\s+/g, ' ').trim() : doctorName;

      return {
        id: a.id,
        time: formatTimeKe(when),
        patient: a.patient.name,
        phone: a.patient.phone?.trim() || '—',
        type: a.type?.trim() || 'OPD',
        doctor,
        status: toUiStatus(a.status),
      };
    });

    return NextResponse.json({ date: targetYmd, timezone: tz, appointments });
  } catch (error) {
    logger.error('Reception appointments list failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId: guard.session.hospitalId,
    });
    return NextResponse.json({ error: 'Failed to load appointments.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:appointments:patch',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = PatchBodySchema.safeParse(normalizePatchBody(body));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  try {
    const existing = await prisma.appointment.findFirst({
      where: {
        id: payload.appointmentId,
        hospitalId: guard.session.hospitalId,
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
    }

    const normalized = (existing.status ?? '').trim().toLowerCase();

    if (payload.action === 'check_in') {
      if (normalized === 'completed') {
        return NextResponse.json({ ok: true, action: 'check_in', status: 'Completed', idempotent: true });
      }
      if (normalized === 'cancelled') {
        return NextResponse.json({ error: 'Cannot check in a cancelled appointment.' }, { status: 409 });
      }

      await prisma.appointment.update({
        where: { id: existing.id },
        data: { status: 'Completed' },
      });

      logger.info('Reception appointment checked in', {
        appointmentId: existing.id,
        hospitalId: guard.session.hospitalId,
        actorId: guard.session.id,
      });

      return NextResponse.json({ ok: true, action: 'check_in', status: 'Completed' });
    }

    if (payload.action === 'cancel') {
      if (normalized === 'completed') {
        return NextResponse.json({ error: 'Cannot cancel a completed visit.' }, { status: 409 });
      }
      if (normalized === 'cancelled') {
        return NextResponse.json({ ok: true, action: 'cancel', status: 'Cancelled', idempotent: true });
      }

      await prisma.appointment.update({
        where: { id: existing.id },
        data: { status: 'Cancelled' },
      });

      logger.info('Reception appointment cancelled', {
        appointmentId: existing.id,
        hospitalId: guard.session.hospitalId,
        actorId: guard.session.id,
      });

      return NextResponse.json({ ok: true, action: 'cancel', status: 'Cancelled' });
    }

    if (normalized === 'completed') {
      return NextResponse.json({ error: 'Cannot reschedule a completed visit.' }, { status: 409 });
    }
    if (normalized === 'cancelled') {
      return NextResponse.json({ error: 'Cannot reschedule a cancelled appointment.' }, { status: 409 });
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: guard.session.hospitalId },
      select: { timezone: true },
    });
    const tz = hospital?.timezone ?? 'Africa/Nairobi';

    const when = wallTimeToUtc(payload.newDate, payload.newTime, tz);
    if (!when) {
      return NextResponse.json(
        { error: 'Invalid date or time for this facility timezone.' },
        { status: 400 },
      );
    }

    await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        scheduledAt: when,
        appointmentDate: when,
      },
    });

    logger.info('Reception appointment rescheduled', {
      appointmentId: existing.id,
      hospitalId: guard.session.hospitalId,
      actorId: guard.session.id,
      newDate: payload.newDate,
      newTime: payload.newTime,
    });

    return NextResponse.json({ ok: true, action: 'reschedule', scheduledAt: when.toISOString() });
  } catch (error) {
    logger.error('Reception appointment patch failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId: guard.session.hospitalId,
      action: payload.action,
    });
    return NextResponse.json({ error: 'Failed to update appointment.' }, { status: 500 });
  }
}
