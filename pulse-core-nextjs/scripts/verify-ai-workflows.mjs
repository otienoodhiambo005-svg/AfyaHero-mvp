#!/usr/bin/env node

const argMap = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      argMap.set(arg, next);
      i += 1;
    } else {
      argMap.set(arg, 'true');
    }
  }
}

const baseUrl = argMap.get('--base-url') || process.env.AI_WORKFLOW_BASE_URL || 'http://localhost:3001';
const optional = argMap.get('--optional') === 'true';

const LOGIN_PAYLOAD = {
  email: 'demo@medical.afyahero.com',
  password: process.env.DEMO_PASSWORD || 'Demo@1234',
};

const CASES = [
  {
    name: 'diagnostic',
    body: {
      type: 'diagnostic',
      data: {
        symptoms: 'Persistent cough, fever, and night sweats for 3 weeks',
        context: 'Outpatient triage',
      },
    },
    validate: (json) => Array.isArray(json?.results),
  },
  {
    name: 'inventory',
    body: {
      type: 'inventory',
      data: [
        { name: 'Amoxicillin 500mg', stock_quantity: 24, unit: 'tabs', min_stock_level: 20 },
        { name: 'Paracetamol 500mg', stock_quantity: 8, unit: 'tabs', min_stock_level: 30 },
      ],
    },
    validate: (json) => Array.isArray(json?.results)
      && json.results.every((item) => item && typeof item.item === 'string' && typeof item.suggestion === 'string'),
  },
  {
    name: 'lab',
    body: {
      type: 'lab',
      data: {
        results: [
          { parameter: 'Hgb', value: '10.8 g/dL', normal: '13.5-17.5' },
          { parameter: 'WBC', value: '13.2 K/uL', normal: '4.5-11.0' },
        ],
      },
    },
    validate: (json) => Array.isArray(json?.results)
      && json.results.every((item) => item && typeof item.parameter === 'string' && typeof item.clinical === 'string'),
  },
  {
    name: 'analytics',
    body: {
      type: 'analytics',
      data: {
        volumeData: {
          query: 'How do we reduce triage waiting time today?',
          queue: 17,
          avgWaitMinutes: 23,
          context: 'Medical portal operations for morning shift',
        },
      },
    },
    validate: (json) => (
      json?.results
      && typeof json.results === 'object'
      && typeof json.results.answer === 'string'
      && json.results.answer.trim().length > 0
      && Array.isArray(json.results.recommendations)
      && json.results.recommendations.length > 0
      && json.results.recommendations.every((item) => typeof item === 'string' && item.trim().length > 0)
    ),
  },
  {
    name: 'teleconsultation',
    body: {
      type: 'teleconsultation',
      data: {
        chatHistory: [
          { role: 'Doctor', content: 'How have you been feeling?' },
          { role: 'Patient', content: 'The cough is better but still present at night.' },
        ],
      },
    },
    validate: (json) => json?.results
      && typeof json.results === 'object'
      && typeof json.results.summary === 'string'
      && Array.isArray(json.results.nextSteps),
  },
  {
    name: 'drug_interaction',
    body: {
      type: 'drug_interaction',
      data: {
        medications: ['Warfarin', 'Amiodarone'],
      },
    },
    validate: (json) => Array.isArray(json?.results)
      && json.results.every((item) => item && typeof item.severity === 'string' && typeof item.recommendation === 'string'),
  },
  {
    name: 'icd10',
    body: {
      type: 'icd10',
      data: {
        clinical_text: 'Community acquired pneumonia with productive cough and fever',
      },
    },
    validate: (json) => Array.isArray(json?.results)
      && json.results.every((item) => item && typeof item.code === 'string' && typeof item.description === 'string'),
  },
  {
    name: 'radiology',
    body: {
      type: 'radiology',
      data: {
        modality: 'X-ray',
        body_region: 'Chest',
        findings: 'Patchy bilateral lower lobe opacities with air bronchograms.',
      },
    },
    validate: (json) => json?.results
      && typeof json.results === 'object'
      && typeof json.results.impression === 'string'
      && Array.isArray(json.results.findings)
      && Array.isArray(json.results.differentials),
  },
  {
    name: 'pathology',
    body: {
      type: 'pathology',
      data: {
        specimen: 'Caseating granulomas with Langhans giant cells and central necrosis.',
        stain_type: 'Ziehl-Neelsen',
        clinical_history: 'Cervical lymphadenopathy and weight loss',
      },
    },
    validate: (json) => json?.results
      && typeof json.results === 'object'
      && typeof json.results.diagnosis === 'string'
      && Array.isArray(json.results.markers)
      && Array.isArray(json.results.differentials),
  },
];

function extractCookie(setCookieHeader) {
  if (!setCookieHeader || typeof setCookieHeader !== 'string') return '';
  const firstCookie = setCookieHeader.split(',')[0];
  const pair = firstCookie.split(';')[0]?.trim();
  return pair || '';
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { response, json };
}

async function main() {
  const loginUrl = `${baseUrl}/api/auth/demo-login`;
  const analyzeUrl = `${baseUrl}/api/ai/analyze`;

  let loginResult;
  try {
    loginResult = await postJson(loginUrl, LOGIN_PAYLOAD);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (optional) {
      console.log(`[ai-workflows] Skipped: unable to reach ${baseUrl} (${message})`);
      process.exit(0);
    }
    console.error(`[ai-workflows] Failed: unable to reach ${baseUrl} (${message})`);
    process.exit(1);
  }

  const loginCookie = extractCookie(loginResult.response.headers.get('set-cookie'));
  if (!loginResult.response.ok || !loginCookie) {
    const msg = `[ai-workflows] demo login did not return a valid session cookie (status ${loginResult.response.status}).`;
    if (optional) {
      console.log(`[ai-workflows] Skipped: ${msg}`);
      process.exit(0);
    }
    console.error(`[ai-workflows] Failed: ${msg}`);
    console.error('Payload:', JSON.stringify(loginResult.json));
    process.exit(1);
  }

  const results = [];
  for (const testCase of CASES) {
    try {
      const { response, json } = await postJson(analyzeUrl, testCase.body, {
        Cookie: loginCookie,
      });

      const pass = response.ok && testCase.validate(json);
      results.push({
        name: testCase.name,
        status: pass ? 'PASS' : 'FAIL',
        code: response.status,
        detail: pass
          ? 'ok'
          : (json?.error || `Unexpected response shape: ${JSON.stringify(json)}`),
      });
    } catch (error) {
      results.push({
        name: testCase.name,
        status: 'FAIL',
        code: 0,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('AI Workflow Connectivity Matrix');
  console.log('--------------------------------');
  for (const row of results) {
    console.log(`${row.status.padEnd(4)} | ${String(row.code).padEnd(3)} | ${row.name.padEnd(16)} | ${row.detail}`);
  }

  const failed = results.filter((row) => row.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`\n[ai-workflows] ${failed.length} workflow(s) failed.`);
    process.exit(1);
  }

  console.log('\n[ai-workflows] All AI workflows passed.');
}

main();