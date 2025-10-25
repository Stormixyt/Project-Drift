# Simple 4.5 Launcher - No DLL Injection
# Just launch with proper AUTH args

$BuildPath = "C:\Users\Stormix\Downloads\4.5"
$GameDir = Join-Path $BuildPath "FortniteGame\Binaries\Win64"
$GameExe = Join-Path $GameDir "FortniteClient-Win64-Shipping.exe"

Write-Host "=== Project Drift - Simple 4.5 Launch ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Build: $BuildPath" -ForegroundColor Gray
Write-Host "Game: $GameExe" -ForegroundColor Gray
Write-Host ""

# Check if game exists
if (!(Test-Path $GameExe)) {
    Write-Host "[ERROR] Game not found at: $GameExe" -ForegroundColor Red
    exit 1
}

# Kill any existing Fortnite processes
Write-Host "[1/3] Cleaning up old processes..." -ForegroundColor Yellow
Stop-Process -Name "FortniteClient-Win64-Shipping","FortniteLauncher","FortniteClient-Win64-Shipping_EAC" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Write-Host "  ✓ Cleanup complete" -ForegroundColor Green

# Remove BattlEye DLL if it exists
Write-Host "[2/4] Disabling BattlEye..." -ForegroundColor Yellow
$beDll = Join-Path $GameDir "BattlEye\BEClient_x64.dll"
$beBackup = "$beDll.bak"
if (Test-Path $beDll) {
    if (!(Test-Path $beBackup)) {
        Copy-Item -Path $beDll -Destination $beBackup -Force
    }
    Remove-Item -Path $beDll -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ BattlEye disabled" -ForegroundColor Green
} else {
    Write-Host "  ✓ BattlEye already disabled" -ForegroundColor Green
}

# Delete NVIDIA Aftermath crash reporter (Reboot Launcher does this!)
Write-Host "[3/4] Removing NVIDIA crash reporter..." -ForegroundColor Yellow
$aftermathDlls = Get-ChildItem -Path (Split-Path $GameDir) -Recurse -Filter "GFSDK_Aftermath_Lib.x64.dll" -ErrorAction SilentlyContinue
foreach ($dll in $aftermathDlls) {
    try {
        Remove-Item -Path $dll.FullName -Force
        Write-Host "  ✓ Removed $($dll.FullName)" -ForegroundColor Green
    } catch {
        Write-Host "  ! Could not remove $($dll.Name)" -ForegroundColor Yellow
    }
}
if ($aftermathDlls.Count -eq 0) {
    Write-Host "  ✓ No NVIDIA Aftermath DLLs found" -ForegroundColor Green
}

# Launch game with AUTH args
Write-Host "[4/4] Launching Fortnite 4.5..." -ForegroundColor Yellow

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
$process = Start-Process -FilePath $GameExe -ArgumentList $gameArgs -PassThru

if ($process) {
    Write-Host "  ✓ Fortnite started (PID: $($process.Id))" -ForegroundColor Green
    
    # Wait for game to initialize
    Write-Host "  ⏳ Waiting 2 seconds for initialization..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    # Check if still running
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) {
        # Inject ONLY our bypass.dll (not Reboot's DLLs which crash on 4.5)
        Write-Host "  [4/4] Injecting bypass.dll..." -ForegroundColor Yellow
        
        $bypassDll = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\bypass.dll"
        $injector = "C:\Users\Stormix\Downloads\Project Drift\release\bypass\injector.exe"
        
        if ((Test-Path $bypassDll) -and (Test-Path $injector)) {
            $injResult = & $injector $process.Id $bypassDll 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ bypass.dll injected" -ForegroundColor Green
            } else {
                Write-Host "  ! bypass.dll injection failed (non-critical)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  ! bypass.dll or injector not found (skipping)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✗ Game crashed during initialization" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Fortnite 4.5 is running!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Game PID: $($process.Id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Make sure MCP backend is running on port 3551!" -ForegroundColor Yellow
    Write-Host "To start backend: cd mcp-backend && npm run dev" -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] Failed to start Fortnite!" -ForegroundColor Red
    exit 1
}
