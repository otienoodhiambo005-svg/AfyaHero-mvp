/**
 * Translation API Endpoint
 * 
 * POST /api/translate
 * 
 * Translates text between supported languages using Vertex AI Studio.
 * Falls back to built-in medical glossary for core medical terms.
 * 
 * Request body:
 * {
 *   text: string,
 *   source: string (optional, defaults to 'en'),
 *   target: string,
 *   context?: string (optional, e.g. 'medical', 'clinical', 'general')
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { translateWithVertex } from '@/lib/ai-providers';
import { translateTerm, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/i18n/translations';
import { getCachedTranslation, setCachedTranslation } from '@/lib/i18n/translation-cache';
import { enforceApiGuard, readJsonBody, requireString } from '@/lib/api-security';

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:translate',
      roles: ['reception', 'medical', 'lab', 'pharmacy', 'admin'],
    });
    if (guard.response) return guard.response;

    const body = await readJsonBody<Record<string, unknown>>(request);
    if (body instanceof NextResponse) return body;

    const text = requireString(body.text, 'text', { min: 1, max: 4000 });
    if (text instanceof NextResponse) return text;
    const target = requireString(body.target, 'target', { min: 2, max: 10 });
    if (target instanceof NextResponse) return target;
    const source = typeof body.source === 'string' ? body.source : 'en';
    const context = typeof body.context === 'string' ? body.context : undefined;

    if (!SUPPORTED_LANGUAGES.some((l) => l.code === source)) {
      return NextResponse.json(
        { error: `Unsupported source language: ${source}` },
        { status: 400 }
      );
    }

    if (!SUPPORTED_LANGUAGES.some((l) => l.code === target)) {
      return NextResponse.json(
        { error: `Unsupported target language: ${target}` },
        { status: 400 }
      );
    }

    // Try cache first
    const cached = await getCachedTranslation(text, target as SupportedLanguage, context);
    if (cached) {
      return NextResponse.json({
        translatedText: cached,
        sourceLanguage: source,
        targetLanguage: target,
        cached: true,
      });
    }

    // Check medical glossary for single terms
    const glossaryResult = translateTerm(text, target as SupportedLanguage);
    if (glossaryResult !== text) {
      // Found in glossary — cache and return
      await setCachedTranslation(text, target as SupportedLanguage, glossaryResult, context);
      return NextResponse.json({
        translatedText: glossaryResult,
        sourceLanguage: source,
        targetLanguage: target,
        cached: false,
        translationSource: 'glossary',
      });
    }

    // Use Vertex AI for full translation
    const translatedText = await translateWithVertex(
      text,
      source,
      target
    );

    if (!translatedText) {
      return NextResponse.json(
        { error: 'Translation service unavailable' },
        { status: 503 }
      );
    }

    // Cache the result
    await setCachedTranslation(text, target as SupportedLanguage, translatedText, context);

    return NextResponse.json({
      translatedText,
      sourceLanguage: source,
      targetLanguage: target,
      cached: false,
      translationSource: 'vertex',
    });
  } catch (error) {
    return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
  }
}

/**
 * GET /api/translate/languages
 * 
 * Returns list of supported languages for translation.
 */
export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      direction: l.direction,
      region: l.region,
    })),
  });
}
