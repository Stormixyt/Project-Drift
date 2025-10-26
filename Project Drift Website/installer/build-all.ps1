<#
Orchestrates building the installer UI pipeline locally:
1. Generate AppIcon.ico from InstallerImage.png
2. Build the Electron launcher (so ProjectDriftLauncher.exe exists)
3. Run build-installer.ps1 to compile the Inno Setup installer

Run from repo root with:
  Set-Location 'C:\path\to\repo' ; .\"Project Drift Website\installer\build-all.ps1"
#>

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")

Push-Location $scriptRoot
Write-Host "Generating AppIcon.ico from InstallerImage.png..."
& (Join-Path $scriptRoot 'tools\generate-appicon.ps1')
if ($LASTEXITCODE -ne 0) { Write-Error "generate-appicon failed" ; Pop-Location ; exit 1 }

Pop-Location

# Build launcher
Push-Location (Join-Path $repoRoot 'launcher')
Write-Host "Installing launcher dependencies and building for Windows... (this may take a minute)"
npm ci
if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed" ; Pop-Location ; exit 1 }

npm run build:win
if ($LASTEXITCODE -ne 0) { Write-Error "launcher build failed" ; Pop-Location ; exit 1 }
Pop-Location

# Run installer build
Push-Location $scriptRoot
Write-Host "Running build-installer.ps1 to compile the Inno Setup installer..."
& (Join-Path $scriptRoot 'build-installer.ps1')
$rc = $LASTEXITCODE
Pop-Location

if ($rc -ne 0) {
    Write-Error "Installer build failed with exit code $rc"
    exit $rc
}

Write-Host "All done. Installer output is in: $(Join-Path $scriptRoot 'Output')"
