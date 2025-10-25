#!/bin/bash

# Project Drift - Local Development Startup Script
# This script starts all services required for local development

set -e

echo "🎮 Project Drift - Starting Local Development Environment"
echo "=========================================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose is not installed. Please install it and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p docker/postgres
mkdir -p docker/coturn
mkdir -p logs
echo "✅ Directories created"
echo ""

# Pull latest images
echo "📦 Pulling Docker images..."
docker-compose pull
echo "✅ Images pulled"
echo ""

# Build services
echo "🔨 Building services..."
docker-compose build
echo "✅ Services built"
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose up -d
echo "✅ Services started"
echo ""

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo ""
echo "📊 Service Status:"
echo "==================="
docker-compose ps
echo ""

# Display access information
echo "✅ All services are running!"
echo ""
echo "Access Points:"
echo "  🌐 Admin Dashboard:      http://localhost:3000"
echo "  🔌 Matchmaking API:      http://localhost:8080"
echo "  🎯 Game Server:          UDP port 7777"
echo "  📡 TURN Server:          UDP port 3478"
echo "  🗄️  PostgreSQL:           localhost:5432"
echo "  🔴 Redis:                localhost:6379"
echo ""
echo "Logs:"
echo "  📝 View all logs:        docker-compose logs -f"
echo "  📝 View specific log:    docker-compose logs -f <service-name>"
echo ""
echo "Shutdown:"
echo "  🛑 Stop all services:    docker-compose down"
echo "  🛑 Stop and remove data: docker-compose down -v"
echo ""
echo "🎮 Happy coding!"
