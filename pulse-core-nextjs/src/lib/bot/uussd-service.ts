/**
 * USSD Service for AfyaHero
 * Handles patient communication via USSD using Africa's Talking API
 */

import logger from '@/lib/logger';
import {
  findPatientByPhone,
  getActivePrescriptionsForPatient,
  getRecentLabResultsForPatient,
  getUpcomingAppointmentsForPatient,
} from '@/lib/bot/patient-portal-data';

export interface USSDRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

export interface USSDResponse {
  response: string;
  shouldClose: boolean;
}

export class USSDService {
  private apiKey: string;
  private username: string;

  constructor() {
    this.apiKey = process.env.AFRICAS_TALKING_API_KEY || '';
    this.username = process.env.AFRICAS_TALKING_USERNAME || '';
  }

  /**
   * Handle USSD request
   */
  async handleRequest(request: USSDRequest): Promise<USSDResponse> {
    try {
      logger.info('[USSD] Handling request', {
        sessionId: request.sessionId,
        phoneNumber: request.phoneNumber,
        text: request.text,
      });

      // Parse the text to determine current menu level
      if (request.text && !/^\d+(?:\*\d+)*$/.test(request.text)) {
        return this.showMainMenu();
      }

      const menuLevel = this.getMenuLevel(request.text);

      switch (menuLevel) {
        case 0:
          return this.showMainMenu();
        case 1:
          return this.handleMainMenuSelection(request.text);
        case 2:
          return await this.handleSecondLevelMenu(request.text, request.phoneNumber);
        case 3:
          return this.handleThirdLevelMenu(request.text);
        default:
          return this.showMainMenu();
      }
    } catch (error) {
      logger.error('[USSD] Error handling request', {
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        response: 'An error occurred. Please try again later.',
        shouldClose: true,
      };
    }
  }

  /**
   * Determine menu level based on text input
   */
  private getMenuLevel(text: string): number {
    if (!text) return 0;
    const parts = text.split('*');
    return parts.length;
  }

  /**
   * Show main menu
   */
  private showMainMenu(): USSDResponse {
    return {
      response: `CON Welcome to AfyaHero Hospital OS
1. Appointments
2. My Prescriptions
3. Lab Results
4. Medical Records
5. Hospital Info
6. Emergency`,
      shouldClose: false,
    };
  }

  /**
   * Handle main menu selection
   */
  private handleMainMenuSelection(text: string): USSDResponse {
    const selection = text.split('*').pop();

    switch (selection) {
      case '1':
        return this.showAppointmentsMenu();
      case '2':
        return this.showPrescriptionsMenu();
      case '3':
        return this.showLabResultsMenu();
      case '4':
        return this.showMedicalRecordsMenu();
      case '5':
        return this.showHospitalInfoMenu();
      case '6':
        return this.showEmergencyMenu();
      default:
        return {
          response: 'END Invalid selection. Please try again.',
          shouldClose: true,
        };
    }
  }

  /**
   * Show appointments menu
   */
  private showAppointmentsMenu(): USSDResponse {
    return {
      response: `CON Appointments
1. Book Appointment
2. View Upcoming
3. Cancel Appointment
0. Back to Main Menu`,
      shouldClose: false,
    };
  }

  /**
   * Show prescriptions menu
   */
  private showPrescriptionsMenu(): USSDResponse {
    return {
      response: `CON My Prescriptions
1. View Active Prescriptions
2. Medication Reminders
0. Back to Main Menu`,
      shouldClose: false,
    };
  }

  /**
   * Show lab results menu
   */
  private showLabResultsMenu(): USSDResponse {
    return {
      response: `CON Lab Results
1. View Recent Results
2. Result History
0. Back to Main Menu`,
      shouldClose: false,
    };
  }

  /**
   * Show medical records menu
   */
  private showMedicalRecordsMenu(): USSDResponse {
    return {
      response: `CON Medical Records
1. View Summary
2. Request Records
0. Back to Main Menu`,
      shouldClose: false,
    };
  }

  /**
   * Show hospital info menu
   */
  private showHospitalInfoMenu(): USSDResponse {
    return {
      response: `CON Hospital Information
1. Departments
2. Doctors
3. Services
4. Location & Hours
0. Back to Main Menu`,
      shouldClose: false,
    };
  }

  /**
   * Show emergency menu
   */
  private showEmergencyMenu(): USSDResponse {
    return {
      response: `CON Emergency Services
1. Call Emergency
2. Report Emergency
0. Back to Main Menu`,
      shouldClose: false,
    };
  }

  /**
   * Handle second level menu selection
   */
  private async handleSecondLevelMenu(text: string, phoneNumber: string): Promise<USSDResponse> {
    const parts = text.split('*');
    const mainSelection = parts[0];
    const subSelection = parts[1];

    // Appointments submenu
    if (mainSelection === '1') {
      switch (subSelection) {
        case '1':
          return this.handleBookAppointment();
        case '2':
          return this.handleViewAppointments(phoneNumber);
        case '3':
          return this.handleCancelAppointment();
        case '0':
          return this.showMainMenu();
        default:
          return {
            response: 'END Invalid selection.',
            shouldClose: true,
          };
      }
    }

    // Prescriptions submenu
    if (mainSelection === '2') {
      switch (subSelection) {
        case '1':
          return this.handleViewPrescriptions(phoneNumber);
        case '2':
          return this.handleMedicationReminders();
        case '0':
          return this.showMainMenu();
        default:
          return {
            response: 'END Invalid selection.',
            shouldClose: true,
          };
      }
    }

    // Lab results submenu
    if (mainSelection === '3') {
      switch (subSelection) {
        case '1':
          return this.handleViewRecentResults(phoneNumber);
        case '2':
          return this.handleResultHistory();
        case '0':
          return this.showMainMenu();
        default:
          return {
            response: 'END Invalid selection.',
            shouldClose: true,
          };
      }
    }

    // Medical records submenu
    if (mainSelection === '4') {
      switch (subSelection) {
        case '1':
          return this.handleViewMedicalSummary(phoneNumber);
        case '2':
          return this.handleRequestRecords();
        case '0':
          return this.showMainMenu();
        default:
          return {
            response: 'END Invalid selection.',
            shouldClose: true,
          };
      }
    }

    // Hospital info submenu
    if (mainSelection === '5') {
      switch (subSelection) {
        case '1':
          return this.handleDepartments();
        case '2':
          return this.handleDoctors();
        case '3':
          return this.handleServices();
        case '4':
          return this.handleLocationHours();
        case '0':
          return this.showMainMenu();
        default:
          return {
            response: 'END Invalid selection.',
            shouldClose: true,
          };
      }
    }

    // Emergency submenu
    if (mainSelection === '6') {
      switch (subSelection) {
        case '1':
          return this.handleCallEmergency();
        case '2':
          return this.handleReportEmergency();
        case '0':
          return this.showMainMenu();
        default:
          return {
            response: 'END Invalid selection.',
            shouldClose: true,
          };
      }
    }

    return {
      response: 'END Invalid selection.',
      shouldClose: true,
    };
  }

  /**
   * Handle third level menu selection
   */
  private handleThirdLevelMenu(text: string): USSDResponse {
    const parts = text.split('*');
    const mainSelection = parts[0];
    const subSelection = parts[1];
    const thirdSelection = parts[2];

    // Handle specific third-level interactions
    if (mainSelection === '1' && subSelection === '1') {
      // Book appointment flow
      return this.handleAppointmentBooking(thirdSelection);
    }

    return {
      response: 'END Thank you for using AfyaHero.',
      shouldClose: true,
    };
  }

  /**
   * Handle book appointment
   */
  private handleBookAppointment(): USSDResponse {
    return {
      response: `CON Book Appointment
Please enter your Patient ID:`,
      shouldClose: false,
    };
  }

  /**
   * Handle view appointments
   */
  private async handleViewAppointments(phoneNumber: string): Promise<USSDResponse> {
    const patient = await findPatientByPhone(phoneNumber);
    if (!patient) {
      return {
        response: 'END No patient record found for this number. Visit reception to register.',
        shouldClose: true,
      };
    }
    const appointments = await getUpcomingAppointmentsForPatient(patient.id, patient.hospitalId);
    if (appointments.length === 0) {
      return {
        response: 'END You have no upcoming appointments. Dial again and choose 1 to book.',
        shouldClose: true,
      };
    }
    const lines = appointments.map((a) => `• ${a.date} - ${a.notes}`).join('\n');
    return {
      response: `END Your Upcoming Appointments:\n${lines}`,
      shouldClose: true,
    };
  }

  /**
   * Handle cancel appointment
   */
  private handleCancelAppointment(): USSDResponse {
    return {
      response: `CON Cancel Appointment
Enter Appointment ID to cancel:`,
      shouldClose: false,
    };
  }

  /**
   * Handle view prescriptions
   */
  private async handleViewPrescriptions(phoneNumber: string): Promise<USSDResponse> {
    const patient = await findPatientByPhone(phoneNumber);
    if (!patient) {
      return {
        response: 'END No patient record found for this number.',
        shouldClose: true,
      };
    }
    const prescriptions = await getActivePrescriptionsForPatient(patient.id, patient.hospitalId);
    if (prescriptions.length === 0) {
      return {
        response: 'END No active prescriptions on file.',
        shouldClose: true,
      };
    }
    const lines = prescriptions.map((p) => `• ${p.summary}`).join('\n');
    return {
      response: `END Your Active Prescriptions:\n${lines}`,
      shouldClose: true,
    };
  }

  /**
   * Handle medication reminders
   */
  private handleMedicationReminders(): USSDResponse {
    return {
      response: `CON Set Medication Reminder
Enter medication name:`,
      shouldClose: false,
    };
  }

  /**
   * Handle view recent results
   */
  private async handleViewRecentResults(phoneNumber: string): Promise<USSDResponse> {
    const patient = await findPatientByPhone(phoneNumber);
    if (!patient) {
      return {
        response: 'END No patient record found for this number.',
        shouldClose: true,
      };
    }
    const results = await getRecentLabResultsForPatient(patient.id, patient.hospitalId);
    if (results.length === 0) {
      return {
        response: 'END No recent lab results on file.',
        shouldClose: true,
      };
    }
    const lines = results.map((r) => `• ${r.test} (${r.date}) - ${r.flag}`).join('\n');
    return {
      response: `END Recent Lab Results:\n${lines}`,
      shouldClose: true,
    };
  }

  /**
   * Handle result history
   */
  private handleResultHistory(): USSDResponse {
    return {
      response: `CON Enter date range (DD/MM/YYYY-DD/MM/YYYY):`,
      shouldClose: false,
    };
  }

  /**
   * Handle view medical summary
   */
  private async handleViewMedicalSummary(phoneNumber: string): Promise<USSDResponse> {
    const patient = await findPatientByPhone(phoneNumber);
    if (!patient) {
      return {
        response: 'END No patient record found for this number.',
        shouldClose: true,
      };
    }
    const allergyText =
      patient.allergies.length > 0 ? patient.allergies.join(', ') : 'None recorded';
    return {
      response: `END Medical Summary:
Name: ${patient.name}
Blood Type: ${patient.bloodGroup ?? 'Not recorded'}
Allergies: ${allergyText}`,
      shouldClose: true,
    };
  }

  /**
   * Handle request records
   */
  private handleRequestRecords(): USSDResponse {
    return {
      response: `CON Request Medical Records
Enter your email address to receive records:`,
      shouldClose: false,
    };
  }

  /**
   * Handle departments
   */
  private handleDepartments(): USSDResponse {
    return {
      response: `END Hospital Departments:
• Cardiology
• Pediatrics
• Orthopedics
• Radiology
• Laboratory
• Pharmacy

Reply 0 for main menu.`,
      shouldClose: true,
    };
  }

  /**
   * Handle doctors
   */
  private handleDoctors(): USSDResponse {
    return {
      response: `END Available Doctors:
• Dr. Smith - General Medicine
• Dr. Johnson - Cardiology
• Dr. Williams - Pediatrics

Reply 0 for main menu.`,
      shouldClose: true,
    };
  }

  /**
   * Handle services
   */
  private handleServices(): USSDResponse {
    return {
      response: `END Hospital Services:
• 24/7 Emergency
• Laboratory Tests
• X-Ray & Imaging
• Pharmacy
• Inpatient Care

Reply 0 for main menu.`,
      shouldClose: true,
    };
  }

  /**
   * Handle location and hours
   */
  private handleLocationHours(): USSDResponse {
    return {
      response: `END Location & Hours:
📍 123 Hospital Street, Nairobi
📞 +254 700 000 000
⏰ Mon-Fri: 8AM-8PM
🏥 Emergency: 24/7

Reply 0 for main menu.`,
      shouldClose: true,
    };
  }

  /**
   * Handle call emergency
   */
  private handleCallEmergency(): USSDResponse {
    return {
      response: `END Emergency Services
🚨 Ambulance: Dial 911
🏥 Hospital Emergency: +254 700 000 000
👮 Police: 999

Stay on the line for assistance.`,
      shouldClose: true,
    };
  }

  /**
   * Handle report emergency
   */
  private handleReportEmergency(): USSDResponse {
    return {
      response: `CON Report Emergency
Describe your emergency briefly:`,
      shouldClose: false,
    };
  }

  /**
   * Handle appointment booking flow
   */
  private handleAppointmentBooking(patientId: string): USSDResponse {
    // TODO: Validate patient ID and continue booking flow
    return {
      response: `CON Patient ID: ${patientId}
Enter preferred date (DD/MM/YYYY):`,
      shouldClose: false,
    };
  }
}

export const ussdService = new USSDService();
