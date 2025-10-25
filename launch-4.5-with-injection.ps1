#!/usr/bin/env pwsh
# Project Drift - Launch 4.5 Build with DLL Injection
# This uses the Project Drift injector to bypass Epic launcher checks

$ErrorActionPreference = "Stop"

# Setup logging
$LogFile = Join-Path $PSScriptRoot "launch-4.5-injection.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $Message -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $LogMessage
}

# Start new log session
Add-Content -Path $LogFile -Value "`n`n=========================================="
Add-Content -Path $LogFile -Value "New Launch Session: $Timestamp"
Add-Content -Path $LogFile -Value "=========================================="

Write-Log "=== Project Drift - Launch 4.5 Build ===" "Cyan"
Write-Log "Using DLL injection method for stock builds" "Yellow"
Write-Log "Log file: $LogFile" "Gray"
Write-Log ""

# Paths
$BuildPath = "C:\Users\Stormix\Downloads\4.5"
$GameExe = Join-Path $BuildPath "FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"
$InjectorExe = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\injector.exe"
$BypassDLL = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\bypass.dll"

Write-Log "Configuration:" "Cyan"
Write-Log "  Build Path: $BuildPath" "Gray"
Write-Log "  Game Exe: $GameExe" "Gray"
Write-Log "  Injector: $InjectorExe" "Gray"
Write-Log "  Bypass DLL: $BypassDLL" "Gray"
Write-Log ""

# Validation
if (-not (Test-Path $GameExe)) {
    Write-Log "[ERROR] Fortnite executable not found at: $GameExe" "Red"
    exit 1
}

if (-not (Test-Path $InjectorExe)) {
    Write-Log "[ERROR] Injector not found. Please build the injector project first." "Red"
    Write-Log "Location: C:\Users\Stormix\Downloads\Project Drift\injector\" "Yellow"
    exit 1
}

if (-not (Test-Path $BypassDLL)) {
    Write-Log "[ERROR] bypass.dll not found. Please build the bypass project first." "Red"
    Write-Log "Location: C:\Users\Stormix\Downloads\Project Drift\bypass\" "Yellow"
    exit 1
}

# Launch arguments (same as ERA 7.20 build)
$LaunchArgs = @(
    "-epicapp=Fortnite",
    "-epicenv=Prod",
    "-epicportal",
    "-epiclocale=en-us",
    "-skippatchcheck",
    "-HTTP=WinInet",
    "-NOSSLPINNING",
    "-fromfl=eac",
    "-fltoken=3db3ba5dcbd2e16703f3978d",
    "-nobe",
    "-noeac"
)

Write-Log "[1/4] Checking hosts file redirection..." "Yellow"
$hostsEntries = @(
    "127.0.0.1 account-public-service-prod.ol.epicgames.com",
    "127.0.0.1 fortnite-public-service-prod11.ol.epicgames.com",
    "127.0.0.1 datarouter.ol.epicgames.com",
    "127.0.0.1 entitlement-public-service-prod08.ol.epicgames.com"
)

$hostsFile = "C:\Windows\System32\drivers\etc\hosts"
$currentHosts = Get-Content $hostsFile -Raw
$needsUpdate = $false

foreach ($entry in $hostsEntries) {
    if ($currentHosts -notmatch [regex]::Escape($entry)) {
        $needsUpdate = $true
        Write-Log "  Missing: $entry" "Yellow"
        break
    }
}

if ($needsUpdate) {
    Write-Log "[WARNING] Hosts file needs updating. Run as Administrator or manually add:" "Red"
    foreach ($entry in $hostsEntries) {
        Write-Log "  $entry" "Yellow"
    }
    Write-Log ""
} else {
    Write-Log "  Hosts file OK - all entries present" "Green"
}

Write-Log "[2/4] Starting Fortnite..." "Yellow"
Write-Log "Executable: $GameExe" "Gray"
Write-Log "Arguments: $($LaunchArgs -join ' ')" "Gray"
Write-Log ""

# Start Fortnite process
$processStartInfo = New-Object System.Diagnostics.ProcessStartInfo
$processStartInfo.FileName = $GameExe
$processStartInfo.Arguments = $LaunchArgs -join " "
$processStartInfo.WorkingDirectory = Split-Path $GameExe
$processStartInfo.UseShellExecute = $false

try {
    $process = [System.Diagnostics.Process]::Start($processStartInfo)
    Write-Log "[SUCCESS] Fortnite started with PID: $($process.Id)" "Green"
    
    # Wait a bit for process to initialize
    Write-Log "[3/4] Waiting for game to initialize (3 seconds)..." "Yellow"
    Start-Sleep -Seconds 3
    
    # Check if process is still running
    if ($process.HasExited) {
        Write-Log "[ERROR] Fortnite crashed immediately! Exit code: $($process.ExitCode)" "Red"
        Write-Log "Check the log file for details: $LogFile" "Yellow"
        exit 1
    }
    
    Write-Log "  Process still running - ready for injection" "Green"
    
    # Inject bypass DLL
    Write-Log "[4/4] Injecting bypass DLL..." "Yellow"
    Write-Log "Injector: $InjectorExe" "Gray"
    Write-Log "DLL: $BypassDLL" "Gray"
    Write-Log "Target PID: $($process.Id)" "Gray"
    Write-Log ""
    
    # Run injector and capture output
    $injectorArgs = @($process.Id, "`"$BypassDLL`"")
    Write-Log "Running: $InjectorExe $($injectorArgs -join ' ')" "Gray"
    
    $injectorOutput = & $InjectorExe $injectorArgs 2>&1
    foreach ($line in $injectorOutput) {
        Write-Log "  [Injector] $line" "Gray"
    }
    
    $injectorExitCode = $LASTEXITCODE
    Write-Log "Injector exit code: $injectorExitCode" "Gray"
    
    if ($injectorExitCode -eq 0) {
        Write-Log ""
        Write-Log "========================================" "Green"
        Write-Log "SUCCESS! Fortnite 4.5 launched!" "Green"
        Write-Log "========================================" "Green"
        Write-Log ""
        Write-Log "Game is running with bypass DLL injected" "Cyan"
        Write-Log "Process ID: $($process.Id)" "Cyan"
        Write-Log ""
        Write-Log "Make sure MCP backend is running on port 3551!" "Yellow"
        Write-Log "To start backend: cd mcp-backend && npm run dev" "Yellow"
        Write-Log ""
        Write-Log "Full log saved to: $LogFile" "Cyan"
    } else {
        Write-Log ""
        Write-Log "[ERROR] DLL injection failed! Exit code: $injectorExitCode" "Red"
        Write-Log "Check if:" "Yellow"
        Write-Log "  1. Antivirus is blocking the injector" "Yellow"
        Write-Log "  2. Process is still running" "Yellow"
        Write-Log "  3. You have proper permissions" "Yellow"
        Write-Log ""
        Write-Log "Full log saved to: $LogFile" "Cyan"
    }
    
} catch {
    Write-Log "[ERROR] Failed to start Fortnite: $_" "Red"
    Write-Log "Exception details: $($_.Exception.Message)" "Red"
    Write-Log "Stack trace:" "Gray"
    Write-Log "$($_.ScriptStackTrace)" "Gray"
    Write-Log ""
    Write-Log "Full log saved to: $LogFile" "Cyan"
    exit 1
}
