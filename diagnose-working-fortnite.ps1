# Compare running Fortnite process
# Run this while game is running via Reboot Launcher to capture working state

Write-Host "=== DIAGNOSTIC: Capture Working State ===" -ForegroundColor Cyan
Write-Host ""

# Find Fortnite process
$fortnite = Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue

if (!$fortnite) {
    Write-Host "Fortnite is not running! Start it via Reboot Launcher first." -ForegroundColor Red
    exit 1
}

Write-Host "Found Fortnite PID: $($fortnite.Id)" -ForegroundColor Green
Write-Host ""

# Get command line
Write-Host "=== COMMAND LINE ===" -ForegroundColor Yellow
$cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($fortnite.Id)").CommandLine
Write-Host $cmdLine
Write-Host ""

# Get parent process
Write-Host "=== PARENT PROCESS ===" -ForegroundColor Yellow
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId = $($fortnite.Id)").ParentProcessId
$parent = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
if ($parent) {
    Write-Host "PID: $($parent.Id)"
    Write-Host "Name: $($parent.ProcessName)"
    Write-Host "Path: $($parent.Path)"
    
    # Check if suspended
    $threads = $parent.Threads
    $suspendedCount = 0
    foreach ($thread in $threads) {
        if ($thread.ThreadState -eq "Wait" -and $thread.WaitReason -eq "Suspended") {
            $suspendedCount++
        }
    }
    Write-Host "Suspended threads: $suspendedCount / $($threads.Count)"
}
Write-Host ""

# Get loaded DLLs
Write-Host "=== LOADED REBOOT DLLS ===" -ForegroundColor Yellow
$fortnite.Modules | Where-Object {
    $_.ModuleName -like "*cobalt*" -or
    $_.ModuleName -like "*memory*" -or
    $_.ModuleName -like "*console*" -or
    $_.ModuleName -like "*reboot*"
} | Select-Object ModuleName, FileName | Format-Table -AutoSize
Write-Host ""

# Get network connections
Write-Host "=== NETWORK CONNECTIONS ===" -ForegroundColor Yellow
Get-NetTCPConnection -OwningProcess $fortnite.Id -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Established" } |
    Select-Object LocalPort, RemoteAddress, RemotePort | Format-Table -AutoSize
Write-Host ""

# Check for Epic Launcher window
Write-Host "=== EPIC LAUNCHER WINDOWS ===" -ForegroundColor Yellow
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    using System.Text;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
        
        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);
    }
"@

$epicWindow = [Win32]::FindWindow("EpicGamesLauncher", $null)
if ($epicWindow -ne [IntPtr]::Zero) {
    Write-Host "✓ EpicGamesLauncher window exists (Handle: $epicWindow)" -ForegroundColor Green
} else {
    Write-Host "✗ No EpicGamesLauncher window found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== SAVE THIS OUTPUT ===" -ForegroundColor Cyan
Write-Host "This is the WORKING configuration. Compare with Project Drift launcher!" -ForegroundColor Yellow
