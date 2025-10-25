# Project Drift - Start All Services
# Starts MCP backend, P2P matchmaking, and launcher

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   🚀 Project Drift - Starting All Services" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot

# Check if MCP backend is set up
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsContent = Get-Content $hostsPath -Raw

if ($hostsContent -notmatch "Project Drift MCP Backend") {
    Write-Host "⚠️  MCP backend not configured!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You need to run the setup script first (requires Admin):" -ForegroundColor White
    Write-Host "   Right-click PowerShell → Run as Administrator" -ForegroundColor Gray
    Write-Host "   Then run: .\setup-mcp.ps1" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Do you want to open an admin PowerShell to run setup? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Start-Process powershell -Verb RunAs -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; .\setup-mcp.ps1"
        Write-Host ""
        Write-Host "After setup completes, run this script again." -ForegroundColor Yellow
        pause
        exit
    } else {
        Write-Host "Cannot start without MCP setup. Exiting." -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host "✓ MCP backend is configured" -ForegroundColor Green
Write-Host ""

# Check if MCP dependencies are installed
if (-not (Test-Path "$projectRoot\mcp-backend\node_modules")) {
    Write-Host "[1/4] Installing MCP backend dependencies..." -ForegroundColor Yellow
    Push-Location "$projectRoot\mcp-backend"
    npm install
    Pop-Location
    Write-Host ""
} else {
    Write-Host "[1/4] MCP backend dependencies installed ✓" -ForegroundColor Green
}

# Start MCP Backend in new terminal
Write-Host "[2/4] Starting MCP Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\mcp-backend'; Write-Host 'Starting MCP Backend...' -ForegroundColor Cyan; npm run dev"
Write-Host "      → MCP Backend running on http://localhost:3551" -ForegroundColor Gray
Start-Sleep -Seconds 2

# Start Docker services (P2P matchmaking + Redis)
Write-Host ""
Write-Host "[3/4] Starting P2P Matchmaking (Docker)..." -ForegroundColor Yellow
Push-Location $projectRoot
docker-compose up -d
Pop-Location
Write-Host "      → P2P Matchmaking running on http://localhost:8080" -ForegroundColor Gray
Start-Sleep -Seconds 3

# Start Launcher
Write-Host ""
Write-Host "[4/4] Starting Launcher..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\launcher'; Write-Host 'Starting Launcher...' -ForegroundColor Cyan; npm run dev"
Write-Host "      → Launcher starting..." -ForegroundColor Gray

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   ✅ All Services Started!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:" -ForegroundColor Cyan
Write-Host "  🔹 MCP Backend:        http://localhost:3551" -ForegroundColor White
Write-Host "  🔹 P2P Matchmaking:    http://localhost:8080" -ForegroundColor White
Write-Host "  🔹 Launcher:           Opening..." -ForegroundColor White
Write-Host ""
Write-Host "What's next:" -ForegroundColor Cyan
Write-Host "  1. Wait for launcher to open" -ForegroundColor White
Write-Host "  2. Go to Library tab" -ForegroundColor White
Write-Host "  3. Click on any Fortnite build" -ForegroundColor White
Write-Host "  4. Game will launch and connect to MCP backend!" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  The MCP backend terminal shows all Epic API calls" -ForegroundColor Yellow
Write-Host "    Watch it to see Fortnite connecting!" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop everything:" -ForegroundColor Cyan
Write-Host "  - Close the launcher" -ForegroundColor White
Write-Host "  - Press Ctrl+C in the MCP Backend terminal" -ForegroundColor White
Write-Host "  - Run: docker-compose down" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
