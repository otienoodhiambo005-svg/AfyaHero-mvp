# Offline AI Models Selection for AfyaHero

## Overview

This document defines the lightweight AI models selected for offline deployment on edge devices (tablets, local servers) for triage, formulary lookup, and basic diagnosis.

---

## Selection Criteria

- **Model Size**: < 4GB when quantized (suitable for tablets with 8GB RAM)
- **Inference Speed**: < 2 seconds per request on edge hardware
- **Accuracy**: Acceptable clinical performance (≥ 85% on relevant benchmarks)
- **License**: Open-source or permissive commercial license
- **Format**: ONNX compatible for cross-platform deployment
- **Hardware**: Runs on CPU (no GPU required for edge devices)

---

## Selected Models

### 1. Triage Model

**Primary Choice**: Phi-3 Mini (3.8B parameters)

**Reasoning**:
- Extremely small footprint (1.5GB quantized to 4-bit)
- Strong performance on clinical reasoning tasks
- Optimized by Microsoft for edge deployment
- Supports ONNX export out-of-the-box
- Good multilingual support (important for African context)

**Specifications**:
- **Parameters**: 3.8B
- **Quantization**: 4-bit (INT4) via ONNX Runtime
- **Model Size**: ~1.5GB
- **Inference Time**: ~500ms on CPU (Intel i5)
- **License**: MIT (permissive)
- **Source**: https://huggingface.co/microsoft/Phi-3-mini-128k-instruct-onnx

**Alternative**: LLaMA 3.2-3B (if Phi-3 unavailable)

---

### 2. Diagnosis Model

**Primary Choice**: Mistral 7B (quantized)

**Reasoning**:
- Good balance between size and performance
- Strong clinical knowledge when fine-tuned
- Well-supported in ONNX ecosystem
- Good reasoning capabilities for differential diagnosis

**Specifications**:
- **Parameters**: 7B
- **Quantization**: 4-bit (INT4) via ONNX Runtime
- **Model Size**: ~3.5GB
- **Inference Time**: ~1.2s on CPU (Intel i5)
- **License**: Apache 2.0
- **Source**: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3

**Alternative**: LLaMA 3.1-8B (if Mistral unavailable)

**Clinical Fine-tuning**: Will require fine-tuning on:
- African clinical case data
- Local disease patterns (malaria, TB, typhoid)
- Regional treatment guidelines

---

### 3. Formulary Lookup (Embedding Model)

**Primary Choice**: ClinicalBERT (small version)

**Reasoning**:
- Specialized for clinical text
- Very small footprint (400MB)
- Good for semantic search of drug information
- Pre-trained on clinical notes and drug labels

**Specifications**:
- **Parameters**: 110M (BERT-base)
- **Quantization**: 8-bit (INT8)
- **Model Size**: ~400MB
- **Inference Time**: ~50ms per embedding
- **License**: Apache 2.0
- **Source**: https://huggingface.co/emilyalsentzer/Bio_ClinicalBERT

**Usage**:
- Generate embeddings for drug descriptions
- Semantic search in local drug database
- Drug name normalization and matching

**Alternative**: All-MiniLM-L6-v2 (general purpose, smaller)

---

## Deployment Architecture

### Hardware Requirements

**Minimum (Tablet)**:
- CPU: ARM64 or x86-64, 4 cores
- RAM: 6GB (4GB for OS + 2GB for models)
- Storage: 8GB (for models + database)
- Network: Optional (for sync when available)

**Recommended (Local Server)**:
- CPU: x86-64, 8 cores
- RAM: 16GB (8GB for models + 8GB for database)
- Storage: 32GB SSD
- Network: Optional

---

## Model Storage Structure

```
/models/
├── triage/
│   ├── phi-3-mini-4bit.onnx
│   ├── tokenizer.json
│   └── config.json
├── diagnosis/
│   ├── mistral-7b-4bit.onnx
│   ├── tokenizer.json
│   └── config.json
└── embeddings/
    ├── clinical-bert-8bit.onnx
    └── tokenizer.json
```

---

## Quantization Strategy

### Triage Model (Phi-3 Mini)
- **Quantization**: 4-bit (INT4)
- **Tool**: ONNX Runtime quantization API
- **Accuracy Impact**: < 2% degradation
- **Memory Savings**: 75% reduction (6GB → 1.5GB)

### Diagnosis Model (Mistral 7B)
- **Quantization**: 4-bit (INT4)
- **Tool**: ONNX Runtime quantization API
- **Accuracy Impact**: < 3% degradation
- **Memory Savings**: 75% reduction (14GB → 3.5GB)

### Embedding Model (ClinicalBERT)
- **Quantization**: 8-bit (INT8)
- **Tool**: ONNX Runtime quantization API
- **Accuracy Impact**: < 1% degradation
- **Memory Savings**: 50% reduction (800MB → 400MB)

---

## Inference Pipeline

### Triage Inference
```
Input: Patient symptoms + vitals
  ↓
Tokenization (Phi-3 tokenizer)
  ↓
ONNX Runtime inference (4-bit quantized)
  ↓
Priority score extraction
  ↓
PEWS/MOEWS calculation (rule-based)
  ↓
Output: Priority level + reasoning
```

### Diagnosis Inference
```
Input: Symptoms + history + lab results
  ↓
Tokenization (Mistral tokenizer)
  ↓
ONNX Runtime inference (4-bit quantized)
  ↓
ICD-10 code extraction
  ↓
Differential diagnosis ranking
  ↓
Output: Top 3 diagnoses + confidence
```

### Formulary Lookup
```
Input: Drug name or description
  ↓
Embedding generation (ClinicalBERT)
  ↓
Vector similarity search (local FAISS index)
  ↓
Drug information retrieval
  ↓
Output: Drug details + availability
```

---

## Fallback Strategy

When offline models fail or produce low-confidence results:

1. **Triage**: Fall back to rule-based PEWS/MOEWS scoring
2. **Diagnosis**: Fall back to symptom-to-diagnosis lookup table
3. **Formulary**: Fall back to exact string matching in database

All fallbacks queue the request for cloud processing when connectivity resumes.

---

## Model Update Strategy

### Initial Deployment
- Download quantized models from HuggingFace
- Validate inference on edge hardware
- Cache models locally

### Updates
- Monthly model re-quantization from latest versions
- Delta updates (only changed weights)
- Sync via mesh network when online
- Version rollback capability

---

## Performance Benchmarks (Target)

| Metric | Triage (Phi-3) | Diagnosis (Mistral) | Embeddings (ClinicalBERT) |
|--------|----------------|---------------------|----------------------------|
| Model Size | 1.5GB | 3.5GB | 400MB |
| Inference Time (CPU) | 500ms | 1.2s | 50ms |
| RAM Usage | 2GB | 4GB | 500MB |
| Accuracy (vs Cloud) | 92% | 88% | 95% |
| Battery Impact (Tablet) | Low | Medium | Low |

---

## Implementation Steps

### Phase 1: Model Acquisition
1. Download Phi-3 Mini ONNX from HuggingFace
2. Download Mistral 7B ONNX from HuggingFace
3. Download ClinicalBERT ONNX from HuggingFace
4. Quantize models to target precision
5. Validate model integrity

### Phase 2: Integration
1. Create ONNX Runtime inference wrappers
2. Integrate with triage service
3. Integrate with diagnosis service
4. Integrate with pharmacy service
5. Add offline mode detection

### Phase 3: Testing
1. Unit test each model inference
2. Integration test with services
3. Performance benchmarking on edge hardware
4. Accuracy validation against cloud models

### Phase 4: Deployment
1. Package models with services
2. Deploy to edge devices
3. Set up sync mechanism
4. Monitor performance

---

## Security Considerations

- Model weights encrypted at rest
- Model signing for integrity verification
- No patient data sent for model updates
- Local inference only (no cloud calls in offline mode)
- Audit trail of all AI decisions

---

## Compliance

- **Kenya Data Protection Act**: Patient data never leaves device in offline mode
- **Model Licensing**: All selected models have permissive licenses
- **Clinical Safety**: All AI decisions require clinician review
- **Audit Trail**: All offline inferences logged locally and synced when online

---

## Cost Analysis

### Model Development
- **Fine-tuning**: $0 (use pre-trained models initially)
- **Quantization**: $0 (ONNX Runtime is free)
- **Validation**: $500-1000 (clinical review time)

### Deployment
- **Edge Hardware**: $300-500 per tablet/server
- **Storage**: $0 (use existing local storage)
- **Bandwidth**: Minimal (only for model updates)

### Ongoing
- **Model Updates**: $0 (download from HuggingFace)
- **Maintenance**: Low (automated updates)

---

## References

- Phi-3 Mini: https://huggingface.co/microsoft/Phi-3-mini-128k-instruct-onnx
- Mistral 7B: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3
- ClinicalBERT: https://huggingface.co/emilyalsentzer/Bio_ClinicalBERT
- ONNX Runtime: https://onnxruntime.ai/
- Quantization Guide: https://onnxruntime.ai/docs/performance/quantization.html
