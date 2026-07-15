import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
  requireString,
  validateEnumValue,
  validateOptionalString,
} from '@/lib/api-security';
import type { PortalRole } from '@/types';
import {
  callWithCascade,
  callParallelConsensus,
  getCascadeForType,
  type AICitation,
  type NormalizedProviderResponse,
} from '@/lib/ai-providers';
import { logAIInteraction, logConsensusInteractions } from '@/lib/ai-audit';
import { buildPromptCacheKey, getPromptCache, setPromptCache } from '@/lib/prompt-cache';
import {
  type DawaRagSnippet,
  formatRagPromptBlock,
  retrieveDawaKnowledge,
  snippetsToCitations,
} from '@/lib/dawa-rag';
import { buildDegradedResponse } from '@/lib/degraded-response';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';

/* ─── Specialized Gemini Model Configuration ──────────────────────────────────
 * Each clinical domain maps to a purpose-built model. Override via env vars.
 * When Med-Gemini / Gemini 3 become GA, swap the IDs here — zero code changes.
 * ────────────────────────────────────────────────────────────────────────────── */
const MODELS = {
  CLINICAL:   process.env.GEMINI_MODEL_CLINICAL   || 'gemini-2.5-pro',   // med-gemini-1.5-pro not publicly available
  GENERAL:    process.env.GEMINI_MODEL_GENERAL    || 'gemini-2.5-flash', // 1.5-pro deprecated Apr 2026
  DAWA:       process.env.GEMINI_MODEL_DAWA       || 'gemini-2.5-pro',
  RADIOLOGY:  process.env.GEMINI_MODEL_RADIOLOGY  || 'gemini-2.5-pro',   // med-gemini-2d not publicly available
  PATHOLOGY:  process.env.GEMINI_MODEL_PATHOLOGY  || 'gemini-2.5-pro',   // med-gemini-3d not publicly available
  SCRIBE:     process.env.GEMINI_MODEL_SCRIBE     || 'gemini-2.5-flash', // gemini-3.0-flash does not exist
  ANTHROPIC:  process.env.ANTHROPIC_MODEL         || 'claude-3-5-sonnet-latest',
};

type DiagnosticResult = {
  name: string;
  confidence: number;
  risk: string;
  recommendation: string;
};

type InventoryInsight = {
  item: string;
  usage: string;
  prediction: string;
  suggestion: string;
};

type LabInsight = {
  parameter: string;
  value: string;
  normal: string;
  status: string;
  clinical: string;
};

type AnalyticsResult = {
  answer: string;
  forecast: string;
  recommendations: string[];
};

type TeleconsultationResult = {
  summary: string;
  nextSteps: string[];
};

type DrugInteractionResult = {
  drug1: string;
  drug2: string;
  severity: string;
  mechanism: string;
  clinical_effect: string;
  recommendation: string;
};

type Icd10Result = {
  code: string;
  description: string;
  confidence: number;
  notes: string;
};

type RadiologyResult = {
  impression: string;
  findings: Array<{ area: string; observation: string; significance: string }>;
  differentials: Array<{ name: string; confidence: number; recommendation: string }>;
  follow_up: string;
};

type PathologyResult = {
  diagnosis: string;
  microscopic: string;
  markers: Array<{ marker: string; result: string; interpretation: string }>;
  grade_stage: string;
  differentials: Array<{ name: string; confidence: number }>;
  recommendation: string;
};

const ANALYSIS_TYPES = [
  'diagnostic', 'inventory', 'lab', 'analytics', 'teleconsultation',
  'drug_interaction', 'icd10', 'radiology', 'pathology',
] as const;

type AnalysisType = (typeof ANALYSIS_TYPES)[number];
type AnalyzeResponsePayload = {
  results: unknown;
  citations?: AICitation[];
  provider?: string;
  model?: string;
  cached?: boolean;
};

const ANALYZE_CACHE_TTL_SECONDS = Number(process.env.AI_ANALYZE_CACHE_TTL_SECONDS ?? 300);

const ROLE_ANALYSIS_ACCESS: Record<PortalRole, AnalysisType[]> = {
  reception: [],
  admin: [],
  super_admin: ['diagnostic', 'teleconsultation', 'drug_interaction', 'icd10', 'radiology', 'pathology', 'analytics'],
  medical: ['diagnostic', 'teleconsultation', 'drug_interaction', 'icd10', 'radiology', 'pathology', 'analytics'],
  lab: ['lab', 'pathology', 'analytics', 'inventory'],
  pharmacy: ['inventory', 'drug_interaction', 'analytics', 'icd10'],
};

function enforceRoleAnalysisAccess(role: PortalRole, type: AnalysisType): NextResponse | null {
  const allowed = ROLE_ANALYSIS_ACCESS[role] ?? [];
  if (allowed.includes(type)) return null;

  if (role === 'reception' || role === 'admin') {
    return NextResponse.json(
      {
        error: 'Non-clinical roles must use DAWA for AI support.',
        route: '/api/ai/dawa',
        message: 'Use DAWA for workflow and operations guidance.',
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error: `AI analysis type '${type}' is not permitted for role '${role}'.`,
      allowedTypes: allowed,
    },
    { status: 403 },
  );
}

const RISK_ORDER = ['Low', 'Medium', 'High', 'Critical'];

const riskRank = (risk: string) => {
  const normalized = risk?.toLowerCase() === 'moderate' ? 'medium' : risk?.toLowerCase();
  const idx = RISK_ORDER.findIndex((r) => r.toLowerCase() === normalized);
  return idx === -1 ? 0 : idx;
};

const extractJson = (raw: string) => {
  // Try to find JSON objects/arrays, preferring the last complete one
  const jsonMatches = raw.match(/(\[.*\]|\{.*\})/gs);
  if (!jsonMatches) return null;

  // Try parsing from the end (most complete responses)
  for (let i = jsonMatches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(jsonMatches[i]);
    } catch {
      continue;
    }
  }

  return null;
};

const textValue = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const boundedConfidence = (value: unknown, fallback = 0) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const stringArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
};

// fetchWithTimeout removed — use ai-providers.ts implementation

const normalizeDiagnostics = (payload: unknown): DiagnosticResult[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item: Record<string, unknown>) => {
      const name = String(item.name ?? item.diagnosis ?? '').trim();
      if (!name) return null;
      const confidenceRaw = typeof item.confidence === 'number'
        ? item.confidence
        : Number(item.confidence ?? item.score ?? 0);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, confidenceRaw)) : 0;
      const risk = String(item.risk ?? item.severity ?? 'Medium').trim();
      const recommendation = String(item.recommendation ?? item.plan ?? item.notes ?? '').trim()
        || 'Review with clinical judgment before acting.';
      return { name, confidence, risk, recommendation };
    })
    .filter(Boolean) as DiagnosticResult[];
};

const mergeConsensus = (batches: DiagnosticResult[][]): DiagnosticResult[] => {
  const merged = new Map<string, { name: string; confidences: number[]; risks: string[]; recommendations: string[] }>();

  batches.flat().forEach((item) => {
    const key = item.name.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, { name: item.name, confidences: [], risks: [], recommendations: [] });
    }
    const bucket = merged.get(key)!;
    bucket.confidences.push(item.confidence);
    bucket.risks.push(item.risk);
    if (item.recommendation) bucket.recommendations.push(item.recommendation);
  });

  const consensus = Array.from(merged.values()).map((entry) => {
    const avgConfidence = Math.round(
      entry.confidences.reduce((a, b) => a + b, 0) / Math.max(entry.confidences.length, 1),
    );
    const topRisk = entry.risks.sort((a, b) => riskRank(b) - riskRank(a))[0] ?? 'Medium';
    const recommendation = entry.recommendations[0] ?? 'Review with clinical judgment before acting.';
    return { name: entry.name, confidence: avgConfidence, risk: topRisk, recommendation };
  });

  return consensus.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
};

const normalizeInventory = (payload: unknown): InventoryInsight[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        item: textValue(row.item, 'Inventory review'),
        usage: textValue(row.usage, 'stable'),
        prediction: textValue(row.prediction, 'Trend unavailable'),
        suggestion: textValue(row.suggestion, 'Review stock levels manually.'),
      };
    })
    .filter(Boolean) as InventoryInsight[];
};

const normalizeLab = (payload: unknown): LabInsight[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        parameter: textValue(row.parameter, 'Unknown parameter'),
        value: textValue(row.value, 'Unavailable'),
        normal: textValue(row.normal, 'N/A'),
        status: textValue(row.status, 'Review Required'),
        clinical: textValue(row.clinical, 'Use clinician interpretation and reference ranges.'),
      };
    })
    .filter(Boolean) as LabInsight[];
};

const normalizeAnalytics = (payload: unknown): AnalyticsResult => {
  if (!payload || typeof payload !== 'object') {
    return {
      answer: 'I could not generate a direct AI answer right now. Please retry with more context or check service availability.',
      forecast: 'Operational forecast unavailable from AI provider at the moment.',
      recommendations: ['Review queue load and staffing manually for this shift.'],
    };
  }

  const row = payload as Record<string, unknown>;
  return {
    answer: textValue(row.answer, 'I could not generate a direct AI answer right now. Please retry with more context or check service availability.'),
    forecast: textValue(row.forecast, 'Operational forecast unavailable from AI provider at the moment.'),
    recommendations: stringArray(row.recommendations, ['Review queue load and staffing manually for this shift.']),
  };
};

const normalizeTeleconsultation = (payload: unknown): TeleconsultationResult => {
  if (!payload || typeof payload !== 'object') {
    return {
      summary: 'Automatic scribe summary is currently unavailable. Please complete a manual SOAP-style summary.',
      nextSteps: ['Document key symptoms, assessment, and treatment plan manually.'],
    };
  }

  const row = payload as Record<string, unknown>;
  return {
    summary: textValue(row.summary, 'Automatic scribe summary is currently unavailable. Please complete a manual SOAP-style summary.'),
    nextSteps: stringArray(row.nextSteps, ['Document key symptoms, assessment, and treatment plan manually.']),
  };
};

const normalizeDrugInteractions = (payload: unknown): DrugInteractionResult[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        drug1: textValue(row.drug1, 'Unknown'),
        drug2: textValue(row.drug2, 'Unknown'),
        severity: textValue(row.severity, 'Moderate'),
        mechanism: textValue(row.mechanism, 'AI interaction engine unavailable.'),
        clinical_effect: textValue(row.clinical_effect, 'Interaction risk could not be computed automatically.'),
        recommendation: textValue(row.recommendation, 'Use pharmacist review and trusted interaction references before dispensing.'),
      };
    })
    .filter(Boolean) as DrugInteractionResult[];
};

const normalizeIcd10 = (payload: unknown): Icd10Result[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        code: textValue(row.code, 'R69'),
        description: textValue(row.description, 'Illness, unspecified'),
        confidence: boundedConfidence(row.confidence, 35),
        notes: textValue(row.notes, 'Fallback suggestion only. Confirm with a certified coder.'),
      };
    })
    .filter(Boolean) as Icd10Result[];
};

const normalizeRadiology = (payload: unknown): RadiologyResult => {
  if (!payload || typeof payload !== 'object') {
    return {
      impression: 'AI radiology interpretation unavailable.',
      findings: [],
      differentials: [],
      follow_up: 'Use radiologist report and clinician review for final interpretation.',
    };
  }

  const row = payload as Record<string, unknown>;
  const findings = Array.isArray(row.findings)
    ? row.findings
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const item = entry as Record<string, unknown>;
          return {
            area: textValue(item.area, 'General'),
            observation: textValue(item.observation, 'Observation unavailable'),
            significance: textValue(item.significance, 'Clinically Significant'),
          };
        })
        .filter(Boolean)
    : [];
  const differentials = Array.isArray(row.differentials)
    ? row.differentials
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const item = entry as Record<string, unknown>;
          return {
            name: textValue(item.name, 'Radiology review required'),
            confidence: boundedConfidence(item.confidence, 50),
            recommendation: textValue(item.recommendation, 'Correlate with imaging report and clinical findings.'),
          };
        })
        .filter(Boolean)
    : [];

  return {
    impression: textValue(row.impression, 'AI radiology interpretation unavailable.'),
    findings: findings as RadiologyResult['findings'],
    differentials: differentials as RadiologyResult['differentials'],
    follow_up: textValue(row.follow_up, 'Use radiologist report and clinician review for final interpretation.'),
  };
};

const normalizePathology = (payload: unknown): PathologyResult => {
  if (!payload || typeof payload !== 'object') {
    return {
      diagnosis: 'AI pathology interpretation unavailable.',
      microscopic: 'No structured microscopic summary generated.',
      markers: [],
      grade_stage: 'N/A',
      differentials: [],
      recommendation: 'Use pathology specialist review and standard reporting workflow.',
    };
  }

  const row = payload as Record<string, unknown>;
  const markers = Array.isArray(row.markers)
    ? row.markers
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const item = entry as Record<string, unknown>;
          return {
            marker: textValue(item.marker, 'Unknown marker'),
            result: textValue(item.result, 'Unavailable'),
            interpretation: textValue(item.interpretation, 'Interpretation unavailable'),
          };
        })
        .filter(Boolean)
    : [];
  const differentials = Array.isArray(row.differentials)
    ? row.differentials
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const item = entry as Record<string, unknown>;
          return {
            name: textValue(item.name, 'Pathology review required'),
            confidence: boundedConfidence(item.confidence, 50),
          };
        })
        .filter(Boolean)
    : [];

  return {
    diagnosis: textValue(row.diagnosis, 'AI pathology interpretation unavailable.'),
    microscopic: textValue(row.microscopic, 'No structured microscopic summary generated.'),
    markers: markers as PathologyResult['markers'],
    grade_stage: textValue(row.grade_stage, 'N/A'),
    differentials: differentials as PathologyResult['differentials'],
    recommendation: textValue(row.recommendation, 'Use pathology specialist review and standard reporting workflow.'),
  };
};

const normalizeResultByType = (type: AnalysisType, payload: unknown) => {
  switch (type) {
    case 'diagnostic':
      return normalizeDiagnostics(payload);
    case 'inventory':
      return normalizeInventory(payload);
    case 'lab':
      return normalizeLab(payload);
    case 'analytics':
      return normalizeAnalytics(payload);
    case 'teleconsultation':
      return normalizeTeleconsultation(payload);
    case 'drug_interaction':
      return normalizeDrugInteractions(payload);
    case 'icd10':
      return normalizeIcd10(payload);
    case 'radiology':
      return normalizeRadiology(payload);
    case 'pathology':
      return normalizePathology(payload);
  }
};

const buildSystemPromptForType = (type: AnalysisType) => {
  const safety = `You are an AfyaHero healthcare AI assistant for professional users in Kenya and the East African region.
- Return ONLY valid JSON for the requested schema.
- Never fabricate clinical facts.
- If uncertainty exists, include safe follow-up recommendations.
- When retrieval sources are provided, ground your answer in them and use inline [Source n] markers where relevant.
- REGIONAL CLINICAL GUIDELINES: Prioritize recommendations from NASCOP (HIV), KEML (Essential Medicines), and Ministry of Health (MOH) protocols.`;

  if (type === 'diagnostic') {
    return `${safety}
- Diagnostic outputs must prioritize detection of endemic tropical diseases: Malaria, TB, HIV-related opportunistic infections, and Cholera.
- Ensure risk assessment is calibrated for resource-limited settings.`;
  }

  if (type === 'drug_interaction') {
    return `${safety}
- Focus specifically on interactions common in first-line African ART (e.g., Tenofovir, Dolutegravir) and TB (Rifampicin) co-treatments.
- Include warnings for G6PD deficiency where relevant for regional populations.`;
  }

  return safety;
};

const extractRagQueryText = (type: AnalysisType, data: Record<string, unknown>, fallbackPrompt: string) => {
  if (type === 'diagnostic' && typeof data.symptoms === 'string') {
    return data.symptoms;
  }
  if (type === 'lab' && Array.isArray(data.results)) {
    return JSON.stringify(data.results).slice(0, 2000);
  }
  if (type === 'drug_interaction') {
    if (Array.isArray(data.medications)) return data.medications.join(', ');
    if (typeof data.medications === 'string') return data.medications;
  }
  if (type === 'icd10' && typeof data.clinical_text === 'string') {
    return data.clinical_text;
  }
  if (type === 'teleconsultation' && Array.isArray(data.chatHistory)) {
    return JSON.stringify(data.chatHistory).slice(0, 2000);
  }
  if (type === 'analytics' && data.volumeData && typeof data.volumeData === 'object') {
    return JSON.stringify(data.volumeData).slice(0, 2000);
  }
  if (type === 'radiology' && typeof data.findings === 'string') {
    return data.findings;
  }
  if (type === 'pathology' && typeof data.specimen === 'string') {
    return data.specimen;
  }
  return fallbackPrompt.slice(0, 2000);
};

/* ─── Provider functions moved to @/lib/ai-providers ────────────────────────
 * callHuggingFace, callGroq, callGemini, callOpenAI, callAnthropic,
 * callDeepSeek, callWithCascade, callParallelConsensus
 * ─────────────────────────────────────────────────────────────────────────── */

/* ─── Diagnostic consensus (offline-first local Gemma + cloud consensus) ─ */
async function runDiagnosticConsensus(
  symptoms: string,
  context?: string,
  retrievalSnippets?: DawaRagSnippet[],
): Promise<{ results: DiagnosticResult[]; providerResponses: NormalizedProviderResponse[] }> {
  const ragBlock = retrievalSnippets && retrievalSnippets.length > 0
    ? formatRagPromptBlock(retrievalSnippets)
    : '';
  const prompt = `You are an AI Clinical Diagnosis Assistant for AfyaHero, specialized in African clinical epidemiology and tropical medicine.
Analyze the following symptoms/observations and return the top 4 likely differentials in JSON.
PRIORITY: Always consider endemic tropical diseases (Malaria, TB, HIV, Meningitis, Cholera) if clinical profile matches.

Fields: "name" (string), "confidence" (0-100), "risk" (Low | Medium | High | Critical), "recommendation" (string).
Keep responses concise and evidence-oriented. Do not add prose outside JSON.

Context: ${context ?? 'General practice (East Africa)'}
Clinical input:
${symptoms}
${ragBlock ? `\n\n${ragBlock}` : ''}`;

  const providerResponses = await callParallelConsensus({
    prompt,
    systemInstruction: buildSystemPromptForType('diagnostic'),
    providers: getCascadeForType('diagnostic'),
    retrievalSnippets,
  });

  const successful = providerResponses
    .filter((r) => r.success && r.text)
    .map((r) => normalizeDiagnostics(extractJson(r.text!)))
    .filter((arr): arr is DiagnosticResult[] => Array.isArray(arr) && arr.length > 0);

  const results =
    successful.length === 0
      ? normalizeDiagnostics([
          {
            name: 'Clinical assessment required',
            confidence: 40,
            risk: 'Medium',
            recommendation: `No provider consensus available. Reassess symptoms (${symptoms.slice(0, 120)}) with vitals, focused exam, and local protocol.`,
          },
        ])
      : mergeConsensus(successful);

  return { results, providerResponses };
}

function buildFallbackByType(type: AnalysisType) {
  if (type === 'inventory') {
    return [
      { item: 'Inventory review', usage: 'stable', prediction: 'Trend unavailable', suggestion: 'Confirm top movers and reorder thresholds manually.' },
    ];
  }
  if (type === 'lab') {
    return [
      { parameter: 'AI interpretation', value: 'Unavailable', normal: 'N/A', status: 'Review Required', clinical: 'Use clinician interpretation and lab reference ranges.' },
    ];
  }
  if (type === 'analytics') {
    return {
      answer: 'I could not generate a direct AI answer right now. Please retry with more context or check service availability.',
      forecast: 'Operational forecast unavailable from AI provider at the moment.',
      recommendations: ['Review queue load and staffing manually for this shift.'],
    };
  }
  if (type === 'teleconsultation') {
    return {
      summary: 'Automatic scribe summary is currently unavailable. Please complete a manual SOAP-style summary.',
      nextSteps: ['Document key symptoms, assessment, and treatment plan manually.'],
    };
  }
  if (type === 'drug_interaction') {
    return [
      {
        drug1: 'Unknown',
        drug2: 'Unknown',
        severity: 'Moderate',
        mechanism: 'AI interaction engine unavailable.',
        clinical_effect: 'Interaction risk could not be computed automatically.',
        recommendation: 'Use pharmacist review and trusted interaction references before dispensing.',
      },
    ];
  }
  if (type === 'icd10') {
    return [
      { code: 'R69', description: 'Illness, unspecified', confidence: 35, notes: 'Fallback suggestion only. Confirm with a certified coder.' },
    ];
  }
  if (type === 'radiology') {
    return {
      impression: 'AI radiology interpretation unavailable.',
      findings: [],
      differentials: [],
      follow_up: 'Use radiologist report and clinician review for final interpretation.',
    };
  }
  if (type === 'pathology') {
    return {
      diagnosis: 'AI pathology interpretation unavailable.',
      microscopic: 'No structured microscopic summary generated.',
      markers: [],
      grade_stage: 'N/A',
      differentials: [],
      recommendation: 'Use pathology specialist review and standard reporting workflow.',
    };
  }

  return { message: 'AI fallback response generated.' };
}

/* ─── Model-routed JSON helper (cascades HF → Groq → Gemini → Claude) ───────── */
async function runModelJson(
  aiType: AnalysisType,
  prompt: string,
  errorLabel: AnalysisType,
  geminiModelOverride?: string,
  retrievalSnippets?: DawaRagSnippet[],
): Promise<{ parsed: unknown; providerResponse: NormalizedProviderResponse; usedFallback: boolean }> {
  const ragBlock = retrievalSnippets && retrievalSnippets.length > 0
    ? formatRagPromptBlock(retrievalSnippets)
    : '';
  const fullPrompt = ragBlock ? `${prompt}\n\n${ragBlock}` : prompt;
  const response = await callWithCascade({
    providers: getCascadeForType(aiType),
    prompt: fullPrompt,
    systemInstruction: buildSystemPromptForType(aiType),
    retrievalSnippets,
    geminiModel: geminiModelOverride,
  });

  if (response.success && response.text) {
    const parsed = extractJson(response.text);
    if (parsed !== null) return { parsed, providerResponse: response, usedFallback: false };
  }

  return { parsed: buildFallbackByType(errorLabel), providerResponse: response, usedFallback: true };
}

export async function POST(request: NextRequest) {
  try {
    const strictProductionMode = isStrictProductionMode();
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    const rateLimit = await enforceApiRateLimit(request, 'api:ai:analyze');
    if (rateLimit) return rateLimit;

    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin', 'super_admin']);
    if (session instanceof NextResponse) return session;

    const body = await readJsonBody<{ type?: unknown; data?: unknown; refreshCache?: unknown }>(request);
    if (body instanceof NextResponse) return body;

    const type = validateEnumValue(body.type, 'type', ANALYSIS_TYPES);
    if (type instanceof NextResponse) return type;
    const roleAccess = enforceRoleAnalysisAccess(session.role, type);
    if (roleAccess) return roleAccess;

    const data = body.data;
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'data object is required.' }, { status: 400 });
    }
    const refreshCache = body.refreshCache === true;

    if (type === 'diagnostic') {
      const diagnosticData = data as Record<string, unknown>;
      const symptoms = requireString(diagnosticData.symptoms, 'data.symptoms', { min: 5, max: 5000 });
      if (symptoms instanceof NextResponse) return symptoms;
      const context = validateOptionalString(diagnosticData.context, 'data.context', { max: 200 });
      if (context instanceof NextResponse) return context;
      const retrievalSnippets = await retrieveDawaKnowledge({
        query: symptoms,
        role: session.role,
        limit: 4,
      });
      const fallbackCitations = snippetsToCitations(retrievalSnippets);

      const diagnosticCacheKey = buildPromptCacheKey(
        'analyze',
        type,
        session.hospitalId,
        session.role,
        symptoms.trim().toLowerCase(),
        context ?? '',
        retrievalSnippets.map((snippet) => snippet.id),
      );

      if (!refreshCache) {
        const cached = await getPromptCache<AnalyzeResponsePayload>(diagnosticCacheKey);
        if (cached) {
          return NextResponse.json({ ...cached, cached: true });
        }
      }

      const { results, providerResponses } = await runDiagnosticConsensus(symptoms, context, retrievalSnippets);
      if (strictProductionMode && !providerResponses.some((response) => response.success && response.text)) {
        const detail = providerResponses
          .map((response) => response.error)
          .filter(Boolean)
          .join(' | ') || 'All providers failed to produce diagnostic output.';
        return buildDegradedResponse({ entity: 'aiAnalyzeDiagnostic', detail });
      }
      void logConsensusInteractions(
        providerResponses.map((r) => ({
          provider: r.provider,
          model: r.model,
          latencyMs: r.latencyMs,
          success: r.success,
          error: r.error,
        })),
        {
          userRole: session.role,
          userSubrole: session.subrole,
          userName: session.name,
          hospitalId: session.hospitalId,
          aiType: 'diagnostic',
          inputSummary: symptoms.slice(0, 200),
          outputSummary: JSON.stringify(results).slice(0, 200),
        },
      );
      const primary = providerResponses.find((r) => r.success) ?? providerResponses[0];
      const citations = [
        ...providerResponses.flatMap((response) => response.citations ?? []),
        ...fallbackCitations,
      ].filter((citation, index, all) => all.findIndex((x) => x.id === citation.id) === index);

      const payload: AnalyzeResponsePayload = {
        results,
        citations: citations.length ? citations : undefined,
        provider: primary?.provider,
        model: primary?.model,
        cached: false,
      };

      await setPromptCache(diagnosticCacheKey, payload, ANALYZE_CACHE_TTL_SECONDS);
      return NextResponse.json(payload);
    }

    let prompt = '';
    let model = MODELS.GENERAL;

    if (type === 'inventory') {
      if (!Array.isArray(data)) {
        return NextResponse.json({ error: 'data must be an array for inventory.' }, { status: 400 });
      }
      const inventorySummary = data
        .map((item: Record<string, unknown>) => `- ${item.name}: ${item.stock_quantity} ${item.unit} (Min: ${item.min_stock_level})`)
        .join('\n');

      prompt = `You are an AI Hospital Pharmacy Inventory Assistant for AfyaHero. 
Analyze the following inventory data and provide the top 3 critical restocking recommendations or trend insights.
Return ONLY a valid JSON array of objects with these properties:
"item" (string), "usage" (string e.g. "+15%"), "prediction" (string e.g. "Ran out in 8 days"), "suggestion" (string).

Inventory Data:
${inventorySummary}

Response Format:
[
  { "item": "...", "usage": "...", "prediction": "...", "suggestion": "..." },
  ...
]`;
    } else if (type === 'lab') {
      const labData = data as Record<string, unknown>;
      if (!Array.isArray(labData.results)) {
        return NextResponse.json({ error: 'data.results must be an array for lab.' }, { status: 400 });
      }
      prompt = `You are an AI Lab Result Interpreter for AfyaHero. 
Analyze the diagnostic report parameters and provide clinical correlations.
Return ONLY a valid JSON array of objects with these properties:
"parameter" (string), "value" (string), "normal" (string), "status" (string), "clinical" (string).

Lab Data:
${JSON.stringify(labData.results)}

Response Format:
[
  { "parameter": "...", "value": "...", "normal": "...", "status": "...", "clinical": "..." },
  ...
]`;
    } else if (type === 'analytics') {
      model = MODELS.DAWA;
      const analyticsData = data as Record<string, unknown>;
      if (!analyticsData.volumeData || typeof analyticsData.volumeData !== 'object') {
        return NextResponse.json({ error: 'data.volumeData must be an object for analytics.' }, { status: 400 });
      }
      const volumeData = analyticsData.volumeData as Record<string, unknown>;
      const query = validateOptionalString(volumeData.query, 'data.volumeData.query', { max: 2000 });
      if (query instanceof NextResponse) return query;
      prompt = `You are DAWA, the AfyaHero workflow chatbot for healthcare professionals.
The user may ask a direct operational question. Answer that question first, then provide a short-term forecast and role-relevant operational recommendations.
Return ONLY a valid JSON object with these properties:
"answer" (string - direct response to the user's question in plain language),
"forecast" (string), "recommendations" (array of strings).

Trend Data:
${JSON.stringify({ ...volumeData, query: query ?? 'General operational support request' })}

Response Format:
{
  "answer": "...",
  "forecast": "...",
  "recommendations": ["...", "..."]
}`;
    } else if (type === 'teleconsultation') {
      model = MODELS.SCRIBE;
      const teleconsultationData = data as Record<string, unknown>;
      if (!Array.isArray(teleconsultationData.chatHistory)) {
        return NextResponse.json({ error: 'data.chatHistory must be an array for teleconsultation.' }, { status: 400 });
      }
      prompt = `You are an AI Medical Scribe for AfyaHero. 
Analyze the following consultation chat history and provide a concise clinical summary and suggested next steps/medications.
Return ONLY a valid JSON object with these properties:
"summary" (string), "nextSteps" (array of strings).

Chat context:
${JSON.stringify(teleconsultationData.chatHistory)}

Response Format:
{
  "summary": "...",
  "nextSteps": ["...", "..."]
}`;
    } else if (type === 'drug_interaction') {
      const interactionData = data as Record<string, unknown>;
      if (!Array.isArray(interactionData.medications) && typeof interactionData.medications !== 'string') {
        return NextResponse.json({ error: 'data.medications must be an array or string.' }, { status: 400 });
      }
      prompt = `You are an AI Clinical Pharmacology Assistant for AfyaHero, expert in African pharmacological guidelines (NASCOP, KEML, WHO AFRO).
Analyze the following list of medications for potential drug-drug interactions, with special attention to ART/TB co-management and common regional comorbidities.

Return ONLY a valid JSON array of objects with these properties:
"drug1" (string), "drug2" (string), "severity" (string: "Contraindicated", "Major", "Moderate", "Minor"),
"mechanism" (string), "clinical_effect" (string), "recommendation" (string).
If no interactions are found, return an empty array [].

Medications:
${Array.isArray(interactionData.medications) ? interactionData.medications.join(', ') : interactionData.medications}

Response Format:
[
  { "drug1": "...", "drug2": "...", "severity": "Major", "mechanism": "...", "clinical_effect": "...", "recommendation": "..." },
  ...
]`;
    } else if (type === 'icd10') {
      const icdData = data as Record<string, unknown>;
      const clinicalText = requireString(icdData.clinical_text, 'data.clinical_text', { min: 5, max: 5000 });
      if (clinicalText instanceof NextResponse) return clinicalText;
      prompt = `You are an AI Medical Coding Assistant for AfyaHero.
Based on the following clinical notes or diagnosis description, suggest the top 3 most likely ICD-10-CM codes.
Return ONLY a valid JSON array of objects with these properties:
"code" (string, e.g. "J18.9"), "description" (string), "confidence" (number 0-100), "notes" (string).

Clinical Input:
${clinicalText}

Response Format:
[
  { "code": "...", "description": "...", "confidence": 90, "notes": "..." },
  ...
]`;
    } else if (type === 'radiology') {
      model = MODELS.RADIOLOGY;
      const radiologyData = data as Record<string, unknown>;
      const findings = requireString(radiologyData.findings, 'data.findings', { min: 5, max: 8000 });
      if (findings instanceof NextResponse) return findings;
      const modality = validateOptionalString(radiologyData.modality, 'data.modality', { max: 100 });
      if (modality instanceof NextResponse) return modality;
      const region = validateOptionalString(radiologyData.body_region, 'data.body_region', { max: 100 });
      if (region instanceof NextResponse) return region;
      prompt = `You are an AI Radiology Assistant for AfyaHero, specialized for African clinical epidemiology.
PRIMARY FOCUS: Cancer detection, tumour identification, and priority diseases common in African populations.

SPECIALIZED DETECTION PRIORITIES:
1. HIGH PRIORITY: All malignant lesions, tumours, metastases, suspicious densities and masses
2. AFRICAN EPIDEMIOLOGY: Prioritize detection for:
   - Breast cancer, cervical cancer, prostate cancer, hepatocellular carcinoma
   - Tuberculosis (pulmonary & extrapulmonary), Burkitt lymphoma, Kaposi sarcoma
   - HIV-associated malignancies, endemic Burkitt's, nasopharyngeal carcinoma
3. Standard radiological patterns specific to tropical infectious diseases common in Africa

Analyze the following radiological findings and provide a structured report.
Prioritize early cancer/tumor findings above all other observations.
Return ONLY a valid JSON object with these properties:
"impression" (string — concise overall impression, highlight any suspicious malignancy findings first),
"findings" (array of objects with "area" string, "observation" string, "significance" string: "Normal" | "Incidental" | "Clinically Significant" | "Urgent"),
"differentials" (array of objects with "name" string, "confidence" number 0-100, "recommendation" string),
"follow_up" (string — recommended follow-up actions, include clear actionable next steps appropriate for African healthcare settings).

Always flag any suspicious finding that requires urgent review.
For any mass or lesion, explicitly note characteristics relevant for oncology referral.

Imaging Modality: ${modality ?? 'Not specified'}
Body Region: ${region ?? 'Not specified'}
Reported Findings:
${findings}

Response Format:
{
  "impression": "...",
  "findings": [{ "area": "...", "observation": "...", "significance": "..." }],
  "differentials": [{ "name": "...", "confidence": 80, "recommendation": "..." }],
  "follow_up": "..."
}`;
    } else if (type === 'pathology') {
      model = MODELS.PATHOLOGY;
      const pathologyData = data as Record<string, unknown>;
      const specimen = requireString(pathologyData.specimen, 'data.specimen', { min: 5, max: 8000 });
      if (specimen instanceof NextResponse) return specimen;
      const stain = validateOptionalString(pathologyData.stain_type, 'data.stain_type', { max: 100 });
      if (stain instanceof NextResponse) return stain;
      const clinicalHx = validateOptionalString(pathologyData.clinical_history, 'data.clinical_history', { max: 2000 });
      if (clinicalHx instanceof NextResponse) return clinicalHx;
      prompt = `You are an AI Pathology Assistant for AfyaHero, specializing in histopathology and cytopathology analysis.
Analyze the following specimen description and provide a structured pathology report.
Return ONLY a valid JSON object with these properties:
"diagnosis" (string — primary pathological diagnosis),
"microscopic" (string — microscopic findings summary),
"markers" (array of objects with "marker" string, "result" string, "interpretation" string),
"grade_stage" (string — tumour grade/stage if applicable, or "N/A"),
"differentials" (array of objects with "name" string, "confidence" number 0-100),
"recommendation" (string — recommended next steps, additional stains or molecular tests).

Stain Type: ${stain ?? 'H&E (standard)'}
Clinical History: ${clinicalHx ?? 'Not provided'}
Specimen Description:
${specimen}

Response Format:
{
  "diagnosis": "...",
  "microscopic": "...",
  "markers": [{ "marker": "Ki-67", "result": "High", "interpretation": "..." }],
  "grade_stage": "...",
  "differentials": [{ "name": "...", "confidence": 85 }],
  "recommendation": "..."
}`;
    } else {
      return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    const ragQuery = extractRagQueryText(type, data as Record<string, unknown>, prompt);
    const retrievalSnippets = await retrieveDawaKnowledge({
      query: ragQuery,
      role: session.role,
      limit: 4,
    });
    const fallbackCitations = snippetsToCitations(retrievalSnippets);

    const cacheKey = buildPromptCacheKey(
      'analyze',
      type,
      session.hospitalId,
      session.role,
      ragQuery.trim().toLowerCase(),
      retrievalSnippets.map((snippet) => snippet.id),
    );

    if (!refreshCache) {
      const cached = await getPromptCache<AnalyzeResponsePayload>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    const { parsed, providerResponse, usedFallback } = await runModelJson(type, prompt, type, model, retrievalSnippets);
    if (strictProductionMode && usedFallback) {
      return buildDegradedResponse({
        entity: `aiAnalyze:${type}`,
        detail: providerResponse.error ?? 'Provider cascade failed or returned an unparsable response.',
      });
    }
    const results = normalizeResultByType(type, parsed);
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: type,
      providerUsed: providerResponse.provider,
      modelUsed: providerResponse.model,
      latencyMs: providerResponse.latencyMs,
      success: providerResponse.success,
      errorMessage: providerResponse.error,
      inputSummary: prompt.slice(0, 200),
      outputSummary: JSON.stringify(results).slice(0, 200),
    });

    const payload: AnalyzeResponsePayload = {
      results,
      citations: providerResponse.citations?.length
        ? providerResponse.citations
        : (fallbackCitations.length ? fallbackCitations : undefined),
      provider: providerResponse.provider,
      model: providerResponse.model,
      cached: false,
    };

    await setPromptCache(cacheKey, payload, ANALYZE_CACHE_TTL_SECONDS);

    return NextResponse.json(payload);
  } catch (error) {
    logger.error('AI Analyze Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
