# Kubernetes Infrastructure Setup for AfyaHero

## Overview

AfyaHero is now configured for production-grade Kubernetes deployment with **auto-scaling**, **high availability**, and **comprehensive monitoring**.

## 🎯 What's Included

### Scaling Infrastructure ✅
- [x] HorizontalPodAutoscaler (HPA) - CPU/Memory-based scaling
- [x] VerticalPodAutoscaler (VPA) - Right-sizing resource requests
- [x] Pod Disruption Budgets - High availability during maintenance
- [x] Rolling updates - Zero-downtime deployments
- [x] Multi-replica deployment - Default 3 pods minimum

### High Availability ✅
- [x] Pod anti-affinity rules - Spread pods across nodes
- [x] Readiness probes - Only route traffic to ready pods
- [x] Liveness probes - Restart unhealthy pods
- [x] Startup probes - Allow time to initialize
- [x] Graceful shutdown - 30-second termination grace period

### Security ✅
- [x] Network policies - Restrict pod-to-pod traffic
- [x] RBAC - Least privilege service accounts
- [x] SecurityContext - Non-root user, read-only filesystem
- [x] Pod security policies - Enforce security standards
- [x] Secret management - Externalized sensitive data

### Monitoring & Observability ✅
- [x] Prometheus metrics scraping
- [x] Loki log aggregation integration
- [x] ServiceMonitor for metrics collection
- [x] PrometheusRules for alerting
- [x] Health check endpoints (liveness, readiness, startup)

### Networking ✅
- [x] Ingress controller - External traffic routing
- [x] SSL/TLS termination - HTTPS with cert-manager
- [x] Service mesh ready - Can be extended with Istio/Linkerd
- [x] Rate limiting - NGINX ingress rate limiting
- [x] CORS configuration - Cross-origin requests

---

## 📋 File Structure

```
k8s/
├── 01-namespace.yaml           # Create afyahero namespace
├── 02-configmap.yaml           # Non-sensitive configuration
├── 03-secrets.yaml             # Sensitive data template
├── 04-deployment.yaml          # Main application deployment + PDB
├── 05-service.yaml             # Kubernetes services
├── 06-hpa.yaml                 # Auto-scaling configuration (HPA + VPA)
├── 07-ingress.yaml             # Ingress + NetworkPolicy + TLS
├── 08-rbac.yaml                # Role-based access control
├── 09-monitoring.yaml          # Prometheus + Loki configuration
├── health-checks.ts            # Health check implementation
└── KUBERNETES_SETUP.md         # This file
```

---

## 🚀 Quick Start

### 1. Prerequisites

You need:
- Kubernetes cluster (1.24+) with at minimum 3 nodes
- `kubectl` configured to access your cluster
- Docker image pushed to registry
- cert-manager installed (for HTTPS)
- NGINX Ingress Controller installed
- Prometheus Operator (for monitoring)

### 2. Prepare Environment

Create a secret with your sensitive data:

```bash
# Create .env.k8s file with your secrets
cat > .env.k8s << 'EOF'
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-key-here
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
JWT_SECRET=generate-random-string
NEXTAUTH_SECRET=generate-random-string
EOF

# Create the secret in Kubernetes
kubectl create secret generic afyahero-secrets \
  --from-env-file=.env.k8s \
  -n afyahero \
  --dry-run=client \
  -o yaml | kubectl apply -f -
```

### 3. Deploy to Kubernetes

```bash
# Create namespace and ConfigMap
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml

# Create secrets (use your prepared secret)
kubectl apply -f k8s/03-secrets.yaml

# Deploy application, services, and auto-scaling
kubectl apply -f k8s/04-deployment.yaml
kubectl apply -f k8s/05-service.yaml
kubectl apply -f k8s/06-hpa.yaml

# Configure networking and RBAC
kubectl apply -f k8s/07-ingress.yaml
kubectl apply -f k8s/08-rbac.yaml

# Enable monitoring
kubectl apply -f k8s/09-monitoring.yaml
```

### 4. Verify Deployment

```bash
# Check deployment status
kubectl get deployment afyahero -n afyahero
kubectl get pods -n afyahero
kubectl get svc -n afyahero

# Watch rollout progress
kubectl rollout status deployment/afyahero -n afyahero

# Check HPA status
kubectl get hpa -n afyahero
kubectl describe hpa afyahero-hpa -n afyahero

# View logs
kubectl logs -n afyahero -l app=afyahero --all-containers=true -f

# Test health endpoints
kubectl port-forward svc/afyahero 3000:80 -n afyahero
curl http://localhost:3000/api/health/ready
```

---

## 🔄 Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

```yaml
# Default configuration from 06-hpa.yaml:
minReplicas: 3     # Always run at least 3 pods
maxReplicas: 20    # Maximum 20 pods to control costs

# Scaling triggers:
- CPU > 70%        # Scale up when CPU usage exceeds 70%
- Memory > 80%     # Scale up when memory exceeds 80%
- Requests > 1000/sec per pod
```

**Scale up behavior:**
- Aggressive: Double replicas when under load
- Up to 4 pods added per minute

**Scale down behavior:**
- Conservative: Remove 50% of excess pods
- Wait 5 minutes before scaling down
- Max 2 pods removed per minute

### Monitor Scaling Activity

```bash
# Watch HPA in action
kubectl get hpa afyahero-hpa -n afyahero --watch

# Get HPA details
kubectl describe hpa afyahero-hpa -n afyahero

# View HPA events
kubectl get events -n afyahero --sort-by='.lastTimestamp' | grep HPA
```

---

## 📊 Health Checks

### Probe Configuration

| Probe | Path | Purpose | Timeout | Frequency |
|-------|------|---------|---------|-----------|
| **Startup** | `/api/health/startup` | Allow container to initialize | 3s | Every 10s (30 retries) |
| **Readiness** | `/api/health/ready` | Can receive traffic? | 3s | Every 5s (2 failures to remove) |
| **Liveness** | `/api/health/live` | Container still running? | 5s | Every 10s (3 failures to restart) |

### Implement Health Checks

Add health check endpoints to your Next.js app:

```bash
# Copy health check implementation
cp k8s/health-checks.ts src/app/api/health/route.ts

# Then update the route to match your actual dependencies
```

---

## 🔐 Security & RBAC

### Service Account Permissions

The AfyaHero service account has minimal permissions:
- Read pods (for service discovery)
- Read ConfigMaps (for configuration)
- Read Secrets (for application secrets)

### Network Policies

Traffic restrictions:
- ✅ Ingress controller → pods on port 3000
- ✅ Prometheus → pods on port 9090 (metrics)
- ✅ Pod-to-pod communication
- ✅ Egress: DNS (port 53)
- ✅ Egress: HTTPS to external services (port 443)
- ✅ Egress: PostgreSQL (port 5432) to Supabase
- ✅ Egress: Redis (port 6379) to Upstash

### HTTPS/TLS

Configuration:
- **Issuer:** Let's Encrypt (automatic renewal)
- **Domains:** afyahero.com, api.afyahero.com, fhir.afyahero.com
- **Managed by:** cert-manager
- **Auto-renewal:** Every 90 days

```bash
# Check certificate status
kubectl get certificate -n afyahero
kubectl describe certificate afyahero-tls -n afyahero
```

---

## 📈 Monitoring

### Metrics

Prometheus scrapes metrics from `/metrics` endpoint on port 9090.

**Key metrics to monitor:**
- `http_requests_total` — Total requests
- `http_request_duration_seconds` — Request latency
- `http_request_size_bytes` — Request payload size
- `http_response_size_bytes` — Response payload size
- `container_cpu_usage_seconds_total` — CPU usage
- `container_memory_usage_bytes` — Memory usage

### Alerts

PrometheusRules defined in `09-monitoring.yaml`:
- **AfyaHeroCPUHigh** — CPU > 80% for 5 minutes
- **AfyaHeroMemoryHigh** — Memory > 1.5GB
- **AfyaHeroPodRestarts** — Frequent restarts
- **AfyaHeroReplicaMismatch** — Desired ≠ actual replicas
- **AfyaHeroHighLatency** — 95th percentile latency > 1s
- **AfyaHeroHighErrorRate** — Error rate > 5%

### Logging

Logs are shipped to Loki via Promtail:
- All container logs collected
- JSON parsing for structured logs
- Labels: job, app, pod, namespace

```bash
# View logs from Loki
kubectl logs -n afyahero -l app=afyahero --tail=100 -f
```

---

## 🆚 Resource Requirements

### Pod Resource Requests
```yaml
requests:
  cpu: 250m (25% of 1 CPU)
  memory: 512Mi
limits:
  cpu: 1000m (1 full CPU)
  memory: 2Gi
```

**3 pods minimum = total resources:**
- CPU: 750m requested (3GB/4GB typical node)
- Memory: 1.5Gi requested (typical 8GB node)

### Node Requirements

Recommended for production cluster:
- **3+ nodes** (for high availability)
- **4+ CPU per node** (for running multiple pods)
- **8GB+ RAM per node**
- **SSD storage** (for database volumes, if needed)

---

## 📝 Customization

### Scale Up Maximum Replicas

Edit `06-hpa.yaml`:
```yaml
spec:
  maxReplicas: 50  # Increase from 20
```

Then apply:
```bash
kubectl apply -f k8s/06-hpa.yaml
```

### Adjust Resource Limits

Edit `04-deployment.yaml`:
```yaml
resources:
  requests:
    cpu: "500m"    # Increase from 250m
    memory: "1Gi"  # Increase from 512Mi
  limits:
    cpu: "2000m"   # Increase from 1000m
    memory: "4Gi"  # Increase from 2Gi
```

Then apply:
```bash
kubectl apply -f k8s/04-deployment.yaml
kubectl rollout status deployment/afyahero -n afyahero
```

### Change Scaling Threshold

Edit `06-hpa.yaml`:
```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50  # Scale at 50% instead of 70%
```

### Add More Replicas at Minimum

Edit `06-hpa.yaml`:
```yaml
spec:
  minReplicas: 5  # Increase from 3
```

---

## 🔧 Operations

### Deploy New Version

```bash
# Update image in deployment
kubectl set image deployment/afyahero \
  afyahero-api=afyahero.azurecr.io/afyahero:v1.2.0 \
  -n afyahero

# Watch rollout
kubectl rollout status deployment/afyahero -n afyahero

# Rollback if needed
kubectl rollout undo deployment/afyahero -n afyahero
```

### Scale Manually (overrides HPA)

```bash
# Scale to 5 replicas
kubectl scale deployment afyahero --replicas=5 -n afyahero

# Note: HPA will adjust after a few minutes
# To use manual scaling, disable HPA:
kubectl delete hpa afyahero-hpa -n afyahero
```

### View Recent Events

```bash
# Show recent deployment events
kubectl describe deployment afyahero -n afyahero

# Show recent pod events
kubectl get events -n afyahero --sort-by='.lastTimestamp'

# Monitor specific pod
kubectl describe pod afyahero-xxxxx -n afyahero
```

### Debug Failing Pod

```bash
# Get pod logs
kubectl logs pod-name -n afyahero

# Get previous logs (if pod restarted)
kubectl logs pod-name -n afyahero --previous

# Execute command in running pod
kubectl exec -it pod-name -n afyahero -- /bin/sh

# Get detailed pod information
kubectl describe pod pod-name -n afyahero
```

---

## 📊 Monitoring & Troubleshooting

### Check Pod Status

```bash
# Get all pods
kubectl get pods -n afyahero

# Get pod details
kubectl describe pod pod-name -n afyahero

# Check pod events
kubectl get events -n afyahero --field-selector involvedObject.name=pod-name
```

### Check Scaling Status

```bash
# Current HPA metrics
kubectl get hpa afyahero-hpa -n afyahero

# HPA detailed metrics
kubectl describe hpa afyahero-hpa -n afyahero

# Manual pod count check
kubectl get pods -n afyahero --no-headers | wc -l
```

### View Resource Usage

```bash
# Pod CPU/Memory usage
kubectl top pods -n afyahero

# Node resource usage
kubectl top nodes

# Monitor over time
kubectl top pods -n afyahero --containers --sort-by=name
```

### Check Service Endpoints

```bash
# Verify service endpoints are available
kubectl get endpoints afyahero -n afyahero

# Verify service discovery
kubectl exec -it pod-name -n afyahero -- nslookup afyahero.afyahero.svc.cluster.local
```

---

## 🚨 Common Issues & Solutions

### Pods Stuck in Pending

```bash
# Check node resources
kubectl top nodes

# Check node availability
kubectl get nodes

# Check pod events for details
kubectl describe pod pod-name -n afyahero

# Solution: Add more nodes or increase node capacity
```

### High Pod Restart Rate

```bash
# Check logs
kubectl logs pod-name -n afyahero --previous

# Check liveness probe
kubectl get pod pod-name -n afyahero -o yaml | grep -A 20 livenessProbe

# Increase probe thresholds in deployment.yaml
```

### Pod Not Receiving Traffic

```bash
# Check readiness probe
kubectl logs pod-name -n afyahero | grep "ready"

# Test health endpoint
kubectl exec -it pod-name -n afyahero -- curl http://localhost:3000/api/health/ready

# Check service endpoints
kubectl get endpoints afyahero -n afyahero
```

### Not Scaling Up

```bash
# Check HPA metrics
kubectl get hpa afyahero-hpa -n afyahero
kubectl describe hpa afyahero-hpa -n afyahero

# Check metrics availability
kubectl top pods -n afyahero

# Verify metrics-server is running
kubectl get deployment metrics-server -n kube-system
```

---

## 📚 Best Practices

✅ **Always use resource requests/limits** — For proper scheduling and scaling
✅ **Implement health checks** — For intelligent traffic routing
✅ **Use StatefulSets for data** — If you need persistent storage
✅ **Monitor metrics & logs** — For early problem detection
✅ **Test scaling locally** — Using minikube or kind
✅ **Plan capacity** — Based on peak traffic projections
✅ **Use PodDisruptionBudgets** — For high availability
✅ **Automate deployments** — Using GitOps (ArgoCD, Flux)

---

## 📖 Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [HPA Best Practices](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Pod Disruption Budgets](https://kubernetes.io/docs/tasks/run-application/configure-pdb/)
- [Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [NGINX Ingress](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager](https://cert-manager.io/)

---

## ✅ Deployment Checklist

- [ ] Cluster created with 3+ nodes
- [ ] Certificate manager installed
- [ ] NGINX Ingress controller installed
- [ ] Prometheus Operator installed
- [ ] Secrets prepared and configured
- [ ] Docker image built and pushed to registry
- [ ] All YAML manifests reviewed
- [ ] Health check endpoints implemented
- [ ] Deployment applied: `kubectl apply -f k8s/`
- [ ] Health checks passing: `curl http://localhost:3000/api/health/ready`
- [ ] Ingress working: `curl https://afyahero.com`
- [ ] Monitoring active: Check Prometheus dashboard
- [ ] HPA active: `kubectl get hpa` shows your deployment
- [ ] Load test running to verify auto-scaling

---

**AfyaHero is now production-ready with enterprise-grade Kubernetes infrastructure!** 🎉
