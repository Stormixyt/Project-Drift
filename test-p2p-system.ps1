# Quick P2P Test Script

Write-Host "Testing P2P Matchmaking System..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Check Docker services
Write-Host "[1/4] Checking Docker services..." -ForegroundColor Yellow
$services = docker ps --filter "name=drift" --format "{{.Names}}"
if ($services -match "drift-matchmaking" -and $services -match "drift-redis") {
    Write-Host "✓ Docker services running" -ForegroundColor Green
} else {
    Write-Host "✗ Docker services not running!" -ForegroundColor Red
    Write-Host "Run: docker-compose up -d" -ForegroundColor Gray
    exit 1
}

# Test 2: Check matchmaking API
Write-Host "`n[2/4] Testing matchmaking API..." -ForegroundColor Yellow
try {
    $body = @{
        serverName = "Test Server"
        buildVersion = "4.5"
        ip = "127.0.0.1"
        port = 7777
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/servers/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    if ($response.success) {
        Write-Host "✓ API endpoint working" -ForegroundColor Green
        Write-Host "  Server ID: $($response.serverId)" -ForegroundColor Gray
        
        # Unregister test server
        Invoke-RestMethod -Uri "http://localhost:8080/api/servers/unregister/$($response.serverId)" `
            -Method Post | Out-Null
        Write-Host "  Test server cleaned up" -ForegroundColor Gray
    } else {
        Write-Host "✗ API returned error" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ API not responding" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Gray
    exit 1
}

# Test 3: Check server settings file
Write-Host "`n[3/4] Checking server settings..." -ForegroundColor Yellow
$settingsPath = "$env:APPDATA\project-drift-launcher\server-settings.json"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath | ConvertFrom-Json
    Write-Host "✓ Settings file exists" -ForegroundColor Green
    Write-Host "  Server Name: $($settings.serverName)" -ForegroundColor Gray
    Write-Host "  Host Name: $($settings.hostName)" -ForegroundColor Gray
} else {
    Write-Host "⚠ No settings file (will use defaults)" -ForegroundColor Yellow
    Write-Host "  Path: $settingsPath" -ForegroundColor Gray
}

# Test 4: Instructions
Write-Host "`n[4/4] Ready to test!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Close launcher if running" -ForegroundColor White
Write-Host "2. cd launcher && npm run dev" -ForegroundColor Gray
Write-Host "3. Go to Servers tab" -ForegroundColor White
Write-Host "4. Click 'Hosting Settings' and save" -ForegroundColor White
Write-Host "5. Launch a game from Library" -ForegroundColor White
Write-Host "6. Watch console for:" -ForegroundColor White
Write-Host "   '[Main] Server registered: p2p_XXX'" -ForegroundColor Gray
Write-Host "7. Check Servers tab - your server should appear!" -ForegroundColor White
Write-Host ""
Write-Host "Debug tips:" -ForegroundColor Cyan
Write-Host "- Press F12 in launcher for console" -ForegroundColor Gray
Write-Host "- Check: docker logs drift-matchmaking -f" -ForegroundColor Gray
Write-Host "- Manual test: curl http://localhost:8080/api/servers/available" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ System is ready! Start launcher now." -ForegroundColor Green
