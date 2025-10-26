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
    Write-Host "Looking for built launcher executables under: $launcherDist"
    # Prefer a predictable name produced by electron-builder (ProjectDriftLauncher.exe), then product-named artifacts,
    # then any exe in win-unpacked or the dist root.
    $candidates = @()
    $candidates += Get-ChildItem -Path $launcherDist -Filter 'ProjectDriftLauncher.exe' -Recurse -File -ErrorAction SilentlyContinue
    if (-not $candidates) {
        $candidates += Get-ChildItem -Path $launcherDist -Filter 'Project*.*.exe' -Recurse -File -ErrorAction SilentlyContinue
    }
    if (-not $candidates) {
        $candidates += Get-ChildItem -Path (Join-Path $launcherDist 'win-unpacked') -Filter *.exe -File -ErrorAction SilentlyContinue
    }
    if (-not $candidates) {
        $candidates += Get-ChildItem -Path $launcherDist -Filter *.exe -File -Recurse -ErrorAction SilentlyContinue
    }

    $exe = $candidates | Select-Object -First 1
    if ($exe) {
        Write-Host "Found launcher exe: $($exe.FullName). Copying into staging as ProjectDriftLauncher.exe"
        Copy-Item -Path $exe.FullName -Destination (Join-Path $staging "ProjectDriftLauncher.exe") -Force
    } else {
        Write-Host "No launcher exe found under $launcherDist. Installer will not include a launcher executable."
    }
}

# If an installer image (PNG) is present in the installer folder, convert it to BMP and ICO for Inno Setup
$installerAssetsDir = $scriptRoot
$pngPath = Join-Path $installerAssetsDir "InstallerImage.png"
$smallPngPath = Join-Path $installerAssetsDir "InstallerSmall.png"
$bmpOut = Join-Path $staging "InstallerImage.bmp"
$smallBmpOut = Join-Path $staging "InstallerSmall.bmp"
$icoOut = Join-Path $staging "AppIcon.ico"
# Also write copies into the installer script folder so ISCC (which runs with
# the script folder as current working directory) can find them via the names
# used in installer.iss (e.g. "InstallerImage.bmp").
$bmpOutScript = Join-Path $scriptRoot "InstallerImage.bmp"
$smallBmpOutScript = Join-Path $scriptRoot "InstallerSmall.bmp"
$icoOutScript = Join-Path $scriptRoot "AppIcon.ico"

if (Test-Path $pngPath) {
    Write-Host "Converting InstallerImage.png -> BMP and ICO"
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile($pngPath)
    # Save main BMP (to staging and to script folder)
    $img.Save($bmpOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $img.Save($bmpOutScript, [System.Drawing.Imaging.ImageFormat]::Bmp)
    # Create ICO from the image
    $bmp = New-Object System.Drawing.Bitmap $img
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    $fs = [System.IO.File]::Open($icoOut, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    # also save ICO into script folder so installer.iss can reference it
    $fs2 = [System.IO.File]::Open($icoOutScript, [System.IO.FileMode]::Create)
    $icon.Save($fs2)
    $fs2.Close()
    $icon.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

if (Test-Path $smallPngPath) {
    Write-Host "Converting InstallerSmall.png -> BMP"
    Add-Type -AssemblyName System.Drawing
    $img2 = [System.Drawing.Image]::FromFile($smallPngPath)
    # Save small BMP to staging and script folder
    $img2.Save($smallBmpOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $img2.Save($smallBmpOutScript, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $img2.Dispose()
} elseif (Test-Path $pngPath) {
    # create a smaller BMP from main image
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile($pngPath)
    $small = New-Object System.Drawing.Bitmap $img, ([int]($img.Width/4)), ([int]($img.Height/4))
    $small.Save($smallBmpOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $small.Save($smallBmpOutScript, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $small.Dispose()
    $img.Dispose()
}

# If any installer assets were created, copy any existing AppIcon.ico provided into staging to override
$providedIco = Join-Path $installerAssetsDir "AppIcon.ico"
if (Test-Path $providedIco) {
    Copy-Item -Path $providedIco -Destination $icoOut -Force
    # Only copy into the script folder if the source and destination are not the same file
    try {
        $providedFull = (Get-Item -LiteralPath $providedIco).FullName
    } catch {
        $providedFull = $null
    }

    if ($providedFull) {
        if (-not (Test-Path $icoOutScript)) {
            Copy-Item -Path $providedIco -Destination $icoOutScript -Force
        } else {
            try {
                $destFull = (Get-Item -LiteralPath $icoOutScript).FullName
            } catch {
                $destFull = $null
            }
            if ($destFull -and ($destFull -ne $providedFull)) {
                Copy-Item -Path $providedIco -Destination $icoOutScript -Force
            }
        }
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
