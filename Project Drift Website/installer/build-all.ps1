<#
Orchestrates building the installer UI pipeline locally:
1. Generate AppIcon.ico from InstallerImage.png
2. Build the Electron launcher (so ProjectDriftLauncher.exe exists)
3. Run build-installer.ps1 to compile the Inno Setup installer

Run from repo root with:
  Set-Location 'C:\path\to\repo' ; .\"Project Drift Website\installer\build-all.ps1"
#>

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")

Push-Location $scriptRoot
Write-Host "Generating AppIcon.ico from InstallerImage.png..."
& (Join-Path $scriptRoot 'tools\generate-appicon.ps1')
if (-not $?) { Write-Error "generate-appicon failed" ; Pop-Location ; exit 1 }

Pop-Location

# Build launcher
Push-Location (Join-Path $repoRoot 'launcher')
Write-Host "Installing launcher dependencies and building for Windows... (this may take a minute)"
npm ci
if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed" ; Pop-Location ; exit 1 }

try {
  npm run build:win
  if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }
} catch {
  Write-Host "electron-builder failed; falling back to electron-packager (npx). Error: $_"
  # attempt to package with electron-packager to create a runnable exe folder
  Write-Host "Running npx electron-packager..."
  # Ensure output directory exists
  $packOut = Join-Path (Get-Location) 'dist'
  if (-not (Test-Path $packOut)) { New-Item -ItemType Directory -Path $packOut | Out-Null }
  # run npx electron-packager with icon created earlier
  $iconPath = Join-Path $scriptRoot 'AppIcon.ico'
  $args = @('electron-packager', '.', 'Project Drift', '--platform=win32', '--arch=x64', '--out=dist', '--overwrite', "--icon=$iconPath", '--asar')
  Write-Host "Running: npx $($args -join ' ')"
  $proc = Start-Process -FilePath 'npx' -ArgumentList $args -NoNewWindow -Wait -PassThru
  if ($proc.ExitCode -ne 0) { Write-Error "electron-packager failed with exit code $($proc.ExitCode)" ; Pop-Location ; exit 1 }
  # Copy produced exe into launcher/dist root so installer script finds it
  $packDir = Get-ChildItem -Path (Join-Path (Get-Location) 'dist') -Directory | Where-Object { $_.Name -match 'Project Drift' } | Select-Object -First 1
  if ($packDir) {
    $exe = Get-ChildItem -Path $packDir.FullName -Filter *.exe -File | Select-Object -First 1
    if ($exe) {
      $destDir = Join-Path (Get-Location) 'dist'
      Copy-Item -Path $exe.FullName -Destination (Join-Path $destDir 'ProjectDriftLauncher.exe') -Force
    }
  }
}
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
