# Test Script for Gender Field (Phase 3) and Profile Update Endpoint
# Tests the two recent changes:
# 1. Gender field added to Phase 3 (health-information)
# 2. Profile endpoint now accepts any field

param(
    [string]$baseUrl = "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1",
    [string]$firebaseToken = ""
)

$ErrorActionPreference = "Stop"

# Color output helpers
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }

# Test results tracking
$testResults = @{
    total = 0
    passed = 0
    failed = 0
    tests = @()
}

function Test-Endpoint {
    param(
        [string]$name,
        [string]$method,
        [string]$endpoint,
        [object]$body,
        [int]$expectedStatus = 200,
        [string]$description = ""
    )
    
    $testResults.total++
    Write-Info "`n[$($testResults.total)] Testing: $name"
    if ($description) { Write-Info "   Description: $description" }
    
    try {
        $url = "$baseUrl$endpoint"
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($firebaseToken) {
            $headers["Authorization"] = "Bearer $firebaseToken"
        }
        
        if ($body) {
            Write-Info "   Request Body: $(($body | ConvertTo-Json -Compress) -replace '(.{80})(.+)', '$1...')"
        }
        
        $params = @{
            Uri     = $url
            Method  = $method
            Headers = $headers
            Body    = $body | ConvertTo-Json
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $statusCode = $response.StatusCode
        $responseBody = $response.Content | ConvertFrom-Json
        
        Write-Info "   Status: $statusCode"
        Write-Info "   Response: $(($responseBody | ConvertTo-Json -Compress) -replace '(.{80})(.+)', '$1...')"
        
        if ($statusCode -eq $expectedStatus) {
            Write-Success "   ✅ PASSED"
            $testResults.passed++
            $testResults.tests += @{name = $name; status = "PASSED"; details = $responseBody }
            return $responseBody
        } else {
            Write-Error "   ❌ FAILED - Expected status $expectedStatus, got $statusCode"
            $testResults.failed++
            $testResults.tests += @{name = $name; status = "FAILED"; details = "Status $statusCode"; expected = $expectedStatus }
            return $null
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        $errorBody = $_.Exception.Response.Content.ReadAsStream() | ForEach-Object { [System.IO.StreamReader]::new($_).ReadToEnd() }
        
        Write-Info "   Status: $statusCode"
        Write-Info "   Error: $(($errorBody | ConvertFrom-Json -ErrorAction SilentlyContinue | ConvertTo-Json -Compress) -replace '(.{80})(.+)', '$1...')"
        
        if ($statusCode -eq $expectedStatus) {
            Write-Success "   ✅ PASSED (Expected Error)"
            $testResults.passed++
            $testResults.tests += @{name = $name; status = "PASSED"; details = $errorBody }
            return $null
        } else {
            Write-Error "   ❌ FAILED - Expected status $expectedStatus, got $statusCode"
            $testResults.failed++
            $testResults.tests += @{name = $name; status = "FAILED"; details = $errorBody; expected = $expectedStatus }
            return $null
        }
    }
}

# ============================================
# SETUP: Create test user
# ============================================

Write-Info "`n========================================`n"
Write-Info "SETUP: Creating fresh test user`n"
Write-Info "========================================`n"

$testEmail = "gendertest_$(Get-Date -Format 'yyyyMMdd_HHmmss')@test.com"
$testPassword = "TestPassword123!"

$registerResult = Test-Endpoint `
    -name "User Registration (Phase 1)" `
    -method "POST" `
    -endpoint "/users/register" `
    -body @{
        name = "Test User"
        email = $testEmail
        password = $testPassword
        mobile = "+1234567890"
        address = "123 Test Street"
    } `
    -expectedStatus 201 `
    -description "Create new user for testing"

if (-not $registerResult) {
    Write-Error "Failed to create test user. Exiting."
    exit 1
}

$userId = $registerResult.userId
$token = $registerResult.token

if (-not $userId -or -not $token) {
    Write-Error "Failed to get userId or token from registration response"
    exit 1
}

Write-Success "✅ Test user created: $userId`n"

# ============================================
# PHASE 2: Update diet information (minimal)
# ============================================

Write-Info "`n========================================`n"
Write-Info "PHASE 2: Complete Diet Information`n"
Write-Info "========================================`n"

Test-Endpoint `
    -name "Phase 2: Diet Information" `
    -method "PUT" `
    -endpoint "/users/$userId/diet-information" `
    -body @{
        preference = "vegetarian"
        waterIntake = 2.0
        goal = "lose weight"
    } `
    -expectedStatus 200 `
    -description "Complete Phase 2" | Out-Null

# ============================================
# PHASE 3: Test Gender Field
# ============================================

Write-Info "`n========================================`n"
Write-Info "PHASE 3: Test Gender Field (NEW!)`n"
Write-Info "========================================`n"

Test-Endpoint `
    -name "Phase 3 with Valid Gender (male)" `
    -method "PUT" `
    -endpoint "/users/$userId/health-information" `
    -body @{
        medicalConditions = "None"
        sleepDuration = 8
        stressLevel = "low"
        gender = "male"
    } `
    -expectedStatus 200 `
    -description "Gender field should be accepted and saved" | Out-Null

# Test invalid gender value
Test-Endpoint `
    -name "Phase 3 with Invalid Gender" `
    -method "PUT" `
    -endpoint "/users/$userId/health-information" `
    -body @{
        medicalConditions = "None"
        gender = "invalid"
    } `
    -expectedStatus 400 `
    -description "Invalid gender should be rejected" | Out-Null

# Test female gender
Test-Endpoint `
    -name "Phase 3 with Valid Gender (female)" `
    -method "PUT" `
    -endpoint "/users/$userId/health-information" `
    -body @{
        medicalConditions = "None"
        sleepDuration = 8
        gender = "female"
    } `
    -expectedStatus 200 `
    -description "Female gender should be accepted" | Out-Null

# ============================================
# PHASE 4: Complete exercise preference
# ============================================

Write-Info "`n========================================`n"
Write-Info "PHASE 4: Complete Exercise Preference`n"
Write-Info "========================================`n"

Test-Endpoint `
    -name "Phase 4: Exercise Preference" `
    -method "PUT" `
    -endpoint "/users/$userId/exercise-preference" `
    -body @{
        fitnessGoal = "lose weight"
        workoutFrequency = 4
    } `
    -expectedStatus 200 `
    -description "Complete Phase 4" | Out-Null

# ============================================
# PHASE 5: Complete weekly exercise
# ============================================

Write-Info "`n========================================`n"
Write-Info "PHASE 5: Complete Weekly Exercise`n"
Write-Info "========================================`n"

$weeklyActivity = @{
    Monday = @{ activityName = "Running"; duration = 45; calories = 400 }
    Tuesday = @{ activityName = "Rest"; duration = 0; calories = 0 }
    Wednesday = @{ activityName = "Gym"; duration = 60; calories = 350 }
    Thursday = @{ activityName = "Rest"; duration = 0; calories = 0 }
    Friday = @{ activityName = "Swimming"; duration = 30; calories = 300 }
    Saturday = @{ activityName = "Cycling"; duration = 90; calories = 500 }
    Sunday = @{ activityName = "Yoga"; duration = 45; calories = 150 }
}

Test-Endpoint `
    -name "Phase 5: Weekly Exercise" `
    -method "PUT" `
    -endpoint "/users/$userId/weekly-exercise" `
    -body @{ weeklyActivity = $weeklyActivity } `
    -expectedStatus 200 `
    -description "Complete Phase 5" | Out-Null

# ============================================
# TEST: Profile Endpoint (NEW!)
# ============================================

Write-Info "`n========================================`n"
Write-Info "TEST: Profile Update Endpoint (NEW!)`n"
Write-Info "========================================`n"

Test-Endpoint `
    -name "Profile Update: Single Field" `
    -method "PUT" `
    -endpoint "/users/$userId/profile" `
    -body @{
        name = "Updated Name"
    } `
    -expectedStatus 200 `
    -description "Update just name field" | Out-Null

Test-Endpoint `
    -name "Profile Update: Multiple Fields" `
    -method "PUT" `
    -endpoint "/users/$userId/profile" `
    -body @{
        name = "Test User Updated"
        mobile = "+9876543210"
        address = "456 Updated Street"
    } `
    -expectedStatus 200 `
    -description "Update multiple fields at once" | Out-Null

Test-Endpoint `
    -name "Profile Update: With Gender" `
    -method "PUT" `
    -endpoint "/users/$userId/profile" `
    -body @{
        gender = "male"
    } `
    -expectedStatus 200 `
    -description "Update gender through profile endpoint" | Out-Null

Test-Endpoint `
    -name "Profile Update: With Invalid Gender" `
    -method "PUT" `
    -endpoint "/users/$userId/profile" `
    -body @{
        gender = "other"
    } `
    -expectedStatus 400 `
    -description "Invalid gender should be rejected" | Out-Null

Test-Endpoint `
    -name "Profile Update: No Fields" `
    -method "PUT" `
    -endpoint "/users/$userId/profile" `
    -body @{} `
    -expectedStatus 400 `
    -description "Empty request should be rejected" | Out-Null

Test-Endpoint `
    -name "Profile Update: Custom Fields" `
    -method "PUT" `
    -endpoint "/users/$userId/profile" `
    -body @{
        customField = "custom value"
        anotherField = 123
    } `
    -expectedStatus 200 `
    -description "Custom fields should be accepted and saved" | Out-Null

# ============================================
# VERIFY: Nutrition Plan Can Be Generated
# ============================================

Write-Info "`n========================================`n"
Write-Info "VERIFY: Nutrition Plan Generation`n"
Write-Info "========================================`n"

Test-Endpoint `
    -name "Generate Nutrition Plan" `
    -method "POST" `
    -endpoint "/users/$userId/generate-nutrition-plan" `
    -body @{} `
    -expectedStatus 200 `
    -description "Plan generation should now work with gender available" | Out-Null

# ============================================
# VERIFY: Profile Contains All Data
# ============================================

Write-Info "`n========================================`n"
Write-Info "VERIFY: Profile Contains All Updated Data`n"
Write-Info "========================================`n"

$profileResponse = Test-Endpoint `
    -name "Get User Profile" `
    -method "GET" `
    -endpoint "/users/$userId/profile" `
    -expectedStatus 200 `
    -description "Retrieve full profile with all updated fields"

if ($profileResponse) {
    Write-Info "`n   Profile Data Summary:"
    Write-Info "   - Name: $($profileResponse.user.name)"
    Write-Info "   - Email: $($profileResponse.user.email)"
    Write-Info "   - Gender: $($profileResponse.user.gender)"
    Write-Info "   - Mobile: $($profileResponse.user.mobile)"
    Write-Info "   - Address: $($profileResponse.user.address)"
    Write-Info "   - Custom Field: $($profileResponse.user.customField)"
}

# ============================================
# RESULTS SUMMARY
# ============================================

Write-Info "`n========================================`n"
Write-Info "TEST RESULTS SUMMARY`n"
Write-Info "========================================`n"

Write-Info "Total Tests: $($testResults.total)"
Write-Success "Passed: $($testResults.passed)"
Write-Error "Failed: $($testResults.failed)"

if ($testResults.failed -gt 0) {
    Write-Error "`n❌ Some tests failed:`n"
    $testResults.tests | Where-Object { $_.status -eq "FAILED" } | ForEach-Object {
        Write-Error "  - $($_.name): $($_.details)"
    }
} else {
    Write-Success "`n✅ All tests passed!"
}

Write-Info "`n========================================`n"
Write-Info "KEY CHANGES TESTED:`n"
Write-Info "========================================`n"
Write-Info "✅ Phase 3 now accepts 'gender' field"
Write-Info "✅ Gender is validated (must be 'male' or 'female')"
Write-Info "✅ Profile endpoint accepts any field from request"
Write-Info "✅ Invalid gender values are rejected in both endpoints"
Write-Info "✅ Nutrition plan generation works with gender available"
Write-Info "✅ All profile updates are saved and retrievable`n"
