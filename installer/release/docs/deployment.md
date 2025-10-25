# Project Drift - Deployment Guide

## Table of Contents

1. [Local Development](#local-development)
2. [Production Deployment](#production-deployment)
3. [VPS Deployment](#vps-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Security Checklist](#security-checklist)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Git
- Node.js 20+ (optional, for local development without Docker)
- Rust 1.75+ (optional, for local development without Docker)

### Quick Start

```powershell
# Clone repository
git clone https://github.com/yourusername/project-drift.git
cd project-drift

# Copy environment file
cp .env.example .env

# Start all services
.\start-local.ps1

# Or on Linux/macOS
./start-local.sh
```

### Individual Service Development

**Game Server (Rust)**
```bash
cd server
cargo run
```

**Matchmaking Service (Node.js)**
```bash
cd matchmaking
npm install
npm run dev
```

**Admin Dashboard (React)**
```bash
cd admin
npm install
npm run dev
```

---

## Production Deployment

### Environment Preparation

1. **Generate Strong Secrets**
```bash
# JWT Secret (use a secure random string)
openssl rand -base64 32

# PostgreSQL Password
openssl rand -base64 24
```

2. **Update `.env` File**
```bash
cp .env.example .env.production

# Edit .env.production with production values
NODE_ENV=production
JWT_SECRET=<your-generated-secret>
DATABASE_URL=postgres://drift:<password>@db.example.com:5432/drift
REDIS_URL=redis://<password>@redis.example.com:6379
```

3. **TLS Certificates**
```bash
# Use Let's Encrypt for free certificates
certbot certonly --standalone -d api.projectdrift.com
certbot certonly --standalone -d admin.projectdrift.com
```

### Build Docker Images

```bash
# Build all images
docker-compose -f docker-compose.prod.yml build

# Tag for registry
docker tag drift-server:latest registry.example.com/drift-server:latest
docker tag drift-matchmaking:latest registry.example.com/drift-matchmaking:latest
docker tag drift-admin:latest registry.example.com/drift-admin:latest

# Push to registry
docker push registry.example.com/drift-server:latest
docker push registry.example.com/drift-matchmaking:latest
docker push registry.example.com/drift-admin:latest
```

---

## VPS Deployment

### Requirements

- Ubuntu 22.04 LTS or later
- 2+ CPU cores
- 4GB+ RAM
- 50GB+ storage
- Public IP address

### Setup Steps

1. **Install Docker**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

2. **Clone Repository**
```bash
git clone https://github.com/yourusername/project-drift.git
cd project-drift
```

3. **Configure Environment**
```bash
cp .env.example .env
nano .env  # Edit with production values
```

4. **Configure Firewall**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8080/tcp  # Matchmaking API
sudo ufw allow 7777/udp  # Game Server
sudo ufw allow 3478/udp  # TURN Server
sudo ufw enable
```

5. **Start Services**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

6. **Setup Reverse Proxy (Nginx)**
```bash
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/drift

# Add:
server {
    listen 80;
    server_name admin.projectdrift.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.projectdrift.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/drift /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

7. **Setup SSL**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d admin.projectdrift.com -d api.projectdrift.com
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (GKE, EKS, AKS, or self-hosted)
- kubectl configured
- Helm 3

### Deploy

```bash
# Create namespace
kubectl create namespace drift

# Create secrets
kubectl create secret generic drift-secrets \
  --from-literal=jwt-secret=<your-jwt-secret> \
  --from-literal=db-password=<your-db-password> \
  -n drift

# Apply manifests
kubectl apply -f k8s/ -n drift

# Check status
kubectl get pods -n drift
kubectl get services -n drift
```

### Scale

```bash
# Scale game servers
kubectl scale deployment gameserver --replicas=5 -n drift

# Scale matchmaking service
kubectl scale deployment matchmaking --replicas=3 -n drift
```

---

## Security Checklist

### Before Production

- [ ] Change all default passwords
- [ ] Generate new JWT secret (min 32 characters)
- [ ] Enable HTTPS/TLS on all endpoints
- [ ] Configure firewall rules
- [ ] Enable PostgreSQL SSL connections
- [ ] Enable Redis password authentication
- [ ] Set up regular backups
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Review and restrict CORS origins
- [ ] Set up fail2ban for SSH
- [ ] Enable 2FA for admin accounts
- [ ] Configure TURN server credentials
- [ ] Sandbox build execution
- [ ] Enable anti-cheat features

### Network Security

```bash
# PostgreSQL - Allow only from app servers
iptables -A INPUT -p tcp --dport 5432 -s <app-server-ip> -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP

# Redis - Bind to localhost only
redis-cli CONFIG SET bind 127.0.0.1
```

---

## Monitoring

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f gameserver

# Kubernetes
kubectl logs -f deployment/gameserver -n drift
```

### Metrics

Install Prometheus + Grafana:

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

# Install
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

### Health Checks

```bash
# Matchmaking API
curl http://localhost:8080/health

# Check database
docker-compose exec postgres pg_isready

# Check Redis
docker-compose exec redis redis-cli ping
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Restart specific service
docker-compose restart gameserver

# Rebuild and restart
docker-compose up -d --build gameserver
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U drift -d drift

# Check DATABASE_URL format
# Should be: postgres://user:password@host:port/database
```

### Game Server Can't Connect

```bash
# Check UDP port is open
sudo netstat -ulnp | grep 7777

# Test TURN server
turnutils_uclient -v -u drift -w drift123 127.0.0.1
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Limit container memory
docker-compose.yml:
  gameserver:
    mem_limit: 2g
    mem_reservation: 1g
```

### Client Can't Connect

1. Check firewall allows UDP 7777
2. Verify TURN server is accessible
3. Check JWT token is valid
4. Ensure server IP is correct
5. Test with local server first

---

## Backup & Recovery

### Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U drift drift > backup.sql

# Restore
docker-compose exec -T postgres psql -U drift drift < backup.sql
```

### Full Backup

```bash
# Backup volumes
docker run --rm -v drift_postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz /data
```

---

## Performance Tuning

### PostgreSQL

```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;

-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '2GB';
```

### Redis

```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Game Server

```bash
# Increase tick rate (edit .env)
TICK_RATE=120

# Adjust max players
MAX_PLAYERS=200
```

---

**For additional support, see the [README.md](../README.md) or open an issue on GitHub.**
