@echo off
echo ================================================
echo Project Drift - Disable Anti-Cheat
echo ================================================
echo.
echo This will disable BattlEye and EasyAntiCheat
echo for your Fortnite build.
echo.
pause

cd /d "%~dp0"

REM Kill any running anti-cheat processes
echo Stopping anti-cheat services...
taskkill /F /IM BEService_x64.exe 2>nul
taskkill /F /IM EasyAntiCheat.exe 2>nul
timeout /t 1 /nobreak >nul

REM Disable BattlEye
if exist "BattlEye" (
    if not exist "BattlEye.disabled" (
        echo Disabling BattlEye...
        ren "BattlEye" "BattlEye.disabled"
        echo ✓ BattlEye disabled
    ) else (
        echo ℹ️  BattlEye already disabled
    )
) else (
    echo ℹ️  BattlEye folder not found
)

REM Disable EasyAntiCheat
if exist "EasyAntiCheat" (
    if not exist "EasyAntiCheat.disabled" (
        echo Disabling EasyAntiCheat...
        ren "EasyAntiCheat" "EasyAntiCheat.disabled"
        echo ✓ EasyAntiCheat disabled
    ) else (
        echo ℹ️  EasyAntiCheat already disabled
    )
) else (
    echo ℹ️  EasyAntiCheat folder not found
)

echo.
echo ================================================
echo ✅ Anti-cheat has been disabled!
echo ================================================
echo.
echo You can now launch Fortnite without anti-cheat.
echo Use Launcher.bat to start the game.
echo.
echo To restore anti-cheat, run Restore-AntiCheat.bat
echo.
pause
