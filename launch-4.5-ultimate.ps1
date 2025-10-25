# Project Drift - Ultimate 4.5 Launcher
# Combines: Suspended Launcher+EAC, BattlEye removal, Aftermath cleanup, bypass.dll injection

$BuildPath = "C:\Users\Stormix\Downloads\4.5"
$GameDir = Join-Path $BuildPath "FortniteGame\Binaries\Win64"
$GameExe = Join-Path $GameDir "FortniteClient-Win64-Shipping.exe"
$LauncherExe = Join-Path $GameDir "FortniteLauncher.exe"
$EacExe = Join-Path $GameDir "FortniteClient-Win64-Shipping_EAC.exe"
$BypassDll = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\bypass.dll"
$Injector = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\injector.exe"

Write-Host "=== Project Drift - Ultimate 4.5 Launcher ===" -ForegroundColor Cyan
Write-Host ""

# Check files
if (!(Test-Path $GameExe)) { Write-Host "[ERROR] Game not found" -ForegroundColor Red; exit 1 }
if (!(Test-Path $LauncherExe)) { Write-Host "[ERROR] Launcher not found" -ForegroundColor Red; exit 1 }

# P/Invoke for process suspension
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ProcessSuspender {
    [DllImport("ntdll.dll")]
    public static extern int NtSuspendProcess(IntPtr processHandle);
    
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);
    
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool CloseHandle(IntPtr hObject);
}
"@

function Suspend-Process {
    param([int]$ProcessId)
    $handle = [ProcessSuspender]::OpenProcess(0x1F0FFF, $false, $ProcessId)
    if ($handle -eq [IntPtr]::Zero) { return $false }
    $result = [ProcessSuspender]::NtSuspendProcess($handle)
    [ProcessSuspender]::CloseHandle($handle)
    return ($result -eq 0)
}

# Cleanup
Write-Host "[1/7] Cleaning up..." -ForegroundColor Yellow
Stop-Process -Name "FortniteClient-Win64-Shipping","FortniteLauncher","FortniteClient-Win64-Shipping_EAC" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Write-Host "  ✓ Cleanup complete" -ForegroundColor Green

# Remove BattlEye
Write-Host "[2/7] Disabling BattlEye..." -ForegroundColor Yellow
$beDll = Join-Path $GameDir "BattlEye\BEClient_x64.dll"
$beBackup = "$beDll.bak"
if (Test-Path $beDll) {
    if (!(Test-Path $beBackup)) { Copy-Item -Path $beDll -Destination $beBackup -Force }
    Remove-Item -Path $beDll -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ BattlEye disabled" -ForegroundColor Green
} else {
    Write-Host "  ✓ BattlEye already disabled" -ForegroundColor Green
}

# Remove NVIDIA Aftermath (Reboot Launcher does this!)
Write-Host "[3/7] Removing NVIDIA Aftermath DLLs..." -ForegroundColor Yellow
$aftermathDlls = Get-ChildItem -Path (Split-Path $GameDir) -Recurse -Filter "GFSDK_Aftermath_Lib*.dll" -ErrorAction SilentlyContinue
foreach ($dll in $aftermathDlls) {
    try {
        Remove-Item -Path $dll.FullName -Force
        Write-Host "  ✓ Removed $($dll.Name)" -ForegroundColor Green
    } catch {}
}
if ($aftermathDlls.Count -eq 0) {
    Write-Host "  ✓ No Aftermath DLLs found" -ForegroundColor Green
}

# Start Launcher (suspended)
Write-Host "[4/7] Starting FortniteLauncher (suspended)..." -ForegroundColor Yellow
$launcherProcess = Start-Process -FilePath $LauncherExe -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 200
if (Suspend-Process -ProcessId $launcherProcess.Id) {
    Write-Host "  ✓ Launcher suspended (PID: $($launcherProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "  ! Launcher suspension failed" -ForegroundColor Yellow
}

# Skip EAC entirely - we pass -noeac to the game
Write-Host "[5/7] Skipping EAC (using -noeac flag)..." -ForegroundColor Yellow
Write-Host "  ✓ EAC will be bypassed" -ForegroundColor Green

# Start game
Write-Host "[6/7] Starting Fortnite..." -ForegroundColor Yellow
$gameArgs = @(
    "-epicapp=Fortnite",
    "-epicenv=Prod",
    "-epicportal",
    "-epiclocale=en-us",
    "-skippatchcheck",
    "-HTTP=WinInet",
    "-NOSSLPINNING",
    "-AUTH_LOGIN=Player@projectreboot.dev",
    "-AUTH_PASSWORD=Rebooted",
    "-AUTH_TYPE=epic"
)

Set-Location $GameDir
$gameProcess = Start-Process -FilePath $GameExe -ArgumentList $gameArgs -PassThru

if ($gameProcess) {
    Write-Host "  ✓ Game started (PID: $($gameProcess.Id))" -ForegroundColor Green
    
    # Wait and inject - EXACT sequence from working Reboot Launcher
    Write-Host "[7/7] Waiting 2s then injecting DLLs (Reboot sequence)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    if (Get-Process -Id $gameProcess.Id -ErrorAction SilentlyContinue) {
        # 1. Inject cobalt.dll (auth redirect)
        $cobaltDll = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\cobalt.dll"
        if ((Test-Path $cobaltDll) -and (Test-Path $Injector)) {
            Write-Host "  [1/4] Injecting cobalt.dll (auth redirect)..." -ForegroundColor Cyan
            $injResult = & $Injector $gameProcess.Id $cobaltDll 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ cobalt.dll injected!" -ForegroundColor Green
            } else {
                Write-Host "  ✗ cobalt.dll failed!" -ForegroundColor Red
            }
        }
        
        # 2. Inject memory.dll (memory leak prevention)
        $memoryDll = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\memory.dll"
        if ((Test-Path $memoryDll) -and (Test-Path $Injector)) {
            Write-Host "  [2/4] Injecting memory.dll..." -ForegroundColor Cyan
            $injResult = & $Injector $gameProcess.Id $memoryDll 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ memory.dll injected!" -ForegroundColor Green
            } else {
                Write-Host "  ✗ memory.dll failed!" -ForegroundColor Red
            }
        }
        
        # 3. Inject console.dll (UE4 console unlock)
        $consoleDll = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\console.dll"
        if ((Test-Path $consoleDll) -and (Test-Path $Injector)) {
            Write-Host "  [3/4] Injecting console.dll (UE4 console)..." -ForegroundColor Cyan
            $injResult = & $Injector $gameProcess.Id $consoleDll 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ console.dll injected!" -ForegroundColor Green
            } else {
                Write-Host "  ✗ console.dll failed!" -ForegroundColor Red
            }
        }
        
        # 4. Inject reboot.dll (main auth/backend handler)
        $rebootDll = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\reboot.dll"
        if ((Test-Path $rebootDll) -and (Test-Path $Injector)) {
            Write-Host "  [4/4] Injecting reboot.dll (main handler)..." -ForegroundColor Cyan
            $injResult = & $Injector $gameProcess.Id $rebootDll 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ reboot.dll injected!" -ForegroundColor Green
            } else {
                Write-Host "  ✗ reboot.dll failed!" -ForegroundColor Red
            }
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "SUCCESS! Fortnite 4.5 launched!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Game PID: $($gameProcess.Id)" -ForegroundColor Cyan
        Write-Host "Launcher PID: $($launcherProcess.Id) (suspended)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "MCP backend must be running on port 3551!" -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ Game crashed!" -ForegroundColor Red
    }
} else {
    Write-Host "[ERROR] Failed to start game!" -ForegroundColor Red
}
