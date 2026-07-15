/**
 * Google Meet Conference API
 * 
 * POST /api/teleconsultation/meetings — Create a new Google Meet conference
 * GET  /api/teleconsultation/meetings?id=xxx — Get meeting details
 * 
 * Uses Google Calendar API with conferenceData to programmatically create
 * Google Meet conferences. Requires Google Workspace service account.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, enforceApiRateLimit, readJsonBody, requireString } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import type { TeleconsultAppointment } from '@prisma/client';
import logger from '@/lib/logger';

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'primary';

async function getGoogleAccessToken(): Promise<string | null> {
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: GOOGLE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        await crypto.subtle.importKey(
          'pkcs8',
          pemToDer(GOOGLE_PRIVATE_KEY),
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['sign'],
        ),
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ).toString('base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const tokenData = await tokenRes.json();
    return tokenData.access_token ?? null;
  } catch (err) {
    logger.error('Failed to get Google access token', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:teleconsult:meetings');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(req);
  if (!session || (session.role !== 'medical' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;

  const patientName = requireString(body.patientName, 'patientName', { min: 2, max: 160 });
  if (patientName instanceof NextResponse) return patientName;

  const _appointmentId = (body.appointmentId as string) ?? null;
  const description = (body.description as string) ?? `Teleconsultation with ${patientName}`;
  const startTime = (body.startTime as string) ?? new Date().toISOString();
  const endTime = (body.endTime as string) ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const accessToken = await getGoogleAccessToken();

  if (!accessToken) {
    // Fallback: generate a Meet-style code without API
    const meetCode = generateMeetCode();
    const meeting = await prisma.teleconsultAppointment.create({
      data: {
        hospitalId: session.hospitalId,
        appointmentCode: meetCode,
        patientName,
        appointmentTime: new Date(startTime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        mode: 'Video',
        clinicianName: session.name,
        status: 'Scheduled',
      },
    });

    return NextResponse.json({
      meetingCode: meetCode,
      meetUrl: `https://meet.google.com/${meetCode}`,
      appointmentId: meeting.id,
      provider: 'fallback',
      message: 'Google Workspace not configured. Share this code manually in Google Meet.',
    }, { status: 201 });
  }

  try {
    const calendarRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?conferenceDataVersion=1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `Teleconsultation — ${patientName}`,
          description,
          start: { dateTime: startTime, timeZone: 'Africa/Nairobi' },
          end: { dateTime: endTime, timeZone: 'Africa/Nairobi' },
          conferenceData: {
            createRequest: {
              requestId: `afyahero-${Date.now()}-${session.id.slice(0, 8)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      },
    );

    if (!calendarRes.ok) {
      const errText = await calendarRes.text();
      logger.error('Google Calendar API error', { status: calendarRes.status, body: errText });
      return NextResponse.json({ error: 'Failed to create Google Meet conference', details: errText }, { status: 502 });
    }

    const event = await calendarRes.json();
    const meetUrl = event.hangoutLink ?? event.conferenceData?.entryPoints?.[0]?.uri;
    const meetCode = meetUrl?.split('/').pop() ?? '';

    const meeting = await prisma.teleconsultAppointment.create({
      data: {
        hospitalId: session.hospitalId,
        appointmentCode: meetCode,
        patientName,
        appointmentTime: new Date(startTime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        mode: 'Video',
        clinicianName: session.name,
        status: 'Scheduled',
      },
    });

    return NextResponse.json({
      meetingCode: meetCode,
      meetUrl,
      calendarEventId: event.id,
      appointmentId: meeting.id,
      provider: 'google-workspace',
    }, { status: 201 });
  } catch (err) {
    logger.error('Meeting creation failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const meeting = await prisma.teleconsultAppointment.findFirst({
      where: { id, hospitalId: session.hospitalId },
    });
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    return NextResponse.json({
      meetingCode: meeting.appointmentCode,
      meetUrl: `https://meet.google.com/${meeting.appointmentCode}`,
      patientName: meeting.patientName,
      clinicianName: meeting.clinicianName,
      status: meeting.status,
    });
  }

  const meetings = await prisma.teleconsultAppointment.findMany({
    where: { hospitalId: session.hospitalId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({
    items: meetings.map((m: TeleconsultAppointment) => ({
      id: m.id,
      meetingCode: m.appointmentCode,
      meetUrl: `https://meet.google.com/${m.appointmentCode}`,
      patientName: m.patientName,
      clinicianName: m.clinicianName,
      status: m.status,
      createdAt: m.createdAt,
    })),
  });
}

function generateMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const r = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${r(3)}-${r(4)}-${r(3)}`;
}
