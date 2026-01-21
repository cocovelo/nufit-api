# Mobile App Integration Guide - Complete Field Reference

## Overview

This guide maps every field in the Nufit API to help your mobile app properly collect, send, and display data. Fields are organized by registration phase, with clear distinctions between data the app collects vs backend-managed fields.

---

## Field Name Convention

**CRITICAL:** All field names use **lowercase camelCase**, NOT uppercase.

✅ Correct: `"weeklyActivity"`, `"medicalConditions"`, `"fitnessGoal"`  
❌ Incorrect: `"WEEKLY_EXERCISE"`, `"MEDICAL_CONDITIONS"`, `"FITNESS_GOAL"`

---

## Registration Phases - Complete Field Map

### Phase 1: Basic Information (Public Endpoint - No Auth Required)

**Endpoint:** `POST /v1/users/register`

**Fields the App COLLECTS (required):**
```json
{
  "name": "John Doe",           // User's full name (required)
  "email": "user@example.com",  // User's email (required)
  "password": "SecurePass123",  // User's password (required, min 6 chars)
  "mobile": "1234567890",       // User's phone number (optional)
  "address": "123 Main St"      // User's address (optional)
}
```

**Fields API RETURNS in response:**
```json
{
  "success": true,
  "message": "User registered successfully (Phase 1/5)",
  "userId": "abc123xyz...",     // Save this for later requests
  "email": "user@example.com",
  "nextStep": "Complete diet information at PUT /v1/users/{userId}/diet-information",
  "registrationProgress": {
    "basicInfo": true,          // Just completed
    "dietInfo": false,          // Next: Phase 2
    "healthInfo": false,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  }
}
```

---

### Phase 2: Diet Information (Requires Auth)

**Endpoint:** `PUT /v1/users/{userId}/diet-information`

**Fields the App COLLECTS:**
```json
{
  "preference": "vegetarian",           // Dietary preference
  "allergies": ["peanuts", "shellfish"], // Array of allergens
  "waterIntake": 2.5,                   // Daily water intake in liters
  "foodPreference": "healthy",          // Food preference type
  "useSupplements": true,               // Boolean: uses supplements?
  "supplementIntake": "protein powder", // What supplements used
  "goal": "lose weight",                // Nutritional goal
  "mealsPerDay": 3,                     // Number of meals per day
  "preferredEatingTimes": "08:00, 12:00, 18:00", // Meal times
  "snackHabits": "occasional",          // Snacking frequency
  "foodDislikes": ["spicy foods"],      // Foods disliked
  "willingness": "very willing"         // Willingness to change diet
}
```

**Validation Rules:**
- `preference`: string (vegetarian, vegan, omnivore, pescatarian, etc.)
- `allergies`: array of strings
- `waterIntake`: number (0-10 liters)
- `mealsPerDay`: integer (1-6)

---

### Phase 3: Health Information (Requires Auth)

**Endpoint:** `PUT /v1/users/{userId}/health-information`

**Fields the App COLLECTS:**
```json
{
  "age": 28,                                      // Required for nutrition plan: integer 18-120
  "gender": "male",                               // Required for nutrition plan: 'male' or 'female'
  "height": 180,                                  // Required for nutrition plan: integer 100-250 (cm)
  "weight": 75,                                   // Required for nutrition plan: integer 30-300 (kg)
  "medicalConditions": "diabetes, hypertension",  // Existing conditions
  "allergies": ["penicillin"],                    // Medical allergies
  "smokingHabit": "non-smoker",                   // Smoking status
  "sleepDuration": 8,                             // Hours of sleep per night
  "stressLevel": "moderate",                      // Stress level
  "pastInjuries": "knee injury in 2020",          // Previous injuries
  "medications": "metformin",                     // Current medications
  "currentAlcohol": "occasional",                 // Alcohol consumption
  "lastAlcohol": "2025-12-25",                    // Last drink date (ISO)
  "otherIssues": "heartburn after meals"          // Other health notes
}
```

**Validation Rules:**
- `age`: integer (18-120) **REQUIRED for nutrition plan generation**
- `gender`: string (male, female) **REQUIRED for nutrition plan generation**
- `height`: integer (100-250 cm) **REQUIRED for nutrition plan generation**
- `weight`: integer (30-300 kg) **REQUIRED for nutrition plan generation**
- `sleepDuration`: number (0-24 hours)
- `stressLevel`: string (low, moderate, high)
- `smokingHabit`: string (non-smoker, occasional, regular)
- `currentAlcohol`: string (none, occasional, moderate, frequent)
- `lastAlcohol`: ISO date string (YYYY-MM-DD)

**Important:** If any of age, gender, height, or weight are missing when generating a nutrition plan, the API will return a 400 error with details on which fields are missing.

---

### Phase 4: Exercise Preferences (Requires Auth)

**Endpoint:** `PUT /v1/users/{userId}/exercise-preference`

**Fields the App COLLECTS:**
```json
{
  "fitnessGoal": "lose weight",           // Primary fitness goal
  "workoutFrequency": 4,                  // Times per week (1-7)
  "workoutPreferredTime": "morning",      // Preferred workout time
  "workoutSetting": "gym",                // Where they prefer to work out
  "workoutPreferredType": "cardio",       // Type of exercise preference
  "workoutDuration": 60,                  // Minutes per session
  "equipmentAccess": "home gym",          // Available equipment
  "workoutNotification": true             // Send workout reminders?
}
```

**Validation Rules:**
- `workoutFrequency`: integer (1-7)
- `workoutDuration`: integer (15-180 minutes)
- `workoutPreferredTime`: string (morning, afternoon, evening)
- `workoutSetting`: string (gym, home, park, pool)
- `fitnessGoal`: string (lose weight, build muscle, improve fitness, maintain)

---

### Phase 5: Weekly Exercise Schedule (Requires Auth)

**Endpoint:** `PUT /v1/users/{userId}/weekly-exercise`

**Fields the App COLLECTS:**

**IMPORTANT:** Field name is `"weeklyActivity"` (not `"WEEKLY_EXERCISE"`)

```json
{
  "weeklyActivity": {
    "Monday": {
      "activityName": "Running",
      "duration": 45,      // Minutes
      "calories": 400      // Estimated calories burned
    },
    "Tuesday": {
      "activityName": "Rest",
      "duration": 0,
      "calories": 0
    },
    "Wednesday": {
      "activityName": "Gym",
      "duration": 60,
      "calories": 350
    },
    "Thursday": {
      "activityName": "Rest",
      "duration": 0,
      "calories": 0
    },
    "Friday": {
      "activityName": "Swimming",
      "duration": 30,
      "calories": 300
    },
    "Saturday": {
      "activityName": "Cycling",
      "duration": 90,
      "calories": 500
    },
    "Sunday": {
      "activityName": "Yoga",
      "duration": 45,
      "calories": 150
    }
  }
}
```

**Validation Rules:**
- Each day is optional (missing days default to "Rest")
- `duration`: 0-300 minutes
- `calories`: 0-2000 per day
- Missing fields default to: `{ activityName: "Rest", duration: 0, calories: 0 }`

**What API Returns:**
```json
{
  "success": true,
  "message": "Weekly exercise schedule updated successfully. Registration complete!",
  "registrationComplete": true,    // User can now generate nutrition plans
  "totalWeeklyCalories": 2100,
  "nextStep": "You can now generate your personalized nutrition plan"
}
```

---

## User Profile Response - All Fields

### When You GET User Profile: `GET /v1/users/{userId}/profile`

The response includes ALL fields below. Your app should:
- ✅ **Display** fields from phases 1-5 (user-collected data)
- ✅ **Read** backend-managed fields but DON'T modify them
- ❌ **Never send** backend-only fields in PUT requests

```json
{
  "success": true,
  "profile": {
    // === PHASE 1: Basic Info (Editable) ===
    "name": "John Doe",
    "email": "user@example.com",
    "mobile": "1234567890",
    "address": "123 Main St",
    
    // === PHASE 2: Diet Info (Editable) ===
    "preference": "vegetarian",
    "allergies": ["peanuts"],
    "waterIntake": 2.5,
    "foodPreference": "healthy",
    "useSupplements": true,
    "supplementIntake": "protein powder",
    "goal": "lose weight",
    "mealsPerDay": 3,
    "preferredEatingTimes": "08:00, 12:00, 18:00",
    "snackHabits": "occasional",
    "foodDislikes": ["spicy"],
    "willingness": "very willing",
    
    // === PHASE 3: Health Info (Editable) ===
    "medicalConditions": "diabetes",
    "smokingHabit": "non-smoker",
    "sleepDuration": 8,
    "stressLevel": "moderate",
    "pastInjuries": "knee injury",
    "medications": "metformin",
    "currentAlcohol": "occasional",
    "lastAlcohol": "2025-12-25",
    "otherIssues": "heartburn",
    
    // === PHASE 4: Exercise Preferences (Editable) ===
    "fitnessGoal": "lose weight",
    "workoutFrequency": 4,
    "workoutPreferredTime": "morning",
    "workoutSetting": "gym",
    "workoutPreferredType": "cardio",
    "workoutDuration": 60,
    "equipmentAccess": "home gym",
    "workoutNotification": true,
    
    // === PHASE 5: Weekly Activity (Editable) ===
    "weeklyActivity": {
      "Monday": { "activityName": "Running", "duration": 45, "calories": 400 },
      "Tuesday": { "activityName": "Rest", "duration": 0, "calories": 0 },
      // ... other days
    },
    "totalWeeklyActivityCalories": 2100,
    
    // === REGISTRATION STATUS (Read-Only) ===
    "registrationComplete": true,
    "registrationSteps": {
      "basicInfo": true,
      "dietInfo": true,
      "healthInfo": true,
      "exercisePreference": true,
      "weeklyExercise": true
    },
    
    // === SUBSCRIPTION FIELDS (Read-Only / Backend-Managed) ===
    "subscribed": false,
    "subscriptionStatus": "inactive",
    "subscriptionTier": null,
    "subscriptionPackageId": null,
    "hasUsedFreeTrial": false,
    "freeTrialStartDate": null,
    "freeTrialEndDate": null,
    "isInFreeTrial": false,
    "subscriptionStartDate": null,
    "subscriptionEndDate": null,
    "subscriptionCancelledDate": null,
    "hasUsedDiscountCode": false,
    "discountCode": null,
    "discountCodeUsedDate": null,
    "discountPercentage": null,
    
    // === SYSTEM FIELDS (Read-Only) ===
    "createdAt": "2026-01-11T12:00:00Z",
    "updatedAt": "2026-01-11T12:30:00Z"
  }
}
```

---

## Quick Reference: What App Should Send

### For Phase Updates:

| Phase | Endpoint | Field | Type | Required |
|-------|----------|-------|------|----------|
| 1 | POST /register | name | string | ✅ |
| 1 | POST /register | email | string | ✅ |
| 1 | POST /register | password | string | ✅ |
| 1 | POST /register | mobile | string | ❌ |
| 1 | POST /register | address | string | ❌ |
| 2 | PUT diet-information | preference | string | ✅ |
| 2 | PUT diet-information | waterIntake | number | ✅ |
| 2 | PUT diet-information | goal | string | ✅ |
| 3 | PUT health-information | medicalConditions | string | ✅ |
| 3 | PUT health-information | sleepDuration | number | ✅ |
| 4 | PUT exercise-preference | fitnessGoal | string | ✅ |
| 4 | PUT exercise-preference | workoutFrequency | number | ✅ |
| 5 | PUT weekly-exercise | weeklyActivity | object | ✅ |

---

## Common Integration Patterns

### 1. Check Registration Progress
```javascript
GET /v1/users/{userId}/profile
// Check profile.registrationSteps to see which phases are complete
```

### 2. Save Phase Data
```javascript
PUT /v1/users/{userId}/[endpoint]
// Send ONLY the fields for that phase
// Don't send fields from other phases or backend fields
```

### 3. Generate Nutrition Plan
```javascript
// First check:
GET /v1/users/{userId}/profile
// If profile.registrationComplete === true, then:
POST /v1/users/{userId}/generate-nutrition-plan
```

### 4. Get Subscription Status
```javascript
GET /v1/users/{userId}/subscription
// Check flags.hasValidAccess to see if user has subscription or active trial
```

---

## Error Responses & Solutions

### Field Name Error
```json
{
  "error": "Invalid weeklyActivity",
  "message": "weeklyActivity must be an object with day-activity mappings",
  "hint": "Ensure you are using \"weeklyActivity\" (not \"WEEKLY_EXERCISE\") as the field name"
}
```
✅ **Solution:** Use lowercase camelCase field names

### Validation Error
```json
{
  "error": "Invalid duration for Monday",
  "message": "Duration must be between 0 and 300 minutes"
}
```
✅ **Solution:** Check field value ranges per validation rules above

### Registration Incomplete
```json
{
  "error": "Registration incomplete",
  "message": "Please complete all registration steps before generating a nutrition plan",
  "missingSteps": ["Weekly Exercise Schedule (activity schedule for each day)"],
  "registrationSteps": { ... }
}
```
✅ **Solution:** Complete all phases (1-5) before generating plans

---

## Summary: What Changed

**Fixed:** Weekly exercise endpoint now accepts both `weeklyActivity` and `WEEKLY_EXERCISE` for backward compatibility, but **lowercase is the standard**.

**Added:** This comprehensive guide mapping every field to its registration phase.

**Result:** Your app now has a clear reference for which fields to collect, send, and display at each step.

---

## Next Steps

1. ✅ Update all API calls to use **lowercase camelCase** field names
2. ✅ Collect fields in order by phase (1-5)
3. ✅ Don't modify subscription or backend-only fields
4. ✅ After Phase 5 complete, generate nutrition plans
5. ✅ Reference this guide for any field questions

Questions? Each field description includes validation rules and type requirements.
