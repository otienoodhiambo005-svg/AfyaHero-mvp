import { createClient } from '@supabase/supabase-js';
import type { PortalRole } from '@/types';
import type { AICitation, AnthropicRetrievalSnippet } from '@/lib/ai-providers';

type StaticSnippet = {
  id: string;
  title: string;
  source: string;
  url?: string;
  content: string;
  roles?: PortalRole[];
};

type HealthNewsRow = {
  id?: string;
  title: string | null;
  category: string | null;
  content: string | null;
  media_url: string | null;
  created_at?: string | null;
};

export type DawaRagSnippet = AnthropicRetrievalSnippet & {
  score: number;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'your',
  'about',
  'have',
  'what',
  'when',
  'where',
  'which',
  'would',
  'could',
  'should',
  'there',
  'their',
  'patient',
  'please',
]);

const STATIC_SNIPPETS: StaticSnippet[] = [
  {
    id: 'keml-rational-antibiotic',
    title: 'KEML antimicrobial stewardship reminder',
    source: 'Kenya Essential Medicines List (KEML)',
    content:
      'Use local susceptibility patterns where available. Avoid unnecessary broad-spectrum antibiotics. Reassess after culture results and de-escalate when clinically appropriate.',
    roles: ['medical', 'pharmacy', 'lab'],
  },
  {
    id: 'moh-emergency-triage',
    title: 'MoH emergency triage escalation',
    source: 'MoH Kenya emergency triage principles',
    content:
      'Escalate urgently for airway compromise, persistent hypoxia, shock, altered mental status, active bleeding, and seizure activity. Prioritize stabilization before detailed diagnostics.',
    roles: ['medical', 'reception'],
  },
  {
    id: 'nascop-hiv-test-pathway',
    title: 'NASCOP HIV result handling',
    source: 'NASCOP Kenya',
    content:
      'Reactive HIV screening results require confirmatory algorithm steps per NASCOP guidance and confidential post-test counseling. Link confirmed cases to care immediately.',
    roles: ['medical', 'lab'],
  },
  {
    id: 'nltp-tb-screening',
    title: 'NLTP TB symptom screening prompt',
    source: 'Kenya NLTP',
    content:
      'Persistent cough, fever, night sweats, and weight loss should trigger TB screening and appropriate diagnostic pathway using local TB program protocols.',
    roles: ['medical', 'lab', 'reception'],
  },
  {
    id: 'sha-claims-completeness',
    title: 'SHA claim completeness checklist',
    source: 'Kenya SHA operations guidance',
    content:
      'Claims are commonly delayed by missing diagnosis coding, incomplete consultation notes, and undocumented services. Validate claim data completeness before submission.',
    roles: ['admin', 'reception'],
  },
  {
    id: 'pharmacy-high-alert-drugs',
    title: 'High-alert dispensing safeguards',
    source: 'ISMP-inspired high-alert safety practice',
    content:
      'For insulin, anticoagulants, concentrated electrolytes, and opioids, enforce independent dose checks, clear labeling, and counseling on warning signs before discharge.',
    roles: ['pharmacy', 'medical'],
  },
  {
    id: 'lab-critical-value-communication',
    title: 'Critical lab value communication',
    source: 'MoH laboratory quality principles',
    content:
      'Critical-value results should be immediately escalated to responsible clinical teams, with time-stamped documentation of notification and acknowledgement.',
    roles: ['lab', 'medical'],
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function scoreText(queryTokens: string[], title: string, content: string): number {
  if (!queryTokens.length) return 0;

  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (titleLower.includes(token)) {
      score += 2.5;
    }
    if (contentLower.includes(token)) {
      score += 1.2;
    }
  }

  return score;
}

async function loadDynamicHealthNewsSnippets(
  queryTokens: string[],
  limit: number,
): Promise<DawaRagSnippet[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return [];
  }

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from('health_news')
      .select('id,title,category,content,media_url,created_at')
      .order('created_at', { ascending: false })
      .limit(120);

    if (error || !data) {
      return [];
    }

    return (data as HealthNewsRow[])
      .map((row) => {
        const title = row.title ?? 'Health news note';
        const content = (row.content ?? '').trim();
        if (!content) return null;

        const score = scoreText(queryTokens, title, content);
        if (score <= 0) return null;

        return {
          id: `health-news-${row.id ?? title.slice(0, 24)}`,
          title,
          source: row.category ? `Health News: ${row.category}` : 'Health News',
          url: row.media_url ?? undefined,
          content,
          excerpt: content.slice(0, 220),
          confidence: Math.min(0.99, score / 10),
          score,
        } satisfies DawaRagSnippet;
      })
      .filter((snippet) => snippet !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function retrieveDawaKnowledge(params: {
  query: string;
  role: PortalRole;
  limit?: number;
}): Promise<DawaRagSnippet[]> {
  const { query, role, limit = 4 } = params;
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const staticMatches = STATIC_SNIPPETS
    .filter((snippet) => !snippet.roles || snippet.roles.includes(role))
    .map((snippet) => {
      const score = scoreText(queryTokens, snippet.title, snippet.content);
      if (score <= 0) return null;
      return {
        id: snippet.id,
        title: snippet.title,
        source: snippet.source,
        url: snippet.url,
        content: snippet.content,
        excerpt: snippet.content.slice(0, 220),
        confidence: Math.min(0.99, score / 10),
        score,
      } satisfies DawaRagSnippet;
    })
    .filter((snippet) => snippet !== null) as DawaRagSnippet[];

  const dynamicMatches = await loadDynamicHealthNewsSnippets(queryTokens, limit * 2);

  const merged = [...staticMatches, ...dynamicMatches]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return merged;
}

export function formatRagPromptBlock(snippets: DawaRagSnippet[]): string {
  if (!snippets.length) return '';

  const lines = snippets.map((snippet, index) => {
    const sourceLine = snippet.url
      ? `Source: ${snippet.source} (${snippet.url})`
      : `Source: ${snippet.source}`;
    return `[Source ${index + 1}] ${snippet.title}\n${sourceLine}\nEvidence: ${snippet.content}`;
  });

  return `RETRIEVED REFERENCE SOURCES:\n${lines.join('\n\n')}`;
}

export function snippetsToCitations(snippets: DawaRagSnippet[]): AICitation[] {
  return snippets.map((snippet) => ({
    id: snippet.id,
    title: snippet.title,
    source: snippet.source,
    url: snippet.url,
    excerpt: snippet.excerpt,
    confidence: snippet.confidence,
  }));
}
