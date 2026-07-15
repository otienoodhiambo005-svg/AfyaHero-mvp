/**
 * Patient Deterioration Risk API
 * 
 * POST /api/clinical/deterioration-risk
 * 
 * Provides AI-enhanced predictive risk modeling for patient deterioration
 * combining multiple validated scoring systems with AI insights.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { PredictiveRiskModels } from '@/lib/predictive-risk-models';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:clinical:deterioration-risk');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    patientId?: unknown;
    age?: unknown;
    gender?: unknown;
    isPregnant?: unknown;
    gestationalWeeks?: unknown;
    vitals?: unknown;
    consciousness?: unknown;
    additionalContext?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const patientId = typeof body.patientId === 'string' ? body.patientId : undefined;
  const age = typeof body.age === 'number' ? body.age : undefined;
  const gender = typeof body.gender === 'string' ? body.gender : undefined;
  const isPregnant = typeof body.isPregnant === 'boolean' ? body.isPregnant : false;
  const gestationalWeeks = typeof body.gestationalWeeks === 'number' ? body.gestationalWeeks : undefined;
  const vitals = body.vitals && typeof body.vitals === 'object' ? body.vitals as Record<string, number> : {};
  const consciousness = typeof body.consciousness === 'string' ? body.consciousness : 'alert';
  const additionalContext = typeof body.additionalContext === 'string' ? body.additionalContext : '';

  try {
    const risks: any = {};
    let overallRisk = 'low';
    let requiresImmediateAction = false;
    const allRecommendations: string[] = [];

    // Sepsis risk (for all patients)
    const sepsisRisk = PredictiveRiskModels.calculateSepsisRisk({
      respiratoryRate: vitals.respiratoryRate,
      systolicBP: vitals.systolicBP,
      consciousness: consciousness as any,
      temperature: vitals.temperature,
      heartRate: vitals.heartRate,
      age,
    });
    risks.sepsis = sepsisRisk;
    if (sepsisRisk.requiresImmediateAction) requiresImmediateAction = true;
    allRecommendations.push(...sepsisRisk.recommendations);

    // Pediatric risk (for children)
    if (age !== undefined && age < 18) {
      const pediatricRisk = PredictiveRiskModels.calculatePediatricRisk({
        age,
        consciousness: consciousness as any,
        heartRate: vitals.heartRate,
        respiratoryRate: vitals.respiratoryRate,
        spO2: vitals.spO2,
        temperature: vitals.temperature,
      });
      risks.pediatric = pediatricRisk;
      if (pediatricRisk.requiresImmediateAction) requiresImmediateAction = true;
      allRecommendations.push(...pediatricRisk.recommendations);
    }

    // Maternal risk (for pregnant patients)
    if (isPregnant) {
      const maternalRisk = PredictiveRiskModels.calculateMaternalRisk({
        systolicBP: vitals.systolicBP,
        diastolicBP: vitals.diastolicBP,
        temperature: vitals.temperature,
        heartRate: vitals.heartRate,
        respiratoryRate: vitals.respiratoryRate,
        spO2: vitals.spO2,
        consciousness: consciousness as any,
        gestationalWeeks,
        isPostpartum: false,
      });
      risks.maternal = maternalRisk;
      if (maternalRisk.requiresImmediateAction) requiresImmediateAction = true;
      allRecommendations.push(...maternalRisk.recommendations);
    }

    // Determine overall risk level
    if (requiresImmediateAction) {
      overallRisk = 'critical';
    } else if (sepsisRisk.risk === 'high' || 
               (risks.pediatric?.risk === 'high') || 
               (risks.maternal?.risk === 'high')) {
      overallRisk = 'high';
    } else if (sepsisRisk.risk === 'medium' || 
               (risks.pediatric?.risk === 'medium') || 
               (risks.maternal?.risk === 'medium')) {
      overallRisk = 'medium';
    }

    // AI-enhanced risk assessment
    let aiInsights: string[] = [];
    try {
      const aiPrompt = `Assess patient deterioration risk with the following data:

Patient: ${age ? `${age} year old ${gender}` : 'Age/gender not specified'}
${isPregnant ? `Pregnant, ${gestationalWeeks} weeks` : ''}
Vitals: ${JSON.stringify(vitals, null, 2)}
Consciousness: ${consciousness}

Risk Scores:
${Object.entries(risks).map(([key, value]: [string, any]) => `- ${key}: ${value.risk} (score: ${value.score})`).join('\n')}

${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Provide:
1. Overall clinical assessment
2. Additional risk factors not captured by scores
3. Specific monitoring recommendations
4. When to escalate to senior review

Return as JSON with fields: assessment, additionalRiskFactors, monitoringRecommendations, escalationCriteria.`;

      const aiResponse = await orchestrateAI({
        taskType: 'diagnosis',
        prompt: aiPrompt,
        systemInstruction: 'You are a critical care specialist providing deterioration risk assessment. Be conservative - when in doubt, recommend closer monitoring. Consider East African context and resource limitations.',
        patientId,
        clinicianId: session.id,
        facilityId: session.hospitalId,
        requireConsensus: true,
      });

      if (aiResponse.success && aiResponse.text) {
        const aiAssessment = JSON.parse(aiResponse.text);
        aiInsights = [
          aiAssessment.assessment || '',
          ...(aiAssessment.additionalRiskFactors || []),
          ...(aiAssessment.monitoringRecommendations || []),
          ...(aiAssessment.escalationCriteria ? [`Escalate if: ${aiAssessment.escalationCriteria}`] : []),
        ];
      }
    } catch (error) {
      logger.warn('[Deterioration Risk] AI assessment failed', { error });
    }

    return NextResponse.json({
      success: true,
      overallRisk,
      requiresImmediateAction,
      risks,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      aiInsights,
      metadata: {
        patientId,
        assessedAt: new Date().toISOString(),
        assessedBy: session.name,
      },
    });
  } catch (error) {
    logger.error('[Deterioration Risk] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to assess deterioration risk' }, { status: 500 });
  }
}

/**
 * GET /api/clinical/deterioration-risk
 * 
 * Returns available risk models and metadata
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Patient Deterioration Risk Assessment',
    version: '1.0.0',
    description: 'AI-enhanced predictive risk modeling for patient deterioration',
    riskModels: [
      { name: 'Sepsis Early Warning', method: 'qSOFA/MEWS', applicable: 'All patients' },
      { name: 'Pediatric Deterioration', method: 'PEWS', applicable: 'Patients < 18 years' },
      { name: 'Maternal Deterioration', method: 'Obstetric scoring', applicable: 'Pregnant patients' },
      { name: 'AI-Enhanced Assessment', method: 'Multi-model consensus', applicable: 'All patients' },
    ],
    riskLevels: ['low', 'medium', 'high', 'critical'],
    alerts: {
      critical: 'Immediate senior review and intervention required',
      high: 'Urgent clinical assessment needed',
      medium: 'Increased monitoring frequency recommended',
      low: 'Continue routine monitoring',
    },
  });
}
