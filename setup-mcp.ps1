# Project Drift MCP Setup Script
# This redirects Epic Games domains to localhost so Fortnite connects to our MCP backend

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   [*] Project Drift MCP Backend Setup" -ForegroundColor Cyan
Write-Host "   [*] Project Reboot Style Implementation" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[X] This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "[+] Running as Administrator" -ForegroundColor Green
Write-Host ""

# Hosts file path
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"

# Epic Games domains to redirect
$domains = @(
    "account-public-service-prod03.ol.epicgames.com",
    "account-public-service-prod.ol.epicgames.com",
    "fortnite-public-service-prod11.ol.epicgames.com",
    "fortnite-public-service-prod.ol.epicgames.com",
    "lightswitch-public-service-prod06.ol.epicgames.com",
    "lightswitch-public-service-prod.ol.epicgames.com",
    "entitlement-public-service-prod08.ol.epicgames.com",
    "catalog-public-service-prod06.ol.epicgames.com",
    "datarouter.ol.epicgames.com",
    "datastorage-public-service-livefn.ol.epicgames.com",
    "friends-public-service-prod06.ol.epicgames.com",
    "presence-public-service-prod.ol.epicgames.com",
    "party-service-prod.ol.epicgames.com",
    "statsproxy-public-service-live.ol.epicgames.com",
    "platform-public-service-prod.ol.epicgames.com"
)

Write-Host "[1/4] Backing up hosts file..." -ForegroundColor Yellow
$backupPath = "$hostsPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $hostsPath $backupPath -Force
Write-Host "      Backup saved to: $backupPath" -ForegroundColor Gray
Write-Host ""

Write-Host "[2/4] Reading current hosts file..." -ForegroundColor Yellow
$hostsContent = Get-Content $hostsPath

# Remove old Project Drift entries
$hostsContent = $hostsContent | Where-Object { 
    $_ -notmatch "# Project Drift MCP" -and 
    -not ($domains | Where-Object { $_ -and ($hostsContent -match [regex]::Escape($_)) })
}

Write-Host ""
Write-Host "[3/4] Adding Epic Games redirects..." -ForegroundColor Yellow

# Add new entries
$newEntries = @()
$newEntries += ""
$newEntries += "# ===== Project Drift MCP Backend ====="
$newEntries += "# Added by setup-mcp.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$newEntries += "# Redirects Epic Games services to localhost MCP server"

foreach ($domain in $domains) {
    $newEntries += "127.0.0.1    $domain"
    Write-Host "      → $domain" -ForegroundColor Gray
}

$newEntries += "# ======================================"
$newEntries += ""

# Combine and save with proper file handling
$hostsContent = $hostsContent + $newEntries

Write-Host ""
Write-Host "[4/4] Writing to hosts file..." -ForegroundColor Yellow

try {
    # Use Out-File with UTF8 encoding and force overwrite
    $hostsContent | Out-File -FilePath $hostsPath -Encoding ASCII -Force
    Write-Host "      Hosts file updated successfully" -ForegroundColor Gray
} catch {
    Write-Host "      [!] Error writing to hosts file: $_" -ForegroundColor Red
    Write-Host "      Try closing any applications that might be using the hosts file" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "[5/5] Flushing DNS cache..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] MCP Backend Setup Complete!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start the MCP backend:" -ForegroundColor White
Write-Host "   cd mcp-backend" -ForegroundColor Gray
Write-Host "   npm install" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start P2P matchmaking (in another terminal):" -ForegroundColor White
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start launcher (in another terminal):" -ForegroundColor White
Write-Host "   cd launcher" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Launch Fortnite from the launcher!" -ForegroundColor White
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[!] To restore your hosts file:" -ForegroundColor Yellow
Write-Host "    Run: .\restore-hosts.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "[i] Backup location: $backupPath" -ForegroundColor Gray
Write-Host ""
