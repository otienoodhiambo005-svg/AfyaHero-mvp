import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { detectOutbreak } from '@/lib/ai-population-health';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

interface DiseaseCluster {
  id: string;
  diseaseName: string;
  location: string;
  ward?: string;
  caseCount: number;
  baseline: number;
  threshold: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
  timeWindow: string;
  symptoms: string[];
  affectedDemographics: {
    ageGroups: { range: string; count: number; percentage: number }[];
    gender: { male: number; female: number };
  };
  recommendedActions: string[];
  publicHealthReportRequired: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:admin:public-health:outbreak-detection',
      roles: ['admin', 'super_admin'],
      requireTrustedOrigin: false,
    });
    if (guard.response) return guard.response;

    const hospitalId = guard.session?.hospitalId;
    if (!hospitalId) {
      return NextResponse.json(
        { error: 'Authenticated session is not linked to a hospital' },
        { status: 403 }
      );
    }

    // Get recent cases from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch recent consultations with diagnoses
    const recentConsultations = await prisma.consultation.findMany({
      where: {
        hospitalId,
        createdAt: {
          gte: sevenDaysAgo,
        },
        diagnosis: {
          not: null,
        },
      },
      include: {
        patient: {
          select: {
            dob: true,
            gender: true,
          },
        },
      },
      take: 500, // Limit to prevent overwhelming the AI
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform consultations to the format expected by detectOutbreak
    const recentCases: {
      diagnosis: string;
      diagnosisCode: string;
      date: string;
      patientAge: number;
      patientGender: string;
      location: string;
      outcome: 'transferred' | 'died' | 'admitted' | 'discharged';
    }[] = recentConsultations.map((consultation) => {
      const patientAge = consultation.patient.dob
        ? Math.floor((new Date().getTime() - new Date(consultation.patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : 0;
      const outcome: 'transferred' | 'died' | 'admitted' | 'discharged' = consultation.status === 'transferred'
        ? 'transferred'
        : consultation.status === 'died'
          ? 'died'
          : consultation.status === 'admitted'
            ? 'admitted'
            : 'discharged';

      return {
        diagnosis: consultation.diagnosis || 'Unknown',
        diagnosisCode: '',
        date: consultation.createdAt.toISOString(),
        patientAge,
        patientGender: consultation.patient.gender || 'unknown',
        location: 'Unknown',
        outcome,
      };
    });

    // Get historical baseline for comparison
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalConsultations = await prisma.consultation.groupBy({
      by: ['diagnosis'],
      where: {
        hospitalId,
        createdAt: {
          gte: thirtyDaysAgo,
          lt: sevenDaysAgo,
        },
        diagnosis: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    // Calculate average weekly cases per diagnosis
    const historicalBaseline = {
      averageWeeklyCases: historicalConsultations.length > 0
        ? Math.round(historicalConsultations.reduce((sum, h) => sum + h._count.id, 0) / 4)
        : 5,
    };

    // Detect outbreaks using AI
    const outbreaks = await detectOutbreak({
      facilityId: hospitalId,
      recentCases,
      historicalBaseline,
    });

    // Transform OutbreakDetection to DiseaseCluster format
    const clusters: DiseaseCluster[] = outbreaks.map((outbreak, index) => {
      // Determine risk level based on case count and confidence
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (outbreak.confirmedCases >= outbreak.suspectedCases * 0.8 && outbreak.confirmedCases > 20) {
        riskLevel = 'critical';
      } else if (outbreak.confirmedCases > 10) {
        riskLevel = 'high';
      } else if (outbreak.confirmedCases > 5) {
        riskLevel = 'medium';
      }

      // Determine trend (simplified - in production would compare with previous period)
      const trend: 'increasing' | 'stable' | 'decreasing' = 'increasing';
      const trendPercentage = outbreak.confirmedCases > 0
        ? Math.round((outbreak.confirmedCases / (historicalBaseline.averageWeeklyCases || 1)) * 100)
        : 0;

      // Transform demographics
      const ageGroupsMap = new Map<string, number>();
      let maleCount = 0;
      let femaleCount = 0;

      outbreak.affectedDemographics.forEach((demo) => {
        // Group ages into ranges
        const age = Number(demo.ageGroup);
        let range = '0-17';
        if (age >= 18 && age <= 35) range = '18-35';
        else if (age >= 36 && age <= 50) range = '36-50';
        else if (age >= 51 && age <= 65) range = '51-65';
        else if (age > 65) range = '65+';

        ageGroupsMap.set(range, (ageGroupsMap.get(range) || 0) + demo.cases);

        if (demo.gender.toLowerCase() === 'male') maleCount += demo.cases;
        else if (demo.gender.toLowerCase() === 'female') femaleCount += demo.cases;
      });

      const totalCases = outbreak.affectedDemographics.reduce((sum, demo) => sum + demo.cases, 0);
      const ageGroups = Array.from(ageGroupsMap.entries()).map(([range, count]) => ({
        range,
        count,
        percentage: totalCases > 0 ? Math.round((count / totalCases) * 100) : 0,
      }));

      // Get primary location
      const primaryLocation = outbreak.geographicClusters[0]?.location || outbreak.facilityId;

      // Generate symptoms based on disease (simplified - in production would use medical knowledge base)
      const symptoms = generateSymptomsForDisease(outbreak.disease);

      return {
        id: `cluster-${Date.now()}-${index}`,
        diseaseName: outbreak.disease,
        location: primaryLocation,
        caseCount: outbreak.confirmedCases,
        baseline: historicalBaseline.averageWeeklyCases,
        threshold: historicalBaseline.averageWeeklyCases * 2,
        riskLevel,
        trend,
        trendPercentage,
        timeWindow: 'Last 7 days',
        symptoms,
        affectedDemographics: {
          ageGroups,
          gender: {
            male: maleCount,
            female: femaleCount,
          },
        },
        recommendedActions: outbreak.recommendedActions,
        publicHealthReportRequired: outbreak.requiresAction,
      };
    });

    logger.info('Outbreak detection completed', {
      hospitalId,
      clustersFound: clusters.length,
    });

    return NextResponse.json({
      clusters,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Outbreak detection error', { error });
    return NextResponse.json(
      { error: 'Failed to detect outbreaks' },
      { status: 500 }
    );
  }
}

// Helper function to generate symptoms based on disease (simplified)
function generateSymptomsForDisease(disease: string): string[] {
  const diseaseLower = disease.toLowerCase();

  const symptomMap: Record<string, string[]> = {
    malaria: ['Fever', 'Headache', 'Chills', 'Joint pain', 'Fatigue', 'Nausea'],
    cholera: ['Severe watery diarrhea', 'Vomiting', 'Dehydration', 'Leg cramps'],
    measles: ['Fever', 'Cough', 'Runny nose', 'Red eyes', 'Rash'],
    'influenza': ['Fever', 'Cough', 'Sore throat', 'Body aches', 'Fatigue'],
    dengue: ['High fever', 'Severe headache', 'Joint pain', 'Muscle pain', 'Rash'],
    typhoid: ['High fever', 'Headache', 'Abdominal pain', 'Constipation', 'Weakness'],
    tuberculosis: ['Persistent cough', 'Fever', 'Night sweats', 'Weight loss', 'Fatigue'],
    'covid-19': ['Fever', 'Cough', 'Shortness of breath', 'Loss of taste/smell', 'Fatigue'],
  };

  // Check for partial matches
  for (const [key, symptoms] of Object.entries(symptomMap)) {
    if (diseaseLower.includes(key)) {
      return symptoms;
    }
  }

  // Default symptoms for unknown diseases
  return ['Fever', 'Fatigue', 'Body aches'];
}
