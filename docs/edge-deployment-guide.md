# Edge Deployment Guide for AfyaHero AI Services

## Overview

This guide covers deploying AfyaHero AI services on edge devices (tablets, local servers) for offline operation using ONNX Runtime and quantized AI models.

---

## Prerequisites

### Hardware Requirements

**Minimum (Tablet/Small Device)**:
- CPU: ARM64 or x86-64, 4 cores
- RAM: 6GB minimum (4GB OS + 2GB for models)
- Storage: 8GB SSD (for models + database)
- Network: Optional (for sync when available)

**Recommended (Local Server)**:
- CPU: x86-64, 8+ cores
- RAM: 16GB (8GB for models + 8GB for database)
- Storage: 32GB SSD
- Network: Optional

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Python 3.11+ (for local development)
- Linux (Ubuntu 22.04+ recommended) or Windows 11

---

## Installation

### Step 1: Download and Quantize Models

Run the model setup script to download and prepare AI models:

```bash
cd c:\AFYAHEROnextJS

# Install dependencies for model setup
pip install torch transformers onnx onnxruntime huggingface-hub

# Download and setup all models
python scripts/setup-offline-models.py --model all --models-dir models

# Or setup individual models
python scripts/setup-offline-models.py --model triage --models-dir models
python scripts/setup-offline-models.py --model diagnosis --models-dir models
python scripts/setup-offline-models.py --model embeddings --models-dir models
```

This will:
- Download models from HuggingFace
- Convert to ONNX format (if needed)
- Apply 4-bit/8-bit quantization
- Validate models with ONNX Runtime
- Save to `models/` directory

### Step 2: Build Edge Docker Image

```bash
cd services/ai-triage

# Build edge image
docker build -f Dockerfile.edge -t afyahero/ai-triage-edge:latest .

# Or build for specific architecture
docker buildx build --platform linux/amd64 -f Dockerfile.edge -t afyahero/ai-triage-edge:latest .
docker buildx build --platform linux/arm64 -f Dockerfile.edge -t afyahero/ai-triage-edge:latest .
```

### Step 3: Prepare Model Bundle

Create a model bundle to include with the edge image:

```bash
# Create models tarball
cd c:\AFYAHEROnextJS
tar -czf models-bundle.tar.gz models/

# Verify size
ls -lh models-bundle.tar.gz
# Should be ~5-6GB compressed
```

### Step 4: Deploy to Edge Device

#### Option A: Docker Compose (Recommended)

Create `docker-compose.edge.yml` on the edge device:

```yaml
version: '3.8'

services:
  ai-triage:
    image: afyahero/ai-triage-edge:latest
    container_name: afyahero-triage
    ports:
      - "8001:8001"
    volumes:
      - ./models:/models:ro
      - ./logs:/app/logs
    environment:
      - OFFLINE_MODE=true
      - MODELS_DIR=/models
      - PORT=8001
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:8001/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Deploy:

```bash
# Copy image and models to edge device
scp afyahero/ai-triage-edge:latest user@edge-device:/tmp/
scp models-bundle.tar.gz user@edge-device:/tmp/

# On edge device
docker load < /tmp/afyahero-triage-edge:latest.tar
mkdir -p models logs
tar -xzf /tmp/models-bundle.tar.gz -C models/

# Start service
docker-compose -f docker-compose.edge.yml up -d
```

#### Option B: Direct Docker Run

```bash
# On edge device
docker run -d \
  --name afyahero-triage \
  -p 8001:8001 \
  -v $(pwd)/models:/models:ro \
  -v $(pwd)/logs:/app/logs \
  -e OFFLINE_MODE=true \
  -e MODELS_DIR=/models \
  -e PORT=8001 \
  --restart unless-stopped \
  afyahero/ai-triage-edge:latest
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OFFLINE_MODE` | `false` | Enable offline mode (no cloud calls) |
| `MODELS_DIR` | `/models` | Directory containing ONNX models |
| `PORT` | `8001` | Service port |
| `LOG_LEVEL` | `INFO` | Logging level |

### Model Configuration

Edit `models/model-config.json` (create if needed):

```json
{
  "triage": {
    "model_path": "/models/triage/phi-3-mini-4bit.onnx",
    "enabled": true,
    "fallback_to_cloud": false
  },
  "diagnosis": {
    "model_path": "/models/diagnosis/mistral-7b-4bit.onnx",
    "enabled": true,
    "fallback_to_cloud": false
  },
  "embeddings": {
    "model_path": "/models/embeddings/clinical-bert-8bit.onnx",
    "enabled": true,
    "fallback_to_cloud": false
  }
}
```

---

## Verification

### Check Service Health

```bash
# Health check
curl http://localhost:8001/health

# Expected response:
{
  "status": "healthy",
  "service": "ai-triage-service",
  "version": "1.0.0",
  "offline_mode": true,
  "model_loaded": true,
  "models": {
    "onnx_available": true,
    "triage_loaded": true,
    "diagnosis_loaded": true,
    "formulary_loaded": true,
    "offline_mode": true
  }
}
```

### Test Triage Inference

```bash
curl -X POST http://localhost:8001/triage/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "TEST-001",
    "patientAge": 35,
    "patientGender": "female",
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
  }'
```

### Check Logs

```bash
# View logs
docker logs afyahero-triage -f

# Or check log files
tail -f logs/ai-triage.log
```

---

## Performance Tuning

### CPU Optimization

ONNX Runtime automatically uses CPU optimizations. To verify:

```python
import onnxruntime as ort

# Check available execution providers
print(ort.get_available_providers())
# Should show ['CPUExecutionProvider']

# Check optimization level
session = ort.InferenceSession("model.onnx")
print(session.get_providers())
```

### Memory Optimization

If experiencing memory issues:

1. **Reduce batch size** in inference calls
2. **Use smaller models** (Phi-3 Mini instead of Mistral 7B)
3. **Increase swap space** on the device:
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### Inference Speed

To improve inference speed:

1. **Enable parallel execution**:
   ```python
   session_options = ort.SessionOptions()
   session_options.intra_op_num_threads = 4  # Use 4 CPU threads
   session_options.inter_op_num_threads = 2
   ```

2. **Use smaller context window** for tokenization
3. **Cache tokenized inputs** for repeated queries

---

## Troubleshooting

### Model Not Loading

**Symptom**: `model_loaded: false` in health check

**Solutions**:
1. Check model file exists:
   ```bash
   ls -lh /models/triage/
   ```

2. Check file permissions:
   ```bash
   chmod 644 /models/triage/*.onnx
   ```

3. Validate ONNX model:
   ```bash
   python -c "import onnxruntime as ort; ort.InferenceSession('/models/triage/phi-3-mini-4bit.onnx')"
   ```

4. Check logs for errors:
   ```bash
   docker logs afyahero-triage
   ```

### Out of Memory Errors

**Symptom**: Service crashes or OOM in logs

**Solutions**:
1. Reduce model quantization (use 4-bit instead of 8-bit)
2. Disable unused models in config
3. Increase device RAM or swap
4. Reduce concurrent requests

### Slow Inference

**Symptom**: Requests taking > 5 seconds

**Solutions**:
1. Check CPU usage: `top`
2. Verify ONNX Runtime optimizations are enabled
3. Reduce input sequence length
4. Use smaller model (Phi-3 instead of Mistral)

### Network Sync Issues

**Symptom**: Data not syncing when online

**Solutions**:
1. Check network connectivity
2. Verify sync service is running
3. Check firewall rules
4. Review sync logs

---

## Updates and Maintenance

### Model Updates

To update models:

1. Download new models on development machine:
   ```bash
   python scripts/setup-offline-models.py --model all
   ```

2. Create new model bundle:
   ```bash
   tar -czf models-bundle-v2.tar.gz models/
   ```

3. Deploy to edge device:
   ```bash
   scp models-bundle-v2.tar.gz user@edge-device:/tmp/
   ssh user@edge-device
   docker stop afyahero-triage
   rm -rf /path/to/models/*
   tar -xzf /tmp/models-bundle-v2.tar.gz -C /path/to/models/
   docker start afyahero-triage
   ```

### Service Updates

To update the service code:

1. Build new image:
   ```bash
   docker build -f Dockerfile.edge -t afyahero/ai-triage-edge:v2 .
   ```

2. Deploy to edge device:
   ```bash
   docker save afyahero/ai-triage-edge:v2 | ssh user@edge-device 'docker load'
   ssh user@edge-device 'docker stop afyahero-triage && docker rm afyahero-triage'
   ssh user@edge-device 'docker run -d --name afyahero-triage [same options] afyahero/ai-triage-edge:v2'
   ```

### Monitoring

Set up monitoring for edge devices:

```bash
# Check service status
docker ps

# Check resource usage
docker stats afyahero-triage

# Check disk usage
df -h

# Check model sizes
du -sh /models/*
```

---

## Security

### Model Encryption

To encrypt model weights at rest:

1. Encrypt model files:
   ```bash
   gpg --symmetric --cipher-algo AES256 models/triage/phi-3-mini-4bit.onnx
   ```

2. Update service to decrypt at startup (requires GPG key)

### Access Control

1. Restrict Docker socket access:
   ```bash
   sudo chmod 660 /var/run/docker.sock
   sudo chown root:docker /var/run/docker.sock
   ```

2. Use non-root containers:
   ```dockerfile
   # Add to Dockerfile
   RUN useradd -m -u 1000 afyahero
   USER afyahero
   ```

3. Network isolation:
   ```yaml
   # In docker-compose.edge.yml
   networks:
     default:
       internal: true
   ```

---

## Backup and Recovery

### Backup Configuration

```bash
# Backup models
tar -czf models-backup-$(date +%Y%m%d).tar.gz models/

# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz docker-compose.edge.yml

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

### Recovery

```bash
# Restore models
tar -xzf models-backup-YYYYMMDD.tar.gz -C /

# Restore configuration
tar -xzf config-backup-YYYYMMDD.tar.gz -C /

# Restart service
docker-compose -f docker-compose.edge.yml restart
```

---

## Performance Benchmarks

Expected performance on edge hardware:

| Hardware | Model | Inference Time | RAM Usage |
|----------|-------|----------------|-----------|
| Intel i5 (4 cores) | Phi-3 Mini (4-bit) | ~500ms | 2GB |
| Intel i5 (4 cores) | Mistral 7B (4-bit) | ~1.2s | 4GB |
| ARM Cortex-A72 (4 cores) | Phi-3 Mini (4-bit) | ~800ms | 2GB |
| ARM Cortex-A72 (4 cores) | Mistral 7B (4-bit) | ~2.0s | 4GB |

---

## Support

For issues or questions:
- Check logs: `docker logs afyahero-triage`
- Verify health: `curl http://localhost:8001/health`
- Review this guide
- Contact AfyaHero support team
