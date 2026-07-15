/**
 * Appointment Booking via Bot
 * Handles appointment booking through WhatsApp and USSD
 */

import { prisma } from '@/lib/database';
import { whatsappBotService } from './whatsapp-bot';
import { botAuthService } from './bot-auth';
import logger from '@/lib/logger';

export interface AppointmentBookingRequest {
  patientId: string;
  doctorId?: string;
  appointmentDate: Date;
  appointmentTime: string;
  reason?: string;
  phoneNumber: string;
}

export class AppointmentBotService {
  /**
   * Book appointment via WhatsApp
   */
  async bookViaWhatsApp(request: AppointmentBookingRequest): Promise<boolean> {
    try {
      // Authenticate patient
      const session = await botAuthService.authenticatePatient(request.phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          request.phoneNumber,
          '⚠️ Authentication required. Please provide your patient ID or phone number to proceed.'
        );
        return false;
      }

      // Check if doctor exists
      if (request.doctorId) {
        const doctor = await prisma.profile.findUnique({
          where: { id: request.doctorId },
        });

        if (!doctor || doctor.role !== 'medical') {
          await whatsappBotService.sendMessage(
            request.phoneNumber,
            '⚠️ Invalid doctor selected. Please choose from available doctors.'
          );
          return false;
        }
      }

      const patient = await prisma.patient.findUnique({
        where: { id: session.patientId! },
        select: { hospitalId: true },
      });

      if (!patient?.hospitalId) {
        await whatsappBotService.sendMessage(
          request.phoneNumber,
          '⚠️ Patient facility not found. Please contact the hospital directly.'
        );
        return false;
      }

      // Create appointment
      const appointment = await prisma.appointment.create({
        data: {
          hospitalId: patient.hospitalId,
          patientId: session.patientId!,
          practitionerId: request.doctorId,
          appointmentDate: request.appointmentDate,
          scheduledAt: new Date(`${request.appointmentDate.toISOString().slice(0, 10)}T${request.appointmentTime}:00`),
          status: 'Pending',
          notes: request.reason || 'General consultation',
        },
      });

      // Send confirmation
      const doctor = request.doctorId
        ? await prisma.profile.findUnique({
            where: { id: request.doctorId },
            select: { fullName: true, title: true },
          })
        : null;

      const doctorName = doctor
        ? `${doctor.title || ''} ${doctor.fullName}`.trim()
        : 'Your assigned doctor';

      await whatsappBotService.sendMessage(
        request.phoneNumber,
        `✅ Appointment Confirmed

Appointment ID: ${appointment.id}
Date: ${request.appointmentDate.toLocaleDateString()}
Time: ${request.appointmentTime}
Doctor: ${doctorName}

You will receive a reminder 24 hours before your appointment.
Reply CANCEL ${appointment.id} to cancel this appointment.`
      );

      logger.info('[AppointmentBot] Appointment booked via WhatsApp', {
        appointmentId: appointment.id,
        patientId: session.patientId,
        phoneNumber: request.phoneNumber,
      });

      return true;
    } catch (error) {
      logger.error('[AppointmentBot] Error booking appointment via WhatsApp', {
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        request.phoneNumber,
        '⚠️ Failed to book appointment. Please try again or contact the hospital directly.'
      );

      return false;
    }
  }

  /**
   * View appointments via WhatsApp
   */
  async viewAppointmentsViaWhatsApp(phoneNumber: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required. Please provide your patient ID or phone number to proceed.'
        );
        return false;
      }

      // Fetch upcoming appointments
      const appointments = await prisma.appointment.findMany({
        where: {
          patientId: session.patientId!,
          appointmentDate: {
            gte: new Date(),
          },
          status: {
            in: ['Pending', 'Confirmed'],
          },
        },
        orderBy: {
          appointmentDate: 'asc',
        },
        take: 5,
      });

      if (appointments.length === 0) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '📅 You have no upcoming appointments.\n\nReply BOOK to schedule a new appointment.'
        );
        return true;
      }

      let message = '📅 Your Upcoming Appointments:\n\n';

      for (const appointment of appointments) {
        const doctorName = appointment.practitionerId
          ? `Practitioner ${appointment.practitionerId}`
          : 'TBD';
        const specialty = appointment.type || '';

        message += `• ${appointment.appointmentDate.toLocaleDateString()} at ${appointment.scheduledAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'TBD'}\n`;
        message += `  ${doctorName}${specialty ? ` (${specialty})` : ''}\n`;
        message += `  ID: ${appointment.id}\n\n`;
      }

      message += 'Reply BOOK to schedule a new appointment.';
      message += '\nReply CANCEL <ID> to cancel an appointment.';

      await whatsappBotService.sendMessage(phoneNumber, message);

      logger.info('[AppointmentBot] Appointments viewed via WhatsApp', {
        patientId: session.patientId,
        phoneNumber,
        count: appointments.length,
      });

      return true;
    } catch (error) {
      logger.error('[AppointmentBot] Error viewing appointments via WhatsApp', {
        phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to retrieve appointments. Please try again later.'
      );

      return false;
    }
  }

  /**
   * Cancel appointment via WhatsApp
   */
  async cancelViaWhatsApp(phoneNumber: string, appointmentId: string): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      // Find appointment
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          patientId: session.patientId!,
          status: {
            in: ['Pending', 'Confirmed'],
          },
        },
      });

      if (!appointment) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Appointment not found or cannot be cancelled. Please check the appointment ID.'
        );
        return false;
      }

      // Cancel appointment
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'Cancelled' },
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        `✅ Appointment Cancelled

Appointment ID: ${appointmentId}
Date: ${appointment.appointmentDate.toLocaleDateString()}

Reply BOOK to schedule a new appointment.`
      );

      logger.info('[AppointmentBot] Appointment cancelled via WhatsApp', {
        appointmentId,
        patientId: session.patientId,
        phoneNumber,
      });

      return true;
    } catch (error) {
      logger.error('[AppointmentBot] Error cancelling appointment via WhatsApp', {
        phoneNumber,
        appointmentId,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to cancel appointment. Please try again or contact the hospital.'
      );

      return false;
    }
  }

  /**
   * Get available doctors for booking
   */
  async getAvailableDoctors(): Promise<Array<{ id: string; name: string; specialty: string }>> {
    try {
      const doctors = await prisma.profile.findMany({
        where: {
          role: 'medical',
          status: 'active',
        },
        select: {
          id: true,
          fullName: true,
          title: true,
          department: true,
        },
      });

      return doctors.map((doctor) => ({
        id: doctor.id,
        name: `${doctor.title || ''} ${doctor.fullName}`.trim(),
        specialty: doctor.department || 'General Medicine',
      }));
    } catch (error) {
      logger.error('[AppointmentBot] Error getting available doctors', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get available time slots for a date
   */
  async getAvailableTimeSlots(date: Date, doctorId?: string): Promise<string[]> {
    // Standard time slots: 9:00 AM to 5:00 PM, every 30 minutes
    const timeSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00',
    ];

    try {
      // Get existing appointments for the date
      const existingAppointments = await prisma.appointment.findMany({
        where: {
          appointmentDate: date,
          status: {
            in: ['Pending', 'Confirmed'],
          },
          ...(doctorId && { practitionerId: doctorId }),
        },
        select: {
          scheduledAt: true,
        },
      });

      const bookedTimes = new Set(existingAppointments.map((a) => a.scheduledAt?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })).filter(Boolean));

      // Filter out booked time slots
      return timeSlots.filter((slot) => !bookedTimes.has(slot));
    } catch (error) {
      logger.error('[AppointmentBot] Error getting available time slots', {
        date,
        doctorId,
        error: error instanceof Error ? error.message : String(error),
      });
      return timeSlots; // Return all slots on error
    }
  }

  /**
   * Reschedule appointment via WhatsApp
   */
  async rescheduleViaWhatsApp(
    phoneNumber: string,
    appointmentId: string,
    newDate: Date,
    newTime: string
  ): Promise<boolean> {
    try {
      const session = await botAuthService.authenticatePatient(phoneNumber);
      if (!session) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Authentication required.'
        );
        return false;
      }

      // Find appointment
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          patientId: session.patientId!,
          status: {
            in: ['Pending', 'Confirmed'],
          },
        },
      });

      if (!appointment) {
        await whatsappBotService.sendMessage(
          phoneNumber,
          '⚠️ Appointment not found or cannot be rescheduled.'
        );
        return false;
      }

      // Update appointment
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          appointmentDate: newDate,
          scheduledAt: new Date(`${newDate.toISOString().slice(0, 10)}T${newTime}:00`),
        },
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        `✅ Appointment Rescheduled

Appointment ID: ${appointmentId}
New Date: ${newDate.toLocaleDateString()}
New Time: ${newTime}

You will receive a reminder 24 hours before your appointment.`
      );

      logger.info('[AppointmentBot] Appointment rescheduled via WhatsApp', {
        appointmentId,
        patientId: session.patientId,
        phoneNumber,
        newDate,
        newTime,
      });

      return true;
    } catch (error) {
      logger.error('[AppointmentBot] Error rescheduling appointment via WhatsApp', {
        phoneNumber,
        appointmentId,
        error: error instanceof Error ? error.message : String(error),
      });

      await whatsappBotService.sendMessage(
        phoneNumber,
        '⚠️ Failed to reschedule appointment. Please try again or contact the hospital.'
      );

      return false;
    }
  }
}

export const appointmentBotService = new AppointmentBotService();

