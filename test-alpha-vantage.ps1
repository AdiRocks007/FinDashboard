# PowerShell script to test Alpha Vantage API proxy with proper URL encoding

Write-Host "=== ALPHA VANTAGE API PROXY TEST ===" -ForegroundColor Green
Write-Host ""

# Test 1: IBM Global Quote (properly formatted)
Write-Host "Test 1: IBM Global Quote" -ForegroundColor Cyan
$baseUrl = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM"
$encodedUrl = [uri]::EscapeDataString($baseUrl)
$proxyUrl = "http://localhost:3000/api/proxy?url=$encodedUrl&provider=alphavantage"

Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host "Encoded URL: $encodedUrl" -ForegroundColor Gray
Write-Host "Proxy URL: $proxyUrl" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $proxyUrl -Method Get -TimeoutSec 20
    Write-Host "Response:" -ForegroundColor White
    $response | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 2: AAPL Global Quote
Write-Host "Test 2: AAPL Global Quote" -ForegroundColor Cyan
$baseUrl2 = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL"
$encodedUrl2 = [uri]::EscapeDataString($baseUrl2)
$proxyUrl2 = "http://localhost:3000/api/proxy?url=$encodedUrl2&provider=alphavantage"

Write-Host "Base URL: $baseUrl2" -ForegroundColor Gray
Write-Host "Proxy URL: $proxyUrl2" -ForegroundColor Yellow
Write-Host ""

try {
    $response2 = Invoke-RestMethod -Uri $proxyUrl2 -Method Get -TimeoutSec 20
    Write-Host "Response:" -ForegroundColor White
    $response2 | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TEST COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Check server logs for:" -ForegroundColor Yellow
Write-Host "  - [API Proxy] Decoded URL" -ForegroundColor Gray
Write-Host "  - [API Proxy] Alpha Vantage Query Params" -ForegroundColor Gray
Write-Host "  - Any ERROR messages about missing parameters" -ForegroundColor Gray
Write-Host ""

