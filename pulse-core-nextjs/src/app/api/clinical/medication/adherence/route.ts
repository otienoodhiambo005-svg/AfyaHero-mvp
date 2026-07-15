/**
 * Medication Adherence Monitoring API
 * 
 * POST /api/clinical/medication/adherence
 * 
 * Provides AI-powered medication adherence monitoring with:
 * - Adherence risk prediction
 * - Personalized support strategies
 * - Intervention recommendations
 * - Monitoring schedules
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:clinical:medication:adherence');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['medical', 'pharmacy', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    patientId?: unknown;
    medications?: unknown;
    adherenceHistory?: unknown;
    riskFactors?: unknown;
    socialContext?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const patientId = typeof body.patientId === 'string' ? body.patientId : undefined;
  const medications = body.medications && Array.isArray(body.medications) ? body.medications as Array<{ name: string; frequency: string; duration?: string }> : [];
  const adherenceHistory = body.adherenceHistory && typeof body.adherenceHistory === 'object' ? body.adherenceHistory as Record<string, unknown> : {};
  const riskFactors = body.riskFactors && typeof body.riskFactors === 'object' ? body.riskFactors as Record<string, unknown> : {};
  const socialContext = body.socialContext && typeof body.socialContext === 'object' ? body.socialContext as Record<string, unknown> : {};

  try {
    // Calculate adherence risk score
    let adherenceScore = 100;
    const riskFactorsList: string[] = [];

    // Age factor
    if (typeof riskFactors.age === 'number') {
      if (riskFactors.age < 18 || riskFactors.age > 65) {
        adherenceScore -= 10;
        riskFactorsList.push('Extreme age (requires caregiver support)');
      }
    }

    // Number of medications
    if (medications.length > 5) {
      adherenceScore -= 15;
      riskFactorsList.push('High pill burden (>5 medications)');
    } else if (medications.length > 3) {
      adherenceScore -= 5;
      riskFactorsList.push('Multiple medications');
    }

    // Medication frequency
    const highFrequencyCount = medications.filter(m => m.frequency.toLowerCase().includes('tid') || m.frequency.toLowerCase().includes('qid')).length;
    if (highFrequencyCount > 0) {
      adherenceScore -= 10;
      riskFactorsList.push('High frequency dosing schedule');
    }

    // Social support
    if (typeof socialContext.support === 'string' && (socialContext.support === 'poor' || socialContext.support === 'none')) {
      adherenceScore -= 15;
      riskFactorsList.push('Poor social support');
    }

    // Distance from facility
    if (typeof socialContext.distance === 'number' && socialContext.distance > 20) {
      adherenceScore -= 10;
      riskFactorsList.push('Long distance from facility');
    }

    // Previous adherence issues
    if (adherenceHistory.previousMissedDoses && typeof adherenceHistory.previousMissedDoses === 'number' && adherenceHistory.previousMissedDoses > 3) {
      adherenceScore -= 20;
      riskFactorsList.push('History of missed doses');
    }

    // Determine adherence level
    let adherenceLevel: 'high' | 'medium' | 'low' = 'high';
    if (adherenceScore < 50) {
      adherenceLevel = 'low';
    } else if (adherenceScore < 75) {
      adherenceLevel = 'medium';
    }

    // AI-enhanced adherence recommendations
    let aiRecommendations: any = {};
    try {
      const prompt = `Generate medication adherence support recommendations:

Medications: ${medications.map(m => `${m.name} (${m.frequency})`).join(', ') || 'None specified'}
Current Adherence Score: ${adherenceScore}%
Adherence Level: ${adherenceLevel}

Risk Factors:
${riskFactorsList.map(r => `- ${r}`).join('\n') || 'None identified'}

Social Context:
- Support: ${socialContext.support || 'Not specified'}
- Distance: ${socialContext.distance || 'Not specified'} km
- Transportation: ${socialContext.transportation || 'Not specified'}
- Literacy: ${socialContext.literacy || 'Not specified'}

Previous Adherence: ${JSON.stringify(adherenceHistory, null, 2)}

Provide:
1. Personalized adherence strategies
2. Medication regimen simplification suggestions
3. Reminder system recommendations
4. Caregiver involvement strategies
5. Follow-up monitoring schedule
6. Community health worker engagement (if needed)

Return as JSON with fields: strategies, regimenSimplification, reminderSystem, caregiverInvolvement, followUpSchedule, chwEngagement.`;

      const systemInstruction = `You are a medication adherence specialist for East African healthcare.
Consider:
- Resource limitations (pill organizers, mobile phones)
- Literacy levels
- Cultural beliefs about medication
- Family and community support structures
- Transportation challenges
Provide practical, low-cost interventions that work in resource-limited settings.`;

      const response = await orchestrateAI({
        taskType: 'documentation',
        prompt,
        systemInstruction,
        patientId,
        clinicianId: session.id,
        facilityId: session.hospitalId,
        requireConsensus: false,
      });

      if (response.success && response.text) {
        try {
          aiRecommendations = JSON.parse(response.text);
        } catch (parseError) {
          aiRecommendations = { rawResponse: response.text };
        }
      }
    } catch (error) {
      logger.warn('[Medication Adherence] AI recommendations failed', { error });
    }

    return NextResponse.json({
      success: true,
      adherenceScore: Math.max(0, adherenceScore),
      adherenceLevel,
      riskFactors: riskFactorsList,
      recommendations: aiRecommendations,
      summary: {
        requiresIntervention: adherenceLevel === 'low',
        chwRecommended: adherenceLevel === 'low' || (typeof socialContext.distance === 'number' && socialContext.distance > 30),
        priorityFollowup: adherenceLevel === 'low' ? '7 days' : adherenceLevel === 'medium' ? '14 days' : '30 days',
      },
      metadata: {
        patientId,
        assessedAt: new Date().toISOString(),
        assessedBy: session.name,
      },
    });
  } catch (error) {
    logger.error('[Medication Adherence] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to assess medication adherence' }, { status: 500 });
  }
}

/**
 * GET /api/clinical/medication/adherence
 * 
 * Returns adherence monitoring capabilities and metadata
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['medical', 'pharmacy', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Medication Adherence Monitoring',
    version: '1.0.0',
    description: 'AI-powered medication adherence monitoring and support',
    riskFactors: [
      { factor: 'high_pill_burden', description: 'More than 5 medications' },
      { factor: 'complex_regimen', description: 'Multiple daily doses' },
      { factor: 'poor_social_support', description: 'Limited family/caregiver support' },
      { factor: 'distance', description: 'Long distance from facility' },
      { factor: 'low_literacy', description: 'Difficulty understanding instructions' },
      { factor: 'financial_barriers', description: 'Cost of medications' },
      { factor: 'previous_nonadherence', description: 'History of missed doses' },
    ],
    adherenceLevels: [
      { level: 'high', score: '75-100%', intervention: 'Routine monitoring' },
      { level: 'medium', score: '50-74%', intervention: 'Enhanced support' },
      { level: 'low', score: '0-49%', intervention: 'Intensive intervention' },
    ],
    supportStrategies: [
      { strategy: 'pill_organizers', description: 'Visual medication organization tools' },
      { strategy: 'simplified_regimen', description: 'Reduce dosing frequency when possible' },
      { strategy: 'reminders', description: 'SMS, phone call, or in-person reminders' },
      { strategy: 'caregiver_support', description: 'Engage family members in medication administration' },
      { strategy: 'chw_monitoring', description: 'Community health worker home visits' },
      { strategy: 'education', description: 'Simplified patient education materials' },
    ],
  });
}
