/**
 * Speech API Route
 * 
 * Handles speech-to-text and text-to-speech using Azure AI Speech Services
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { buildDegradedResponse } from '@/lib/degraded-response';
import logger from '@/lib/logger';
import { isStrictProductionMode } from '@/lib/runtime-flags';

type SpeechMode = 'recognize' | 'synthesize';

interface SpeechRequestBody {
  mode?: SpeechMode;
  action?: string;
  language?: string;
  audioData?: string;
  text?: string;
  rate?: number;
  pitch?: number;
}

/**
 * POST /api/ai/speech
 * Supports:
 * - mode=recognize (speech-to-text)
 * - mode=synthesize (text-to-speech)
 */
export async function POST(request: NextRequest) {
  const firewall = enforceRequestFirewall(request);
  if (firewall) return firewall;
  const originCheck = enforceTrustedOrigin(request);
  if (originCheck) return originCheck;
  const rateLimit = await enforceApiRateLimit(request, 'api:ai:speech');
  if (rateLimit) return rateLimit;
  const auth = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const payloadResult = await readJsonBody<SpeechRequestBody>(request);
  if (payloadResult instanceof NextResponse) return payloadResult;
  const payload = payloadResult;

  const mode: SpeechMode =
    payload.mode ??
    (typeof payload.text === 'string' && payload.text.trim() ? 'synthesize' : 'recognize');

  if (mode === 'recognize') {
    return handleSpeechToText(payload);
  }

  if (mode === 'synthesize') {
    return handleTextToSpeech(payload);
  }

  return NextResponse.json(
    { error: 'Invalid endpoint' },
    { status: 400 }
  );
}

/**
 * Handle speech-to-text conversion
 */
async function handleSpeechToText(payload: SpeechRequestBody) {
  try {
    const { language = 'en-US', action, audioData } = payload;

    if (action === 'start') {
      if (isStrictProductionMode()) {
        return buildDegradedResponse({
          entity: 'aiSpeechRecognition',
          detail: 'Speech recognition warm-up uses mock readiness and is disabled in strict production mode.',
        });
      }
      // In a real implementation, you would:
      // 1. Initialize Azure Speech Recognition
      // 2. Stream audio from client
      // 3. Process with Azure Cognitive Services
      // 4. Return transcription

      // For now, return mock response
      return NextResponse.json({
        text: '',
        confidence: 0,
        language,
        status: 'ready'
      });
    }

    // For audio data processing
    if (audioData && action === 'process') {
      // Call Azure Speech Services
      const azureKey = process.env.AZURE_SPEECH_KEY;
      const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';

      if (!azureKey) {
        if (isStrictProductionMode()) {
          return buildDegradedResponse({
            entity: 'aiSpeechRecognition',
            detail: 'Azure Speech Service credentials are unavailable.',
          });
        }
        return NextResponse.json({ error: 'Azure Speech Service not configured' }, { status: 500 });
      }

      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');

      // Call Azure Speech-to-Text API
      const response = await fetch(
        `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?` +
        `language=${language}&` +
        'format=json',
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'audio/wav'
          },
          body: audioBuffer
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('Azure Speech Recognition Error', { error });
        return NextResponse.json(
          { error: 'Speech recognition failed' },
          { status: response.status }
        );
      }

      const result = await response.json();

      return NextResponse.json({
        text: result.DisplayText || result.Text || '',
        confidence: result.Confidence || 0,
        language,
        status: result.RecognitionStatus
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Speech-to-text Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to process speech recognition' },
      { status: 500 }
    );
  }
}

/**
 * Handle text-to-speech conversion
 */
async function handleTextToSpeech(payload: SpeechRequestBody) {
  try {
    const { text, language = 'en-US', rate = 1.0, pitch = 1.0 } = payload;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';

    if (!azureKey) {
      if (isStrictProductionMode()) {
        return buildDegradedResponse({
          entity: 'aiSpeechSynthesis',
          detail: 'Azure Speech Service credentials are unavailable.',
        });
      }
      return NextResponse.json({ error: 'Azure Speech Service not configured' }, { status: 500 });
    }

    // Map language to Azure voice name
    const voiceMap: { [key: string]: string } = {
      'en-US': 'en-US-AriaNeural',
      'en-GB': 'en-GB-SoniaNeural',
      'es-ES': 'es-ES-AlvaroNeural',
      'fr-FR': 'fr-FR-DeniseNeural',
      'de-DE': 'de-DE-ConradNeural',
      'it-IT': 'it-IT-DiegoNeural',
      'pt-BR': 'pt-BR-AntonioNeural',
      'ja-JP': 'ja-JP-NanamiNeural',
      'zh-CN': 'zh-CN-YunjieNeural'
    };

    const voiceName = voiceMap[language] || voiceMap['en-US'];

    // Build SSML (Speech Synthesis Markup Language)
    const ssml = `
      <speak version="1.0" xml:lang="${language}">
        <voice name="${voiceName}">
          <prosody rate="${rate - 1}" pitch="${(pitch - 1) * 50}%">
            ${escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `;

    // Call Azure Text-to-Speech API
    const response = await fetch(
      `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
        },
        body: ssml
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Azure TTS Error', { error });
      return NextResponse.json(
        { error: 'Text-to-speech conversion failed' },
        { status: response.status }
      );
    }

    // Get audio as buffer
    const audioBuffer = await response.arrayBuffer();

    // Return audio data
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="speech.mp3"'
      }
    });
  } catch (error) {
    logger.error('Text-to-speech Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
