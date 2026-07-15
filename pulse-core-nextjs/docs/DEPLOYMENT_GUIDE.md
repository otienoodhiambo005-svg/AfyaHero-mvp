# AfyaHero Deployment Guide

This guide covers deploying the AfyaHero platform to production.

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+ and poetry
- PostgreSQL 14+ (Google Cloud SQL recommended)
- Redis (Upstash recommended)
- Supabase account
- Domain name with SSL certificate

## Environment Variables

### Required Variables

```bash
# Core Infrastructure
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SESSION_SECRET=your-session-secret-min-32-chars

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_URL_SYNC=postgresql://user:password@host:port/database

# AI Providers (optional but recommended)
OPENROUTER_API_KEY=your-openrouter-key
HF_API_KEY=your-huggingface-key
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
DEEPSEEK_API_KEY=your-deepseek-key
VERTEX_AI_STUDIO_API_KEY=your-vertex-key

# Redis (for rate limiting and caching)
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Gateway Configuration
SECRET_KEY=your-secret-key-min-32-chars
PII_ENCRYPTION_KEY=your-32-byte-encryption-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENVIRONMENT=production
```

### Optional Variables

```bash
# Twilio for communications
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone
TWILIO_WHATSAPP_PHONE_NUMBER=your-whatsapp-phone

# Azure Speech Services
AZURE_SPEECH_KEY=your-azure-speech-key
AZURE_SPEECH_REGION=your-azure-region

# Google Meet Integration
GOOGLE_CLIENT_EMAIL=your-google-service-account
GOOGLE_PRIVATE_KEY=your-google-private-key
GOOGLE_CALENDAR_ID=your-calendar-id

# Development
ENABLE_DEMO_LOGIN=true
NODE_ENV=development
```

## Database Setup

### 1. Create PostgreSQL Database

Using Google Cloud SQL:
```bash
# Create instance
gcloud sql instances create afyahero-prod \
  --database-version=POSTGRES_14 \
  --tier=db-custom-2-8192 \
  --region=us-central1

# Create database
gcloud sql databases create afyahero --instance=afyahero-prod
```

### 2. Run Prisma Migrations

```bash
cd pulse-core-nextjs
npx prisma generate
npx prisma migrate deploy
```

### 3. Seed Initial Data

```bash
npx prisma db seed
```

## Frontend Deployment (Next.js)

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
cd pulse-core-nextjs
vercel --prod
```

4. **Configure Environment Variables**
- Go to Vercel dashboard
- Project Settings → Environment Variables
- Add all required variables from above

### Option 2: Docker

1. **Build Docker Image**
```bash
cd pulse-core-nextjs
docker build -t afyahero-frontend .
```

2. **Run Container**
```bash
docker run -p 3003:3003 \
  -e NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
  -e SESSION_SECRET=$SESSION_SECRET \
  afyahero-frontend
```

### Option 3: Node.js with PM2

1. **Install Dependencies**
```bash
cd pulse-core-nextjs
npm ci
npm run build
```

2. **Install PM2**
```bash
npm i -g pm2
```

3. **Start Application**
```bash
pm2 start npm --name "afyahero" -- start
pm2 save
pm2 startup
```

## Standalone Super Admin Deployment

Deploy the same `pulse-core-nextjs` app as a dedicated superadmin control plane by setting:

```bash
AFYAHERO_APP_MODE=superadmin
NEXT_PUBLIC_APP_URL=https://superadmin.afyahero.com
```

In this mode:
- `/` and generic auth routes redirect to `/auth/superadmin/login`
- only superadmin portal routes remain accessible
- non-superadmin APIs are blocked by middleware policy

### Docker Compose (Optional Profile)

```bash
# Starts dedicated superadmin service on :3004
docker compose --profile superadmin up -d superadmin-web
```

### Kubernetes

The `k8s/` manifests include dedicated resources for standalone superadmin:
- `Deployment`: `afyahero-superadmin`
- `Service`: `afyahero-superadmin`
- `HPA`: `afyahero-superadmin-hpa`
- `Ingress host`: `superadmin.afyahero.com`

Apply as usual:

```bash
kubectl apply -f k8s/
```

## Gateway Deployment (Python FastAPI)

### Option 1: Kubernetes (Recommended for Production)

1. **Build Docker Image**
```bash
cd gateway
docker build -t afyahero-gateway .
```

2. **Push to Container Registry**
```bash
docker tag afyahero-gateway gcr.io/your-project/afyahero-gateway
docker push gcr.io/your-project/afyahero-gateway
```

3. **Deploy to Kubernetes**
```bash
kubectl apply -f k8s/gateway-deployment.yaml
kubectl apply -f k8s/gateway-service.yaml
```

### Option 2: Docker Compose

```bash
cd gateway
docker-compose up -d
```

### Option 3: Gunicorn with Systemd

1. **Install Dependencies**
```bash
cd gateway
poetry install
```

2. **Create Systemd Service**
```ini
[Unit]
Description=AfyaHero Gateway
After=network.target

[Service]
Type=notify
User=afyahero
WorkingDirectory=/opt/afyahero/gateway
Environment="PATH=/opt/afyahero/gateway/.venv/bin"
ExecStart=/opt/afyahero/gateway/.venv/bin/gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000 main:app

[Install]
WantedBy=multi-user.target
```

3. **Start Service**
```bash
sudo systemctl enable afyahero-gateway
sudo systemctl start afyahero-gateway
```

## Redis Setup (Upstash)

1. **Create Upstash Redis Database**
- Go to https://upstash.com
- Create new Redis database
- Copy REST URL and REST token

2. **Configure Environment Variables**
```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

```bash
sudo certbot certonly --standalone -d api.afyahero.com
sudo certbot certonly --standalone -d app.afyahero.com
```

### Configure Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name api.afyahero.com;

    ssl_certificate /etc/letsencrypt/live/api.afyahero.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.afyahero.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name app.afyahero.com;

    ssl_certificate /etc/letsencrypt/live/app.afyahero.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.afyahero.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Application Monitoring

Set up monitoring for:
- API response times
- Error rates
- Database connection pool
- Redis hit rates
- AI provider response times

### Log Aggregation

Recommended tools:
- Datadog
- New Relic
- Grafana + Prometheus
- Cloud Logging (Google Cloud)

### Health Checks

Configure health check endpoints:
- Frontend: `GET /health`
- Gateway: `GET /health`

Add to load balancer health checks.

## Backup Strategy

### Database Backups

- **Daily automated backups** (Google Cloud SQL automated)
- **Point-in-time recovery** (7-day retention)
- **Cross-region replication** (optional)

### Redis Backups

- Upstash provides automatic backups
- Configure backup retention policy

### File Backups

- Back up static assets to cloud storage
- Document backup and restore procedures

## Scaling Strategy

### Horizontal Scaling

- **Frontend:** Use Vercel or Kubernetes HPA
- **Gateway:** Use Kubernetes HPA with metrics server
- **Database:** Use read replicas for read-heavy workloads

### Vertical Scaling

- Monitor CPU and memory usage
- Scale based on metrics
- Consider auto-scaling for production

## Security Hardening

### Production Checklist

- [ ] All environment variables set
- [ ] SSL/TLS configured
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] API authentication required
- [ ] Database encryption at rest
- [ ] PII encryption enabled
- [ ] Audit logging enabled
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Secrets managed securely (e.g., AWS Secrets Manager)

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Check DATABASE_URL is correct
- Verify database is accessible
- Check firewall rules

**AI Provider Errors**
- Verify API keys are set
- Check provider status pages
- Review cascade fallback logs

**Rate Limiting Issues**
- Adjust rate limit thresholds
- Check Redis connection
- Review rate limit logs

### Getting Help

- Check logs: `journalctl -u afyahero-gateway -f`
- Review application logs in dashboard
- Check status page: https://status.afyahero.com
- Contact support: support@afyahero.com

## Rollback Procedure

### Frontend Rollback

```bash
# Vercel
vercel rollback --prod

# Docker
docker stop afyahero-frontend
docker run -p 3003:3003 afyahero-frontend:previous-tag
```

### Gateway Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/afyahero-gateway

# Docker
docker stop afyahero-gateway
docker run -p 8000:8000 afyahero-gateway:previous-tag
```

### Database Rollback

```bash
# Using Prisma
npx prisma migrate resolve --applied "migration_name"
npx prisma migrate deploy
```

## Maintenance Windows

Schedule maintenance during low-traffic periods:
- Recommended: 2:00 AM - 4:00 AM local time
- Notify users 24 hours in advance
- Use maintenance mode page
- Test rollback procedures before maintenance

## Performance Optimization

### Database Optimization

- Add indexes for frequently queried fields
- Use connection pooling
- Optimize slow queries
- Consider read replicas

### Caching Strategy

- Cache API responses where appropriate
- Use Redis for session storage
- Implement CDN for static assets
- Cache AI responses where possible

### CDN Configuration

- Configure CDN for static assets
- Enable compression
- Set appropriate cache headers
- Use image optimization

## Post-Deployment Checklist

- [ ] Verify all services are running
- [ ] Test authentication flow
- [ ] Test key API endpoints
- [ ] Verify database connectivity
- [ ] Check Redis connection
- [ ] Test offline functionality
- [ ] Verify SSL/TLS certificates
- [ ] Check monitoring dashboards
- [ ] Verify rate limiting
- [ ] Test AI provider cascade
- [ ] Verify audit logging
- [ ] Load test with moderate traffic
- [ ] Document deployment

## Support and Maintenance

- **Monitoring:** 24/7 monitoring configured
- **Alerting:** Critical alerts to on-call team
- **Backup verification:** Weekly backup verification
- **Security updates:** Monthly security patching
- **Performance reviews:** Quarterly performance reviews
