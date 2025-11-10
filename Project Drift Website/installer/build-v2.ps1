# Project Drift 2.0.0 Installer Build Script
# This script prepares all files and builds the installer

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Project Drift 2.0.0 Installer Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define paths
$RootDir = "C:\Users\Stormix\Downloads\Project Drift"
$InstallerDir = $PSScriptRoot
$StagingDir = Join-Path $InstallerDir "staging"
$OutputDir = Join-Path $InstallerDir "Output"

# Source directories
$LauncherDir = Join-Path $RootDir "launcher\dist\win-unpacked"
$MomentumDir = "C:\Users\Stormix\Downloads\Momentum-main\Momentum-main"
$StarfallDll = "C:\Users\Stormix\Downloads\Downloads\Starfall-main\x64\Release\Starfall.dll"
$InjectorExe = Join-Path $RootDir "release\bypass\injector.exe"

Write-Host "[1/6] Cleaning staging directory..." -ForegroundColor Yellow
if (Test-Path $StagingDir) {
    Remove-Item -Path $StagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

Write-Host "[2/6] Copying launcher files..." -ForegroundColor Yellow
$LauncherStaging = Join-Path $StagingDir "launcher\dist\win-unpacked"
New-Item -ItemType Directory -Path $LauncherStaging -Force | Out-Null
if (Test-Path $LauncherDir) {
    Copy-Item -Path "$LauncherDir\*" -Destination $LauncherStaging -Recurse -Force
    Write-Host "  ✓ Launcher (standalone exe) copied" -ForegroundColor Green
} else {
    Write-Host "  ✗ Launcher directory not found at: $LauncherDir" -ForegroundColor Red
    Write-Host "  Run 'npm run build' in launcher directory first!" -ForegroundColor Yellow
    exit 1
}

Write-Host "[3/6] Copying Momentum backend..." -ForegroundColor Yellow
$MomentumStaging = Join-Path $StagingDir "backend\momentum"
New-Item -ItemType Directory -Path $MomentumStaging -Force | Out-Null
if (Test-Path $MomentumDir) {
    Copy-Item -Path "$MomentumDir\*" -Destination $MomentumStaging -Recurse -Force
    Write-Host "  ✓ Momentum backend copied" -ForegroundColor Green
} else {
    Write-Host "  ✗ Momentum directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[4/6] Copying Starfall bypass DLL..." -ForegroundColor Yellow
$BypassStaging = Join-Path $StagingDir "release\bypass"
New-Item -ItemType Directory -Path $BypassStaging -Force | Out-Null
if (Test-Path $StarfallDll) {
    Copy-Item -Path $StarfallDll -Destination $BypassStaging -Force
    Write-Host "  ✓ Starfall.dll copied" -ForegroundColor Green
} else {
    Write-Host "  ✗ Starfall.dll not found at: $StarfallDll" -ForegroundColor Red
    exit 1
}

Write-Host "[5/6] Copying injector..." -ForegroundColor Yellow
if (Test-Path $InjectorExe) {
    Copy-Item -Path $InjectorExe -Destination $BypassStaging -Force
    Write-Host "  ✓ Injector copied" -ForegroundColor Green
} else {
    Write-Host "  ✗ Injector not found at: $InjectorExe" -ForegroundColor Red
    exit 1
}

# Create .env.example for Momentum
Write-Host "[6/6] Creating configuration files..." -ForegroundColor Yellow
$EnvExample = @"
MONGO_URI="mongodb://localhost:27017/momentum"
BOT_TOKEN="YOUR_DISCORD_BOT_TOKEN"
NAME="ProjectDrift"
GAME_SERVERS=""
ENABLE_CROSS_BANS=false
ENABLE_CLOUD=true
ALLOW_REBOOT=true
MAIN_SEASON=15
MATCHMAKER_IP="ws://127.0.0.1:3551/matchmaker"
PORT=3551
USE_S3=false
DEBUG_LOG=true
USE_REDIS=false
REDIS_URL=""
"@
$EnvExample | Out-File -FilePath (Join-Path $MomentumStaging ".env.example") -Encoding UTF8

# Create batch file to start backend easily
$BackendBat = @"
@echo off
title Project Drift - Momentum Backend
cd /d "%~dp0backend\momentum"
echo Starting Momentum Backend...
echo.
node build/index.js
pause
"@
$BackendBat | Out-File -FilePath (Join-Path $StagingDir "start-backend.bat") -Encoding ASCII

Write-Host "  ✓ Configuration files created" -ForegroundColor Green

Write-Host ""
Write-Host "[BUILD] Staging complete! Running Inno Setup..." -ForegroundColor Yellow

# Check if Inno Setup is installed
$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $InnoSetupPath)) {
    Write-Host "  ✗ Inno Setup not found at: $InnoSetupPath" -ForegroundColor Red
    Write-Host "  Please install Inno Setup 6 from: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
    exit 1
}

# Build the installer
$IssFile = Join-Path $InstallerDir "installer.iss"
& $InnoSetupPath $IssFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installer created at:" -ForegroundColor Cyan
    Write-Host "  $OutputDir\Project-Drift-Installer-v2.0.0.exe" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Test the installer" -ForegroundColor White
    Write-Host "  2. Create GitHub release v2.0.0" -ForegroundColor White
    Write-Host "  3. Upload the installer EXE" -ForegroundColor White
    Write-Host "  4. Website will auto-detect the latest release" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "✗ Build failed!" -ForegroundColor Red
    exit 1
}
