/**
 * Clinical Documentation Suggestions API
 * 
 * POST /api/clinical/documentation/suggestions
 * 
 * Provides AI-powered automated clinical documentation suggestions:
 * - Partial note completion suggestions
 * - ICD-10 code recommendations
 * - Structured documentation templates
 * - Clinical terminology standardization
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, readJsonBody, requireRoles } from '@/lib/api-security';
import { orchestrateAI } from '@/lib/ai-orchestrator';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:clinical:documentation:suggestions');
  if (rateLimit) return rateLimit;

  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  const body = await readJsonBody<{
    documentType?: unknown;
    patientContext?: unknown;
    partialContent?: unknown;
    suggestionsFor?: unknown;
  }>(req);
  if (body instanceof NextResponse) return body;

  const documentType = typeof body.documentType === 'string' ? body.documentType : 'soap_note';
  const patientContext = body.patientContext && typeof body.patientContext === 'object' ? body.patientContext as Record<string, unknown> : {};
  const partialContent = typeof body.partialContent === 'string' ? body.partialContent : '';
  const suggestionsFor = typeof body.suggestionsFor === 'string' ? body.suggestionsFor : 'completion';

  try {
    let suggestions: any = {};
    let prompt = '';
    let systemInstruction = '';

    switch (documentType) {
      case 'soap_note':
        prompt = buildSOAPPrompt(patientContext, partialContent, suggestionsFor);
        systemInstruction = buildSOAPSystemInstruction();
        break;
      case 'discharge_summary':
        prompt = buildDischargePrompt(patientContext, partialContent, suggestionsFor);
        systemInstruction = buildDischargeSystemInstruction();
        break;
      case 'progress_note':
        prompt = buildProgressNotePrompt(patientContext, partialContent, suggestionsFor);
        systemInstruction = buildProgressNoteSystemInstruction();
        break;
      case 'icd10_codes':
        prompt = buildICD10Prompt(patientContext, partialContent);
        systemInstruction = buildICD10SystemInstruction();
        break;
      default:
        prompt = buildSOAPPrompt(patientContext, partialContent, suggestionsFor);
        systemInstruction = buildSOAPSystemInstruction();
    }

    const response = await orchestrateAI({
      taskType: 'documentation',
      prompt,
      systemInstruction,
      patientId: typeof patientContext.patientId === 'string' ? patientContext.patientId : undefined,
      clinicianId: session.id,
      facilityId: session.hospitalId,
      requireConsensus: false,
    });

    if (!response.success || !response.text) {
      return NextResponse.json({ error: 'Failed to generate documentation suggestions' }, { status: 500 });
    }

    // Parse response based on document type
    if (documentType === 'icd10_codes') {
      suggestions = parseICD10Response(response.text);
    } else {
      suggestions = parseDocumentationResponse(response.text, suggestionsFor);
    }

    return NextResponse.json({
      success: true,
      documentType,
      suggestions,
      metadata: {
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Documentation Suggestions] Internal server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate documentation suggestions' }, { status: 500 });
  }
}

function buildSOAPPrompt(context: Record<string, unknown>, partial: string, suggestionsFor: string): string {
  const parts: string[] = [];
  
  parts.push(`Patient: ${context.age || 'Age not specified'} year old ${context.gender || 'gender not specified'}`);
  if (context.chiefComplaint) parts.push(`Chief Complaint: ${context.chiefComplaint}`);
  if (context.symptoms && Array.isArray(context.symptoms)) parts.push(`Symptoms: ${context.symptoms.join(', ')}`);
  if (context.vitals && typeof context.vitals === 'object') {
    parts.push(`Vitals: ${JSON.stringify(context.vitals)}`);
  }
  
  if (partial) {
    parts.push(`\nPartial Content:\n${partial}`);
  }
  
  parts.push(`\n\nProvide suggestions for: ${suggestionsFor}`);
  parts.push('\nReturn as structured JSON with appropriate fields.');
  
  return parts.join('\n');
}

function buildSOAPSystemInstruction(): string {
  return `You are a clinical documentation specialist for East African healthcare.
Provide structured, professional clinical documentation following standard SOAP format.
Use appropriate medical terminology and Kenya MOH guidelines.
Be concise but thorough. Include relevant clinical details.`;
}

function buildDischargePrompt(context: Record<string, unknown>, partial: string, suggestionsFor: string): string {
  const parts: string[] = ['Generate discharge summary suggestions:'];
  
  if (context.admissionDiagnosis) parts.push(`Admission Diagnosis: ${context.admissionDiagnosis}`);
  if (context.treatmentReceived) parts.push(`Treatment Received: ${context.treatmentReceived}`);
  if (context.lengthOfStay) parts.push(`Length of Stay: ${context.lengthOfStay} days`);
  if (context.dischargeCondition) parts.push(`Discharge Condition: ${context.dischargeCondition}`);
  
  if (partial) {
    parts.push(`\nPartial Content:\n${partial}`);
  }
  
  parts.push(`\n\nProvide suggestions for: ${suggestionsFor}`);
  
  return parts.join('\n');
}

function buildDischargeSystemInstruction(): string {
  return `You are a clinical documentation specialist for discharge summaries.
Provide comprehensive discharge documentation including:
- Summary of hospital course
- Discharge medications
- Discharge diagnosis
- Follow-up instructions
- Patient education points
Follow Kenya MOH discharge documentation standards.`;
}

function buildProgressNotePrompt(context: Record<string, unknown>, partial: string, suggestionsFor: string): string {
  const parts: string[] = ['Generate progress note suggestions:'];
  
  if (context.currentStatus) parts.push(`Current Status: ${context.currentStatus}`);
  if (context.interventions) parts.push(`Interventions: ${context.interventions}`);
  if (context.responseToTreatment) parts.push(`Response to Treatment: ${context.responseToTreatment}`);
  
  if (partial) {
    parts.push(`\nPartial Content:\n${partial}`);
  }
  
  parts.push(`\n\nProvide suggestions for: ${suggestionsFor}`);
  
  return parts.join('\n');
}

function buildProgressNoteSystemInstruction(): string {
  return `You are a clinical documentation specialist for progress notes.
Provide structured progress notes including:
- Subjective: Patient-reported information
- Objective: Clinical findings and data
- Assessment: Clinical judgment and evaluation
- Plan: Treatment decisions and next steps
Use standard medical terminology and be concise.`;
}

function buildICD10Prompt(context: Record<string, unknown>, partial: string): string {
  const parts: string[] = ['Suggest ICD-10 codes for:'];
  
  if (context.diagnosis) parts.push(`Diagnosis: ${context.diagnosis}`);
  if (context.symptoms && Array.isArray(context.symptoms)) parts.push(`Symptoms: ${context.symptoms.join(', ')}`);
  if (context.findings) parts.push(`Clinical Findings: ${context.findings}`);
  
  if (partial) {
    parts.push(`\nAdditional Context:\n${partial}`);
  }
  
  parts.push('\n\nProvide ICD-10 codes with:');
  parts.push('- Code');
  parts.push('- Description');
  parts.push('- Confidence (how well it matches)');
  parts.push('\nReturn as JSON array.');
  
  return parts.join('\n');
}

function buildICD10SystemInstruction(): string {
  return `You are an ICD-10 coding specialist for East African healthcare.
Provide the most appropriate ICD-10 codes based on clinical information.
Consider Kenya-specific disease patterns and common diagnoses.
Include both specific and broader category codes when relevant.
Return codes in the format: A00.0 (code) - Cholera due to Vibrio cholerae 01, biovar cholerae (description).`;
}

function parseDocumentationResponse(response: string, suggestionsFor: string): any {
  try {
    return JSON.parse(response);
  } catch {
    // If JSON parsing fails, return as text
    return { text: response, suggestionsFor };
  }
}

function parseICD10Response(response: string): any {
  try {
    return JSON.parse(response);
  } catch {
    // If JSON parsing fails, extract codes manually
    const codePattern = /([A-Z]\d{2}(?:\.\d)?)/g;
    const codes = response.match(codePattern) || [];
    return {
      codes: codes.map(code => ({
        code,
        description: 'See full response for details',
        confidence: 0.7,
      })),
      rawResponse: response,
    };
  }
}

/**
 * GET /api/clinical/documentation/suggestions
 * 
 * Returns available document types and metadata
 */
export async function GET(req: NextRequest) {
  const session = requireRoles(req, ['medical', 'admin']);
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    name: 'Clinical Documentation Suggestions',
    version: '1.0.0',
    description: 'AI-powered automated clinical documentation suggestions',
    documentTypes: [
      { type: 'soap_note', description: 'SOAP note structure and content suggestions' },
      { type: 'discharge_summary', description: 'Discharge summary generation assistance' },
      { type: 'progress_note', description: 'Progress note documentation support' },
      { type: 'icd10_codes', description: 'ICD-10 coding recommendations' },
    ],
    suggestionTypes: [
      { type: 'completion', description: 'Complete partially filled documentation' },
      { type: 'structure', description: 'Suggest appropriate structure and sections' },
      { type: 'terminology', description: 'Standardize clinical terminology' },
      { type: 'codes', description: 'Recommend appropriate billing/coding codes' },
    ],
  });
}
