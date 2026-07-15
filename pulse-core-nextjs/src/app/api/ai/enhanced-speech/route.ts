/**
 * Enhanced Speech Service - OpenAI Whisper + Coqui Vits TTS
 * 
 * Provides medical-grade speech recognition and natural voice synthesis
 * for clinical documentation and patient communication.
 * 
 * Environment Variables:
 * - OPENAI_API_KEY (for Whisper)
 * - COQUI_API_KEY (optional, for Vits TTS)
 * - AZURE_SPEECH_KEY (fallback)
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';

export type SpeechToTextProvider = 'whisper' | 'azure' | 'web-speech';
export type TextToSpeechProvider = 'coqui' | 'azure' | 'web-speech';

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  duration?: number;
  provider: SpeechToTextProvider;
}

export interface SynthesisResult {
  audioUrl?: string;
  audioBase64?: string;
  provider: TextToSpeechProvider;
  duration?: number;
}

/**
 * POST /api/ai/enhanced-speech
 * 
 * Body:
 * {
 *   mode: 'transcribe' | 'synthesize',
 *   // For transcription
 *   audioData?: string (base64),
 *   audioUrl?: string,
 *   language?: string,
 *   provider?: 'whisper' | 'azure' | 'web-speech',
 *   // For synthesis
 *   text?: string,
 *   voiceId?: string,
 *   // Common
 * }
 */
export async function POST(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:ai:speech',
    requireAuth: true,
  });
  if (guard.response) return guard.response;

  try {
    const body = await request.json();
    const { mode, provider: preferredProvider } = body;

    if (mode === 'transcribe') {
      return await handleEnhancedTranscription(body, preferredProvider);
    }

    if (mode === 'synthesize') {
      return await handleEnhancedSynthesis(body, preferredProvider);
    }

    return NextResponse.json({ error: 'Invalid mode. Use "transcribe" or "synthesize"' }, { status: 400 });
  } catch (error) {
    logger.error('Enhanced speech error', { error });
    return NextResponse.json({ error: 'Speech processing failed' }, { status: 500 });
  }
}

/**
 * Handle speech-to-text with multiple providers
 */
async function handleEnhancedTranscription(
  body: Record<string, unknown>,
  preferredProvider?: string
): Promise<NextResponse> {
  const { audioData, audioUrl, language = 'en' } = body;

  if (!audioData && !audioUrl) {
    return NextResponse.json({ error: 'Audio data or URL required' }, { status: 400 });
  }

  const provider = preferredProvider || 'whisper';

  // Try Whisper first (best for medical terminology)
  if (provider === 'whisper' || provider === 'auto') {
    try {
      const result = await transcribeWithWhisper(audioData as string, audioUrl as string, language as string);
      if (result) {
        return NextResponse.json(result);
      }
    } catch (error) {
      logger.warn('Whisper transcription failed, trying fallback', { error });
    }
  }

  // Fallback to Azure
  if (provider === 'azure' || provider === 'auto') {
    try {
      const result = await transcribeWithAzure(audioData as string, language as string);
      if (result) {
        return NextResponse.json(result);
      }
    } catch (error) {
      logger.warn('Azure transcription failed', { error });
    }
  }

  // Last resort: Web Speech API (client-side)
  return NextResponse.json({
    provider: 'web-speech',
    message: 'Use browser Web Speech API for transcription',
    text: '',
    language,
    confidence: 0
  });
}

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWithWhisper(
  audioData?: string,
  audioUrl?: string,
  language = 'en'
): Promise<TranscriptionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set, skipping Whisper');
    return null;
  }

  try {
    const formData = new FormData();
    
    // Handle audio data
    if (audioData) {
      const audioBuffer = Buffer.from(audioData, 'base64');
      const blob = new Blob([audioBuffer], { type: 'audio/webm' });
      formData.append('file', blob, 'audio.webm');
    } else if (audioUrl) {
      // Download and convert audio
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      formData.append('file', blob, 'audio.wav');
    } else {
      return null;
    }

    formData.append('model', 'whisper-1');
    formData.append('language', language === 'sw' ? 'sw' : language === 'en' ? 'en' : 'en');
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Whisper API error', { error });
      return null;
    }

    const result = await response.json();
    
    return {
      text: result.text || '',
      language,
      confidence: 0.9, // Whisper doesn't provide confidence
      provider: 'whisper'
    };
  } catch (error) {
    logger.error('Whisper transcription error', { error });
    return null;
  }
}

/**
 * Transcribe using Azure Speech Services
 */
async function transcribeWithAzure(
  audioData?: string,
  language = 'en'
): Promise<TranscriptionResult | null> {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';

  if (!azureKey || !audioData) {
    return null;
  }

  try {
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'sw': 'sw-KE',
      'sheng': 'en-US'
    };

    const response = await fetch(
      `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?` +
      `language=${langMap[language] || 'en-US'}&format=detailed`,
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
      return null;
    }

    const result = await response.json();
    
    return {
      text: result.DisplayText || result.Text || '',
      confidence: result.Confidence || 0.8,
      language,
      provider: 'azure'
    };
  } catch (error) {
    logger.error('Azure transcription error', { error });
    return null;
  }
}

/**
 * Handle text-to-speech with multiple providers
 */
async function handleEnhancedSynthesis(
  body: Record<string, unknown>,
  preferredProvider?: string
): Promise<NextResponse> {
  const { text, language = 'en', voiceId, speed = 1.0 } = body;

  if (!text) {
    return NextResponse.json({ error: 'Text is required for synthesis' }, { status: 400 });
  }

  const provider = preferredProvider || 'coqui';

  // Try Coqui TTS first (open source, high quality)
  if (provider === 'coqui' || provider === 'auto') {
    try {
      const result = await synthesizeWithCoqui(text as string, language as string, voiceId as string, speed as number);
      if (result) {
        return NextResponse.json(result);
      }
    } catch (error) {
      logger.warn('Coqui TTS failed, trying fallback', { error });
    }
  }

  // Fallback to Azure
  if (provider === 'azure' || provider === 'auto') {
    try {
      const result = await synthesizeWithAzure(text as string, language as string, speed as number);
      if (result) {
        return NextResponse.json(result);
      }
    } catch (error) {
      logger.warn('Azure TTS failed', { error });
    }
  }

  // Last resort: Web Speech API (return instructions for client)
  return NextResponse.json({
    provider: 'web-speech',
    message: 'Use browser SpeechSynthesis API for TTS',
    text
  });
}

/**
 * Synthesize speech using Coqui TTS API
 */
async function synthesizeWithCoqui(
  text: string,
  language = 'en',
  voiceId?: string,
  speed = 1.0
): Promise<SynthesisResult | null> {
  const apiKey = process.env.COQUI_API_KEY;
  if (!apiKey) {
    logger.warn('COQUI_API_KEY not set');
    return null;
  }

  try {
    const voiceMap: Record<string, string> = {
      'en': 'female-voice-1',
      'sw': 'swahili-female-1',
      'sheng': 'female-voice-1'
    };

    const response = await fetch('https://api.coqui.ai/v2/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId || voiceMap[language] || voiceMap.en,
        speed: speed,
        language: language === 'sheng' ? 'en' : language
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Coqui API error', { error });
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return {
      audioBase64,
      provider: 'coqui',
      duration: Math.ceil(text.length / 15) // Estimate
    };
  } catch (error) {
    logger.error('Coqui TTS error', { error });
    return null;
  }
}

/**
 * Synthesize speech using Azure Speech Services
 */
async function synthesizeWithAzure(
  text: string,
  language = 'en',
  speed = 1.0
): Promise<SynthesisResult | null> {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';

  if (!azureKey) {
    return null;
  }

  try {
    const voiceMap: Record<string, string> = {
      'en': 'en-US-AriaNeural',
      'sw': 'sw-KE-EuniceNeural',
      'sheng': 'en-US-AriaNeural'
    };

    const voiceName = voiceMap[language] || voiceMap.en;
    const langCode = language === 'sw' ? 'sw-KE' : 'en-US';

    const ssml = `
      <speak version="1.0" xml:lang="${langCode}">
        <voice name="${voiceName}">
          <prosody rate="${speed}" pitch="0%">
            ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </prosody>
        </voice>
      </speak>
    `;

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
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return {
      audioBase64,
      provider: 'azure',
      duration: Math.ceil(text.length / 15)
    };
  } catch (error) {
    logger.error('Azure TTS error', { error });
    return null;
  }
}

/**
 * GET /api/ai/enhanced-speech - Get available voices
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'voices') {
    return NextResponse.json({
      whisper: {
        languages: ['en', 'sw'],
        note: 'Whisper supports 99 languages, specify in request'
      },
      coqui: {
        voices: [
          { id: 'female-voice-1', name: 'Female (Default)', language: 'multi' },
          { id: 'male-voice-1', name: 'Male', language: 'multi' },
          { id: 'swahili-female-1', name: 'Swahili Female', language: 'sw' },
        ]
      },
      azure: {
        voices: [
          { id: 'en-US-AriaNeural', name: 'Aria (English)', language: 'en' },
          { id: 'sw-KE-EuniceNeural', name: 'Eunice (Swahili)', language: 'sw' },
        ]
      },
      webSpeech: {
        voices: 'Browser-dependent'
      }
    });
  }

  return NextResponse.json({
    message: 'Use POST with mode=transcribe or mode=synthesize',
    providers: {
      transcription: ['whisper', 'azure', 'web-speech'],
      synthesis: ['coqui', 'azure', 'web-speech']
    }
  });
}