@echo off
echo ========================================
echo    Project Drift Installer
echo ========================================
echo.
echo This installer will download and set up
echo Project Drift launcher automatically.
echo.
echo Press any key to continue...
pause >nul

echo Checking for existing installation...
powershell -Command "
$exePath = '$env:USERPROFILE\Project Drift\Project Drift.exe'
if (Test-Path $exePath) {
    Write-Host 'Installation already exists!'
    Write-Host 'Press any key to launch Project Drift...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    Start-Process $exePath
    exit 0
} else {
    Write-Host 'No existing installation found, proceeding with install...'
}
"

echo.
echo Creating installation directory...
if not exist "%USERPROFILE%\Project Drift" mkdir "%USERPROFILE%\Project Drift"

echo.
echo Downloading Project Drift launcher...
echo This may take a few minutes depending on your connection...

powershell -Command "
try {
    # Try to download from GitHub releases first
    $url = 'https://github.com/Stormixyt/Project-Drift/releases/latest/download/ProjectDriftLauncher.zip'
    $output = '$env:TEMP\launcher.zip'
    Write-Host 'Downloading from GitHub releases...'
    Invoke-WebRequest -Uri $url -OutFile $output -ErrorAction Stop
    Write-Host 'Download successful!'
} catch {
    # Fallback to local file if remote fails
    Write-Host 'Remote download failed, using local fallback...'
    $localPath = '$PSScriptRoot\..\launcher\dist\Project-Drift-Launcher-v1.0.0.zip'
    if (Test-Path $localPath) {
        Copy-Item $localPath $output
        Write-Host 'Using local fallback file.'
    } else {
        Write-Error 'No download source available!'
        exit 1
    }
}

# Extract the zip
Write-Host 'Extracting launcher...'
Expand-Archive -Path $output -DestinationPath '$env:USERPROFILE\Project Drift' -Force

# Clean up
Remove-Item $output -ErrorAction SilentlyContinue

# Verify installation
$exePath = '$env:USERPROFILE\Project Drift\Project Drift.exe'
if (Test-Path $exePath) {
    Write-Host 'Installation successful!'
} else {
    Write-Error 'Installation failed - executable not found!'
    exit 1
}
"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Installation failed!
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo.
echo Creating desktop shortcut...
powershell -Command "
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('$env:USERPROFILE\Desktop\Project Drift.lnk')
$Shortcut.TargetPath = '$env:USERPROFILE\Project Drift\Project Drift.exe'
$Shortcut.IconLocation = '$env:USERPROFILE\Project Drift\Project Drift.exe,0'
$Shortcut.Save()
"

echo.
echo Creating start menu shortcut...
powershell -Command "
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Project Drift.lnk')
$Shortcut.TargetPath = '$env:USERPROFILE\Project Drift\Project Drift.exe'
$Shortcut.IconLocation = '$env:USERPROFILE\Project Drift\Project Drift.exe,0'
$Shortcut.Save()
"

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo Project Drift has been installed to:
echo %USERPROFILE%\Project Drift\
echo.
echo Shortcuts created on desktop and start menu.
echo.
echo Press any key to launch Project Drift...
powershell -Command "$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"

powershell -Command "Start-Process '$env:USERPROFILE\Project Drift\Project Drift.exe'"