# Project Drift - Local Development Startup Script (PowerShell)
# This script starts all services required for local development

Write-Host "`n🎮 Project Drift - Starting Local Development Environment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "docker\postgres" | Out-Null
New-Item -ItemType Directory -Force -Path "docker\coturn" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Write-Host "✅ Directories created" -ForegroundColor Green
Write-Host ""

# Pull latest images
Write-Host "📦 Pulling Docker images..." -ForegroundColor Yellow
docker-compose pull
Write-Host "✅ Images pulled" -ForegroundColor Green
Write-Host ""

# Build services
Write-Host "🔨 Building services..." -ForegroundColor Yellow
docker-compose build
Write-Host "✅ Services built" -ForegroundColor Green
Write-Host ""

# Start services
Write-Host "🚀 Starting services..." -ForegroundColor Yellow
docker-compose up -d
Write-Host "✅ Services started" -ForegroundColor Green
Write-Host ""

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check service health
Write-Host ""
Write-Host "📊 Service Status:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
docker-compose ps
Write-Host ""

# Display access information
Write-Host "✅ All services are running!" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor Cyan
Write-Host "  🌐 Admin Dashboard:      http://localhost:3000" -ForegroundColor White
Write-Host "  🔌 Matchmaking API:      http://localhost:8080" -ForegroundColor White
Write-Host "  🎯 Game Server:          UDP port 7777" -ForegroundColor White
Write-Host "  📡 TURN Server:          UDP port 3478" -ForegroundColor White
Write-Host "  🗄️  PostgreSQL:           localhost:5432" -ForegroundColor White
Write-Host "  🔴 Redis:                localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "  📝 View all logs:        docker-compose logs -f" -ForegroundColor White
Write-Host "  📝 View specific log:    docker-compose logs -f <service-name>" -ForegroundColor White
Write-Host ""
Write-Host "Shutdown:" -ForegroundColor Cyan
Write-Host "  🛑 Stop all services:    docker-compose down" -ForegroundColor White
Write-Host "  🛑 Stop and remove data: docker-compose down -v" -ForegroundColor White
Write-Host ""
Write-Host "🎮 Happy coding!" -ForegroundColor Cyan
Write-Host ""
