 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const TaskSchema = z.object({
  patientId: z.string().uuid().optional(),
  patientName: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(200),
  message: z.string().trim().min(3).max(2000),
  channel: z.enum(['chat', 'task']).default('task'),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
});

function priorityLabel(priority: 'routine' | 'urgent' | 'stat'): string {
  if (priority === 'stat') return 'STAT';
  if (priority === 'urgent') return 'URGENT';
  return 'ROUTINE';
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:doctor-tasks',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  try {
    const rows = await prisma.serviceEscalation.findMany({
      where: {
        hospitalId: guard.session.hospitalId,
        status: 'open',
        serviceArea: { in: ['doctor-dashboard-chat', 'doctor-dashboard-task'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        serviceArea: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      tasks: rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        message: row.body,
        channel: row.serviceArea === 'doctor-dashboard-chat' ? 'chat' : 'task',
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('doctor tasks GET failed', { err });
    return NextResponse.json({ error: 'Unable to load doctor tasks.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:doctor-tasks',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parsed = TaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid doctor notification payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const hospitalId = guard.session.hospitalId;
  const actorId = guard.session.id;
  const channelArea = data.channel === 'chat' ? 'doctor-dashboard-chat' : 'doctor-dashboard-task';
  const title = `[${priorityLabel(data.priority)}] ${data.title}`;

  try {
    const created = await prisma.$transaction(async (tx: any) => {
      const task = await tx.serviceEscalation.create({
        data: {
          hospitalId,
          title,
          body: data.message,
          serviceArea: channelArea,
          status: 'open',
          createdById: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'medical_doctor_notified',
          actorId,
          actorEmail: guard.session?.email ?? undefined,
          actorRole: guard.session?.role,
          hospitalId,
          resourceType: 'ServiceEscalation',
          resourceId: task.id,
          detail: {
            patientId: data.patientId ?? null,
            patientName: data.patientName,
            channel: data.channel,
            priority: data.priority,
            source: 'medical-portal',
          },
        },
      });

      return task;
    });

    return NextResponse.json(
      {
        task: {
          id: created.id,
          title: created.title,
          message: created.body,
          channel: data.channel,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('doctor tasks POST failed', { err });
    return NextResponse.json({ error: 'Unable to notify doctor.' }, { status: 500 });
  }
}
