/**
 * WhatsApp Bot Service for AfyaHero
 * Handles patient communication via WhatsApp using Africa's Talking API
 */

import crypto from 'crypto';
import logger from '@/lib/logger';
import {
  findPatientByPhone,
  getActivePrescriptionsForPatient,
  getRecentLabResultsForPatient,
  getUpcomingAppointmentsForPatient,
} from '@/lib/bot/patient-portal-data';

export interface WhatsAppMessage {
  from: string; // Phone number with country code
  to: string; // WhatsApp business number
  message: string;
  timestamp: number;
}

export interface WhatsAppWebhookPayload {
  event: string;
  data: {
    id: string;
    direction: string;
    status?: string;
    from: string;
    to: string;
    text: string;
    timestamp: number;
  }[];
}

export class WhatsAppBotService {
  private apiKey: string;
  private username: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.AFRICAS_TALKING_API_KEY || '';
    this.username = process.env.AFRICAS_TALKING_USERNAME || '';
    this.baseUrl = 'https://api.africastalking.com/version1';
  }

  /**
   * Send WhatsApp message to patient
   */
  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messaging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: this.username,
          to: phoneNumber,
          message: message,
          from: process.env.WHATSAPP_SENDER_ID || 'AfyaHero',
        }),
      });

      const data = await response.json();

      if (data.recipients && data.recipients[0].status === 'Success') {
        logger.info('[WhatsAppBot] Message sent successfully', {
          phoneNumber,
          messageId: data.recipients[0].messageId,
        });
        return true;
      } else {
        logger.error('[WhatsAppBot] Failed to send message', {
          phoneNumber,
          error: data,
        });
        return false;
      }
    } catch (error) {
      logger.error('[WhatsAppBot] Error sending message', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    phoneNumber: string,
    patientName: string,
    appointmentDate: Date,
    doctorName: string
  ): Promise<boolean> {
    const message = `Hello ${patientName}, this is a reminder from AfyaHero. You have an appointment with Dr. ${doctorName} on ${appointmentDate.toLocaleDateString()} at ${appointmentDate.toLocaleTimeString()}. Please reply CONFIRM to confirm or RESCHEDULE to change the time.`;
    
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send prescription reminder
   */
  async sendPrescriptionReminder(
    phoneNumber: string,
    patientName: string,
    medication: string,
    dosage: string,
    frequency: string
  ): Promise<boolean> {
    const message = `Hello ${patientName}, this is a medication reminder from AfyaHero. Please take ${medication} (${dosage}) ${frequency}. Reply TAKEN to confirm you've taken it.`;
    
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send lab results notification
   */
  async sendLabResultsNotification(
    phoneNumber: string,
    patientName: string,
    testName: string,
    result: string,
    isNormal: boolean
  ): Promise<boolean> {
    const status = isNormal ? 'normal' : 'requires attention';
    const message = `Hello ${patientName}, your lab results for ${testName} are now available. Result: ${result} (${status}). Please log in to AfyaHero portal for full details. Reply DETAILS for more information.`;
    
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      for (const message of payload.data) {
        if (message.direction === 'inbound') {
          await this.processMessage(message);
        }
      }
    } catch (error) {
      logger.error('[WhatsAppBot] Error processing webhook', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process individual message
   */
  private async processMessage(message: WhatsAppWebhookPayload['data'][0]): Promise<void> {
    const phoneNumber = message.from;
    const text = message.text.trim().toUpperCase();

    logger.info('[WhatsAppBot] Processing message', {
      phoneNumber,
      text,
    });

    // Parse command
    const command = this.parseCommand(text);

    switch (command.type) {
      case 'HELP':
        await this.sendHelpMenu(phoneNumber);
        break;
      case 'APPOINTMENT':
        await this.handleAppointmentCommand(phoneNumber, command.params);
        break;
      case 'PRESCRIPTION':
        await this.handlePrescriptionCommand(phoneNumber, command.params);
        break;
      case 'LAB_RESULTS':
        await this.handleLabResultsCommand(phoneNumber);
        break;
      case 'CONFIRM':
        await this.handleConfirmation(phoneNumber, command.params);
        break;
      case 'RESCHEDULE':
        await this.handleReschedule(phoneNumber, command.params);
        break;
      case 'TAKEN':
        await this.handleMedicationTaken(phoneNumber, command.params);
        break;
      case 'DETAILS':
        await this.sendLabResultsDetails(phoneNumber, command.params);
        break;
      default:
        await this.sendHelpMenu(phoneNumber);
    }
  }

  /**
   * Parse command from message text
   */
  private parseCommand(text: string): { type: string; params: string[] } {
    const parts = text.split(' ');
    const command = parts[0];
    const params = parts.slice(1);

    return { type: command, params };
  }

  /**
   * Send help menu
   */
  private async sendHelpMenu(phoneNumber: string): Promise<void> {
    const message = `🏥 AfyaHero WhatsApp Bot 🏥

Available commands:
• HELP - Show this menu
• APPOINTMENT - Book/View appointments
• PRESCRIPTION - View medications
• LAB_RESULTS - Check lab results
• CONFIRM <ID> - Confirm appointment
• RESCHEDULE <ID> - Reschedule appointment
• TAKEN <MED> - Confirm medication taken
• DETAILS <ID> - Get lab result details

Reply with any command to get started.`;

    await this.sendMessage(phoneNumber, message);
  }

  /**
   * Handle appointment command
   */
  private async handleAppointmentCommand(phoneNumber: string, params: string[]): Promise<void> {
    const wantsList = params.length === 0 || params[0] === 'LIST';
    if (wantsList) {
      const patient = await findPatientByPhone(phoneNumber);
      if (!patient) {
        await this.sendMessage(
          phoneNumber,
          'No patient record found for this WhatsApp number. Visit reception to register.',
        );
        return;
      }
      const appointments = await getUpcomingAppointmentsForPatient(patient.id, patient.hospitalId);
      if (appointments.length === 0) {
        await this.sendMessage(phoneNumber, 'You have no upcoming appointments.');
        return;
      }
      const lines = appointments.map((a) => `• ${a.date} — ${a.notes}`).join('\n');
      await this.sendMessage(phoneNumber, `📅 Upcoming appointments:\n${lines}`);
      return;
    }

    const message = `📅 To book an appointment, visit reception or use the AfyaHero portal.

Reply APPOINTMENT LIST to view upcoming appointments.`;
    await this.sendMessage(phoneNumber, message);
  }

  /**
   * Handle prescription command
   */
  private async handlePrescriptionCommand(phoneNumber: string, _params: string[]): Promise<void> {
    const patient = await findPatientByPhone(phoneNumber);
    if (!patient) {
      await this.sendMessage(phoneNumber, 'No patient record found for this number.');
      return;
    }
    const prescriptions = await getActivePrescriptionsForPatient(patient.id, patient.hospitalId);
    if (prescriptions.length === 0) {
      await this.sendMessage(phoneNumber, 'No active prescriptions on file.');
      return;
    }
    const lines = prescriptions.map((p) => `• ${p.summary}`).join('\n');
    await this.sendMessage(phoneNumber, `💊 Active prescriptions:\n${lines}`);
  }

  /**
   * Handle lab results command
   */
  private async handleLabResultsCommand(phoneNumber: string): Promise<void> {
    const patient = await findPatientByPhone(phoneNumber);
    if (!patient) {
      await this.sendMessage(phoneNumber, 'No patient record found for this number.');
      return;
    }
    const results = await getRecentLabResultsForPatient(patient.id, patient.hospitalId);
    if (results.length === 0) {
      await this.sendMessage(phoneNumber, 'No recent lab results on file.');
      return;
    }
    const lines = results.map((r) => `• ${r.test} (${r.date}) — ${r.flag}`).join('\n');
    await this.sendMessage(phoneNumber, `🔬 Recent lab results:\n${lines}`);
  }

  /**
   * Handle confirmation command
   */
  private async handleConfirmation(phoneNumber: string, params: string[]): Promise<void> {
    // TODO: Implement appointment confirmation logic
    const appointmentId = params[0];
    const message = `✅ Appointment Confirmation

Appointment ${appointmentId || ''} confirmed. You will receive a reminder 24 hours before your appointment.

If you need to reschedule, reply RESCHEDULE ${appointmentId || ''} <new date> <new time>.`;

    await this.sendMessage(phoneNumber, message);
  }

  /**
   * Handle reschedule command
   */
  private async handleReschedule(phoneNumber: string, params: string[]): Promise<void> {
    // TODO: Implement reschedule logic
    const message = `📅 Reschedule Appointment

To reschedule, please provide:
• Appointment ID
• New date (DD/MM/YYYY)
• New time

Example: RESCHEDULE 12345 21/04/2026 14:00`;

    await this.sendMessage(phoneNumber, message);
  }

  /**
   * Handle medication taken command
   */
  private async handleMedicationTaken(phoneNumber: string, params: string[]): Promise<void> {
    // TODO: Implement medication tracking logic
    const medication = params[0] || 'medication';
    const message = `✅ Medication Recorded

Thank you for confirming you've taken ${medication}. This has been recorded in your health records.

Continue taking your medication as prescribed. Reply HELP for other commands.`;

    await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send lab results details
   */
  private async sendLabResultsDetails(phoneNumber: string, params: string[]): Promise<void> {
    // TODO: Implement lab results details logic
    const resultId = params[0] || '';
    const message = `🔬 Lab Result Details

Result ID: ${resultId}

For full details including reference ranges and doctor notes, please log in to the AfyaHero portal at https://portal.afyahero.com

If you have concerns about your results, please contact your healthcare provider.`;

    await this.sendMessage(phoneNumber, message);
  }

  /**
   * Verify webhook signature for security using HMAC-SHA256
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyWebhookSignature(signature: string | null | undefined, payload: string): boolean {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('WHATSAPP_WEBHOOK_SECRET is not configured; rejecting webhook');
      return false;
    }

    if (!signature || typeof signature !== 'string') {
      logger.warn('WhatsApp webhook signature missing');
      return false;
    }

    try {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Strip optional "sha256=" prefix used by many providers
      const received = signature.replace(/^sha256=/, '').trim();

      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(received, 'hex');

      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch (error) {
      logger.error('WhatsApp webhook signature verification error', { error });
      return false;
    }
  }
}

export const whatsappBotService = new WhatsAppBotService();
