# Environment Variables Documentation

This document describes all environment variables required for the AfyaHero Pulse application, with a focus on AI features.

## Required Variables

### Core Application
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SESSION_SECRET` - Secret key for session encryption (generate a random string)

## AI Provider Variables

### Primary AI Providers
- `GEMINI_API_KEY` - Google Gemini API key for AI operations
- `OPENAI_API_KEY` - OpenAI API key for GPT models (fallback)
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude models (fallback)
- `DEEPSEEK_API_KEY` - DeepSeek API key (fallback)

### Alternative AI Providers
- `HF_API_KEY` - Hugging Face API key for open-source models
- `GROQ_API_KEY` - Groq API key for fast inference
- `VERTEX_AI_STUDIO_API_KEY` - Google Vertex AI Studio API key

### Google Meet (Teleconsultation)
- `GOOGLE_CLIENT_EMAIL` - Google Workspace service account email
- `GOOGLE_PRIVATE_KEY` - Google Workspace service account private key
- `GOOGLE_CALENDAR_ID` - Google Calendar ID for meeting creation

## Redis (Rate Limiting & Caching)

- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token

### Database
- `DATABASE_URL` - PostgreSQL connection string (Google Cloud SQL)

### Supabase (Legacy)
- `SUPABASE_URL` - Supabase project URL (legacy)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (legacy)

## Optional Variables

### Security
- `FIREWALL_ALLOWED_IPS` - Comma-separated list of allowed IPs for firewall
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `NEXT_PUBLIC_APP_URL` - Application public URL
- `APP_ORIGIN` - Application origin

### Testing
- `TEST_RATE_LIMIT_OVERRIDE_ENABLED` - Set to "1" to disable rate limiting in tests

## AI Provider Cascade Configuration

The AI provider cascade is configured in `src/lib/ai-providers.ts`. The fallback order is:

### For Diagnostic AI
1. Hugging Face (HF)
2. Groq
3. Gemini (Vertex AI)
4. OpenAI
5. Claude (Anthropic)

### For Analytics (DAWA)
1. Hugging Face (HF)
2. Groq
3. Gemini
4. Claude

### For Drug Interactions
1. Hugging Face (HF)
2. Groq
3. Gemini
4. Claude

### For ICD-10 Coding
1. Hugging Face (HF)
2. Groq
3. Gemini

### For Inventory
1. Hugging Face (HF)
2. Groq
3. Gemini

### For Teleconsultation
1. Hugging Face (HF)
2. Groq
3. Gemini
4. Claude

### For Radiology/Pathology
1. Gemini (Vision)
2. Hugging Face (text)
3. Claude

## Rate Limiting Configuration

Rate limits are configured in `src/lib/api-security.ts`:

### Role-Based Limits (requests per minute)
- `super_admin`: 300
- `admin`: 200
- `medical`: 150
- `lab`: 120
- `pharmacy`: 120
- `reception`: 100

### AI-Specific Limits (requests per minute)
- `ai:lab`: 50
- `ai:clinical`: 40
- `ai:documentation`: 60
- `ai:population`: 20
- `ai:heavy`: 30

## Security Considerations

### Sensitive Data
- Never commit API keys to version control
- Use environment-specific configurations
- Rotate API keys regularly
- Use service accounts with minimal permissions

### Data Masking
- Patient data is automatically masked before sending to AI providers
- Masking is configured in `src/lib/data-masking.ts`
- Sensitive fields are defined in `src/lib/input-validation.ts`

## Development vs Production

### Development
- Use test API keys when available
- Enable debug logging
- Use宽松 rate limiting (can override with `TEST_RATE_LIMIT_OVERRIDE_ENABLED`)

### Production
- Use production API keys
- Enable strict rate limiting
- Enable audit logging
- Enable security headers
- Use HTTPS for all connections

## Example .env File

```bash
# Core Application
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SESSION_SECRET=your-secret-key-here

# AI Providers
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
HF_API_KEY=your-huggingface-api-key
GROQ_API_KEY=your-groq-api-key
VERTEX_AI_STUDIO_API_KEY=your-vertex-ai-key

# Google Meet
GOOGLE_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GOOGLE_CALENDAR_ID=primary

# Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Security
FIREWALL_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Validation

Environment variables are validated at startup via `src/lib/env.ts`. The application will fail to start if required variables are missing.

## Monitoring

AI operations are automatically logged to:
- Application logs (via `src/lib/logger.ts`)
- Database audit logs (via `src/lib/ai-audit-logger.ts`)

Monitor:
- AI operation success/failure rates
- Latency metrics
- Rate limit violations
- Error rates by provider
