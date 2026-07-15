/**
 * Vertex AI Speech-to-Text Transcription API
 * 
 * POST /api/teleconsultation/transcribe
 * 
 * Accepts audio chunks (base64-encoded PCM 16-bit, 16kHz mono) and returns
 * real-time transcription using Vertex AI Speech-to-Text.
 * 
 * For low-bandwidth mode, also supports WebM/Opus audio blobs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, enforceApiRateLimit } from '@/lib/api-security';
import { buildDegradedResponse } from '@/lib/degraded-response';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';

const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION ?? 'us-central1';
const VERTEX_AI_PROJECT = process.env.VERTEX_AI_PROJECT;

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

    const privateKey = creds.private_key.replace(/\\n/g, '\n');
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${header}.${payload}`)),
    ).toString('base64url');

    const jwt = `${header}.${payload}.${signature}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
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
  const rateLimit = await enforceApiRateLimit(req, 'api:teleconsult:transcribe');
  if (rateLimit) return rateLimit;

  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let audioBase64: string;
    let audioEncoding: 'LINEAR16' | 'WEBM_OPUS' = 'WEBM_OPUS';
    let jsonBody: { audio?: string; encoding?: string; fallbackText?: string; language?: string } = {};

    if (contentType.includes('application/json')) {
      jsonBody = await req.json();
      audioBase64 = jsonBody.audio ?? '';
      audioEncoding = jsonBody.encoding === 'pcm16' ? 'LINEAR16' : 'WEBM_OPUS';
    } else {
      const buffer = await req.arrayBuffer();
      audioBase64 = Buffer.from(buffer).toString('base64');
    }

    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
    }

    const accessToken = await getVertexAccessToken();

    if (!accessToken || !VERTEX_AI_PROJECT) {
      if (isStrictProductionMode()) {
        return buildDegradedResponse({
          entity: 'teleconsultationTranscription',
          detail: 'Vertex AI Speech-to-Text credentials are unavailable.',
        });
      }
      // Fallback: use browser's built-in Speech Recognition result if passed
      const fallbackText = jsonBody?.fallbackText;
      if (fallbackText) {
        return NextResponse.json({
          transcript: fallbackText,
          confidence: 0.85,
          provider: 'browser-fallback',
          language: jsonBody.language ?? 'en-US',
        });
      }
      return NextResponse.json({
        transcript: '',
        confidence: 0,
        provider: 'unavailable',
        message: 'Vertex AI not configured. Use browser speech recognition as fallback.',
      });
    }

    const url = `https://${VERTEX_AI_LOCATION}-speech.googleapis.com/v1/speech:recognize`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': VERTEX_AI_PROJECT,
      },
      body: JSON.stringify({
        config: {
          encoding: audioEncoding,
          sampleRateHertz: audioEncoding === 'LINEAR16' ? 16000 : 48000,
          languageCode: 'en-US',
          alternativeLanguageCodes: ['sw-KE', 'am-ET'],
          model: 'latest_long',
          useEnhanced: true,
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          maxAlternatives: 1,
        },
        audio: { content: audioBase64 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Vertex AI Speech-to-Text error', { status: response.status, body: errText });
      return NextResponse.json({ error: 'Transcription failed', details: errText }, { status: 502 });
    }

    const data = await response.json();
    const results = data.results ?? [];
    const transcript = results.map((r: { alternatives: { transcript: string }[] }) =>
      r.alternatives?.[0]?.transcript ?? '',
    ).filter(Boolean).join(' ');

    const confidence = results[0]?.alternatives?.[0]?.confidence ?? 0;

    return NextResponse.json({
      transcript,
      confidence,
      provider: 'vertex-ai',
      language: 'en-US',
      alternatives: results[0]?.alternatives?.slice(1) ?? [],
    });
  } catch (err) {
    logger.error('Transcription API error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
