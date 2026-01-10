# Quick API Test Script for PowerShell
# Run with: .\test-api-quick.ps1

$API_BASE = "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Nufit API Quick Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "TEST 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/health" -Method GET
    Write-Host "[OK] API is healthy" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "[FAIL] Health check failed: $_" -ForegroundColor Red
}

# Test 2: Recipe Counts
Write-Host "`nTEST 2: Recipe Counts" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/recipes/count" -Method GET
    Write-Host "[OK] Recipe counts retrieved" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "[FAIL] Failed: $_" -ForegroundColor Red
}

# Test 3: Get Breakfast Recipes
Write-Host "`nTEST 3: Get Breakfast Recipes (5 items)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/recipes/breakfast?limit=5" -Method GET
    Write-Host "[OK] Retrieved $($response.recipes.Count) recipes" -ForegroundColor Green
    foreach ($recipe in $response.recipes) {
        $calories = $recipe.Calories_kcal
        Write-Host "  - $($recipe.Recipe_Name) ($calories calories)" -ForegroundColor Gray
    }
} catch {
    Write-Host "[FAIL] Failed: $_" -ForegroundColor Red
}

# Test 4: User Registration (Phase 1)
Write-Host "`nTEST 4: User Registration (Phase 1)" -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail = "test_${timestamp}@example.com"

$registrationData = @{
    name = "Test User"
    email = $testEmail
    mobile = "1234567890"
    address = "123 Test Street, Test City"
    password = "TestPass123!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_BASE/users/register" -Method POST -Body $registrationData -ContentType "application/json"
    Write-Host "[OK] User registered successfully" -ForegroundColor Green
    Write-Host "  User ID: $($response.userId)" -ForegroundColor Gray
    Write-Host "  Email: $($response.email)" -ForegroundColor Gray
    Write-Host "  Next Step: $($response.nextStep)" -ForegroundColor Gray
    
    # Save for next tests
    $global:userId = $response.userId
    
} catch {
    Write-Host "[FAIL] Registration failed" -ForegroundColor Red
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "  Error: $($errorDetails.error)" -ForegroundColor Red
    Write-Host "  Message: $($errorDetails.message)" -ForegroundColor Red
}

# Test 5: Get User Profile (if registration succeeded)
if ($global:userId) {
    Write-Host "`nTEST 5: Get User Profile" -ForegroundColor Yellow
    Write-Host "  Note: Requires Firebase Auth token (skipped in quick test)" -ForegroundColor Yellow
}

# Test 6: Update Diet Information (Phase 2)
if ($global:userId) {
    Write-Host "`nTEST 6: Update Diet Information (Phase 2)" -ForegroundColor Yellow
    Write-Host "  Note: Requires Firebase Auth token (skipped in quick test)" -ForegroundColor Yellow
    Write-Host "  Fields: preference, allergies, waterIntake, foodPreference, goal, etc." -ForegroundColor Gray
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Tests Complete" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
