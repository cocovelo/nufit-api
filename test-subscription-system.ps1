# Quick Test Script for Subscription System
# Run this to verify the implementation is working

Write-Host "=== Subscription Management System - Quick Test ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$BASE_URL = "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1"
$USER_ID = "bob-uid-here"  # Replace with actual user ID
$ID_TOKEN = "your-id-token-here"  # Replace with actual ID token

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Base URL: $BASE_URL"
Write-Host "  User ID: $USER_ID"
Write-Host ""

# Test 1: Try to generate plan without subscription (should fail with 402)
Write-Host "Test 1: Generate plan without subscription (expect 402)" -ForegroundColor Yellow
try {
    $response = Invoke-WebMethod -Uri "$BASE_URL/users/$USER_ID/generate-nutrition-plan" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ID_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body '{}' `
        -ErrorAction Stop
    
    Write-Host "  ❌ FAILED - Expected 402 but got success" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 402) {
        Write-Host "  ✅ PASSED - Got expected 402 Payment Required" -ForegroundColor Green
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "     Message: $($errorBody.message)" -ForegroundColor Gray
        Write-Host "     Suggestion: $($errorBody.suggestion)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  UNEXPECTED - Got status code: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 2: Try to access nutrition plans without subscription (should fail with 402)
Write-Host "Test 2: Access plans without subscription (expect 402)" -ForegroundColor Yellow
try {
    $response = Invoke-WebMethod -Uri "$BASE_URL/users/$USER_ID/nutrition-plans" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $ID_TOKEN"
        } `
        -ErrorAction Stop
    
    Write-Host "  ❌ FAILED - Expected 402 but got success" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 402) {
        Write-Host "  ✅ PASSED - Got expected 402 Access Denied" -ForegroundColor Green
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "     Message: $($errorBody.message)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  UNEXPECTED - Got status code: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Check user document has quota fields
Write-Host "Test 3: Verify quota fields in user document" -ForegroundColor Yellow
Write-Host "  Manual check required:" -ForegroundColor Gray
Write-Host "  1. Go to Firebase Console → Firestore" -ForegroundColor Gray
Write-Host "  2. Open users/$USER_ID document" -ForegroundColor Gray
Write-Host "  3. Verify these fields exist:" -ForegroundColor Gray
Write-Host "     - planGenerationQuota: 0" -ForegroundColor Gray
Write-Host "     - lastPlanGeneratedAt: null" -ForegroundColor Gray
Write-Host "     - totalPlansGenerated: 0" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Activate a free trial for the user:" -ForegroundColor Yellow
Write-Host "   PUT $BASE_URL/users/$USER_ID/subscription" -ForegroundColor Gray
Write-Host "   Body: { planGenerationQuota: 1, subscriptionTier: 'trial', subscriptionStatus: 'active' }" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Try generating a plan again (should succeed)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Try generating a second plan (should fail with 429 Quota Exceeded)" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Test admin endpoint to reset quota:" -ForegroundColor Yellow
Write-Host "   POST $BASE_URL/admin/plan-generation-reset" -ForegroundColor Gray
Write-Host "   Headers: { 'x-api-key': 'YOUR_API_KEY' }" -ForegroundColor Gray
Write-Host "   Body: { userId: '$USER_ID' }" -ForegroundColor Gray
Write-Host ""
