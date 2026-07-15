import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

interface ClaimField {
  field: string;
  status: 'complete' | 'incomplete' | 'invalid';
  message: string;
  suggestion?: string;
}

interface ICD10Suggestion {
  code: string;
  description: string;
  confidence: number;
  justification: string;
  specificity: 'high' | 'medium' | 'low';
}

interface ClaimValidation {
  claimId: string;
  completenessScore: number;
  rejectionRisk: 'low' | 'medium' | 'high';
  riskPercentage: number;
  requiredFields: ClaimField[];
  icd10Suggestions: ICD10Suggestion[];
  optimizationTips: string[];
  recommendedActions: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimId, diagnosis, procedures, patientId } = body;

    if (!diagnosis) {
      return NextResponse.json(
        { error: 'diagnosis is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields: ClaimField[] = [];
    let completenessScore = 0;
    const totalFields = 8;

    // Check diagnosis
    if (diagnosis && diagnosis.length > 3) {
      requiredFields.push({
        field: 'diagnosis',
        status: 'complete',
        message: 'Diagnosis provided',
      });
      completenessScore += 1;
    } else {
      requiredFields.push({
        field: 'diagnosis',
        status: 'incomplete',
        message: 'Diagnosis too brief or missing',
        suggestion: 'Provide a detailed clinical diagnosis',
      });
    }

    // Check procedures
    if (procedures && procedures.length > 0) {
      requiredFields.push({
        field: 'procedures',
        status: 'complete',
        message: `${procedures.length} procedure(s) documented`,
      });
      completenessScore += 1;
    } else {
      requiredFields.push({
        field: 'procedures',
        status: 'incomplete',
        message: 'No procedures documented',
        suggestion: 'Document all procedures performed',
      });
    }

    // Check patient ID
    if (patientId) {
      requiredFields.push({
        field: 'patientId',
        status: 'complete',
        message: 'Patient identified',
      });
      completenessScore += 1;
    } else {
      requiredFields.push({
        field: 'patientId',
        status: 'incomplete',
        message: 'Patient ID missing',
        suggestion: 'Provide patient identifier',
      });
    }

    // Simulate other required field checks
    const otherFields = [
      { name: 'patient demographics', present: true },
      { name: 'provider information', present: true },
      { name: 'service dates', present: true },
      { name: 'medical record number', present: false },
      { name: 'authorization', present: true },
    ];

    for (const field of otherFields) {
      if (field.present) {
        requiredFields.push({
          field: field.name,
          status: 'complete',
          message: `${field.name} documented`,
        });
        completenessScore += 1;
      } else {
        requiredFields.push({
          field: field.name,
          status: 'incomplete',
          message: `${field.name} missing`,
          suggestion: `Document ${field.name}`,
        });
      }
    }

    completenessScore = Math.round((completenessScore / totalFields) * 100);

    // Calculate rejection risk based on completeness
    let rejectionRisk: 'low' | 'medium' | 'high' = 'low';
    let riskPercentage = 0;

    if (completenessScore >= 90) {
      rejectionRisk = 'low';
      riskPercentage = 5;
    } else if (completenessScore >= 70) {
      rejectionRisk = 'medium';
      riskPercentage = 25;
    } else {
      rejectionRisk = 'high';
      riskPercentage = 50;
    }

    // Generate ICD-10 suggestions
    const icd10Suggestions = generateICD10Suggestions(diagnosis);

    // Generate optimization tips
    const optimizationTips = generateOptimizationTips(diagnosis, procedures, completenessScore);

    // Generate recommended actions
    const recommendedActions = generateRecommendedActions(requiredFields, rejectionRisk);

    const validation: ClaimValidation = {
      claimId: claimId || `claim-${Date.now()}`,
      completenessScore,
      rejectionRisk,
      riskPercentage,
      requiredFields,
      icd10Suggestions,
      optimizationTips,
      recommendedActions,
    };

    logger.info('Insurance claim optimization completed', {
      claimId: validation.claimId,
      completenessScore,
      rejectionRisk,
    });

    return NextResponse.json(validation);
  } catch (error) {
    logger.error('Insurance claim optimization error', { error });
    return NextResponse.json(
      { error: 'Failed to optimize insurance claim' },
      { status: 500 }
    );
  }
}

function generateICD10Suggestions(diagnosis: string): ICD10Suggestion[] {
  const suggestions: ICD10Suggestion[] = [];
  const diagnosisLower = diagnosis.toLowerCase();

  // Common ICD-10 codes based on diagnosis keywords
  const icd10Map: Record<string, { code: string; description: string; specificity: 'high' | 'medium' | 'low' }> = {
    malaria: { code: 'B54', description: 'Malaria, unspecified', specificity: 'medium' },
    'severe malaria': { code: 'B50.9', description: 'Plasmodium falciparum malaria, unspecified', specificity: 'high' },
    pneumonia: { code: 'J18.9', description: 'Pneumonia, unspecified', specificity: 'medium' },
    'bacterial pneumonia': { code: 'J15.9', description: 'Unspecified bacterial pneumonia', specificity: 'high' },
    'viral pneumonia': { code: 'J12.9', description: 'Viral pneumonia, unspecified', specificity: 'high' },
    hypertension: { code: 'I10', description: 'Essential (primary) hypertension', specificity: 'high' },
    diabetes: { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', specificity: 'medium' },
    'type 1 diabetes': { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', specificity: 'high' },
    asthma: { code: 'J45', description: 'Asthma', specificity: 'medium' },
    'acute bronchitis': { code: 'J20.9', description: 'Acute bronchitis, unspecified', specificity: 'medium' },
    gastroenteritis: { code: 'K52.9', description: 'Noninfective gastroenteritis and colitis, unspecified', specificity: 'medium' },
    'infectious gastroenteritis': { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', specificity: 'high' },
    dengue: { code: 'A91', description: 'Dengue fever [dengue]', specificity: 'high' },
    typhoid: { code: 'A01.0', description: 'Typhoid fever', specificity: 'high' },
    tuberculosis: { code: 'A15', description: 'Respiratory tuberculosis, not confirmed bacteriologically or histologically', specificity: 'medium' },
    'pulmonary tuberculosis': { code: 'A15.9', description: 'Respiratory tuberculosis, unspecified', specificity: 'high' },
  };

  // Find matching codes
  for (const [keyword, codeInfo] of Object.entries(icd10Map)) {
    if (diagnosisLower.includes(keyword)) {
      suggestions.push({
        code: codeInfo.code,
        description: codeInfo.description,
        confidence: 0.85,
        justification: `Diagnosis contains "${keyword}" which maps to this ICD-10 code`,
        specificity: codeInfo.specificity,
      });
    }
  }

  // If no matches, provide general suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      code: 'R50.9',
      description: 'Fever, unspecified',
      confidence: 0.5,
      justification: 'General symptom code - consider more specific diagnosis',
      specificity: 'low',
    });
  }

  return suggestions.slice(0, 5); // Return top 5 suggestions
}

function generateOptimizationTips(diagnosis: string, procedures: string[], completenessScore: number): string[] {
  const tips: string[] = [];

  // Diagnosis-specific tips
  if (diagnosis.toLowerCase().includes('malaria')) {
    tips.push('Include malaria test results (RDT or microscopy) in documentation');
    tips.push('Document severity classification (uncomplicated vs severe)');
  }

  if (diagnosis.toLowerCase().includes('pneumonia')) {
    tips.push('Include chest X-ray findings in documentation');
    tips.push('Document oxygen saturation levels');
    tips.push('Specify pneumonia type (bacterial, viral, aspiration)');
  }

  if (diagnosis.toLowerCase().includes('hypertension')) {
    tips.push('Document blood pressure readings over multiple visits');
    tips.push('Include cardiovascular risk assessment');
  }

  // Procedure tips
  if (procedures && procedures.length > 0) {
    tips.push('Ensure procedure codes match current CPT/HCPCS standards');
    tips.push('Document medical necessity for each procedure');
    tips.push('Include procedure notes with detailed descriptions');
  }

  // Completeness tips
  if (completenessScore < 100) {
    tips.push('Complete all required fields before submission');
    tips.push('Review claim against SHIF requirements');
  }

  // General tips
  tips.push('Use the most specific ICD-10 code available');
  tips.push('Document all comorbidities that affect treatment');
  tips.push('Include clinical decision support documentation when applicable');

  return tips;
}

function generateRecommendedActions(requiredFields: ClaimField[], rejectionRisk: string): string[] {
  const actions: string[] = [];

  // Address incomplete fields
  const incompleteFields = requiredFields.filter(f => f.status !== 'complete');
  for (const field of incompleteFields) {
    actions.push(`Complete ${field.field}: ${field.suggestion || 'Provide required information'}`);
  }

  // Risk-based actions
  if (rejectionRisk === 'high') {
    actions.push('Review entire claim for completeness before submission');
    actions.push('Consider clinical documentation review');
    actions.push('Verify all codes are current and valid');
  } else if (rejectionRisk === 'medium') {
    actions.push('Review incomplete fields');
    actions.push('Add supporting documentation where possible');
  } else {
    actions.push('Proceed with claim submission');
    actions.push('Monitor claim status for any additional requests');
  }

  // SHIF-specific actions
  actions.push('Verify SHIF eligibility for the patient');
  actions.push('Confirm pre-authorization if required for services');
  actions.push('Check SHIF tariff codes for procedures');

  return actions;
}
