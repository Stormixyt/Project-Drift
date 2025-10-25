#!/usr/bin/env pwsh
# Project Drift - Reboot Launcher Method
# This uses the same DLL injection technique as Reboot Launcher

$ErrorActionPreference = "Stop"

# Setup logging
$LogFile = Join-Path $PSScriptRoot "launch-reboot-method.log"
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

Write-Log "=== Project Drift - Reboot Launcher Method ===" "Cyan"
Write-Log "Using proven Reboot Launcher DLL injection technique" "Yellow"
Write-Log "Log file: $LogFile" "Gray"
Write-Log ""
& "C:\Users\Stormix\Downloads\Project Drift\launch-4.5-ultimate.ps1"
# Configuration
$BuildPath = "C:\Users\Stormix\Downloads\4.5"
$GameDir = Join-Path $BuildPath "FortniteGame\Binaries\Win64"
$LauncherExe = Join-Path $GameDir "FortniteLauncher.exe"
$EacExe = Join-Path $GameDir "FortniteClient-Win64-Shipping_EAC.exe"
$GameExe = Join-Path $GameDir "FortniteClient-Win64-Shipping.exe"
$BypassDLL = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\bypass.dll"

Write-Log "Configuration:" "Cyan"
Write-Log "  Build Path: $BuildPath" "Gray"
Write-Log "  Game Dir: $GameDir" "Gray"
Write-Log "  Bypass DLL: $BypassDLL" "Gray"
Write-Log ""

# Validation
if (-not (Test-Path $GameExe)) {
    Write-Log "[ERROR] Fortnite executable not found at: $GameExe" "Red"
    exit 1
}

if (-not (Test-Path $BypassDLL)) {
    Write-Log "[ERROR] bypass.dll not found at: $BypassDLL" "Red"
    exit 1
}

# Function to suspend a process
function Suspend-Process {
    param([int]$ProcessId)
    
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    
    public class NtDll {
        [DllImport("ntdll.dll", SetLastError = true)]
        public static extern int NtSuspendProcess(IntPtr processHandle);
        
        [DllImport("kernel32.dll")]
        public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, int processId);
        
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CloseHandle(IntPtr hObject);
    }
"@
    
    $PROCESS_ALL_ACCESS = 0x1F0FFF
    $hProcess = [NtDll]::OpenProcess($PROCESS_ALL_ACCESS, $false, $ProcessId)
    
    if ($hProcess -eq [IntPtr]::Zero) {
        return $false
    }
    
    $result = [NtDll]::NtSuspendProcess($hProcess)
    [NtDll]::CloseHandle($hProcess)
    
    return $result -eq 0
}

# Function to inject DLL
function Inject-DLL {
    param([int]$ProcessId, [string]$DllPath)
    
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    using System.Text;
    
    public class Kernel32 {
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, int processId);
        
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr VirtualAllocEx(IntPtr hProcess, IntPtr lpAddress, uint dwSize, uint flAllocationType, uint flProtect);
        
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, uint nSize, out UIntPtr lpNumberOfBytesWritten);
        
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr GetModuleHandle(string lpModuleName);
        
        [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
        public static extern IntPtr GetProcAddress(IntPtr hModule, string procName);
        
        [DllImport("kernel32.dll")]
        public static extern IntPtr CreateRemoteThread(IntPtr hProcess, IntPtr lpThreadAttributes, uint dwStackSize, IntPtr lpStartAddress, IntPtr lpParameter, uint dwCreationFlags, IntPtr lpThreadId);
        
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);
        
        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CloseHandle(IntPtr hObject);
    }
"@
    
    $PROCESS_ALL_ACCESS = 0x1F0FFF
    $MEM_COMMIT = 0x1000
    $MEM_RESERVE = 0x2000
    $PAGE_READWRITE = 0x04
    
    $hProcess = [Kernel32]::OpenProcess($PROCESS_ALL_ACCESS, $false, $ProcessId)
    if ($hProcess -eq [IntPtr]::Zero) {
        return $false
    }
    
    $dllBytes = [System.Text.Encoding]::Unicode.GetBytes($DllPath + "`0")
    $pRemotePath = [Kernel32]::VirtualAllocEx($hProcess, [IntPtr]::Zero, $dllBytes.Length, $MEM_COMMIT -bor $MEM_RESERVE, $PAGE_READWRITE)
    
    if ($pRemotePath -eq [IntPtr]::Zero) {
        [Kernel32]::CloseHandle($hProcess)
        return $false
    }
    
    $bytesWritten = [UIntPtr]::Zero
    $writeResult = [Kernel32]::WriteProcessMemory($hProcess, $pRemotePath, $dllBytes, $dllBytes.Length, [ref]$bytesWritten)
    
    if (-not $writeResult) {
        [Kernel32]::CloseHandle($hProcess)
        return $false
    }
    
    $hKernel32 = [Kernel32]::GetModuleHandle("kernel32.dll")
    $pLoadLibraryW = [Kernel32]::GetProcAddress($hKernel32, "LoadLibraryW")
    
    if ($pLoadLibraryW -eq [IntPtr]::Zero) {
        [Kernel32]::CloseHandle($hProcess)
        return $false
    }
    
    $hThread = [Kernel32]::CreateRemoteThread($hProcess, [IntPtr]::Zero, 0, $pLoadLibraryW, $pRemotePath, 0, [IntPtr]::Zero)
    
    if ($hThread -eq [IntPtr]::Zero) {
        [Kernel32]::CloseHandle($hProcess)
        return $false
    }
    
    # INFINITE = 0xFFFFFFFF but as uint32 max value
    $INFINITE = [uint32]::MaxValue
    [Kernel32]::WaitForSingleObject($hThread, $INFINITE) | Out-Null
    [Kernel32]::CloseHandle($hThread)
    [Kernel32]::CloseHandle($hProcess)
    
    return $true
}

try {
    # Step 1: Start FortniteLauncher suspended (if exists)
    Write-Log "[1/6] Starting FortniteLauncher.exe (suspended)..." "Yellow"
    $launcherPid = $null
    if (Test-Path $LauncherExe) {
        $launcherProcess = Start-Process -FilePath $LauncherExe -WindowStyle Hidden -PassThru
        $launcherPid = $launcherProcess.Id
        Suspend-Process -ProcessId $launcherPid | Out-Null
        Write-Log "  ✓ FortniteLauncher started (PID: $launcherPid, suspended)" "Green"
    } else {
        Write-Log "  ⚠ FortniteLauncher.exe not found (skipping)" "Yellow"
    }
    
    # Step 2: Start EAC suspended (if exists)
    Write-Log "[2/6] Starting EAC process (suspended)..." "Yellow"
    $eacPid = $null
    if (Test-Path $EacExe) {
        $eacProcess = Start-Process -FilePath $EacExe -WindowStyle Hidden -PassThru
        $eacPid = $eacProcess.Id
        Suspend-Process -ProcessId $eacPid | Out-Null
        Write-Log "  ✓ EAC started (PID: $eacPid, suspended)" "Green"
    } else {
        Write-Log "  ⚠ EAC exe not found (skipping)" "Yellow"
    }
    
    # Step 3: Disable BattlEye DLL and start Fortnite
    Write-Log "[3/6] Starting Fortnite..." "Yellow"
    
    # COMPLETELY REMOVE BattlEye DLL to prevent initialization errors
    $beDll = Join-Path $GameDir "BattlEye\BEClient_x64.dll"
    $beDllBackup = "$beDll.bak"
    if (Test-Path $beDll) {
        try {
            # Make backup first
            if (!(Test-Path $beDllBackup)) {
                Copy-Item -Path $beDll -Destination $beDllBackup -Force
            }
            # DELETE the DLL completely
            Remove-Item -Path $beDll -Force -ErrorAction Stop
            Write-Log "  ✓ BattlEye DLL removed" "Green"
        } catch {
            Write-Log "  ! Could not remove BattlEye DLL: $_" "Yellow"
        }
    }
    
    $gameArgs = @(
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
        "-noeac",
        "-AUTH_LOGIN=Player@projectreboot.dev",
        "-AUTH_PASSWORD=Rebooted",
        "-AUTH_TYPE=epic"
    )
    
    $processStartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processStartInfo.FileName = $GameExe
    $processStartInfo.Arguments = $gameArgs -join " "
    $processStartInfo.WorkingDirectory = $GameDir
    $processStartInfo.UseShellExecute = $false
    
    $gameProcess = [System.Diagnostics.Process]::Start($processStartInfo)
    $gamePid = $gameProcess.Id
    
    Write-Log "  ✓ Fortnite started (PID: $gamePid)" "Green"
    
    # Step 4: Wait for initialization
    Write-Log "[4/6] Waiting for game to initialize (2 seconds)..." "Yellow"
    Start-Sleep -Seconds 2
    
    # Check if still running
    if ($gameProcess.HasExited) {
        Write-Log "[ERROR] Fortnite crashed! Exit code: $($gameProcess.ExitCode)" "Red"
        exit 1
    }
    
    Write-Log "  ✓ Game still running" "Green"
    
    # Step 5: Inject Reboot Launcher DLLs (in correct order)
    Write-Log "[5/6] Injecting DLLs..." "Yellow"
    
    # First: cobalt.dll (auth/backend bypass) - MOST CRITICAL!
    $cobaltDLL = Join-Path $PSScriptRoot "release\bypass\cobalt.dll"
    Write-Log "  [1/3] Injecting cobalt.dll (auth bypass)..." "Cyan"
    $cobaltResult = Inject-DLL -ProcessId $gamePid -DllPath $cobaltDLL
    if (!$cobaltResult) {
        Write-Log "[ERROR] cobalt.dll injection failed!" "Red"
        exit 1
    }
    Write-Log "  ✓ cobalt.dll injected" "Green"
    
    # Second: console.dll (UE4 console)
    $consoleDLL = Join-Path $PSScriptRoot "release\bypass\console.dll"
    Write-Log "  [2/3] Injecting console.dll (UE4 console)..." "Cyan"
    $consoleResult = Inject-DLL -ProcessId $gamePid -DllPath $consoleDLL
    if (!$consoleResult) {
        Write-Log "[WARN] console.dll injection failed (non-critical)" "Yellow"
    } else {
        Write-Log "  ✓ console.dll injected" "Green"
    }
    
    # Third: Our bypass.dll (additional hooks)
    Write-Log "  [3/3] Injecting bypass.dll (additional hooks)..." "Cyan"
    $injectionResult = Inject-DLL -ProcessId $gamePid -DllPath $BypassDLL
    
    if ($injectionResult) {
        Write-Log "  ✓ bypass.dll injected" "Green"
    } else {
        Write-Log "[WARN] bypass.dll injection failed (non-critical)" "Yellow"
    }
    
    # Step 6: Done
    Write-Log "[6/6] Launch sequence complete!" "Yellow"
    Write-Log ""
    Write-Log "========================================" "Green"
    Write-Log "SUCCESS! Fortnite launched with bypass" "Green"
    Write-Log "========================================" "Green"
    Write-Log ""
    Write-Log "Game PID: $gamePid" "Cyan"
    if ($launcherPid) { Write-Log "Launcher PID: $launcherPid (suspended)" "Cyan" }
    if ($eacPid) { Write-Log "EAC PID: $eacPid (suspended)" "Cyan" }
    Write-Log ""
    Write-Log "Make sure MCP backend is running on port 3551!" "Yellow"
    Write-Log "To start backend: cd mcp-backend && npm run dev" "Yellow"
    Write-Log ""
    Write-Log "Full log: $LogFile" "Gray"
    
} catch {
    Write-Log "[ERROR] Fatal error: $_" "Red"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "Gray"
    exit 1
}
