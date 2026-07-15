/**
 * POST /api/patients/register-with-triage
 * 
 * Enhanced patient registration with AI-powered triage.
 * This endpoint:
 * 1. Registers a new patient (or finds existing by phone/SHIF number)
 * 2. Collects vital signs and chief complaint
 * 3. Calls AI Triage Service to determine priority
 * 4. Creates a hospital queue entry with triage priority
 * 5. Returns patient info, triage results, and queue position
 * 
 * This is the primary entry point for the patient flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { triageService } from '@/lib/microservices-client';
import logger from '@/lib/logger';
import { sanitizeError } from '@/lib/api-response';

const VALID_CONSCIOUSNESS_LEVELS = ['alert', 'voice', 'pain', 'unresponsive'] as const;

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit - registration is high priority
    const rateLimit = await enforceApiRateLimit(request, 'api:patients:register');
    if (rateLimit) return rateLimit;

    // Auth + session (reception can register patients)
    const session = requireRoles(request, ['reception', 'medical', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      firstName?: unknown;
      lastName?: unknown;
      dateOfBirth?: unknown;
      gender?: unknown;
      phoneNumber?: unknown;
      email?: unknown;
      address?: unknown;
      shifNumber?: unknown;
      // Triage information
      chiefComplaint?: unknown;
      vitals?: unknown;
      isPregnant?: unknown;
      gestationalWeeks?: unknown;
      mechanismOfInjury?: unknown;
      painScore?: unknown;
      knownAllergies?: unknown;
      currentMedications?: unknown;
      knownMedicalConditions?: unknown;
      // Optional: existing patient ID if re-registering
      patientId?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate patient demographics
    if (!body.firstName || typeof body.firstName !== 'string' || body.firstName.length < 2) {
      return NextResponse.json(
        { error: 'firstName is required (minimum 2 characters)' },
        { status: 400 },
      );
    }

    if (!body.lastName || typeof body.lastName !== 'string' || body.lastName.length < 2) {
      return NextResponse.json(
        { error: 'lastName is required (minimum 2 characters)' },
        { status: 400 },
      );
    }

    if (!body.dateOfBirth || typeof body.dateOfBirth !== 'string') {
      return NextResponse.json({ error: 'dateOfBirth is required (YYYY-MM-DD)' }, { status: 400 });
    }

    const dateOfBirth = new Date(body.dateOfBirth);
    if (isNaN(dateOfBirth.getTime())) {
      return NextResponse.json({ error: 'Invalid dateOfBirth format' }, { status: 400 });
    }

    if (body.gender !== 'MALE' && body.gender !== 'FEMALE' && body.gender !== 'OTHER') {
      return NextResponse.json(
        { error: "gender must be 'MALE', 'FEMALE', or 'OTHER'" },
        { status: 400 },
      );
    }

    if (!body.phoneNumber || typeof body.phoneNumber !== 'string' || body.phoneNumber.length < 10) {
      return NextResponse.json(
        { error: 'phoneNumber is required (minimum 10 characters)' },
        { status: 400 },
      );
    }

    // Validate triage information
    if (!body.chiefComplaint || typeof body.chiefComplaint !== 'string' || body.chiefComplaint.length < 5) {
      return NextResponse.json(
        { error: 'chiefComplaint is required (minimum 5 characters)' },
        { status: 400 },
      );
    }

    // Parse optional fields
    const email = typeof body.email === 'string' && body.email.length > 0 ? body.email : undefined;
    const address = typeof body.address === 'string' ? body.address : undefined;
    const shifNumber = typeof body.shifNumber === 'string' ? body.shifNumber : undefined;
    const isPregnant = body.isPregnant === true;
    const gestationalWeeks = typeof body.gestationalWeeks === 'number' ? body.gestationalWeeks : undefined;
    const mechanismOfInjury = typeof body.mechanismOfInjury === 'string' ? body.mechanismOfInjury : undefined;
    const painScore = typeof body.painScore === 'number' ? body.painScore : undefined;
    const knownAllergies = Array.isArray(body.knownAllergies) ? body.knownAllergies : undefined;
    const currentMedications = Array.isArray(body.currentMedications) ? body.currentMedications : undefined;
    const knownMedicalConditions = Array.isArray(body.knownMedicalConditions) ? body.knownMedicalConditions : undefined;

    // Validate vitals
    if (!body.vitals || typeof body.vitals !== 'object') {
      return NextResponse.json({ error: 'vitals object is required' }, { status: 400 });
    }

    const vitalsObj = body.vitals as Record<string, unknown>;
    const vitals: Record<string, number | string> = {};

    if (typeof vitalsObj.temperature === 'number') vitals.temperature = vitalsObj.temperature;
    if (typeof vitalsObj.heartRate === 'number') vitals.heart_rate = vitalsObj.heartRate;
    if (typeof vitalsObj.respiratoryRate === 'number') vitals.respiratory_rate = vitalsObj.respiratoryRate;
    if (typeof vitalsObj.systolicBP === 'number') vitals.blood_pressure_systolic = vitalsObj.systolicBP;
    if (typeof vitalsObj.diastolicBP === 'number') vitals.blood_pressure_diastolic = vitalsObj.diastolicBP;
    if (typeof vitalsObj.spO2 === 'number') vitals.oxygen_saturation = vitalsObj.spO2;

    if (typeof vitalsObj.consciousness === 'string') {
      if (VALID_CONSCIOUSNESS_LEVELS.includes(vitalsObj.consciousness as any)) {
        vitals.consciousness = vitalsObj.consciousness;
      } else {
        return NextResponse.json(
          { error: `Invalid consciousness level. Valid values: ${VALID_CONSCIOUSNESS_LEVELS.join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Calculate patient age
    const today = new Date();
    const patientAge = today.getFullYear() - dateOfBirth.getFullYear();

    const patientName = `${body.firstName} ${body.lastName}`;

    // Step 1: Register or find patient
    let patient;
    if (body.patientId && typeof body.patientId === 'string') {
      // Use existing patient
      patient = await prisma.patient.findUnique({
        where: { id: body.patientId },
      });

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }

      if (patient.hospitalId !== session.hospitalId) {
        return NextResponse.json({ error: 'Patient belongs to another hospital' }, { status: 403 });
      }
    } else {
      // Check if patient exists by phone number
      patient = await prisma.patient.findFirst({
        where: {
          phone: body.phoneNumber as string,
          hospitalId: session.hospitalId,
        },
      });

      if (!patient) {
        // Create new patient
        patient = await prisma.patient.create({
          data: {
            name: patientName,
            dob: dateOfBirth,
            gender: body.gender as 'MALE' | 'FEMALE' | 'OTHER',
            phone: body.phoneNumber as string,
            shifNumber,
            hospitalId: session.hospitalId,
          },
        });
      }
    }

    // Step 2: Call AI Triage Service
    let triageResult;
    try {
      triageResult = await triageService.analyze({
        patient_id: patient.id,
        age: patientAge,
        gender: patient.gender === 'MALE' ? 'male' as const : 'female' as const,
        chief_complaint: body.chiefComplaint as string,
        vitals,
        is_pregnant: isPregnant,
        gestational_weeks: gestationalWeeks,
      });
    } catch (error) {
      logger.error('[Patient Registration] Triage service error', {
        error: error instanceof Error ? error.message : String(error),
        patientId: patient.id,
      });

      // Fallback: assign default priority if triage fails
      triageResult = {
        priority: 3,
        priority_label: 'Urgent (Yellow)',
        confidence: 0.5,
        reasoning: 'Triage service unavailable - assigned default priority',
        recommended_actions: ['Manual triage recommended'],
      };
    }

    // Step 3: Create hospital queue entry
    const priorityMap: Record<number, string> = {
      1: 'critical',
      2: 'urgent',
      3: 'normal',
      4: 'normal',
      5: 'normal',
    };
    const latestQueueEntry = await prisma.hospitalQueue.findFirst({
      where: { hospitalId: session.hospitalId },
      orderBy: { tokenNumber: 'desc' },
      select: { tokenNumber: true },
    });

    const queueEntry = await prisma.hospitalQueue.create({
      data: {
        patientId: patient.id,
        patientName: patient.name,
        hospitalId: session.hospitalId,
        tokenNumber: (latestQueueEntry?.tokenNumber || 0) + 1,
        priority: priorityMap[triageResult.priority] || 'normal',
        triageSeverity: triageResult.priority === 1 ? 'high' : triageResult.priority === 2 ? 'medium' : 'low',
        chiefComplaint: body.chiefComplaint as string,
        status: 'waiting',
        arrivedAt: new Date(),
      },
    });

    // Step 4: Store clinical vitals
    if (Object.keys(vitals).length > 0) {
      await prisma.clinicalVital.create({
        data: {
          patientId: patient.id,
          hospitalId: session.hospitalId,
          recordedBy: session.id,
          tempC: typeof vitals.temperature === 'number' ? vitals.temperature : undefined,
          heartRate: typeof vitals.heart_rate === 'number' ? vitals.heart_rate : undefined,
          respRate: typeof vitals.respiratory_rate === 'number' ? vitals.respiratory_rate : undefined,
          spo2: typeof vitals.oxygen_saturation === 'number' ? vitals.oxygen_saturation : undefined,
          bloodPressure: typeof vitals.blood_pressure_systolic === 'number' && typeof vitals.blood_pressure_diastolic === 'number' ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : undefined,
          recordedAt: new Date(),
        },
      });
    }

    // Step 5: Create reception check-in record
    await prisma.receptionCheckin.create({
      data: {
        patientId: patient.id,
        patientName: patient.name,
        phone: patient.phone,
        hospitalId: session.hospitalId,
        checkedInBy: session.id,
        checkedInAt: new Date(),
        visitReason: body.chiefComplaint as string,
        priority: triageResult.priority === 1 ? 'critical' : triageResult.priority === 2 ? 'urgent' : 'normal',
        visitType: 'OPD',
      },
    });

    // Step 6: Escalate if urgent
    if (triageResult.priority === 1) {
      await prisma.serviceEscalation.create({
        data: {
          hospitalId: session.hospitalId,
          title: `Emergency triage escalation for ${patient.name}`,
          body: `Triage priority 1: ${triageResult.reasoning}`,
          serviceArea: 'emergency',
          status: 'open',
          createdById: session.id,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        patient: {
          id: patient.id,
          firstName: patient.name.split(' ')[0] || patient.name,
          lastName: patient.name.split(' ').slice(1).join(' '),
          phoneNumber: patient.phone,
          shifNumber: patient.shifNumber,
        },
        triage: {
          priority: triageResult.priority,
          priorityLabel: triageResult.priority_label,
          confidence: triageResult.confidence,
          reasoning: triageResult.reasoning,
          recommendedActions: triageResult.recommended_actions,
          pewsScore: triageResult.pews_score,
          moewsScore: triageResult.moews_score,
        },
        queue: {
          id: queueEntry.id,
          tokenNumber: queueEntry.tokenNumber,
          priority: queueEntry.priority,
          status: queueEntry.status,
        },
        requiresImmediateAttention: triageResult.priority === 1,
      },
      { status: 201 },
    );
  } catch (err) {
    const { error } = sanitizeError(err, {
      context: '[Patient Registration with Triage]',
      clientMessage: 'Internal server error',
    });
    return NextResponse.json({ error }, { status: 500 });
  }
}


