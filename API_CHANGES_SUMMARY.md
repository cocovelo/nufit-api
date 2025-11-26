# Nufit API - Recent Changes Summary

**Last Updated:** November 26, 2025

This document summarizes the major API changes implemented in the latest update.

---

## 🔑 1. API Key Management - Never-Expiring Keys

### What Changed
- API keys now **never expire by default** (previously expired after 1 year)
- Added new command to convert existing keys to never-expiring
- Updated validation logic to handle null expiration dates

### New Features
```bash
# Create a never-expiring key (default)
node api-key-manager.js create "Developer Name" "email@example.com"

# Create a key that expires in 2 years
node api-key-manager.js create "Developer Name" "email@example.com" 2

# Convert existing key to never-expiring
node api-key-manager.js set-no-expiration nf_abc123...
```

### Database Schema Changes
```javascript
// apiKeys collection
{
  expiresAt: null,          // null = never expires (previously: Timestamp)
  neverExpires: true,       // NEW: Boolean flag
  // ... other fields unchanged
}
```

### Why This Change?
- Eliminates unexpected API key expiration issues
- Simplifies key management for long-term integrations
- Keys can still be manually revoked when needed

---

## 📝 2. User Registration - Split into 5 Phases

### What Changed
**OLD:** Single endpoint collecting all user data at once
**NEW:** Progressive 5-phase registration system for better user experience

### Phase Breakdown

#### **Phase 1: Basic Information**
```http
POST /v1/users/register
```
**Collects:**
- NAME (string, required)
- EMAIL (string, required, unique)
- MOBILE (string, required)
- ADDRESS (string, required)
- PASSKEY (string, required, min 6 characters)

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully (Phase 1/5)",
  "userId": "abc123",
  "nextStep": "Complete diet information at PUT /v1/users/{userId}/diet-information",
  "registrationProgress": {
    "basicInfo": true,
    "dietInformation": false,
    "healthInformation": false,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  }
}
```

---

#### **Phase 2: Diet Information**
```http
PUT /v1/users/:userId/diet-information
```
**Collects:**
- GOAL (string, required: "lose weight", "gain muscle", "maintain")
- FOOD_ALLERGIES (string, optional)
- FOOD_LIKES (string, optional)
- FOOD_DISLIKES (string, optional)
- PROTEIN_PERCENTAGE (number, optional, 0-1)
- CARBS_PERCENTAGE (number, optional, 0-1)
- FAT_PERCENTAGE (number, optional, 0-1)

**Validation:**
- Macro percentages must sum to 1.0 if provided

---

#### **Phase 3: Health Information**
```http
PUT /v1/users/:userId/health-information
```
**Collects:**
- AGE (number, required, > 0)
- GENDER (string, required: "male", "female", "other")
- HEIGHT (number, required, in cm)
- WEIGHT (number, required, in kg)
- FITNESS_LEVEL (string, optional: "beginner", "intermediate", "advanced")

---

#### **Phase 4: Exercise Preference**
```http
PUT /v1/users/:userId/exercise-preference
```
**Collects:**
- EXERCISE_PREFERENCE (string, required: preferred activities)

---

#### **Phase 5: Weekly Exercise Schedule** (Final Phase)
```http
PUT /v1/users/:userId/weekly-exercise
```
**Collects:**
- WEEKLY_EXERCISE (object, required)

**Example:**
```json
{
  "WEEKLY_EXERCISE": {
    "Monday": { "activityName": "Running", "duration": 45, "calories": 400 },
    "Tuesday": { "activityName": "Rest", "duration": 0, "calories": 0 },
    "Wednesday": { "activityName": "Gym", "duration": 60, "calories": 350 },
    "Thursday": { "activityName": "Rest", "duration": 0, "calories": 0 },
    "Friday": { "activityName": "Swimming", "duration": 30, "calories": 300 },
    "Saturday": { "activityName": "Cycling", "duration": 90, "calories": 500 },
    "Sunday": { "activityName": "Yoga", "duration": 45, "calories": 150 }
  }
}
```

**Special:** This phase sets `registrationComplete: true`

---

### Database Schema Changes
```javascript
// users collection
{
  // Basic Info (Phase 1)
  NAME: string,
  EMAIL: string,
  MOBILE: string,
  ADDRESS: string,
  
  // Diet Info (Phase 2)
  GOAL: string,
  FOOD_ALLERGIES: string,
  FOOD_LIKES: string,
  FOOD_DISLIKES: string,
  PROTEIN_PERCENTAGE: number,
  CARBS_PERCENTAGE: number,
  FAT_PERCENTAGE: number,
  
  // Health Info (Phase 3)
  AGE: number,
  GENDER: string,
  HEIGHT: number,
  WEIGHT: number,
  FITNESS_LEVEL: string,
  
  // Exercise (Phase 4 & 5)
  EXERCISE_PREFERENCE: string,
  WEEKLY_EXERCISE: object,
  
  // NEW: Registration Tracking
  registrationSteps: {
    basicInfo: boolean,
    dietInformation: boolean,
    healthInformation: boolean,
    exercisePreference: boolean,
    weeklyExercise: boolean
  },
  registrationComplete: boolean,  // NEW: true when all 5 phases done
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Why This Change?
- **Better UX:** Users can complete registration in multiple sessions
- **Mobile-Friendly:** Shorter forms work better on mobile apps
- **Clear Progress:** Users see exactly what steps remain
- **Validation:** Each phase validated independently

---

## ⏱️ 3. Nutrition Plan Generation - Enhanced Validations

### What Changed
**POST /v1/users/:userId/generate-nutrition-plan** now includes:
1. ✅ **Registration Completion Check**
2. ✅ **7-Day Rate Limiting**
3. ✅ **Automatic Plan Deactivation**

### Feature 1: Registration Validation

**Before:** Users could generate plans with incomplete profiles
**After:** All 5 registration phases must be complete

**Error Response (If Incomplete):**
```json
{
  "success": false,
  "error": "Registration not complete",
  "message": "Please complete all registration steps before generating a nutrition plan",
  "missingSteps": ["healthInformation", "weeklyExercise"],
  "registrationProgress": {
    "basicInfo": true,
    "dietInformation": true,
    "healthInformation": false,
    "exercisePreference": true,
    "weeklyExercise": false,
    "complete": false
  }
}
```

**Implementation:**
```javascript
// Check if registration is complete
if (!user.registrationComplete) {
  const missingSteps = Object.entries(user.registrationSteps || {})
    .filter(([step, completed]) => !completed)
    .map(([step]) => step);
    
  return res.status(400).json({
    success: false,
    error: 'Registration not complete',
    message: 'Please complete all registration steps before generating a nutrition plan',
    missingSteps,
    registrationProgress: user.registrationSteps
  });
}
```

---

### Feature 2: 7-Day Rate Limiting

**Before:** Users could generate unlimited plans
**After:** Only 1 plan allowed per 7 days (weekly updates)

**Error Response (If Rate Limited):**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "You can only generate one nutrition plan every 7 days",
  "lastPlanGeneratedAt": "2025-11-10T12:00:00.000Z",
  "nextAllowedDate": "2025-12-10T12:00:00.000Z",
  "daysRemaining": 15
}
```

**Implementation:**
```javascript
// Check last plan generation date
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const recentPlansQuery = await db.collection('nutritionPlans')
  .where('userId', '==', userId)
  .where('generatedAt', '>', sevenDaysAgo)
  .limit(1)
  .get();

if (!recentPlansQuery.empty) {
  const lastPlan = recentPlansQuery.docs[0].data();
  const nextAllowed = new Date(lastPlan.generatedAt.toDate());
  nextAllowed.setDate(nextAllowed.getDate() + 7);
  
  const daysRemaining = Math.ceil((nextAllowed - new Date()) / (1000 * 60 * 60 * 24));
  
  return res.status(429).json({
    success: false,
    error: 'Rate limit exceeded',
    message: 'You can only generate one nutrition plan every 7 days',
    lastPlanGeneratedAt: lastPlan.generatedAt.toDate().toISOString(),
    nextAllowedDate: nextAllowed.toISOString(),
    daysRemaining
  });
}
```

---

### Feature 3: Automatic Plan Deactivation

**Before:** All plans remained active, causing confusion
**After:** Only the latest plan is active; old plans are archived

**Database Schema Changes:**
```javascript
// nutritionPlans collection
{
  active: boolean,              // NEW: true for current plan, false for historical
  planStartDate: Timestamp,
  planEndDate: Timestamp,       // NEW: planStartDate + 7 days
  deactivatedAt: Timestamp,     // NEW: when plan was replaced
  // ... other fields unchanged
}
```

**Implementation:**
```javascript
// Before creating new plan, deactivate old plans
const oldPlansQuery = await db.collection('nutritionPlans')
  .where('userId', '==', userId)
  .where('active', '==', true)
  .get();

const batch = db.batch();
oldPlansQuery.docs.forEach(doc => {
  batch.update(doc.ref, {
    active: false,
    deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});
await batch.commit();

// Create new plan with active: true
const newPlan = {
  userId,
  active: true,
  planStartDate: admin.firestore.FieldValue.serverTimestamp(),
  planEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  // ... plan data
};
```

---

### Why These Changes?
1. **Registration Validation:**
   - Ensures complete user profiles for accurate calculations
   - Prevents errors from missing data
   - Clear feedback on what's needed

2. **7-Day Rate Limiting:**
   - Allows weekly plan updates based on progress
   - Prevents server overload from repeated requests
   - Users can adjust plans weekly as needed
   - Clear messaging about when they can generate next plan

3. **Plan Deactivation:**
   - Eliminates confusion about which plan to follow
   - Maintains history for user reference (if needed later)
   - Clean data structure (one active plan per user)

---

## 🎯 4. Active Plan Retrieval

### What Changed
**GET /v1/users/:userId/nutrition-plans**

**Before:** Returned last 10 plans (newest first)
**After:** Returns only the currently active plan

### Old Response (Before)
```json
{
  "success": true,
  "count": 10,
  "plans": [
    { "id": "plan1", "generatedAt": "2025-11-10...", ... },
    { "id": "plan2", "generatedAt": "2025-10-15...", ... },
    // ... 8 more plans
  ]
}
```

### New Response (After)
```json
{
  "success": true,
  "plan": {
    "id": "plan1",
    "active": true,
    "planStartDate": "2025-11-10T12:00:00.000Z",
    "planEndDate": "2025-12-10T12:00:00.000Z",
    "generatedAt": "2025-11-10T12:00:00.000Z",
    "days": {
      "Monday": { ... },
      "Tuesday": { ... },
      // ... all 7 days
    }
  }
}
```

### Implementation Change
```javascript
// OLD CODE
const plansSnapshot = await db.collection('nutritionPlans')
  .where('userId', '==', userId)
  .orderBy('generatedAt', 'desc')
  .limit(10)
  .get();

// NEW CODE
const planSnapshot = await db.collection('nutritionPlans')
  .where('userId', '==', userId)
  .where('active', '==', true)
  .limit(1)
  .get();

if (planSnapshot.empty) {
  return res.status(404).json({
    success: false,
    message: 'No active nutrition plan found'
  });
}

const plan = planSnapshot.docs[0].data();
```

### Why This Change?
- **Clarity:** Users always know which plan to follow (the active one)
- **Performance:** Smaller response size (1 plan vs 10 plans)
- **Mobile-Friendly:** Less data transferred over mobile networks
- **Simplicity:** No need for client-side filtering

---

## 📊 Summary of All Changes

| Feature | Before | After | Impact |
|---------|--------|-------|--------|
| **API Keys** | Expire after 1 year | Never expire (default) | No more unexpected expirations |
| **Registration** | Single endpoint, all data at once | 5 separate phases | Better UX, mobile-friendly |
| **Plan Generation** | No validation | Registration check + 7-day limit | Quality control, weekly updates |
| **Plan Retrieval** | Last 10 plans | Only active plan | Clearer, faster, simpler |
| **Old Plans** | All visible | Archived (active: false) | Clean data, history preserved |

---

## 🔄 Migration Guide for Developers

### If You Were Using the OLD API

#### 1. Update Registration Code
**OLD:**
```javascript
// Single registration call
const response = await fetch('/v1/users/register', {
  method: 'POST',
  body: JSON.stringify({
    email, password, name, age, gender, height, weight, goal,
    weeklyActivity, foodAllergies, // ... everything at once
  })
});
```

**NEW:**
```javascript
// Phase 1: Basic info
const reg1 = await fetch('/v1/users/register', {
  method: 'POST',
  body: JSON.stringify({ NAME, EMAIL, MOBILE, ADDRESS, PASSKEY })
});
const { userId } = await reg1.json();

// Phase 2: Diet info
await fetch(`/v1/users/${userId}/diet-information`, {
  method: 'PUT',
  body: JSON.stringify({ GOAL, FOOD_ALLERGIES, ... })
});

// Phase 3: Health info
await fetch(`/v1/users/${userId}/health-information`, {
  method: 'PUT',
  body: JSON.stringify({ AGE, GENDER, HEIGHT, WEIGHT, ... })
});

// Phase 4: Exercise preference
await fetch(`/v1/users/${userId}/exercise-preference`, {
  method: 'PUT',
  body: JSON.stringify({ EXERCISE_PREFERENCE })
});

// Phase 5: Weekly exercise (completes registration)
await fetch(`/v1/users/${userId}/weekly-exercise`, {
  method: 'PUT',
  body: JSON.stringify({ WEEKLY_EXERCISE: {...} })
});
```

---

#### 2. Update Plan Generation Error Handling
**Add these error checks:**

```javascript
const response = await fetch(`/v1/users/${userId}/generate-nutrition-plan`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();

// NEW: Check for registration incomplete
if (response.status === 400 && data.error === 'Registration not complete') {
  console.log('Missing steps:', data.missingSteps);
  // Show user which registration steps they need to complete
  // Redirect to appropriate phase
}

// NEW: Check for rate limiting
if (response.status === 429 && data.error === 'Rate limit exceeded') {
  console.log('Next allowed date:', data.nextAllowedDate);
  console.log('Days remaining:', data.daysRemaining);
  // Show user when they can generate next plan
}

// Success case
if (data.success) {
  console.log('Plan generated:', data.planId);
}
```

---

#### 3. Update Plan Retrieval
**OLD:**
```javascript
const response = await fetch(`/v1/users/${userId}/nutrition-plans`);
const { plans } = await response.json();
const activePlan = plans[0];  // Assumed first was active
```

**NEW:**
```javascript
const response = await fetch(`/v1/users/${userId}/nutrition-plans`);
const { plan } = await response.json();  // Single plan, not array
// plan is already the active one, no need to filter
```

---

## ✅ Backward Compatibility

### Breaking Changes
❌ **POST /v1/users/register** - Now only accepts Phase 1 fields
❌ **GET /v1/users/:userId/nutrition-plans** - Returns single plan, not array

### Non-Breaking Changes
✅ **API keys** - Old keys continue to work, but show expiration date
✅ **Existing users** - Can still generate plans (if no new plans in 7 days)
✅ **Database** - Old plans automatically get `active: false` on first new plan generation

---

## 🧪 Testing Recommendations

### 1. Test Progressive Registration
```bash
# Test Phase 1
curl -X POST https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{"NAME":"Test User","EMAIL":"test@example.com","MOBILE":"+123","ADDRESS":"123 St","PASSKEY":"test123"}'

# Test Phase 2
curl -X PUT https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/USER_ID/diet-information \
  -H "Content-Type: application/json" \
  -d '{"GOAL":"lose weight"}'

# ... test remaining phases
```

### 2. Test Registration Validation
```bash
# Try to generate plan with incomplete registration
curl -X POST https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/USER_ID/generate-nutrition-plan \
  -H "Authorization: Bearer TOKEN"

# Should return 400 with missingSteps array
```

### 3. Test 7-Day Rate Limit
```bash
# Generate first plan
curl -X POST .../generate-nutrition-plan -H "Authorization: Bearer TOKEN"

# Try immediately again
curl -X POST .../generate-nutrition-plan -H "Authorization: Bearer TOKEN"

# Should return 429 with nextAllowedDate (7 days from first generation)
```

### 4. Test Active Plan Retrieval
```bash
# Should return only active plan
curl https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/USER_ID/nutrition-plans \
  -H "Authorization: Bearer TOKEN"
```

---

## 📝 5. Field Names - UPPERCASE Format

### What Changed
All registration field names now use **UPPERCASE** format exactly as specified, stored without transformation.

### Field Name Updates

#### Phase 2 - Diet Information
- `PREFERENCE` - Dietary preference (Vegetarian, Vegan, etc.)
- `ALLERGIES` - Food allergies
- `WINTAKE` - Water intake in liters
- `FPREFERENCE` - Preferred foods
- `USUPPLEMENTS` - Uses supplements (Yes/No)
- `SINTAKE` - Supplement details
- `GOAL` - Fitness goal (required)
- `MEALSPERDAY` - Meals per day (1-8)
- `PETIMES` - Preferred eating times
- `SNACKHABITS` - Snacking habits
- `FOODDISLIKES` - Foods to avoid
- `WILLINGNESS` - Willingness to try new foods

#### Phase 3 - Health Information
- `MCONDITIONS` - Medical conditions
- `ALLERGIES` - Medical allergies
- `SMOKINGHABIT` - Smoking status
- `SDURATION` - Sleep duration (0-24 hours)
- `STRESSLEVEL` - Stress level
- `PINJURIES` - Past injuries
- `MEDICATIONS` - Current medications
- `CALCOHOL` - Consumes alcohol (Yes/No)
- `LALCOHOL` - Level of alcohol consumption
- `OTHERISSUE` - Other health issues

#### Phase 4 - Exercise Preference
- `FGOAL` - Fitness goal
- `WFREQUENCY` - Workout frequency per week
- `WPREFERREDT` - Preferred workout time
- `WSETTING` - Workout setting (Gym/Home/Outdoor)
- `WPREFERREDTY` - Preferred workout types
- `WDURATION` - Workout duration (minutes)
- `EACCESS` - Equipment access
- `WNOTIFICATION` - Workout notifications (Yes/No)

#### Phase 5 - Weekly Exercise
- `weeklyActivity` - Object with Monday-Sunday
  - Each day: `activityName`, `duration` (0-300), `calories` (0-2000)

### Why This Change?
- Ensures exact field name match with mobile app requirements
- Eliminates field name transformation issues
- All fields stored exactly as received from API requests

---

## 📞 Support

**Questions about these changes?**
- Email: chep1987@gmail.com
- Full Documentation: See `API_DOCUMENTATION.md`
- Quick Reference: See `API_QUICK_REFERENCE.md`

**Found a bug?**
- Create an issue in the GitHub repository
- Include: endpoint, request body, error message, expected behavior

---

## 📅 Release Timeline

- **November 26, 2025:** All changes deployed to production
- **Current Status:** ✅ All features live and tested
- **Next Review:** December 26, 2025

**Version:** 1.1.0
