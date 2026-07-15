/**
 * POST /api/ai/dawa
 *
 * DAWA (AI persona assistant) endpoint — role-aware, context-enriched AI queries.
 *
 * Request body:
 *   {
 *     query:      string   — free-text query (5–2000 chars)
 *     patientId?: string   — optional patient context (UUID)
 *     personaId?: string   — optional persona override (e.g. 'DAWA-Clinical')
 *   }
 *
 * Response:
 *   {
 *     answer:       string             — AI-generated response text
 *     persona:      DAWAPersonaId      — resolved persona ID
 *     provider:     ProviderName       — which AI provider answered
 *     model:        string             — model identifier
 *     latencyMs:    number             — end-to-end latency
 *     sessionId?:   string             — DAWA session ID (for history)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
  requireString,
  validateOptionalString,
} from '@/lib/api-security';
import { callWithCascade, getCascadeForType, type AICitation, type ProviderName } from '@/lib/ai-providers';
import { logAIInteraction } from '@/lib/ai-audit';
import { buildDawaContext } from '@/lib/dawa-context';
import { DAWA_PERSONAS, type DAWAPersonaId } from '@/lib/dawa-personas';
import logger from '@/lib/logger';
import {
  formatRagPromptBlock,
  retrieveDawaKnowledge,
  snippetsToCitations,
} from '@/lib/dawa-rag';
import {
  buildPromptCacheKey,
  getPromptCache,
  setPromptCache,
  buildIdempotentCacheKey,
} from '@/lib/prompt-cache';
import { encryptAtRest } from '@/lib/security-at-rest';
import { applyEpidemiologyGuardrails, isRestrictedClinicalQuery } from '@/lib/epidemiology-rules';

const VALID_PERSONA_IDS = Object.keys(DAWA_PERSONAS) as DAWAPersonaId[];
const DEFAULT_PROMPT_CACHE_TTL_SECONDS = 300;

type DawaResponsePayload = {
  answer: string;
  persona: DAWAPersonaId;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  sessionId?: string;
  citations?: AICitation[];
  cached?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // ── Rate limit ──────────────────────────────────────────────────────────
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:dawa');
    if (rateLimit) return rateLimit;

    // ── Auth + session ──────────────────────────────────────────────────────
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // ── Parse + validate body ───────────────────────────────────────────────
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    let body: {
      query?: unknown;
      patientId?: unknown;
      personaId?: unknown;
      refreshCache?: unknown;
      attachedFiles?: Array<{ name: string; type: string; size: number }>;
      context?: Array<{ role: string; content: string }>;
      imageAnalysis?: string;
    };

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const queryRaw = formData.get('query');
      const patientIdRaw = formData.get('patientId');
      const personaIdRaw = formData.get('personaId');
      const contextRaw = formData.get('context');
      const files = formData.getAll('files') as File[];

      let context: Array<{ role: string; content: string }> | undefined;
      if (contextRaw && typeof contextRaw === 'string') {
        try {
          context = JSON.parse(contextRaw);
        } catch {
          context = undefined;
        }
      }

      // Analyze images using AI vision
      let imageAnalysisText = '';
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        try {
          const { analyzeImagesWithAI } = await import('@/lib/image-analysis');
          const analysis = await analyzeImagesWithAI(imageFiles, queryRaw?.toString() || '');
          if (analysis) {
            imageAnalysisText = `\n\nIMAGE ANALYSIS:\n${analysis}`;
          }
        } catch (err) {
          logger.warn('[DAWA route] Image analysis failed', { error: err instanceof Error ? err.message : String(err) });
        }
      }

      body = {
        query: queryRaw ?? '',
        patientId: patientIdRaw ?? undefined,
        personaId: personaIdRaw ?? undefined,
        refreshCache: false,
        attachedFiles: files.length > 0
          ? files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
          : undefined,
        context,
        imageAnalysis: imageAnalysisText || undefined,
      };
    } else {
      const jsonBody = await readJsonBody<{
        query?: unknown;
        patientId?: unknown;
        personaId?: unknown;
        refreshCache?: unknown;
        context?: Array<{ role: string; content: string }>;
      }>(request);
      if (jsonBody instanceof NextResponse) return jsonBody;
      body = jsonBody;
    }

    // ── Idempotency key for caching ─────────────────────────────────────────
    const idempotencyKey = request.headers.get('x-idempotency-key');

    let query = requireString(body.query, 'query', { min: 5, max: 2000 });
    if (query instanceof NextResponse) return query;

    if (body.attachedFiles && body.attachedFiles.length > 0) {
      const fileSummary = body.attachedFiles
        .map((f) => `${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)} KB)`)
        .join(', ');
      query = `${query}\n\n[Attached files: ${fileSummary}]`;
    }

    const patientId = validateOptionalString(body.patientId, 'patientId', { max: 36 });
    if (patientId instanceof NextResponse) return patientId;
    const refreshCache = body.refreshCache === true;

    // Optional persona override — must be a valid DAWA persona ID
    let requestedPersonaId: DAWAPersonaId | undefined;
    if (body.personaId !== undefined && body.personaId !== null) {
      const personaStr = String(body.personaId);
      if (!VALID_PERSONA_IDS.includes(personaStr as DAWAPersonaId)) {
        return NextResponse.json(
          { error: `Invalid personaId. Valid values: ${VALID_PERSONA_IDS.join(', ')}` },
          { status: 400 },
        );
      }
      requestedPersonaId = personaStr as DAWAPersonaId;

      // Verify the user's role has access to the requested persona
      const requestedPersona = DAWA_PERSONAS[requestedPersonaId];
      if (!requestedPersona.roles.includes(session.role)) {
        return NextResponse.json(
          { error: 'Your role does not have access to the requested DAWA persona.' },
          { status: 403 },
        );
      }
    }

    // ── Build context + resolve persona ───────────────────────────────────
    const start = Date.now();
    const { persona, userPrompt } = await buildDawaContext({
      role: session.role,
      subrole: session.subrole,
      hospitalId: session.hospitalId,
      patientId: patientId ?? undefined,
      query,
    });

    // Allow overriding the auto-resolved persona (if role allows)
    const effectivePersona = requestedPersonaId
      ? DAWA_PERSONAS[requestedPersonaId]
      : persona;

    // Apply Epidemiology Rule-Based Guardrails
    const patientContext = patientId ? {
      id: patientId,
      // In production this would load actual patient vitals, symptoms, demographics
      // from FHIR store or patient record
    } : {};

    const guardrailResult = applyEpidemiologyGuardrails(query, patientContext);
    
    if (guardrailResult.shouldBlock) {
      const protocolAnswer = [
        `⚠️ ${guardrailResult.blockReason}`,
        '',
        'Standard clinical protocol activated. Follow these required steps:',
        '',
        ...guardrailResult.workflowOverride!.map(step => 
          `${step.order}. ${step.mandatory ? '✅ REQUIRED: ' : ''}${step.action}` + 
          (step.deadlineMinutes ? ` ⏱️ (within ${step.deadlineMinutes} minutes)` : '')
        ),
        '',
        'DAWA cannot provide further clinical guidance for this case.',
        'Please refer to the official clinical protocols and consult senior clinical staff.',
      ].join('\n');

      const sessionId = await saveDawaSession({
        hospitalId: session.hospitalId,
        userId: session.id,
        personaId: effectivePersona.id,
        query,
        answer: protocolAnswer,
      });

      return NextResponse.json({
        answer: protocolAnswer,
        persona: effectivePersona.id,
        provider: 'protocol-engine',
        model: 'epidemiology-rule-v1',
        latencyMs: Date.now() - start,
        sessionId,
        cached: false,
      } satisfies DawaResponsePayload);
    }

    // Check for restricted clinical query types
    const restrictedCheck = isRestrictedClinicalQuery(query);
    if (restrictedCheck.restricted) {
      const clinicalGuardrailAnswer = [
        'DAWA provides workflow guidance only and cannot give clinical diagnosis or treatment advice.',
        'Use the AI Clinical Diagnosis Assistant for clinical decision support.',
        'Workflow next steps: 1) open the diagnosis assistant module, 2) enter structured symptoms/findings, 3) complete clinician review and documentation.',
      ].join(' ');

      const sessionId = await saveDawaSession({
        hospitalId: session.hospitalId,
        userId: session.id,
        personaId: effectivePersona.id,
        query,
        answer: clinicalGuardrailAnswer,
      });

      return NextResponse.json({
        answer: clinicalGuardrailAnswer,
        persona: effectivePersona.id,
        provider: 'hf',
        model: 'workflow-guardrail',
        latencyMs: Date.now() - start,
        sessionId,
        cached: false,
      } satisfies DawaResponsePayload);
    }

    // ── RAG retrieval (reference snippets for grounding + citations) ──────
    const ragSnippets = await retrieveDawaKnowledge({
      query,
      role: session.role,
      limit: 4,
    });
    const ragBlock = formatRagPromptBlock(ragSnippets);

    // ── Build conversation context block ─────────────────────────────────
    let contextBlock = '';
    if (body.context && body.context.length > 0) {
      contextBlock = '\n\nCONVERSATION HISTORY:\n' + body.context.map((turn, i) => {
        const roleLabel = turn.role === 'user' ? 'USER' : 'ASSISTANT';
        return `${i + 1}. ${roleLabel}: ${turn.content}`;
      }).join('\n') + '\n\nCurrent query: ' + query;
    }

    // ── Add image analysis if available ────────────────────────────────────
    const imageAnalysisBlock = body.imageAnalysis || '';

    const promptWithRag = ragBlock
      ? `${userPrompt}${contextBlock}${imageAnalysisBlock}\n\n${ragBlock}\n\nINSTRUCTION: Prefer grounded answers using [Source n] citations where evidence exists.`
      : `${userPrompt}${contextBlock}${imageAnalysisBlock}`;
    const fallbackCitations = snippetsToCitations(ragSnippets);

    // ── Prompt cache lookup with idempotency key ────────────────────────────
    const cacheTtlSeconds = Number(process.env.DAWA_PROMPT_CACHE_TTL_SECONDS ?? DEFAULT_PROMPT_CACHE_TTL_SECONDS);
    
    const baseCacheKey = buildPromptCacheKey(
      'dawa',
      session.hospitalId,
      session.role,
      effectivePersona.id,
      patientId ?? '',
      query.trim().toLowerCase(),
      ragSnippets.map((s) => s.id),
      body.context ? JSON.stringify(body.context) : ''
    );
    
    const cacheKey = idempotencyKey 
      ? buildIdempotentCacheKey(baseCacheKey, idempotencyKey)
      : baseCacheKey;

    if (!refreshCache) {
      const cached = await getPromptCache<DawaResponsePayload>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true }, {
          headers: {
            'X-Idempotency-Key': idempotencyKey ?? '',
            'Cache-Control': `public, max-age=${cacheTtlSeconds}`
          }
        });
      }
    }

    const composedSystemPrompt = composeDawaSystemPrompt(effectivePersona.systemInstruction);

    // ── Call AI with persona's cascade ────────────────────────────────────
    const response = await callWithCascade({
      providers: effectivePersona.cascadeKey
        ? getCascadeForKey(effectivePersona.cascadeKey)
        : ['hf', 'groq', 'gemini', 'anthropic'],
      prompt: promptWithRag,
      systemInstruction: composedSystemPrompt,
      retrievalSnippets: ragSnippets,
      aiType: effectivePersona.defaultAnalysisType,
      maxTokens: 1500,
      temperature: 0.15,
    });

    const totalLatency = Date.now() - start;

    // ── Persist DAWA session entry ────────────────────────────────────────
    const sessionId = await saveDawaSession({
      hospitalId: session.hospitalId,
      userId: session.id,
      personaId: effectivePersona.id,
      query,
      answer: response.text ?? '',
    });

    // ── Audit log (fire-and-forget) ───────────────────────────────────────
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: effectivePersona.defaultAnalysisType,
      providerUsed: response.provider,
      modelUsed: response.model,
      latencyMs: totalLatency,
      success: response.success,
      errorMessage: response.error,
      inputSummary: query.slice(0, 200),
      outputSummary: (response.text ?? '').slice(0, 200),
      dawaPersona: effectivePersona.id as any,
    });

    if (!response.success || !response.text) {
      const outagePayload: DawaResponsePayload = {
        answer: 'DAWA is currently unavailable. Please consult your facility protocol or a senior colleague.',
        persona: effectivePersona.id,
        provider: response.provider,
        model: response.model,
        latencyMs: totalLatency,
        sessionId,
        citations: fallbackCitations.length ? fallbackCitations : undefined,
      };

      return NextResponse.json(
        outagePayload,
        { status: 503 },
      );
    }

    const payload: DawaResponsePayload = {
      answer: response.text,
      persona: effectivePersona.id,
      provider: response.provider,
      model: response.model,
      latencyMs: totalLatency,
      sessionId,
      citations: response.citations?.length ? response.citations : (fallbackCitations.length ? fallbackCitations : undefined),
      cached: false,
    };

    await setPromptCache(cacheKey, payload, cacheTtlSeconds);

    return NextResponse.json(payload);
  } catch (err) {
    logger.error('[DAWA route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps a cascade key to the provider list (reuses the same logic as getCascadeForType). */
function getCascadeForKey(key: string): ProviderName[] {
  return getCascadeForType(key);
}

function composeDawaSystemPrompt(personaInstruction: string): string {
  return `${personaInstruction}

GROUNDING + CITATION RULES:
- You are provided a "RETRIEVED REFERENCE SOURCES" block when relevant.
- Ground claims in those sources when possible and cite inline as [Source n].
- If evidence is insufficient, say so explicitly and avoid fabricating references.
- Keep output concise and workflow-actionable.

DAWA SCOPE LIMIT:
- DAWA must NOT provide clinical diagnosis or treatment advice.
- For symptom interpretation, diagnosis, prescribing, or dosing requests:
  1) clearly refuse clinical advice,
  2) redirect user to the dedicated clinical diagnosis assistant workflow,
  3) provide only process steps (what team should do next in workflow terms).`;
}

// isClinicalAdviceRequest reserved for future clinical routing
function _isClinicalAdviceRequest(query: string): boolean {
  const signal = query.toLowerCase();
  const clinicalPatterns = [
    /\bdiagnos(?:e|is|tic)?\b/i,
    /\bdifferential\b/i,
    /\bprescrib(?:e|ing|ed)?\b/i,
    /\bdos(?:e|age)\b/i,
    /\bwhat should i give\b/i,
    /\bwhich (?:drug|medicine|medication|antibiotic)\b/i,
    /\bhow should i treat\b/i,
    /\bbest treatment\b/i,
    /\bpatient\b.*\b(?:symptom|fever|cough|pain|infection|rash|vomit|diarrhoea|diarrhea|dyspnea|shortness of breath)\b/i,
  ];

  return clinicalPatterns.some((pattern) => pattern.test(signal));
}

/** Persists a DAWA session turn to the dawa_sessions table (best-effort). */
async function saveDawaSession(params: {
  hospitalId: string;
  userId: string;
  personaId: DAWAPersonaId;
  query: string;
  answer: string;
}): Promise<string | undefined> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return undefined;

    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const { data } = await sb
      .from('dawa_sessions')
      .insert({
        hospital_id: params.hospitalId,
        user_id: params.userId,
        persona_id: params.personaId,
        query_text: encryptAtRest(params.query.slice(0, 2000)),
        response_text: encryptAtRest(params.answer.slice(0, 5000)),
        expires_at: new Date(
          Date.now() + Number(process.env.DAWA_SESSION_TTL_HOURS ?? 8) * 3600_000,
        ).toISOString(),
      })
      .select('id')
      .single();

    return data?.id;
  } catch {
    return undefined;
  }
}
