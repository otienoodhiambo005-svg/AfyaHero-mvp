import logger from '@/lib/logger';

/**
 * Environment validation — logs warnings on startup for missing config.
 * Import in layout.tsx or API routes to surface issues early.
 */

type EnvCheck = {
  key: string;
  required: boolean;
  placeholder?: string;       // if value matches this, treat as missing
  publicSafe?: boolean;       // safe to reference in client code
};

const ENV_CHECKS: EnvCheck[] = [
  // AI Provider API Keys
  { key: 'OPENROUTER_API_KEY', required: false },
  { key: 'HF_API_KEY', required: false },
  { key: 'GROQ_API_KEY', required: false },
  { key: 'GEMINI_API_KEY', required: false },
  { key: 'OPENAI_API_KEY', required: false },
  { key: 'ANTHROPIC_API_KEY', required: false },
  { key: 'DEEPSEEK_API_KEY', required: false },
  { key: 'VERTEX_AI_STUDIO_API_KEY', required: false },
  
  // Core Infrastructure
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, placeholder: 'https://your-project.supabase.co', publicSafe: true },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, placeholder: 'your-anon-key', publicSafe: true },
  { key: 'SUPABASE_URL', required: false, placeholder: 'https://your-project.supabase.co' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: false },
  { key: 'SESSION_SECRET', required: true },
  { key: 'DATABASE_URL', required: false },
  
  // Redis (Upstash) for rate limiting and caching
  { key: 'UPSTASH_REDIS_REST_URL', required: false, placeholder: 'your-upstash-redis-url' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: false, placeholder: 'your-upstash-redis-token' },
  
  // AI Microservices URLs (for local development)
  { key: 'TRIAGE_SERVICE_URL', required: false, placeholder: 'http://localhost:8001' },
  { key: 'DIAGNOSIS_SERVICE_URL', required: false, placeholder: 'http://localhost:8002' },
  { key: 'IMAGING_SERVICE_URL', required: false, placeholder: 'http://localhost:8003' },
  { key: 'BILLING_SERVICE_URL', required: false, placeholder: 'http://localhost:8004' },
  { key: 'OPERATIONAL_SERVICE_URL', required: false, placeholder: 'http://localhost:8005' },
  { key: 'PHARMACY_SERVICE_URL', required: false, placeholder: 'http://localhost:8006' },
  { key: 'ORCHESTRATION_SERVICE_URL', required: false, placeholder: 'http://localhost:8007' },
  { key: 'HL7_GATEWAY_URL', required: false, placeholder: 'http://localhost:8008' },
  
  // Google Cloud Services
  { key: 'GOOGLE_CLOUD_PROJECT', required: false },
  { key: 'GOOGLE_CREDENTIALS', required: false },
  { key: 'HEALTHCARE_DATASET_ID', required: false },
  { key: 'DICOM_STORE_ID', required: false },
  
  // Telehealth Services
  { key: 'GOOGLE_CLIENT_EMAIL', required: false },
  { key: 'GOOGLE_PRIVATE_KEY', required: false },
  { key: 'GOOGLE_CALENDAR_ID', required: false },
  
  // Twilio for SMS/WhatsApp/Voice communications
  { key: 'TWILIO_ACCOUNT_SID', required: false },
  { key: 'TWILIO_AUTH_TOKEN', required: false },
  { key: 'TWILIO_PHONE_NUMBER', required: false },
  { key: 'TWILIO_WHATSAPP_PHONE_NUMBER', required: false },
  
  // AI Speech Services
  { key: 'AZURE_SPEECH_KEY', required: false },
  { key: 'AZURE_SPEECH_REGION', required: false },
  { key: 'COQUI_API_KEY', required: false },
  
  // Third-party APIs
  { key: 'DRUGBANK_API_KEY', required: false },
  
  // Payment Services
  { key: 'MPESA_API_KEY', required: false },
  { key: 'SHIF_API_KEY', required: false },
];

export function validateEnv(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  for (const check of ENV_CHECKS) {
    const value = process.env[check.key];
    const isPlaceholder = check.placeholder && value === check.placeholder;
    const isMissing = !value || isPlaceholder;

    if (isMissing && check.required) {
      warnings.push(`[env] ❌ REQUIRED: ${check.key} is ${isPlaceholder ? 'still a placeholder' : 'not set'}`);
    } else if (isMissing && !check.required) {
      warnings.push(`[env] ⚠️  OPTIONAL: ${check.key} is not configured — feature disabled`);
    }
  }

  return { valid: warnings.filter(w => w.includes('REQUIRED')).length === 0, warnings };
}

/** Call once at startup (e.g., in root layout or instrumentation) */
export function logEnvStatus() {
  if (process.env.NODE_ENV === 'production') {
    const { warnings } = validateEnv();
    warnings.forEach(w => logger.warn(w));
  }
}

/** Whether demo login should be available */
export function isDemoEnabled(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  return process.env.ENABLE_DEMO_LOGIN === 'true';
}
