@echo off
echo Creating Project Drift Launcher Installer...
echo.

REM Create dist directory
if not exist "dist" mkdir dist

REM Copy launcher files
echo Copying launcher files...
xcopy /E /I /Y "src" "dist\launcher\src" >nul
copy "package.json" "dist\launcher\" >nul
copy "README.md" "dist\launcher\" >nul

REM Copy backend
echo Copying MCP backend...
xcopy /E /I /Y "..\mcp-backend" "dist\launcher\mcp-backend" >nul

REM Copy bypass files
echo Copying bypass files...
xcopy /E /I /Y "..\release\bypass" "dist\launcher\release\bypass" >nul

REM Copy docs
echo Copying documentation...
xcopy /E /I /Y "..\docs" "dist\launcher\docs" >nul

REM Create node_modules (this would be large, so we'll create a script to install)
echo Creating installation script...
(
echo @echo off
echo echo Installing Project Drift Launcher...
echo echo.
echo echo This will install all required dependencies.
echo echo This may take a few minutes...
echo echo.
echo npm install --production
echo echo.
echo echo Installation complete!
echo echo.
echo echo To run the launcher, execute: npm start
echo pause
) > "dist\Install.bat"

REM Create a simple run script
(
echo @echo off
echo echo Starting Project Drift Launcher...
echo npm start
) > "dist\Run.bat"

REM Create README for the installer
(
echo Project Drift Launcher
echo ======================
echo.
echo Installation:
echo 1. Run Install.bat to install dependencies
echo 2. Run Run.bat to start the launcher
echo.
echo Or manually:
echo 1. Open command prompt in this directory
echo 2. Run: npm install
echo 3. Run: npm start
echo.
echo Requirements:
echo - Node.js 16+
echo - Windows 10/11
echo.
echo For more information, visit: https://github.com/Stormixyt/Project-Drift
) > "dist\README.txt"

echo.
echo Creating ZIP archive...
powershell "Compress-Archive -Path 'dist\launcher\*' -DestinationPath 'dist\Project-Drift-Launcher-v1.0.0.zip' -Force"

echo.
echo Build complete!
echo.
echo Files created:
echo - dist\Project-Drift-Launcher-v1.0.0.zip (Main installer)
echo - dist\Install.bat (Installation script)
echo - dist\Run.bat (Run script)
echo - dist\README.txt (Instructions)
echo.
echo The ZIP file contains everything needed to run Project Drift Launcher.
pause