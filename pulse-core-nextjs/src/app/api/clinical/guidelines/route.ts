/**
 * Clinical Guidelines API
 * 
 * POST /api/clinical/guidelines
 * 
 * Provides evidence-based clinical guidelines following Kenya MOH standards
 * and WHO recommendations for East African healthcare settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:clinical:guidelines');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    condition?: unknown;
    specialty?: unknown;
    patientAge?: unknown;
    patientGender?: unknown;
    pregnancyStatus?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const condition = typeof body.condition === 'string' ? body.condition : '';
  const specialty = typeof body.specialty === 'string' ? body.specialty : 'general';
  const patientAge = typeof body.patientAge === 'number' ? body.patientAge : undefined;
  const patientGender = typeof body.patientGender === 'string' ? body.patientGender : undefined;
  const pregnancyStatus = typeof body.pregnancyStatus === 'string' ? body.pregnancyStatus : undefined;

  if (!condition) {
    return NextResponse.json({ error: 'condition is required' }, { status: 400 });
  }

  try {
    // Build guideline prompt with patient context
    let patientContext = '';
    if (patientAge) patientContext += `Patient age: ${patientAge}\n`;
    if (patientGender) patientContext += `Patient gender: ${patientGender}\n`;
    if (pregnancyStatus) patientContext += `Pregnancy status: ${pregnancyStatus}\n`;

    const prompt = `Provide comprehensive clinical guidelines for: ${condition}

${patientContext ? `Patient Context:\n${patientContext}` : ''}

Include:
1. Kenya MOH guidelines (if available)
2. WHO recommendations
3. Assessment requirements
4. Diagnostic criteria
5. Treatment protocols (first-line, second-line)
6. Referral criteria
7. Follow-up recommendations
8. Red flags requiring urgent attention
9. Resource considerations for East African settings

Provide as structured JSON with clear sections.`;

    const systemInstruction = `You are a clinical guideline expert specializing in East African healthcare.
Your guidelines must follow:
- Kenya Ministry of Health (MOH) Clinical Guidelines
- WHO recommendations adapted for resource-limited settings
- Evidence-based medicine principles
- Local epidemiology considerations

Return structured guidelines that are practical and actionable for clinicians in Kenya.
Include specific drug names, dosages, and duration where applicable.`;

    const response = await orchestrateAI({
      taskType: 'protocol_lookup',
      prompt,
      systemInstruction,
      patientId: undefined,
      clinicianId: session.id,
      facilityId: session.hospitalId,
      requireConsensus: false,
    });

    if (!response.success || !response.text) {
      return NextResponse.json({ error: 'Failed to generate clinical guidelines' }, { status: 500 });
    }

    return NextResponse.json({
      condition,
      specialty,
      guidelines: response.text,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      confidenceScore: response.confidenceScore,
    });
  } catch (error) {
    logger.error('[Clinical Guidelines] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate clinical guidelines' }, { status: 500 });
  }
}

/**
 * GET /api/clinical/guidelines
 * 
 * Returns available guideline categories and supported conditions
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Clinical Guidelines Service',
    version: '1.0.0',
    description: 'Evidence-based clinical guidelines following Kenya MOH standards',
    supportedSpecialties: [
      'general',
      'internal_medicine',
      'pediatrics',
      'obstetrics_gynecology',
      'surgery',
      'orthopedics',
      'cardiology',
      'dermatology',
      'infectious_disease',
      'emergency_medicine',
    ],
    guidelineSources: [
      'Kenya Ministry of Health (MOH)',
      'World Health Organization (WHO)',
      'East African Clinical Guidelines',
      'Evidence-Based Medicine',
    ],
  });
}
