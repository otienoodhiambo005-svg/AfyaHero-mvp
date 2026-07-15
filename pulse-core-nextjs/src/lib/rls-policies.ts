/**
 * Row Level Security (RLS) Policies for AfyaHero Health
 * 
 * Provides database-level security policies to enforce RBAC at the data access level
 */

import { prisma } from '@/lib/database';
import { canPerformAction } from '@/lib/rbac';
import type { PortalRole } from '@/types';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RLSContext {
  userId: string;
  userRole: PortalRole;
  hospitalId: string;
}

// ─── RLS Policy Service ───────────────────────────────────────────────────────

class RLSPolicyService {
  /**
   * Check if user can access patient data
   */
  async canAccessPatient(
    patientId: string,
    context: RLSContext
  ): Promise<boolean> {
    // Get patient's hospital
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { hospitalId: true },
    });

    if (!patient) {
      return false; // Patient not found
    }

    // Check if user belongs to same hospital
    if (patient.hospitalId !== context.hospitalId) {
      return false;
    }

    // Check role-based permissions
    const accessCheck = canPerformAction({
      userRole: context.userRole,
      userHospitalId: context.hospitalId,
      targetHospitalId: patient.hospitalId,
      resourceType: 'patient',
      action: 'read',
    });

    return accessCheck.allowed;
  }

  /**
   * Check if user can access appointment data
   */
  async canAccessAppointment(
    appointmentId: string,
    context: RLSContext
  ): Promise<boolean> {
    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { hospitalId: true } },
      },
    });

    if (!appointment) {
      return false; // Appointment not found
    }

    // Check if user belongs to same hospital
    if (appointment.patient.hospitalId !== context.hospitalId) {
      return false;
    }

    // Check role-based permissions
    const accessCheck = canPerformAction({
      userRole: context.userRole,
      userHospitalId: context.hospitalId,
      targetHospitalId: appointment.patient.hospitalId,
      resourceType: 'appointment',
      action: 'read',
    });

    return accessCheck.allowed;
  }

  /**
   * Check if user can access medical records
   */
  async canAccessMedicalRecord(
    medicalRecordId: string,
    context: RLSContext
  ): Promise<boolean> {
    // Get medical record details
    const medicalRecord = await prisma.consultation.findUnique({
      where: { id: medicalRecordId },
      include: {
        patient: { select: { hospitalId: true } },
      },
    });

    if (!medicalRecord) {
      return false; // Record not found
    }

    // Check if user belongs to same hospital
    if (medicalRecord.patient.hospitalId !== context.hospitalId) {
      return false;
    }

    // Check role-based permissions
    const accessCheck = canPerformAction({
      userRole: context.userRole,
      userHospitalId: context.hospitalId,
      targetHospitalId: medicalRecord.patient.hospitalId,
      resourceType: 'medicalRecord',
      action: 'read',
    });

    return accessCheck.allowed;
  }

  /**
   * Check if user can access billing data
   */
  async canAccessBilling(
    billingId: string,
    context: RLSContext
  ): Promise<boolean> {
    // Get billing details
    const billing = await prisma.paymentTransaction.findUnique({
      where: { id: billingId },
      select: { hospitalId: true },
    });

    if (!billing) {
      return false; // Billing not found
    }

    // Check if user belongs to same hospital
    if (billing.hospitalId !== context.hospitalId) {
      return false;
    }

    // Check role-based permissions
    const accessCheck = canPerformAction({
      userRole: context.userRole,
      userHospitalId: context.hospitalId,
      targetHospitalId: billing.hospitalId,
      resourceType: 'billing',
      action: 'read',
    });

    return accessCheck.allowed;
  }

  /**
   * Check if user can access pharmacy data
   */
  async canAccessPharmacy(
    pharmacyId: string,
    context: RLSContext
  ): Promise<boolean> {
    // Get pharmacy details
    const pharmacy = await prisma.prescription.findUnique({
      where: { id: pharmacyId },
      include: {
        patient: { select: { hospitalId: true } },
      },
    });

    if (!pharmacy) {
      return false; // Pharmacy not found
    }

    // Check if user belongs to same hospital
    if (pharmacy.patient.hospitalId !== context.hospitalId) {
      return false;
    }

    // Check role-based permissions
    const accessCheck = canPerformAction({
      userRole: context.userRole,
      userHospitalId: context.hospitalId,
      targetHospitalId: pharmacy.patient.hospitalId,
      resourceType: 'pharmacy',
      action: 'read',
    });

    return accessCheck.allowed;
  }

  /**
   * Check if user can access lab data
   */
  async canAccessLab(
    labId: string,
    context: RLSContext
  ): Promise<boolean> {
    // Get lab details
    const lab = await prisma.labRequest.findUnique({
      where: { id: labId },
      include: {
        patient: { select: { hospitalId: true } },
      },
    });

    if (!lab) {
      return false; // Lab not found
    }

    // Check if user belongs to same hospital
    if (lab.patient.hospitalId !== context.hospitalId) {
      return false;
    }

    // Check role-based permissions
    const accessCheck = canPerformAction({
      userRole: context.userRole,
      userHospitalId: context.hospitalId,
      targetHospitalId: lab.patient.hospitalId,
      resourceType: 'lab',
      action: 'read',
    });

    return accessCheck.allowed;
  }

  /**
   * Generate RLS policies for database
   */
  async generateDatabasePolicies(): Promise<string[]> {
    const policies: string[] = [];

    // Patient policies
    policies.push(`
      CREATE POLICY "Patients can view their own data" ON patient
      FOR SELECT USING (id = current_setting('app.current_user_id')::text);
      
      CREATE POLICY "Medical staff can view patients in their hospital" ON patient
      FOR SELECT USING (
        hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text IN ('medical', 'lab', 'pharmacy', 'admin')
      );
      
      CREATE POLICY "Reception can view patients in their hospital" ON patient
      FOR SELECT USING (
        hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text = 'reception'
      );
    `);

    // Appointment policies
    policies.push(`
      CREATE POLICY "Patients can view their own appointments" ON appointment
      FOR SELECT USING (patient_id = current_setting('app.current_user_id')::text);
      
      CREATE POLICY "Medical staff can view appointments in their hospital" ON appointment
      FOR SELECT USING (
        patient_hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text IN ('medical', 'lab', 'pharmacy', 'admin')
      );
    `);

    // Medical record policies
    policies.push(`
      CREATE POLICY "Patients can view their own medical records" ON medical_record
      FOR SELECT USING (patient_id = current_setting('app.current_user_id')::text);
      
      CREATE POLICY "Medical staff can view medical records in their hospital" ON medical_record
      FOR SELECT USING (
        patient_hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text IN ('medical', 'admin')
      );
    `);

    // Billing policies
    policies.push(`
      CREATE POLICY "Patients can view their own billing" ON billing
      FOR SELECT USING (patient_id = current_setting('app.current_user_id')::text);
      
      CREATE POLICY "Admin can view billing in their hospital" ON billing
      FOR SELECT USING (
        patient_hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text = 'admin'
      );
    `);

    // Pharmacy policies
    policies.push(`
      CREATE POLICY "Patients can view their own pharmacy data" ON pharmacy
      FOR SELECT USING (patient_id = current_setting('app.current_user_id')::text);
      
      CREATE POLICY "Pharmacy staff can view pharmacy data in their hospital" ON pharmacy
      FOR SELECT USING (
        patient_hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text IN ('pharmacy', 'admin')
      );
    `);

    // Lab policies
    policies.push(`
      CREATE POLICY "Patients can view their own lab results" ON lab
      FOR SELECT USING (patient_id = current_setting('app.current_user_id')::text);
      
      CREATE POLICY "Lab staff can view lab data in their hospital" ON lab
      FOR SELECT USING (
        patient_hospital_id = current_setting('app.current_hospital_id')::text AND
        current_setting('app.current_user_role')::text IN ('lab', 'admin')
      );
    `);

    return policies;
  }

  /**
   * Apply RLS policies to database
   */
  async applyPolicies(): Promise<void> {
    try {
      const policies = await this.generateDatabasePolicies();
      await prisma.$connect();

      for (const policy of policies) {
        await prisma.$executeRawUnsafe(policy);
      }

      await prisma.$disconnect();
    } catch (error) {
      logger.error('Failed to apply RLS policies', { error });
    }
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const rlsPolicyService = new RLSPolicyService();
export default rlsPolicyService;
export { RLSPolicyService };