import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface BedPrediction {
  bedId: string;
  ward: string;
  bedNumber: string;
  currentPatient?: string;
  predictedDischargeTime: string;
  dischargeProbability: number;
  recommendedAction: 'maintain' | 'prepare' | 'allocate';
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

interface WardCapacity {
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  predictedDischarges24h: number;
  predictedAdmissions24h: number;
  projectedCapacity24h: number;
  utilizationRate: number;
}

interface HospitalBedWithPatient {
  id: string;
  wardName: string;
  bedNumber: string;
  status: string;
  patientId: string | null;
  patientName: string | null;
  patient?: {
    id: string;
    name: string;
    dob: Date;
  } | null;
}

export const GET = withAuthzAndTenant(async (request: NextRequest, { hospitalId }: AuthzContext) => {
  try {
    // Fetch current bed assignments
    const hospitalBeds = await prisma.hospitalBed.findMany({
      where: {
        hospitalId,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
          },
        },
      },
      orderBy: [
        { wardName: 'asc' },
        { bedNumber: 'asc' },
      ],
    });

    // Group beds by ward
    const bedsByWard = new Map<string, typeof hospitalBeds>();
    for (const bed of hospitalBeds) {
      if (!bedsByWard.has(bed.wardName)) {
        bedsByWard.set(bed.wardName, []);
      }
      bedsByWard.get(bed.wardName)!.push(bed);
    }

    // Calculate predictions for each occupied bed
    const predictions: BedPrediction[] = [];
    const wardCapacity: WardCapacity[] = [];

    // Get recent consultations for discharge prediction
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const [ward, beds] of bedsByWard) {
      const totalBeds = beds.length;
      const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
      const availableBeds = totalBeds - occupiedBeds;

      // Predict discharges and admissions for next 24h
      const predictedDischarges24h = await predictDischarges(beds, hospitalId);
      const predictedAdmissions24h = await predictAdmissions(hospitalId, ward);
      const projectedCapacity24h = occupiedBeds - predictedDischarges24h + predictedAdmissions24h;
      const utilizationRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      wardCapacity.push({
        wardName: ward,
        totalBeds,
        occupiedBeds,
        availableBeds,
        predictedDischarges24h,
        predictedAdmissions24h,
        projectedCapacity24h,
        utilizationRate,
      });

      // Generate predictions for occupied beds
      for (const bed of beds.filter(b => b.status === 'occupied')) {
        if (bed.patient) {
          const prediction = await generateBedPrediction(bed, hospitalId);
          predictions.push(prediction);
        }
      }
    }

    // Sort predictions by discharge probability (highest first)
    predictions.sort((a, b) => b.dischargeProbability - a.dischargeProbability);

    logger.info('Bed predictive management completed', {
      hospitalId,
      predictionsGenerated: predictions.length,
      wardsAnalyzed: wardCapacity.length,
    });

    return NextResponse.json({
      predictions,
      wardCapacity,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Bed predictive management error', { error });
    return NextResponse.json(
      { error: 'Failed to generate bed predictions' },
      { status: 500 }
    );
  }
}, ['admin']);

async function predictDischarges(beds: HospitalBedWithPatient[], hospitalId: string): Promise<number> {
  const occupiedBeds = beds.filter(b => b.status === 'occupied');
  
  if (occupiedBeds.length === 0) return 0;

  // Get recent consultations for occupied patients
  const patientIds = occupiedBeds
    .map(b => b.patientId)
    .filter((id): id is string => id !== null);

  if (patientIds.length === 0) return 0;

  const recentConsultations = await prisma.consultation.findMany({
    where: {
      hospitalId,
      patientId: { in: patientIds },
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Count patients likely to be discharged in next 24h
  let likelyDischarges = 0;
  
  for (const consultation of recentConsultations) {
    // Simple heuristic: if status is 'Completed' in recent consultations, patient likely ready
    if (consultation.status === 'Completed') {
      likelyDischarges++;
    }
  }

  // Estimate based on average length of stay (simplified)
  const avgStayDays = 5; // Industry average
  const patientsPerDay = patientIds.length / avgStayDays;
  
  return Math.round(patientsPerDay + likelyDischarges * 0.3);
}

async function predictAdmissions(hospitalId: string, ward: string): Promise<number> {
  // Get recent appointments for the ward
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingAppointments = await prisma.appointment.count({
    where: {
      hospitalId,
      status: 'Pending',
      scheduledAt: {
        gte: today,
        lte: tomorrow,
      },
    },
  });

  // Estimate 30% of appointments will require admission
  return Math.round(upcomingAppointments * 0.3);
}

async function generateBedPrediction(bed: HospitalBedWithPatient, hospitalId: string): Promise<BedPrediction> {
  const patientId = bed.patientId;
  if (!patientId) {
    return {
      bedId: bed.id,
      ward: bed.wardName,
      bedNumber: bed.bedNumber,
      currentPatient: bed.patientName || 'Unknown',
      predictedDischargeTime: new Date().toISOString(),
      dischargeProbability: 0,
      recommendedAction: 'maintain',
      priority: 'low',
      reason: 'No patient assigned',
    };
  }

  // Get recent consultation for the patient
  const recentConsultation = await prisma.consultation.findFirst({
    where: {
      hospitalId,
      patientId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get recent vitals for the patient (separate query — no relation on Consultation)
  const latestVitals = patientId ? await prisma.clinicalVital.findFirst({
    where: {
      hospitalId,
      patientId,
    },
    orderBy: {
      recordedAt: 'desc',
    },
  }) : null;

  // Calculate discharge probability based on clinical data
  let dischargeProbability = 50; // Base probability
  let recommendedAction: 'maintain' | 'prepare' | 'allocate' = 'maintain';
  let priority: 'low' | 'medium' | 'high' = 'low';
  let reason = 'Routine monitoring';

  if (latestVitals) {
    // Simple stability check using schema field names
    const tempC = latestVitals.tempC ? Number(latestVitals.tempC) : 0;
    const systolicBP = latestVitals.bloodPressure ? parseInt(latestVitals.bloodPressure.split('/')[0], 10) || 0 : 0;
    const heartRate = latestVitals.heartRate || 0;

    const isStable =
      tempC >= 36 && tempC <= 37.5 &&
      systolicBP >= 90 && systolicBP <= 140 &&
      heartRate >= 60 && heartRate <= 100;

    if (isStable) {
      dischargeProbability += 20;
      recommendedAction = 'prepare';
      reason = 'Patient vitals stable, preparing for discharge';
    } else {
      dischargeProbability -= 20;
      recommendedAction = 'maintain';
      priority = 'medium';
      reason = 'Patient vitals require monitoring';
    }
  }

  if (recentConsultation) {
    // Check consultation status for discharge readiness
    if (recentConsultation.status === 'Completed') {
      dischargeProbability = 90;
      recommendedAction = 'allocate';
      reason = 'Consultation completed, patient marked for discharge';
    } else if (recentConsultation.status === 'In Progress') {
      dischargeProbability -= 10;
      recommendedAction = 'maintain';
      reason = 'Patient currently in consultation';
    }

    // Calculate days since admission
    const daysSinceAdmission = Math.floor(
      (Date.now() - new Date(recentConsultation.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceAdmission >= 7) {
      dischargeProbability += 15;
      reason = 'Extended stay, review for discharge';
    } else if (daysSinceAdmission >= 3) {
      dischargeProbability += 5;
    }
  }

  // Clamp probability to 0-100
  dischargeProbability = Math.max(0, Math.min(100, dischargeProbability));

  // Determine priority based on probability and action
  if (dischargeProbability >= 80) {
    priority = 'high';
    recommendedAction = 'allocate';
  } else if (dischargeProbability >= 60) {
    priority = 'medium';
    recommendedAction = 'prepare';
  } else if (dischargeProbability <= 30) {
    priority = 'high';
    recommendedAction = 'maintain';
  }

  // Predict discharge time (simplified - in production would use ML)
  const hoursToDischarge = Math.round((100 - dischargeProbability) / 10);
  const predictedDischargeTime = new Date(Date.now() + hoursToDischarge * 60 * 60 * 1000);

  return {
    bedId: bed.id,
    ward: bed.wardName,
    bedNumber: bed.bedNumber,
    currentPatient: bed.patient?.name || bed.patientName || 'Unknown',
    predictedDischargeTime: predictedDischargeTime.toISOString(),
    dischargeProbability,
    recommendedAction,
    priority,
    reason,
  };
}
