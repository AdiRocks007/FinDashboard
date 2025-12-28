# API Proxy Test Script
# This script tests the API proxy endpoints with properly encoded URLs

Write-Host ""
Write-Host "=== API PROXY TEST SCRIPT ===" -ForegroundColor Green
Write-Host ""

# Base URL
$baseUrl = "http://localhost:3000/api/proxy"

# Test 1: Finnhub Quote
Write-Host "Test 1: Finnhub API - Stock Quote (AAPL)" -ForegroundColor Cyan
$finnhubUrl = "https://finnhub.io/api/v1/quote?symbol=AAPL"
$encodedFinnhub = [uri]::EscapeDataString($finnhubUrl)
$testUrl1 = "$baseUrl?url=$encodedFinnhub&provider=finnhub"
Write-Host "URL: $testUrl1" -ForegroundColor Gray
Write-Host ""
try {
    $response = Invoke-WebRequest -Uri $testUrl1 -Method GET
    $json = $response.Content | ConvertFrom-Json
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "Cached: $($json.cached)" -ForegroundColor Yellow
    Write-Host "Provider: $($json.provider)" -ForegroundColor Yellow
    Write-Host "Data: $($json.data | ConvertTo-Json -Depth 2)" -ForegroundColor White
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Test 2: Alpha Vantage Quote
Write-Host "Test 2: Alpha Vantage API - Stock Quote (IBM)" -ForegroundColor Cyan
$avUrl = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM"
$encodedAV = [uri]::EscapeDataString($avUrl)
$testUrl2 = "$baseUrl?url=$encodedAV&provider=alphavantage"
Write-Host "URL: $testUrl2" -ForegroundColor Gray
Write-Host ""
try {
    $response = Invoke-WebRequest -Uri $testUrl2 -Method GET
    $json = $response.Content | ConvertFrom-Json
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "Cached: $($json.cached)" -ForegroundColor Yellow
    Write-Host "Provider: $($json.provider)" -ForegroundColor Yellow
    Write-Host "Data: $($json.data | ConvertTo-Json -Depth 2)" -ForegroundColor White
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Finnhub News
Write-Host "Test 3: Finnhub API - Market News" -ForegroundColor Cyan
$newsUrl = "https://finnhub.io/api/v1/news?category=general"
$encodedNews = [uri]::EscapeDataString($newsUrl)
$testUrl3 = "$baseUrl?url=$encodedNews&provider=finnhub"
Write-Host "URL: $testUrl3" -ForegroundColor Gray
Write-Host ""
try {
    $response = Invoke-WebRequest -Uri $testUrl3 -Method GET
    $json = $response.Content | ConvertFrom-Json
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host "Cached: $($json.cached)" -ForegroundColor Yellow
    Write-Host "Provider: $($json.provider)" -ForegroundColor Yellow
    Write-Host "News Items: $($json.data.Count)" -ForegroundColor White
} catch {
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=== TEST COMPLETE ===" -ForegroundColor Green
Write-Host ""
