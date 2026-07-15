import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface DischargePrediction {
  predictedDischargeDate: string;
  lengthOfStayDays: number;
  readinessScore: number; // 0-100
  riskFactors: string[];
  confidence: number;
  recommendations: string[];
}

export const GET = withAuthzAndTenant(async (
  request: NextRequest,
  { hospitalId }: AuthzContext
) => {
  // Extract patientId from URL path (outside try for catch access)
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const patientId = pathSegments[pathSegments.indexOf('patients') + 1];

  if (!patientId) {
    return NextResponse.json({ error: 'Patient ID required' }, { status: 400 });
  }

  try {

    // Get patient with current admission data
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId },
      include: {
        clinicalVitals: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
        appointments: {
          where: { status: 'admitted' },
          orderBy: { appointmentDate: 'desc' },
          take: 1,
        },
        prescriptions: {
          where: { status: 'active' },
        },
        labRequests: {
          where: { status: { in: ['pending', 'in_progress'] } },
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const prediction = await generateDischargePrediction(patient, hospitalId);

    logger.info('Discharge prediction generated', {
      patientId,
      hospitalId,
      readinessScore: prediction.readinessScore,
    });

    return NextResponse.json(prediction);
  } catch (error) {
    logger.error('Discharge prediction error', { error, patientId });
    return NextResponse.json(
      { error: 'Failed to generate discharge prediction' },
      { status: 500 }
    );
  }
}, ['admin', 'medical']);

async function generateDischargePrediction(
  patient: any,
  hospitalId: string
): Promise<DischargePrediction> {
  const now = new Date();
  const admissionDate = patient.appointments[0]?.appointmentDate || now;
  const currentLOS = Math.max(0, Math.floor((now.getTime() - new Date(admissionDate).getTime()) / (1000 * 60 * 60 * 24)));

  // Analyze vitals for stability
  const vitals = patient.clinicalVitals || [];
  const latestVitals = vitals[0];
  const vitalsTrend = analyzeVitalsTrend(vitals);

  // Check pending items
  const pendingLabs = patient.labRequests?.length || 0;
  const activePrescriptions = patient.prescriptions?.length || 0;

  // Calculate readiness score (0-100)
  let readinessScore = 50; // Base score

  // Vital signs stability (+30)
  if (vitalsTrend === 'stable') readinessScore += 30;
  else if (vitalsTrend === 'improving') readinessScore += 25;
  else if (vitalsTrend === 'worsening') readinessScore -= 20;

  // No pending labs (+20)
  if (pendingLabs === 0) readinessScore += 20;
  else readinessScore -= (pendingLabs * 5);

  // Treatment completion (+20)
  if (activePrescriptions === 0) readinessScore += 20;
  else readinessScore -= Math.min(15, activePrescriptions * 3);

  // Length of stay appropriateness
  const typicalLOS = getTypicalLOS(patient.primaryDiagnosis || 'general');
  if (currentLOS >= typicalLOS * 0.75) readinessScore += 10;
  if (currentLOS >= typicalLOS * 1.5) readinessScore -= 15; // Overstay penalty

  readinessScore = Math.max(0, Math.min(100, readinessScore));

  // Predict discharge date
  const predictedDays = readinessScore >= 80 ? 1 :
                        readinessScore >= 60 ? 2 :
                        readinessScore >= 40 ? 3 : 5;

  const predictedDischargeDate = new Date(now);
  predictedDischargeDate.setDate(predictedDischargeDate.getDate() + predictedDays);

  // Generate risk factors
  const riskFactors: string[] = [];
  if (vitalsTrend === 'worsening') riskFactors.push('Vital signs trending downward');
  if (pendingLabs > 0) riskFactors.push(`${pendingLabs} pending lab result(s)`);
  if (activePrescriptions > 0) riskFactors.push('Active treatment course in progress');
  if (currentLOS > typicalLOS * 1.2) riskFactors.push('Extended length of stay');

  // Generate recommendations
  const recommendations: string[] = [];
  if (readinessScore >= 80) {
    recommendations.push('Patient ready for discharge planning');
    recommendations.push('Initiate discharge documentation');
  } else if (readinessScore >= 60) {
    recommendations.push('Continue current treatment protocol');
    recommendations.push('Schedule follow-up appointment');
  } else {
    recommendations.push('Continue close monitoring');
    recommendations.push('Reassess treatment plan');
    if (pendingLabs > 0) recommendations.push('Follow up on pending lab results');
  }

  return {
    predictedDischargeDate: predictedDischargeDate.toISOString(),
    lengthOfStayDays: currentLOS,
    readinessScore,
    riskFactors,
    confidence: calculateConfidence(vitals.length, pendingLabs),
    recommendations,
  };
}

function analyzeVitalsTrend(vitals: any[]): 'stable' | 'improving' | 'worsening' | 'insufficient' {
  if (vitals.length < 3) return 'insufficient';

  const recent = vitals.slice(0, 3);
  const older = vitals.slice(3, 6);

  if (older.length === 0) return 'stable';

  // Simple trend analysis based on heart rate and blood pressure
  const recentHR = recent.map((v: any) => v.heartRate || 0).filter((v: number) => v > 0);
  const olderHR = older.map((v: any) => v.heartRate || 0).filter((v: number) => v > 0);

  if (recentHR.length === 0 || olderHR.length === 0) return 'stable';

  const recentAvg = recentHR.reduce((a: number, b: number) => a + b, 0) / recentHR.length;
  const olderAvg = olderHR.reduce((a: number, b: number) => a + b, 0) / olderHR.length;

  if (recentAvg < olderAvg - 5) return 'improving';
  if (recentAvg > olderAvg + 5) return 'worsening';
  return 'stable';
}

function getTypicalLOS(diagnosis: string): number {
  const losMap: Record<string, number> = {
    'malaria': 3,
    'typhoid': 5,
    'pneumonia': 7,
    'fracture': 14,
    'surgery': 10,
    'general': 5,
  };
  return losMap[diagnosis.toLowerCase()] || 5;
}

function calculateConfidence(vitalsCount: number, pendingLabs: number): number {
  let confidence = 0.7;
  if (vitalsCount >= 5) confidence += 0.15;
  if (vitalsCount >= 10) confidence += 0.1;
  if (pendingLabs === 0) confidence += 0.05;
  return Math.min(0.95, confidence);
}


