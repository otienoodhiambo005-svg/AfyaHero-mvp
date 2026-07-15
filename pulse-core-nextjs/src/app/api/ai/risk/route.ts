/**
 * POST /api/ai/risk
 * 
 * Predictive risk assessment endpoint for offline-capable clinical risk models.
 * Provides fast, local risk calculations for:
 * - Sepsis early warning
 * - Maternal deterioration
 * - Pediatric deterioration
 * - Readmission risk
 * - Drug interactions
 * 
 * These models run on structured numerical data and don't require cloud AI calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import {
  calculateSepsisRisk,
  calculateMaternalRisk,
  calculatePediatricRisk,
  calculateReadmissionRisk,
  checkDrugInteractions,
} from '@/lib/predictive-risk-models';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:risk');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      type?: unknown;
      data?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate type
    const riskType = body.type;
    const validTypes = ['sepsis', 'maternal', 'pediatric', 'readmission', 'drug-interaction'];
    if (!riskType || typeof riskType !== 'string' || !validTypes.includes(riskType)) {
      return NextResponse.json(
        { error: `Invalid type. Valid values: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate data
    if (!body.data || typeof body.data !== 'object') {
      return NextResponse.json(
        { error: 'data object is required' },
        { status: 400 },
      );
    }

    const data = body.data as Record<string, unknown>;
    const start = Date.now();
    let result: any;

    switch (riskType) {
      case 'sepsis': {
        result = calculateSepsisRisk({
          respiratoryRate: data.respiratoryRate as number | undefined,
          systolicBP: data.systolicBP as number | undefined,
          consciousness: data.consciousness as 'alert' | 'voice' | 'pain' | 'unresponsive' | undefined,
          temperature: data.temperature as number | undefined,
          heartRate: data.heartRate as number | undefined,
          age: data.age as number | undefined,
        });
        break;
      }

      case 'maternal': {
        result = calculateMaternalRisk({
          systolicBP: data.systolicBP as number | undefined,
          diastolicBP: data.diastolicBP as number | undefined,
          temperature: data.temperature as number | undefined,
          heartRate: data.heartRate as number | undefined,
          respiratoryRate: data.respiratoryRate as number | undefined,
          spO2: data.spO2 as number | undefined,
          consciousness: data.consciousness as 'alert' | 'voice' | 'pain' | 'unresponsive' | undefined,
          gestationalWeeks: data.gestationalWeeks as number | undefined,
          isPostpartum: data.isPostpartum as boolean | undefined,
          vaginalBleeding: data.vaginalBleeding as 'none' | 'light' | 'moderate' | 'heavy' | undefined,
          abdominalPain: data.abdominalPain as boolean | undefined,
          headache: data.headache as boolean | undefined,
          visualDisturbances: data.visualDisturbances as boolean | undefined,
          proteinuria: data.proteinuria as 'negative' | '1+' | '2+' | '3+' | '4+' | undefined,
          contractions: data.contractions as boolean | undefined,
          ruptureOfMembranes: data.ruptureOfMembranes as boolean | undefined,
        });
        break;
      }

      case 'pediatric': {
        if (data.age === undefined || typeof data.age !== 'number') {
          return NextResponse.json(
            { error: 'age is required for pediatric risk assessment' },
            { status: 400 },
          );
        }
        result = calculatePediatricRisk({
          age: data.age,
          consciousness: data.consciousness as 'alert' | 'voice' | 'pain' | 'unresponsive' | undefined,
          heartRate: data.heartRate as number | undefined,
          respiratoryRate: data.respiratoryRate as number | undefined,
          spO2: data.spO2 as number | undefined,
          capillaryRefillTime: data.capillaryRefillTime as number | undefined,
          temperature: data.temperature as number | undefined,
        });
        break;
      }

      case 'readmission': {
        if (data.age === undefined || typeof data.age !== 'number') {
          return NextResponse.json(
            { error: 'age is required for readmission risk assessment' },
            { status: 400 },
          );
        }
        if (!Array.isArray(data.diagnosis) || !Array.isArray(data.comorbidities)) {
          return NextResponse.json(
            { error: 'diagnosis and comorbidities arrays are required' },
            { status: 400 },
          );
        }
        result = calculateReadmissionRisk({
          age: data.age,
          diagnosis: data.diagnosis as string[],
          comorbidities: data.comorbidities as string[],
          previousAdmissions: data.previousAdmissions as number | undefined,
          lengthOfStay: data.lengthOfStay as number | undefined,
          dischargeCondition: data.dischargeCondition as 'stable' | 'improved' | 'unchanged' | 'deteriorated' | undefined,
          socialSupport: data.socialSupport as 'good' | 'moderate' | 'poor' | 'none' | undefined,
          distanceFromFacility: data.distanceFromFacility as number | undefined,
          followUpScheduled: data.followUpScheduled as boolean | undefined,
          medicationAdherence: data.medicationAdherence as 'good' | 'moderate' | 'poor' | undefined,
        });
        break;
      }

      case 'drug-interaction': {
        if (!Array.isArray(data.medications)) {
          return NextResponse.json(
            { error: 'medications array is required' },
            { status: 400 },
          );
        }
        result = checkDrugInteractions({
          medications: data.medications as string[],
          allergies: Array.isArray(data.allergies) ? data.allergies as string[] : undefined,
          conditions: Array.isArray(data.conditions) ? data.conditions as string[] : undefined,
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid risk type' },
          { status: 400 },
        );
    }

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      ...result,
      latencyMs,
      offline: true,
    });

  } catch (err) {
    logger.error('[Risk route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/risk
 * 
 * Returns available risk assessment types
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    return NextResponse.json({
      name: 'Predictive Risk Models',
      version: '1.0.0',
      description: 'Offline-capable clinical risk assessment models',
      availableTypes: {
        sepsis: {
          name: 'Sepsis Early Warning',
          description: 'qSOFA-based sepsis risk assessment',
          requiredFields: ['respiratoryRate', 'systolicBP', 'consciousness'],
          optionalFields: ['temperature', 'heartRate', 'age'],
        },
        maternal: {
          name: 'Maternal Deterioration Risk',
          description: 'Screens for pre-eclampsia, hemorrhage, sepsis, obstructed labor',
          requiredFields: ['systolicBP', 'diastolicBP'],
          optionalFields: ['temperature', 'heartRate', 'gestationalWeeks', 'vaginalBleeding', 'headache', 'visualDisturbances', 'proteinuria'],
        },
        pediatric: {
          name: 'Pediatric Deterioration Risk',
          description: 'PEWS-based pediatric early warning score',
          requiredFields: ['age'],
          optionalFields: ['consciousness', 'heartRate', 'respiratoryRate', 'spO2', 'capillaryRefillTime', 'temperature'],
        },
        readmission: {
          name: 'Readmission Risk Scoring',
          description: 'Predicts risk of hospital readmission',
          requiredFields: ['age', 'diagnosis', 'comorbidities'],
          optionalFields: ['previousAdmissions', 'dischargeCondition', 'socialSupport', 'distanceFromFacility', 'followUpScheduled', 'medicationAdherence'],
        },
        'drug-interaction': {
          name: 'Drug Interaction Checker',
          description: 'Checks for medication interactions and allergies',
          requiredFields: ['medications'],
          optionalFields: ['allergies', 'conditions'],
        },
      },
      features: {
        offline: true,
        fastExecution: true,
        africanContext: true,
      },
    });
  } catch (err) {
    logger.error('[Risk GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}