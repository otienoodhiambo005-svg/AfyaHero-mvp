/**
 * Prescription Reminder Bot Service
 * Handles prescription reminders via WhatsApp and USSD
 */

import { prisma } from '@/lib/database';
import { whatsappBotService } from './whatsapp-bot';
import { botAuthService } from './bot-auth';
import logger from '@/lib/logger';

function getPrescriptionMedicationName(items: unknown): string {
  if (Array.isArray(items) && items.length > 0) {
    const firstItem = items[0] as Record<string, unknown>;
    return String(firstItem.medicationName || firstItem.name || firstItem.drug || 'Medication');
  }

  return 'Medication';
}

function getPrescriptionInstruction(items: unknown, key: 'dosage' | 'frequency'): string {
  if (Array.isArray(items) && items.length > 0) {
    const firstItem = items[0] as Record<string, unknown>;
    return String(firstItem[key] || 'As prescribed');
  }

  return 'As prescribed';
}

export interface PrescriptionReminderRequest {
  patientId: string;
  prescriptionId: string;
  phoneNumber: string;
}

export class PrescriptionBotService {
  /**
   * Send prescription reminder via WhatsApp
   */
  async sendReminder(prescriptionId: string): Promise<boolean> {
    try {
      // Get prescription with patient details
      const prescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
        include: {
          patient: true,
        },
      });

      if (!prescription || !prescription.patient.phone) {
        logger.warn('[PrescriptionBot] Prescription or patient phone not found', {
          prescriptionId,
        });
        return false;
      }

      // Send reminder
      const success = await whatsappBotService.sendPrescriptionReminder(
        prescription.patient.phone,
        prescription.patient.name,
        getPrescriptionMedicationName(prescription.items),
        getPrescriptionInstruction(prescription.items, 'dosage'),
        getPrescriptionInstruction(prescription.items, 'frequency')
      );

      if (success) {
        logger.info('[PrescriptionBot] Reminder sent successfully', {
          prescriptionId,
          patientId: prescription.patientId,
          phoneNumber: prescription.patient.phone,
        });
      }

      return success;
    } catch (error) {
      logger.error('[PrescriptionBot] Error sending reminder', {
        prescriptionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * View prescriptions via WhatsApp
   */
  async viewPrescriptionsViaWhatsApp(phoneNumber: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required. Please provide your patient ID or phone number to proceed.'
        );
        return false;
      }

      // Fetch active prescriptions
      const prescriptions = await prisma.prescription.findMany({
        where: {
          patientId: session.patientId!,
          status: { in: ['pending', 'dispensing', 'partial', 'on-hold'] },
        },
        orderBy: {
          prescribedAt: 'desc',
        },
      });

      if (prescriptions.length === 0) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '💊 You have no active prescriptions.\n\nReply HELP for other commands.'
        );
        return true;
      }

      let message = '💊 Your Active Prescriptions:\n\n';

      for (const prescription of prescriptions) {
        message += `• ${getPrescriptionMedicationName(prescription.items)}\n`;
        message += `  Dosage: ${getPrescriptionInstruction(prescription.items, 'dosage')}\n`;
        message += `  Frequency: ${getPrescriptionInstruction(prescription.items, 'frequency')}\n`;
        message += `  Prescribed: ${prescription.prescribedAt.toLocaleDateString()}\n`;
        message += `  ID: ${prescription.id}\n\n`;
      }

      message += 'Reply REMINDERS to set up medication reminders.';

      await whatsappBotService.sendMessage(phoneNumber, message);

      logger.info('[PrescriptionBot] Prescriptions viewed via WhatsApp', {
        patientId: session.patientId,
        phoneNumber,
        count: prescriptions.length,
      });

      return true;
    } catch (error) {
      logger.error('[PrescriptionBot] Error viewing prescriptions via WhatsApp', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to retrieve prescriptions. Please try again later.'
      );

      return false;
    }
  }

  /**
   * Confirm medication taken via WhatsApp
   */
  async confirmMedicationTaken(phoneNumber: string, prescriptionId: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      // Verify prescription belongs to patient
      const prescription = await prisma.prescription.findFirst({
        where: {
          id: prescriptionId,
          patientId: session.patientId!,
          status: { in: ['pending', 'dispensing', 'partial', 'on-hold'] },
        },
      });

      if (!prescription) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Prescription not found or not active. Please check the prescription ID.'
        );
        return false;
      }

      // Record medication adherence
      await prisma.medicationAdherence.create({
        data: {
          prescriptionId,
          patientId: session.patientId!,
          takenAt: new Date(),
          status: 'TAKEN',
        },
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        `✅ Medication Recorded

Thank you for confirming you've taken ${getPrescriptionMedicationName(prescription.items)}. This has been recorded in your health records.

Continue taking your medication as prescribed. Reply HELP for other commands.`
      );

      logger.info('[PrescriptionBot] Medication confirmed via WhatsApp', {
        prescriptionId,
        patientId: session.patientId,
        phoneNumber,
      });

      return true;
    } catch (error) {
      logger.error('[PrescriptionBot] Error confirming medication taken', {
        phoneNumber,
        prescriptionId,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to record medication. Please try again or contact your healthcare provider.'
      );

      return false;
    }
  }

  /**
   * Set up medication reminders
   */
  async setupReminders(phoneNumber: string, prescriptionId: string, reminderTimes: string[]): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      // Verify prescription belongs to patient
      const prescription = await prisma.prescription.findFirst({
        where: {
          id: prescriptionId,
          patientId: session.patientId!,
          status: { in: ['pending', 'dispensing', 'partial', 'on-hold'] },
        },
      });

      if (!prescription) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Prescription not found or not active.'
        );
        return false;
      }

      // Delete existing reminders for this prescription
      await prisma.medicationReminder.deleteMany({
        where: { prescriptionId },
      });

      // Create new reminders
      for (const time of reminderTimes) {
        await prisma.medicationReminder.create({
          data: {
            prescriptionId,
            patientId: session.patientId!,
            reminderTime: time,
            phoneNumber: phoneNumber,
            active: true,
          },
        });
      }

      await whatsappBotService.sendMessage(
        phoneNumber,
        `✅ Reminders Set Up

You will receive medication reminders at: ${reminderTimes.join(', ')}\n\nReply STOP to disable reminders.`
      );

      logger.info('[PrescriptionBot] Reminders set up via WhatsApp', {
        prescriptionId,
        patientId: session.patientId,
        phoneNumber,
        reminderTimes,
      });

      return true;
    } catch (error) {
      logger.error('[PrescriptionBot] Error setting up reminders', {
        phoneNumber,
        prescriptionId,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to set up reminders. Please try again later.'
      );

      return false;
    }
  }

  /**
   * Disable medication reminders
   */
  async disableReminders(phoneNumber: string, prescriptionId?: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      // Delete reminders
      const where = prescriptionId
        ? { prescriptionId, patientId: session.patientId! }
        : { patientId: session.patientId! };

      await prisma.medicationReminder.deleteMany({ where });

      await whatsappBotService.sendMessage(
        phoneNumber,
        `✅ Reminders Disabled

${prescriptionId ? 'Reminders for this prescription have been disabled.' : 'All your medication reminders have been disabled.'}\n\nReply REMINDERS to set up new reminders.`
      );

      logger.info('[PrescriptionBot] Reminders disabled via WhatsApp', {
        patientId: session.patientId,
        phoneNumber,
        prescriptionId,
      });

      return true;
    } catch (error) {
      logger.error('[PrescriptionBot] Error disabling reminders', {
        phoneNumber,
        prescriptionId,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to disable reminders. Please try again later.'
      );

      return false;
    }
  }

  /**
   * Get medication adherence report
   */
  async getAdherenceReport(phoneNumber: string, days: number = 7): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get adherence records
      const adherenceRecords = await prisma.medicationAdherence.findMany({
        where: {
          patientId: session.patientId!,
          takenAt: {
            gte: startDate,
          },
        },
        include: {
          prescription: true,
        },
        orderBy: {
          takenAt: 'desc',
        },
      });

      // Calculate adherence rate
      const totalExpected = adherenceRecords.length; // This should be calculated based on prescription frequency
      const totalTaken = adherenceRecords.filter((r) => r.status === 'TAKEN').length;
      const adherenceRate = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 100;

      let message = `📊 Medication Adherence Report (Last ${days} days)\n\n`;
      message += `Adherence Rate: ${adherenceRate}%\n`;
      message += `Medications Taken: ${totalTaken}\n\n`;

      if (adherenceRecords.length > 0) {
        message += 'Recent Activity:\n';
        for (const record of adherenceRecords.slice(0, 5)) {
          message += `• ${getPrescriptionMedicationName(record.prescription.items)} - ${record.takenAt.toLocaleString()}\n`;
        }
      }

      await whatsappBotService.sendMessage(phoneNumber, message);

      logger.info('[PrescriptionBot] Adherence report sent via WhatsApp', {
        patientId: session.patientId,
        phoneNumber,
        days,
        adherenceRate,
      });

      return true;
    } catch (error) {
      logger.error('[PrescriptionBot] Error getting adherence report', {
        phoneNumber,
        days,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to retrieve adherence report. Please try again later.'
      );

      return false;
    }
  }
}

export const prescriptionBotService = new PrescriptionBotService();
