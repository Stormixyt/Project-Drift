<#
Build script for Project Drift installer (Inno Setup)

Prerequisites (local):
- Inno Setup 6 (ISCC.exe) installed on Windows. When run on GitHub Actions the workflow will install it via Chocolatey.

Usage:
  .\build-installer.ps1

This script creates a staging folder, copies the website/build files into it (excluding the installer folder),
and then calls ISCC.exe to compile the Inno Setup script `installer.iss` which produces the EXE named
`Project-Drift-Complete-Installer-v1.0.0.exe`.
#>

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$siteRoot = Resolve-Path (Join-Path $scriptRoot "..")
$staging = Join-Path $scriptRoot "staging"

Write-Host "Script root: $scriptRoot"
Write-Host "Site root: $siteRoot"

if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

Write-Host "Copying site files to staging..."
# Copy everything from siteRoot except the installer folder and .git
Get-ChildItem -Path $siteRoot -Force | Where-Object { $_.Name -ne 'installer' -and $_.Name -ne '.git' } | ForEach-Object {
    $dest = Join-Path $staging $_.Name
    Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force -ErrorAction SilentlyContinue
}

# If the launcher was built by CI, copy the produced EXE into staging and normalize the name
$launcherDist = Join-Path $scriptRoot "..\launcher\dist"
if (Test-Path $launcherDist) {
    $exe = Get-ChildItem -Path $launcherDist -Filter *.exe -Recurse -File | Select-Object -First 1
    if ($exe) {
        Write-Host "Found launcher exe: $($exe.FullName). Copying into staging as ProjectDriftLauncher.exe"
        Copy-Item -Path $exe.FullName -Destination (Join-Path $staging "ProjectDriftLauncher.exe") -Force
    }
}

# Locate ISCC.exe (Inno Setup compiler)
$possible = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$ISCC = $possible | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $ISCC) {
    Write-Error "ISCC.exe not found. Install Inno Setup 6, or run this via the provided GitHub Actions workflow which installs it automatically."
    exit 1
}

Write-Host "Using ISCC: $ISCC"

Push-Location $scriptRoot
& $ISCC (Join-Path $scriptRoot "installer.iss")
Pop-Location

Write-Host "Build finished. Check the 'Output' subfolder for the generated EXE."
