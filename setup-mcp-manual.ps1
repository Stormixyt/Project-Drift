# Manual MCP Setup - Simpler approach
# Run as Administrator

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   [*] Manual MCP Setup" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[X] Run as Administrator!" -ForegroundColor Red
    pause
    exit 1
}

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$backupPath = "$hostsPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "[1/3] Creating backup..." -ForegroundColor Yellow
Copy-Item $hostsPath $backupPath
Write-Host "      Backup: $backupPath" -ForegroundColor Gray

Write-Host ""
Write-Host "[2/3] Opening hosts file in Notepad..." -ForegroundColor Yellow
Write-Host "      Add these lines at the END of the file:" -ForegroundColor Cyan
Write-Host ""

$entries = @"

# ===== Project Drift MCP Backend =====
# Redirects Epic Games services to localhost
127.0.0.1    account-public-service-prod03.ol.epicgames.com
127.0.0.1    account-public-service-prod.ol.epicgames.com
127.0.0.1    fortnite-public-service-prod11.ol.epicgames.com
127.0.0.1    fortnite-public-service-prod.ol.epicgames.com
127.0.0.1    lightswitch-public-service-prod06.ol.epicgames.com
127.0.0.1    lightswitch-public-service-prod.ol.epicgames.com
127.0.0.1    entitlement-public-service-prod08.ol.epicgames.com
127.0.0.1    catalog-public-service-prod06.ol.epicgames.com
127.0.0.1    datarouter.ol.epicgames.com
127.0.0.1    datastorage-public-service-livefn.ol.epicgames.com
127.0.0.1    friends-public-service-prod06.ol.epicgames.com
127.0.0.1    presence-public-service-prod.ol.epicgames.com
127.0.0.1    party-service-prod.ol.epicgames.com
127.0.0.1    statsproxy-public-service-live.ol.epicgames.com
127.0.0.1    platform-public-service-prod.ol.epicgames.com
# ======================================
"@

Write-Host $entries -ForegroundColor Gray
Write-Host ""

# Copy to clipboard
$entries | Set-Clipboard
Write-Host "[+] Entries copied to clipboard!" -ForegroundColor Green
Write-Host ""

Write-Host "Press ENTER to open Notepad as Administrator..." -ForegroundColor Yellow
pause

# Open notepad as admin
Start-Process notepad.exe -ArgumentList $hostsPath -Verb RunAs -Wait

Write-Host ""
Write-Host "[3/3] Flushing DNS cache..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] Setup Complete!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Start MCP backend" -ForegroundColor Cyan
Write-Host "  cd mcp-backend" -ForegroundColor Gray
Write-Host "  npm install" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
