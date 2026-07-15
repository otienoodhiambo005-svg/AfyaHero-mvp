/**
 * Vertex AI Clinical Analysis API
 * 
 * POST /api/teleconsultation/analyze
 * 
 * Sends consultation transcript to Vertex AI Gemini for clinical summarization,
 * differential diagnosis suggestions, and next-step recommendations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, enforceApiRateLimit, readJsonBody, requireString } from '@/lib/api-security';
import { buildDegradedResponse } from '@/lib/degraded-response';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';

const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION ?? 'us-central1';
const VERTEX_AI_PROJECT = process.env.VERTEX_AI_PROJECT;
const GEMINI_MODEL = process.env.GEMINI_MEDGEMMA_MODEL ?? 'med-gemma-2';

const CLINICAL_SYSTEM_PROMPT = `You are an expert clinical documentation AI for East African healthcare settings. Analyze the consultation transcript and return a structured JSON response with:

1. **summary**: A concise 2-3 sentence clinical summary.
2. **chiefComplaint**: The primary reason for the visit.
3. **symptoms**: Array of symptoms mentioned.
4. **differentialDiagnosis**: Array of 3-5 diagnoses (Condition + ICD-10) considering East African epidemiology (Malaria, TB, LRTI, etc.).
5. **recommendedActions**: Array of actionable next steps.
6. **soapDraft**: An object with { subjective, objective, assessment, plan } fields formatted for clinical records.
7. **redFlags**: Critical warning signs requiring immediate escalation.
8. **icd10Suggestions**: Array of 2-3 relevant ICD-10 codes.

Return ONLY valid JSON. No markdown. If transcript is insufficient, return nulls/empty arrays in the relevant fields.`;

async function getVertexAccessToken(): Promise<string | null> {
  const key = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!key) return null;

  try {
    const creds = JSON.parse(key);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const signature = Buffer.from(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        await crypto.subtle.importKey('pkcs8', pemToDer(creds.private_key.replace(/\\n/g, '\n')), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']),
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ).toString('base64url');

    const jwt = `${header}.${payload}.${signature}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function POST(req: NextRequest) {
  const rateLimit = await enforceApiRateLimit(req, 'api:teleconsult:analyze');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;

  const transcript = requireString(body.transcript, 'transcript', { min: 10, max: 50000 });
  if (transcript instanceof NextResponse) return transcript;

  const patientContext = (body.patientContext as string) ?? '';
  const accessToken = await getVertexAccessToken();

  if (!accessToken || !VERTEX_AI_PROJECT) {
    if (isStrictProductionMode()) {
      return buildDegradedResponse({
        entity: 'teleconsultationAnalysis',
        detail: 'Vertex AI credentials are unavailable for clinical analysis.',
      });
    }
    // Fallback: return a structured mock analysis
    return NextResponse.json({
      analysis: {
        summary: 'Transcript received. Vertex AI not configured — showing placeholder analysis.',
        chiefComplaint: 'N/A',
        symptoms: [],
        differentialDiagnosis: [],
        recommendedActions: ['Configure Vertex AI credentials for live clinical analysis'],
        soapDraft: {
          subjective: 'Patient context provided: ' + (patientContext || 'None'),
          objective: 'Vitals not captured in transcript.',
          assessment: 'Vertex AI integration pending.',
          plan: 'Manual entry required.'
        },
        redFlags: [],
        icd10Suggestions: [],
      },
      provider: 'fallback',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const url = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': VERTEX_AI_PROJECT,
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: CLINICAL_SYSTEM_PROMPT }] },
          { role: 'user', parts: [{ text: `Patient context: ${patientContext || 'Not provided'}\n\nConsultation transcript:\n${transcript}` }] },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_MEDICAL', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Vertex AI Gemini analysis error', { status: response.status, body: errText });
      return NextResponse.json({ error: 'Clinical analysis failed', details: errText }, { status: 502 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let analysis;
    try {
      // Robust JSON extraction: handles markdown blocks and accidental prefixes
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : text;
      analysis = JSON.parse(cleaned);
    } catch {
      logger.warn('Failed to parse clinical analysis JSON', { text });
      analysis = {
        summary: text.slice(0, 500),
        chiefComplaint: '',
        symptoms: [],
        differentialDiagnosis: [],
        recommendedActions: [],
        soapDraft: { subjective: text, objective: '', assessment: '', plan: '' },
        redFlags: [],
        icd10Suggestions: [],
      };
    }

    return NextResponse.json({
      analysis,
      provider: 'vertex-ai-gemini',
      model: GEMINI_MODEL,
      timestamp: new Date().toISOString(),
      usageTokens: data.usageMetadata ?? {},
    });
  } catch (err) {
    logger.error('Clinical analysis API error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Clinical analysis failed' }, { status: 500 });
  }
}
