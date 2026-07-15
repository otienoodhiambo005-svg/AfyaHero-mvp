#!/usr/bin/env node
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const GEMINI_KEY = env.GEMINI_API_KEY || '';
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY || '';
const OPENAI_KEY = env.OPENAI_API_KEY || '';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.5-pro'];

async function testGemini(model) {
  if (!GEMINI_KEY) return 'NO_KEY';
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply only: {"ok":true}' }] }] }),
        signal: AbortSignal.timeout(12000),
      }
    );
    const j = await r.json();
    if (!r.ok) return `HTTP_${r.status}: ${(j.error?.message || '').slice(0, 80)}`;
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.length > 0 ? `OK → ${text.slice(0, 50).replace(/\n/g, ' ')}` : 'EMPTY_RESPONSE';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

async function testAnthropic() {
  if (!ANTHROPIC_KEY) return 'NO_KEY';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply only: {"ok":true}' }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    const j = await r.json();
    if (!r.ok) return `HTTP_${r.status}: ${(j.error?.message || '').slice(0, 80)}`;
    const text = j?.content?.find(p => p.type === 'text')?.text || '';
    return text.length > 0 ? `OK → ${text.slice(0, 50).replace(/\n/g, ' ')}` : 'EMPTY_RESPONSE';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

async function testOpenAI() {
  if (!OPENAI_KEY) return 'NO_KEY';
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply only: {"ok":true}' }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    const j = await r.json();
    if (!r.ok) return `HTTP_${r.status}: ${(j.error?.message || '').slice(0, 80)}`;
    const text = j?.choices?.[0]?.message?.content || '';
    return text.length > 0 ? `OK → ${text.slice(0, 50).replace(/\n/g, ' ')}` : 'EMPTY_RESPONSE';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

console.log('=== AfyaHero AI Provider Health Check ===');
console.log(`Date: ${new Date().toISOString()}\n`);

for (const model of GEMINI_MODELS) {
  process.stdout.write(`Gemini/${model}: `);
  const result = await testGemini(model);
  console.log(result);
}

process.stdout.write('Anthropic/claude-3-5-sonnet-latest: ');
console.log(await testAnthropic());

process.stdout.write('OpenAI/gpt-4o-mini: ');
console.log(await testOpenAI());
