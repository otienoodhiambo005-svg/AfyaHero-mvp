# Kubernetes Deployment Quick Start

## ✅ What's Included

AfyaHero now has **production-grade Kubernetes infrastructure** with:

- **Auto-scaling** (3-20 replicas based on CPU/memory)
- **High availability** (pod anti-affinity, health probes, PDB)
- **Security** (RBAC, NetworkPolicy, non-root user, read-only FS)
- **Ingress** (TLS termination, rate limiting, CORS)
- **Monitoring** (Prometheus, Loki, alerts)
- **Observability** (health checks, logs, metrics)

## 🚀 Quick Deploy (5 minutes)

### 1. Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/windows/amd64/kubectl.exe"

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### 2. Prepare Environment

```bash
# Create secrets from your environment variables
cat > .env.k8s << 'EOF'
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-key
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
JWT_SECRET=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
EOF

# Create the secret in Kubernetes
kubectl create secret generic afyahero-secrets \
  --from-env-file=.env.k8s \
  -n afyahero \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 3. Deploy

```bash
# Create all resources
kubectl apply -f k8s/

# Verify deployment
kubectl get deployment -n afyahero
kubectl get pods -n afyahero
kubectl get svc -n afyahero

# Watch rollout
kubectl rollout status deployment/afyahero -n afyahero
```

### 4. Test

```bash
# Port-forward to test locally
kubectl port-forward svc/afyahero 3000:80 -n afyahero

# In another terminal, test health endpoints
curl http://localhost:3000/api/health/ready
curl http://localhost:3000/fapi/health/live

# Access via Ingress (after DNS is configured)
curl https://afyahero.com/api/health/ready
```

## 📋 File Structure

| File | Purpose |
|------|---------|
| `k8s/01-namespace.yaml` | Kubernetes namespace isolation |
| `k8s/02-configmap.yaml` | 40+ configuration parameters |
| `k8s/03-secrets.yaml` | Sensitive data template |
| `k8s/04-deployment.yaml` | Main app deployment + health probes + PDB |
| `k8s/05-service.yaml` | 3 Kubernetes services |
| `k8s/06-hpa.yaml` | Auto-scaling (HPA) + resource right-sizing (VPA) |
| `k8s/07-ingress.yaml` | TLS termination + routing + NetworkPolicy |
| `k8s/08-rbac.yaml` | Service accounts and permissions |
| `k8s/09-monitoring.yaml` | Prometheus + Loki configuration |
| `k8s/health-checks.ts` | Health endpoint implementation |
| `KUBERNETES_SETUP.md` | Complete documentation |

## 🔄 Auto-Scaling behavior

```
Minimum replicas:    3  (always running for HA)
Maximum replicas:    20 (cost ceiling)

Scale up when:
  - CPU > 70%
  - Memory > 80%
  - Requests > 1000/sec per pod

Scale up behavior:   Aggressive (double replicas per 15 seconds)
Scale down behavior: Conservative (remove 50% every 60 sec, wait 5 min)
```

## 📊 Monitoring

```bash
# View Prometheus metrics
kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# View logs in Loki
kubectl port-forward svc/loki 3100:3100 -n loki

# View pod metrics
kubectl top pods -n afyahero

# View HPA status
kubectl get hpa -n afyahero
kubectl describe hpa afyahero-hpa -n afyahero
```

## 🔐 Health Checks

Three endpoints for Kubernetes probes:

| Endpoint | Purpose | Timeout | Period |
|----------|---------|---------|--------|
| `/api/health/startup` | Is container initialized? | 3s | 10s (30 retries) |
| `/api/health/ready` | Can pod receive traffic? | 3s | 5s (2 failures to remove) |
| `/api/health/live` | Is container still running? | 5s | 10s (3 failures to restart) |

## 📝 Customization Examples

### Scale to 50 pods maximum

```bash
# Edit HPA
kubectl patch hpa afyahero-hpa -n afyahero --type='json' \
  -p='[{"op": "replace", "path": "/spec/maxReplicas", "value":50}]'
```

### Increase resource limits

```bash
# Update deployment
kubectl set resources deployment/afyahero -n afyahero \
  --requests=cpu=500m,memory=1Gi \
  --limits=cpu=2000m,memory=4Gi

# Trigger rollout (traffic continues during deployment)
kubectl rollout status deployment/afyahero -n afyahero
```

### Scale manually

```bash
# Set concrete replicacount (disables HPA)
kubectl scale deployment afyahero --replicas=10 -n afyahero

# Re-enable HPA
kubectl delete hpa afyahero-hpa -n afyahero
kubectl apply -f k8s/06-hpa.yaml
```

## 🆘 Troubleshooting

### Pods not starting

```bash
# Check events
kubectl describe pod <pod-name> -n afyahero

# Check logs
kubectl logs <pod-name> -n afyahero

# Check startup probe
kubectl get pod <pod-name> -n afyahero -o yaml | grep -A 20 startupProbe
```

### Not scaling up

```bash
# Check HPA status
kubectl describe hpa afyahero-hpa -n afyahero

# Check metrics
kubectl top pods -n afyahero

# Verify metrics-server running
kubectl get deployment metrics-server -n kube-system
```

### Ingress not working

```bash
# Check ingress status
kubectl get ingress -n afyahero
kubectl describe ingress afyahero-ingress -n afyahero

# Check TLS certificate
kubectl get certificate -n afyahero
kubectl describe certificate afyahero-tls -n afyahero

# Check NGINX controller
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=100
```

## 📚 Next Steps

1. **Verify deployment** — Run `npm run verify:kubernetes` to check all configs
2. **Test scaling** — Load test to trigger HPA scaling
3. **Monitor** — Set up dashboards in Prometheus/Grafana
4. **Enable logging** — Configure Loki for centralized logs
5. **Setup CI/CD** — Integrate with ArgoCD or Flux for GitOps

## ✅ Deployment Checklist

- [ ] Cluster ready (3+ nodes)
- [ ] cert-manager installed
- [ ] NGINX Ingress installed
- [ ] Prometheus Operator installed (for monitoring)
- [ ] Secrets configured
- [ ] Docker image built and pushed
- [ ] `kubectl apply -f k8s/` successful
- [ ] Pods running: `kubectl get pods -n afyahero`
- [ ] Services healthy: `kubectl get svc -n afyahero`
- [ ] HPA active: `kubectl get hpa -n afyahero`
- [ ] Health checks passing: `curl http://localhost:3000/api/health/ready`
- [ ] Ingress working: `curl https://afyahero.com`

## 🎉 You're Done!

AfyaHero is now production-ready with enterprise-grade Kubernetes infrastructure.

For complete documentation, see: [KUBERNETES_SETUP.md](KUBERNETES_SETUP.md)
