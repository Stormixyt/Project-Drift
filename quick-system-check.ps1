# Quick System Check for Project Drift
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Project Drift - System Check" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check 1: Hosts file
Write-Host "[1/5] Checking hosts file..." -ForegroundColor Yellow
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsContent = Get-Content $hostsPath -Raw
if ($hostsContent -match "Project Drift MCP") {
    Write-Host "      [+] Hosts file configured correctly" -ForegroundColor Green
} else {
    Write-Host "      [X] Hosts file NOT configured - run setup-mcp.ps1" -ForegroundColor Red
}

# Check 2: MCP Backend
Write-Host ""
Write-Host "[2/5] Checking MCP Backend (port 3551)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3551/account/api/oauth/token" -Method Post -Body (@{grant_type="client_credentials"} | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop -TimeoutSec 2
    Write-Host "      [+] MCP Backend is running and responding" -ForegroundColor Green
} catch {
    Write-Host "      [X] MCP Backend NOT responding on port 3551" -ForegroundColor Red
    Write-Host "         Start with: cd mcp-backend && node src/index.js" -ForegroundColor Yellow
}

# Check 3: P2P Matchmaking
Write-Host ""
Write-Host "[3/5] Checking P2P Matchmaking (port 8080)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get -ErrorAction Stop -TimeoutSec 2
    Write-Host "      [+] P2P Matchmaking is running" -ForegroundColor Green
} catch {
    Write-Host "      [X] P2P Matchmaking NOT responding" -ForegroundColor Red
    Write-Host "         Check Docker: docker ps --filter name=drift" -ForegroundColor Yellow
}

# Check 4: Redis
Write-Host ""
Write-Host "[4/5] Checking Redis..." -ForegroundColor Yellow
try {
    $docker = docker ps --filter "name=drift-redis" --format "{{.Status}}"
    if ($docker -match "Up") {
        Write-Host "      [+] Redis is running" -ForegroundColor Green
    } else {
        Write-Host "      [X] Redis NOT running" -ForegroundColor Red
    }
} catch {
    Write-Host "      [X] Docker not available" -ForegroundColor Red
}

# Check 5: Launcher
Write-Host ""
Write-Host "[5/5] Checking Launcher process..." -ForegroundColor Yellow
$launcher = Get-Process -Name "electron" -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -like "*Project Drift*"}
if ($launcher) {
    Write-Host "      [+] Launcher is running (PID: $($launcher.Id))" -ForegroundColor Green
} else {
    Write-Host "      [-] Launcher not running" -ForegroundColor Gray
    Write-Host "         Start with: cd launcher && npm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   System Status Summary" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ready to launch Fortnite:" -ForegroundColor White
Write-Host "  - Hosts file must be configured" -ForegroundColor Gray
Write-Host "  - MCP Backend must be running" -ForegroundColor Gray
Write-Host "  - P2P Matchmaking recommended" -ForegroundColor Gray
Write-Host "  - Launcher must be running" -ForegroundColor Gray
Write-Host ""
