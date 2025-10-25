# Add Epic Games redirects to hosts file
# Run as Administrator!

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"

$redirects = @"

# Project Drift - Epic Games redirects
127.0.0.1 account-public-service-prod03.ol.epicgames.com
127.0.0.1 fortnite-public-service-prod11.ol.epicgames.com
127.0.0.1 lightswitch-public-service-prod06.ol.epicgames.com
127.0.0.1 fortnite-public-service-prod.ol.epicgames.com
127.0.0.1 lightswitch-public-service.ol.epicgames.com
"@

$currentHosts = Get-Content $hostsPath -Raw

if ($currentHosts -notmatch "Project Drift") {
    Add-Content -Path $hostsPath -Value $redirects
    Write-Host "✓ Epic redirects added to hosts file" -ForegroundColor Green
} else {
    Write-Host "✓ Redirects already present" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Hosts file updated! You can now launch Fortnite." -ForegroundColor Cyan
