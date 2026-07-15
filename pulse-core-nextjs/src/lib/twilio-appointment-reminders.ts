/**
 * Twilio Appointment Reminder Service
 * 
 * Scheduled task to send appointment reminders via SMS/WhatsApp/Voice
 * Integrates with the existing appointment system
 */

import { prisma } from '@/lib/database';
import { sendTwilioMessage, initiateTwilioCall, generateAppointmentReminderTwiml, isTwilioConfigured } from '@/lib/twilio-service';
import logger from '@/lib/logger';

export interface ReminderConfig {
  hoursBeforeAppointment: number;
  channels: ('sms' | 'whatsapp' | 'voice')[];
  maxRetries: number;
  retryIntervalMinutes: number;
}

const DEFAULT_CONFIG: ReminderConfig = {
  hoursBeforeAppointment: 24,
  channels: ['whatsapp', 'sms'],
  maxRetries: 3,
  retryIntervalMinutes: 60,
};

/**
 * Send appointment reminders for the next X hours
 */
export async function sendAppointmentReminders(
  hoursAhead: number = 24,
  config: ReminderConfig = DEFAULT_CONFIG
): Promise<{ sent: number; failed: number }> {
  if (!isTwilioConfigured()) {
    logger.warn('Twilio not configured, skipping appointment reminders');
    return { sent: 0, failed: 0 };
  }

  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Fetch appointments needing reminder
  const appointments = await prisma.$queryRaw<Array<{
    id: string;
    patient_id: string;
    appointment_date: Date;
    department: string;
    patient_phone: string;
    patient_name: string;
    reminder_sent: boolean;
  }>>`
    SELECT 
      a.id, a.patient_id, a.appointment_date, a.department,
      p.phone as patient_phone, p.name as patient_name,
      a.reminder_sent
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    WHERE 
      a.appointment_date BETWEEN ${now} AND ${targetTime}
      AND a.status = 'scheduled'
      AND (a.reminder_sent IS NULL OR a.reminder_sent = false)
    ORDER BY a.appointment_date ASC
    LIMIT 100
  `;

  let sent = 0;
  let failed = 0;

  for (const apt of appointments) {
    try {
      const appointmentTime = formatAppointmentTime(apt.appointment_date);
      
      // Try each configured channel
      for (const channel of config.channels) {
        try {
          if (channel === 'voice') {
            // For voice, generate TwiML and initiate call
            const twiml = generateAppointmentReminderTwiml(
              apt.patient_name,
              appointmentTime,
              apt.department
            );
            
            await initiateTwilioCall({
              to: apt.patient_phone,
              twiml,
              callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/callback`,
            });
          } else {
            // For SMS/WhatsApp, send message
            const message = generateReminderMessage(apt.patient_name, appointmentTime, apt.department, channel);
            
            await sendTwilioMessage({
              to: apt.patient_phone,
              message,
              channel,
            });
          }
          
          // Mark reminder as sent
          await prisma.$executeRaw`
            UPDATE appointments 
            SET reminder_sent = true, reminder_sent_at = NOW()
            WHERE id = ${apt.id}
          `;
          
          sent++;
          break; // Successfully sent, move to next appointment
        } catch (channelError) {
          logger.error(`Failed to send ${channel} reminder`, { 
            appointmentId: apt.id, 
            error: channelError 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to process appointment reminder', { 
        appointmentId: apt.id, 
        error 
      });
      failed++;
    }
  }

  logger.info('Appointment reminders completed', { sent, failed, total: appointments.length });
  return { sent, failed };
}

/**
 * Generate reminder message based on channel and language preference
 */
function generateReminderMessage(
  patientName: string,
  appointmentTime: string,
  department: string,
  channel: 'sms' | 'whatsapp'
): string {
  // Messages in English, Swahili, and Sheng
  const messages = {
    sms: {
      en: `AfyaHero Reminder: Hi ${patientName}, your appointment at ${department} is tomorrow at ${appointmentTime}. Please arrive 15 mins early. Reply HELP for assistance.`,
      sw: `AfyaHero: Mgonjwa ${patientName}, umepewa appointment kesho saa ${appointmentTime} katika ${department}. Tuje mapema. Andika HELP kwa msaada.`,
      sheng: `AfyaHero: ${patientName}, your appointment tomorrow ${appointmentTime} at ${department}. Arrive early.`,
    },
    whatsapp: {
      en: `*AfyaHero Appointment Reminder*\n\nHi ${patientName}!\n\nYour appointment at *${department}* is tomorrow at *${appointmentTime}*.\n\nPlease arrive 15 minutes early.\n\nReply with:\n- *C* to confirm\n- *R* to reschedule\n- *X* to cancel`,
      sw: `*AfyaHero - Kumbusho la Appointment*\n\nMgonjwa ${patientName}!\n\nAppointment yako katika *${department}* ni kesho Saa *${appointmentTime}*.\n\nTafadhali fika mapema dakika 15.\n\nAndika:\n- *C* kuthibitisha\n- *R* kuhamisha\n- *X* kughairi`,
      sheng: `*AfyaHero Reminder*\n\n${patientName}, appointment yako tomorrow ${appointmentTime} at ${department}.\n\nArrive early 15 mins.\n\nReply:\n- C for confirm\n- R for reschedule`,
    },
  };

  // Return appropriate message based on channel
  // Default to English for SMS
  return messages[channel]?.en || messages.sms.en;
}

/**
 * Format appointment time for display
 */
function formatAppointmentTime(date: Date): string {
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Handle reminder response (confirm/reschedule/cancel)
 */
export async function handleReminderResponse(
  phone: string,
  response: string
): Promise<string> {
  // Find the most recent unconfirmed appointment
  const appointments = await prisma.$queryRaw<Array<{
    id: string;
    patient_id: string;
  }>>`
    SELECT id, patient_id 
    FROM appointments 
    WHERE patient_id IN (SELECT id FROM patients WHERE phone = ${phone})
    AND appointment_date > NOW()
    AND status = 'scheduled'
    ORDER BY appointment_date ASC
    LIMIT 1
  `;

  if (appointments.length === 0) {
    return 'No upcoming appointments found.';
  }

  const apt = appointments[0];
  const upperResponse = response.toUpperCase().trim();

  switch (upperResponse) {
    case 'C':
    case 'CONFIRM':
      await prisma.$executeRaw`
        UPDATE appointments 
        SET status = 'confirmed', updated_at = NOW()
        WHERE id = ${apt.id}
      `;
      return 'Appointment confirmed. Thank you!';

    case 'R':
    case 'RESCHEDULE':
      // In production, this would initiate a reschedule flow
      return 'To reschedule, please call our reception or visit the facility. Our team will assist you.';

    case 'X':
    case 'CANCEL':
      await prisma.$executeRaw`
        UPDATE appointments 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${apt.id}
      `;
      return 'Appointment cancelled. To book again, please call reception.';

    default:
      return 'Invalid response. Reply C to confirm, R to reschedule, or X to cancel.';
  }
}

/**
 * Send discharge notification
 */
export async function sendDischargeNotification(
  patientId: string,
  summary?: string
): Promise<boolean> {
  if (!isTwilioConfigured()) {
    return false;
  }

  const patient = await prisma.$queryRaw`
    SELECT name, phone 
    FROM patients 
    WHERE id = ${patientId}
    LIMIT 1
  ` as Array<{ name: string; phone: string; }>;

  if (patient.length === 0 || !patient[0].phone) {
    return false;
  }

  const message = summary
    ? `AfyaHero: You have been discharged. Summary: ${summary}. Attend follow-up as advised. Get well soon!`
    : 'AfyaHero: You have been discharged. Please attend follow-up appointments as advised. Get well soon!';

  const result = await sendTwilioMessage({
    to: patient[0].phone,
    message,
    channel: 'sms',
  });

  return result.success;
}

/**
 * Send lab results notification
 */
export async function sendLabResultsNotification(
  patientId: string,
  testName: string
): Promise<boolean> {
  if (!isTwilioConfigured()) {
    return false;
  }

  const patient = await prisma.$queryRaw`
    SELECT name, phone 
    FROM patients 
    WHERE id = ${patientId}
    LIMIT 1
  ` as Array<{ name: string; phone: string; }>;

  if (patient.length === 0 || !patient[0].phone) {
    return false;
  }

  const message = `AfyaHero: Hi ${patient[0].name}, your ${testName} results are ready. Please collect from reception or view on the patient portal.`;

  const result = await sendTwilioMessage({
    to: patient[0].phone,
    message,
    channel: 'whatsapp',
  });

  return result.success;
}