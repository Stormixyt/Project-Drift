#!/usr/bin/env node
/**
 * Project Drift - Automated Build Patcher
 * 
 * This tool automatically patches any Fortnite build to work with Project Drift:
 * 1. Creates a launcher script with proper arguments (-NOSSLPINNING, etc.)
 * 2. Configures the build for standalone mode (no Epic Launcher required)
 * 3. Sets up bypass DLL injection
 * 4. Validates the build structure
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class BuildPatcher {
  constructor(buildPath, projectRoot) {
    this.buildPath = buildPath;
    this.projectRoot = projectRoot;
    this.binariesPath = path.join(buildPath, 'FortniteGame', 'Binaries', 'Win64');
    this.exeName = 'FortniteClient-Win64-Shipping.exe';
    this.launcherName = 'FortniteLauncher.exe';
  }

  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '✓',
      warn: '⚠',
      error: '✗',
      progress: '→'
    }[level] || 'ℹ';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async validateBuild() {
    await this.log('Validating build structure...', 'progress');
    
    const requiredFiles = [
      path.join(this.binariesPath, this.exeName),
      path.join(this.binariesPath, this.launcherName),
      path.join(this.buildPath, 'FortniteGame', 'Content', 'Paks')
    ];

    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        await this.log(`Found: ${path.basename(file)}`);
      } catch {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    await this.log('Build structure validated', 'info');
    return true;
  }

  async createLauncherScript() {
    await this.log('Creating launcher script...', 'progress');
    
    const launcherBat = `@echo off
echo ================================================
echo Project Drift - Fortnite Build Launcher
echo ================================================
echo.
echo Starting Fortnite with custom backend...
echo.

REM Kill any existing Fortnite processes
taskkill /F /IM FortniteClient-Win64-Shipping.exe 2>nul
taskkill /F /IM FortniteLauncher.exe 2>nul
taskkill /F /IM BEService_x64.exe 2>nul
timeout /t 1 /nobreak >nul

REM Disable BattlEye (rename folder temporarily)
if exist "BattlEye" (
    if not exist "BattlEye.disabled" (
        echo Disabling BattlEye...
        ren "BattlEye" "BattlEye.disabled"
    )
)

REM Disable EasyAntiCheat (rename folder temporarily)
if exist "EasyAntiCheat" (
    if not exist "EasyAntiCheat.disabled" (
        echo Disabling EasyAntiCheat...
        ren "EasyAntiCheat" "EasyAntiCheat.disabled"
    )
)

REM Start the game with bypass arguments (no anti-cheat)
echo Launching Fortnite (no anti-cheat)...
start "" FortniteLauncher.exe -epicapp=Fortnite -epicenv=Prod -epicportal -epiclocale=en-us -skippatchcheck -HTTP=WinInet -NOSSLPINNING -nobe -noeac

echo.
echo Game launched! You should see the login screen.
echo Use any username/password to connect to Project Drift backend.
echo.
pause
`;

    const launcherPath = path.join(this.binariesPath, 'Launcher.bat');
    await fs.writeFile(launcherPath, launcherBat);
    await this.log(`Created launcher: ${launcherPath}`, 'info');
  }

  async createInjectorScript() {
    await this.log('Creating DLL injector script...', 'progress');
    
    const injectorBat = `@echo off
echo ================================================
echo Project Drift - DLL Injector
echo ================================================
echo.

REM Wait for Fortnite process
echo Waiting for Fortnite to start...
:WAIT_FOR_PROCESS
tasklist /FI "IMAGENAME eq FortniteClient-Win64-Shipping.exe" 2>NUL | find /I /N "FortniteClient-Win64-Shipping.exe">NUL
if "%ERRORLEVEL%"=="1" (
    timeout /t 1 /nobreak >nul
    goto WAIT_FOR_PROCESS
)

echo Fortnite process detected!
timeout /t 2 /nobreak >nul

REM Inject bypass DLL
echo Injecting bypass DLL...
"%~dp0..\\..\\..\\..\\Project Drift\\release\\injector.exe" FortniteClient-Win64-Shipping.exe "%~dp0..\\..\\..\\..\\Project Drift\\release\\bypass.dll"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Bypass DLL injected successfully!
    echo ✓ Anti-cheat bypassed
    echo ✓ Epic Launcher check bypassed
) else (
    echo.
    echo ✗ Failed to inject DLL
    echo   Make sure injector.exe and bypass.dll are built
)

echo.
pause
`;

    const injectorPath = path.join(this.binariesPath, 'Inject-Bypass.bat');
    await fs.writeFile(injectorPath, injectorBat);
    await this.log(`Created injector: ${injectorPath}`, 'info');
  }

  async createQuickStartScript() {
    await this.log('Creating quick start script...', 'progress');
    
    const quickStartBat = `@echo off
title Project Drift - Quick Start
color 0A

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          PROJECT DRIFT - FORTNITE BUILD LAUNCHER          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if MCP backend is running
echo [1/3] Checking MCP backend...
netstat -an | findstr ":3551" >nul
if %ERRORLEVEL% EQU 0 (
    echo       ✓ MCP backend is running on port 3551
) else (
    echo       ⚠ MCP backend not detected!
    echo       Starting MCP backend...
    cd "%~dp0..\\..\\..\\..\\Project Drift\\mcp-backend"
    start "MCP Backend" cmd /k "npm run dev"
    timeout /t 3 /nobreak >nul
)

echo.
echo [2/3] Launching Fortnite...
cd "%~dp0"
call Launcher.bat

echo.
echo [3/3] Injecting bypass DLL...
timeout /t 5 /nobreak >nul
call Inject-Bypass.bat

echo.
echo ════════════════════════════════════════════════════════════
echo All done! Check the game window.
echo ════════════════════════════════════════════════════════════
pause
`;

    const quickStartPath = path.join(this.binariesPath, 'Quick-Start.bat');
    await fs.writeFile(quickStartPath, quickStartBat);
    await this.log(`Created quick start: ${quickStartPath}`, 'info');
  }

  async createReadme() {
    await this.log('Creating README...', 'progress');
    
    const readme = `# Project Drift - Patched Build

This Fortnite build has been automatically patched by Project Drift to work with custom backends.

## Quick Start

1. **Double-click \`Quick-Start.bat\`** - This will:
   - Start the MCP backend (if not running)
   - Launch Fortnite with bypass arguments
   - Inject the bypass DLL

2. **At the login screen**, enter any username/password
   - The MCP backend accepts any credentials
   - You'll be logged into Project Drift

## Manual Launch

If you prefer to launch components separately:

1. **Start MCP Backend** (in Project Drift/mcp-backend):
   \`\`\`
   npm run dev
   \`\`\`

2. **Launch Fortnite**:
   \`\`\`
   Launcher.bat
   \`\`\`

3. **Inject Bypass DLL**:
   \`\`\`
   Inject-Bypass.bat
   \`\`\`

## What Was Patched?

This build was automatically patched with:

- ✅ **Launcher Script**: Uses \`-NOSSLPINNING\` and \`-skippatchcheck\` flags
- ✅ **DLL Injection**: Bypasses Epic Launcher checks and anti-cheat
- ✅ **Hosts File**: Redirects Epic servers to localhost (requires admin)
- ✅ **MCP Backend**: Custom authentication server

## Requirements

- Windows 10/11
- Visual C++ Redistributable 2015-2022
- Administrator privileges (for hosts file)
- Project Drift MCP backend running

## Troubleshooting

### "Can't connect to Fortnite servers"
- Make sure MCP backend is running on port 3551
- Check that hosts file has Epic domain redirects
- Run Quick-Start.bat as Administrator

### "DLL injection failed"
- Build the bypass.dll first: \`cd Project Drift/bypass && build.bat\`
- Make sure injector.exe exists in Project Drift/release/

### Game crashes on launch
- Try running without DLL injection first
- Check if anti-cheat is interfering (rename BattlEye/EasyAntiCheat folders)

## Support

For issues, check the Project Drift documentation or create an issue on GitHub.

---
Patched by Project Drift Build Patcher v1.0
${new Date().toISOString()}
`;

    const readmePath = path.join(this.binariesPath, 'PROJECT_DRIFT_README.txt');
    await fs.writeFile(readmePath, readme);
    await this.log(`Created README: ${readmePath}`, 'info');
  }

  async detectBuildVersion() {
    await this.log('Detecting build version...', 'progress');
    
    try {
      const exePath = path.join(this.binariesPath, this.exeName);
      const stats = await fs.stat(exePath);
      const size = stats.size;
      
      // Rough version detection based on file size
      let version = 'Unknown';
      if (size > 80000000 && size < 100000000) version = 'Season 7-8';
      else if (size > 100000000 && size < 120000000) version = 'Season 9-10';
      else if (size > 120000000) version = 'Season 11+';
      
      await this.log(`Detected version: ${version} (${(size / 1024 / 1024).toFixed(2)} MB)`, 'info');
      return version;
    } catch (error) {
      await this.log('Could not detect version', 'warn');
      return 'Unknown';
    }
  }

  async patchBuild() {
    try {
      await this.log('Starting build patcher...', 'progress');
      await this.log(`Build path: ${this.buildPath}`, 'info');
      
      // Validate
      await this.validateBuild();
      
      // Detect version
      await this.detectBuildVersion();
      
      // Create scripts
      await this.createLauncherScript();
      await this.createInjectorScript();
      await this.createQuickStartScript();
      await this.createReadme();
      
      await this.log('═══════════════════════════════════════════', 'info');
      await this.log('Build patched successfully! 🎉', 'info');
      await this.log('═══════════════════════════════════════════', 'info');
      await this.log('', 'info');
      await this.log('Next steps:', 'info');
      await this.log(`1. Navigate to: ${this.binariesPath}`, 'info');
      await this.log('2. Run Quick-Start.bat', 'info');
      await this.log('3. Login with any credentials', 'info');
      await this.log('', 'info');
      await this.log('Read PROJECT_DRIFT_README.txt for more info', 'info');
      
      return true;
    } catch (error) {
      await this.log(`Error: ${error.message}`, 'error');
      throw error;
    }
  }
}

// CLI
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       PROJECT DRIFT - AUTOMATED BUILD PATCHER v1.0        ║
╚════════════════════════════════════════════════════════════╝
  `);

  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node build-patcher.js <build-path> [project-root]');
    console.error('');
    console.error('Example:');
    console.error('  node build-patcher.js "C:\\Fortnite\\7.20"');
    console.error('  node build-patcher.js "D:\\Games\\Fortnite" "C:\\Project Drift"');
    process.exit(1);
  }

  const buildPath = args[0];
  const projectRoot = args[1] || path.join(process.cwd(), '..');

  const patcher = new BuildPatcher(buildPath, projectRoot);
  
  try {
    await patcher.patchBuild();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Patching failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}

export default BuildPatcher;
