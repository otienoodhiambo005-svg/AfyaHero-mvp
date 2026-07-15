/**
 * AI-Powered Lab Results Interpretation API
 * 
 * POST /api/lab/interpret
 * 
 * Uses AI to interpret lab results and provide clinical insights,
 * trend analysis, and follow-up recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:lab:interpret');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['lab', 'medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    labResults?: unknown;
    testName?: unknown;
    patientAge?: unknown;
    patientGender?: unknown;
    patientContext?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const labResults = body.labResults;
  if (!labResults || typeof labResults !== 'object') {
    return NextResponse.json({ error: 'labResults object is required' }, { status: 400 });
  }

  const testName = typeof body.testName === 'string' ? body.testName : 'Lab Results';
  const patientAge = typeof body.patientAge === 'number' ? body.patientAge : undefined;
  const patientGender = typeof body.patientGender === 'string' ? body.patientGender : undefined;
  const patientContext = typeof body.patientContext === 'string' ? body.patientContext : '';

  try {
    // Build interpretation prompt
    const resultsStr = JSON.stringify(labResults, null, 2);
    const prompt = `Interpret the following lab results:

Test: ${testName}
Patient: ${patientAge ? `${patientAge} year old ${patientGender}` : 'Age/gender not specified'}
${patientContext ? `Context: ${patientContext}` : ''}

Results:
${resultsStr}

Provide:
1. Overall interpretation (normal/abnormal/critical)
2. Abnormal values with clinical significance
3. Potential causes for abnormalities
4. Recommended follow-up tests
5. Immediate actions if critical values present
6. Reference ranges for context`;

    const systemInstruction = `You are an expert clinical laboratory interpreter for East African healthcare settings.
Consider local epidemiology and resource constraints when providing recommendations.
Be concise but thorough. Flag critical values prominently.
Return structured JSON with the fields mentioned in the prompt.`;

    const response = await orchestrateAI({
      taskType: 'lab_interpretation',
      prompt,
      systemInstruction,
      patientId: undefined,
      clinicianId: session.id,
      facilityId: session.hospitalId,
      context: {
        labResults: Array.isArray(labResults) ? labResults : [labResults],
      },
      requireConsensus: true,
    });

    if (!response.success || !response.text) {
      return NextResponse.json({ error: 'Lab interpretation failed' }, { status: 500 });
    }

    return NextResponse.json({
      interpretation: response.text,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      confidenceScore: response.confidenceScore,
    });
  } catch (error) {
    logger.error('[Lab Interpretation] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Lab interpretation failed' }, { status: 500 });
  }
}
