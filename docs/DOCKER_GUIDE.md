# Docker Guide for AfyaHero

This guide covers using Docker to develop, test, and deploy the AfyaHero platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Docker Commands](#docker-commands)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- At least 4GB RAM available for Docker
- 10GB free disk space

### Installation

**macOS:**
```bash
brew install docker docker-compose
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

**Windows:**
- Download Docker Desktop from https://www.docker.com/products/docker-desktop
- Install and restart

---

## Development Setup

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/your-org/afyahero.git
cd afyahero
```

2. **Configure environment variables**
```bash
# Copy example environment files
cp pulse-core-nextjs/.env.example pulse-core-nextjs/.env.local
cp gateway/.env.example gateway/.env
```

3. **Start development environment**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

4. **Access services**
- Frontend: http://localhost:3003
- Gateway: http://localhost:8000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Development Workflow

#### Running in Development Mode

The development docker-compose uses volume mounts for hot-reloading:

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start specific service
docker-compose -f docker-compose.dev.yml up web

# Start in detached mode
docker-compose -f docker-compose.dev.yml up -d
```

#### Viewing Logs

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f web
docker-compose -f docker-compose.dev.yml logs -f gateway
```

#### Rebuilding Services

```bash
# Rebuild after code changes
docker-compose -f docker-compose.dev.yml build web
docker-compose -f docker-compose.dev.yml up -d web

# Rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache web
```

#### Running Tests

```bash
# Run frontend tests in container
docker-compose -f docker-compose.dev.yml exec web npm test

# Run gateway tests in container
docker-compose -f docker-compose.dev.yml exec gateway pytest
```

#### Database Operations

```bash
# Access PostgreSQL
docker-compose -f docker-compose.dev.yml exec db psql -U afyahero afyahero_dev

# Run Prisma migrations
docker-compose -f docker-compose.dev.yml exec web npx prisma migrate dev

# Seed database
docker-compose -f docker-compose.dev.yml exec web npx prisma db seed
```

---

## Production Setup

### Quick Start

1. **Configure production environment variables**
```bash
# Create production environment files
cp pulse-core-nextjs/.env.example pulse-core-nextjs/.env.production
cp gateway/.env.example gateway/.env.production

# Edit with production values
nano pulse-core-nextjs/.env.production
nano gateway/.env.production
```

2. **Build and start production containers**
```bash
docker-compose up -d
```

3. **Verify services are healthy**
```bash
docker-compose ps
```

### Production Architecture

The production docker-compose includes:

- **PostgreSQL**: Persistent database with health checks
- **Redis**: Persistent caching with LRU eviction
- **Gateway**: FastAPI backend with health checks
- **Web**: Next.js frontend with health checks
- **Celery Worker**: Background job processing
- **Nginx**: Reverse proxy with SSL termination

### Scaling Services

#### Horizontal Scaling

```bash
# Scale web service to 3 instances
docker-compose up -d --scale web=3

# Scale gateway to 2 instances
docker-compose up -d --scale gateway=2
```

#### Resource Limits

Add to docker-compose.yml:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### SSL/TLS Configuration

1. **Generate SSL certificates** (Let's Encrypt):
```bash
sudo certbot certonly --standalone -d api.afyahero.com
sudo certbot certonly --standalone -d app.afyahero.com
```

2. **Copy certificates to nginx directory**
```bash
sudo cp /etc/letsencrypt/live/api.afyahero.com/fullchain.pem nginx/ssl/api.crt
sudo cp /etc/letsencrypt/live/api.afyahero.com/privkey.pem nginx/ssl/api.key
sudo cp /etc/letsencrypt/live/app.afyahero.com/fullchain.pem nginx/ssl/app.crt
sudo cp /etc/letsencrypt/live/app.afyahero.com/privkey.pem nginx/ssl/app.key
```

3. **Configure nginx** (nginx/nginx.conf):
```nginx
server {
    listen 443 ssl http2;
    server_name api.afyahero.com;

    ssl_certificate /etc/nginx/ssl/api.crt;
    ssl_certificate_key /etc/nginx/ssl/api.key;

    location / {
        proxy_pass http://gateway:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name app.afyahero.com;

    ssl_certificate /etc/nginx/ssl/app.crt;
    ssl_certificate_key /etc/nginx/ssl/app.key;

    location / {
        proxy_pass http://web:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Docker Commands

### Container Management

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Stop container
docker stop afyahero-web

# Start container
docker start afyahero-web

# Restart container
docker restart afyahero-web

# Remove container
docker rm afyahero-web

# Remove all stopped containers
docker container prune
```

### Image Management

```bash
# List images
docker images

# Build image
docker build -t afyahero-web:latest ./pulse-core-nextjs

# Tag image
docker tag afyahero-web:latest afyahero-web:v1.0.0

# Push to registry
docker push afyahero-web:latest

# Remove image
docker rmi afyahero-web:latest

# Remove dangling images
docker image prune
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect afyahero_postgres_data

# Remove volume
docker volume rm afyahero_postgres_data

# Remove unused volumes
docker volume prune
```

### Network Management

```bash
# List networks
docker network ls

# Inspect network
docker network inspect afyahero-net

# Create network
docker network create afyahero-custom-net

# Remove network
docker network rm afyahero-custom-net
```

### Logs and Debugging

```bash
# View container logs
docker logs afyahero-web

# Follow logs
docker logs -f afyahero-web

# View last 100 lines
docker logs --tail 100 afyahero-web

# View logs with timestamps
docker logs -t afyahero-web

# Execute command in container
docker exec -it afyahero-web sh

# Copy file from container
docker cp afyahero-web:/app/package.json .

# Copy file to container
docker cp package.json afyahero-web:/app/
```

### Health Checks

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' afyahero-web

# View health check logs
docker inspect --format='{{json .State.Health}}' afyahero-web | jq
```

---

## Troubleshooting

### Container Won't Start

**Symptoms:**
- Container exits immediately
- Error in logs
- Port conflicts

**Solutions:**

1. **Check logs**
```bash
docker logs afyahero-web
```

2. **Check port conflicts**
```bash
netstat -ano | findstr :3003  # Windows
lsof -i :3003  # macOS/Linux
```

3. **Check environment variables**
```bash
docker exec afyahero-web env
```

### Database Connection Issues

**Symptoms:**
- Connection refused
- Timeout errors
- Authentication failures

**Solutions:**

1. **Check database is running**
```bash
docker-compose ps db
```

2. **Test connection**
```bash
docker-compose exec db psql -U afyahero -c "SELECT 1"
```

3. **Check DATABASE_URL**
```bash
docker-compose exec gateway env | grep DATABASE_URL
```

### Out of Disk Space

**Symptoms:**
- Build failures
- Volume errors
- No space left on device

**Solutions:**

1. **Clean up unused resources**
```bash
docker system prune -a
```

2. **Remove old volumes**
```bash
docker volume prune
```

3. **Check disk usage**
```bash
docker system df
```

### Slow Build Times

**Symptoms:**
- Docker builds taking too long
- Rebuilding unchanged code

**Solutions:**

1. **Use BuildKit**
```bash
DOCKER_BUILDKIT=1 docker-compose build
```

2. **Leverage layer caching**
- Order Dockerfile commands from least to most frequently changing
- Use .dockerignore to exclude unnecessary files

3. **Use multi-stage builds**
- Already implemented in Dockerfiles

### Memory Issues

**Symptoms:**
- Containers getting killed
- OOM errors
- System slowdown

**Solutions:**

1. **Check container memory usage**
```bash
docker stats
```

2. **Increase Docker memory limit**
- Docker Desktop → Settings → Resources → Memory
- Increase to at least 4GB

3. **Limit container memory**
```yaml
services:
  web:
    mem_limit: 2g
```

### Network Issues

**Symptoms:**
- Containers can't communicate
- DNS resolution failures
- Connection timeouts

**Solutions:**

1. **Check network connectivity**
```bash
docker-compose exec web ping gateway
```

2. **Recreate network**
```bash
docker-compose down
docker-compose up -d
```

3. **Check DNS**
```bash
docker-compose exec web cat /etc/resolv.conf
```

---

## Best Practices

### Development

1. **Use docker-compose.dev.yml for local development**
2. **Leverage volume mounts for hot-reloading**
3. **Keep database data in volumes for persistence**
4. **Use .dockerignore to speed up builds**
5. **Run tests in containers for consistency**

### Production

1. **Use specific version tags for images**
2. **Never run as root in containers**
3. **Use health checks for all services**
4. **Limit container resources**
5. **Use secrets management for sensitive data**
6. **Enable logging drivers for centralized logging**
7. **Use read-only filesystems where possible**

### Security

1. **Scan images for vulnerabilities**
```bash
docker scan afyahero-web:latest
```

2. **Use non-root users**
- Already implemented in Dockerfiles

3. **Keep images updated**
```bash
docker pull postgres:15-alpine
```

4. **Use secrets management**
- Docker Secrets or external secret managers

5. **Network isolation**
- Use separate networks for different service tiers

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Docker Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build frontend image
        run: docker build -t afyahero-web:${{ github.sha }} ./pulse-core-nextjs
      
      - name: Build gateway image
        run: docker build -t afyahero-gateway:${{ github.sha }} ./gateway
      
      - name: Login to registry
        run: docker login -u ${{ secrets.REGISTRY_USER }} -p ${{ secrets.REGISTRY_PASSWORD }}
      
      - name: Push images
        run: |
          docker push afyahero-web:${{ github.sha }}
          docker push afyahero-gateway:${{ github.sha }}
```

---

## Monitoring

### Container Metrics

```bash
# Real-time metrics
docker stats

# Specific container
docker stats afyahero-web
```

### Log Aggregation

Configure logging driver in docker-compose.yml:

```yaml
services:
  web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Health Monitoring

```bash
# Check all services health
docker-compose ps
```

---

## Backup and Restore

### Database Backup

```bash
# Backup database
docker-compose exec db pg_dump -U afyahero afyahero > backup.sql

# Restore database
docker-compose exec -T db psql -U afyahero afyahero < backup.sql
```

### Volume Backup

```bash
# Backup volume
docker run --rm -v afyahero_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volume
docker run --rm -v afyahero_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

---

## Performance Optimization

### Image Size Reduction

1. **Use alpine base images** (already implemented)
2. **Multi-stage builds** (already implemented)
3. **Combine RUN commands**
4. **Remove unnecessary dependencies**

### Build Cache Optimization

1. **Order Dockerfile commands strategically**
2. **Use .dockerignore effectively**
3. **Leverage BuildKit cache mounts**

### Runtime Performance

1. **Use appropriate resource limits**
2. **Enable health checks**
3. **Use connection pooling**
4. **Implement caching strategies**

---

## Support

For Docker-related issues:
- Docker Documentation: https://docs.docker.com
- Docker Compose Documentation: https://docs.docker.com/compose
- AfyaHero Support: support@afyahero.com
