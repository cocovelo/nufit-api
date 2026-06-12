# ============================================================
# Fix Verification Tests
# Tests the 3 issues reported and fixed:
#   1. GET /users/:userId/subscription  -> was 500, fix: currentPeriodEnd.toDate()
#   2. GET /subscription/tiers          -> was 404, fix: redeployment
#   3. GET /subscription/tiers (authed) -> free-trial must be absent for users who already used it
# ============================================================

$API_BASE  = "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1"
$USER_ID   = "TL0ux8VArpVAxqUw16yIIxbxkTf1"   # Tester1 - has hasUsedFreeTrial = true
$FIREBASE_API_KEY = "AIzaSyBou0UNhWnqJBAPrDw7sQ9f-gVsHWfHB6A"

$pass = 0
$fail = 0

function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:pass++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;  $script:fail++ }
function Write-Info($msg) { Write-Host "         $msg" -ForegroundColor Gray }

# ────────────────────────────────────────────────────────────
# Step 0: Get a fresh auth token for Tester1
# ────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Fix Verification Tests - Nufit API" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "[Setup] Getting auth token for Tester1..." -ForegroundColor Yellow

$customToken = node -e @"
const admin = require('firebase-admin');
const key = require('./functions/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key) });
admin.auth().createCustomToken('$USER_ID')
  .then(t => { process.stdout.write(t); process.exit(0); })
  .catch(e => { process.stderr.write(e.message); process.exit(1); });
"@

if ($LASTEXITCODE -ne 0 -or -not $customToken) {
    Write-Host "  [ERROR] Could not generate custom token. Aborting." -ForegroundColor Red
    exit 1
}

$body = @{ token = $customToken; returnSecureToken = $true } | ConvertTo-Json
try {
    $tokenResponse = Invoke-RestMethod `
        -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$FIREBASE_API_KEY" `
        -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    $ID_TOKEN = $tokenResponse.idToken
    Write-Host "  Token obtained successfully.`n" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Token exchange failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$authHeaders = @{ Authorization = "Bearer $ID_TOKEN" }

# ────────────────────────────────────────────────────────────
# Test 1: GET /subscription/tiers  (no auth - public)
# Was: 404 Not Found
# Expected: 200 with success=true and tiers array
# ────────────────────────────────────────────────────────────
Write-Host "[Test 1] Subscription Plans - Public (no auth)" -ForegroundColor Yellow
Write-Host "         GET $API_BASE/subscription/tiers" -ForegroundColor DarkGray
try {
    $r = Invoke-RestMethod -Uri "$API_BASE/subscription/tiers" -Method Get -ErrorAction Stop

    if ($r.success -eq $true -and $r.tiers -and $r.tiers.Count -gt 0) {
        Write-Pass "Returned $($r.tiers.Count) tier(s) - endpoint is live"
        $r.tiers | ForEach-Object { Write-Info "  - $($_.id): $($_.name) ($($_.priceFormatted))" }
    } else {
        Write-Fail "Unexpected response shape"
        Write-Info ($r | ConvertTo-Json -Depth 3)
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Fail "HTTP $status - $($_.Exception.Message)"
}
Write-Host ""

# ────────────────────────────────────────────────────────────
# Test 2: GET /subscription/tiers  (authenticated as Tester1)
# Tester1 has hasUsedFreeTrial = true
# Expected: free-trial tier is NOT present in the tiers array
# ────────────────────────────────────────────────────────────
Write-Host "[Test 2] Subscription Plans - Authenticated (free-trial filtering)" -ForegroundColor Yellow
Write-Host "         GET $API_BASE/subscription/tiers  [with Bearer token]" -ForegroundColor DarkGray
try {
    $r = Invoke-RestMethod -Uri "$API_BASE/subscription/tiers" -Method Get -Headers $authHeaders -ErrorAction Stop

    if ($r.success -eq $true) {
        $tierIds   = $r.tiers | ForEach-Object { $_.id }
        $hasTrial  = $tierIds -contains 'free-trial'
        $canStart  = $r.userStatus.canStartFreeTrial
        $usedTrial = $r.userStatus.hasEverUsedTrial

        Write-Info "Tiers returned     : $($tierIds -join ', ')"
        Write-Info "hasEverUsedTrial   : $usedTrial"
        Write-Info "canStartFreeTrial  : $canStart"
        Write-Info "free-trial in list : $hasTrial"

        # Correct behaviour depends on whether this user has used the trial:
        #   - hasEverUsedTrial = true  → free-trial must NOT appear in tiers
        #   - hasEverUsedTrial = false → free-trial SHOULD appear in tiers
        if ($usedTrial -eq $true -and -not $hasTrial) {
            Write-Pass "free-trial correctly hidden for user who has already used it"
        } elseif ($usedTrial -eq $true -and $hasTrial) {
            Write-Fail "free-trial still present even though user has already used it (filter not working)"
        } elseif ($usedTrial -eq $false -and $hasTrial) {
            Write-Pass "free-trial correctly shown for user who has not yet used it"
            Write-Info "(To fully test filtering, run this endpoint as a user with hasUsedFreeTrial=true)"
        } else {
            Write-Fail "free-trial unexpectedly absent for user who has not used it"
        }
    } else {
        Write-Fail "Response success was not true"
        Write-Info ($r | ConvertTo-Json -Depth 3)
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Fail "HTTP $status - $($_.Exception.Message)"
}
Write-Host ""

# ────────────────────────────────────────────────────────────
# Test 3: GET /users/:userId/subscription  (authenticated)
# Was: 500 "userData.currentPeriodEnd?.toDate is not a function"
# Expected: 200 with full subscription details
# ────────────────────────────────────────────────────────────
Write-Host "[Test 3] User Subscription Details - Was 500 Error" -ForegroundColor Yellow
Write-Host "         GET $API_BASE/users/$USER_ID/subscription  [with Bearer token]" -ForegroundColor DarkGray
try {
    $r = Invoke-RestMethod -Uri "$API_BASE/users/$USER_ID/subscription" -Method Get -Headers $authHeaders -ErrorAction Stop

    if ($r.success -eq $true) {
        Write-Pass "HTTP 200 - No longer crashing"
        Write-Info "subscription.isActive   : $($r.subscription.isActive)"
        Write-Info "subscription.tier       : $($r.subscription.tier)"
        Write-Info "freeTrial.hasEverUsed   : $($r.freeTrial.hasEverUsedTrial)"
        Write-Info "freeTrial.isCurrently   : $($r.freeTrial.isCurrentlyInTrial)"
        Write-Info "dates.currentPeriodEnd  : $($r.dates.currentPeriodEnd)"
        Write-Info "flags.canStartFreeTrial : $($r.flags.canStartFreeTrial)"
    } else {
        Write-Fail "Response success was not true"
        Write-Info ($r | ConvertTo-Json -Depth 4)
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    try {
        $stream  = $_.Exception.Response.GetResponseStream()
        $reader  = New-Object System.IO.StreamReader($stream)
        $body    = $reader.ReadToEnd() | ConvertFrom-Json
        Write-Fail "HTTP $statusCode - $($body.error): $($body.message)"
    } catch {
        Write-Fail "HTTP $statusCode - $($_.Exception.Message)"
    }
}
Write-Host ""

# ────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Results: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "========================================`n" -ForegroundColor Cyan
