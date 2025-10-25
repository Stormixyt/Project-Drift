# ========================================
# PROJECT DRIFT - INTEGRATED LAUNCHER
# Starts LawinServer + Fortnite 4.5
# ========================================

param(
    [string]$BuildPath = "C:\Users\Stormix\Downloads\4.5"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$McpBackendPath = Join-Path $ProjectRoot "mcp-backend"
$BypassFolder = Join-Path $ProjectRoot "release\bypass"

# Paths
$FortnitePath = Join-Path $BuildPath "FortniteGame\Binaries\Win64"
$LauncherExe = Join-Path $FortnitePath "FortniteLauncher.exe"
$GameExe = Join-Path $FortnitePath "FortniteClient-Win64-Shipping.exe"
$Injector = Join-Path $BypassFolder "injector.exe"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      PROJECT DRIFT LAUNCHER v1.0       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# STEP 1: Check MCP Backend Dependencies
# ========================================
Write-Host "[1/8] Checking MCP Backend..." -ForegroundColor Yellow

if (!(Test-Path $McpBackendPath)) {
    Write-Host "  ✗ MCP Backend not found!" -ForegroundColor Red
    exit 1
}

$nodeModules = Join-Path $McpBackendPath "node_modules"
if (!(Test-Path $nodeModules)) {
    Write-Host "  Installing MCP Backend dependencies..." -ForegroundColor Cyan
    Push-Location $McpBackendPath
    npm install --silent
    Pop-Location
    Write-Host "  ✓ Dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "  ✓ MCP Backend ready" -ForegroundColor Green
}

# ========================================
# STEP 2: Check if port 3551 is available
# ========================================
Write-Host "[2/8] Checking port 3551..." -ForegroundColor Yellow

$portInUse = Get-NetTCPConnection -LocalPort 3551 -ErrorAction SilentlyContinue
if ($portInUse) {
    $processPid = $portInUse.OwningProcess | Select-Object -First 1
    Write-Host "  Port 3551 already in use by PID $processPid" -ForegroundColor Yellow
    $response = Read-Host "  Kill existing process? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Stop-Process -Id $processPid -Force
        Start-Sleep -Seconds 1
        Write-Host "  ✓ Process killed" -ForegroundColor Green
    } else {
        Write-Host "  Using existing MCP Backend instance" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ Port available" -ForegroundColor Green
}

# ========================================
# STEP 3: Start MCP Backend
# ========================================
Write-Host "[3/8] Starting MCP Backend..." -ForegroundColor Yellow

$mcpRunning = Get-NetTCPConnection -LocalPort 3551 -ErrorAction SilentlyContinue
if (!$mcpRunning) {
    # Start backend and capture output
    $mcpJob = Start-Process -FilePath "node" -ArgumentList "src\index.js" -WorkingDirectory $McpBackendPath -NoNewWindow -PassThru -RedirectStandardError "$env:TEMP\mcp-error.log" -RedirectStandardOutput "$env:TEMP\mcp-output.log"
    
    # Wait for server to start
    $timeout = 10
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
        if (Get-NetTCPConnection -LocalPort 3551 -ErrorAction SilentlyContinue) {
            Write-Host "  ✓ MCP Backend started (PID: $($mcpJob.Id))" -ForegroundColor Green
            break
        }
    }
    
    if ($elapsed -ge $timeout) {
        Write-Host "  ✗ MCP Backend failed to start!" -ForegroundColor Red
        Write-Host "  Error log:" -ForegroundColor Yellow
        if (Test-Path "$env:TEMP\mcp-error.log") {
            Get-Content "$env:TEMP\mcp-error.log" | Write-Host -ForegroundColor Red
        }
        exit 1
    }
} else {
    Write-Host "  ✓ MCP Backend already running" -ForegroundColor Green
}

# ========================================
# STEP 4: Verify Fortnite paths
# ========================================
Write-Host "[4/8] Verifying Fortnite build..." -ForegroundColor Yellow

if (!(Test-Path $GameExe)) {
    Write-Host "  ✗ Game not found at: $GameExe" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $LauncherExe)) {
    Write-Host "  ✗ Launcher not found at: $LauncherExe" -ForegroundColor Red
    exit 1
}

# Check if ERA build
$launcherSize = (Get-Item $LauncherExe).Length
if ($launcherSize -lt 200000) {
    Write-Host "  ✗ ERA build detected!" -ForegroundColor Red
    Write-Host "  Project Drift does not support ERA builds." -ForegroundColor Red
    Write-Host "  Please use a stock Fortnite build." -ForegroundColor Yellow
    exit 1
}

$launcherSizeKB = [math]::Round($launcherSize/1024, 0)
Write-Host "  ✓ Stock build verified ($launcherSizeKB KB)" -ForegroundColor Green

# ========================================
# STEP 5: Disable anti-cheat
# ========================================
Write-Host "[5/8] Disabling anti-cheat..." -ForegroundColor Yellow

# Remove BattlEye
$battleEyeDll = Join-Path $FortnitePath "BattlEye\BEClient_x64.dll"
if (Test-Path $battleEyeDll) {
    $backupPath = "$battleEyeDll.bak"
    if (!(Test-Path $backupPath)) {
        Move-Item $battleEyeDll $backupPath -Force
    } else {
        Remove-Item $battleEyeDll -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  ✓ BattlEye disabled" -ForegroundColor Green
} else {
    Write-Host "  ✓ BattlEye already disabled" -ForegroundColor Green
}

# Remove NVIDIA Aftermath
Get-ChildItem -Path $FortnitePath -Recurse -Filter "GFSDK_Aftermath_Lib*.dll" -ErrorAction SilentlyContinue | 
    ForEach-Object { Remove-Item $_.FullName -Force }
Write-Host "  ✓ NVIDIA Aftermath removed" -ForegroundColor Green

# ========================================
# STEP 6: Prepare P/Invoke for process suspension
# ========================================
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class ProcessSuspender {
    [DllImport("ntdll.dll")]
    public static extern int NtSuspendProcess(IntPtr processHandle);
    
    [DllImport("kernel32.dll")]
    public static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);
    
    public const int PROCESS_ALL_ACCESS = 0x1F0FFF;
}
"@

function Suspend-Process {
    param([int]$ProcessId)
    try {
        $handle = [ProcessSuspender]::OpenProcess([ProcessSuspender]::PROCESS_ALL_ACCESS, $false, $ProcessId)
        if ($handle -eq [IntPtr]::Zero) { return $false }
        $result = [ProcessSuspender]::NtSuspendProcess($handle)
        return $result -eq 0
    } catch {
        return $false
    }
}

# ========================================
# STEP 7: Launch Fortnite
# ========================================
Write-Host "[6/8] Starting Fortnite launcher (suspended)..." -ForegroundColor Yellow

$launcherProcess = Start-Process -FilePath $LauncherExe -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 200
if (Suspend-Process -ProcessId $launcherProcess.Id) {
    Write-Host "  ✓ Launcher suspended (PID: $($launcherProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "  ! Launcher suspension failed" -ForegroundColor Yellow
}

Write-Host "[7/8] Starting Fortnite game..." -ForegroundColor Yellow

$gameArgs = @(
    "-epicapp=Fortnite",
    "-epicenv=Prod",
    "-epicportal",
    "-skippatchcheck",
    "-nobe",
    "-fromfl=eac",
    "-fltoken=3db3ba5dcbd2e16703f3978d",
    "-noeac",
    "-AUTH_LOGIN=drift@projectdrift.dev",
    "-AUTH_PASSWORD=ProjectDrift",
    "-AUTH_TYPE=epic"
)

$gameProcess = Start-Process -FilePath $GameExe -ArgumentList $gameArgs -PassThru -WorkingDirectory $FortnitePath
Start-Sleep -Milliseconds 500

if (!(Get-Process -Id $gameProcess.Id -ErrorAction SilentlyContinue)) {
    Write-Host "  ✗ Game failed to start!" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Game started (PID: $($gameProcess.Id))" -ForegroundColor Green

# ========================================
# STEP 8: Inject DLLs (Reboot sequence)
# ========================================
Write-Host "[8/8] Injecting DLLs..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$dllsToInject = @(
    @{ Name = "cobalt.dll"; Description = "auth redirect" },
    @{ Name = "memory.dll"; Description = "memory leak fix" },
    @{ Name = "console.dll"; Description = "UE4 console" },
    @{ Name = "reboot.dll"; Description = "main handler" }
)

$injectionCount = 0
foreach ($dll in $dllsToInject) {
    $dllPath = Join-Path $BypassFolder $dll.Name
    if ((Test-Path $dllPath) -and (Test-Path $Injector)) {
        Write-Host "  [$($injectionCount + 1)/4] Injecting $($dll.Name) ($($dll.Description))..." -ForegroundColor Cyan
        $result = & $Injector $gameProcess.Id $dllPath 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✓ Injected!" -ForegroundColor Green
            $injectionCount++
        } else {
            Write-Host "    ✗ Failed!" -ForegroundColor Red
        }
    } else {
        Write-Host "    ⚠ $($dll.Name) not found!" -ForegroundColor Yellow
    }
}

# ========================================
# SUCCESS
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "         DRIFT LAUNCHER SUCCESS!         " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "✓ MCP Backend: Running on port 3551" -ForegroundColor Cyan
Write-Host "✓ Fortnite: PID $($gameProcess.Id)" -ForegroundColor Cyan
Write-Host "✓ DLLs Injected: $injectionCount/4" -ForegroundColor Cyan
Write-Host ""
Write-Host "Game should connect to MCP Backend automatically!" -ForegroundColor Yellow
Write-Host "Check the backend for connection logs." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring..." -ForegroundColor Gray

# Monitor the game process
try {
    while ($true) {
        Start-Sleep -Seconds 5
        $proc = Get-Process -Id $gameProcess.Id -ErrorAction SilentlyContinue
        if (!$proc) {
            Write-Host ""
            Write-Host "Game process ended." -ForegroundColor Yellow
            break
        }
    }
} catch {
    Write-Host "Monitoring stopped." -ForegroundColor Yellow
}
