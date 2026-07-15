/**
 * POST /api/ai/diagnosis/microservice
 * 
 * AI-powered diagnosis endpoint using the AI Diagnosis Microservice.
 * This is an alternative to the local implementation that calls the standalone service.
 * 
 * Request body:
 *   {
 *     patient_id?: string;
 *     age: number;
 *     gender: 'male' | 'female';
 *     symptoms: string[];
 *     vitals?: {
 *       temperature?: number;
 *       heart_rate?: number;
 *       blood_pressure_systolic?: number;
 *       blood_pressure_diastolic?: number;
 *       respiratory_rate?: number;
 *     };
 *     medical_history?: string[];
 *   }
 * 
 * Response:
 *   {
 *     diagnosis: string[];
 *     differential_diagnosis: string[];
 *     confidence: number;
 *     reasoning: string;
 *     recommended_tests: string[];
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { diagnosisService } from '@/lib/microservices-client';
import { logAIInteraction } from '@/lib/ai-audit';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:diagnosis');
    if (rateLimit) return rateLimit;

    // Auth + session (medical staff only)
    const session = requireRoles(request, ['medical', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      patientAge?: unknown;
      patientGender?: unknown;
      symptoms?: unknown;
      vitals?: unknown;
      medicalHistory?: unknown;
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

    // Validate symptoms
    if (!body.symptoms || !Array.isArray(body.symptoms) || body.symptoms.length === 0) {
      return NextResponse.json(
        { error: 'symptoms array is required (at least one symptom)' },
        { status: 400 },
      );
    }

    // Parse optional fields
    const patientId = typeof body.patient_id === 'string' ? body.patient_id : undefined;
    const medicalHistory = Array.isArray(body.medicalHistory) ? body.medicalHistory : undefined;

    // Validate vitals
    const vitalsObj = body.vitals as Record<string, unknown> | undefined;
    const vitals: Record<string, number> = {};
    
    if (vitalsObj) {
      if (typeof vitalsObj.temperature === 'number') vitals.temperature = vitalsObj.temperature;
      if (typeof vitalsObj.heartRate === 'number') vitals.heart_rate = vitalsObj.heartRate;
      if (typeof vitalsObj.blood_pressure_systolic === 'number') vitals.blood_pressure_systolic = vitalsObj.blood_pressure_systolic;
      if (typeof vitalsObj.blood_pressure_diastolic === 'number') vitals.blood_pressure_diastolic = vitalsObj.blood_pressure_diastolic;
      if (typeof vitalsObj.respiratory_rate === 'number') vitals.respiratory_rate = vitalsObj.respiratory_rate;
    }

    // Call microservice
    const startTime = Date.now();
    const diagnosisResponse = await diagnosisService.analyze({
      patient_id: patientId,
      age: patientAge,
      gender: body.patientGender as 'male' | 'female',
      symptoms: body.symptoms as string[],
      vitals,
      medical_history: medicalHistory,
    });
    const latencyMs = Date.now() - startTime;

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'diagnostic',
      providerUsed: 'microservice',
      modelUsed: 'ai-diagnosis-service',
      latencyMs,
      success: true,
      inputSummary: `${(body.symptoms as string[]).slice(0, 3).join(', ')} (${patientAge}y ${body.patientGender})`,
      outputSummary: diagnosisResponse.diagnosis.slice(0, 2).join(', '),
      confidenceScore: diagnosisResponse.confidence,
      requiresReview: diagnosisResponse.confidence < 0.7,
      consensusDetails: {
        agreement: diagnosisResponse.confidence,
        flaggedForReview: diagnosisResponse.confidence < 0.7,
      },
    });

    return NextResponse.json(diagnosisResponse, {
      headers: {
        'X-Diagnosis-Confidence': diagnosisResponse.confidence.toString(),
        'X-Diagnosis-Source': 'microservice',
      },
    });

  } catch (err) {
    logger.error('[Diagnosis Microservice route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    if (err instanceof Error && err.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Diagnosis service unavailable - timeout' },
        { status: 503 }
      );
    }
    
    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Diagnosis service unavailable - connection refused' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/diagnosis/microservice
 * 
 * Health check for the diagnosis microservice
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const health = await diagnosisService.health();
    
    return NextResponse.json({
      name: 'AI Diagnosis Microservice',
      version: '1.0.0',
      description: 'Standalone AI diagnosis service',
      service_url: process.env.DIAGNOSIS_SERVICE_URL || 'http://localhost:8002',
      health,
    });
  } catch (err) {
    logger.error('[Diagnosis Microservice GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    return NextResponse.json(
      { error: 'Diagnosis service unavailable', health: 'unreachable' },
      { status: 503 }
    );
  }
}
