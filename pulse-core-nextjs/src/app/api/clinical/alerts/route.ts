/**
 * Clinical Decision Alerts API
 * 
 * POST /api/clinical/alerts
 * 
 * Provides AI-powered real-time clinical decision alerts for:
 * - Patient deterioration warnings
 * - Drug interaction alerts
 * - Abnormal lab result notifications
 * - Critical vital sign alerts
 * - Clinical guideline reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { PredictiveRiskModels } from '@/lib/predictive-risk-models';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:clinical:alerts');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    patientId?: unknown;
    context?: unknown;
    vitals?: unknown;
    medications?: unknown;
    labResults?: unknown;
    allergies?: unknown;
    conditions?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const patientId = typeof body.patientId === 'string' ? body.patientId : undefined;
  const context = body.context && typeof body.context === 'object' ? body.context as Record<string, unknown> : {};
  const vitals = body.vitals && typeof body.vitals === 'object' ? body.vitals as Record<string, number> : {};
  const medications = body.medications && Array.isArray(body.medications) ? body.medications as string[] : [];
  const labResults = body.labResults && typeof body.labResults === 'object' ? body.labResults as Record<string, unknown> : {};
  const allergies = body.allergies && Array.isArray(body.allergies) ? body.allergies as string[] : [];
  const conditions = body.conditions && Array.isArray(body.conditions) ? body.conditions as string[] : [];

  try {
    const alerts: Array<{
      type: 'critical' | 'high' | 'medium' | 'low';
      category: string;
      message: string;
      recommendation: string;
      requiresAction: boolean;
    }> = [];

    // Check for drug interactions
    if (medications.length > 0) {
      const interactionResult = PredictiveRiskModels.checkDrugInteractions({
        medications,
        allergies,
        conditions,
      });

      if (interactionResult.interactions.length > 0) {
        for (const interaction of interactionResult.interactions) {
          const severity = interaction.severity === 'contraindicated' ? 'critical' :
                        interaction.severity === 'major' ? 'high' :
                        interaction.severity === 'moderate' ? 'medium' : 'low';
          alerts.push({
            type: severity,
            category: 'drug_interaction',
            message: `${interaction.drug1} + ${interaction.drug2}: ${interaction.description}`,
            recommendation: interaction.recommendation,
            requiresAction: severity === 'critical' || severity === 'high',
          });
        }
      }

      if (interactionResult.allergies.length > 0) {
        for (const allergy of interactionResult.allergies) {
          alerts.push({
            type: 'critical',
            category: 'allergy',
            message: `Allergy alert: ${allergy.drug} - ${allergy.reaction}`,
            recommendation: 'Do not administer this medication',
            requiresAction: true,
          });
        }
      }
    }

    // Check for sepsis risk
    const sepsisRisk = PredictiveRiskModels.calculateSepsisRisk({
      respiratoryRate: vitals.respiratoryRate,
      systolicBP: vitals.systolicBP,
      consciousness: context.consciousness as any,
      temperature: vitals.temperature,
      heartRate: vitals.heartRate,
      age: typeof context.age === 'number' ? context.age : undefined,
    });

    if (sepsisRisk.risk === 'critical' || sepsisRisk.risk === 'high') {
      alerts.push({
        type: sepsisRisk.risk === 'critical' ? 'critical' : 'high',
        category: 'sepsis',
        message: `Sepsis risk: ${sepsisRisk.risk.toUpperCase()} (score: ${sepsisRisk.score})`,
        recommendation: sepsisRisk.recommendations[0] || 'Immediate clinical review required',
        requiresAction: sepsisRisk.requiresImmediateAction,
      });
    }

    // Check for abnormal vitals
    if (vitals.spO2 !== undefined && vitals.spO2 < 90) {
      alerts.push({
        type: 'critical',
        category: 'vital_sign',
        message: `Critical SpO2: ${vitals.spO2}%`,
        recommendation: 'Immediate oxygen supplementation and clinical assessment',
        requiresAction: true,
      });
    } else if (vitals.spO2 !== undefined && vitals.spO2 < 94) {
      alerts.push({
        type: 'high',
        category: 'vital_sign',
        message: `Low SpO2: ${vitals.spO2}%`,
        recommendation: 'Monitor oxygen saturation closely',
        requiresAction: false,
      });
    }

    if (vitals.systolicBP !== undefined && vitals.systolicBP < 90) {
      alerts.push({
        type: 'critical',
        category: 'vital_sign',
        message: `Hypotension: BP ${vitals.systolicBP}/${vitals.diastolicBP || '--'} mmHg`,
        recommendation: 'Immediate fluid resuscitation and assessment',
        requiresAction: true,
      });
    }

    if (vitals.heartRate !== undefined && vitals.heartRate > 120) {
      alerts.push({
        type: 'high',
        category: 'vital_sign',
        message: `Tachycardia: HR ${vitals.heartRate} bpm`,
        recommendation: 'Assess for underlying cause (pain, fever, hemorrhage, sepsis)',
        requiresAction: true,
      });
    }

    if (vitals.temperature !== undefined && vitals.temperature > 39) {
      alerts.push({
        type: 'high',
        category: 'vital_sign',
        message: `High fever: ${vitals.temperature.toFixed(1)}°C`,
        recommendation: 'Assess for infection source, consider malaria/typhoid in endemic areas',
        requiresAction: true,
      });
    }

    // Check for abnormal lab results
    if (labResults && Object.keys(labResults).length > 0) {
      for (const [test, value] of Object.entries(labResults)) {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (test.toLowerCase().includes('hemoglobin') && numValue < 7) {
          alerts.push({
            type: 'high',
            category: 'lab_result',
            message: `Severe anemia: ${test} ${value}`,
            recommendation: 'Consider blood transfusion, investigate cause',
            requiresAction: true,
          });
        }
        if (test.toLowerCase().includes('glucose') && numValue > 15) {
          alerts.push({
            type: 'high',
            category: 'lab_result',
            message: `Hyperglycemia: ${test} ${value} mmol/L`,
            recommendation: 'Check for DKA, adjust insulin therapy',
            requiresAction: true,
          });
        }
        if (test.toLowerCase().includes('creatinine') && numValue > 200) {
          alerts.push({
            type: 'high',
            category: 'lab_result',
            message: `Elevated creatinine: ${test} ${value} μmol/L`,
            recommendation: 'Assess renal function, adjust medication dosing',
            requiresAction: true,
          });
        }
      }
    }

    // AI-enhanced alert generation
    let aiAlerts: typeof alerts = [];
    if (alerts.length > 0 || Object.keys(context).length > 0) {
      try {
        const aiPrompt = `Review clinical situation and generate any additional alerts:

Patient Context: ${JSON.stringify(context, null, 2)}
Vitals: ${JSON.stringify(vitals, null, 2)}
Medications: ${medications.join(', ') || 'None'}
Conditions: ${conditions.join(', ') || 'None'}

Existing Alerts: ${alerts.length} alerts generated

Identify any additional clinical concerns not captured by automated rules:
- Drug-disease contraindications
- Age-specific considerations
- Comorbidity interactions
- Local epidemiology considerations

Return as JSON array with fields: type, category, message, recommendation, requiresAction.`;

        const aiResponse = await orchestrateAI({
          taskType: 'diagnosis',
          prompt: aiPrompt,
          systemInstruction: 'You are a clinical pharmacist and safety expert. Generate only clinically significant alerts. Be specific and actionable.',
          patientId,
          clinicianId: session.id,
          facilityId: session.hospitalId,
          requireConsensus: false,
        });

        if (aiResponse.success && aiResponse.text) {
          try {
            aiAlerts = JSON.parse(aiResponse.text);
          } catch (parseError) {
            logger.warn('[Clinical Alerts] Failed to parse AI response', { error: parseError });
          }
        }
      } catch (error) {
        logger.warn('[Clinical Alerts] AI alert generation failed', { error });
      }
    }

    // Combine and prioritize alerts
    const allAlerts = [...alerts, ...aiAlerts];
    const prioritizedAlerts = allAlerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.type] - severityOrder[b.type];
    });

    return NextResponse.json({
      success: true,
      alerts: prioritizedAlerts,
      summary: {
        critical: prioritizedAlerts.filter(a => a.type === 'critical').length,
        high: prioritizedAlerts.filter(a => a.type === 'high').length,
        medium: prioritizedAlerts.filter(a => a.type === 'medium').length,
        low: prioritizedAlerts.filter(a => a.type === 'low').length,
        total: prioritizedAlerts.length,
      },
      requiresImmediateAction: prioritizedAlerts.some(a => a.requiresAction),
      metadata: {
        patientId,
        generatedAt: new Date().toISOString(),
        generatedBy: session.name,
      },
    });
  } catch (error) {
    logger.error('[Clinical Alerts] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate clinical alerts' }, { status: 500 });
  }
}

/**
 * GET /api/clinical/alerts
 * 
 * Returns available alert categories and metadata
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Clinical Decision Alerts',
    version: '1.0.0',
    description: 'AI-powered real-time clinical decision alerts',
    alertCategories: [
      { category: 'drug_interaction', description: 'Drug-drug interactions and contraindications' },
      { category: 'allergy', description: 'Allergy alerts and cross-reactivity' },
      { category: 'sepsis', description: 'Sepsis early warning based on qSOFA/MEWS' },
      { category: 'vital_sign', description: 'Abnormal vital sign thresholds' },
      { category: 'lab_result', description: 'Critical and abnormal lab results' },
      { category: 'clinical_guideline', description: 'Guideline-based care reminders' },
    ],
    severityLevels: [
      { level: 'critical', action: 'Immediate intervention required' },
      { level: 'high', action: 'Urgent clinical review needed' },
      { level: 'medium', action: 'Monitor and consider intervention' },
      { level: 'low', action: 'Informational only' },
    ],
  });
}
