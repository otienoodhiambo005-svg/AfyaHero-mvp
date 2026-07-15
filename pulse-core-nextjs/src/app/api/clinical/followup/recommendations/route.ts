/**
 * Patient Follow-up Recommendations API
 * 
 * POST /api/clinical/followup/recommendations
 * 
 * Provides AI-driven patient follow-up recommendations based on:
 * - Diagnosis and treatment plan
 * - Risk factors and comorbidities
 * - Social determinants of health
 * - Resource availability
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import { PredictiveRiskModels } from '@/lib/predictive-risk-models';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:clinical:followup:recommendations');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    patientId?: unknown;
    diagnosis?: unknown;
    treatment?: unknown;
    riskFactors?: unknown;
    socialContext?: unknown;
    dischargeCondition?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const patientId = typeof body.patientId === 'string' ? body.patientId : undefined;
  const diagnosis = typeof body.diagnosis === 'string' ? body.diagnosis : '';
  const treatment = body.treatment && typeof body.treatment === 'object' ? body.treatment as Record<string, unknown> : {};
  const riskFactors = body.riskFactors && typeof body.riskFactors === 'object' ? body.riskFactors as Record<string, unknown> : {};
  const socialContext = body.socialContext && typeof body.socialContext === 'object' ? body.socialContext as Record<string, unknown> : {};
  const dischargeCondition = typeof body.dischargeCondition === 'string' ? body.dischargeCondition : 'stable';

  try {
    // Calculate readmission risk
    const readmissionRisk = PredictiveRiskModels.calculateReadmissionRisk({
      age: typeof riskFactors.age === 'number' ? riskFactors.age : 50,
      diagnosis: typeof riskFactors.diagnoses === 'string' ? [riskFactors.diagnoses] : Array.isArray(riskFactors.diagnoses) ? riskFactors.diagnoses as string[] : [diagnosis],
      comorbidities: typeof riskFactors.comorbidities === 'string' ? [riskFactors.comorbidities] : Array.isArray(riskFactors.comorbidities) ? riskFactors.comorbidities as string[] : [],
      previousAdmissions: typeof riskFactors.previousAdmissions === 'number' ? riskFactors.previousAdmissions : 0,
      dischargeCondition: dischargeCondition as any,
      socialSupport: typeof socialContext.support === 'string' ? socialContext.support as any : 'moderate',
      distanceFromFacility: typeof socialContext.distance === 'number' ? socialContext.distance : undefined,
      followUpScheduled: typeof treatment.followUpScheduled === 'boolean' ? treatment.followUpScheduled : false,
      medicationAdherence: typeof riskFactors.adherence === 'string' ? riskFactors.adherence as any : 'moderate',
    });

    // Build AI prompt for follow-up recommendations
    const prompt = `Generate personalized follow-up recommendations:

Diagnosis: ${diagnosis}
Treatment: ${JSON.stringify(treatment, null, 2)}
Discharge Condition: ${dischargeCondition}

Risk Factors:
- Age: ${riskFactors.age || 'Not specified'}
- Comorbidities: ${Array.isArray(riskFactors.comorbidities) ? riskFactors.comorbidities.join(', ') : riskFactors.comorbidities || 'None'}
- Previous Admissions: ${riskFactors.previousAdmissions || 0}

Social Context:
- Support: ${socialContext.support || 'Not specified'}
- Distance from facility: ${socialContext.distance || 'Not specified'} km
- Transportation: ${socialContext.transportation || 'Not specified'}

Readmission Risk: ${readmissionRisk.risk} (score: ${readmissionRisk.score})

Provide:
1. Recommended follow-up timeline
2. Specific monitoring parameters
3. Red flags requiring immediate return
4. Medication adherence support strategies
5. Community health worker involvement (if needed)
6. Telehealth follow-up options
7. Patient education priorities

Return as JSON with fields: followUpTimeline, monitoringParameters, redFlags, adherenceSupport, chwInvolvement, telehealthOptions, educationPriorities.`;

    const systemInstruction = `You are a discharge planning specialist for East African healthcare.
Consider:
- Resource limitations in the region
- Transportation challenges
- Community health worker availability
- Local disease epidemiology
- Family and social support structures
Provide practical, resource-appropriate recommendations.`;

    const response = await orchestrateAI({
      taskType: 'documentation',
      prompt,
      systemInstruction,
      patientId,
      clinicianId: session.id,
      facilityId: session.hospitalId,
      requireConsensus: false,
    });

    if (!response.success || !response.text) {
      return NextResponse.json({ error: 'Failed to generate follow-up recommendations' }, { status: 500 });
    }

    let aiRecommendations: any = {};
    try {
      aiRecommendations = JSON.parse(response.text);
    } catch (parseError) {
      aiRecommendations = { rawResponse: response.text };
    }

    return NextResponse.json({
      success: true,
      readmissionRisk,
      recommendations: aiRecommendations,
      summary: {
        urgency: readmissionRisk.risk === 'high' ? '7 days' : readmissionRisk.risk === 'medium' ? '14 days' : '30 days',
        requiresCHW: readmissionRisk.score >= 5,
        telehealthEligible: typeof socialContext.distance === 'number' && socialContext.distance > 20,
      },
      metadata: {
        patientId,
        generatedAt: new Date().toISOString(),
        generatedBy: session.name,
      },
    });
  } catch (error) {
    logger.error('[Follow-up Recommendations] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate follow-up recommendations' }, { status: 500 });
  }
}

/**
 * GET /api/clinical/followup/recommendations
 * 
 * Returns available follow-up recommendation types and metadata
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Patient Follow-up Recommendations',
    version: '1.0.0',
    description: 'AI-driven patient follow-up recommendations',
    recommendationTypes: [
      { type: 'follow_up_timeline', description: 'Recommended timing for follow-up visits' },
      { type: 'monitoring_parameters', description: 'Vitals and symptoms to monitor' },
      { type: 'red_flags', description: 'Warning signs requiring immediate return' },
      { type: 'adherence_support', description: 'Strategies to improve medication adherence' },
      { type: 'chw_involvement', description: 'Community health worker engagement' },
      { type: 'telehealth_options', description: 'Remote follow-up alternatives' },
      { type: 'education_priorities', description: 'Key patient education topics' },
    ],
    riskLevels: [
      { level: 'high', followup: '7 days', chw: true },
      { level: 'medium', followup: '14 days', chw: false },
      { level: 'low', followup: '30 days', chw: false },
    ],
  });
}
