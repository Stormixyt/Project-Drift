#!/usr/bin/env pwsh
# Project Drift - P2P Matchmaking Startup Script
# This script starts all services needed for P2P matchmaking

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Project Drift - P2P Matchmaking System" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot

# Step 1: Check if Docker is running
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop first!" -ForegroundColor Red
    exit 1
}

# Step 2: Start Redis (if not already running)
Write-Host "`n[2/5] Starting Redis..." -ForegroundColor Yellow
$redisRunning = docker ps --filter "name=project-drift-redis" --format "{{.Names}}"
if ($redisRunning -eq "project-drift-redis") {
    Write-Host "✓ Redis already running" -ForegroundColor Green
} else {
    Write-Host "Starting Redis container..." -ForegroundColor Cyan
    docker run -d --name project-drift-redis -p 6379:6379 redis:7-alpine
    Start-Sleep -Seconds 2
    Write-Host "✓ Redis started on port 6379" -ForegroundColor Green
}

# Step 3: Check if PostgreSQL is needed (optional for matchmaking)
Write-Host "`n[3/5] Checking PostgreSQL..." -ForegroundColor Yellow
$pgRunning = docker ps --filter "name=project-drift-postgres" --format "{{.Names}}"
if ($pgRunning -eq "project-drift-postgres") {
    Write-Host "✓ PostgreSQL already running" -ForegroundColor Green
} else {
    Write-Host "PostgreSQL not running (optional for basic P2P)" -ForegroundColor Gray
    Write-Host "  Tip: Run docker-compose.dev.yml for full stack" -ForegroundColor Gray
}

# Step 4: Create .env file if it doesn't exist
Write-Host "`n[4/5] Checking environment configuration..." -ForegroundColor Yellow
$envFile = Join-Path $projectRoot "matchmaking\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env file..." -ForegroundColor Cyan
    @"
# Project Drift Matchmaking Service Configuration
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL Configuration (optional for P2P)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_drift
DB_USER=drift_user
DB_PASSWORD=drift_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Logging
LOG_LEVEL=info
"@ | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "✓ Created .env file" -ForegroundColor Green
} else {
    Write-Host "✓ .env file exists" -ForegroundColor Green
}

# Step 5: Start Matchmaking Service
Write-Host "`n[5/5] Starting Matchmaking Service..." -ForegroundColor Yellow
Write-Host "Change directory to matchmaking and run: npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Quick Start Commands:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start Matchmaking Service:" -ForegroundColor White
Write-Host "   cd matchmaking" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start Launcher:" -ForegroundColor White
Write-Host "   cd launcher" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test P2P:" -ForegroundColor White
Write-Host "   - Import a Fortnite build in launcher" -ForegroundColor Gray
Write-Host "   - Go to 'Servers' tab and click 'Hosting Settings'" -ForegroundColor Gray
Write-Host "   - Configure your server name and options" -ForegroundColor Gray
Write-Host "   - Launch game from Library" -ForegroundColor Gray
Write-Host "   - Server auto-registers and appears in Servers list!" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Services Status:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Redis:       http://localhost:6379" -ForegroundColor White
Write-Host "Matchmaking: http://localhost:3001" -ForegroundColor White
Write-Host "Launcher:    Electron app (npm run dev)" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop services" -ForegroundColor Yellow
Write-Host ""

# Keep script running and monitor Redis
Write-Host "Monitoring Redis connection..." -ForegroundColor Cyan
Write-Host "Waiting for matchmaking service to start..." -ForegroundColor Gray
Write-Host ""
Write-Host "Open a new terminal and run:" -ForegroundColor Yellow
Write-Host "  cd matchmaking && npm run dev" -ForegroundColor Cyan
Write-Host ""

# Wait for user to press Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 5
    }
} finally {
    Write-Host "`n`nStopping services..." -ForegroundColor Yellow
    # Don't auto-stop Redis in case user wants to keep it running
    Write-Host "Redis container 'project-drift-redis' is still running" -ForegroundColor Gray
    Write-Host "To stop it manually: docker stop project-drift-redis" -ForegroundColor Gray
}
