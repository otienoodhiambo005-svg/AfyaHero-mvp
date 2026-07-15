/**
 * POST /api/ai/imaging/microservice/analyze
 * 
 * Analyze medical image using the AI Imaging Microservice with MedLM Vision.
 * 
 * Request body:
 *   {
 *     image_data: string; // base64 encoded
 *     modality: 'xray' | 'ct' | 'mri' | 'ultrasound';
 *     body_part: string;
 *     patient_id?: string;
 *   }
 * 
 * Response:
 *   {
 *     findings: string[];
 *     impression: string;
 *     confidence: number;
 *     abnormalities: string[];
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
import { imagingService } from '@/lib/microservices-client';
import { logAIInteraction } from '@/lib/ai-audit';
import logger from '@/lib/logger';

const VALID_MODALITIES = ['xray', 'ct', 'mri', 'ultrasound', 'pathology', 'radiology'] as const;

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:imaging');
    if (rateLimit) return rateLimit;

    // Auth + session (medical and lab staff)
    const session = requireRoles(request, ['medical', 'lab', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      image_data?: unknown;
      modality?: unknown;
      body_part?: unknown;
      patient_id?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate image_data
    if (!body.image_data || typeof body.image_data !== 'string') {
      return NextResponse.json(
        { error: 'image_data is required (base64 encoded string)' },
        { status: 400 },
      );
    }

    // Validate modality
    if (typeof body.modality !== 'string' || !(VALID_MODALITIES as readonly string[]).includes(body.modality)) {
      return NextResponse.json(
        { error: `Invalid modality. Valid values: ${VALID_MODALITIES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate body_part
    if (!body.body_part || typeof body.body_part !== 'string' || body.body_part.length < 2) {
      return NextResponse.json(
        { error: 'body_part is required (minimum 2 characters)' },
        { status: 400 },
      );
    }

    const patientId = typeof body.patient_id === 'string' ? body.patient_id : undefined;

    // Call microservice
    const startTime = Date.now();
    const imagingResponse = await imagingService.analyze({
      image_data: body.image_data,
      modality: body.modality as 'xray' | 'ct' | 'mri' | 'ultrasound',
      body_part: body.body_part,
      patient_id: patientId,
    });
    const latencyMs = Date.now() - startTime;

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'imaging',
      providerUsed: 'microservice',
      modelUsed: 'ai-imaging-service-medlm',
      latencyMs,
      success: true,
      inputSummary: `${body.modality} ${body.body_part}`,
      outputSummary: imagingResponse.abnormalities.length > 0 
        ? `${imagingResponse.abnormalities.length} abnormalities detected` 
        : 'No significant abnormalities',
      confidenceScore: imagingResponse.confidence,
      requiresReview: imagingResponse.abnormalities.length > 0,
      consensusDetails: {
        agreement: imagingResponse.confidence,
        flaggedForReview: imagingResponse.abnormalities.length > 0,
      },
    });

    return NextResponse.json(imagingResponse, {
      headers: {
        'X-Imaging-Confidence': imagingResponse.confidence.toString(),
        'X-Imaging-Abnormalities-Count': imagingResponse.abnormalities.length.toString(),
        'X-Imaging-Source': 'microservice',
      },
    });

  } catch (err) {
    logger.error('[Imaging Microservice route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    if (err instanceof Error && err.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Imaging service unavailable - timeout' },
        { status: 503 }
      );
    }
    
    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Imaging service unavailable - connection refused' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ai/imaging/microservice/dicom/store
 * 
 * Store DICOM image using the AI Imaging Microservice with Google Cloud Healthcare.
 * 
 * Request body:
 *   {
 *     dicom_data: string; // base64 encoded
 *     study_id: string;
 *     series_id: string;
 *     instance_id: string;
 *   }
 * 
 * Response:
 *   {
 *     storage_path: string;
 *     dicom_store_id: string;
 *   }
 */

export async function PUT(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:imaging');
    if (rateLimit) return rateLimit;

    // Auth + session (lab staff only)
    const session = requireRoles(request, ['lab', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      dicom_data?: unknown;
      study_id?: unknown;
      series_id?: unknown;
      instance_id?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate dicom_data
    if (!body.dicom_data || typeof body.dicom_data !== 'string') {
      return NextResponse.json(
        { error: 'dicom_data is required (base64 encoded string)' },
        { status: 400 },
      );
    }

    // Validate DICOM identifiers
    if (!body.study_id || typeof body.study_id !== 'string') {
      return NextResponse.json({ error: 'study_id is required' }, { status: 400 });
    }
    if (!body.series_id || typeof body.series_id !== 'string') {
      return NextResponse.json({ error: 'series_id is required' }, { status: 400 });
    }
    if (!body.instance_id || typeof body.instance_id !== 'string') {
      return NextResponse.json({ error: 'instance_id is required' }, { status: 400 });
    }

    // Call microservice
    const startTime = Date.now();
    const dicomResponse = await imagingService.storeDicom({
      dicom_data: body.dicom_data,
      study_id: body.study_id,
      series_id: body.series_id,
      instance_id: body.instance_id,
    });
    const latencyMs = Date.now() - startTime;

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'dicom_storage',
      providerUsed: 'microservice',
      modelUsed: 'ai-imaging-service-gcloud',
      latencyMs,
      success: true,
      inputSummary: `DICOM storage: ${body.study_id}/${body.series_id}/${body.instance_id}`,
      outputSummary: `Stored at ${dicomResponse.storage_path}`,
      confidenceScore: 1.0,
      requiresReview: false,
      consensusDetails: {
        agreement: 1.0,
        flaggedForReview: false,
      },
    });

    return NextResponse.json(dicomResponse, {
      headers: {
        'X-DICOM-Storage-Path': dicomResponse.storage_path,
        'X-Imaging-Source': 'microservice',
      },
    });

  } catch (err) {
    logger.error('[Imaging DICOM route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    if (err instanceof Error && err.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Imaging service unavailable - timeout' },
        { status: 503 }
      );
    }
    
    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Imaging service unavailable - connection refused' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/imaging/microservice
 * 
 * Health check for the imaging microservice
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['medical', 'lab', 'admin']);
    if (session instanceof NextResponse) return session;

    const health = await imagingService.health();
    
    return NextResponse.json({
      name: 'AI Imaging Microservice',
      version: '1.0.0',
      description: 'Standalone AI imaging service with MedLM Vision and Google Cloud Healthcare',
      service_url: process.env.IMAGING_SERVICE_URL || 'http://localhost:8003',
      health,
    });
  } catch (err) {
    logger.error('[Imaging Microservice GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    
    return NextResponse.json(
      { error: 'Imaging service unavailable', health: 'unreachable' },
      { status: 503 }
    );
  }
}
