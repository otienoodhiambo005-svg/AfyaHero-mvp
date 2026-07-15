/**
 * AI-Native Population Health Module - AfyaHero
 * 
 * Provides AI-assisted population health features:
 * - Disease surveillance and outbreak detection
 * - Cross-facility referral network coordination
 * - Antimicrobial resistance (AMR) surveillance
 * - Health system performance monitoring
 * - AHI (Afya Health Intelligence) data products
 */

import { orchestrateAI } from '@/lib/ai-orchestrator';
import type { FacilityEpidemiology } from '@/lib/clinical-memory';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OutbreakDetection {
  disease: string;
  detectedAt: string;
  facilityId: string;
  suspectedCases: number;
  confirmedCases: number;
  deaths: number;
  attackRate: number;
  caseFatalityRate: number;
  affectedDemographics: Array<{
    ageGroup: string;
    gender: string;
    cases: number;
  }>;
  geographicClusters: Array<{
    location: string;
    cases: number;
    coordinates?: { lat: number; lng: number };
  }>;
  confidence: number;
  requiresAction: boolean;
  recommendedActions: string[];
}

export interface ReferralNetwork {
  referringFacility: {
    id: string;
    name: string;
    level: 'dispensary' | 'health_center' | 'hospital' | 'referral';
    capabilities: string[];
  };
  receivingFacility: {
    id: string;
    name: string;
    level: 'dispensary' | 'health_center' | 'hospital' | 'referral';
    capabilities: string[];
    bedAvailability?: number;
    icuAvailability?: number;
  };
  patient: {
    condition: string;
    urgency: 'routine' | 'urgent' | 'emergency';
    requiredCapabilities: string[];
  };
  referralStatus: 'pending' | 'accepted' | 'in_transit' | 'completed' | 'rejected';
  transportArranged: boolean;
  estimatedTravelTime: number; // minutes
}

export interface AMRSurveillance {
  organism: string;
  antibiotic: string;
  facilityId: string;
  resistanceRate: number;
  sampleSize: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  comparedToNational: number; // percentage points difference
  riskFactors: string[];
  recommendations: string[];
}

export interface HealthSystemPerformance {
  facilityId: string;
  metrics: {
    patientVolume: {
      total: number;
      byDepartment: Record<string, number>;
      trend: 'increasing' | 'stable' | 'decreasing';
    };
    waitingTimes: {
      average: number; // minutes
      byDepartment: Record<string, number>;
    };
    qualityIndicators: {
      maternalMortalityRatio: number;
      neonatalMortalityRate: number;
      surgicalSiteInfectionRate: number;
      medicationErrorRate: number;
    };
    resourceUtilization: {
      bedOccupancyRate: number;
      averageLengthOfStay: number;
      readmissionRate: number;
    };
  };
  alerts: Array<{
    type: 'capacity' | 'quality' | 'efficiency' | 'safety';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendations: string[];
  }>;
}

export interface AHIReport {
  reportType: 'epidemiological' | 'operational' | 'financial' | 'quality';
  facilityId?: string;
  region?: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    keyFindings: string[];
    trends: Array<{ indicator: string; value: number; change: number }>;
    alerts: string[];
  };
  recommendations: string[];
  generatedAt: string;
  confidence: number;
}

// ─── Outbreak Detection ───────────────────────────────────────────────────────

/**
 * Detect potential disease outbreaks from case data
 */
export async function detectOutbreak(params: {
  facilityId: string;
  recentCases: Array<{
    diagnosis: string;
    diagnosisCode: string;
    date: string;
    patientAge: number;
    patientGender: string;
    location?: string;
    outcome?: 'discharged' | 'admitted' | 'transferred' | 'died';
  }>;
  historicalBaseline?: {
    averageWeeklyCases: number;
    seasonalAdjustment?: number;
  };
}): Promise<OutbreakDetection[]> {
  const { facilityId, recentCases, historicalBaseline } = params;
  const outbreaks: OutbreakDetection[] = [];
  
  // Group cases by diagnosis
  const casesByDiagnosis = new Map<string, typeof recentCases>();
  for (const case_ of recentCases) {
    const diagnosis = case_.diagnosis.toLowerCase();
    if (!casesByDiagnosis.has(diagnosis)) {
      casesByDiagnosis.set(diagnosis, []);
    }
    casesByDiagnosis.get(diagnosis)!.push(case_);
  }
  
  // Check each diagnosis for outbreak signals
  for (const [diagnosis, cases] of casesByDiagnosis) {
    // Skip non-communicable diseases
    const nonCommunicable = ['diabetes', 'hypertension', 'asthma', 'arthritis', 'epilepsy'];
    if (nonCommunicable.some(nc => diagnosis.includes(nc))) continue;
    
    const caseCount = cases.length;
    const expectedCount = historicalBaseline?.averageWeeklyCases || 5;
    const threshold = expectedCount * 2; // Simple threshold: 2x expected
    
    // Check if this exceeds threshold
    if (caseCount >= threshold || (caseCount >= 3 && isNotifiableDisease(diagnosis))) {
      // Calculate demographics
      const ageGroups = new Map<string, number>();
      const genderCounts = new Map<string, number>();
      const locationCounts = new Map<string, number>();
      let deaths = 0;
      
      for (const case_ of cases) {
        const ageGroup = getAgeGroup(case_.patientAge);
        ageGroups.set(ageGroup, (ageGroups.get(ageGroup) || 0) + 1);
        genderCounts.set(case_.patientGender, (genderCounts.get(case_.patientGender) || 0) + 1);
        if (case_.location) {
          locationCounts.set(case_.location, (locationCounts.get(case_.location) || 0) + 1);
        }
        if (case_.outcome === 'died') deaths++;
      }
      
      const attackRate = (caseCount / expectedCount) * 100;
      const caseFatalityRate = (deaths / caseCount) * 100;
      
      // Use AI to assess outbreak likelihood and provide recommendations
      try {
        const aiPrompt = `
Analyze this potential disease outbreak:

Disease: ${diagnosis}
Suspected Cases: ${caseCount}
Expected Baseline: ${expectedCount} cases/week
Deaths: ${deaths}

Demographics:
${Array.from(ageGroups.entries()).map(([age, count]) => `- ${age} years: ${count} cases`).join('\n')}

${Array.from(locationCounts.entries()).map(([loc, count]) => `- ${loc}: ${count} cases`).join('\n')}

Case Fatality Rate: ${caseFatalityRate.toFixed(1)}%

Provide:
1. Assessment of outbreak likelihood (0-100%)
2. Recommended immediate actions
3. Public health measures needed
4. Required reporting and notification

Return as JSON with fields: confidence, requiresAction, recommendedActions.
`.trim();

        const response = await orchestrateAI({
          taskType: 'population_health',
          prompt: aiPrompt,
          systemInstruction: 'You are an epidemiologist specializing in outbreak detection and response in African settings. Be conservative to avoid false alarms but sensitive to real threats.',
          requireConsensus: true,
        });

        if (response.success && response.text) {
          const aiAssessment = JSON.parse(response.text);
          
          outbreaks.push({
            disease: diagnosis,
            detectedAt: new Date().toISOString(),
            facilityId,
            suspectedCases: caseCount,
            confirmedCases: Math.floor(caseCount * 0.7), // Estimate
            deaths,
            attackRate,
            caseFatalityRate,
            affectedDemographics: Array.from(ageGroups.entries()).map(([age, cases]) => ({
              ageGroup: age,
              gender: 'mixed',
              cases,
            })),
            geographicClusters: Array.from(locationCounts.entries()).map(([location, cases]) => ({
              location,
              cases,
            })),
            confidence: aiAssessment.confidence / 100,
            requiresAction: aiAssessment.requiresAction,
            recommendedActions: aiAssessment.recommendedActions,
          });
        }
      } catch (error) {
        logger.warn('[AI Population Health] Outbreak detection AI failed', { error });
      }
    }
  }
  
  return outbreaks.sort((a, b) => b.confidence - a.confidence);
}

function isNotifiableDisease(diagnosis: string): boolean {
  const notifiable = [
    'cholera', 'typhoid', 'dysentery', 'meningitis', 'yellow fever',
    'measles', 'polio', 'diphtheria', 'pertussis', 'tetanus',
    'rabies', 'anthrax', 'plague', 'viral hemorrhagic fever',
    'acute flaccid paralysis', 'neonatal tetanus', 'maternal tetanus',
    'malaria', 'tuberculosis', 'hiv', 'hepatitis', 'covid-19',
  ];
  return notifiable.some(nd => diagnosis.includes(nd));
}

function getAgeGroup(age: number): string {
  if (age < 1) return '0-1';
  if (age < 5) return '1-4';
  if (age < 15) return '5-14';
  if (age < 25) return '15-24';
  if (age < 45) return '25-44';
  if (age < 65) return '45-64';
  return '65+';
}

// ─── Cross-Facility Referral Network ──────────────────────────────────────────

/**
 * Coordinate referrals across facility network
 */
export async function coordinateReferral(params: {
  referringFacility: {
    id: string;
    name: string;
    level: ReferralNetwork['referringFacility']['level'];
    capabilities: string[];
  };
  patientCondition: {
    diagnosis: string;
    severity: 'stable' | 'serious' | 'critical';
    requiredCapabilities: string[];
    patientAge: number;
    isPregnant?: boolean;
  };
  availableFacilities: Array<{
    id: string;
    name: string;
    level: ReferralNetwork['receivingFacility']['level'];
    capabilities: string[];
    distance: number; // km
    bedAvailability?: number;
    icuAvailability?: number;
  }>;
}): Promise<ReferralNetwork | null> {
  const { referringFacility, patientCondition, availableFacilities } = params;
  
  // Filter facilities that can handle this case
  const suitableFacilities = availableFacilities.filter(facility => {
    // Must have required capabilities
    const hasCapabilities = patientCondition.requiredCapabilities.every(cap =>
      facility.capabilities.includes(cap)
    );
    
    // Level must be appropriate
    const levelHierarchy = { dispensary: 1, health_center: 2, hospital: 3, referral: 4 };
    const referringLevel = levelHierarchy[referringFacility.level];
    const facilityLevel = levelHierarchy[facility.level];
    
    // For critical cases, must go to higher level
    if (patientCondition.severity === 'critical' && facilityLevel <= referringLevel) {
      return false;
    }
    
    return hasCapabilities && facilityLevel >= referringLevel;
  });
  
  if (suitableFacilities.length === 0) {
    return null;
  }
  
  // Score and rank facilities
  const scoredFacilities = suitableFacilities.map(facility => {
    let score = 0;
    
    // Capability match (40%)
    const capabilityScore = patientCondition.requiredCapabilities.filter(cap =>
      facility.capabilities.includes(cap)
    ).length / patientCondition.requiredCapabilities.length;
    score += capabilityScore * 40;
    
    // Distance (30%) - closer is better
    const maxDistance = Math.max(...availableFacilities.map(f => f.distance));
    const distanceScore = 1 - (facility.distance / maxDistance);
    score += distanceScore * 30;
    
    // Level appropriateness (20%)
    const levelHierarchy = { dispensary: 1, health_center: 2, hospital: 3, referral: 4 };
    const facilityLevel = levelHierarchy[facility.level];
    const neededLevel = patientCondition.severity === 'critical' ? 4 : 
                       patientCondition.severity === 'serious' ? 3 : 2;
    const levelScore = facilityLevel >= neededLevel ? 1 : facilityLevel / neededLevel;
    score += levelScore * 20;
    
    // Capacity (10%)
    if (facility.bedAvailability !== undefined) {
      score += Math.min(facility.bedAvailability / 10, 1) * 10;
    }
    
    return { facility, score };
  });
  
  // Select best facility
  scoredFacilities.sort((a, b) => b.score - a.score);
  const bestFacility = scoredFacilities[0].facility;
  
  // Determine urgency and transport needs
  const urgency = patientCondition.severity === 'critical' ? 'emergency' :
                 patientCondition.severity === 'serious' ? 'urgent' : 'routine';
  const estimatedTravelTime = Math.ceil(bestFacility.distance / 60 * 60); // Assume 60 km/h average
  
  return {
    referringFacility: {
      id: referringFacility.id,
      name: referringFacility.name,
      level: referringFacility.level,
      capabilities: referringFacility.capabilities,
    },
    receivingFacility: {
      id: bestFacility.id,
      name: bestFacility.name,
      level: bestFacility.level,
      capabilities: bestFacility.capabilities,
      bedAvailability: bestFacility.bedAvailability,
      icuAvailability: bestFacility.icuAvailability,
    },
    patient: {
      condition: patientCondition.diagnosis,
      urgency,
      requiredCapabilities: patientCondition.requiredCapabilities,
    },
    referralStatus: 'pending',
    transportArranged: urgency === 'emergency',
    estimatedTravelTime,
  };
}

// ─── AMR Surveillance ─────────────────────────────────────────────────────────

/**
 * Monitor antimicrobial resistance patterns
 */
export async function monitorAMR(params: {
  facilityId: string;
  microbiologyResults: Array<{
    organism: string;
    antibiotic: string;
    susceptible: boolean;
    date: string;
    sampleType: string;
    patientAge?: number;
    ward?: string;
  }>;
  nationalBaseline?: {
    organism: string;
    antibiotic: string;
    resistanceRate: number;
  }[];
}): Promise<AMRSurveillance[]> {
  const amrData: AMRSurveillance[] = [];
  
  // Group by organism-antibiotic combination
  const combinations = new Map<string, typeof params.microbiologyResults>();
  
  for (const result of params.microbiologyResults) {
    const key = `${result.organism}|${result.antibiotic}`;
    if (!combinations.has(key)) {
      combinations.set(key, []);
    }
    combinations.get(key)!.push(result);
  }
  
  // Analyze each combination
  for (const [key, results] of combinations) {
    const [organism, antibiotic] = key.split('|');
    const resistantCount = results.filter(r => !r.susceptible).length;
    const totalCount = results.length;
    const resistanceRate = totalCount > 0 ? (resistantCount / totalCount) * 100 : 0;
    
    // Compare to national baseline
    const baseline = params.nationalBaseline?.find(b => 
      b.organism === organism && b.antibiotic === antibiotic
    );
    const comparedToNational = baseline ? resistanceRate - baseline.resistanceRate : 0;
    
    // Determine trend (simplified - would need historical data)
    const trend: AMRSurveillance['trend'] = resistanceRate > 20 ? 'increasing' : 
                                            resistanceRate > 10 ? 'stable' : 'decreasing';
    
    // Identify risk factors
    const riskFactors: string[] = [];
    if (resistanceRate > 30) riskFactors.push('High resistance rate (>30%)');
    if (comparedToNational > 10) riskFactors.push(`Higher than national average (+${comparedToNational}%)`);
    
    const icuWardResults = results.filter(r => r.ward === 'ICU');
    if (icuWardResults.length > 0) {
      const icuResistance = icuWardResults.filter(r => !r.susceptible).length / icuWardResults.length * 100;
      if (icuResistance > resistanceRate) {
        riskFactors.push(`Higher resistance in ICU (${icuResistance.toFixed(1)}%)`);
      }
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (resistanceRate > 50) {
      recommendations.push(`Consider removing ${antibiotic} from empiric therapy for ${organism}`);
      recommendations.push('Implement antibiotic stewardship program');
    } else if (resistanceRate > 20) {
      recommendations.push(`Use ${antibiotic} with caution for ${organism} infections`);
      recommendations.push('Consider alternative agents when possible');
    }
    
    if (comparedToNational > 10) {
      recommendations.push('Investigate local factors contributing to higher resistance');
      recommendations.push('Enhance infection prevention and control measures');
    }
    
    amrData.push({
      organism,
      antibiotic,
      facilityId: params.facilityId,
      resistanceRate: Math.round(resistanceRate * 100) / 100,
      sampleSize: totalCount,
      trend,
      comparedToNational: Math.round(comparedToNational * 100) / 100,
      riskFactors,
      recommendations,
    });
  }
  
  // Sort by resistance rate (highest first)
  return amrData.sort((a, b) => b.resistanceRate - a.resistanceRate);
}

// ─── Health System Performance ────────────────────────────────────────────────

/**
 * Monitor health system performance indicators
 */
export async function monitorHealthSystemPerformance(params: {
  facilityId: string;
  data: {
    patientVisits: Array<{ date: string; department: string; count: number }>;
    waitingTimes: Array<{ date: string; department: string; minutes: number }>;
    outcomes: Array<{
      type: 'maternal_death' | 'neonatal_death' | 'surgical_infection' | 'medication_error';
      date: string;
      count: number;
    }>;
    bedData: {
      totalBeds: number;
      occupiedBeds: number;
      admissions: number;
      discharges: number;
    };
  };
  targets?: {
    waitingTime?: number; // minutes
    bedOccupancy?: number; // percentage
    maternalMortality?: number; // per 100,000
  };
}): Promise<HealthSystemPerformance> {
  const { facilityId, data, targets } = params;
  const alerts: HealthSystemPerformance['alerts'] = [];
  
  // Calculate patient volume metrics
  const totalVisits = data.patientVisits.reduce((sum, v) => sum + v.count, 0);
  const byDepartment = {} as Record<string, number>;
  for (const visit of data.patientVisits) {
    byDepartment[visit.department] = (byDepartment[visit.department] || 0) + visit.count;
  }
  
  // Calculate waiting time metrics
  const avgWaitingTime = data.waitingTimes.reduce((sum, w) => sum + w.minutes, 0) / data.waitingTimes.length;
  const waitingByDept = {} as Record<string, number>;
  for (const wt of data.waitingTimes) {
    if (!waitingByDept[wt.department]) {
      waitingByDept[wt.department] = 0;
    }
    waitingByDept[wt.department] += wt.minutes;
  }
  for (const dept in waitingByDept) {
    const deptVisits = data.patientVisits.filter(v => v.department === dept).length;
    waitingByDept[dept] = deptVisits > 0 ? waitingByDept[dept] / deptVisits : 0;
  }
  
  // Calculate quality indicators
  const _totalOutcomes = data.outcomes.reduce((sum, o) => sum + o.count, 0);
  const maternalDeaths = data.outcomes.filter(o => o.type === 'maternal_death').reduce((sum, o) => sum + o.count, 0);
  const neonatalDeaths = data.outcomes.filter(o => o.type === 'neonatal_death').reduce((sum, o) => sum + o.count, 0);
  const surgicalInfections = data.outcomes.filter(o => o.type === 'surgical_infection').reduce((sum, o) => sum + o.count, 0);
  const medicationErrors = data.outcomes.filter(o => o.type === 'medication_error').reduce((sum, o) => sum + o.count, 0);
  
  // Calculate resource utilization
  const bedOccupancyRate = (data.bedData.occupiedBeds / data.bedData.totalBeds) * 100;
  const averageLengthOfStay = data.bedData.discharges > 0 
    ? data.bedData.occupiedBeds / data.bedData.discharges 
    : 0;
  const readmissionRate = 0; // Would need historical data
  
  // Check for alerts
  if (targets?.waitingTime && avgWaitingTime > targets.waitingTime) {
    alerts.push({
      type: 'efficiency',
      severity: avgWaitingTime > targets.waitingTime * 2 ? 'high' : 'medium',
      description: `Average waiting time (${Math.round(avgWaitingTime)} min) exceeds target (${targets.waitingTime} min)`,
      recommendations: [
        'Review patient flow processes',
        'Consider triage optimization',
        'Add staffing during peak hours',
      ],
    });
  }
  
  if (targets?.bedOccupancy && bedOccupancyRate > targets.bedOccupancy) {
    alerts.push({
      type: 'capacity',
      severity: bedOccupancyRate > 90 ? 'critical' : 'high',
      description: `Bed occupancy rate (${bedOccupancyRate.toFixed(1)}%) exceeds target (${targets.bedOccupancy}%)`,
      recommendations: [
        'Expedite discharges where clinically appropriate',
        'Consider opening overflow beds',
        'Review admission criteria',
      ],
    });
  }
  
  if (bedOccupancyRate > 85) {
    alerts.push({
      type: 'capacity',
      severity: 'high',
      description: `High bed occupancy (${bedOccupancyRate.toFixed(1)}%) may impact emergency capacity`,
      recommendations: [
        'Monitor bed availability closely',
        'Prepare contingency plans for surge',
      ],
    });
  }
  
  if (maternalDeaths > 0) {
    alerts.push({
      type: 'quality',
      severity: 'critical',
      description: `${maternalDeaths} maternal death(s) detected - requires immediate review`,
      recommendations: [
        'Conduct maternal death audit',
        'Review obstetric emergency protocols',
        'Assess need for additional training',
      ],
    });
  }
  
  if (medicationErrors > 0) {
    alerts.push({
      type: 'safety',
      severity: medicationErrors > 2 ? 'high' : 'medium',
      description: `${medicationErrors} medication error(s) detected`,
      recommendations: [
        'Review medication administration processes',
        'Consider barcode scanning implementation',
        'Enhance staff training',
      ],
    });
  }
  
  return {
    facilityId,
    metrics: {
      patientVolume: {
        total: totalVisits,
        byDepartment,
        trend: 'stable', // Would analyze over time
      },
      waitingTimes: {
        average: Math.round(avgWaitingTime),
        byDepartment: waitingByDept,
      },
      qualityIndicators: {
        maternalMortalityRatio: totalVisits > 0 ? (maternalDeaths / totalVisits) * 100000 : 0,
        neonatalMortalityRate: totalVisits > 0 ? (neonatalDeaths / totalVisits) * 1000 : 0,
        surgicalSiteInfectionRate: surgicalInfections,
        medicationErrorRate: medicationErrors,
      },
      resourceUtilization: {
        bedOccupancyRate: Math.round(bedOccupancyRate * 100) / 100,
        averageLengthOfStay: Math.round(averageLengthOfStay * 100) / 100,
        readmissionRate,
      },
    },
    alerts,
  };
}

// ─── AHI Report Generation ────────────────────────────────────────────────────

/**
 * Generate Afya Health Intelligence reports
 */
export async function generateAHIReport(params: {
  reportType: AHIReport['reportType'];
  facilityId?: string;
  region?: string;
  period: {
    start: string;
    end: string;
  };
  data: {
    epidemiology?: FacilityEpidemiology;
    performance?: HealthSystemPerformance;
    outbreaks?: OutbreakDetection[];
    amr?: AMRSurveillance[];
  };
}): Promise<AHIReport> {
  const { reportType, facilityId, region, period, data } = params;
  
  const keyFindings: string[] = [];
  const trends: AHIReport['summary']['trends'] = [];
  const alerts: string[] = [];
  const recommendations: string[] = [];
  
  // Analyze epidemiology data
  if (data.epidemiology) {
    const epi = data.epidemiology;
    
    // Top conditions
    if (epi.diseaseBurden.topConditions.length > 0) {
      const topCondition = epi.diseaseBurden.topConditions[0];
      keyFindings.push(`${topCondition.condition} is the leading diagnosis (${topCondition.percentageOfTotal.toFixed(1)}% of cases)`);
      trends.push({
        indicator: `${topCondition.condition} cases`,
        value: topCondition.count,
        change: topCondition.trend === 'increasing' ? 15 : topCondition.trend === 'decreasing' ? -10 : 0,
      });
    }
    
    // Outbreaks
    if (epi.currentOutbreaks.length > 0) {
      alerts.push(`⚠️ ${epi.currentOutbreaks.length} active outbreak(s) detected`);
      for (const outbreak of epi.currentOutbreaks) {
        if (outbreak.status === 'active') {
          recommendations.push(`Activate outbreak response for ${outbreak.disease}`);
        }
      }
    }
    
    // Quality indicators
    if (epi.qualityIndicators.maternalMortalityRatio > 0) {
      alerts.push(`Maternal mortality ratio: ${epi.qualityIndicators.maternalMortalityRatio} per 100,000`);
      recommendations.push('Strengthen maternal health services');
    }
  }
  
  // Analyze performance data
  if (data.performance) {
    const perf = data.performance;
    
    // Capacity issues
    if (perf.metrics.resourceUtilization.bedOccupancyRate > 80) {
      keyFindings.push(`High bed occupancy rate: ${perf.metrics.resourceUtilization.bedOccupancyRate}%`);
      alerts.push('Bed capacity approaching critical levels');
    }
    
    // Quality alerts
    for (const alert of perf.alerts) {
      if (alert.severity === 'critical' || alert.severity === 'high') {
        alerts.push(alert.description);
        recommendations.push(...alert.recommendations);
      }
    }
  }
  
  // Analyze outbreak data
  if (data.outbreaks && data.outbreaks.length > 0) {
    for (const outbreak of data.outbreaks) {
      if (outbreak.requiresAction) {
        keyFindings.push(`Potential ${outbreak.disease} outbreak detected (${outbreak.suspectedCases} cases)`);
        alerts.push(`🚨 ${outbreak.disease} outbreak: ${outbreak.suspectedCases} suspected cases, ${outbreak.deaths} deaths`);
        recommendations.push(...outbreak.recommendedActions);
      }
    }
  }
  
  // Analyze AMR data
  if (data.amr && data.amr.length > 0) {
    const highResistance = data.amr.filter(a => a.resistanceRate > 30);
    if (highResistance.length > 0) {
      keyFindings.push(`${highResistance.length} organism-antibiotic combinations with >30% resistance`);
      alerts.push('Antimicrobial resistance concerns detected');
      recommendations.push('Implement antibiotic stewardship program');
      for (const amr of highResistance) {
        recommendations.push(...amr.recommendations);
      }
    }
  }
  
  // Use AI to synthesize comprehensive report
  try {
    const aiPrompt = `
Generate a comprehensive health intelligence report:

Report Type: ${reportType}
Period: ${period.start} to ${period.end}
${facilityId ? `Facility: ${facilityId}` : ''}
${region ? `Region: ${region}` : ''}

Key Findings:
${keyFindings.map(f => `- ${f}`).join('\n')}

Alerts:
${alerts.map(a => `- ${a}`).join('\n')}

Provide:
1. Executive summary
2. Additional insights and patterns
3. Priority recommendations
4. Resource allocation suggestions

Return as JSON with fields: executiveSummary, additionalInsights, priorityRecommendations, resourceAllocation.
`.trim();

    const response = await orchestrateAI({
      taskType: 'population_health',
      prompt: aiPrompt,
      systemInstruction: 'You are a public health expert generating actionable health intelligence reports for African healthcare systems. Focus on practical, resource-appropriate recommendations.',
      requireConsensus: false,
    });

    if (response.success && response.text) {
      const aiInsights = JSON.parse(response.text);
      if (aiInsights.executiveSummary) {
        keyFindings.unshift(aiInsights.executiveSummary);
      }
      if (aiInsights.priorityRecommendations) {
        recommendations.unshift(...aiInsights.priorityRecommendations);
      }
    }
  } catch (error) {
    logger.warn('[AI Population Health] Report generation AI failed', { error });
  }
  
  return {
    reportType,
    facilityId,
    region,
    period,
    summary: {
      keyFindings,
      trends,
      alerts,
    },
    recommendations: [...new Set(recommendations)], // Remove duplicates
    generatedAt: new Date().toISOString(),
    confidence: 0.75,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AIPopulationHealth = {
  detectOutbreak,
  coordinateReferral,
  monitorAMR,
  monitorHealthSystemPerformance,
  generateAHIReport,
};