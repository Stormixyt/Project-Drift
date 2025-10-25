# Project Drift - Environment Check Script
Write-Host "`nChecking Development Environment...`n" -ForegroundColor Cyan

$allGood = $true

# Check Docker
Write-Host "Checking Docker..." -NoNewline
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host " OK - $dockerVersion" -ForegroundColor Green
        try {
            docker info 2>&1 | Out-Null
            Write-Host "  Docker is running" -ForegroundColor Green
        } catch {
            Write-Host "  WARNING: Docker not running - start Docker Desktop" -ForegroundColor Yellow
            $allGood = $false
        }
    }
} catch {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    $allGood = $false
}

# Check Node.js
Write-Host "`nChecking Node.js..." -NoNewline
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host " OK - $nodeVersion" -ForegroundColor Green
        $npmVersion = npm --version 2>$null
        Write-Host "  npm: $npmVersion" -ForegroundColor Green
    }
} catch {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install: https://nodejs.org/ (v20 LTS)" -ForegroundColor Yellow
    $allGood = $false
}

# Check Rust (optional)
Write-Host "`nChecking Rust (optional)..." -NoNewline
try {
    $rustVersion = rustc --version 2>$null
    if ($rustVersion) {
        Write-Host " OK - $rustVersion" -ForegroundColor Green
    }
} catch {
    Write-Host " Not installed (optional)" -ForegroundColor Yellow
}

# Check Git
Write-Host "`nChecking Git..." -NoNewline
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Host " OK - $gitVersion" -ForegroundColor Green
    }
} catch {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install: https://git-scm.com/download/win" -ForegroundColor Yellow
    $allGood = $false
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "All required tools installed!" -ForegroundColor Green
    Write-Host "`nRun: .\start-local.ps1" -ForegroundColor Cyan
} else {
    Write-Host "Some tools are missing - install them first" -ForegroundColor Yellow
}
Write-Host ""
