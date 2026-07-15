import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const key = env.GEMINI_API_KEY;
const models = ['gemini-2.5-flash', 'gemini-2.5-flash-preview-04-17', 'gemini-2.5-pro-preview-03-25', 'gemini-2.0-flash-lite'];
for (const m of models) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
      signal: AbortSignal.timeout(10000) }
  );
  const j = await r.json();
  console.log(`${m}: HTTP ${r.status}${r.ok ? ' ✅ OK' : ' ❌ ' + (j.error?.message || '').slice(0, 70)}`);
}
