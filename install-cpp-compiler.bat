@echo off
echo ============================================
echo Visual Studio 2022 - Add C++ Compiler
echo ============================================
echo.
echo You have VS2022 but the C++ compiler is missing.
echo This will add ONLY the essential components:
echo   - MSVC v143 C++ x64/x86 build tools
echo   - Windows 10/11 SDK
echo.
echo Download size: ~2 GB
echo Install time: ~3-5 minutes
echo.
pause

echo.
echo Opening Visual Studio Installer...
echo.
echo STEPS TO FOLLOW:
echo 1. Click "Modify" on Visual Studio 2022 Community
echo 2. Go to "Individual components" tab
echo 3. Check these boxes:
echo    ✓ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
echo    ✓ Windows 10 SDK (10.0.22621.0 or latest)
echo    ✓ C++ core features
echo 4. Click "Modify" button
echo 5. Wait for installation
echo 6. Close installer
echo 7. Run build-bypass.bat again
echo.

start "" "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe" modify --installPath "C:\Program Files\Microsoft Visual Studio\2022\Community" --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows10SDK.22621 --passive --norestart

echo.
echo Installer opened! Follow the steps above.
echo.
pause
