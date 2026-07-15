/**
 * AI-Native MCH (Maternal & Child Health) Module - AfyaHero
 * 
 * Provides AI-assisted maternal and child health features:
 * - Antenatal care protocol guidance
 * - Risk stratification for pregnancy complications
 * - Growth monitoring and development tracking
 * - Immunization schedule management
 * - Family planning counseling support
 */

import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AntenatalVisit {
  gestationalWeeks: number;
  visitNumber: number;
  maternalAge: number;
  gravidity: number;
  parity: number;
  vitals: {
    bloodPressure: { systolic: number; diastolic: number };
    weight: number;
    temperature?: number;
  };
  fundalHeight?: number;
  fetalHeartRate?: number;
  symptoms?: string[];
  labResults?: Array<{ test: string; value: string; unit: string }>;
}

export interface AntenatalRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    factor: string;
    category: 'maternal' | 'obstetric' | 'fetal' | 'social';
    severity: 'minor' | 'moderate' | 'major';
    description: string;
  }>;
  recommendations: string[];
  requiresReferral: boolean;
  nextVisitInterval: number; // days
}

export interface GrowthAssessment {
  childAge: number; // months
  weight: number; // kg
  height?: number; // cm
  headCircumference?: number; // cm
  weightForAge: {
    zScore: number;
    classification: 'severe_underweight' | 'underweight' | 'normal' | 'overweight' | 'obese';
    percentile: number;
  };
  heightForAge?: {
    zScore: number;
    classification: 'severe_stunted' | 'stunted' | 'normal';
    percentile: number;
  };
  weightForHeight?: {
    zScore: number;
    classification: 'severe_wasted' | 'wasted' | 'normal' | 'overweight';
    percentile: number;
  };
  recommendations: string[];
}

export interface DevelopmentalMilestone {
  age: number; // months
  domain: 'gross_motor' | 'fine_motor' | 'language' | 'social' | 'cognitive';
  milestone: string;
  status: 'achieved' | 'emerging' | 'not_yet' | 'concerning';
  recommendations: string[];
}

export interface ImmunizationSchedule {
  childAge: number; // months
  dueVaccines: Array<{
    vaccine: string;
    dose: string;
    recommendedAge: number;
    catchUpNeeded: boolean;
    contraindications: string[];
  }>;
  completedVaccines: Array<{
    vaccine: string;
    dose: string;
    dateGiven: string;
    batchNumber?: string;
  }>;
  upcomingVaccines: Array<{
    vaccine: string;
    dose: string;
    dueDate: string;
  }>;
}

export interface FamilyPlanningCounseling {
  patientAge: number;
  parity: number;
  breastfeeding: boolean;
  medicalConditions?: string[];
  preferences?: {
    duration: 'short_term' | 'long_term' | 'permanent';
    hormonal: 'prefer' | 'avoid' | 'no_preference';
    invasiveness: 'non_invasive' | 'minimally_invasive' | 'no_preference';
  };
  recommendedMethods: Array<{
    method: string;
    effectiveness: number;
    advantages: string[];
    disadvantages: string[];
    contraindications: string[];
    suitability: 'highly_suitable' | 'suitable' | 'caution' | 'not_recommended';
  }>;
  counselingPoints: string[];
}

// ─── WHO Growth Standards (Simplified) ────────────────────────────────────────

const WHO_WEIGHT_FOR_AGE_BOYS = [
  { month: 0, median: 3.3, sd1: 0.47, sd2: 0.67 },
  { month: 1, median: 4.3, sd1: 0.53, sd2: 0.75 },
  { month: 2, median: 5.2, sd1: 0.58, sd2: 0.82 },
  { month: 3, median: 5.8, sd1: 0.62, sd2: 0.88 },
  { month: 6, median: 7.6, sd1: 0.73, sd2: 1.04 },
  { month: 9, median: 8.9, sd1: 0.82, sd2: 1.17 },
  { month: 12, median: 9.6, sd1: 0.87, sd2: 1.24 },
  { month: 18, median: 10.5, sd1: 0.95, sd2: 1.36 },
  { month: 24, median: 11.5, sd1: 1.03, sd2: 1.48 },
];

const WHO_WEIGHT_FOR_AGE_GIRLS = [
  { month: 0, median: 3.2, sd1: 0.45, sd2: 0.65 },
  { month: 1, median: 4.0, sd1: 0.51, sd2: 0.72 },
  { month: 2, median: 4.8, sd1: 0.56, sd2: 0.79 },
  { month: 3, median: 5.4, sd1: 0.60, sd2: 0.85 },
  { month: 6, median: 7.1, sd1: 0.70, sd2: 1.00 },
  { month: 9, median: 8.2, sd1: 0.79, sd2: 1.13 },
  { month: 12, median: 8.9, sd1: 0.84, sd2: 1.20 },
  { month: 18, median: 9.8, sd1: 0.92, sd2: 1.32 },
  { month: 24, median: 10.8, sd1: 1.00, sd2: 1.44 },
];

// ─── Antenatal Care ───────────────────────────────────────────────────────────

/**
 * Assess antenatal risk and provide care recommendations
 */
export async function assessAntenatalRisk(params: {
  visit: AntenatalVisit;
  medicalHistory?: {
    chronicConditions?: string[];
    previousPregnancyComplications?: string[];
    surgeries?: string[];
    allergies?: string[];
  };
  socialHistory?: {
    smoking?: boolean;
    alcohol?: boolean;
    intimatePartnerViolence?: boolean;
    distanceToFacility?: number;
  };
}): Promise<AntenatalRiskAssessment> {
  const { visit, medicalHistory, socialHistory } = params;
  
  const riskFactors: AntenatalRiskAssessment['riskFactors'] = [];
  let riskLevel: AntenatalRiskAssessment['riskLevel'] = 'low';
  const recommendations: string[] = [];
  let requiresReferral = false;
  const nextVisitInterval = visit.gestationalWeeks < 28 ? 28 : visit.gestationalWeeks < 36 ? 14 : 7;

  // Age-related risks
  if (visit.maternalAge < 18) {
    riskFactors.push({
      factor: 'Adolescent pregnancy (<18 years)',
      category: 'maternal',
      severity: 'moderate',
      description: 'Increased risk of preterm birth, low birth weight, and obstetric complications',
    });
    riskLevel = 'medium';
    recommendations.push('Enhanced antenatal support and counseling');
    recommendations.push('Consider social work referral');
  } else if (visit.maternalAge > 35) {
    riskFactors.push({
      factor: 'Advanced maternal age (>35 years)',
      category: 'maternal',
      severity: 'moderate',
      description: 'Increased risk of chromosomal abnormalities, gestational diabetes, and hypertension',
    });
    riskLevel = 'medium';
    recommendations.push('Discuss prenatal screening options');
    recommendations.push('Monitor closely for gestational diabetes and hypertension');
  }

  // Gravidity/Parity risks
  if (visit.gravidity > 5) {
    riskFactors.push({
      factor: 'Grand multiparity (≥5 pregnancies)',
      category: 'obstetric',
      severity: 'moderate',
      description: 'Increased risk of postpartum hemorrhage and uterine atony',
    });
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    recommendations.push('Plan for active management of third stage of labor');
    recommendations.push('Ensure delivery at facility with blood transfusion capability');
  }

  // Blood pressure risks
  const { systolic, diastolic } = visit.vitals.bloodPressure;
  if (systolic >= 140 || diastolic >= 90) {
    const severity = systolic >= 160 || diastolic >= 110 ? 'major' : 'moderate';
    riskFactors.push({
      factor: `Hypertension (${systolic}/${diastolic} mmHg)`,
      category: 'maternal',
      severity,
      description: severity === 'major' 
        ? 'Severe hypertension - risk of stroke, eclampsia' 
        : 'Gestational hypertension or chronic hypertension',
    });
    if (severity === 'major') {
      riskLevel = 'critical';
      requiresReferral = true;
      recommendations.push('🚨 URGENT: Evaluate for pre-eclampsia');
      recommendations.push('Check urine protein, reflexes, symptoms');
      recommendations.push('Consider magnesium sulfate and antihypertensives');
    } else {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
      recommendations.push('Monitor blood pressure closely');
      recommendations.push('Check urine protein at each visit');
    }
  }

  // Weight assessment
  const bmi = visit.vitals.weight / ((1.6) * (1.6)); // Assuming average height
  if (bmi < 18.5) {
    riskFactors.push({
      factor: 'Underweight (BMI <18.5)',
      category: 'maternal',
      severity: 'moderate',
      description: 'Increased risk of low birth weight and preterm birth',
    });
    recommendations.push('Nutritional counseling and supplementation');
    recommendations.push('Monitor fetal growth closely');
  } else if (bmi > 30) {
    riskFactors.push({
      factor: 'Obesity (BMI >30)',
      category: 'maternal',
      severity: 'moderate',
      description: 'Increased risk of gestational diabetes, pre-eclampsia, and cesarean delivery',
    });
    recommendations.push('Screen for gestational diabetes');
    recommendations.push('Monitor for pre-eclampsia');
  }

  // Symptoms assessment
  if (visit.symptoms) {
    const dangerSymptoms = ['headache', 'visual disturbances', 'epigastric pain', 'vaginal bleeding', 'decreased fetal movement'];
    const presentDangerSymptoms = visit.symptoms.filter(s => dangerSymptoms.some(ds => s.toLowerCase().includes(ds)));
    
    if (presentDangerSymptoms.length > 0) {
      riskFactors.push({
        factor: `Danger symptoms: ${presentDangerSymptoms.join(', ')}`,
        category: 'maternal',
        severity: 'major',
        description: 'Possible pre-eclampsia, placental abruption, or fetal distress',
      });
      riskLevel = 'critical';
      requiresReferral = true;
      recommendations.push('🚨 IMMEDIATE: Evaluate for obstetric emergency');
    }
  }

  // Medical history risks
  if (medicalHistory?.chronicConditions) {
    const highRiskConditions = ['diabetes', 'hypertension', 'heart disease', 'kidney disease', 'hiv', 'epilepsy'];
    const presentConditions = medicalHistory.chronicConditions.filter(c => 
      highRiskConditions.some(hrc => c.toLowerCase().includes(hrc))
    );
    
    if (presentConditions.length > 0) {
      riskFactors.push({
        factor: `Chronic conditions: ${presentConditions.join(', ')}`,
        category: 'maternal',
        severity: 'moderate',
        description: 'Requires specialized management during pregnancy',
      });
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      recommendations.push('Multidisciplinary care coordination');
      recommendations.push('Medication review and adjustment');
    }
  }

  // Use AI for comprehensive risk assessment
  try {
    const aiPrompt = `
Comprehensive antenatal risk assessment:

Patient: ${visit.maternalAge} year old, G${visit.gravidity}P${visit.parity}
Gestational Age: ${visit.gestationalWeeks} weeks
Visit Number: ${visit.visitNumber}

Vitals:
- BP: ${systolic}/${diastolic} mmHg
- Weight: ${visit.vitals.weight} kg
${visit.vitals.temperature ? `- Temperature: ${visit.vitals.temperature}°C` : ''}

${visit.fundalHeight ? `Fundal Height: ${visit.fundalHeight} cm` : ''}
${visit.fetalHeartRate ? `Fetal Heart Rate: ${visit.fetalHeartRate} bpm` : ''}

${visit.symptoms?.length ? `Symptoms: ${visit.symptoms.join(', ')}` : ''}

${medicalHistory?.chronicConditions?.length ? `Chronic Conditions: ${medicalHistory.chronicConditions.join(', ')}` : ''}
${socialHistory?.smoking ? 'Smoking: Yes' : ''}
${socialHistory?.alcohol ? 'Alcohol: Yes' : ''}

Provide:
1. Additional risk factors not yet identified
2. Specific management recommendations for this gestational age
3. Warning signs to counsel patient about
4. Optimal timing for next visit and any special investigations needed

Return as JSON with fields: additionalRisks, managementRecommendations, counselingPoints, specialInvestigations.
`.trim();

    const response = await orchestrateAI({
      taskType: 'mch_care',
      prompt: aiPrompt,
      systemInstruction: 'You are an obstetrician specializing in high-risk pregnancies in African settings. Provide practical, evidence-based recommendations considering resource limitations.',
      requireConsensus: false,
    });

    if (response.success && response.text) {
      const aiAssessment = JSON.parse(response.text);
      if (aiAssessment.additionalRisks) {
        for (const risk of aiAssessment.additionalRisks) {
          if (!riskFactors.some(rf => rf.factor === risk)) {
            riskFactors.push({
              factor: risk,
              category: 'maternal',
              severity: 'moderate',
              description: 'Identified by AI risk assessment',
            });
          }
        }
      }
      if (aiAssessment.managementRecommendations) {
        recommendations.push(...aiAssessment.managementRecommendations);
      }
      if (aiAssessment.counselingPoints) {
        recommendations.push('Counseling: ' + aiAssessment.counselingPoints.join('; '));
      }
    }
  } catch (error) {
    logger.warn('[AI MCH] Antenatal AI assessment failed', { error });
  }

  // Standard antenatal recommendations based on gestational age
  if (visit.gestationalWeeks < 20) {
    recommendations.push('Schedule anatomy ultrasound at 18-22 weeks');
    recommendations.push('Continue folic acid supplementation');
  } else if (visit.gestationalWeeks < 28) {
    recommendations.push('Screen for gestational diabetes (24-28 weeks)');
    recommendations.push('Administer Td vaccine if due');
  } else if (visit.gestationalWeeks < 36) {
    recommendations.push('Discuss birth plan and danger signs');
    recommendations.push('Consider HIV retesting if high risk');
  } else {
    recommendations.push('Weekly visits until delivery');
    recommendations.push('Discuss signs of labor');
    recommendations.push('Prepare for delivery');
  }

  return {
    riskLevel,
    riskFactors,
    recommendations,
    requiresReferral,
    nextVisitInterval,
  };
}

// ─── Child Growth Monitoring ──────────────────────────────────────────────────

/**
 * Assess child growth using WHO standards
 */
export function assessChildGrowth(params: {
  childAge: number; // months
  weight: number; // kg
  height?: number; // cm
  headCircumference?: number; // cm
  gender: 'male' | 'female';
  previousMeasurements?: Array<{
    age: number;
    weight: number;
    height?: number;
    date: string;
  }>;
}): GrowthAssessment {
  const { childAge, weight, height, headCircumference, gender, previousMeasurements } = params;
  
  // Get appropriate growth standard
  const standard = gender === 'male' ? WHO_WEIGHT_FOR_AGE_BOYS : WHO_WEIGHT_FOR_AGE_GIRLS;
  
  // Find closest age in standard
  let closestStandard = standard[0];
  for (const entry of standard) {
    if (Math.abs(entry.month - childAge) < Math.abs(closestStandard.month - childAge)) {
      closestStandard = entry;
    }
  }
  
  // Calculate z-score for weight-for-age
  const zScore = (weight - closestStandard.median) / closestStandard.sd1;
  
  let classification: GrowthAssessment['weightForAge']['classification'];
  if (zScore < -3) classification = 'severe_underweight';
  else if (zScore < -2) classification = 'underweight';
  else if (zScore > 2) classification = 'overweight';
  else if (zScore > 3) classification = 'obese';
  else classification = 'normal';
  
  // Calculate approximate percentile
  const percentile = Math.round(50 + (zScore * 15));
  
  const recommendations: string[] = [];
  
  if (classification === 'severe_underweight') {
    recommendations.push('🚨 URGENT: Refer for management of severe acute malnutrition');
    recommendations.push('Start therapeutic feeding program');
    recommendations.push('Screen for underlying infections');
  } else if (classification === 'underweight') {
    recommendations.push('Nutritional counseling and support');
    recommendations.push('Consider supplementation');
    recommendations.push('Monitor growth closely (monthly)');
  } else if (classification === 'overweight' || classification === 'obese') {
    recommendations.push('Dietary counseling');
    recommendations.push('Encourage physical activity');
    recommendations.push('Monitor for comorbidities');
  }
  
  // Assess growth trend if previous measurements available
  if (previousMeasurements && previousMeasurements.length >= 2) {
    const sortedMeasurements = previousMeasurements.sort((a, b) => a.age - b.age);
    const recentTrend = sortedMeasurements[sortedMeasurements.length - 1].weight - 
                       sortedMeasurements[sortedMeasurements.length - 2].weight;
    
    if (recentTrend < 0) {
      recommendations.push('⚠️ Weight loss detected - investigate cause');
      recommendations.push('Consider illness, feeding difficulties, or neglect');
    }
  }
  
  // Height-for-age assessment (stunting)
  let heightForAge:
    | {
        zScore: number;
        classification: 'severe_stunted' | 'stunted' | 'normal';
        percentile: number;
      }
    | undefined = undefined;
  if (height) {
    // Simplified height assessment
    const expectedHeight = 65 + (childAge * 0.5); // Very rough estimate
    const heightZScore = (height - expectedHeight) / 3;
    
    let heightClassification: 'severe_stunted' | 'stunted' | 'normal';
    if (heightZScore < -3) heightClassification = 'severe_stunted';
    else if (heightZScore < -2) heightClassification = 'stunted';
    else heightClassification = 'normal';
    
    heightForAge = {
      zScore: Math.round(heightZScore * 100) / 100,
      classification: heightClassification,
      percentile: Math.round(50 + (heightZScore * 15)),
    };
    
    if (heightClassification !== 'normal') {
      recommendations.push('Chronic malnutrition detected - long-term nutritional support needed');
    }
  }
  
  return {
    childAge,
    weight,
    height,
    headCircumference,
    weightForAge: {
      zScore: Math.round(zScore * 100) / 100,
      classification,
      percentile: Math.max(1, Math.min(99, percentile)),
    },
    heightForAge,
    recommendations,
  };
}

// ─── Developmental Milestones ─────────────────────────────────────────────────

/**
 * Track developmental milestones based on age
 */
export function assessDevelopmentalMilestones(childAge: number): DevelopmentalMilestone[] {
  const milestones: DevelopmentalMilestone[] = [];
  
  // Gross motor milestones
  if (childAge >= 2) {
    milestones.push({
      age: 2,
      domain: 'gross_motor',
      milestone: 'Lifts head when prone',
      status: childAge >= 3 ? 'achieved' : 'emerging',
      recommendations: childAge >= 4 ? ['If not achieved, consider physiotherapy referral'] : [],
    });
  }
  
  if (childAge >= 6) {
    milestones.push({
      age: 6,
      domain: 'gross_motor',
      milestone: 'Sits without support',
      status: childAge >= 8 ? 'achieved' : 'emerging',
      recommendations: childAge >= 10 ? ['If not achieved, evaluate for developmental delay'] : [],
    });
  }
  
  if (childAge >= 12) {
    milestones.push({
      age: 12,
      domain: 'gross_motor',
      milestone: 'Stands alone and may take first steps',
      status: childAge >= 15 ? 'achieved' : 'emerging',
      recommendations: childAge >= 18 ? ['If not walking, refer for evaluation'] : [],
    });
  }
  
  // Language milestones
  if (childAge >= 6) {
    milestones.push({
      age: 6,
      domain: 'language',
      milestone: 'Babbles and responds to name',
      status: childAge >= 9 ? 'achieved' : 'emerging',
      recommendations: [],
    });
  }
  
  if (childAge >= 12) {
    milestones.push({
      age: 12,
      domain: 'language',
      milestone: 'Says 1-2 words with meaning',
      status: childAge >= 15 ? 'achieved' : 'emerging',
      recommendations: [],
    });
  }
  
  if (childAge >= 18) {
    milestones.push({
      age: 18,
      domain: 'language',
      milestone: 'Uses 10-20 words and follows simple commands',
      status: childAge >= 24 ? 'achieved' : 'emerging',
      recommendations: childAge >= 30 ? ['If limited speech, consider hearing assessment'] : [],
    });
  }
  
  // Social milestones
  if (childAge >= 2) {
    milestones.push({
      age: 2,
      domain: 'social',
      milestone: 'Social smile and recognizes caregivers',
      status: childAge >= 4 ? 'achieved' : 'emerging',
      recommendations: [],
    });
  }
  
  if (childAge >= 12) {
    milestones.push({
      age: 12,
      domain: 'social',
      milestone: 'Waves goodbye and plays peek-a-boo',
      status: childAge >= 15 ? 'achieved' : 'emerging',
      recommendations: [],
    });
  }
  
  return milestones.filter(m => childAge >= m.age - 1); // Show relevant milestones
}

// ─── Immunization Schedule ────────────────────────────────────────────────────

/**
 * Manage immunization schedule based on Kenya EPI
 */
export function getImmunizationSchedule(params: {
  childAge: number; // months
  birthDate: string;
  immunizationHistory?: Array<{
    vaccine: string;
    dose: string;
    dateGiven: string;
    batchNumber?: string;
  }>;
}): ImmunizationSchedule {
  const { childAge, birthDate, immunizationHistory = [] } = params;
  
  // Kenya EPI Schedule
  const epiSchedule = [
    { age: 0, vaccines: ['BCG', 'OPV0', 'HepB_birth'] },
    { age: 1.5, vaccines: ['DTaP1', 'IPV1', 'Hib1', 'HepB1', 'PCV1', 'Rotavirus1'] },
    { age: 3.5, vaccines: ['DTaP2', 'IPV2', 'Hib2', 'HepB2', 'PCV2', 'Rotavirus2'] },
    { age: 6, vaccines: ['DTaP3', 'IPV3', 'Hib3', 'HepB3', 'PCV3'] },
    { age: 9, vaccines: ['MV1', 'Yellow_Fever'] },
    { age: 12, vaccines: ['DTaP_booster1'] },
    { age: 18, vaccines: ['MV2'] },
    { age: 48, vaccines: ['DTaP_booster2', 'OPV_booster'] },
    { age: 120, vaccines: ['Td1'] }, // For girls only
    { age: 132, vaccines: ['Td2'] }, // For girls only
  ];
  
  const dueVaccines: ImmunizationSchedule['dueVaccines'] = [];
  const completedVaccines: ImmunizationSchedule['completedVaccines'] = [];
  const upcomingVaccines: ImmunizationSchedule['upcomingVaccines'] = [];
  
  // Check each scheduled vaccine
  for (const schedule of epiSchedule) {
    const scheduleAge = schedule.age;
    const dueDate = new Date(birthDate);
    dueDate.setMonth(dueDate.getMonth() + Math.floor(scheduleAge));
    dueDate.setDate(dueDate.getDate() + ((scheduleAge % 1) * 30));
    
    for (const vaccine of schedule.vaccines) {
      // Check if already given
      const given = immunizationHistory.find(h => h.vaccine === vaccine);
      
      if (given) {
        completedVaccines.push({
          vaccine,
          dose: '1', // Simplified
          dateGiven: given.dateGiven,
          batchNumber: given.batchNumber,
        });
      } else if (childAge >= scheduleAge) {
        // Overdue
        dueVaccines.push({
          vaccine,
          dose: '1',
          recommendedAge: scheduleAge,
          catchUpNeeded: true,
          contraindications: [],
        });
      } else if (childAge >= scheduleAge - 1) {
        // Due soon
        upcomingVaccines.push({
          vaccine,
          dose: '1',
          dueDate: dueDate.toISOString().split('T')[0],
        });
      }
    }
  }
  
  return {
    childAge,
    dueVaccines,
    completedVaccines,
    upcomingVaccines,
  };
}

// ─── Family Planning ──────────────────────────────────────────────────────────

/**
 * Provide family planning counseling and method recommendations
 */
export async function getFamilyPlanningRecommendations(params: {
  patientAge: number;
  parity: number;
  breastfeeding: boolean;
  medicalConditions?: string[];
  preferences?: FamilyPlanningCounseling['preferences'];
}): Promise<FamilyPlanningCounseling> {
  const { patientAge, parity, breastfeeding, medicalConditions = [], preferences } = params;
  
  const recommendedMethods: FamilyPlanningCounseling['recommendedMethods'] = [];
  const counselingPoints: string[] = [];
  
  // Base recommendations on WHO Medical Eligibility Criteria
  const methods = [
    {
      method: 'Copper IUD',
      effectiveness: 99.2,
      advantages: ['Long-acting (10-12 years)', 'Hormone-free', 'Can use while breastfeeding', 'Immediately reversible'],
      disadvantages: ['May increase menstrual bleeding', 'Requires insertion by trained provider', 'Small risk of expulsion'],
      contraindications: ['Active pelvic infection', 'Unexplained vaginal bleeding', 'Uterine anomalies'],
    },
    {
      method: 'Hormonal IUD (Mirena)',
      effectiveness: 99.8,
      advantages: ['Long-acting (5 years)', 'Reduces menstrual bleeding', 'Can use while breastfeeding after 6 weeks', 'Immediately reversible'],
      disadvantages: ['Requires insertion by trained provider', 'May cause irregular bleeding initially', 'Small risk of expulsion'],
      contraindications: ['Active pelvic infection', 'Breast cancer', 'Unexplained vaginal bleeding', 'Severe liver disease'],
    },
    {
      method: 'Implant (Jadelle/Implanon)',
      effectiveness: 99.95,
      advantages: ['Long-acting (3-5 years)', 'Can use while breastfeeding', 'Immediately reversible', 'Discreet'],
      disadvantages: ['May cause irregular bleeding', 'Requires minor procedure for insertion/removal', 'Visible/palpable under skin'],
      contraindications: ['Pregnancy', 'Severe liver disease', 'Unexplained vaginal bleeding'],
    },
    {
      method: 'Injectable (Depo-Provera)',
      effectiveness: 99.7,
      advantages: ['Private', 'Can use while breastfeeding', 'Reduces menstrual cramps', 'May reduce anemia'],
      disadvantages: ['Requires injection every 3 months', 'May cause weight gain', 'Delayed return to fertility', 'May decrease bone density'],
      contraindications: ['Pregnancy', 'Severe hypertension', 'History of breast cancer', 'Severe liver disease'],
    },
    {
      method: 'Combined Oral Contraceptives',
      effectiveness: 99.7,
      advantages: ['Regulates menstrual cycle', 'Reduces menstrual cramps', 'May improve acne', 'Immediately reversible'],
      disadvantages: ['Daily pill required', 'May cause nausea', 'Not for breastfeeding <6 weeks postpartum', 'Small increased risk of blood clots'],
      contraindications: ['Smoking >35 years', 'History of blood clots', 'Migraine with aura', 'Uncontrolled hypertension', 'Breast cancer'],
    },
    {
      method: 'Progestin-only Pill (Mini-pill)',
      effectiveness: 99.5,
      advantages: ['Safe while breastfeeding', 'No estrogen-related side effects', 'Immediately reversible'],
      disadvantages: ['Must take at same time daily', 'May cause irregular bleeding', 'Lower effectiveness than combined pills'],
      contraindications: ['Pregnancy', 'Severe liver disease', 'Unexplained vaginal bleeding'],
    },
    {
      method: 'Male Condom',
      effectiveness: 98,
      advantages: ['No hormones', 'Protects against STIs/HIV', 'No prescription needed', 'Inexpensive'],
      disadvantages: ['Must use every time', 'May reduce sensation', 'Can break or slip', 'Requires partner cooperation'],
      contraindications: ['Latex allergy (use polyurethane)'],
    },
    {
      method: 'Female Condom',
      effectiveness: 95,
      advantages: ['No hormones', 'Protects against STIs/HIV', 'Woman-controlled', 'Can insert hours before sex'],
      disadvantages: ['More expensive than male condom', 'May be noisy', 'Requires practice to use correctly'],
      contraindications: [],
    },
    {
      method: 'Tubal Ligation',
      effectiveness: 99.5,
      advantages: ['Permanent', 'No ongoing costs', 'No hormones', 'No effect on breastfeeding'],
      disadvantages: ['Requires surgery', 'Permanent (difficult to reverse)', 'Surgical risks', 'No STI protection'],
      contraindications: ['Desire for future fertility', 'Active pelvic infection', 'Severe medical conditions making surgery risky'],
    },
    {
      method: 'Vasectomy',
      effectiveness: 99.85,
      advantages: ['Permanent', 'Simpler than tubal ligation', 'No hormones', 'Lower risk than female sterilization'],
      disadvantages: ['Permanent (difficult to reverse)', 'Requires surgery', 'No STI protection', 'Takes 3 months to be effective'],
      contraindications: ['Desire for future fertility', 'Active infection', 'Bleeding disorders'],
    },
    {
      method: 'Emergency Contraception',
      effectiveness: 95,
      advantages: ['Available without prescription', 'Can prevent pregnancy after unprotected sex', 'Safe for most women'],
      disadvantages: ['Not for regular use', 'Less effective than regular methods', 'May cause nausea', 'Does not protect against STIs'],
      contraindications: ['Known pregnancy', 'Severe liver disease'],
    },
  ];
  
  // Filter and rate methods based on patient factors
  for (const method of methods) {
    let suitability: FamilyPlanningCounseling['recommendedMethods'][0]['suitability'] = 'suitable';
    const additionalContraindications: string[] = [];
    
    // Breastfeeding considerations
    if (breastfeeding) {
      if (method.method === 'Combined Oral Contraceptives' && patientAge < 6) {
        suitability = 'not_recommended';
        additionalContraindications.push('Not recommended <6 weeks postpartum while breastfeeding');
      }
    }
    
    // Age considerations
    if (patientAge > 35) {
      if (method.method === 'Combined Oral Contraceptives') {
        suitability = 'caution';
        additionalContraindications.push('Use with caution >35 years - assess cardiovascular risk');
      }
    }
    
    // Medical conditions
    if (medicalConditions.includes('hypertension') || medicalConditions.includes('high blood pressure')) {
      if (method.method === 'Injectable (Depo-Provera)' || method.method === 'Combined Oral Contraceptives') {
        if (suitability !== 'not_recommended') {
          suitability = 'caution';
          additionalContraindications.push('May worsen hypertension - monitor closely');
        }
      }
    }
    
    if (medicalConditions.includes('diabetes')) {
      if (method.method === 'Injectable (Depo-Provera)') {
        suitability = 'caution';
        additionalContraindications.push('May affect glucose control - monitor closely');
      }
    }
    
    if (medicalConditions.includes('hiv') && medicalConditions.includes('on ARVs')) {
      if (method.method === 'Implant (Jadelle/Implanon)' || method.method === 'Injectable (Depo-Provera)') {
        suitability = 'caution';
        additionalContraindications.push('Some ARVs may reduce effectiveness - consider IUD');
      }
    }
    
    // Preference matching
    if (preferences) {
      if (preferences.duration === 'short_term' && ['Tubal Ligation', 'Vasectomy', 'IUD', 'Implant'].includes(method.method)) {
        suitability = suitability === 'not_recommended' ? 'not_recommended' : 'caution';
      }
      if (preferences.duration === 'permanent' && !['Tubal Ligation', 'Vasectomy'].includes(method.method)) {
        suitability = suitability === 'not_recommended' ? 'not_recommended' : 'caution';
      }
      if (preferences.hormonal === 'avoid' && ['Injectable', 'Implant', 'Pill', 'Hormonal IUD'].some(m => method.method.includes(m))) {
        suitability = suitability === 'not_recommended' ? 'not_recommended' : 'caution';
      }
    }
    
    recommendedMethods.push({
      ...method,
      contraindications: [...method.contraindications, ...additionalContraindications],
      suitability,
    });
  }
  
  // Sort by suitability and effectiveness
  const suitabilityOrder = { 'highly_suitable': 0, 'suitable': 1, 'caution': 2, 'not_recommended': 3 };
  recommendedMethods.sort((a, b) => {
    if (suitabilityOrder[a.suitability] !== suitabilityOrder[b.suitability]) {
      return suitabilityOrder[a.suitability] - suitabilityOrder[b.suitability];
    }
    return b.effectiveness - a.effectiveness;
  });
  
  // Add counseling points
  counselingPoints.push('Discuss all available methods and their effectiveness');
  counselingPoints.push('Emphasize dual protection (pregnancy + STI prevention) if at risk');
  counselingPoints.push('Discuss return to fertility after discontinuation');
  counselingPoints.push('Review warning signs that require medical attention');
  counselingPoints.push('Schedule follow-up as needed for chosen method');
  
  if (breastfeeding) {
    counselingPoints.push('Reassure that most methods are safe while breastfeeding');
    counselingPoints.push('Discuss timing of initiation based on postpartum period');
  }
  
  return {
    patientAge,
    parity,
    breastfeeding,
    recommendedMethods,
    counselingPoints,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AIMCH = {
  assessAntenatalRisk,
  assessChildGrowth,
  assessDevelopmentalMilestones,
  getImmunizationSchedule,
  getFamilyPlanningRecommendations,
};