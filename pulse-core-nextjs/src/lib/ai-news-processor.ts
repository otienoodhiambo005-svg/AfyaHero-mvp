/**
 * Gemini AI News Processing Pipeline
 * Semantic scoring, summarization, and actionable insights extraction
 */

import { callWithCascade, getCascadeForType } from '@/lib/ai-providers';

// Local type definitions matching health news route internal types
interface FeedItem {
  title: string;
  summary: string;
  url: string;
  publishedAt?: string;
  source: string;
  sourcePriority: number;
}

type HealthNewsRole = 'reception' | 'medical' | 'lab' | 'pharmacy' | 'admin';

interface RoleProfile {
  keywords: string[];
  tagRules: Array<{ label: string; keywords: string[] }>;
  audienceFocus: string;
  sources: Array<{ name: string; url?: string; reliability?: number }>;
}

export interface ProcessedNewsItem extends FeedItem {
  aiScore: number;
  aiConfidence: number;
  clinicalSummary: string;
  actionableSteps: string[];
  relevanceTags: string[];
  safetyStatus: 'safe' | 'review' | 'blocked';
}

const SYSTEM_INSTRUCTION = `
You are a clinical health news analyst for African hospitals. Process this health news article for hospital staff.

FOLLOW THESE RULES STRICTLY:
1. Score relevance on scale 0-10 for the given staff role
2. Extract 1-3 concrete actionable steps that hospital staff should take
3. Write a concise clinical summary optimized for busy healthcare workers
4. Assign maximum 3 relevant tags
5. Flag any misinformation, dangerous advice, or unproven claims
6. Adapt guidance to East African healthcare context
7. Do not add any disclaimers or extra text
8. Return ONLY valid JSON

RESPONSE FORMAT:
{
  "score": number,
  "summary": string,
  "actionableSteps": string[],
  "tags": string[],
  "safetyStatus": "safe" | "review" | "blocked",
  "confidence": number
}
`;

export async function processNewsItemWithGemini(
  item: FeedItem,
  role: HealthNewsRole,
  profile: RoleProfile
): Promise<ProcessedNewsItem> {
  const prompt = `
Role: ${role}
Role focus: ${profile.audienceFocus}
Keywords for this role: ${profile.keywords.join(', ')}

News Article:
Title: ${item.title}
Source: ${item.source}
Summary: ${item.summary}

Process this article according to the instructions.
`;

  try {
    const response = await callWithCascade({
      providers: getCascadeForType('analytics'),
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      maxTokens: 600,
      temperature: 0.1,
    });

    if (response.success && response.text) {
      const parsed = JSON.parse(response.text);

      return {
        ...item,
        aiScore: parsed.score || 0,
        aiConfidence: parsed.confidence || 0.5,
        clinicalSummary: parsed.summary || item.summary,
        actionableSteps: parsed.actionableSteps || [],
        relevanceTags: parsed.tags || [],
        safetyStatus: parsed.safetyStatus || 'safe',
      };
    }

  } catch {
    // Fallback to original scoring if AI processing fails
  }

  // Graceful fallback
  return {
    ...item,
    aiScore: 0,
    aiConfidence: 0,
    clinicalSummary: item.summary,
    actionableSteps: [],
    relevanceTags: [],
    safetyStatus: 'safe',
  };
}

export async function processNewsBatch(
  items: FeedItem[],
  role: HealthNewsRole,
  profile: RoleProfile
): Promise<ProcessedNewsItem[]> {
  // Process in parallel with concurrency limit
  const batchSize = 3;
  const results: ProcessedNewsItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const processed = await Promise.all(
      batch.map(item => processNewsItemWithGemini(item, role, profile))
    );
    results.push(...processed);
  }

  return results
    .filter(item => item.safetyStatus !== 'blocked')
    .sort((a, b) => b.aiScore - a.aiScore);
}