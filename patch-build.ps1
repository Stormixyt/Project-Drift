#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Project Drift - Build Patcher PowerShell Wrapper

.DESCRIPTION
    Interactive PowerShell script to patch Fortnite builds for Project Drift.
    Wraps the Python/Node.js patchers with a user-friendly interface.

.PARAMETER BuildPath
    Path to the Fortnite build directory

.PARAMETER UsePython
    Use Python patcher (includes binary patching)

.PARAMETER DryRun
    Analyze only, don't modify files

.EXAMPLE
    .\patch-build.ps1
    Interactive mode - will prompt for build path

.EXAMPLE
    .\patch-build.ps1 -BuildPath "C:\Fortnite\7.20"
    Patch a specific build

.EXAMPLE
    .\patch-build.ps1 -BuildPath "C:\Fortnite\7.20" -UsePython -DryRun
    Analyze with Python patcher without making changes
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$BuildPath,
    
    [Parameter(Mandatory=$false)]
    [switch]$UsePython = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$NoBinaryPatch = $false
)

# Set error action
$ErrorActionPreference = "Stop"

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir  # Script is in project root
$ToolsDir = Join-Path $ProjectRoot "tools"

# Colors
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ️  $Text" -ForegroundColor Cyan
}

function Write-Warning2 {
    param([string]$Text)
    Write-Host "⚠️  $Text" -ForegroundColor Yellow
}

function Write-Error2 {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

# Check if Node.js is installed
function Test-NodeJs {
    try {
        $null = Get-Command node -ErrorAction Stop
        $version = node --version
        Write-Success "Node.js $version detected"
        return $true
    } catch {
        Write-Warning2 "Node.js not found"
        return $false
    }
}

# Check if Python is installed
function Test-Python {
    try {
        $null = Get-Command python -ErrorAction Stop
        $version = python --version
        Write-Success "Python $version detected"
        return $true
    } catch {
        Write-Warning2 "Python not found"
        return $false
    }
}

# Validate build path
function Test-BuildPath {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Error2 "Build path not found: $Path"
        return $false
    }
    
    $exePath = Join-Path $Path "FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"
    if (-not (Test-Path $exePath)) {
        Write-Error2 "Not a valid Fortnite build (missing FortniteClient-Win64-Shipping.exe)"
        return $false
    }
    
    Write-Success "Valid Fortnite build detected"
    return $true
}

# Prompt for build path
function Get-BuildPath {
    Write-Host ""
    Write-Host "Enter the path to your Fortnite build directory:" -ForegroundColor Yellow
    Write-Host "Example: C:\Fortnite\7.20" -ForegroundColor Gray
    Write-Host ""
    
    $path = Read-Host "Build Path"
    
    # Remove quotes if present
    $path = $path.Trim('"', "'")
    
    return $path
}

# Choose patcher
function Select-Patcher {
    Write-Host ""
    Write-Host "Select patcher:" -ForegroundColor Yellow
    Write-Host "1. Node.js (fast, script-only patching)" -ForegroundColor White
    Write-Host "2. Python (advanced, includes binary patching)" -ForegroundColor White
    Write-Host ""
    
    $choice = Read-Host "Choice (1-2)"
    
    return ($choice -eq "2")
}

# Run Node.js patcher
function Invoke-NodePatcher {
    param([string]$Path)
    
    $patcherScript = Join-Path $ToolsDir "build-patcher.js"
    
    if (-not (Test-Path $patcherScript)) {
        Write-Error2 "Patcher script not found: $patcherScript"
        return $false
    }
    
    Write-Info "Running Node.js patcher..."
    
    try {
        & node $patcherScript $Path
        return $LASTEXITCODE -eq 0
    } catch {
        Write-Error2 "Patcher failed: $_"
        return $false
    }
}

# Run Python patcher
function Invoke-PythonPatcher {
    param(
        [string]$Path,
        [bool]$DryRun,
        [bool]$NoBinaryPatch
    )
    
    $patcherScript = Join-Path $ToolsDir "build-patcher.py"
    
    if (-not (Test-Path $patcherScript)) {
        Write-Error2 "Patcher script not found: $patcherScript"
        return $false
    }
    
    Write-Info "Running Python patcher..."
    
    $args = @($patcherScript, $Path)
    
    if ($DryRun) {
        $args += "--dry-run"
    }
    
    if ($NoBinaryPatch) {
        $args += "--no-binary-patch"
    }
    
    try {
        & python $args
        return $LASTEXITCODE -eq 0
    } catch {
        Write-Error2 "Patcher failed: $_"
        return $false
    }
}

# Main script
function Main {
    Clear-Host
    
    Write-Header "PROJECT DRIFT - BUILD PATCHER v1.0"
    
    Write-Host "This tool automatically patches Fortnite builds to work with Project Drift." -ForegroundColor White
    Write-Host "It creates launcher scripts and optionally applies binary patches." -ForegroundColor White
    
    # Check requirements
    Write-Host ""
    Write-Info "Checking requirements..."
    
    $hasNode = Test-NodeJs
    $hasPython = Test-Python
    
    if (-not $hasNode -and -not $hasPython) {
        Write-Error2 "Neither Node.js nor Python found!"
        Write-Host ""
        Write-Host "Please install one of the following:" -ForegroundColor Yellow
        Write-Host "  • Node.js 18+ from https://nodejs.org" -ForegroundColor White
        Write-Host "  • Python 3.8+ from https://python.org" -ForegroundColor White
        exit 1
    }
    
    # Get build path
    if (-not $BuildPath) {
        $BuildPath = Get-BuildPath
    }
    
    Write-Host ""
    Write-Info "Validating build path..."
    
    if (-not (Test-BuildPath $BuildPath)) {
        exit 1
    }
    
    # Select patcher
    if (-not $UsePython -and $hasPython -and $hasNode) {
        $UsePython = Select-Patcher
    } elseif ($UsePython -and -not $hasPython) {
        Write-Warning2 "Python not available, using Node.js patcher"
        $UsePython = $false
    } elseif (-not $hasNode) {
        $UsePython = $true
    }
    
    # Confirm
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "Ready to patch build:" -ForegroundColor White
    Write-Host "  Path: $BuildPath" -ForegroundColor Cyan
    Write-Host "  Patcher: $(if ($UsePython) { 'Python (with binary patching)' } else { 'Node.js (scripts only)' })" -ForegroundColor Cyan
    Write-Host "  Mode: $(if ($DryRun) { 'Dry Run (no changes)' } else { 'Full Patch' })" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    
    $confirm = Read-Host "Continue? (Y/N)"
    
    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-Info "Cancelled by user"
        exit 0
    }
    
    # Run patcher
    Write-Host ""
    
    $success = $false
    
    if ($UsePython) {
        $success = Invoke-PythonPatcher -Path $BuildPath -DryRun $DryRun -NoBinaryPatch $NoBinaryPatch
    } else {
        $success = Invoke-NodePatcher -Path $BuildPath
    }
    
    # Result
    Write-Host ""
    
    if ($success) {
        Write-Header "✅ PATCHING COMPLETE!"
        
        Write-Host "Your build has been patched successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Start MCP backend: cd mcp-backend && npm run dev" -ForegroundColor White
        Write-Host "  2. Navigate to: $BuildPath\FortniteGame\Binaries\Win64" -ForegroundColor White
        Write-Host "  3. Run Quick-Start.bat" -ForegroundColor White
        Write-Host "  4. Login with any credentials" -ForegroundColor White
        Write-Host ""
        Write-Host "Read PROJECT_DRIFT_README.txt in the build folder for more info." -ForegroundColor Cyan
        
    } else {
        Write-Header "❌ PATCHING FAILED"
        
        Write-Host "The patcher encountered an error. Check the output above for details." -ForegroundColor Red
        exit 1
    }
}

# Run main
try {
    Main
} catch {
    Write-Error2 "Unexpected error: $_"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
