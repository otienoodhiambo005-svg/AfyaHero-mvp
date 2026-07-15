/**
 * AfyaHero AI Provider Abstraction Layer
 *
 * Unified interface for all AI providers used by AfyaHero:
 *   - OpenRouter                            (aggregator, primary)
 *   - Groq API                              (open-source, secondary / fast fallback)
 *   - HuggingFace Serverless Inference API  (open-source, tertiary fallback)
 *   - Google Gemini                         (paid, primary for vision types)
 *   - OpenAI GPT-4o-mini                    (paid, diagnostic consensus)
 *   - Anthropic Claude                      (paid, clinical/radiology/pathology)
 *   - DeepSeek                              (paid, diagnostic consensus)
 *
 * Cascade order per AI type:
 *   diagnostic       → OpenRouter → Groq → Gemini → OpenAI → Claude
 *   analytics (DAWA) → OpenRouter → Groq → Gemini → Claude
 *   drug_interaction → OpenRouter → Groq → Gemini → Claude
 *   icd10            → OpenRouter → Groq → Gemini
 *   lab              → OpenRouter → Groq → Gemini → Claude
 *   inventory        → OpenRouter → Groq → Gemini
 *   teleconsultation → OpenRouter → Groq → Gemini → Claude
 *   radiology        → Gemini (vision primary) → OpenRouter (text) → Claude
 *   pathology        → Gemini (vision primary) → OpenRouter (text) → Claude
 *
 * All callers receive a NormalizedProviderResponse so the analyze route is
 * provider-agnostic. Provider name and model are included so the audit layer
 * and the UI badge can display them.
 */

const PROVIDER_TIMEOUT_MS = 12_000;
const PRIMARY_TIMEOUT_MS = 8_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderName = 'hf' | 'groq' | 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'protocol-engine' | 'dawa-engine' | 'rule-based' | 'vertex' | 'openrouter' | 'microservice' | 'consensus';

export interface AICitation {
  id: string;
  title: string;
  source: string;
  url?: string;
  excerpt?: string;
  confidence?: number;
}

export interface AnthropicRetrievalSnippet extends AICitation {
  content: string;
}

export interface NormalizedProviderResponse {
  text: string | null;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  citations?: AICitation[];
}

export interface CascadeOptions {
  /** Providers to attempt in order. First success wins. */
  providers: ProviderName[];
  prompt: string;
  systemInstruction?: string;
  /** Optional retrieval snippets for citation-aware prompts (currently Anthropic-optimized). */
  retrievalSnippets?: AnthropicRetrievalSnippet[];
  /** Optional: forces a specific model override for the Gemini call. */
  geminiModel?: string;
  /** AI type for model selection (e.g., 'analytics', 'drug_interaction') */
  aiType?: string;
  /** Max tokens for the completion (where supported). Default: 1200 */
  maxTokens?: number;
  temperature?: number;
}

// ─── Model defaults ───────────────────────────────────────────────────────────

const DEFAULTS = {
  HF_HEAVY: process.env.HF_MODEL_HEAVY ?? 'meta-llama/Llama-3.3-70B-Instruct',
  HF_LIGHT: process.env.HF_MODEL_LIGHT ?? 'meta-llama/Llama-3.1-8B-Instruct',
  GROQ_HEAVY: process.env.GROQ_MODEL_HEAVY ?? 'llama-3.3-70b-versatile',
  GROQ_LIGHT: process.env.GROQ_MODEL_LIGHT ?? 'llama-3.1-8b-instant',
  GEMINI_PRO: 'gemini-2.5-pro',
  GEMINI_FLASH: process.env.NEXT_PUBLIC_AI_MODEL_GENERAL ?? 'gemini-2.5-flash-preview-04-17',
  GEMINI_MEDGEMMA_V4: process.env.GEMINI_MEDGEMMA_MODEL ?? 'med-gemma-2',
  ANTHROPIC: process.env.NEXT_PUBLIC_AI_MODEL_ANTHROPIC ?? 'claude-3-7-sonnet-20250219',
  OPENAI: 'gpt-4o-mini',
  DEEPSEEK: 'deepseek-reasoner',
  OPENROUTER: process.env.NEXT_PUBLIC_AI_MODEL_OPENROUTER ?? 'meta-llama/llama-3.3-70b-instruct',
  OPENROUTER_REASONING: 'deepseek/deepseek-r1',
  OPENROUTER_FAST: 'meta-llama/llama-3.1-8b-instruct',
} as const;

function resolveProviderOrder(providers: ProviderName[]): ProviderName[] {
  const defaultProviders: ProviderName[] = ['openrouter', 'groq', 'hf', 'gemini', 'openai', 'anthropic'];
  const baseProviders = providers.length > 0 ? providers : defaultProviders;

  return Array.from(new Set(baseProviders));
}

// ─── Helper: fetch with timeout ───────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type AnthropicTextBlock = {
  type?: string;
  text?: string;
  citations?: Array<{
    cited_text?: string;
    text?: string;
    title?: string;
    source?: { title?: string; url?: string };
    document_title?: string;
    url?: string;
    confidence?: number;
  }>;
};

function parseAnthropicCitations(contentBlocks: AnthropicTextBlock[]): AICitation[] {
  const citations: AICitation[] = [];

  contentBlocks.forEach((block, blockIndex) => {
    if (!Array.isArray(block.citations)) {
      return;
    }

    block.citations.forEach((citation, citationIndex) => {
      const title =
        citation.title ??
        citation.document_title ??
        citation.source?.title ??
        `Reference ${blockIndex + 1}.${citationIndex + 1}`;

      citations.push({
        id: `anthropic-${blockIndex}-${citationIndex}`,
        title,
        source: citation.source?.title ?? 'Anthropic citation',
        url: citation.url ?? citation.source?.url,
        excerpt: citation.cited_text ?? citation.text,
        confidence: citation.confidence,
      });
    });
  });

  return citations;
}

// ─── HuggingFace Serverless Inference API ─────────────────────────────────────

/**
 * HuggingFace Serverless Inference (text generation only).
 * Uses the Inference API endpoint: https://api-inference.huggingface.co/models/{model}
 * Falls back to the router endpoint: https://router.huggingface.co/hf-inference/v1
 */
export async function callHuggingFace(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.HF_API_KEY;
  const provider: ProviderName = 'hf';
  const model = modelOverride ?? DEFAULTS.HF_HEAVY;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'HF_API_KEY not set' };
  }

  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    { role: 'user', content: prompt },
  ];

  // Try primary router first (faster, lower rate-limit usage)
  const endpoints = [
    'https://router.huggingface.co/hf-inference/v1/chat/completions',
    'https://api-inference.huggingface.co/v1/chat/completions',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? null;
      if (!text) continue;

      return { text, provider, model, latencyMs: Date.now() - start, success: true };
    } catch {
      // Try next endpoint
      continue;
    }
  }

  return {
    text: null,
    provider,
    model,
    latencyMs: Date.now() - start,
    success: false,
    error: 'HF inference failed or timed out',
  };
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

export async function callGroq(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  const provider: ProviderName = 'groq';
  const model = modelOverride ?? DEFAULTS.GROQ_HEAVY;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'GROQ_API_KEY not set' };
  }

  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    { role: 'user', content: prompt },
  ];

  try {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      return {
        text: null, provider, model,
        latencyMs: Date.now() - start,
        success: false,
        error: `Groq HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? null;

    return {
      text,
      provider,
      model,
      latencyMs: Date.now() - start,
      success: text !== null,
      error: text === null ? 'Empty response from Groq' : undefined,
    };
  } catch (err) {
    return {
      text: null, provider, model,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : 'Groq call failed',
    };
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

export async function callGemini(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  _maxTokens = 1200,
  temperature = 0.2,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  const provider: ProviderName = 'gemini';
  const model = modelOverride ?? DEFAULTS.GEMINI_FLASH;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'GEMINI_API_KEY not set' };
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  // Attempt requested model, then flash, then pro as fallbacks
  const modelsToTry = Array.from(
    new Set([model, DEFAULTS.GEMINI_FLASH, DEFAULTS.GEMINI_PRO]),
  );

  for (const m of modelsToTry) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) continue;

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      if (!text) continue;

      return { text, provider, model: m, latencyMs: Date.now() - start, success: true };
    } catch {
      continue;
    }
  }

  return {
    text: null, provider, model,
    latencyMs: Date.now() - start,
    success: false,
    error: 'All Gemini model variants failed',
  };
}

// ─── Vertex AI Studio (Google Cloud) ──────────────────────────────────────────

/**
 * Call Vertex AI Studio as fallback when primary AI routes fail.
 * Also used for translation API purposes.
 * Uses the Gemini API via Vertex AI Studio endpoint.
 */
export async function callVertex(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.VERTEX_AI_STUDIO_API_KEY;
  const provider: ProviderName = 'vertex';
  const model = modelOverride ?? 'gemini-2.0-flash';
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'VERTEX_AI_STUDIO_API_KEY not set' };
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (systemInstruction) {
    contents.push({ role: 'user', parts: [{ text: systemInstruction }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  // Try Vertex AI Studio endpoint, then fall back to Gemini direct
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      if (!text) continue;

      return { text, provider, model, latencyMs: Date.now() - start, success: true };
    } catch {
      continue;
    }
  }

  return {
    text: null, provider, model,
    latencyMs: Date.now() - start,
    success: false,
    error: 'Vertex AI Studio request failed',
  };
}

/**
 * Translate text using Vertex AI Studio.
 * Uses Gemini's multilingual capabilities for translation.
 */
export async function translateWithVertex(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string | null> {
  const apiKey = process.env.VERTEX_AI_STUDIO_API_KEY;
  if (!apiKey) return null;

  const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translation, nothing else:\n\n${text}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
  };

  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) return null;

    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

export async function callOpenAI(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const provider: ProviderName = 'openai';
  const model = modelOverride ?? DEFAULTS.OPENAI;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'OPENAI_API_KEY not set' };
  }

  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    { role: 'user', content: prompt },
  ];

  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });

    if (!res.ok) {
      return { text: null, provider, model, latencyMs: Date.now() - start, success: false, error: `OpenAI HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? null;
    return { text, provider, model, latencyMs: Date.now() - start, success: text !== null };
  } catch (err) {
    return {
      text: null, provider, model,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : 'OpenAI call failed',
    };
  }
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────

export async function callAnthropic(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
  retrievalSnippets?: AnthropicRetrievalSnippet[],
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const provider: ProviderName = 'anthropic';
  const model = modelOverride ?? DEFAULTS.ANTHROPIC;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'ANTHROPIC_API_KEY not set' };
  }

  const citationEnabledMessageContent =
    retrievalSnippets && retrievalSnippets.length > 0
      ? [
          ...retrievalSnippets.map((snippet) => ({
            type: 'document',
            title: snippet.title,
            context: snippet.source,
            citations: { enabled: true },
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: snippet.content,
            },
          })),
          { type: 'text', text: prompt },
        ]
      : null;

  const payloads: Array<Record<string, unknown>> = [
    ...(citationEnabledMessageContent
      ? [
          {
            model,
            max_tokens: maxTokens,
            temperature,
            ...(systemInstruction ? { system: systemInstruction } : {}),
            messages: [{ role: 'user', content: citationEnabledMessageContent }],
          },
        ]
      : []),
    {
      model,
      max_tokens: maxTokens,
      temperature,
      ...(systemInstruction ? { system: systemInstruction } : {}),
      messages: [{ role: 'user', content: prompt }],
    },
  ];

  try {
    for (const payload of payloads) {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const contentBlocks = (data?.content ?? []) as AnthropicTextBlock[];
      const text = contentBlocks
        .filter((p) => p?.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('\n')
        .trim() || null;

      const citations = parseAnthropicCitations(contentBlocks);

      return {
        text,
        provider,
        model,
        latencyMs: Date.now() - start,
        success: text !== null,
        citations: citations.length ? citations : undefined,
      };
    }

    return {
      text: null,
      provider,
      model,
      latencyMs: Date.now() - start,
      success: false,
      error: 'Anthropic HTTP failure',
    };
  } catch (err) {
    return {
      text: null, provider, model,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : 'Anthropic call failed',
    };
  }
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

export async function callDeepSeek(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const provider: ProviderName = 'deepseek';
  const model = modelOverride ?? DEFAULTS.DEEPSEEK;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'DEEPSEEK_API_KEY not set' };
  }

  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    { role: 'user', content: prompt },
  ];

  try {
    const res = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });

    if (!res.ok) {
      return { text: null, provider, model, latencyMs: Date.now() - start, success: false, error: `DeepSeek HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? null;
    return { text, provider, model, latencyMs: Date.now() - start, success: text !== null };
  } catch (err) {
    return {
      text: null, provider, model,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : 'DeepSeek call failed',
    };
  }
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

export async function callOpenRouter(
  prompt: string,
  systemInstruction?: string,
  modelOverride?: string,
  maxTokens = 1200,
  temperature = 0.2,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<NormalizedProviderResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const provider: ProviderName = 'openrouter';
  const model = modelOverride ?? DEFAULTS.OPENROUTER;
  const start = Date.now();

  if (!apiKey) {
    return { text: null, provider, model, latencyMs: 0, success: false, error: 'OPENROUTER_API_KEY not set' };
  }

  const messages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    { role: 'user', content: prompt },
  ];

  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://afyahero.co.ke',
        'X-Title': 'AfyaHero',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    }, timeoutMs);

    if (!res.ok) {
      return { text: null, provider, model, latencyMs: Date.now() - start, success: false, error: `OpenRouter HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? null;
    return { text, provider, model, latencyMs: Date.now() - start, success: text !== null };
  } catch (err) {
    return {
      text: null, provider, model,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : 'OpenRouter call failed',
    };
  }
}

// ─── Cascade Runner ───────────────────────────────────────────────────────────

/**
 * Attempts providers in order. Returns the first successful response.
 * Never throws — always returns a NormalizedProviderResponse.
 *
 * @example
 * const response = await callWithCascade({
 *   providers: ['hf', 'groq', 'gemini', 'anthropic'],
 *   prompt: diagnosticPrompt,
 *   systemInstruction: 'Respond only with JSON.',
 * });
 */
export async function callWithCascade(
  options: CascadeOptions,
): Promise<NormalizedProviderResponse> {
  const {
    providers,
    prompt,
    systemInstruction,
    retrievalSnippets,
    geminiModel,
    aiType,
    maxTokens = 1200,
    temperature = 0.2,
  } = options;

  const orderedProviders = resolveProviderOrder(providers);

  for (const provider of orderedProviders) {
    let result: NormalizedProviderResponse;

    switch (provider) {
      case 'openrouter': {
        const isReasoning = prompt.toLowerCase().includes('reason') || prompt.toLowerCase().includes('complex');
        const orModel = isReasoning ? DEFAULTS.OPENROUTER_REASONING : DEFAULTS.OPENROUTER;
        result = await callOpenRouter(prompt, systemInstruction, orModel, maxTokens, temperature, PRIMARY_TIMEOUT_MS);
        break;
      }
      case 'hf':
        result = await callHuggingFace(prompt, systemInstruction, undefined, maxTokens, temperature);
        break;
      case 'groq':
        result = await callGroq(prompt, systemInstruction, undefined, maxTokens, temperature);
        break;
      case 'gemini': {
        // Use MedGemma v4 for medical AI types
        const medicalTypes = ['analytics', 'drug_interaction', 'lab', 'teleconsultation'];
        const geminiModelToUse = (aiType && medicalTypes.includes(aiType)) 
          ? DEFAULTS.GEMINI_MEDGEMMA_V4 
          : geminiModel;
        result = await callGemini(prompt, systemInstruction, geminiModelToUse, maxTokens, temperature);
        break;
      }
      case 'openai':
        result = await callOpenAI(prompt, systemInstruction, undefined, maxTokens, temperature);
        break;
      case 'anthropic':
        result = await callAnthropic(
          prompt,
          systemInstruction,
          undefined,
          maxTokens,
          temperature,
          retrievalSnippets,
        );
        break;
      case 'deepseek':
        result = await callDeepSeek(prompt, systemInstruction, undefined, maxTokens, temperature);
        break;
      case 'vertex':
        result = await callVertex(prompt, systemInstruction, undefined, maxTokens, temperature);
        break;
      default:
        continue;
    }

    if (result.success && result.text) {
      return result;
    }
  }

  // All providers failed
  return {
    text: null,
    provider: orderedProviders[0] ?? 'gemini',
    model: 'none',
    latencyMs: 0,
    success: false,
    error: `All providers failed: ${orderedProviders.join(', ')}`,
  };
}

// ─── Parallel Consensus (for diagnostic) ──────────────────────────────────────

export interface ConsensusRequest {
  prompt: string;
  systemInstruction?: string;
  providers: ProviderName[];
  retrievalSnippets?: AnthropicRetrievalSnippet[];
}

/**
 * Calls all providers in parallel (allSettled) and returns all
 * successful text responses. Used for the diagnostic consensus merge.
 */
export async function callParallelConsensus(
  request: ConsensusRequest,
): Promise<NormalizedProviderResponse[]> {
  const { prompt, systemInstruction, providers, retrievalSnippets } = request;
  const orderedProviders = resolveProviderOrder(providers);

  const calls: Promise<NormalizedProviderResponse>[] = orderedProviders.map((p) => {
    switch (p) {
      case 'openrouter': return callOpenRouter(prompt, systemInstruction);
      case 'hf':         return callHuggingFace(prompt, systemInstruction);
      case 'groq':       return callGroq(prompt, systemInstruction);
      case 'gemini':     return callGemini(prompt, systemInstruction);
      case 'openai':     return callOpenAI(prompt, systemInstruction);
      case 'anthropic':  return callAnthropic(prompt, systemInstruction, undefined, 1200, 0.2, retrievalSnippets);
      case 'deepseek':   return callDeepSeek(prompt, systemInstruction);
      case 'vertex':     return callVertex(prompt, systemInstruction);
      default:           return Promise.resolve({ text: null, provider: p, model: 'unknown', latencyMs: 0, success: false });
    }
  });

  const settled = await Promise.allSettled(calls);

  return settled
    .filter((r): r is PromiseFulfilledResult<NormalizedProviderResponse> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.success && r.text !== null);
}

// ─── Provider model selection helpers ────────────────────────────────────────

/** Returns the appropriate HF model (heavy vs light) for a given AI type. */
export function getHFModel(aiType: string): string {
  const lightTypes = ['icd10', 'inventory', 'drug_interaction', 'lab'];
  return lightTypes.includes(aiType) ? DEFAULTS.HF_LIGHT : DEFAULTS.HF_HEAVY;
}

/** Returns the appropriate Groq model for a given AI type. */
export function getGroqModel(aiType: string): string {
  const lightTypes = ['icd10', 'inventory'];
  return lightTypes.includes(aiType) ? DEFAULTS.GROQ_LIGHT : DEFAULTS.GROQ_HEAVY;
}

/** Returns the appropriate OpenRouter model for a given AI type. */
export function getOpenRouterModel(aiType: string): string {
  const lightTypes = ['icd10', 'inventory', 'drug_interaction', 'lab'];
  const reasoningTypes = ['diagnostic', 'analytics'];
  
  if (reasoningTypes.includes(aiType)) {
    return DEFAULTS.OPENROUTER_REASONING;
  }
  if (lightTypes.includes(aiType)) {
    return DEFAULTS.OPENROUTER_FAST;
  }
  return DEFAULTS.OPENROUTER;
}

/** Returns the cascade provider list for a given analysis type. */
export function getCascadeForType(aiType: string): ProviderName[] {
  switch (aiType) {
    case 'diagnostic':
      // Diagnostic uses parallel consensus — cascade is used as the post-consensus fallback
      return ['openrouter', 'groq', 'hf', 'gemini', 'openai', 'anthropic', 'deepseek', 'vertex'];
    case 'analytics':
      // DAWA analytics prioritizes MedGemma v4 via Gemini
      return ['gemini', 'openrouter', 'groq', 'hf', 'anthropic', 'vertex'];
    case 'drug_interaction':
      return ['gemini', 'openrouter', 'groq', 'hf', 'anthropic', 'vertex'];
    case 'lab':
      return ['gemini', 'openrouter', 'groq', 'hf', 'anthropic', 'vertex'];
    case 'icd10':
      return ['openrouter', 'groq', 'hf', 'gemini', 'vertex'];
    case 'inventory':
      return ['openrouter', 'groq', 'hf', 'gemini', 'vertex'];
    case 'teleconsultation':
      return ['gemini', 'openrouter', 'groq', 'hf', 'anthropic', 'vertex'];
    case 'radiology':
      // Complex medical imaging: Claude 3.5 Sonnet + Gemini primary
      return ['openrouter', 'anthropic', 'gemini', 'groq', 'hf', 'deepseek', 'vertex'];
    case 'pathology':
      // Complex histopathology: Claude first priority
      return ['openrouter', 'anthropic', 'gemini', 'groq', 'hf', 'deepseek', 'vertex'];
    default:
      return ['openrouter', 'groq', 'hf', 'gemini', 'anthropic', 'vertex'];
  }
}
