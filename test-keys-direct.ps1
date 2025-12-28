# Test API Keys Directly
Write-Host ""
Write-Host "=== TESTING API KEYS DIRECTLY ===" -ForegroundColor Green
Write-Host ""

# Test 1: Finnhub
Write-Host "Test 1: Finnhub API" -ForegroundColor Cyan
$finnhubKey = "d576v7pr01qkvkau6rrgd576v7pr01qkvkau6rs0"
$finnhubUrl = "https://finnhub.io/api/v1/quote?symbol=AAPL&token=$finnhubKey"
Write-Host "URL: $finnhubUrl" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $finnhubUrl -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Yellow
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor White
    $json | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Response Body: $body" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test 2: Alpha Vantage API" -ForegroundColor Cyan
$avKey = "NCWW9M3HR6H632N6"
$avUrl = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=$avKey"
Write-Host "URL: $avUrl" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $avUrl -Method GET -UseBasicParsing
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Yellow
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor White
    $json | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Response Body: $body" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== TEST COMPLETE ===" -ForegroundColor Green

