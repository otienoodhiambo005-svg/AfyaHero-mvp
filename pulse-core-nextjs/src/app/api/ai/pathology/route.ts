/**
 * AI-Powered Pathology Analysis API
 * 
 * POST /api/ai/pathology
 * 
 * Uses AI to analyze pathology reports and histology slides,
 * providing diagnostic insights and recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:ai:pathology');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['lab', 'medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    reportText?: unknown;
    specimenType?: unknown;
    patientAge?: unknown;
    patientGender?: unknown;
    clinicalHistory?: unknown;
    imageData?: unknown; // Base64 encoded image if available
  }>(req);
  if (body instanceof NextResponse) return body;

  const reportText = typeof body.reportText === 'string' ? body.reportText : '';
  const specimenType = typeof body.specimenType === 'string' ? body.specimenType : 'Unknown';
  const patientAge = typeof body.patientAge === 'number' ? body.patientAge : undefined;
  const patientGender = typeof body.patientGender === 'string' ? body.patientGender : undefined;
  const clinicalHistory = typeof body.clinicalHistory === 'string' ? body.clinicalHistory : '';

  if (!reportText && !body.imageData) {
    return NextResponse.json(
      { error: 'Either reportText or imageData is required' },
      { status: 400 }
    );
  }

  try {
    // Build pathology analysis prompt
    const prompt = `Analyze the following pathology specimen:

Specimen Type: ${specimenType}
Patient: ${patientAge ? `${patientAge} year old ${patientGender}` : 'Age/gender not specified'}
${clinicalHistory ? `Clinical History: ${clinicalHistory}` : ''}

${reportText ? `Report Text:
${reportText}` : 'Histology image provided for analysis'}

Provide a structured analysis including:
1. Specimen adequacy assessment
2. Key histological/cytological findings
3. Diagnostic impression with confidence level
4. Differential diagnoses if applicable
5. Grade/Stage assessment if relevant
6. Special stains or ancillary studies recommended
7. Clinical correlation recommendations
8. Critical findings requiring urgent communication`;

    const systemInstruction = `You are an expert pathologist AI assistant specializing in East African pathology patterns.
Consider tropical diseases, infectious agents, and regional cancer patterns common in Kenya/East Africa.
Provide structured, evidence-based analysis following CAP guidelines where applicable.
Flag any critical values requiring immediate clinician notification.
Return analysis in clear sections with confidence levels.`;

    const response = await orchestrateAI({
      taskType: 'diagnosis',
      prompt,
      systemInstruction,
      patientId: undefined,
      clinicianId: session.id,
      facilityId: session.hospitalId,
      context: {
        history: `Specimen: ${specimenType}, Patient: ${patientAge}yo ${patientGender}`,
      },
      requireConsensus: true,
    });

    if (!response.success || !response.text) {
      return NextResponse.json(
        { error: 'Pathology analysis failed' },
        { status: 500 }
      );
    }

    logger.info('Pathology analysis completed', {
      specimenType,
      provider: response.provider,
      hospitalId: session.hospitalId,
    });

    return NextResponse.json({
      analysis: response.text,
      specimenType,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      confidenceScore: response.confidenceScore,
      requiresPathologistReview: (response.confidenceScore || 0) < 0.8,
    });
  } catch (error) {
    logger.error('[Pathology Analysis] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Pathology analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/pathology
 * 
 * Health check and supported specimen types
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['lab', 'medical', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    service: 'AI Pathology Analysis',
    version: '1.0.0',
    supportedSpecimenTypes: [
      'tissue_biopsy',
      'fine_needle_aspiration',
      'pap_smear',
      'bone_marrow',
      'lymph_node',
      'skin_lesion',
      'breast_tissue',
      'gastrointestinal_biopsy',
      'liver_biopsy',
      'renal_biopsy',
      'tumor_resection',
    ],
    capabilities: [
      'histological_analysis',
      'cytological_analysis',
      'grading_assessment',
      'margin_evaluation',
      'special_stain_recommendations',
    ],
  });
}
