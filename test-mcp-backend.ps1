# Test MCP Backend
# Quick validation that MCP is working correctly

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   🧪 MCP Backend Test Suite" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3551"
$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Body = $null
    )
    
    Write-Host "[TEST] $Name" -ForegroundColor Yellow -NoNewline
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri "$baseUrl$Url" -Method Get -ErrorAction Stop
        } else {
            $bodyJson = $Body | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "$baseUrl$Url" -Method Post -Body $bodyJson -ContentType "application/json" -ErrorAction Stop
        }
        
        Write-Host " ✓" -ForegroundColor Green
        return $true
    } catch {
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test 1: Lightswitch (Service Status)
if (Test-Endpoint -Name "Lightswitch - Service Status" -Method "GET" -Url "/lightswitch/api/service/Fortnite/status") {
    $passed++
} else {
    $failed++
}

# Test 2: OAuth Token
if (Test-Endpoint -Name "OAuth - Token Generation" -Method "POST" -Url "/account/api/oauth/token" -Body @{grant_type="client_credentials"}) {
    $passed++
} else {
    $failed++
}

# Test 3: Calendar Timeline
if (Test-Endpoint -Name "Calendar - Timeline" -Method "GET" -Url "/fortnite/api/calendar/v1/timeline") {
    $passed++
} else {
    $failed++
}

# Test 4: MCP Profile Query
$testAccountId = "test123"
if (Test-Endpoint -Name "MCP - Profile Query" -Method "POST" -Url "/fortnite/api/game/v2/profile/$testAccountId/client/QueryProfile?profileId=athena") {
    $passed++
} else {
    $failed++
}

# Test 5: CloudStorage System
if (Test-Endpoint -Name "CloudStorage - System Files" -Method "GET" -Url "/fortnite/api/cloudstorage/system") {
    $passed++
} else {
    $failed++
}

# Test 6: Account Info
if (Test-Endpoint -Name "Account - Public Info" -Method "GET" -Url "/account/api/public/account/$testAccountId") {
    $passed++
} else {
    $failed++
}

# Test 7: Store Catalog
if (Test-Endpoint -Name "Store - Catalog" -Method "GET" -Url "/fortnite/api/storefront/v2/catalog") {
    $passed++
} else {
    $failed++
}

# Test 8: Friends List
if (Test-Endpoint -Name "Friends - List" -Method "GET" -Url "/friends/api/public/friends/$testAccountId") {
    $passed++
} else {
    $failed++
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Test Results" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Passed: $passed" -ForegroundColor Green
Write-Host "   Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ All tests passed! MCP backend is working correctly." -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now launch Fortnite from the launcher." -ForegroundColor White
} else {
    Write-Host "❌ Some tests failed. Check if MCP backend is running:" -ForegroundColor Red
    Write-Host ""
    Write-Host "   cd mcp-backend" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
