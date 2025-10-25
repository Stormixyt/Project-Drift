# Diagnose running Fortnite process
param(
    [int]$ProcessId
)

if (-not $ProcessId) {
    $process = Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue
    if ($process) {
        $ProcessId = $process.Id
    } else {
        Write-Host "Fortnite is not running!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== FORTNITE DIAGNOSTICS ===" -ForegroundColor Green
Write-Host "Process ID: $ProcessId" -ForegroundColor Cyan

# Check loaded DLLs
Write-Host "`n=== LOADED REBOOT DLLS ===" -ForegroundColor Yellow
$modules = Get-Process -Id $ProcessId | Select-Object -ExpandProperty Modules
$rebootDlls = $modules | Where-Object { 
    $_.ModuleName -like "*cobalt*" -or 
    $_.ModuleName -like "*console*" -or 
    $_.ModuleName -like "*reboot*" -or 
    $_.ModuleName -like "*memory*" -or
    $_.ModuleName -like "*sinum*" -or
    $_.ModuleName -like "*starfall*" -or
    $_.ModuleName -like "*bypass*"
}

if ($rebootDlls) {
    $rebootDlls | Select-Object ModuleName, @{Name="Path";Expression={$_.FileName}} | Format-Table -AutoSize
} else {
    Write-Host "  No Reboot DLLs loaded!" -ForegroundColor Red
}

# Check command line
Write-Host "`n=== COMMAND LINE ===" -ForegroundColor Yellow
try {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId").CommandLine
    Write-Host $cmdLine
} catch {
    Write-Host "  Failed to get command line: $_" -ForegroundColor Red
}

# Check parent process
Write-Host "`n=== PARENT PROCESS ===" -ForegroundColor Yellow
try {
    $parentId = (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId").ParentProcessId
    $parent = Get-Process -Id $parentId -ErrorAction SilentlyContinue
    if ($parent) {
        Write-Host "  $($parent.ProcessName) (PID: $parentId)"
        Write-Host "  Path: $($parent.Path)"
    }
} catch {
    Write-Host "  Failed to get parent: $_" -ForegroundColor Red
}

# Check network connections
Write-Host "`n=== NETWORK CONNECTIONS ===" -ForegroundColor Yellow
$connections = Get-NetTCPConnection -OwningProcess $ProcessId -ErrorAction SilentlyContinue
if ($connections) {
    $connections | Where-Object { $_.State -eq "Established" } | 
        Select-Object LocalPort, RemoteAddress, RemotePort, State | 
        Format-Table -AutoSize
    
    # Highlight backend connection
    $backendConn = $connections | Where-Object { $_.RemotePort -eq 3551 }
    if ($backendConn) {
        Write-Host "  ✓ Connected to MCP backend (port 3551)!" -ForegroundColor Green
    } else {
        Write-Host "  ✗ NOT connected to backend!" -ForegroundColor Red
    }
} else {
    Write-Host "  No active connections" -ForegroundColor Yellow
}

# Check if process is still alive
Write-Host "`n=== STATUS ===" -ForegroundColor Yellow
$proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "  ✓ Process is running" -ForegroundColor Green
    Write-Host "  Memory: $([math]::Round($proc.WorkingSet64 / 1MB, 2)) MB"
    Write-Host "  CPU Time: $($proc.TotalProcessorTime)"
} else {
    Write-Host "  ✗ Process has crashed/exited!" -ForegroundColor Red
}
