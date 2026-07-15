/**
 * POST /api/ai/pharmacy/microservice/interactions
 * 
 * Check drug interactions using the AI Pharmacy Microservice.
 * 
 * Request body:
 *   {
 *     medications: string[];
 *     patient_id?: string;
 *   }
 * 
 * Response:
 *   {
 *     interactions: Array<{
 *       drug1: string;
 *       drug2: string;
 *       severity: 'minor' | 'moderate' | 'major' | 'severe';
 *       description: string;
 *     }>;
 *     recommendations: string[];
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
import { pharmacyService } from '@/lib/microservices-client';
import { logAIInteraction } from '@/lib/ai-audit';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:pharmacy');
    if (rateLimit) return rateLimit;

    // Auth + session (pharmacy and medical staff)
    const session = requireRoles(request, ['pharmacy', 'medical', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      medications?: unknown;
      patient_id?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate medications
    if (!body.medications || !Array.isArray(body.medications) || body.medications.length === 0) {
      return NextResponse.json(
        { error: 'medications array is required (at least one medication)' },
        { status: 400 },
      );
    }

    const patientId = typeof body.patient_id === 'string' ? body.patient_id : undefined;

    // Call microservice
    const startTime = Date.now();
    const interactionResponse = await pharmacyService.checkInteractions({
      medications: body.medications as string[],
      patient_id: patientId,
    });
    const latencyMs = Date.now() - startTime;

    // Log the interaction
    const severeInteractions = interactionResponse.interactions.filter(
      (i: { severity: string }) => i.severity === 'severe' || i.severity === 'major'
    ).length;

    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'drug_interaction',
      providerUsed: 'microservice',
      modelUsed: 'ai-pharmacy-service',
      latencyMs,
      success: true,
      inputSummary: `${body.medications.length} medications checked`,
      outputSummary: `${interactionResponse.interactions.length} interactions found (${severeInteractions} severe)`,
      confidenceScore: severeInteractions > 0 ? 1.0 : 0.9,
      requiresReview: severeInteractions > 0,
      consensusDetails: {
        agreement: 1.0,
        flaggedForReview: severeInteractions > 0,
      },
    });

    return NextResponse.json(interactionResponse, {
      headers: {
        'X-Interactions-Count': interactionResponse.interactions.length.toString(),
        'X-Severe-Interactions-Count': severeInteractions.toString(),
        'X-Pharmacy-Source': 'microservice',
      },
    });

  } catch (err) {
    logger.error('[Pharmacy Microservice route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    if (err instanceof Error && err.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Pharmacy service unavailable - timeout' },
        { status: 503 }
      );
    }
    
    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Pharmacy service unavailable - connection refused' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ai/pharmacy/microservice/formulary
 * 
 * Lookup drug in formulary using the AI Pharmacy Microservice.
 * 
 * Request body:
 *   {
 *     drug_name: string;
 *     hospital_id?: string;
 *   }
 * 
 * Response:
 *   {
 *     available: boolean;
 *     alternatives: string[];
 *     dosage_forms: string[];
 *     contraindications: string[];
 *   }
 */

export async function PUT(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:pharmacy');
    if (rateLimit) return rateLimit;

    // Auth + session (pharmacy and medical staff)
    const session = requireRoles(request, ['pharmacy', 'medical', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      drug_name?: unknown;
      hospital_id?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate drug_name
    if (!body.drug_name || typeof body.drug_name !== 'string' || body.drug_name.length < 2) {
      return NextResponse.json(
        { error: 'drug_name is required (minimum 2 characters)' },
        { status: 400 },
      );
    }

    const hospitalId = session.hospitalId;
    if (!hospitalId) {
      return NextResponse.json(
        { error: 'Authenticated session is not linked to a hospital' },
        { status: 403 },
      );
    }

    // Call microservice
    const startTime = Date.now();
    const formularyResponse = await pharmacyService.lookupDrug({
      drug_name: body.drug_name,
      hospital_id: hospitalId,
    });
    const latencyMs = Date.now() - startTime;

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'formulary_lookup',
      providerUsed: 'microservice',
      modelUsed: 'ai-pharmacy-service',
      latencyMs,
      success: true,
      inputSummary: `Formulary lookup: ${body.drug_name}`,
      outputSummary: formularyResponse.available ? 'Available' : `Not available (${formularyResponse.alternatives.length} alternatives)`,
      confidenceScore: formularyResponse.available ? 1.0 : 0.8,
      requiresReview: !formularyResponse.available,
      consensusDetails: {
        agreement: 1.0,
        flaggedForReview: !formularyResponse.available,
      },
    });

    return NextResponse.json(formularyResponse, {
      headers: {
        'X-Drug-Available': formularyResponse.available.toString(),
        'X-Pharmacy-Source': 'microservice',
      },
    });

  } catch (err) {
    logger.error('[Pharmacy Microservice formulary route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    if (err instanceof Error && err.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Pharmacy service unavailable - timeout' },
        { status: 503 }
      );
    }
    
    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Pharmacy service unavailable - connection refused' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/pharmacy/microservice
 * 
 * Health check for the pharmacy microservice
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['pharmacy', 'medical', 'admin']);
    if (session instanceof NextResponse) return session;

    const health = await pharmacyService.health();
    
    return NextResponse.json({
      name: 'AI Pharmacy Microservice',
      version: '1.0.0',
      description: 'Standalone AI pharmacy service for drug interactions and formulary',
      service_url: process.env.PHARMACY_SERVICE_URL || 'http://localhost:8006',
      health,
    });
  } catch (err) {
    logger.error('[Pharmacy Microservice GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    return NextResponse.json(
      { error: 'Pharmacy service unavailable', health: 'unreachable' },
      { status: 503 }
    );
  }
}
