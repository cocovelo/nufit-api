# API Registration Issue - Resolution Guide

## Issue Summary

You encountered a 500 Internal Server Error when registering a user, followed by a 409 Conflict error when retrying. This has been **resolved** with improved error handling and auto-cleanup functionality.

## Root Cause

**You were using OLD uppercase field names (`NAME`, `EMAIL`, `PASSKEY`) instead of the current lowercase field names (`name`, `email`, `password`).**

The API has been updated to use lowercase field names as documented in `API_DOCUMENTATION.md`.

## ✅ SOLUTION: Update Your Request Format

### ❌ OLD Format (DO NOT USE)
```json
{
    "NAME": "Rahul",
    "EMAIL": "t02@gmail.com",
    "MOBILE": "0504892099",
    "ADDRESS": "Fujairah",
    "PASSKEY": "123456"
}
```

### ✅ NEW Format (CORRECT)
```json
{
    "name": "Rahul",
    "email": "t02@gmail.com",
    "mobile": "0504892099",
    "address": "Fujairah",
    "password": "123456"
}
```

### Key Changes:
- `NAME` → `name`
- `EMAIL` → `email`
- `MOBILE` → `mobile`
- `ADDRESS` → `address`
- `PASSKEY` → `password` (note: it's "password" not "passkey")

## What We've Improved

The API now has **enhanced error handling** that will help you avoid these issues:

### 1. **Detects Old Field Names**
If you use uppercase field names, you'll now get a helpful error:
```json
{
    "error": "Invalid field names",
    "message": "API uses lowercase field names. Please update your request.",
    "hint": "Use: name, email, password, mobile, address (all lowercase)",
    "receivedFields": ["NAME", "EMAIL", "PASSKEY", "MOBILE", "ADDRESS"],
    "expectedFields": ["name", "email", "password", "mobile", "address"],
    "documentation": "See API_DOCUMENTATION.md for complete field reference"
}
```

### 2. **Better Validation Messages**
Missing fields, invalid email, weak password - all provide clear guidance:
```json
{
    "error": "Missing required fields",
    "message": "The following required fields are missing: email, password",
    "missingFields": ["email", "password"],
    "receivedFields": ["name", "mobile"],
    "requiredFields": ["name", "email", "password"],
    "optionalFields": ["mobile", "address"]
}
```

### 3. **Auto-Cleanup on Errors**
Previously, if registration failed after creating a Firebase Auth user, you'd get orphaned accounts. The API now:
- Creates Firebase Auth user
- Creates Firestore profile
- **If Firestore fails**, automatically deletes the Auth user
- Returns clear error message

This prevents the 500 → 409 situation you experienced.

### 4. **Improved Conflict Messages**
If an email already exists:
```json
{
    "error": "Email already exists",
    "message": "A user with this email already exists. Please try logging in instead.",
    "suggestion": "Use the login endpoint or try a different email address",
    "email": "t02@gmail.com"
}
```

## Testing Your Fix

### Option 1: Using Postman

**Endpoint:** `POST https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
    "name": "Rahul",
    "email": "rahul.test@gmail.com",
    "mobile": "0504892099",
    "address": "Fujairah",
    "password": "SecurePass123!"
}
```

**Expected Success Response (201):**
```json
{
    "success": true,
    "message": "User registered successfully (Phase 1/5)",
    "userId": "abc123...",
    "email": "rahul.test@gmail.com",
    "nextStep": "Complete diet information at PUT /v1/users/{userId}/diet-information",
    "registrationProgress": {
        "basicInfo": true,
        "dietInfo": false,
        "healthInfo": false,
        "exercisePreference": false,
        "weeklyExercise": false,
        "complete": false
    }
}
```

### Option 2: Using cURL

```bash
curl -X POST https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rahul",
    "email": "rahul.test@gmail.com",
    "mobile": "0504892099",
    "address": "Fujairah",
    "password": "SecurePass123!"
  }'
```

## Cleaning Up Test User

If you need to delete the test user `t02@gmail.com`:

1. Go to [Firebase Console](https://console.firebase.google.com/project/nufit-67bf0/authentication/users)
2. Find user with email `t02@gmail.com`
3. Click the three dots menu → Delete user

## All Registration Endpoints

### Phase 1: Basic Info (Public - No Auth Required)
```
POST /v1/users/register
Required: name, email, password
Optional: mobile, address
```

### Phase 2: Diet Info (Requires Auth Token)
```
PUT /v1/users/{userId}/diet-information
Fields: preference, allergies, waterIntake, foodPreference, useSupplements, 
        supplementIntake, goal, mealsPerDay, preferredEatingTimes, 
        snackHabits, foodDislikes, willingness
```

### Phase 3: Health Info (Requires Auth Token)
```
PUT /v1/users/{userId}/health-information
Fields: medicalConditions, allergies, smokingHabit, sleepDuration, 
        stressLevel, pastInjuries, medications, currentAlcohol, 
        lastAlcohol, otherIssues
```

### Phase 4: Exercise Preference (Requires Auth Token)
```
PUT /v1/users/{userId}/exercise-preference
Fields: fitnessGoal, workoutFrequency, workoutPreferredTime, 
        workoutSetting, workoutPreferredType, workoutDuration, 
        equipmentAccess, workoutNotification
```

### Phase 5: Weekly Exercise (Requires Auth Token)
```
PUT /v1/users/{userId}/weekly-exercise
Fields: weeklyActivity (object with Monday-Sunday data)
```

## Field Name Quick Reference

| OLD (UPPERCASE) | NEW (lowercase) | Notes |
|----------------|-----------------|--------|
| NAME | name | Required |
| EMAIL | email | Required |
| PASSKEY | password | Required (note the change!) |
| MOBILE | mobile | Optional |
| ADDRESS | address | Optional |
| PREFERENCE | preference | Phase 2 |
| WINTAKE | waterIntake | Phase 2 |
| MCONDITIONS | medicalConditions | Phase 3 |
| FGOAL | fitnessGoal | Phase 4 |

**See `API_DOCUMENTATION.md` for complete list of all fields across all phases.**

## Support

If you encounter any issues after updating to lowercase field names, the error messages will guide you. All error responses now include:
- Clear error descriptions
- Field validation details
- Suggestions for fixing the issue
- Documentation references

## Summary

✅ **Action Required:** Update all API requests to use lowercase field names  
✅ **Fixed:** Auto-cleanup prevents orphaned users  
✅ **Improved:** Detailed error messages guide you to the solution  
✅ **Ready:** API is deployed and ready for testing  

---

**API Base URL:** `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1`  
**Documentation:** See `API_DOCUMENTATION.md`, `API_QUICK_REFERENCE.md`, and `TESTING_GUIDE.md`  
**Test Scripts:** Use `test-api-quick.ps1` or `test-full-workflow.ps1` for validation
