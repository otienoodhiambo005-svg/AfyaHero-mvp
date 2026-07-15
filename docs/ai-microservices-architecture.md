# AfyaHero AI Microservices Architecture

## Overview

This document defines the microservices architecture for AI model integration in AfyaHero Hospital OS. Each AI model type (triage, diagnosis, imaging, billing, operational) will run as a separate microservice with its own API endpoint, enabling independent scaling, deployment, and maintenance.

---

## Service Architecture

### Service List

| Service | Port | Purpose | Primary Model | Fallback Models |
|---------|------|---------|---------------|----------------|
| **ai-triage-service** | 8001 | Patient triage and priority scoring | BioGPT/Med-PaLM 2 | LLaMA 3, Gemini Flash |
| **ai-diagnosis-service** | 8002 | Clinical diagnosis and differential | Med-PaLM 2, Claude Sonnet | GPT-4o, DeepSeek |
| **ai-imaging-service** | 8003 | Radiology and pathology analysis | Google MedLM Vision | BioMedCLIP |
| **ai-billing-service** | 8004 | Claims processing and automation | Custom ML + OCR | Document AI |
| **ai-operational-service** | 8005 | Patient flow, staffing, inventory predictions | TensorFlow Decision Forests | PyTorch Forecasting |
| **ai-pharmacy-service** | 8006 | Drug interactions, formulary lookup | DrugBank API + LLM | Local drug database |
| **ai-orchestration-service** | 8007 | Workflow coordination (LangChain) | LangChain | - |

---

## Service Communication

### API Gateway Pattern

All services communicate through the FastAPI Gateway (`gateway/`), which:
- Routes requests to appropriate AI services
- Handles authentication and rate limiting
- Implements request/response logging
- Provides unified error handling

### Communication Protocols

- **REST API**: Primary communication (JSON over HTTP)
- **gRPC**: High-performance service-to-service communication (optional for internal services)
- **Message Queue**: Async processing for long-running tasks (RabbitMQ/Kafka)

### Service Discovery

Services register with a service registry (Consul or etcd) for dynamic discovery. For initial implementation, use environment-based configuration.

---

## Service Specifications

### 1. AI Triage Service (`ai-triage-service`)

**Port**: 8001  
**Technology**: FastAPI (Python)  

**API Endpoints**:
```
POST /triage/analyze
POST /triage/priority-score
POST /triage/symptom-extraction
GET /triage/health
```

**Input Schema**:
```json
{
  "patientId": "string",
  "symptoms": ["string"],
  "vitals": {
    "temperature": number,
    "bloodPressure": "string",
    "heartRate": number,
    "respiratoryRate": number
  },
  "chiefComplaint": "string"
}
```

**Output Schema (FHIR Observation)**:
```json
{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "triage-score",
      "display": "Emergency Department Triage Score"
    }]
  },
  "valueInteger": 3,
  "interpretation": {
    "coding": [{
      "system": "http://hl7.org/fhir/v2/0078",
      "code": "U"
    }]
  },
  "note": [{
    "text": "AI-generated triage recommendation"
  }]
}
```

**Models**:
- Primary: BioGPT (HuggingFace)
- Offline: Quantized LLaMA 3-8B (ONNX)
- Fallback: Gemini Flash

**Offline Support**: Yes (triage is critical for offline use)

---

### 2. AI Diagnosis Service (`ai-diagnosis-service`)

**Port**: 8002  
**Technology**: FastAPI (Python)  

**API Endpoints**:
```
POST /diagnosis/analyze
POST /diagnosis/differential
POST /diagnosis/icd10-code
GET /diagnosis/health
```

**Input Schema**:
```json
{
  "patientId": "string",
  "symptoms": ["string"],
  "history": "string",
  "labResults": [{
    "test": "string",
    "value": "string",
    "unit": "string"
  }],
  "medications": ["string"]
}
```

**Output Schema (FHIR Condition)**:
```json
{
  "resourceType": "Condition",
  "clinicalStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
      "code": "active"
    }]
  },
  "verificationStatus": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
      "code": "provisional"
    }]
  },
  "code": {
    "coding": [{
      "system": "http://hl7.org/fhir/sid/icd-10",
      "code": "J18.9",
      "display": "Pneumonia, unspecified"
    }]
  },
  "subject": {
    "reference": "Patient/{patientId}"
  }
}
```

**Models**:
- Primary: Med-PaLM 2 (Google)
- Offline: Distilled Med-PaLM (ONNX)
- Fallback: Claude Sonnet, GPT-4o

**Offline Support**: Yes (basic diagnosis for offline use)

---

### 3. AI Imaging Service (`ai-imaging-service`)

**Port**: 8003  
**Technology**: FastAPI (Python)  

**API Endpoints**:
```
POST /imaging/analyze-xray
POST /imaging/analyze-ct
POST /imaging/analyze-mri
POST /imaging/dicom-import
GET /imaging/health
```

**Input Schema**:
```json
{
  "studyId": "string",
  "modality": "XR|CT|MR",
  "bodyPart": "string",
  "imageUri": "string (Google Cloud Healthcare DICOM store)",
  "clinicalContext": "string"
}
```

**Output Schema (FHIR ImagingStudy + Observation)**:
```json
{
  "resourceType": "ImagingStudy",
  "status": "available",
  "modality": [{
    "coding": [{
      "system": "http://dicom.nema.org/resources/ontology/DCM",
      "code": "CT"
    }]
  }],
  "conclusion": [{
    "text": "AI-generated imaging analysis"
  }]
}
```

**Models**:
- Primary: Google MedLM Vision
- Fallback: BioMedCLIP (HuggingFace)
- Storage: Google Cloud Healthcare API (DICOM)

**Offline Support**: No (requires cloud storage)

---

### 4. AI Billing Service (`ai-billing-service`)

**Port**: 8004  
**Technology**: FastAPI (Python)  

**API Endpoints**:
```
POST /billing/validate-claim
POST /billing/extract-receipt
POST /billing/calculate-copay
POST /billing/shif-submission
GET /billing/health
```

**Input Schema**:
```json
{
  "claimId": "string",
  "patientId": "string",
  "services": [{
    "code": "string",
    "description": "string",
    "amount": number
  }],
  "insuranceProvider": "SHIF",
  "receiptImageUri": "string (optional)"
}
```

**Output Schema (FHIR Claim)**:
```json
{
  "resourceType": "Claim",
  "status": "active",
  "type": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/claim-type",
      "code": "institutional"
    }]
  },
  "insurance": [{
    "coverage": {
      "reference": "Coverage/{coverageId}"
    }
  }],
  "item": [{
    "sequence": 1,
    "productOrService": {
      "coding": [{
        "system": "http://snomed.info/sct",
        "code": "string"
      }]
    }
  }]
}
```

**Models**:
- Primary: Custom ML model (scikit-learn/XGBoost)
- OCR: Google Document AI
- Fallback: Rule-based validation

**Offline Support**: Partial (validation works offline, OCR requires cloud)

---

### 5. AI Operational Service (`ai-operational-service`)

**Port**: 8005  
**Technology**: FastAPI (Python)  

**API Endpoints**:
```
POST /operational/predict-patient-flow
POST /operational/predict-staffing-needs
POST /operational/predict-inventory
POST /operational/bed-occupancy-forecast
GET /operational/health
```

**Input Schema**:
```json
{
  "hospitalId": "string",
  "timeHorizon": "24h|48h|7d",
  "historicalData": {
    "patientVolume": [number],
    "admissions": [number],
    "discharges": [number]
  }
}
```

**Output Schema**:
```json
{
  "predictions": {
    "patientVolume": number,
    "admissions": number,
    "discharges": number,
    "confidence": number
  },
  "recommendations": ["string"],
  "timestamp": "ISO8601"
}
```

**Models**:
- Primary: TensorFlow Decision Forests
- Fallback: PyTorch Forecasting (Prophet)
- Training: Historical data from PostgreSQL

**Offline Support**: Yes (predictions can run offline with cached models)

---

### 6. AI Pharmacy Service (`ai-pharmacy-service`)

**Port**: 8006  
**Technology**: FastAPI (Python)  

**API Endpoints**:
```
POST /pharmacy/check-drug-interaction
POST /pharmacy/formulary-lookup
POST /pharmacy/dosage-recommendation
GET /pharmacy/health
```

**Input Schema**:
```json
{
  "medications": ["string"],
  "patientAge": number,
  "patientWeight": number,
  "conditions": ["string"]
}
```

**Output Schema (FHIR MedicationRequest)**:
```json
{
  "resourceType": "MedicationRequest",
  "status": "active",
  "intent": "order",
  "medication": {
    "reference": "Medication/{medicationId}"
  },
  "dosageInstruction": [{
    "text": "AI-generated dosage recommendation"
  }]
}
```

**Models**:
- Primary: DrugBank API + LLM
- Offline: Local drug database (PostgreSQL)
- Fallback: Rule-based interaction checker

**Offline Support**: Yes (formulary lookup is critical for offline use)

---

### 7. AI Orchestration Service (`ai-orchestration-service`)

**Port**: 8007  
**Technology**: FastAPI (Python) + LangChain  

**API Endpoints**:
```
POST /orchestrate/workflow
POST /orchestrate/chain
GET /orchestrate/workflow-status/{workflowId}
GET /orchestrate/health
```

**Workflow Examples**:
```json
{
  "workflowType": "triage-to-diagnosis",
  "steps": [
    {
      "service": "ai-triage-service",
      "endpoint": "/triage/analyze",
      "outputKey": "triageResult"
    },
    {
      "service": "ai-diagnosis-service",
      "endpoint": "/diagnosis/differential",
      "inputFrom": "triageResult",
      "outputKey": "diagnosisResult"
    },
    {
      "service": "ai-pharmacy-service",
      "endpoint": "/pharmacy/check-drug-interaction",
      "inputFrom": "diagnosisResult",
      "outputKey": "interactionCheck"
    }
  ]
}
```

**Implementation**: LangChain with custom tools for each service

**Offline Support**: No (requires service communication)

---

## Deployment Architecture

### Development Environment

All services run locally with Docker Compose:

```yaml
services:
  ai-triage-service:
    build: ./services/ai-triage
    ports: ["8001:8001"]
    environment:
      - MODEL_PATH=/models/triage.onnx
      - OFFLINE_MODE=true

  ai-diagnosis-service:
    build: ./services/ai-diagnosis
    ports: ["8002:8002"]

  ai-imaging-service:
    build: ./services/ai-imaging
    ports: ["8003:8003"]
    environment:
      - GOOGLE_CLOUD_PROJECT=afyahero-prod
      - HEALTHCARE_DATASET_ID=afyahero-dataset

  # ... other services
```

### Production Environment

- **Kubernetes**: Each service as a separate deployment
- **Horizontal Pod Autoscaler**: Scale based on CPU/memory/request rate
- **Service Mesh**: Istio for service-to-service communication (optional)
- **Google Cloud Run**: Serverless deployment for individual services (alternative to K8s)

### Edge/Offline Deployment

For offline functionality:
- ONNX Runtime for model inference
- Local PostgreSQL database for formulary/drug data
- Mesh network sync for data synchronization
- Service runs on local hospital server/tablet

---

## Data Flow

### Request Flow

```
Client Request
  ↓
FastAPI Gateway (authentication, rate limiting)
  ↓
Service Router (determine target service)
  ↓
AI Service (model inference)
  ↓
Response (FHIR-compliant)
  ↓
Gateway (logging, audit)
  ↓
Client
```

### Offline Flow

```
Client Request
  ↓
Local AI Service (ONNX models)
  ↓
Local Database (formulary, drug data)
  ↓
Response (cached if available)
  ↓
Queue for sync when online
```

---

## Security & Compliance

### Authentication
- JWT tokens issued by Supabase Auth
- Service-to-service communication with mTLS (production)
- API keys for external services (Google Cloud, DrugBank)

### Data Privacy
- Patient data anonymization before AI processing
- Audit logging for all AI requests
- Compliance with Kenya Data Protection Act (ODPC)

### Model Security
- Model weights encrypted at rest
- Model signing for integrity verification
- Regular security audits of AI services

---

## Monitoring & Observability

### Metrics
- Request latency per service
- Model inference time
- Error rates per provider
- Offline mode activation frequency

### Logging
- Structured JSON logs
- Centralized logging (Google Cloud Logging)
- Audit trail for clinical decisions

### Tracing
- Distributed tracing (OpenTelemetry)
- Request correlation across services
- Performance bottleneck identification

---

## Migration Strategy

### Phase 1: Service Extraction (Week 1-2)
- Extract existing AI routes into separate services
- Set up Docker Compose for local development
- Implement basic health check endpoints

### Phase 2: FHIR Compliance (Week 3-4)
- Convert all AI outputs to FHIR resources
- Implement FHIR validation middleware
- Add HL7 v2 message parsing

### Phase 3: LangChain Integration (Week 5-6)
- Set up orchestration service
- Define workflow templates
- Implement multi-step clinical workflows

### Phase 4: Google Cloud Integration (Week 7-8)
- Integrate Google Cloud Healthcare API
- Set up DICOM storage
- Implement MedLM Vision for imaging

### Phase 5: Offline Support (Week 9-10)
- Select and quantize models for offline use
- Set up ONNX Runtime
- Implement mesh network sync for offline data

### Phase 6: Production Deployment (Week 11-12)
- Kubernetes deployment configuration
- Set up monitoring and alerting
- Load testing and optimization

---

## Next Steps

1. Create service directory structure under `services/`
2. Set up Docker Compose for local development
3. Extract triage service from existing `/api/ai/triage` route
4. Implement FHIR output schemas for all services
5. Install LangChain dependencies for orchestration service
