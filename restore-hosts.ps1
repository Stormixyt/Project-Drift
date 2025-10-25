# Restore Hosts File
# Removes Project Drift MCP entries from hosts file

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   🔄 Restore Original Hosts File" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"

Write-Host "[1/2] Reading hosts file..." -ForegroundColor Yellow
$hostsContent = Get-Content $hostsPath

# Remove all Project Drift entries
$inProjectDriftSection = $false
$cleanedContent = @()

foreach ($line in $hostsContent) {
    if ($line -match "# ===== Project Drift MCP Backend =====") {
        $inProjectDriftSection = $true
        continue
    }
    
    if ($inProjectDriftSection -and $line -match "# ======================================") {
        $inProjectDriftSection = $false
        continue
    }
    
    if (-not $inProjectDriftSection) {
        $cleanedContent += $line
    }
}

Write-Host "[2/2] Saving cleaned hosts file..." -ForegroundColor Yellow
$cleanedContent | Set-Content $hostsPath -Force

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   ✅ Hosts File Restored!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "All Epic Games domains now point back to Epic's servers." -ForegroundColor White
Write-Host ""
Write-Host "Flushing DNS cache..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null
Write-Host "✓ Done" -ForegroundColor Green
Write-Host ""
