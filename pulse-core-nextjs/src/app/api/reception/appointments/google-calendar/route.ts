import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { prisma } from '@/lib/database';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:reception:appointments:google-calendar',
      roles: ['reception', 'admin', 'medical'],
    });
    if (guard.response) return guard.response;

    const hospitalId = guard.session?.hospitalId;
    if (!hospitalId) {
      return NextResponse.json(
        { error: 'Authenticated session is not linked to a hospital' },
        { status: 403 },
      );
    }
    
    const body = await request.json();
    const { patientId, patientName, phone, appointmentDate, department, notes } = body;
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const env = process.env;
    
    // Initialize Google Calendar Auth
    const auth = new JWT({
      email: env.GOOGLE_CLIENT_EMAIL,
      key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Create calendar event
    const event = await calendar.events.insert({
      calendarId: env.GOOGLE_CALENDAR_ID ?? 'primary',
      requestBody: {
        summary: `Appointment: ${patientName} - ${department}`,
        description: `Patient: ${patientName}\nPhone: ${phone}\nDepartment: ${department}\nNotes: ${notes || ''}`,
        start: {
          dateTime: new Date(appointmentDate).toISOString(),
          timeZone: 'Africa/Nairobi',
        },
        end: {
          dateTime: new Date(new Date(appointmentDate).getTime() + 30 * 60000).toISOString(),
          timeZone: 'Africa/Nairobi',
        },
        attendees: [
          { email: 'reception@afyahero.local', displayName: 'Hospital Reception' },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'sms', minutes: 60 },
            { method: 'email', minutes: 1440 },
          ],
        },
      },
    });

    // Save appointment to database
    const appointment = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId,
        type: department,
        appointmentDate: new Date(appointmentDate),
        status: 'scheduled',
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      appointment,
      calendarEvent: event.data,
    });

  } catch (error) {
    logger.error('Google Calendar error', { error: error instanceof Error ? error.message : String(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: 'Failed to create appointment', ...(isProduction ? {} : { details: isProduction ? undefined : error instanceof Error ? error.message : 'Unknown error' }) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:reception:appointments:google-calendar',
      roles: ['reception', 'admin', 'medical'],
      requireTrustedOrigin: false,
    });
    if (guard.response) return guard.response;
    
    const env = process.env;
    
    const auth = new JWT({
      email: env.GOOGLE_CLIENT_EMAIL,
      key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    const response = await calendar.events.list({
      calendarId: env.GOOGLE_CALENDAR_ID ?? 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return NextResponse.json({
      success: true,
      events: response.data.items,
    });

  } catch (error) {
    logger.error('Calendar sync error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to sync calendar' },
      { status: 500 }
    );
  }
}

