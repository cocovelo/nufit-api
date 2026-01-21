# Test Scheduled Functions
# This script tests the subscription management scheduled functions

Write-Host ""
Write-Host "=== Testing Scheduled Functions ===" -ForegroundColor Cyan
Write-Host "Project: nufit-67bf0" -ForegroundColor Gray

# Check if index is ready
Write-Host ""
Write-Host "1. Checking Firestore index status..." -ForegroundColor Yellow
$indexStatus = gcloud firestore indexes composite list --database="(default)" --project nufit-67bf0 --format=json | ConvertFrom-Json
$usersIndex = $indexStatus | Where-Object { $_.collectionGroup -eq "users" }

if ($usersIndex.state -eq "READY") {
    Write-Host "   Index is READY" -ForegroundColor Green
} else {
    Write-Host "   Index status: $($usersIndex.state)" -ForegroundColor Red
    Write-Host "   Waiting for index to complete building..." -ForegroundColor Yellow
    Write-Host "   This may take 2-5 minutes. Please run this script again later." -ForegroundColor Yellow
    exit 1
}

# Test 1: Trigger scheduledExpireSubscriptions
Write-Host ""
Write-Host "2. Testing scheduledExpireSubscriptions..." -ForegroundColor Yellow
Write-Host "   Triggering function..." -ForegroundColor Gray
gcloud scheduler jobs run firebase-schedule-scheduledExpireSubscriptions-us-central1 --project nufit-67bf0 | Out-Null

Write-Host "   Waiting 5 seconds for execution..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "   Checking logs..." -ForegroundColor Gray
$logs1Raw = gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=scheduledExpireSubscriptions" --limit=5 --project nufit-67bf0 --format=json 2>$null
if ($logs1Raw) {
    $logs1 = $logs1Raw | ConvertFrom-Json
    $hasError = $logs1 | Where-Object { $_.severity -eq "ERROR" }
    if ($hasError) {
        Write-Host "   Function execution had errors" -ForegroundColor Red
    } else {
        Write-Host "   No errors in logs" -ForegroundColor Green
    }
}

# Test 2: Trigger scheduledResetQuotas
Write-Host ""
Write-Host "3. Testing scheduledResetQuotas..." -ForegroundColor Yellow
Write-Host "   Triggering function..." -ForegroundColor Gray
gcloud scheduler jobs run firebase-schedule-scheduledResetQuotas-us-central1 --project nufit-67bf0 | Out-Null

Write-Host "   Waiting 5 seconds for execution..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "   Checking logs..." -ForegroundColor Gray
$logs2Raw = gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=scheduledResetQuotas" --limit=5 --project nufit-67bf0 --format=json 2>$null
if ($logs2Raw) {
    $logs2 = $logs2Raw | ConvertFrom-Json
    $hasError = $logs2 | Where-Object { $_.severity -eq "ERROR" }
    if ($hasError) {
        Write-Host "   Function execution had errors" -ForegroundColor Red
    } else {
        Write-Host "   No errors in logs" -ForegroundColor Green
    }
}

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Scheduled functions are deployed and configured to run:" -ForegroundColor Gray
Write-Host "  scheduledExpireSubscriptions: Daily at 2:00 AM UTC" -ForegroundColor Gray
Write-Host "  scheduledResetQuotas: Daily at 3:00 AM UTC" -ForegroundColor Gray
Write-Host ""
Write-Host "Cloud Scheduler:" -ForegroundColor Gray
Write-Host "  https://console.cloud.google.com/cloudscheduler?project=nufit-67bf0" -ForegroundColor Blue
Write-Host ""
