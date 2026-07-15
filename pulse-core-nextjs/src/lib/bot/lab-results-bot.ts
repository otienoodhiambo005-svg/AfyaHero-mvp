/**
 * Lab Results Notification Bot Service
 * Handles lab results notifications via WhatsApp and USSD
 */

import { prisma } from '@/lib/database';
import { whatsappBotService } from './whatsapp-bot';
import { botAuthService } from './bot-auth';
import logger from '@/lib/logger';

export interface LabResultNotificationRequest {
  patientId: string;
  labRequestId: string;
  phoneNumber: string;
}

export class LabResultsBotService {
  /**
   * Send lab results notification via WhatsApp
   */
  async sendNotification(labRequestId: string): Promise<boolean> {
    try {
      // Get lab request with patient details
      const labRequest = await prisma.labRequest.findUnique({
        where: { id: labRequestId },
        include: {
          patient: true,
        },
      });

      if (!labRequest || !labRequest.patient.phone) {
        logger.warn('[LabResultsBot] Lab request or patient phone not found', {
          labRequestId,
        });
        return false;
      }

      if (!labRequest.results) {
        logger.warn('[LabResultsBot] No lab results found', {
          labRequestId,
        });
        return false;
      }

      // Get the most recent result
      const isNormal = !labRequest.abnormal && !labRequest.critical;
      const testName = labRequest.testName || 'Lab Test';
      const result = JSON.stringify(labRequest.results);

      // Send notification
      const success = await whatsappBotService.sendLabResultsNotification(
        labRequest.patient.phone,
        labRequest.patient.name,
        testName,
        result,
        isNormal
      );

      if (success) {
        logger.info('[LabResultsBot] Notification sent successfully', {
          labRequestId,
          patientId: labRequest.patientId,
          phoneNumber: labRequest.patient.phone,
        });
      }

      return success;
    } catch (error) {
      logger.error('[LabResultsBot] Error sending notification', {
        labRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * View lab results via WhatsApp
   */
  async viewLabResultsViaWhatsApp(phoneNumber: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required. Please provide your patient ID or phone number to proceed.'
        );
        return false;
      }

      // Fetch recent lab results
      const labRequests = await prisma.labRequest.findMany({
        where: {
          patientId: session.patientId!,
          results: { not: undefined },
        },
        orderBy: {
          orderedAt: 'desc',
        },
        take: 5,
      });

      if (labRequests.length === 0) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '🔬 You have no lab results available.\n\nReply HELP for other commands.'
        );
        return true;
      }

      let message = '🔬 Your Recent Lab Results:\n\n';

      for (const labRequest of labRequests) {
        const testName = labRequest.testName || 'Lab Test';
        const result = labRequest.results ? JSON.stringify(labRequest.results) : 'Pending';
        const isNormal = !labRequest.abnormal && !labRequest.critical;
        const status = isNormal ? '✅ Normal' : '⚠️ Requires Attention';
        const date = (labRequest.completedAt || labRequest.orderedAt).toLocaleDateString();

        message += `• ${testName}\n`;
        message += `  Date: ${date}\n`;
        message += `  Result: ${result}\n`;
        message += `  Status: ${status}\n`;
        message += `  ID: ${labRequest.id}\n\n`;
      }

      message += 'Reply DETAILS <ID> for full report.';

      await whatsappBotService.sendMessage(phoneNumber, message);

      logger.info('[LabResultsBot] Lab results viewed via WhatsApp', {
        patientId: session.patientId,
        phoneNumber,
        count: labRequests.length,
      });

      return true;
    } catch (error) {
      logger.error('[LabResultsBot] Error viewing lab results via WhatsApp', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to retrieve lab results. Please try again later.'
      );

      return false;
    }
  }

  /**
   * Send lab result details via WhatsApp
   */
  async sendLabResultDetails(phoneNumber: string, labRequestId: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      // Get lab request with full details
      const labRequest = await prisma.labRequest.findFirst({
        where: {
          id: labRequestId,
          patientId: session.patientId!,
        },
        include: {
          patient: true,
        },
      });

      if (!labRequest) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Lab request not found. Please check the lab request ID.'
        );
        return false;
      }

      if (!labRequest.results) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ No lab results available for this request.'
        );
        return false;
      }

      let message = `🔬 Lab Result Details\n\n`;
      message += `Patient: ${labRequest.patient.name}\n`;
      message += `Test Type: ${labRequest.testName || 'Lab Test'}\n`;
      message += `Request Date: ${labRequest.orderedAt.toLocaleDateString()}\n`;
      message += `Result Date: ${labRequest.completedAt?.toLocaleDateString() || 'Pending'}\n\n`;
      message += `Result: ${JSON.stringify(labRequest.results)}\n`;
      message += `Status: ${!labRequest.abnormal && !labRequest.critical ? '✅ Normal' : '⚠️ Requires Attention'}\n\n`;

      if (labRequest.notes) {
        message += `Notes: ${labRequest.notes}\n\n`;
      }

      message += `For complete details including doctor's notes and recommendations, please log in to the AfyaHero portal at https://portal.afyahero.com\n\n`;
      message += `If you have concerns about your results, please contact your healthcare provider.`;

      await whatsappBotService.sendMessage(phoneNumber, message);

      logger.info('[LabResultsBot] Lab result details sent via WhatsApp', {
        labRequestId,
        patientId: session.patientId,
        phoneNumber,
      });

      return true;
    } catch (error) {
      logger.error('[LabResultsBot] Error sending lab result details', {
        phoneNumber,
        labRequestId,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to retrieve lab result details. Please try again or contact the hospital.'
      );

      return false;
    }
  }

  /**
   * Get lab results history via WhatsApp
   */
  async getLabResultsHistory(phoneNumber: string, startDate?: Date, endDate?: Date): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      const where: {
        patientId: string;
        results: { not: undefined };
        orderedAt?: { gte: Date; lte: Date };
      } = {
        patientId: session.patientId!,
        results: { not: undefined },
      };

      if (startDate && endDate) {
        where.orderedAt = {
          gte: startDate,
          lte: endDate,
        };
      }

      // Fetch lab results history
      const labRequests = await prisma.labRequest.findMany({
        where,
        orderBy: {
          orderedAt: 'desc',
        },
        take: 10,
      });

      if (labRequests.length === 0) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '🔬 No lab results found for the specified period.'
        );
        return true;
      }

      let message = `🔬 Lab Results History\n\n`;

      for (const labRequest of labRequests) {
        const testName = labRequest.testName || 'Lab Test';
        const result = labRequest.results ? JSON.stringify(labRequest.results) : 'Pending';
        const isNormal = !labRequest.abnormal && !labRequest.critical;
        const date = labRequest.orderedAt.toLocaleDateString();

        message += `• ${date} - ${testName}: ${result} (${isNormal ? 'Normal' : 'Abnormal'})\n`;
      }

      await whatsappBotService.sendMessage(phoneNumber, message);

      logger.info('[LabResultsBot] Lab results history sent via WhatsApp', {
        patientId: session.patientId,
        phoneNumber,
        count: labRequests.length,
      });

      return true;
    } catch (error) {
      logger.error('[LabResultsBot] Error getting lab results history', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to retrieve lab results history. Please try again later.'
      );

      return false;
    }
  }
}

export const labResultsBotService = new LabResultsBotService();

