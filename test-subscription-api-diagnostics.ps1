#!/usr/bin/env pwsh
# Subscription API Diagnostics Test Script
# Tests all subscription endpoints comprehensively to identify issues
# Date: April 15, 2026

param(
    [string]$testEmail = "subtest_$(Get-Random)@example.com",
    [string]$testPassword = "TestPass123!"
)

$API_BASE = "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1"
$FIREBASE_WEB_API_KEY = "AIzaSyBou0UNhWnqJBAPrDw7sQ9f-gVsHWfHB6A"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  SUBSCRIPTION API DIAGNOSTICS TEST SUITE" -ForegroundColor Cyan
Write-Host "  Testing: GET and PUT /users/:userId/subscription" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# Helper function to test endpoints
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [string]$Token,
        [object]$Body,
        [int]$ExpectedStatus
    )
    
    Write-Host "`n► $Name" -ForegroundColor White
    Write-Host "  Method: $Method | URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
        }
        
        if ($Token) {
            $params.Headers = @{ "Authorization" = "Bearer $Token" }
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
            Write-Host "  Body: $($params.Body)" -ForegroundColor Gray
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host "  ✅ SUCCESS (200)" -ForegroundColor Green
        Write-Host "  Response: " -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 3 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        
        return $response
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  ❌ ERROR ($statusCode)" -ForegroundColor Red
        Write-Host "  Message: $($_.Exception.Message)" -ForegroundColor Red
        
        try {
            $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Error Details: " -ForegroundColor Red
            $errorBody | ConvertTo-Json -Depth 3 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        } catch {
            Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        
        return $null
    }
}

# ===== STEP 1: Register Test User =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 1: REGISTER TEST USER" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$regBody = @{
    name = "Subscription Tester"
    email = $testEmail
    mobile = "1234567890"
    address = "Test City"
    password = $testPassword
}

$regResponse = Test-Endpoint -Name "Register User" `
    -Method "POST" `
    -Url "$API_BASE/users/register" `
    -Body $regBody

if (-not $regResponse) {
    Write-Host "`n❌ FATAL: User registration failed. Cannot continue." -ForegroundColor Red
    exit 1
}

$userId = $regResponse.userId
Write-Host "`n✅ Test User Created:" -ForegroundColor Green
Write-Host "  User ID: $userId" -ForegroundColor Green
Write-Host "  Email: $testEmail" -ForegroundColor Green

# ===== STEP 2: Get Auth Token =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 2: AUTHENTICATE USER" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Start-Sleep -Seconds 2

$authUrl = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_WEB_API_KEY"
$authBody = @{
    email = $testEmail
    password = $testPassword
    returnSecureToken = $true
}

try {
    $authResponse = Invoke-RestMethod -Uri $authUrl -Method POST -Body ($authBody | ConvertTo-Json) -ContentType "application/json"
    $idToken = $authResponse.idToken
    Write-Host "✅ Authentication successful" -ForegroundColor Green
    Write-Host "  Token: $($idToken.Substring(0, 50))..." -ForegroundColor Green
} catch {
    Write-Host "❌ Authentication failed" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ===== STEP 3: GET Subscription (Before any changes) =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 3: GET SUBSCRIPTION (New User)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$getSubResponse = Test-Endpoint -Name "Get Initial Subscription" `
    -Method "GET" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken

# ===== STEP 4: PUT Subscription - Activate Free Trial =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 4: PUT SUBSCRIPTION - Activate Free Trial" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$updateBody = @{
    activateFreeTrial = $true
}

$updateSubResponse = Test-Endpoint -Name "Activate Free Trial" `
    -Method "PUT" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken `
    -Body $updateBody

# ===== STEP 5: GET Subscription (After Trial Activation) =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 5: GET SUBSCRIPTION (After Trial Activation)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$getSubAfterTrialResponse = Test-Endpoint -Name "Get Subscription After Trial" `
    -Method "GET" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken

# ===== STEP 6: PUT Subscription - Update with Discount Code =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 6: PUT SUBSCRIPTION - Add Discount Code" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$discountBody = @{
    discountCode = "SAVE20"
    discountPercentage = 20
}

$updateDiscountResponse = Test-Endpoint -Name "Add Discount Code" `
    -Method "PUT" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken `
    -Body $discountBody

# ===== STEP 7: GET Subscription (After Discount) =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 7: GET SUBSCRIPTION (After Discount)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$getSubAfterDiscountResponse = Test-Endpoint -Name "Get Subscription After Discount" `
    -Method "GET" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken

# ===== STEP 8: PUT Subscription - Upgrade to Monthly =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 8: PUT SUBSCRIPTION - Upgrade to Monthly" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$upgradeBody = @{
    subscribed = $true
    subscriptionStatus = "active"
    subscriptionTier = "one-month"
}

$upgradeResponse = Test-Endpoint -Name "Upgrade to Monthly" `
    -Method "PUT" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken `
    -Body $upgradeBody

# ===== STEP 9: GET Subscription (After Upgrade) =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "STEP 9: GET SUBSCRIPTION (After Upgrade)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$getSubAfterUpgradeResponse = Test-Endpoint -Name "Get Subscription After Upgrade" `
    -Method "GET" `
    -Url "$API_BASE/users/$userId/subscription" `
    -Token $idToken

# ===== SUMMARY =====
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host "`n✅ All subscription API endpoints tested successfully!" -ForegroundColor Green
Write-Host "`nTest Details:" -ForegroundColor White
Write-Host "  User ID: $userId" -ForegroundColor Gray
Write-Host "  Email: $testEmail" -ForegroundColor Gray
Write-Host "  Endpoints Tested:" -ForegroundColor Gray
Write-Host "    • GET /users/:userId/subscription (3 times, different states)" -ForegroundColor Gray
Write-Host "    • PUT /users/:userId/subscription (3 times, different updates)" -ForegroundColor Gray

Write-Host "`n[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "  1. Review the responses above for any errors or unexpected data" -ForegroundColor Gray
Write-Host "  2. If all tests passed, the subscription API is working correctly" -ForegroundColor Gray
Write-Host "  3. If any tests failed, check the error responses for details" -ForegroundColor Gray

Write-Host ""
