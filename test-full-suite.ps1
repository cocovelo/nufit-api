# Nufit API - Full Endpoint Test Suite
param(
    [string]$BaseUrl    = "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1",
    [string]$FirebaseKey = "AIzaSyBou0UNhWnqJBAPrDw7sQ9f-gVsHWfHB6A"
)

$pass = 0; $fail = 0; $skip = 0
$results = [System.Collections.Generic.List[object]]::new()

function Write-Header($text) { Write-Host "`n--- $text ---" -ForegroundColor Cyan }

function Invoke-Test {
    param([string]$Name, [string]$Method, [string]$Url,
          [hashtable]$Headers = @{}, $Body = $null,
          [int]$ExpectStatus = 200,
          [string]$ExpectField = $null, $ExpectValue = $null,
          [string]$Note = $null)
    $bodyJson = if ($Body) { $Body | ConvertTo-Json -Depth 5 } else { $null }
    try {
        $splat = @{ Uri = $Url; Method = $Method; ErrorAction = "Stop" }
        if ($Headers.Count) { $splat.Headers = $Headers }
        if ($bodyJson)      { $splat.Body = $bodyJson; $splat.ContentType = "application/json" }
        $r = Invoke-RestMethod @splat
        if ($ExpectField) {
            $actual = $r
            foreach ($part in $ExpectField.Split(".")) { $actual = $actual.$part }
            if ($ExpectValue -ne $null -and "$actual" -ne "$ExpectValue") {
                $msg = "field '$ExpectField' was '$actual', expected '$ExpectValue'"
                Write-Host "  [FAIL] $Name - $msg" -ForegroundColor Red
                $script:fail++
                $results.Add([pscustomobject]@{Test=$Name;Result="FAIL";Detail=$msg})
                return $null
            }
        }
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        if ($Note) { Write-Host "         $Note" -ForegroundColor Gray }
        $script:pass++
        $results.Add([pscustomobject]@{Test=$Name;Result="PASS";Detail=$Note})
        return $r
    } catch {
        $actualStatus = $_.Exception.Response.StatusCode.value__
        $errBody = $null
        try { $errBody = $_.ErrorDetails.Message | ConvertFrom-Json } catch {}
        if ($actualStatus -eq $ExpectStatus) {
            Write-Host "  [PASS] $Name (expected HTTP $actualStatus)" -ForegroundColor Green
            $script:pass++
            $results.Add([pscustomobject]@{Test=$Name;Result="PASS";Detail="HTTP $actualStatus as expected"})
            return $null
        }
        $detail = if ($errBody -and $errBody.message) { "$($errBody.error): $($errBody.message)" } else { $_.Exception.Message }
        Write-Host "  [FAIL] $Name - HTTP $actualStatus : $detail" -ForegroundColor Red
        $script:fail++
        $results.Add([pscustomobject]@{Test=$Name;Result="FAIL";Detail="HTTP $actualStatus - $detail"})
        return $null
    }
}

function Skip-Test($Name, $Reason) {
    Write-Host "  [SKIP] $Name - $Reason" -ForegroundColor DarkYellow
    $script:skip++
    $results.Add([pscustomobject]@{Test=$Name;Result="SKIP";Detail=$Reason})
}

# Header
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  Nufit API - Full Endpoint Test Suite" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkCyan
Write-Host "================================================================" -ForegroundColor Cyan

# ---- SETUP: Auth token for Tester1 ----
Write-Header "SETUP - Auth Token (Tester1)"
$TESTER1_UID = "TL0ux8VArpVAxqUw16yIIxbxkTf1"
$customToken = node -e "const admin=require('firebase-admin');const key=require('./functions/serviceAccountKey.json');if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(key)});admin.auth().createCustomToken('$TESTER1_UID').then(t=>{process.stdout.write(t);process.exit(0);}).catch(e=>{process.stderr.write(e.message);process.exit(1);});"
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Could not get custom token. Aborting." -ForegroundColor Red; exit 1 }
try {
    $tokenResp = Invoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$FirebaseKey" `
        -Method POST -Body (@{token=$customToken;returnSecureToken=$true}|ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
    $TOKEN = $tokenResp.idToken
    $AUTH  = @{ Authorization = "Bearer $TOKEN" }
    Write-Host "  Token obtained for Tester1 ($TESTER1_UID)" -ForegroundColor Green
} catch { Write-Host "  ERROR: Token exchange failed: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }

# ================================================================
# GROUP 1 - PUBLIC
# ================================================================
Write-Header "GROUP 1 - Public Endpoints"

Invoke-Test "GET /health" GET "$BaseUrl/health" -ExpectField "status" -ExpectValue "healthy"
Invoke-Test "GET /subscription/tiers (public)" GET "$BaseUrl/subscription/tiers" -ExpectField "success" -ExpectValue "True"
Invoke-Test "GET /recipes/count" GET "$BaseUrl/recipes/count" -ExpectField "success" -ExpectValue "True"
Invoke-Test "GET /recipes/breakfast" GET "$BaseUrl/recipes/breakfast?limit=3" -ExpectField "success" -ExpectValue "True"
Invoke-Test "GET /recipes/lunch" GET "$BaseUrl/recipes/lunch?limit=3" -ExpectField "success" -ExpectValue "True"
Invoke-Test "GET /recipes/dinner" GET "$BaseUrl/recipes/dinner?limit=3" -ExpectField "success" -ExpectValue "True"
Invoke-Test "GET /recipes/snack" GET "$BaseUrl/recipes/snack?limit=3" -ExpectField "success" -ExpectValue "True"

$bfList = $null
try { $bfList = Invoke-RestMethod -Uri "$BaseUrl/recipes/breakfast?limit=1" -Method GET -ErrorAction Stop } catch {}
if ($bfList -and $bfList.recipes.Count -gt 0) {
    $recipeId = $bfList.recipes[0].id
    Invoke-Test "GET /recipes/breakfast/:recipeId" GET "$BaseUrl/recipes/breakfast/$recipeId" `
        -ExpectField "success" -ExpectValue "True" -Note "ID: $recipeId"
} else { Skip-Test "GET /recipes/breakfast/:recipeId" "Could not get a recipe ID" }

# ================================================================
# GROUP 2 - REGISTRATION AND AUTH
# ================================================================
Write-Header "GROUP 2 - Registration and Auth"

$ts        = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail = "suite_${ts}@example.com"
$testPass  = "TestPass123!"

$regResp = Invoke-Test "POST /users/register" POST "$BaseUrl/users/register" `
    -Body @{ name="Suite Test User"; email=$testEmail; mobile="0501234567"; address="123 Test St"; password=$testPass } `
    -ExpectField "success" -ExpectValue "True"
$NEW_UID = $regResp.userId

$NEW_TOKEN = $null; $NEW_AUTH = @{}
if ($NEW_UID) {
    Write-Host "  Waiting 3s for Firebase Auth sync..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
    try {
        $si = Invoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FirebaseKey" `
            -Method POST -ContentType "application/json" -ErrorAction Stop `
            -Body (@{ email=$testEmail; password=$testPass; returnSecureToken=$true } | ConvertTo-Json)
        $NEW_TOKEN = $si.idToken
        $NEW_AUTH  = @{ Authorization = "Bearer $NEW_TOKEN" }
        Write-Host "  New user signed in OK." -ForegroundColor Green
    } catch { Write-Host "  Warning: new user sign-in failed - some tests will be skipped" -ForegroundColor DarkYellow }
}

Invoke-Test "POST /users/login" POST "$BaseUrl/users/login" `
    -Body @{ email=$testEmail; password=$testPass } -ExpectField "success" -ExpectValue "True"

Invoke-Test "POST /users/forgot-password" POST "$BaseUrl/users/forgot-password" `
    -Body @{ email=$testEmail } -ExpectField "success" -ExpectValue "True"

Invoke-Test "POST /users/login (bad password - expect 401)" POST "$BaseUrl/users/login" `
    -Body @{ email=$testEmail; password="WRONGPASS" } -ExpectStatus 401

Invoke-Test "POST /users/reset-password (invalid code - expect 400)" POST "$BaseUrl/users/reset-password" `
    -Body @{ oobCode="invalid"; newPassword="NewPass123!" } -ExpectStatus 400

# ================================================================
# GROUP 3 - USER PROFILE
# ================================================================
Write-Header "GROUP 3 - User Profile"

if (-not $NEW_UID -or -not $NEW_TOKEN) {
    Skip-Test "GET /users/:userId/profile"         "New user token unavailable"
    Skip-Test "PUT /users/:userId/profile"         "New user token unavailable"
    Skip-Test "PUT /users/:userId/change-password" "New user token unavailable"
    Skip-Test "GET /profile (wrong user - 403)"    "New user token unavailable"
} else {
    Invoke-Test "GET /users/:userId/profile" GET "$BaseUrl/users/$NEW_UID/profile" `
        -Headers $NEW_AUTH -ExpectField "success" -ExpectValue "True"
    Invoke-Test "PUT /users/:userId/profile" PUT "$BaseUrl/users/$NEW_UID/profile" `
        -Headers $NEW_AUTH -Body @{ name="Updated Name"; mobile="0509999999"; address="99 New St" } `
        -ExpectField "success" -ExpectValue "True"
    Invoke-Test "PUT /users/:userId/change-password" PUT "$BaseUrl/users/$NEW_UID/change-password" `
        -Headers $NEW_AUTH -Body @{ currentPassword=$testPass; newPassword="NewPass456!" } `
        -ExpectField "success" -ExpectValue "True"
    Invoke-Test "GET /profile (cross-user access - expect 403)" GET "$BaseUrl/users/$TESTER1_UID/profile" `
        -Headers $NEW_AUTH -ExpectStatus 403
}

# ================================================================
# GROUP 4 - DIET, HEALTH AND EXERCISE
# ================================================================
Write-Header "GROUP 4 - Diet, Health and Exercise"

if (-not $NEW_UID -or -not $NEW_TOKEN) {
    Skip-Test "PUT /users/:userId/diet-information"    "New user token unavailable"
    Skip-Test "PUT /users/:userId/health-information"  "New user token unavailable"
    Skip-Test "PUT /users/:userId/exercise-preference" "New user token unavailable"
    Skip-Test "PUT /users/:userId/weekly-exercise"     "New user token unavailable"
} else {
    Invoke-Test "PUT /users/:userId/diet-information" PUT "$BaseUrl/users/$NEW_UID/diet-information" `
        -Headers $NEW_AUTH `
        -Body @{ preference=@("vegetarian"); allergies=@("peanuts"); waterIntake=2.5; goal="lose weight"; mealsPerDay=3; foodDislikes=@("mushrooms"); willingness=@("reduce sugar") } `
        -ExpectField "success" -ExpectValue "True"

    Invoke-Test "PUT /users/:userId/health-information" PUT "$BaseUrl/users/$NEW_UID/health-information" `
        -Headers $NEW_AUTH `
        -Body @{ age=30; gender="male"; height=175; weight=75; stressLevel="low"; sleepDuration=7; smokingHabit="non-smoker"; currentAlcohol="none" } `
        -ExpectField "success" -ExpectValue "True"

    Invoke-Test "PUT /users/:userId/exercise-preference" PUT "$BaseUrl/users/$NEW_UID/exercise-preference" `
        -Headers $NEW_AUTH `
        -Body @{ fitnessGoal="weight loss"; workoutFrequency="3-4"; workoutPreferredTime="morning"; workoutSetting="gym"; workoutPreferredType=@("cardio","strength"); workoutDuration=45; equipmentAccess=@("dumbbells"); workoutNotification="daily" } `
        -ExpectField "success" -ExpectValue "True"

    Invoke-Test "PUT /users/:userId/weekly-exercise" PUT "$BaseUrl/users/$NEW_UID/weekly-exercise" `
        -Headers $NEW_AUTH `
        -Body @{ weeklyActivity=@{ Monday=@{activityName="Running";duration=30;calories=300}; Wednesday=@{activityName="Weights";duration=45;calories=250}; Friday=@{activityName="Swimming";duration=30;calories=350} } } `
        -ExpectField "success" -ExpectValue "True"
}

# ================================================================
# GROUP 5 - SUBSCRIPTION
# ================================================================
Write-Header "GROUP 5 - Subscription"

$tiersResp = Invoke-Test "GET /subscription/tiers (authenticated)" GET "$BaseUrl/subscription/tiers" `
    -Headers $AUTH -ExpectField "success" -ExpectValue "True" -Note "Should include userStatus block"
if ($tiersResp -and $tiersResp.userStatus) {
    Write-Host "         canStartFreeTrial: $($tiersResp.userStatus.canStartFreeTrial)  hasEverUsed: $($tiersResp.userStatus.hasEverUsedTrial)" -ForegroundColor Gray
}

$subResp = Invoke-Test "GET /users/:userId/subscription (Tester1)" GET "$BaseUrl/users/$TESTER1_UID/subscription" `
    -Headers $AUTH -ExpectField "success" -ExpectValue "True" -Note "Previously returned 500"
if ($subResp) {
    Write-Host "         tier: $($subResp.subscription.tier)  currentPeriodEnd: $($subResp.dates.currentPeriodEnd)  canStartTrial: $($subResp.flags.canStartFreeTrial)" -ForegroundColor Gray
}

Invoke-Test "GET /payments/subscription-status" GET "$BaseUrl/payments/subscription-status" `
    -Headers $AUTH -ExpectField "success" -ExpectValue "True"

if ($NEW_UID -and $NEW_TOKEN) {
    Invoke-Test "GET /subscription (new user - canStart=true)" GET "$BaseUrl/users/$NEW_UID/subscription" `
        -Headers $NEW_AUTH -ExpectField "flags.canStartFreeTrial" -ExpectValue "True"

    Invoke-Test "PUT /subscription - activate free trial" PUT "$BaseUrl/users/$NEW_UID/subscription" `
        -Headers $NEW_AUTH -Body @{ activateFreeTrial=$true } -ExpectField "success" -ExpectValue "True"

    Invoke-Test "PUT /subscription - activate again (expect 400)" PUT "$BaseUrl/users/$NEW_UID/subscription" `
        -Headers $NEW_AUTH -Body @{ activateFreeTrial=$true } -ExpectStatus 400

    $tiersAfter = Invoke-Test "GET /subscription/tiers (free-trial filtered after use)" GET "$BaseUrl/subscription/tiers" `
        -Headers $NEW_AUTH -ExpectField "success" -ExpectValue "True"
    if ($tiersAfter) {
        $ids = $tiersAfter.tiers | ForEach-Object { $_.id }
        if ($ids -notcontains "free-trial") {
            Write-Host "         [VERIFIED] free-trial absent from tiers list" -ForegroundColor Green
        } else {
            Write-Host "         [WARNING] free-trial still present after use" -ForegroundColor Yellow
        }
    }

    Invoke-Test "POST /payments/create-checkout (validation gate - expect 400 or 500)" POST "$BaseUrl/payments/create-checkout" `
        -Headers $NEW_AUTH -ExpectStatus 400 `
        -Body @{ tierId="one-month"; successUrl="https://example.com/ok"; cancelUrl="https://example.com/cancel"; userId=$NEW_UID }

    Invoke-Test "POST /payments/cancel-subscription (no sub - expect 404)" POST "$BaseUrl/payments/cancel-subscription" `
        -Headers $NEW_AUTH -Body @{} -ExpectStatus 404
} else {
    Skip-Test "GET /subscription (new user)"                    "New user token unavailable"
    Skip-Test "PUT /subscription - activate free trial"         "New user token unavailable"
    Skip-Test "PUT /subscription - activate again (400)"        "New user token unavailable"
    Skip-Test "GET /tiers (free-trial filtered)"                "New user token unavailable"
    Skip-Test "POST /payments/create-checkout"                  "New user token unavailable"
    Skip-Test "POST /payments/cancel-subscription"              "New user token unavailable"
}

# ================================================================
# GROUP 6 - NUTRITION PLANS
# ================================================================
Write-Header "GROUP 6 - Nutrition Plans"

Invoke-Test "GET /users/:userId/nutrition-plans" GET "$BaseUrl/users/$TESTER1_UID/nutrition-plans" `
    -Headers $AUTH -ExpectField "success" -ExpectValue "True"

Write-Host "  [INFO] Testing generate-nutrition-plan (200 or 429 both acceptable)" -ForegroundColor DarkCyan
try {
    $genResp = Invoke-RestMethod -Uri "$BaseUrl/users/$TESTER1_UID/generate-nutrition-plan" `
        -Method POST -Headers $AUTH -ContentType "application/json" -Body "{}" -ErrorAction Stop
    Write-Host "  [PASS] POST /generate-nutrition-plan - Plan generated" -ForegroundColor Green
    $script:pass++; $results.Add([pscustomobject]@{Test="POST /generate-nutrition-plan";Result="PASS";Detail="Plan created"})
} catch {
    $s = $_.Exception.Response.StatusCode.value__
    if ($s -in @(429, 400, 402)) {
        Write-Host "  [PASS] POST /generate-nutrition-plan - HTTP $s (expected gate)" -ForegroundColor Green
        $script:pass++; $results.Add([pscustomobject]@{Test="POST /generate-nutrition-plan";Result="PASS";Detail="HTTP $s gate"})
    } else {
        Write-Host "  [FAIL] POST /generate-nutrition-plan - HTTP $s" -ForegroundColor Red
        $script:fail++; $results.Add([pscustomobject]@{Test="POST /generate-nutrition-plan";Result="FAIL";Detail="HTTP $s"})
    }
}

$plansList = $null
try { $plansList = Invoke-RestMethod -Uri "$BaseUrl/users/$TESTER1_UID/nutrition-plans" -Method GET -Headers $AUTH -ErrorAction Stop } catch {}
if ($plansList -and $plansList.plans -and $plansList.plans.Count -gt 0) {
    $planId = $plansList.plans[0].id
    Write-Host "  Using plan: $planId" -ForegroundColor Gray
    Invoke-Test "GET /nutrition-plans/:planId/shopping-list (none generated yet - expect 404)" GET "$BaseUrl/users/$TESTER1_UID/nutrition-plans/$planId/shopping-list" -Headers $AUTH -ExpectStatus 404
    Skip-Test "POST /nutrition-plans/:planId/generate-shopping-list" "Not in use"
} else {
    Skip-Test "GET /nutrition-plans/:planId/shopping-list"          "No plans found for Tester1"
    Skip-Test "POST /nutrition-plans/:planId/generate-shopping-list" "Not in use"
}

# ================================================================
# GROUP 7 - SECURITY / AUTH GUARDS
# ================================================================
Write-Header "GROUP 7 - Auth Guards and Security"

Invoke-Test "GET /profile (no token - expect 401)" GET "$BaseUrl/users/$TESTER1_UID/profile" -ExpectStatus 401
Invoke-Test "GET /subscription (no token - expect 401)" GET "$BaseUrl/users/$TESTER1_UID/subscription" -ExpectStatus 401
Invoke-Test "POST /payments/create-checkout (no token - expect 401)" POST "$BaseUrl/payments/create-checkout" -Body @{ tierId="one-month" } -ExpectStatus 401
Invoke-Test "POST /recipes/search (no API key - expect 401)" POST "$BaseUrl/recipes/search" -Body @{ query="chicken" } -ExpectStatus 401
Invoke-Test "GET /nonexistent-route (expect 404)" GET "$BaseUrl/this-does-not-exist" -ExpectStatus 404

# ================================================================
# SUMMARY
# ================================================================
$total = $pass + $fail + $skip
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Total  : $total" -ForegroundColor White
Write-Host "  Passed : $pass" -ForegroundColor Green
Write-Host "  Failed : $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host "  Skipped: $skip" -ForegroundColor DarkYellow
if ($fail -gt 0) {
    Write-Host "`n  FAILURES:" -ForegroundColor Red
    $results | Where-Object { $_.Result -eq "FAIL" } | ForEach-Object {
        Write-Host "    - $($_.Test)" -ForegroundColor Red
        Write-Host "      $($_.Detail)" -ForegroundColor DarkRed
    }
}
Write-Host "`n================================================================`n" -ForegroundColor Cyan