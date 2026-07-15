# AI Triage Service

Patient triage and priority scoring microservice for AfyaHero Hospital OS.

## Features

- AI-powered triage using consensus ensemble of multiple models
- PEWS (Paediatric Early Warning Score) for patients < 18
- MOEWS (Modified Obstetric Early Warning Score) for pregnant patients
- FHIR-compliant output
- Offline support with ONNX models

## API Endpoints

### POST /triage/analyze
Full triage analysis with consensus ensemble.

**Request:**
```json
{
  "patientId": "PAT-001",
  "patientAge": 35,
  "patientGender": "female",
  "isPregnant": false,
  "chiefComplaint": "Severe headache for 2 days",
  "vitals": {
    "temperature": 37.5,
    "heartRate": 88,
    "respiratoryRate": 18,
    "systolicBP": 120,
    "diastolicBP": 80,
    "spO2": 98,
    "consciousness": "alert"
  }
}
```

**Response:**
```json
{
  "priority": 3,
  "priorityLabel": "Urgent (Yellow) - Serious condition",
  "confidence": 0.85,
  "reasoning": "AI-generated reasoning...",
  "consensusDetails": {
    "model1": { "priority": 3, "provider": "gemini", ... },
    "model2": { "priority": 3, "provider": "openai", ... },
    "model3": { "priority": 3, "provider": "anthropic", ... },
    "agreement": "unanimous"
  },
  "alerts": [],
  "recommendedActions": ["Assess within 30-60 minutes"],
  "requiresImmediateReview": false
}
```

### POST /triage/priority-score
Quick priority score (simplified).

### POST /triage/symptom-extraction
Extract structured symptoms from chief complaint.

### GET /health
Health check endpoint.

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## Running with Docker

```bash
# Build image
docker build -t afyahero/ai-triage-service .

# Run container
docker run -p 8001:8001 afyahero/ai-triage-service
```

## Environment Variables

- `PORT`: Service port (default: 8001)
- `OFFLINE_MODE`: Enable offline mode (default: false)
- `MODEL_LOADED`: Whether AI models are loaded (default: false)
- `GEMINI_API_KEY`: Google Gemini API key
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key

## AI Models

### Primary Models
- BioGPT (HuggingFace)
- Med-PaLM 2 (Google)

### Offline Models
- Quantized LLaMA 3-8B (ONNX)

### Fallback Models
- Gemini Flash
- GPT-4o-mini
- Claude Sonnet

## FHIR Compliance

All outputs are FHIR R4 compliant:
- `Observation` resource for triage scores
- `Condition` resource for extracted symptoms
- Standard LOINC and SNOMED CT codes

## Offline Support

When `OFFLINE_MODE=true`, the service uses:
- Local ONNX models for inference
- Cached formulary and drug data
- Queue requests for sync when online

## Monitoring

- Health check: `GET /health`
- Structured JSON logging
- OpenTelemetry tracing (optional)

## Development Status

- [x] Basic FastAPI service structure
- [x] Request/response models
- [x] Health check endpoint
- [ ] AI model integration (cascade from ai-providers.ts)
- [ ] PEWS/MOEWS calculation logic
- [ ] FHIR output schemas
- [ ] ONNX model integration for offline
- [ ] LangChain integration for workflows
