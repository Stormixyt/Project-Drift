<#
Generates a multi-resolution AppIcon.ico from InstallerImage.png
Writes AppIcon.ico beside this script (in installer folder).

Supported sizes: 16,32,48,256. The ICO entries will contain PNG-encoded images
which are supported by modern Windows and electron-builder.

Usage:
  .\generate-appicon.ps1
#>

Param(
    [string]$Source = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) '..\InstallerImage.png'),
    [string]$Out = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) '..\AppIcon.ico')
)

$source = Resolve-Path $Source
if (-not (Test-Path $source)) {
    Write-Error "Source image not found: $Source"
    exit 1
}

Add-Type -AssemblyName System.Drawing

$sizes = @(16,32,48,256)
$pngBytesList = @()

foreach ($s in $sizes) {
    $img = [System.Drawing.Image]::FromFile($source)
    $bmp = New-Object System.Drawing.Bitmap $img, $s, $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $pngBytesList += ,@{ size = $s; bytes = $bytes }
    $ms.Close()
    $bmp.Dispose()
    $img.Dispose()
}

# Build ICO file with PNG images embedded
$outPath = Resolve-Path $Out -ErrorAction SilentlyContinue
if ($outPath) { $outPath = $outPath.Path } else { $outPath = $Out }

$fs = [System.IO.File]::Open($outPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR: reserved(2) type(2=1) count(2)
$bw.Write([UInt16]0)        # reserved
$bw.Write([UInt16]1)        # type = 1 for icons
$bw.Write([UInt16]($pngBytesList.Count))

# Calculate header size: 6 + 16 * count
$headerSize = 6 + 16 * $pngBytesList.Count
$offset = $headerSize

# Write ICONDIRENTRY for each image
foreach ($entry in $pngBytesList) {
    $size = $entry.size
    $bytes = $entry.bytes
    $bw.Write([byte]($size -bor 0))           # width (0 means 256)
    $bw.Write([byte]($size -bor 0))           # height
    $bw.Write([byte]0)                        # color count
    $bw.Write([byte]0)                        # reserved
    $bw.Write([UInt16]0)                      # color planes (for PNG set to 0)
    $bw.Write([UInt16]32)                     # bit count
    $bw.Write([UInt32]($bytes.Length))        # bytes in resource
    $bw.Write([UInt32]$offset)                # image offset
    $offset += $bytes.Length
}

# Write image data
foreach ($entry in $pngBytesList) {
    $bw.Write($entry.bytes)
}

$bw.Flush()
$bw.Close()
$fs.Close()

Write-Host "Wrote ICO: $outPath (sizes: $($sizes -join ','))"
