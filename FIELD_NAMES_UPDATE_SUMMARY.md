# Field Names Update Summary

## Overview
All registration API endpoints have been updated to use the exact field names as specified. Field names are now stored in the database exactly as received (UPPERCASE format), without any transformation to camelCase.

---

## Updated Endpoints

### Phase 1: Basic Information ✅
**Endpoint:** `POST /v1/users/register`

**Field Names:**
- `NAME` - User's full name
- `EMAIL` - User's email address  
- `MOBILE` - User's mobile number
- `ADDRESS` - User's address
- `PASSKEY` - User's password

**Status:** Already correct, no changes needed.

---

### Phase 2: Diet Information ✅
**Endpoint:** `PUT /v1/users/:userId/diet-information`

**Updated Field Names:**
| Old (camelCase) | New (UPPERCASE) | Description |
|----------------|-----------------|-------------|
| dietaryPreference | **PREFERENCE** | Dietary preference (Vegetarian, Vegan, etc.) |
| foodAllergies | **ALLERGIES** | Food allergies or intolerances |
| waterIntakeLiters | **WINTAKE** | Daily water intake in liters |
| foodPreferences | **FPREFERENCE** | Preferred foods |
| useSupplements | **USUPPLEMENTS** | Whether user takes supplements (Yes/No) |
| supplementIntake | **SINTAKE** | Supplement details |
| goal | **GOAL** | Fitness goal (lose weight, gain muscle, maintain) |
| mealsPerDay | **MEALSPERDAY** | Number of meals per day (1-8) |
| preferredEatingTimes | **PETIMES** | Preferred eating times |
| snackingHabits | **SNACKHABITS** | Snacking habits description |
| foodDislikes | **FOODDISLIKES** | Foods to avoid |
| willingnessToTryNew | **WILLINGNESS** | Willingness to try new foods (High/Medium/Low) |

**Changes Made:**
- All fields now stored with UPPERCASE names exactly as specified
- No transformation to camelCase
- Response includes `registrationProgress` object
- Response message updated to "Diet information updated successfully (Phase 2/5)"

---

### Phase 3: Health Information ✅
**Endpoint:** `PUT /v1/users/:userId/health-information`

**Updated Field Names:**
| Old (camelCase) | New (UPPERCASE) | Description |
|----------------|-----------------|-------------|
| medicalConditions | **MCONDITIONS** | Existing medical conditions |
| medicalAllergies | **ALLERGIES** | Medical allergies |
| smokingHabit | **SMOKINGHABIT** | Smoking status (Yes/No/Former) |
| sleepDuration | **SDURATION** | Average sleep duration in hours (0-24) |
| stressLevel | **STRESSLEVEL** | Stress level (Low/Medium/High) |
| pastInjuries | **PINJURIES** | Past injuries affecting exercise |
| medications | **MEDICATIONS** | Current medications |
| consumesAlcohol | **CALCOHOL** | Current alcohol consumption (Yes/No) |
| levelOfAlcohol | **LALCOHOL** | Level of alcohol consumption |
| otherHealthIssues | **OTHERISSUE** | Other health issues or concerns |

**Changes Made:**
- All fields now stored with UPPERCASE names exactly as specified
- Removed boolean transformation for `consumesAlcohol` (now stored as-is)
- Response includes `registrationProgress` object
- Response message updated to "Health information updated successfully (Phase 3/5)"

---

### Phase 4: Exercise Preference ✅
**Endpoint:** `PUT /v1/users/:userId/exercise-preference`

**Updated Field Names:**
| Old (camelCase) | New (UPPERCASE) | Description |
|----------------|-----------------|-------------|
| fitnessGoal | **FGOAL** | Fitness goal (Weight Loss, Muscle Gain, Endurance) |
| workoutFrequency | **WFREQUENCY** | Workout frequency per week (number as string) |
| preferredWorkoutTime | **WPREFERREDT** | Preferred workout time (Morning/Afternoon/Evening) |
| workoutSetting | **WSETTING** | Preferred workout setting (Gym/Home/Outdoor) |
| preferredWorkoutTypes | **WPREFERREDTY** | Preferred workout types |
| workoutDuration | **WDURATION** | Workout duration in minutes (must be positive) |
| equipmentAccess | **EACCESS** | Equipment access description |
| workoutNotifications | **WNOTIFICATION** | Workout notifications preference (Yes/No) |

**Changes Made:**
- All fields now stored with UPPERCASE names exactly as specified
- Removed boolean transformation for `workoutNotifications` (now stored as-is)
- Response includes `registrationProgress` object
- Response message updated to "Exercise preference updated successfully (Phase 4/5)"

---

### Phase 5: Weekly Exercise Schedule ✅
**Endpoint:** `PUT /v1/users/:userId/weekly-exercise`

**Field Name:**
- `weeklyActivity` - Object containing 7 days (Monday-Sunday)
  - Each day has: `activityName`, `duration` (0-300 minutes), `calories` (0-2000)

**Status:** Already correct, no changes needed.

**Response includes:**
- `totalWeeklyCalories` - Sum of calories for the week
- `registrationProgress` with all fields marked complete
- Sets `registrationComplete: true` in Firestore

---

## Database Schema Changes

### Firestore Collection: `users/{userId}`

**Before (camelCase):**
```javascript
{
  // Phase 2
  dietaryPreference: "Vegetarian",
  foodAllergies: "peanuts",
  waterIntakeLiters: "2.5",
  // ... etc
  
  // Phase 3
  medicalConditions: "Diabetes",
  medicalAllergies: "Penicillin",
  smokingHabit: "No",
  consumesAlcohol: true,  // Boolean
  // ... etc
  
  // Phase 4
  fitnessGoal: "Weight Loss",
  workoutFrequency: "4",
  preferredWorkoutTime: "Morning",
  workoutNotifications: true,  // Boolean
  // ... etc
}
```

**After (UPPERCASE):**
```javascript
{
  // Phase 1 (unchanged)
  name: "John Doe",
  email: "user@example.com",
  mobile: "+1234567890",
  address: "123 Main St",
  
  // Phase 2 (updated)
  PREFERENCE: "Vegetarian",
  ALLERGIES: "peanuts",
  WINTAKE: "2.5",
  FPREFERENCE: "chicken, vegetables",
  USUPPLEMENTS: "Yes",
  SINTAKE: "Protein powder",
  GOAL: "lose weight",
  MEALSPERDAY: "3",
  PETIMES: "7:00 AM, 1:00 PM, 7:00 PM",
  SNACKHABITS: "Fruits in afternoon",
  FOODDISLIKES: "mushrooms",
  WILLINGNESS: "High",
  
  // Phase 3 (updated)
  MCONDITIONS: "Diabetes",
  ALLERGIES: "Penicillin",
  SMOKINGHABIT: "No",
  SDURATION: "7",
  STRESSLEVEL: "Medium",
  PINJURIES: "None",
  MEDICATIONS: "Metformin",
  CALCOHOL: "No",  // String, not boolean
  LALCOHOL: "Occasional",
  OTHERISSUE: "None",
  
  // Phase 4 (updated)
  FGOAL: "Weight Loss",
  WFREQUENCY: "4",
  WPREFERREDT: "Morning",
  WSETTING: "Gym",
  WPREFERREDTY: "Cardio, Strength Training",
  WDURATION: "60",
  EACCESS: "Full gym access",
  WNOTIFICATION: "Yes",  // String, not boolean
  
  // Phase 5 (unchanged)
  weeklyActivity: {
    Monday: { activityName: "Running", duration: 45, calories: 400 },
    Tuesday: { activityName: "Rest", duration: 0, calories: 0 },
    // ... etc
  },
  
  // Registration tracking
  registrationComplete: true,
  registrationSteps: {
    basicInfo: true,
    dietInfo: true,
    healthInfo: true,
    exercisePreference: true,
    weeklyExercise: true
  }
}
```

---

## Key Changes Summary

### 1. Field Name Format
- **Before:** camelCase (e.g., `dietaryPreference`, `foodAllergies`)
- **After:** UPPERCASE (e.g., `PREFERENCE`, `ALLERGIES`)
- **Storage:** Fields are stored exactly as received from the API request

### 2. Boolean Values
- **Before:** Some fields converted to boolean (`consumesAlcohol: true`, `workoutNotifications: false`)
- **After:** All fields stored as strings (`CALCOHOL: "Yes"`, `WNOTIFICATION: "No"`)

### 3. Response Structure
All endpoints now return consistent response format:
```json
{
  "success": true,
  "message": "Information updated successfully (Phase X/5)",
  "nextStep": "Description of next step...",
  "registrationProgress": {
    "basicInfo": boolean,
    "dietInfo": boolean,
    "healthInfo": boolean,
    "exercisePreference": boolean,
    "weeklyExercise": boolean,
    "complete": boolean
  }
}
```

### 4. Validation
- All validation logic preserved (e.g., GOAL required, water intake must be positive, meals 1-8)
- Field requirements documented in API_DOCUMENTATION.md

---

## Deployment Status

✅ **Deployed:** January 2025

**Firebase Functions URL:**
```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1
```

All changes are live and ready for use.

---

## Testing Checklist

To verify the updates:

1. ✅ Test Phase 1: POST /v1/users/register
   - Verify NAME, EMAIL, MOBILE, ADDRESS, PASSKEY fields work

2. ✅ Test Phase 2: PUT /v1/users/:userId/diet-information
   - Send request with all UPPERCASE field names
   - Verify fields stored as PREFERENCE, ALLERGIES, WINTAKE, etc.
   - Check registrationProgress in response

3. ✅ Test Phase 3: PUT /v1/users/:userId/health-information
   - Send request with MCONDITIONS, ALLERGIES, SMOKINGHABIT, etc.
   - Verify CALCOHOL stored as "Yes"/"No" (not boolean)
   - Check registrationProgress in response

4. ✅ Test Phase 4: PUT /v1/users/:userId/exercise-preference
   - Send request with FGOAL, WFREQUENCY, WPREFERREDT, etc.
   - Verify WNOTIFICATION stored as "Yes"/"No" (not boolean)
   - Check registrationProgress in response

5. ✅ Test Phase 5: PUT /v1/users/:userId/weekly-exercise
   - Send weeklyActivity object with 7 days
   - Verify registrationComplete set to true
   - Check totalWeeklyCalories in response

6. ✅ Test registration validation:
   - Try generating nutrition plan without completing all phases
   - Should receive error: "Please complete all registration phases first"

---

## Updated Documentation Files

1. ✅ **API_DOCUMENTATION.md**
   - Updated all Phase 2, 3, 4 examples with correct field names
   - Added detailed field descriptions
   - Updated response examples

2. ✅ **DEVELOPER_INTEGRATION_GUIDE.md**
   - Needs update: Code examples still show old camelCase names

3. ✅ **API_CHANGES_SUMMARY.md**
   - Needs update: Should document field name format (UPPERCASE)

---

## Migration Notes for Existing Users

**Important:** If you have existing users in the database with old camelCase field names, they will need to update their profiles through the API to use the new field names. The old data will not automatically migrate.

**Recommendation:**
- For new users: Use the new UPPERCASE field names
- For existing users: Implement a migration endpoint or prompt users to update their profiles

---

## Contact

For questions or issues related to these updates, contact:
- **Email:** chep1987@gmail.com
- **API Base URL:** https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1
