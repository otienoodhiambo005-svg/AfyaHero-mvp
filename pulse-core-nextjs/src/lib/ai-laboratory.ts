/**
 * AI-Native Laboratory Module - AfyaHero
 * 
 * Provides AI-assisted laboratory features:
 * - Lab result interpretation with clinical context
 * - Critical value alerts and recommendations
 * - Pattern recognition across multiple tests
 * - Quality control monitoring
 * - Test utilization optimization
 */

import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabResult {
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: { min?: number; max?: number };
  flag?: 'L' | 'H' | 'LL' | 'HH' | 'critical';
  collectionDate: string;
}

export interface LabInterpretation {
  result: LabResult;
  interpretation: string;
  clinicalSignificance: 'normal' | 'abnormal' | 'critical';
  recommendations: string[];
  relatedTests: string[];
  confidence: number;
}

export interface CriticalValueAlert {
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  criticalLevel: 'high' | 'low';
  patientId: string;
  patientName?: string;
  collectionDate: string;
  requiresImmediateAction: boolean;
  recommendedActions: string[];
}

export interface LabPattern {
  pattern: string;
  description: string;
  relatedResults: LabResult[];
  clinicalSignificance: string;
  recommendations: string[];
  confidence: number;
}

export interface TestUtilizationSuggestion {
  currentTests: string[];
  suggestedTests: string[];
  unnecessaryTests: string[];
  costSavings: number;
  clinicalRationale: string;
}

// ─── Reference Ranges (Adult) ─────────────────────────────────────────────────

const REFERENCE_RANGES: Record<string, { min?: number; max?: number; unit: string; critical?: { low?: number; high?: number } }> = {
  // Hematology
  'HGB': { min: 12, max: 16, unit: 'g/dL', critical: { low: 7, high: 20 } },
  'HCT': { min: 36, max: 48, unit: '%', critical: { low: 21, high: 60 } },
  'WBC': { min: 4.5, max: 11, unit: '×10⁹/L', critical: { low: 2, high: 30 } },
  'PLT': { min: 150, max: 400, unit: '×10⁹/L', critical: { low: 50, high: 1000 } },
  'MCV': { min: 80, max: 100, unit: 'fL' },
  'MCH': { min: 27, max: 33, unit: 'pg' },
  'MCHC': { min: 32, max: 36, unit: 'g/dL' },
  
  // Biochemistry
  'GLU': { min: 3.9, max: 6.1, unit: 'mmol/L', critical: { low: 2.8, high: 22 } },
  'CREAT': { min: 60, max: 110, unit: 'μmol/L', critical: { high: 500 } },
  'UREA': { min: 2.5, max: 7.8, unit: 'mmol/L', critical: { high: 30 } },
  'NA': { min: 135, max: 145, unit: 'mmol/L', critical: { low: 120, high: 160 } },
  'K': { min: 3.5, max: 5.0, unit: 'mmol/L', critical: { low: 2.5, high: 6.5 } },
  'CL': { min: 96, max: 106, unit: 'mmol/L' },
  'HCO3': { min: 22, max: 29, unit: 'mmol/L' },
  'CA': { min: 2.2, max: 2.6, unit: 'mmol/L' },
  'PO4': { min: 0.8, max: 1.5, unit: 'mmol/L' },
  'MG': { min: 0.7, max: 1.1, unit: 'mmol/L' },
  'ALT': { min: 7, max: 56, unit: 'U/L', critical: { high: 1000 } },
  'AST': { min: 10, max: 40, unit: 'U/L', critical: { high: 1000 } },
  'ALP': { min: 44, max: 147, unit: 'U/L' },
  'TBILI': { min: 0, max: 21, unit: 'μmol/L', critical: { high: 170 } },
  'DBILI': { min: 0, max: 7, unit: 'μmol/L' },
  'TP': { min: 60, max: 83, unit: 'g/L' },
  'ALB': { min: 35, max: 52, unit: 'g/L' },
  'CHOL': { min: 0, max: 5.2, unit: 'mmol/L' },
  'TRIG': { min: 0, max: 1.7, unit: 'mmol/L' },
  'HDL': { min: 1, max: 2, unit: 'mmol/L' },
  'LDL': { min: 0, max: 3.4, unit: 'mmol/L' },
  'CK': { min: 30, max: 200, unit: 'U/L' },
  'LDH': { min: 140, max: 280, unit: 'U/L' },
  'AMY': { min: 30, max: 110, unit: 'U/L' },
  'LIP': { min: 0, max: 160, unit: 'U/L' },
  'CRP': { min: 0, max: 5, unit: 'mg/L', critical: { high: 100 } },
  'ESR': { min: 0, max: 20, unit: 'mm/hr' },
  'PCT': { min: 0, max: 0.5, unit: 'ng/mL', critical: { high: 2 } },
  
  // Thyroid
  'TSH': { min: 0.4, max: 4.0, unit: 'mIU/L' },
  'FT4': { min: 12, max: 22, unit: 'pmol/L' },
  'FT3': { min: 3.1, max: 6.8, unit: 'pmol/L' },
  
  // Cardiac markers
  'TNT': { min: 0, max: 0.01, unit: 'ng/mL', critical: { high: 0.1 } },
  'BNP': { min: 0, max: 100, unit: 'pg/mL', critical: { high: 500 } },
  'D-DIM': { min: 0, max: 0.5, unit: 'mg/L', critical: { high: 2 } },
};

// ─── Lab Result Interpretation ────────────────────────────────────────────────

/**
 * Interpret a single lab result with clinical context
 */
export async function interpretLabResult(params: {
  result: LabResult;
  patientAge?: number;
  patientGender?: string;
  isPregnant?: boolean;
  clinicalContext?: {
    symptoms?: string[];
    diagnoses?: string[];
    medications?: string[];
  };
}): Promise<LabInterpretation> {
  const { result, patientAge, patientGender, isPregnant, clinicalContext } = params;
  
  // Determine flag based on reference range
  let flag: LabResult['flag'] = undefined;
  let clinicalSignificance: LabInterpretation['clinicalSignificance'] = 'normal';
  
  const refRange = REFERENCE_RANGES[result.testCode.toUpperCase()];
  if (refRange) {
    const value = parseFloat(result.value);
    if (!isNaN(value)) {
      if (refRange.critical && ((refRange.critical.low && value <= refRange.critical.low) || 
          (refRange.critical.high && value >= refRange.critical.high))) {
        flag = 'critical';
        clinicalSignificance = 'critical';
      } else if (refRange.min !== undefined && value < refRange.min) {
        flag = value < (refRange.min * 0.7) ? 'LL' : 'L';
        clinicalSignificance = 'abnormal';
      } else if (refRange.max !== undefined && value > refRange.max) {
        flag = value > (refRange.max * 1.5) ? 'HH' : 'H';
        clinicalSignificance = 'abnormal';
      }
    }
  }
  
  // Build interpretation prompt
  const interpretationPrompt = `
Interpret this lab result:

Test: ${result.testName} (${result.testCode})
Result: ${result.value} ${result.unit}
Reference Range: ${refRange ? `${refRange.min}-${refRange.max} ${refRange.unit}` : 'Not available'}
Flag: ${flag || 'None'}

${patientAge ? `Patient Age: ${patientAge} years` : ''}
${patientGender ? `Patient Gender: ${patientGender}` : ''}
${isPregnant ? 'Pregnant: Yes' : ''}

${clinicalContext?.symptoms ? `Symptoms: ${clinicalContext.symptoms.join(', ')}` : ''}
${clinicalContext?.diagnoses ? `Diagnoses: ${clinicalContext.diagnoses.join(', ')}` : ''}
${clinicalContext?.medications ? `Medications: ${clinicalContext.medications.join(', ')}` : ''}

Provide:
1. Clinical interpretation of this result
2. Differential diagnoses to consider
3. Recommended follow-up tests or actions
4. Any drug-lab interactions to consider

Return as JSON with fields: interpretation, differentials, recommendations, relatedTests.
`.trim();

  try {
    const response = await orchestrateAI({
      taskType: 'lab_interpretation',
      prompt: interpretationPrompt,
      systemInstruction: 'You are a clinical pathologist providing expert lab result interpretation. Consider African disease patterns and resource-limited settings. Be practical and actionable.',
      requireConsensus: false,
    });

    if (response.success && response.text) {
      const aiInterpretation = JSON.parse(response.text);
      return {
        result,
        interpretation: aiInterpretation.interpretation || `Result ${flag || 'within'} reference range`,
        clinicalSignificance,
        recommendations: aiInterpretation.recommendations || [],
        relatedTests: aiInterpretation.relatedTests || [],
        confidence: response.confidenceScore || 0.7,
      };
    }
  } catch (error) {
    logger.warn('[AI Laboratory] AI interpretation failed, using basic interpretation', { error });
  }

  // Fallback to basic interpretation
  return {
    result,
    interpretation: flag 
      ? `Result is ${flag === 'L' || flag === 'LL' ? 'below' : 'above'} reference range`
      : 'Result is within reference range',
    clinicalSignificance,
    recommendations: clinicalSignificance === 'critical' 
      ? ['Review recommended', 'Consider repeat testing to confirm']
      : clinicalSignificance === 'abnormal'
        ? ['Clinical correlation recommended', 'Consider repeat testing if clinically indicated']
        : ['No action required'],
    relatedTests: getRelatedTests(result.testCode),
    confidence: 0.5,
  };
}

function getRelatedTests(testCode: string): string[] {
  const relatedTestsMap: Record<string, string[]> = {
    'HGB': ['HCT', 'RBC', 'MCV', 'MCH', 'MCHC', 'RETIC'],
    'GLU': ['HBA1C', 'INSULIN', 'C-PEPTIDE'],
    'CREAT': ['UREA', 'EGFR', 'ELECTROLYTES', 'URINALYSIS'],
    'ALT': ['AST', 'ALP', 'TBILI', 'GGT', 'ALBUMIN'],
    'TSH': ['FT4', 'FT3', 'TPO-AB'],
    'TNT': ['CK-MB', 'MYOGLOBIN', 'BNP', 'D-DIM'],
    'CRP': ['ESR', 'PCT', 'WBC'],
  };
  
  return relatedTestsMap[testCode.toUpperCase()] || [];
}

// ─── Critical Value Detection ─────────────────────────────────────────────────

/**
 * Check for critical values that require immediate attention
 */
export function checkCriticalValues(results: LabResult[], patientId: string, patientName?: string): CriticalValueAlert[] {
  const alerts: CriticalValueAlert[] = [];
  
  for (const result of results) {
    const refRange = REFERENCE_RANGES[result.testCode.toUpperCase()];
    if (!refRange?.critical) continue;
    
    const value = parseFloat(result.value);
    if (isNaN(value)) continue;
    
    let criticalLevel: CriticalValueAlert['criticalLevel'] | undefined;
    let requiresImmediateAction = false;
    const recommendedActions: string[] = [];
    
    if (refRange.critical.low !== undefined && value <= refRange.critical.low) {
      criticalLevel = 'low';
      requiresImmediateAction = true;
      recommendedActions.push(...getCriticalActionRecommendations(result.testCode, 'low', value));
    }
    
    if (refRange.critical.high !== undefined && value >= refRange.critical.high) {
      criticalLevel = 'high';
      requiresImmediateAction = true;
      recommendedActions.push(...getCriticalActionRecommendations(result.testCode, 'high', value));
    }
    
    if (criticalLevel) {
      alerts.push({
        testCode: result.testCode,
        testName: result.testName,
        value: result.value,
        unit: result.unit,
        criticalLevel,
        patientId,
        patientName,
        collectionDate: result.collectionDate,
        requiresImmediateAction,
        recommendedActions,
      });
    }
  }
  
  return alerts;
}

function getCriticalActionRecommendations(testCode: string, level: 'high' | 'low', _value: number): string[] {
  const recommendations: Record<string, Record<string, string[]>> = {
    'K': {
      low: ['Check ECG for arrhythmias', 'Consider potassium replacement', 'Review diuretic use'],
      high: ['Check ECG immediately', 'Administer calcium gluconate if ECG changes', 'Consider insulin+glucose', 'Prepare for dialysis if severe'],
    },
    'NA': {
      low: ['Assess fluid status', 'Consider hypertonic saline if symptomatic', 'Check urine osmolality'],
      high: ['Assess fluid status', 'Consider free water deficit', 'Rule out diabetes insipidus'],
    },
    'GLU': {
      low: ['Administer rapid-acting carbohydrate', 'Check for insulin/sulfonylurea overdose', 'Monitor glucose q15min'],
      high: ['Check for DKA/HHS', 'Start insulin protocol', 'Check ketones', 'Aggressive fluid resuscitation'],
    },
    'CREAT': {
      high: ['Assess for acute kidney injury', 'Review nephrotoxic medications', 'Consider nephrology consult', 'Prepare for renal replacement therapy'],
    },
    'HGB': {
      low: ['Assess for active bleeding', 'Consider blood transfusion', 'Check coagulation profile', 'Investigate cause of anemia'],
    },
    'PLT': {
      low: ['Assess for bleeding risk', 'Avoid invasive procedures', 'Consider platelet transfusion', 'Investigate cause of thrombocytopenia'],
    },
    'WBC': {
      low: ['Implement neutropenic precautions', 'Consider G-CSF', 'Monitor for infection', 'Review medications'],
      high: ['Consider sepsis workup', 'Check for left shift', 'Consider leukemia if very high'],
    },
  };
  
  return recommendations[testCode.toUpperCase()]?.[level] || ['Review recommended', 'Consider repeat testing to confirm'];
}

// ─── Pattern Recognition ──────────────────────────────────────────────────────

/**
 * Recognize patterns across multiple lab results
 */
export async function recognizeLabPatterns(results: LabResult[], clinicalContext?: {
  symptoms?: string[];
  diagnoses?: string[];
  medications?: string[];
}): Promise<LabPattern[]> {
  const patterns: LabPattern[] = [];
  
  // Check for common patterns
  const anemiaPattern = checkAnemiaPattern(results);
  if (anemiaPattern) patterns.push(anemiaPattern);
  
  const infectionPattern = checkInfectionPattern(results);
  if (infectionPattern) patterns.push(infectionPattern);
  
  const renalPattern = checkRenalPattern(results);
  if (renalPattern) patterns.push(renalPattern);
  
  const liverPattern = checkLiverPattern(results);
  if (liverPattern) patterns.push(liverPattern);
  
  const electrolytePattern = checkElectrolytePattern(results);
  if (electrolytePattern) patterns.push(electrolytePattern);
  
  // Use AI for complex pattern recognition
  if (results.length >= 3) {
    try {
      const aiPattern = await recognizeComplexPatterns(results, clinicalContext);
      if (aiPattern) patterns.push(aiPattern);
    } catch (error) {
      logger.warn('[AI Laboratory] Complex pattern recognition failed', { error });
    }
  }
  
  return patterns;
}

function checkAnemiaPattern(results: LabResult[]): LabPattern | null {
  const hgb = results.find(r => r.testCode === 'HGB');
  const mcv = results.find(r => r.testCode === 'MCV');
  const mch = results.find(r => r.testCode === 'MCH');
  
  if (!hgb || hgb.referenceRange.min === undefined || parseFloat(hgb.value) >= hgb.referenceRange.min) return null;
  
  let pattern = 'Anemia';
  let description = `Hemoglobin ${hgb.value} ${hgb.unit} - below normal`;
  const recommendations: string[] = ['Investigate cause of anemia', 'Consider iron studies', 'Check reticulocyte count'];
  
  if (mcv && mcv.referenceRange.min !== undefined && parseFloat(mcv.value) < mcv.referenceRange.min) {
    pattern = 'Microcytic Anemia';
    description += ' with low MCV - suggest iron deficiency or thalassemia';
    recommendations.push('Check ferritin and iron studies');
    recommendations.push('Consider hemoglobin electrophoresis');
  } else if (mcv && mcv.referenceRange.max !== undefined && parseFloat(mcv.value) > mcv.referenceRange.max) {
    pattern = 'Macrocytic Anemia';
    description += ' with high MCV - suggest B12/folate deficiency';
    recommendations.push('Check B12 and folate levels');
    recommendations.push('Review medications that cause macrocytosis');
  } else {
    pattern = 'Normocytic Anemia';
    description += ' with normal MCV';
    recommendations.push('Check reticulocyte count');
    recommendations.push('Evaluate for chronic disease or hemolysis');
  }
  
  return {
    pattern,
    description,
    relatedResults: [hgb, mcv, mch].filter(Boolean) as LabResult[],
    clinicalSignificance: 'Requires investigation and treatment',
    recommendations,
    confidence: 0.8,
  };
}

function checkInfectionPattern(results: LabResult[]): LabPattern | null {
  const wbc = results.find(r => r.testCode === 'WBC');
  const crp = results.find(r => r.testCode === 'CRP');
  const pct = results.find(r => r.testCode === 'PCT');
  
  const elevatedMarkers: LabResult[] = [];
  
  if (wbc && wbc.referenceRange.max !== undefined && parseFloat(wbc.value) > wbc.referenceRange.max) elevatedMarkers.push(wbc);
  if (crp && crp.referenceRange.max !== undefined && parseFloat(crp.value) > crp.referenceRange.max) elevatedMarkers.push(crp);
  if (pct && pct.referenceRange.max !== undefined && parseFloat(pct.value) > pct.referenceRange.max) elevatedMarkers.push(pct);
  
  if (elevatedMarkers.length === 0) return null;
  
  let pattern = 'Inflammatory Response';
  let description = 'Elevated inflammatory markers detected';
  const recommendations: string[] = ['Clinical correlation for infection'];
  
  if (pct && parseFloat(pct.value) > 2) {
    pattern = 'Possible Sepsis';
    description = `PCT ${pct.value} ${pct.unit} - highly suggestive of bacterial sepsis`;
    recommendations.push('🚨 IMMEDIATE: Sepsis workup and empiric antibiotics');
    recommendations.push('Blood cultures before antibiotics');
    recommendations.push('Consider source control');
  } else if (crp && parseFloat(crp.value) > 100) {
    pattern = 'Severe Inflammation';
    description = `CRP ${crp.value} ${crp.unit} - marked elevation`;
    recommendations.push('Urgent investigation for source');
    recommendations.push('Consider bacterial vs. non-infectious causes');
  }
  
  return {
    pattern,
    description,
    relatedResults: elevatedMarkers,
    clinicalSignificance: 'Suggests active inflammation or infection',
    recommendations,
    confidence: elevatedMarkers.length >= 2 ? 0.9 : 0.7,
  };
}

function checkRenalPattern(results: LabResult[]): LabPattern | null {
  const creat = results.find(r => r.testCode === 'CREAT');
  const urea = results.find(r => r.testCode === 'UREA');
  const k = results.find(r => r.testCode === 'K');
  
  if (!creat || !urea) return null;
  
  const creatHigh = creat.referenceRange.max !== undefined && parseFloat(creat.value) > creat.referenceRange.max;
  const ureaHigh = urea.referenceRange.max !== undefined && parseFloat(urea.value) > urea.referenceRange.max;
  
  if (!creatHigh && !ureaHigh) return null;
  
  let pattern = 'Renal Impairment';
  let description = `Creatinine ${creat.value} ${creat.unit}, Urea ${urea.value} ${urea.unit}`;
  const recommendations: string[] = ['Calculate eGFR', 'Review nephrotoxic medications', 'Assess fluid status'];
  
  if (k && k.referenceRange.max !== undefined && parseFloat(k.value) > k.referenceRange.max) {
    pattern = 'Acute Kidney Injury with Hyperkalemia';
    description += `, Potassium ${k.value} ${k.unit}`;
    recommendations.push('🚨 URGENT: Manage hyperkalemia');
    recommendations.push('Check ECG for arrhythmias');
  }
  
  return {
    pattern,
    description,
    relatedResults: [creat, urea, k].filter(Boolean) as LabResult[],
    clinicalSignificance: 'Requires urgent assessment and management',
    recommendations,
    confidence: 0.85,
  };
}

function checkLiverPattern(results: LabResult[]): LabPattern | null {
  const alt = results.find(r => r.testCode === 'ALT');
  const ast = results.find(r => r.testCode === 'AST');
  const alp = results.find(r => r.testCode === 'ALP');
  const tbili = results.find(r => r.testCode === 'TBILI');
  
  const elevatedEnzymes: LabResult[] = [];
  if (alt && alt.referenceRange.max !== undefined && parseFloat(alt.value) > alt.referenceRange.max) elevatedEnzymes.push(alt);
  if (ast && ast.referenceRange.max !== undefined && parseFloat(ast.value) > ast.referenceRange.max) elevatedEnzymes.push(ast);
  if (alp && alp.referenceRange.max !== undefined && parseFloat(alp.value) > alp.referenceRange.max) elevatedEnzymes.push(alp);
  if (tbili && tbili.referenceRange.max !== undefined && parseFloat(tbili.value) > tbili.referenceRange.max) elevatedEnzymes.push(tbili);
  
  if (elevatedEnzymes.length === 0) return null;
  
  let pattern = 'Abnormal Liver Function';
  let description = 'Elevated liver enzymes detected';
  const recommendations: string[] = ['Review medications', 'Screen for viral hepatitis', 'Consider ultrasound'];
  
  // Check for hepatocellular vs. cholestatic pattern
  if (alt && ast && alt.referenceRange.max && ast.referenceRange.max) {
    const altRatio = parseFloat(alt.value) / alt.referenceRange.max;
    const astRatio = parseFloat(ast.value) / ast.referenceRange.max;
    
    if (altRatio > 2 || astRatio > 2) {
      pattern = 'Hepatocellular Injury';
      description += ' - predominant ALT/AST elevation';
      recommendations.push('Check viral hepatitis serology');
      recommendations.push('Consider drug-induced liver injury');
    }
  }
  
  if (alp && alp.referenceRange.max && parseFloat(alp.value) > alp.referenceRange.max * 2) {
    pattern = 'Cholestatic Pattern';
    description += ' - predominant ALP elevation';
    recommendations.push('Rule out biliary obstruction');
    recommendations.push('Consider ultrasound of biliary tree');
  }
  
  return {
    pattern,
    description,
    relatedResults: elevatedEnzymes,
    clinicalSignificance: 'Requires investigation of underlying cause',
    recommendations,
    confidence: 0.75,
  };
}

function checkElectrolytePattern(results: LabResult[]): LabPattern | null {
  const na = results.find(r => r.testCode === 'NA');
  const k = results.find(r => r.testCode === 'K');
  const cl = results.find(r => r.testCode === 'CL');
  const hco3 = results.find(r => r.testCode === 'HCO3');
  
  const abnormalities: LabResult[] = [];
  if (na && na.referenceRange.min !== undefined && na.referenceRange.max !== undefined && (parseFloat(na.value) < na.referenceRange.min || parseFloat(na.value) > na.referenceRange.max)) abnormalities.push(na);
  if (k && k.referenceRange.min !== undefined && k.referenceRange.max !== undefined && (parseFloat(k.value) < k.referenceRange.min || parseFloat(k.value) > k.referenceRange.max)) abnormalities.push(k);
  if (cl && cl.referenceRange.min !== undefined && cl.referenceRange.max !== undefined && (parseFloat(cl.value) < cl.referenceRange.min || parseFloat(cl.value) > cl.referenceRange.max)) abnormalities.push(cl);
  if (hco3 && hco3.referenceRange.min !== undefined && hco3.referenceRange.max !== undefined && (parseFloat(hco3.value) < hco3.referenceRange.min || parseFloat(hco3.value) > hco3.referenceRange.max)) abnormalities.push(hco3);
  
  if (abnormalities.length === 0) return null;
  
  let pattern = 'Electrolyte Imbalance';
  const description = 'Electrolyte abnormalities detected';
  const recommendations: string[] = ['Assess fluid status', 'Review medications', 'Consider underlying cause'];
  
  // Check for specific patterns
  if (na && hco3) {
    const naVal = parseFloat(na.value);
    const hco3Val = parseFloat(hco3.value);
    
    if (naVal < 130 && hco3Val < 20) {
      pattern = 'Hyponatremia with Metabolic Acidosis';
      recommendations.push('Check anion gap');
      recommendations.push('Consider diarrhea or renal tubular acidosis');
    }
  }
  
  if (k && parseFloat(k.value) > 5.5) {
    recommendations.push('🚨 URGENT: Manage hyperkalemia if severe');
  }
  
  return {
    pattern,
    description,
    relatedResults: abnormalities,
    clinicalSignificance: 'Requires correction and investigation',
    recommendations,
    confidence: 0.8,
  };
}

async function recognizeComplexPatterns(results: LabResult[], clinicalContext?: { patientId?: string; diagnoses?: string[]; symptoms?: string[]; medications?: string[] }): Promise<LabPattern | null> {
  const prompt = `
Analyze these lab results for complex patterns:

${results.map(r => `${r.testName} (${r.testCode}): ${r.value} ${r.unit} ${r.flag ? '[' + r.flag + ']' : ''}`).join('\n')}

${clinicalContext?.symptoms ? `Symptoms: ${clinicalContext.symptoms.join(', ')}` : ''}
${clinicalContext?.diagnoses ? `Diagnoses: ${clinicalContext.diagnoses.join(', ')}` : ''}

Identify any complex patterns that might suggest:
1. Multi-system diseases
2. Drug side effects or interactions
3. Rare but important conditions
4. Patterns specific to African disease epidemiology

Return as JSON with fields: pattern, description, clinicalSignificance, recommendations, confidence.
If no significant complex patterns are found, return null.
`.trim();

  try {
    const response = await orchestrateAI({
      taskType: 'lab_interpretation',
      prompt,
      systemInstruction: 'You are an expert clinical pathologist. Look for subtle patterns and connections between lab results that might be missed. Consider African disease patterns.',
      requireConsensus: false,
    });

    if (response.success && response.text) {
      const parsed = JSON.parse(response.text);
      if (parsed && parsed.pattern) {
        return {
          ...parsed,
          relatedResults: results,
        };
      }
    }
  } catch (error) {
    logger.warn('[AI Laboratory] Complex pattern recognition failed', { error });
  }
  
  return null;
}

// ─── Test Utilization Optimization ────────────────────────────────────────────

/**
 * Suggest optimal test ordering to avoid unnecessary tests
 */
export async function optimizeTestOrdering(params: {
  clinicalQuestion: string;
  symptoms: string[];
  suspectedDiagnoses?: string[];
  alreadyOrderedTests?: string[];
  facilityLevel?: 'dispensary' | 'health_center' | 'hospital' | 'referral';
}): Promise<TestUtilizationSuggestion | null> {
  try {
    const prompt = `
Optimize laboratory test ordering for this clinical scenario:

Clinical Question: ${params.clinicalQuestion}
Symptoms: ${params.symptoms.join(', ')}
${params.suspectedDiagnoses?.length ? `Suspected Diagnoses: ${params.suspectedDiagnoses.join(', ')}` : ''}
${params.alreadyOrderedTests?.length ? `Already Ordered: ${params.alreadyOrderedTests.join(', ')}` : ''}
Facility Level: ${params.facilityLevel || 'hospital'}

Provide:
1. Essential tests that should be ordered (considering resource-limited setting)
2. Tests that are unnecessary or low-yield
3. Estimated cost savings from avoiding unnecessary tests
4. Clinical rationale for recommendations

Return as JSON with fields: suggestedTests, unnecessaryTests, costSavings, clinicalRationale.
`.trim();

    const response = await orchestrateAI({
      taskType: 'protocol_lookup',
      prompt,
      systemInstruction: 'You are a laboratory medicine specialist optimizing test utilization. Focus on high-yield, cost-effective testing appropriate for African healthcare settings. Avoid over-testing.',
      requireConsensus: false,
    });

    if (response.success && response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    logger.error('[AI Laboratory] Test optimization failed', { error });
  }
  
  return null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AILaboratory = {
  interpretLabResult,
  checkCriticalValues,
  recognizeLabPatterns,
  optimizeTestOrdering,
};