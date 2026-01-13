# Complete API Workflow Example

This document shows a complete end-to-end example of using the Nufit API with all required fields and proper authentication flow.

## Prerequisites

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// API Base URL
const API_BASE = 'https://your-deployment/api/v1';
```

## Step 1: Register User (Phase 1)

Register a new user with basic information.

**Endpoint:** `POST /v1/users/register`

```javascript
async function registerUser() {
  const response = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'John Doe',              // Required: user's full name
      email: 'user@example.com',     // Required: user's email
      password: 'SecurePass123',     // Required: min 6 characters
      mobile: '1234567890',          // Optional: user's phone number
      address: '123 Main St'         // Optional: user's address
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Registration failed:', data.error);
    return null;
  }

  console.log('Registration successful:', {
    userId: data.userId,
    email: data.email,
    registrationProgress: data.registrationProgress,
    nextStep: data.nextStep
  });

  return data.userId;
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully (Phase 1/5)",
  "userId": "abc123xyz",
  "email": "user@example.com",
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

## Step 2: Authenticate and Get ID Token

After registration, sign in with Firebase to get an ID token for authenticated requests.

```javascript
async function signInUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    
    console.log('Sign in successful');
    console.log('ID Token:', idToken);
    
    return idToken;
  } catch (error) {
    console.error('Sign in failed:', error.message);
    return null;
  }
}

// Usage in workflow
const userId = await registerUser();
const idToken = await signInUser('user@example.com', 'SecurePassword123!');
```

## Step 3: Submit Diet Information (Phase 2)

Provide dietary preferences and restrictions.

**Endpoint:** `PUT /v1/users/{userId}/diet-information`

```javascript
async function submitDietInfo(userId, idToken) {
  const response = await fetch(`${API_BASE}/users/${userId}/diet-information`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      preference: 'vegetarian',                    // Required: dietary preference
      allergies: ['peanuts', 'shellfish'],         // Required: array of allergens
      waterIntake: 2.5,                            // Required: daily liters (0-10)
      foodPreference: 'healthy',                   // Required: food preference type
      useSupplements: true,                        // Required: boolean
      supplementIntake: 'protein powder',          // Optional: what supplements
      goal: 'lose weight',                         // Required: nutritional goal
      mealsPerDay: 3,                              // Required: integer (1-6)
      preferredEatingTimes: '08:00, 12:00, 18:00', // Optional: meal times
      snackHabits: 'occasional',                   // Optional: snacking frequency
      foodDislikes: ['spicy foods'],               // Optional: array of foods disliked
      willingness: 'very willing'                  // Required: willingness to change
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 2 failed:', data.error);
    return false;
  }

  console.log('Diet information saved:', data.registrationProgress);
  return true;
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diet information updated successfully (Phase 2/5)",
  "registrationProgress": {
    "basicInfo": true,
    "dietInfo": true,
    "healthInfo": false,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  }
}
```

## Step 4: Submit Health Information (Phase 3)

Provide health metrics and medical information.

**Endpoint:** `PUT /v1/users/{userId}/health-information`

```javascript
async function submitHealthInfo(userId, idToken) {
  const response = await fetch(`${API_BASE}/users/${userId}/health-information`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      medicalConditions: 'diabetes, hypertension',  // Required: existing conditions
      allergies: ['penicillin'],                    // Optional: medical allergies
      smokingHabit: 'non-smoker',                   // Required: non-smoker, occasional, regular
      sleepDuration: 8,                             // Required: hours per night (0-24)
      stressLevel: 'moderate',                      // Required: low, moderate, high
      pastInjuries: 'knee injury in 2020',          // Optional: previous injuries
      medications: 'metformin',                     // Optional: current medications
      currentAlcohol: 'occasional',                 // Required: none, occasional, moderate, frequent
      lastAlcohol: '2025-12-25',                    // Optional: ISO date (YYYY-MM-DD)
      otherIssues: 'heartburn after meals'          // Optional: other health notes
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 3 failed:', data.error);
    return false;
  }

  console.log('Health information saved:', data.registrationProgress);
  return true;
}
```

**Response:**
```json
{
  "success": true,
  "message": "Health information updated successfully (Phase 3/5)",
  "registrationProgress": {
    "basicInfo": true,
    "dietInfo": true,
    "healthInfo": true,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  }
}
```

## Step 5: Submit Exercise Preference (Phase 4)

Specify workout preferences and settings.

**Endpoint:** `PUT /v1/users/{userId}/exercise-preference`

```javascript
async function submitExercisePreference(userId, idToken) {
  const response = await fetch(`${API_BASE}/users/${userId}/exercise-preference`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      fitnessGoal: 'lose weight',         // Required: lose weight, build muscle, improve fitness, maintain
      workoutFrequency: 4,                // Required: integer 1-7 (times per week)
      workoutPreferredTime: 'morning',    // Required: morning, afternoon, evening
      workoutSetting: 'gym',              // Required: gym, home, park, pool
      workoutPreferredType: 'cardio',     // Required: type of exercise preference
      workoutDuration: 60,                // Required: integer 15-180 (minutes per session)
      equipmentAccess: 'home gym',        // Required: available equipment
      workoutNotification: true           // Required: send workout reminders?
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 4 failed:', data.error);
    return false;
  }

  console.log('Exercise preference saved:', data.registrationProgress);
  return true;
}
```

**Response:**
```json
{
  "success": true,
  "message": "Exercise preference updated successfully (Phase 4/5)",
  "registrationProgress": {
    "basicInfo": true,
    "dietInfo": true,
    "healthInfo": true,
    "exercisePreference": true,
    "weeklyExercise": false,
    "complete": false
  }
}
```

## Step 6: Submit Weekly Exercise Schedule (Phase 5)

Define the weekly activity schedule to complete registration.

**Endpoint:** `PUT /v1/users/{userId}/weekly-exercise`

**CRITICAL:** Field name is `weeklyActivity` (NOT `schedule` or `weeklyExercise`)

```javascript
async function submitWeeklySchedule(userId, idToken) {
  const response = await fetch(`${API_BASE}/users/${userId}/weekly-exercise`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      weeklyActivity: {
        Monday: {
          activityName: 'Running',
          duration: 45,        // Minutes (0-300)
          calories: 400        // Estimated calories burned (0-2000)
        },
        Tuesday: {
          activityName: 'Gym',
          duration: 60,
          calories: 350
        },
        Wednesday: {
          activityName: 'Rest',
          duration: 0,
          calories: 0
        },
        Thursday: {
          activityName: 'Cycling',
          duration: 45,
          calories: 300
        },
        Friday: {
          activityName: 'Gym',
          duration: 60,
          calories: 350
        },
        Saturday: {
          activityName: 'Swimming',
          duration: 30,
          calories: 300
        },
        Sunday: {
          activityName: 'Yoga',
          duration: 45,
          calories: 150
        }
      }
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 5 failed:', data.error);
    return false;
  }

  console.log('Registration complete:', data);
  return true;
}
```

**Response:**
```json
{
  "success": true,
  "message": "Weekly exercise schedule updated successfully. Registration complete!",
  "registrationComplete": true,
  "totalWeeklyCalories": 2100,
  "registrationProgress": {
    "basicInfo": true,
    "dietInfo": true,
    "healthInfo": true,
    "exercisePreference": true,
    "weeklyExercise": true,
    "complete": true
  },
  "nextStep": "You can now generate your personalized nutrition plan"
}
```

## Step 7: Generate Nutrition Plan

Once registration is complete, generate a personalized nutrition plan.

```javascript
async function generateNutritionPlan(userId, idToken) {
  const response = await fetch(`${API_BASE}/users/${userId}/generate-nutrition-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({})
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Nutrition plan generation failed:', data.error);
    return null;
  }

  console.log('Nutrition plan generated:', {
    planId: data.planId,
    dailyCalories: data.dailyCalories,
    macros: data.macros
  });

  return data;
}
```

**Note:** The nutrition plan generation requires ALL registration phases to be complete first.

## Step 8: Search for Recipes

Find recipes matching specific criteria.

```javascript
async function searchRecipes(idToken, query) {
  const response = await fetch(`${API_BASE}/recipes/search?q=${encodeURIComponent(query)}&limit=10`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Recipe search failed:', data.error);
    return [];
  }

  console.log(`Found ${data.recipes.length} recipes`);
  return data.recipes;
}

// Usage
const recipes = await searchRecipes(idToken, 'vegetarian');
```

## Complete Workflow Example

Here's a complete function that runs through the entire registration flow:

```javascript
async function completeRegistrationWorkflow() {
  try {
    console.log('Starting registration workflow...\n');

    // Step 1: Register
    console.log('Step 1: Registering user...');
    const registerResp = await fetch(`${API_BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'user@example.com',
        password: 'SecurePass123',
        mobile: '1234567890',
        address: '123 Main St'
      })
    });
    let data = await registerResp.json();
    if (!registerResp.ok) throw new Error(data.error);
    const userId = data.userId;
    console.log('✓ Registration complete\n');

    // Step 2: Sign in
    console.log('Step 2: Signing in with Firebase...');
    const userCredential = await signInWithEmailAndPassword(
      auth,
      'user@example.com',
      'SecurePass123'
    );
    const idToken = await userCredential.user.getIdToken();
    console.log('✓ Sign in successful\n');

    // Step 3: Diet Info
    console.log('Step 3: Submitting diet information...');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };
    
    let response = await fetch(`${API_BASE}/users/${userId}/diet-information`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        preference: 'vegetarian',
        allergies: ['peanuts'],
        waterIntake: 2.5,
        foodPreference: 'healthy',
        useSupplements: true,
        supplementIntake: 'protein powder',
        goal: 'lose weight',
        mealsPerDay: 3,
        preferredEatingTimes: '08:00, 12:00, 18:00',
        snackHabits: 'occasional',
        foodDislikes: ['spicy'],
        willingness: 'very willing'
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Diet information saved\n');

    // Step 4: Health Info
    console.log('Step 4: Submitting health information...');
    response = await fetch(`${API_BASE}/users/${userId}/health-information`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        medicalConditions: 'none',
        smokingHabit: 'non-smoker',
        sleepDuration: 8,
        stressLevel: 'moderate',
        pastInjuries: 'none',
        medications: 'none',
        currentAlcohol: 'occasional',
        lastAlcohol: '2025-12-25',
        otherIssues: 'none'
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Health information saved\n');

    // Step 5: Exercise Preference
    console.log('Step 5: Submitting exercise preference...');
    response = await fetch(`${API_BASE}/users/${userId}/exercise-preference`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        fitnessGoal: 'lose weight',
        workoutFrequency: 4,
        workoutPreferredTime: 'morning',
        workoutSetting: 'gym',
        workoutPreferredType: 'cardio',
        workoutDuration: 60,
        equipmentAccess: 'home gym',
        workoutNotification: true
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Exercise preference saved\n');

    // Step 6: Weekly Schedule
    console.log('Step 6: Submitting weekly exercise schedule...');
    response = await fetch(`${API_BASE}/users/${userId}/weekly-exercise`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        weeklyActivity: {
          Monday: { activityName: 'Running', duration: 45, calories: 400 },
          Tuesday: { activityName: 'Gym', duration: 60, calories: 350 },
          Wednesday: { activityName: 'Rest', duration: 0, calories: 0 },
          Thursday: { activityName: 'Cycling', duration: 45, calories: 300 },
          Friday: { activityName: 'Gym', duration: 60, calories: 350 },
          Saturday: { activityName: 'Swimming', duration: 30, calories: 300 },
          Sunday: { activityName: 'Yoga', duration: 45, calories: 150 }
        }
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Weekly schedule saved\n');

    // Step 7: Generate Nutrition Plan
    console.log('Step 7: Generating nutrition plan...');
    response = await fetch(`${API_BASE}/users/${userId}/generate-nutrition-plan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Nutrition plan generated');
    console.log(`  - Daily calories: ${data.dailyCalories}\n`);

    console.log('✅ Workflow complete!');
    return true;

  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
    return false;
  }
}

// Run the workflow
await completeRegistrationWorkflow();
```

## Quick Reference - Required Fields by Phase

### Phase 1: Basic Information
**Endpoint:** `POST /v1/users/register`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✅ | User's full name |
| email | string | ✅ | User's email |
| password | string | ✅ | Min 6 characters |
| mobile | string | ❌ | Phone number |
| address | string | ❌ | Address |

### Phase 2: Diet Information
**Endpoint:** `PUT /v1/users/{userId}/diet-information`

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| preference | string | ✅ | vegetarian, vegan, omnivore, pescatarian |
| allergies | array | ✅ | Min 1 item |
| waterIntake | number | ✅ | 0-10 liters |
| foodPreference | string | ✅ | Type of food preference |
| useSupplements | boolean | ✅ | true/false |
| supplementIntake | string | ❌ | Type of supplements |
| goal | string | ✅ | Nutritional goal |
| mealsPerDay | integer | ✅ | 1-6 meals |
| preferredEatingTimes | string | ❌ | "08:00, 12:00, 18:00" format |
| snackHabits | string | ❌ | occasional, frequent, etc. |
| foodDislikes | array | ❌ | Array of disliked foods |
| willingness | string | ✅ | willingness to change diet |

### Phase 3: Health Information
**Endpoint:** `PUT /v1/users/{userId}/health-information`

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| medicalConditions | string | ✅ | Existing conditions |
| allergies | array | ❌ | Medical allergies |
| smokingHabit | string | ✅ | non-smoker, occasional, regular |
| sleepDuration | number | ✅ | 0-24 hours |
| stressLevel | string | ✅ | low, moderate, high |
| pastInjuries | string | ❌ | Previous injuries |
| medications | string | ❌ | Current medications |
| currentAlcohol | string | ✅ | none, occasional, moderate, frequent |
| lastAlcohol | string | ❌ | ISO date YYYY-MM-DD |
| otherIssues | string | ❌ | Other health notes |

### Phase 4: Exercise Preference
**Endpoint:** `PUT /v1/users/{userId}/exercise-preference`

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| fitnessGoal | string | ✅ | lose weight, build muscle, improve fitness, maintain |
| workoutFrequency | integer | ✅ | 1-7 times per week |
| workoutPreferredTime | string | ✅ | morning, afternoon, evening |
| workoutSetting | string | ✅ | gym, home, park, pool |
| workoutPreferredType | string | ✅ | Type of exercise |
| workoutDuration | integer | ✅ | 15-180 minutes |
| equipmentAccess | string | ✅ | Available equipment |
| workoutNotification | boolean | ✅ | true/false |

### Phase 5: Weekly Exercise Schedule
**Endpoint:** `PUT /v1/users/{userId}/weekly-exercise`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| **weeklyActivity** | object | ✅ | CRITICAL: Use "weeklyActivity" not "schedule" |
| weeklyActivity.{Day} | object | ❌ | Optional - each day can be omitted |
| activityName | string | ✅ | Name of activity |
| duration | integer | ✅ | 0-300 minutes |
| calories | integer | ✅ | 0-2000 estimated |

**Days:** Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday

**Defaults:** Missing days default to `{ activityName: "Rest", duration: 0, calories: 0 }`

## Testing the Complete Workflow

You can test the complete workflow using the PowerShell script:

```powershell
.\test-full-workflow.ps1
```

Or use the HTML test interface:
```bash
open test-api-browser.html
```
