/**
 * AI-Native Pharmacy Module - AfyaHero
 * 
 * Provides AI-assisted pharmacy features:
 * - Smart inventory management with predictive analytics
 * - Drug interaction checking during dispensing
 * - Prescription validation and safety checks
 * - Expiry tracking and automated alerts
 * - Treatment protocol-based medication suggestions
 */

import { orchestrateAI } from '@/lib/ai-orchestrator';
import { ClinicalMemory } from '@/lib/clinical-memory';
import { checkDrugInteractions, type DrugInteractionResult } from '@/lib/predictive-risk-models';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Medication {
  name: string;
  genericName?: string;
  strength: string;
  form: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream' | 'drops' | 'inhaler';
  route: 'oral' | 'intravenous' | 'intramuscular' | 'subcutaneous' | 'topical' | 'inhalation';
  dose?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  instructions?: string;
}

export interface PrescriptionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  interactions: DrugInteractionResult;
  recommendations: string[];
  requiresReview: boolean;
}

export interface InventoryPrediction {
  medication: string;
  currentStock: number;
  predictedDemand: number;
  daysUntilStockout: number;
  recommendedOrderQuantity: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export interface ExpiryAlert {
  medication: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  daysUntilExpiry: number;
  urgency: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface SmartDispensingSuggestion {
  medication: string;
  suggestedDose: string;
  suggestedFrequency: string;
  suggestedDuration: string;
  alternatives: string[];
  contraindications: string[];
  monitoring: string[];
  patientEducation: string[];
}

// ─── Prescription Validation ──────────────────────────────────────────────────

/**
 * Validate a prescription for safety and completeness
 */
export async function validatePrescription(params: {
  medications: Medication[];
  patientAge: number;
  patientWeight?: number;
  allergies?: string[];
  currentMedications?: string[];
  diagnoses?: string[];
  renalFunction?: { creatinine?: number; eGFR?: number };
  liverFunction?: { alt?: number; ast?: number; bilirubin?: number };
  isPregnant?: boolean;
  isBreastfeeding?: boolean;
}): Promise<PrescriptionValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for incomplete prescriptions
  for (const med of params.medications) {
    if (!med.name || !med.strength) {
      errors.push('Medication missing required fields: name and strength');
    }
    if (!med.dose || !med.frequency) {
      warnings.push(`${med.name}: Missing dose or frequency instructions`);
    }
  }

  // Check drug interactions
  const allMedications = [
    ...params.medications.map(m => m.name),
    ...(params.currentMedications || []),
  ];
  
  const interactions = checkDrugInteractions({
    medications: allMedications,
    allergies: params.allergies,
    conditions: params.diagnoses,
  });

  // Add interaction warnings
  for (const interaction of interactions.interactions) {
    if (interaction.severity === 'contraindicated') {
      errors.push(`CONTRAINDICATED: ${interaction.drug1} + ${interaction.drug2} - ${interaction.description}`);
    } else if (interaction.severity === 'major') {
      errors.push(`MAJOR INTERACTION: ${interaction.drug1} + ${interaction.drug2} - ${interaction.description}`);
    } else {
      warnings.push(`${interaction.severity.toUpperCase()}: ${interaction.drug1} + ${interaction.drug2}`);
    }
  }

  // Check allergies
  for (const allergy of interactions.allergies) {
    errors.push(`ALLERGY ALERT: Patient allergic to ${allergy.drug} - ${allergy.reaction}`);
  }

  // Pediatric dosing checks
  if (params.patientAge < 12 && params.patientWeight) {
    for (const med of params.medications) {
      const weightBasedMeds = ['paracetamol', 'amoxicillin', 'ibuprofen', 'metronidazole', 'azithromycin'];
      if (weightBasedMeds.some(m => med.name.toLowerCase().includes(m))) {
        if (!med.dose?.includes('mg/kg')) {
          warnings.push(`${med.name}: Consider weight-based dosing for pediatric patient (${params.patientWeight}kg)`);
        }
      }
    }
  }

  // Renal dosing adjustments
  if (params.renalFunction?.eGFR && params.renalFunction.eGFR < 60) {
    const renalAdjustedMeds = ['metformin', 'enalapril', 'lisinopril', 'digoxin', 'allopurinol'];
    for (const med of params.medications) {
      if (renalAdjustedMeds.some(m => med.name.toLowerCase().includes(m))) {
        warnings.push(`${med.name}: Requires dose adjustment for renal impairment (eGFR: ${params.renalFunction.eGFR})`);
        recommendations.push(`Consider reducing dose or extending interval for ${med.name}`);
      }
    }
  }

  // Pregnancy safety checks
  if (params.isPregnant) {
    const pregnancyUnsafe = [
      'ace_inhibitors', 'warfarin', 'isotretinoin', 'methotrexate', 
      'tetracyclines', 'fluoroquinolones', 'nsaids'
    ];
    for (const med of params.medications) {
      if (pregnancyUnsafe.some(u => med.name.toLowerCase().includes(u))) {
        errors.push(`PREGNANCY CONTRAINDICATION: ${med.name} is unsafe in pregnancy`);
      }
    }
  }

  // Use AI for additional validation and recommendations
  try {
    const aiPrompt = `
Validate this prescription for safety and appropriateness:

Patient: ${params.patientAge} year old, ${params.patientWeight ? params.patientWeight + 'kg' : 'weight unknown'}
${params.isPregnant ? 'Pregnant' : ''} ${params.isBreastfeeding ? 'Breastfeeding' : ''}

Diagnoses: ${params.diagnoses?.join(', ') || 'Not specified'}

Medications prescribed:
${params.medications.map(m => `- ${m.name} ${m.strength}: ${m.dose || 'no dose'} ${m.frequency || ''}`).join('\n')}

Current medications: ${params.currentMedications?.join(', ') || 'None'}
Allergies: ${params.allergies?.join(', ') || 'None known'}

${params.renalFunction?.eGFR ? `Renal function: eGFR ${params.renalFunction.eGFR}` : ''}

Provide:
1. Any additional safety concerns not already identified
2. Dosing recommendations for African context
3. Patient education points
4. Monitoring requirements

Return as JSON with fields: additionalConcerns, dosingRecommendations, patientEducation, monitoringRequirements.
`.trim();

    const aiResponse = await orchestrateAI({
      taskType: 'drug_interaction',
      prompt: aiPrompt,
      systemInstruction: 'You are a clinical pharmacist specializing in medication safety in African healthcare settings. Focus on practical, resource-appropriate recommendations.',
      requireConsensus: false,
    });

    if (aiResponse.success && aiResponse.text) {
      const aiAnalysis = JSON.parse(aiResponse.text);
      if (aiAnalysis.additionalConcerns) {
        warnings.push(...aiAnalysis.additionalConcerns);
      }
      if (aiAnalysis.dosingRecommendations) {
        recommendations.push(...aiAnalysis.dosingRecommendations);
      }
      if (aiAnalysis.patientEducation) {
        recommendations.push('Patient Education: ' + aiAnalysis.patientEducation.join('; '));
      }
      if (aiAnalysis.monitoringRequirements) {
        recommendations.push('Monitoring: ' + aiAnalysis.monitoringRequirements.join('; '));
      }
    }
  } catch (error) {
    logger.warn('[AI Pharmacy] AI validation failed, continuing with basic checks', { error });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    interactions,
    recommendations,
    requiresReview: errors.length > 0 || interactions.requiresReview,
  };
}

// ─── Smart Inventory Management ───────────────────────────────────────────────

/**
 * Predict inventory needs based on historical usage and epidemiology
 */
export async function predictInventoryNeeds(params: {
  facilityId: string;
  currentStock: Array<{ medication: string; quantity: number; unit: string }>;
  historicalUsage?: Array<{ medication: string; quantity: number; date: string }>;
}): Promise<InventoryPrediction[]> {
  const predictions: InventoryPrediction[] = [];

  // Get facility epidemiology for context
  const epidemiology = await ClinicalMemory.getFacilityEpidemiology(params.facilityId);

  for (const stock of params.currentStock) {
    // Calculate predicted demand based on historical usage or epidemiology
    let predictedDailyDemand = 0;
    let confidence = 0.5;

    if (params.historicalUsage && params.historicalUsage.length > 0) {
      // Use historical data
      const medHistory = params.historicalUsage.filter(h => h.medication === stock.medication);
      if (medHistory.length >= 7) {
        const totalUsage = medHistory.reduce((sum, h) => sum + h.quantity, 0);
        const days = Math.ceil(
          (new Date(medHistory[0].date).getTime() - new Date(medHistory[medHistory.length - 1].date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        predictedDailyDemand = totalUsage / Math.max(days, 1);
        confidence = 0.8;
      }
    }

    // Adjust based on epidemiology if available
    if (epidemiology) {
      // Check if this medication is related to current outbreaks
      const outbreakMeds = getOutbreakRelatedMeds(epidemiology);
      if (outbreakMeds.includes(stock.medication.toLowerCase())) {
        predictedDailyDemand *= 1.5; // Increase by 50% for outbreak
        confidence = 0.7;
      }
    }

    // If no historical data, use default estimates
    if (predictedDailyDemand === 0) {
      predictedDailyDemand = getDefaultDailyDemand(stock.medication);
      confidence = 0.3;
    }

    const daysUntilStockout = predictedDailyDemand > 0 
      ? Math.floor(stock.quantity / predictedDailyDemand) 
      : 999;

    // Determine urgency
    let urgency: InventoryPrediction['urgency'] = 'low';
    if (daysUntilStockout <= 3) urgency = 'critical';
    else if (daysUntilStockout <= 7) urgency = 'high';
    else if (daysUntilStockout <= 14) urgency = 'medium';

    // Calculate recommended order quantity (30-day supply + safety stock)
    const safetyStock = predictedDailyDemand * 7; // 1 week safety stock
    const recommendedOrderQuantity = Math.ceil(
      (predictedDailyDemand * 30) + safetyStock - stock.quantity
    );

    predictions.push({
      medication: stock.medication,
      currentStock: stock.quantity,
      predictedDemand: Math.ceil(predictedDailyDemand * 30),
      daysUntilStockout,
      recommendedOrderQuantity: Math.max(recommendedOrderQuantity, 0),
      urgency,
      confidence,
    });
  }

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return predictions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

function getOutbreakRelatedMeds(epidemiology: { currentOutbreaks?: Array<{ disease: string }>; facilityId?: string }): string[] {
  const outbreakMeds: Record<string, string[]> = {
    'malaria': ['artemether-lumefantrine', 'coartem', 'quinine', 'artesunate'],
    'typhoid': ['ciprofloxacin', 'azithromycin', 'ceftriaxone'],
    'cholera': ['doxycycline', 'azithromycin', 'oral rehydration salts'],
    'respiratory infection': ['amoxicillin', 'azithromycin', 'ciprofloxacin'],
    'tuberculosis': ['rifampicin', 'isoniazid', 'pyrazinamide', 'ethambutol'],
  };

  const relatedMeds: string[] = [];
  for (const outbreak of epidemiology.currentOutbreaks || []) {
    const disease = outbreak.disease.toLowerCase();
    for (const [key, meds] of Object.entries(outbreakMeds)) {
      if (disease.includes(key)) {
        relatedMeds.push(...meds);
      }
    }
  }
  return relatedMeds;
}

function getDefaultDailyDemand(medication: string): number {
  // Default estimates for common medications
  const defaults: Record<string, number> = {
    'paracetamol': 50,
    'amoxicillin': 30,
    'artemether-lumefantrine': 20,
    'coartem': 20,
    'metformin': 25,
    'amlodipine': 15,
    'enalapril': 10,
    'oral rehydration salts': 40,
    'ibuprofen': 20,
    'azithromycin': 15,
    'ciprofloxacin': 10,
    'metronidazole': 15,
  };

  const medLower = medication.toLowerCase();
  for (const [key, value] of Object.entries(defaults)) {
    if (medLower.includes(key)) return value;
  }
  return 5; // Default for unknown medications
}

// ─── Expiry Tracking ──────────────────────────────────────────────────────────

/**
 * Check for medications approaching expiry
 */
export function checkExpiryDates(params: {
  batches: Array<{
    medication: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
  }>;
}): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = [];
  const now = new Date();

  for (const batch of params.batches) {
    const expiryDate = new Date(batch.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      alerts.push({
        medication: batch.medication,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity,
        daysUntilExpiry,
        urgency: 'high',
        recommendation: 'IMMEDIATE: Remove from inventory and dispose according to pharmaceutical waste protocol',
      });
    } else if (daysUntilExpiry <= 30) {
      let urgency: ExpiryAlert['urgency'] = 'low';
      if (daysUntilExpiry <= 7) urgency = 'high';
      else if (daysUntilExpiry <= 14) urgency = 'medium';

      alerts.push({
        medication: batch.medication,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity,
        daysUntilExpiry,
        urgency,
        recommendation: getExpiryRecommendation(daysUntilExpiry, batch.quantity),
      });
    }
  }

  // Sort by days until expiry
  return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

function getExpiryRecommendation(days: number, quantity: number): string {
  if (days <= 7) {
    return 'URGENT: Use immediately or transfer to facility with higher usage';
  } else if (days <= 14) {
    return `Consider prioritizing use. Current quantity (${quantity}) may be difficult to use before expiry`;
  } else {
    return 'Monitor usage and consider redistributing to higher-volume facilities';
  }
}

// ─── Smart Dispensing Suggestions ─────────────────────────────────────────────

/**
 * Generate AI-powered dispensing suggestions for a medication
 */
export async function getSmartDispensingSuggestion(params: {
  medication: string;
  condition: string;
  patientAge: number;
  patientWeight?: number;
  renalFunction?: { eGFR?: number };
  isPregnant?: boolean;
}): Promise<SmartDispensingSuggestion | null> {
  try {
    const prompt = `
Provide dispensing guidance for:

Medication: ${params.medication}
Condition: ${params.condition}
Patient: ${params.patientAge} years old${params.patientWeight ? `, ${params.patientWeight}kg` : ''}
${params.renalFunction?.eGFR ? `Renal function: eGFR ${params.renalFunction.eGFR}` : ''}
${params.isPregnant ? 'Pregnant patient' : ''}

Provide:
1. Suggested dose (consider African context and resource availability)
2. Suggested frequency
3. Suggested duration
4. Alternative medications if unavailable
5. Contraindications to check
6. Monitoring requirements
7. Patient education points

Return as JSON with fields: suggestedDose, suggestedFrequency, suggestedDuration, alternatives, contraindications, monitoring, patientEducation.
`.trim();

    const response = await orchestrateAI({
      taskType: 'drug_interaction',
      prompt,
      systemInstruction: 'You are a clinical pharmacist providing practical dispensing guidance for African healthcare settings. Consider drug availability and cost-effectiveness.',
      requireConsensus: false,
    });

    if (response.success && response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    logger.error('[AI Pharmacy] Failed to generate dispensing suggestion', { error });
  }

  return null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AIPharmacy = {
  validatePrescription,
  predictInventoryNeeds,
  checkExpiryDates,
  getSmartDispensingSuggestion,
};