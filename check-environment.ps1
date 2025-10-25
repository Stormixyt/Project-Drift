# Project Drift - Environment Check Script
# Validates that all required tools are installed

Write-Host "`n🔍 Checking Development Environment..." -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$allGood = $true

# Check Docker
Write-Host "Checking Docker..." -NoNewline
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host " ✅ Found: $dockerVersion" -ForegroundColor Green
        
        # Check if Docker is running
        try {
            docker info 2>&1 | Out-Null
            Write-Host "  Docker daemon is running ✅" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  Docker is installed but not running" -ForegroundColor Yellow
            Write-Host "  Please start Docker Desktop" -ForegroundColor Yellow
            $allGood = $false
        }
    }
} catch {
    Write-Host " ❌ Not found" -ForegroundColor Red
    Write-Host "  Install from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    $allGood = $false
}

# Check Node.js
Write-Host "`nChecking Node.js..." -NoNewline
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host " ✅ Found: $nodeVersion" -ForegroundColor Green
        
        # Check npm
        $npmVersion = npm --version 2>$null
        Write-Host "  npm version: $npmVersion ✅" -ForegroundColor Green
        
        # Check if version is >= 20
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -lt 20) {
            Write-Host "  ⚠️  Node.js 20+ recommended (you have $nodeVersion)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host " ❌ Not found" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org/ (LTS version 20+)" -ForegroundColor Yellow
    $allGood = $false
}

# Check Rust (optional)
Write-Host "`nChecking Rust (optional)..." -NoNewline
try {
    $rustVersion = rustc --version 2>$null
    if ($rustVersion) {
        Write-Host " ✅ Found: $rustVersion" -ForegroundColor Green
        $cargoVersion = cargo --version 2>$null
        Write-Host "  cargo version: $cargoVersion ✅" -ForegroundColor Green
    }
} catch {
    Write-Host " ⚠️  Not found (optional for development)" -ForegroundColor Yellow
    Write-Host "  Install from: https://rustup.rs/" -ForegroundColor Yellow
}

# Check Git
Write-Host "`nChecking Git..." -NoNewline
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Host " ✅ Found: $gitVersion" -ForegroundColor Green
    }
} catch {
    Write-Host " ❌ Not found" -ForegroundColor Red
    Write-Host "  Install from: https://git-scm.com/download/win" -ForegroundColor Yellow
    $allGood = $false
}

# Summary
Write-Host "`n======================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ All required tools are installed!" -ForegroundColor Green
    Write-Host "`nYou can now run: .\start-local.ps1" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Some required tools are missing" -ForegroundColor Yellow
    Write-Host "`nPlease install the missing tools and try again." -ForegroundColor Yellow
    Write-Host "`nQuick Install Guide:" -ForegroundColor Cyan
    Write-Host "1. Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "2. Node.js 20 LTS: https://nodejs.org/" -ForegroundColor White
    Write-Host "3. Git: https://git-scm.com/download/win" -ForegroundColor White
}

Write-Host ""
