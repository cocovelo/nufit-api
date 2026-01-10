# API Testing Guide

## Quick Start - Test Your API in 3 Ways

### ✅ Method 1: PowerShell Script (Recommended)

Run the automated test script:

```powershell
cd "c:\Users\colin\Documents\js_cloud_functions\crypto-real-time-data-collector\nufit-data-collection"
.\test-api-quick.ps1
```

**What it tests:**
- ✓ Health check
- ✓ Recipe counts
- ✓ Recipe listings
- ✓ User registration (with lowercase field names)

---

### ✅ Method 2: Browser Testing

Open `test-api-browser.html` in your browser for an interactive testing interface with visual results.

```powershell
start test-api-browser.html
```

---

### ✅ Method 3: Manual PowerShell Commands

#### Test 1: Health Check
```powershell
Invoke-RestMethod -Uri "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/health"
```

#### Test 2: Get Recipe Counts
```powershell
Invoke-RestMethod -Uri "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/count"
```

#### Test 3: Get Breakfast Recipes
```powershell
Invoke-RestMethod -Uri "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast?limit=10"
```

#### Test 4: User Registration (Phase 1)
```powershell
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$body = @{
    name = "Test User"
    email = "test_${timestamp}@example.com"
    mobile = "1234567890"
    address = "123 Test Street"
    password = "TestPass123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully (Phase 1/5)",
  "userId": "abc123...",
  "email": "test_1768046740@example.com",
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

---

## Important Field Name Changes

**All API endpoints now use lowercase/camelCase field names:**

### Phase 1 - Registration
```javascript
{
  name: "John Doe",           // was: NAME
  email: "user@example.com",  // was: EMAIL
  mobile: "1234567890",       // was: MOBILE
  address: "123 Main St",     // was: ADDRESS
  password: "Pass123"         // was: PASSKEY
}
```

### Phase 2 - Diet Information
```javascript
{
  preference: "vegetarian",        // was: PREFERENCE
  allergies: "peanuts",           // was: ALLERGIES
  waterIntake: "2.5",             // was: WINTAKE
  foodPreference: "Indian",       // was: FPREFERENCE
  useSupplements: "yes",          // was: USUPPLEMENTS
  supplementIntake: "protein",    // was: SINTAKE
  goal: "lose weight",            // was: GOAL
  mealsPerDay: "3",               // was: MEALSPERDAY
  preferredEatingTimes: "7am",    // was: PETIMES
  snackHabits: "fruits",          // was: SNACKHABITS
  foodDislikes: "broccoli",       // was: FOODDISLIKES
  willingness: "high"             // was: WILLINGNESS
}
```

### Phase 3 - Health Information
```javascript
{
  medicalConditions: "diabetes",  // was: MCONDITIONS
  allergies: "penicillin",        // was: ALLERGIES
  smokingHabit: "no",             // was: SMOKINGHABIT
  sleepDuration: "7",             // was: SDURATION
  stressLevel: "medium",          // was: STRESSLEVEL
  pastInjuries: "none",           // was: PINJURIES
  medications: "metformin",       // was: MEDICATIONS
  currentAlcohol: "no",           // was: CALCOHOL
  lastAlcohol: "occasional",      // was: LALCOHOL
  otherIssues: "none"             // was: OTHERISSUE
}
```

### Phase 4 - Exercise Preference
```javascript
{
  fitnessGoal: "strength",             // was: FGOAL
  workoutFrequency: "3-4 times",       // was: WFREQUENCY
  workoutPreferredTime: "morning",     // was: WPREFERREDT
  workoutSetting: "gym",               // was: WSETTING
  workoutPreferredType: "weightlifting", // was: WPREFERREDTY
  workoutDuration: "60",               // was: WDURATION
  equipmentAccess: "full gym",         // was: EACCESS
  workoutNotification: "yes"           // was: WNOTIFICATION
}
```

---

## Testing Protected Endpoints (Requires Firebase Auth)

For endpoints that require authentication (Phases 2-5, profile updates, nutrition plan generation), you need a Firebase Auth token:

### Step 1: Get Firebase Auth Token

```javascript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();
```

### Step 2: Use Token in API Calls

```powershell
$headers = @{
    "Authorization" = "Bearer $firebaseToken"
}

Invoke-RestMethod -Uri "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/$userId/profile" -Headers $headers
```

---

## Common Issues

### Issue 1: Registration Returns 500 Error with IAM Permission
**Error:** `Permission 'iam.serviceAccounts.signBlob' denied`

**Reason:** Custom token generation requires special IAM permissions.

**Workaround:** Custom token generation has been removed. Use Firebase Auth SDK to sign in users after registration:
```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';
await signInWithEmailAndPassword(auth, email, password);
```

### Issue 2: Recipe Names Show as "undefined"
**Reason:** Recipe data structure may have different field names.

**Check:** The actual field name in Firestore (might be `recipeName`, `Recipe_Name`, etc.)

---

## Full Test Workflow

1. **Register User** → POST `/v1/users/register` with `name`, `email`, `password`
2. **Sign In** → Use Firebase Auth SDK to get token
3. **Complete Phase 2** → PUT `/v1/users/{userId}/diet-information`
4. **Complete Phase 3** → PUT `/v1/users/{userId}/health-information`
5. **Complete Phase 4** → PUT `/v1/users/{userId}/exercise-preference`
6. **Complete Phase 5** → PUT `/v1/users/{userId}/weekly-exercise`
7. **Generate Plan** → POST `/v1/users/{userId}/generate-nutrition-plan`

---

## API Base URL

```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1
```

## Documentation Files

- `API_DOCUMENTATION.md` - Complete API reference
- `API_QUICK_REFERENCE.md` - Quick start guide
- `API_CHANGES_SUMMARY.md` - Change history
- `complete-workflow-demo.js` - Full working example

---

**Last Updated:** January 10, 2026
