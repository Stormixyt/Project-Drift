# Test 7.20 ERA build - should work without ANY injection
$BuildPath = "C:\Users\Stormix\Downloads\7.20"
$GameDir = Join-Path $BuildPath "FortniteGame\Binaries\Win64"
$GameExe = Join-Path $GameDir "FortniteClient-Win64-Shipping.exe"

Write-Host "=== Testing 7.20 ERA Build ===" -ForegroundColor Cyan

if (!(Test-Path $GameExe)) {
    Write-Host "[ERROR] Game not found" -ForegroundColor Red
    exit 1
}

Stop-Process -Name "FortniteClient-Win64-Shipping","FortniteLauncher" -Force -ErrorAction SilentlyContinue

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
Write-Host "7.20 started (PID: $($process.Id))" -ForegroundColor Green
