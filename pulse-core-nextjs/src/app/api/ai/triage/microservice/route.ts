/**
 * POST /api/ai/triage/microservice
 * 
 * AI-powered triage endpoint using the AI Triage Microservice.
 * This is an alternative to the local implementation that calls the standalone service.
 * 
 * Request body: Same as /api/ai/triage
 * Response: Same as /api/ai/triage
 * 
 * Use this when:
 * - The microservice is deployed and running
 * - You want to offload AI processing to a dedicated service
 * - You need to scale triage independently
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { triageService } from '@/lib/microservices-client';
import { logAIInteraction } from '@/lib/ai-audit';
import logger from '@/lib/logger';

// Valid consciousness levels
const VALID_CONSCIOUSNESS_LEVELS = ['alert', 'voice', 'pain', 'unresponsive'] as const;

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:triage');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      patientAge?: unknown;
      patientGender?: unknown;
      isPregnant?: unknown;
      gestationalWeeks?: unknown;
      chiefComplaint?: unknown;
      historyOfPresentIllness?: unknown;
      vitals?: unknown;
      mechanismOfInjury?: unknown;
      painScore?: unknown;
      knownAllergies?: unknown;
      currentMedications?: unknown;
      knownMedicalConditions?: unknown;
      patient_id?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate patientAge
    if (body.patientAge === undefined || body.patientAge === null) {
      return NextResponse.json(
        { error: 'patientAge is required' },
        { status: 400 },
      );
    }
    const patientAge = Number(body.patientAge);
    if (isNaN(patientAge) || patientAge < 0 || patientAge > 120) {
      return NextResponse.json(
        { error: 'patientAge must be a number between 0 and 120' },
        { status: 400 },
      );
    }

    // Validate patientGender
    if (body.patientGender !== 'male' && body.patientGender !== 'female') {
      return NextResponse.json(
        { error: "patientGender must be 'male' or 'female'" },
        { status: 400 },
      );
    }

    // Validate chiefComplaint
    if (!body.chiefComplaint || typeof body.chiefComplaint !== 'string' || body.chiefComplaint.length < 3) {
      return NextResponse.json(
        { error: 'chiefComplaint is required (minimum 3 characters)' },
        { status: 400 },
      );
    }

    // Parse optional fields
    const isPregnant = body.isPregnant === true;
    const gestationalWeeks = typeof body.gestationalWeeks === 'number' ? body.gestationalWeeks : undefined;
    const historyOfPresentIllness = typeof body.historyOfPresentIllness === 'string' ? body.historyOfPresentIllness : undefined;
    const mechanismOfInjury = typeof body.mechanismOfInjury === 'string' ? body.mechanismOfInjury : undefined;
    const painScore = typeof body.painScore === 'number' ? body.painScore : undefined;
    const knownAllergies = Array.isArray(body.knownAllergies) ? body.knownAllergies : undefined;
    const currentMedications = Array.isArray(body.currentMedications) ? body.currentMedications : undefined;
    const knownMedicalConditions = Array.isArray(body.knownMedicalConditions) ? body.knownMedicalConditions : undefined;
    const patientId = typeof body.patient_id === 'string' ? body.patient_id : undefined;

    // Validate vitals
    if (!body.vitals || typeof body.vitals !== 'object') {
      return NextResponse.json(
        { error: 'vitals object is required' },
        { status: 400 },
      );
    }

    const vitalsObj = body.vitals as Record<string, unknown>;
    const vitals: Record<string, number | string> = {};

    if (typeof vitalsObj.temperature === 'number') vitals.temperature = vitalsObj.temperature;
    if (typeof vitalsObj.heartRate === 'number') vitals.heart_rate = vitalsObj.heartRate;
    if (typeof vitalsObj.respiratoryRate === 'number') vitals.respiratory_rate = vitalsObj.respiratoryRate;
    if (typeof vitalsObj.systolicBP === 'number') vitals.blood_pressure_systolic = vitalsObj.systolicBP;
    if (typeof vitalsObj.diastolicBP === 'number') vitals.blood_pressure_diastolic = vitalsObj.diastolicBP;
    if (typeof vitalsObj.spO2 === 'number') vitals.oxygen_saturation = vitalsObj.spO2;

    // Call microservice
    const startTime = Date.now();
    const triageResponse = await triageService.analyze({
      patient_id: patientId,
      age: patientAge,
      gender: body.patientGender as 'male' | 'female',
      chief_complaint: body.chiefComplaint,
      vitals,
      is_pregnant: isPregnant,
      gestational_weeks: gestationalWeeks,
    });
    const latencyMs = Date.now() - startTime;

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'triage',
      providerUsed: 'microservice',
      modelUsed: 'ai-triage-service',
      latencyMs,
      success: true,
      inputSummary: `${body.chiefComplaint} (${patientAge}y ${body.patientGender})`,
      outputSummary: `Priority ${triageResponse.priority}: ${triageResponse.priority_label}`,
      confidenceScore: triageResponse.confidence,
      requiresReview: triageResponse.priority === 1,
      consensusDetails: {
        agreement: 1.0, // Microservice provides single result
        flaggedForReview: triageResponse.priority === 1,
      },
    });

    return NextResponse.json(triageResponse, {
      headers: {
        'X-Triage-Priority': triageResponse.priority.toString(),
        'X-Triage-Confidence': triageResponse.confidence.toString(),
        'X-Triage-Source': 'microservice',
        ...(triageResponse.priority === 1 ? { 'X-Triage-Immediate': 'true' } : {}),
      },
    });

  } catch (err) {
    logger.error('[Triage Microservice route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    // Check if it's a service unavailable error
    if (err instanceof Error && err.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Triage service unavailable - timeout' },
        { status: 503 }
      );
    }
    
    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Triage service unavailable - connection refused' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/triage/microservice
 * 
 * Health check for the triage microservice
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const health = await triageService.health();
    
    return NextResponse.json({
      name: 'AI Triage Microservice',
      version: '1.0.0',
      description: 'Standalone AI triage service with ONNX models',
      service_url: process.env.TRIAGE_SERVICE_URL || 'http://localhost:8001',
      health,
    });
  } catch (err) {
    logger.error('[Triage Microservice GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    return NextResponse.json(
      { error: 'Triage service unavailable', health: 'unreachable' },
      { status: 503 }
    );
  }
}
