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

Register a new user with email and password.

```javascript
async function registerUser() {
  const response = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'SecurePassword123!',
      firstName: 'John',
      lastName: 'Doe'
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
    registrationProgress: data.registrationProgress, // Phase 1/5
    nextStep: data.nextStep // Complete Phase 2
  });

  return data.userId;
}
```

**Response:**
```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "registrationProgress": "1/5",
  "nextStep": "Complete dietary information (Phase 2)",
  "timestamp": "2026-01-13T10:30:00Z"
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

```javascript
async function submitDietInfo(idToken) {
  const response = await fetch(`${API_BASE}/users/diet-information`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      dietType: 'balanced',           // Options: vegan, vegetarian, keto, paleo, low-carb, balanced, high-protein
      cuisinePreferences: [           // At least 1 required
        'italian',
        'asian',
        'mediterranean'
      ],
      allergies: ['peanuts', 'shellfish'],
      restrictions: ['no-added-sugar'],
      excludedIngredients: ['coconut oil']
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 2 failed:', data.error);
    return false;
  }

  console.log('Diet information saved:', data.registrationProgress); // 2/5
  return true;
}
```

**Response:**
```json
{
  "userId": "user-uuid",
  "registrationProgress": "2/5",
  "nextStep": "Complete health information (Phase 3)",
  "dietInformation": {
    "dietType": "balanced",
    "cuisinePreferences": ["italian", "asian", "mediterranean"],
    "allergies": ["peanuts", "shellfish"],
    "restrictions": ["no-added-sugar"],
    "excludedIngredients": ["coconut oil"]
  },
  "timestamp": "2026-01-13T10:31:00Z"
}
```

## Step 4: Submit Health Information (Phase 3)

Provide health metrics and personal information for nutrition planning.

```javascript
async function submitHealthInfo(idToken) {
  const response = await fetch(`${API_BASE}/users/health-information`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      age: 35,                                    // Required: 18-120
      gender: 'male',                             // Required: male, female, other
      height: 180,                                // Required: centimeters (e.g., 150-220)
      weight: 75,                                 // Required: kilograms (e.g., 40-200)
      fitnessLevel: 'intermediate',               // Required: sedentary, lightly-active, moderate, very-active
      goals: ['weight-management', 'energy'],     // Required: At least 1. Options include: weight-gain, weight-loss, weight-management, muscle-gain, endurance, energy
      healthConditions: [],                       // Optional: diabetes, hypertension, celiac, etc.
      medications: []                             // Optional: Any relevant medications
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 3 failed:', data.error);
    return false;
  }

  console.log('Health information saved:', data.registrationProgress); // 3/5
  return true;
}
```

**Response:**
```json
{
  "userId": "user-uuid",
  "registrationProgress": "3/5",
  "nextStep": "Complete exercise preference (Phase 4)",
  "healthInformation": {
    "age": 35,
    "gender": "male",
    "height": 180,
    "weight": 75,
    "fitnessLevel": "intermediate",
    "goals": ["weight-management", "energy"],
    "healthConditions": [],
    "medications": []
  },
  "timestamp": "2026-01-13T10:32:00Z"
}
```

## Step 5: Submit Exercise Preference (Phase 4)

Specify preferred types of exercise.

```javascript
async function submitExercisePreference(idToken) {
  const response = await fetch(`${API_BASE}/users/exercise-preference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      preferredExercises: [           // At least 1 required
        'running',
        'weightlifting',
        'cycling'
      ],
      exerciseFrequency: 4,           // Required: times per week (1-7)
      sessionDuration: 60             // Required: minutes (15-180)
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 4 failed:', data.error);
    return false;
  }

  console.log('Exercise preference saved:', data.registrationProgress); // 4/5
  return true;
}
```

**Response:**
```json
{
  "userId": "user-uuid",
  "registrationProgress": "4/5",
  "nextStep": "Complete weekly exercise schedule (Phase 5)",
  "exercisePreference": {
    "preferredExercises": ["running", "weightlifting", "cycling"],
    "exerciseFrequency": 4,
    "sessionDuration": 60
  },
  "timestamp": "2026-01-13T10:33:00Z"
}
```

## Step 6: Submit Weekly Exercise Schedule (Phase 5)

Define the weekly exercise schedule to finalize registration.

```javascript
async function submitWeeklySchedule(idToken) {
  const response = await fetch(`${API_BASE}/users/weekly-exercise-schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      schedule: {
        monday: { exercise: 'running', duration: 60 },
        tuesday: { exercise: 'weightlifting', duration: 60 },
        wednesday: { exercise: 'rest', duration: 0 },
        thursday: { exercise: 'cycling', duration: 45 },
        friday: { exercise: 'weightlifting', duration: 60 },
        saturday: { exercise: 'running', duration: 60 },
        sunday: { exercise: 'rest', duration: 0 }
      }
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Phase 5 failed:', data.error);
    return false;
  }

  console.log('Registration complete:', data.registrationProgress); // 5/5
  return true;
}
```

**Response:**
```json
{
  "userId": "user-uuid",
  "registrationProgress": "5/5",
  "message": "User registration complete! Nutrition plan ready.",
  "schedule": {
    "monday": { "exercise": "running", "duration": 60 },
    "tuesday": { "exercise": "weightlifting", "duration": 60 },
    "wednesday": { "exercise": "rest", "duration": 0 },
    "thursday": { "exercise": "cycling", "duration": 45 },
    "friday": { "exercise": "weightlifting", "duration": 60 },
    "saturday": { "exercise": "running", "duration": 60 },
    "sunday": { "exercise": "rest", "duration": 0 }
  },
  "timestamp": "2026-01-13T10:34:00Z"
}
```

## Step 7: Generate Nutrition Plan

Once registration is complete, generate a personalized nutrition plan.

```javascript
async function generateNutritionPlan(idToken) {
  const response = await fetch(`${API_BASE}/nutrition/generate-plan`, {
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
    dailyCalories: data.dailyCalories,
    macros: data.macros,
    mealCount: data.meals.length
  });

  return data;
}
```

**Response:**
```json
{
  "userId": "user-uuid",
  "planId": "plan-uuid",
  "createdAt": "2026-01-13T10:35:00Z",
  "dailyCalories": 2200,
  "macros": {
    "protein": { "grams": 165, "percentage": 30 },
    "carbs": { "grams": 275, "percentage": 50 },
    "fat": { "grams": 73, "percentage": 30 }
  },
  "meals": [
    {
      "name": "Breakfast",
      "time": "08:00",
      "calories": 550,
      "recipes": [
        {
          "recipeId": "recipe-123",
          "name": "Mediterranean Omelette",
          "servings": 1,
          "calories": 400,
          "prepTime": 15
        }
      ]
    }
  ]
}
```

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
const recipes = await searchRecipes(idToken, 'mediterranean chicken');
```

**Response:**
```json
{
  "recipes": [
    {
      "recipeId": "recipe-456",
      "name": "Mediterranean Chicken with Vegetables",
      "source": "spoonacular",
      "servings": 2,
      "prepTime": 30,
      "cookTime": 25,
      "totalTime": 55,
      "calories": 450,
      "diets": ["mediterranean", "gluten-free"],
      "cuisines": ["mediterranean"],
      "ingredients": [
        { "name": "chicken breast", "amount": 2, "unit": "lbs" },
        { "name": "olive oil", "amount": 3, "unit": "tbsp" }
      ]
    }
  ]
}
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
        email: 'user@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      })
    });
    let data = await registerResp.json();
    if (!registerResp.ok) throw new Error(data.error);
    console.log('✓ Registration complete\n');

    // Step 2: Sign in
    console.log('Step 2: Signing in with Firebase...');
    const userCredential = await signInWithEmailAndPassword(
      auth,
      'user@example.com',
      'SecurePassword123!'
    );
    const idToken = await userCredential.user.getIdToken();
    console.log('✓ Sign in successful\n');

    // Step 3: Diet Info
    console.log('Step 3: Submitting diet information...');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };
    
    let response = await fetch(`${API_BASE}/users/diet-information`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dietType: 'balanced',
        cuisinePreferences: ['italian', 'asian'],
        allergies: ['peanuts'],
        restrictions: []
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Diet information saved\n');

    // Step 4: Health Info
    console.log('Step 4: Submitting health information...');
    response = await fetch(`${API_BASE}/users/health-information`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        age: 35,
        gender: 'male',
        height: 180,
        weight: 75,
        fitnessLevel: 'intermediate',
        goals: ['weight-management']
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Health information saved\n');

    // Step 5: Exercise Preference
    console.log('Step 5: Submitting exercise preference...');
    response = await fetch(`${API_BASE}/users/exercise-preference`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        preferredExercises: ['running', 'weightlifting'],
        exerciseFrequency: 4,
        sessionDuration: 60
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Exercise preference saved\n');

    // Step 6: Weekly Schedule
    console.log('Step 6: Submitting weekly exercise schedule...');
    response = await fetch(`${API_BASE}/users/weekly-exercise-schedule`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schedule: {
          monday: { exercise: 'running', duration: 60 },
          tuesday: { exercise: 'weightlifting', duration: 60 },
          wednesday: { exercise: 'rest', duration: 0 },
          thursday: { exercise: 'cycling', duration: 45 },
          friday: { exercise: 'weightlifting', duration: 60 },
          saturday: { exercise: 'running', duration: 60 },
          sunday: { exercise: 'rest', duration: 0 }
        }
      })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Weekly schedule saved\n');

    // Step 7: Generate Nutrition Plan
    console.log('Step 7: Generating nutrition plan...');
    response = await fetch(`${API_BASE}/nutrition/generate-plan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log('✓ Nutrition plan generated');
    console.log(`  - Daily calories: ${data.dailyCalories}`);
    console.log(`  - Protein: ${data.macros.protein.grams}g`);
    console.log(`  - Carbs: ${data.macros.carbs.grams}g`);
    console.log(`  - Fat: ${data.macros.fat.grams}g\n`);

    // Step 8: Search for recipes
    console.log('Step 8: Searching for recipes...');
    response = await fetch(`${API_BASE}/recipes/search?q=mediterranean&limit=5`, {
      method: 'GET',
      headers
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error);
    console.log(`✓ Found ${data.recipes.length} recipes\n`);

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

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "description of what went wrong",
  "code": "ERROR_CODE",
  "details": "Additional context if available",
  "timestamp": "2026-01-13T10:36:00Z"
}
```

Common status codes:
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing or invalid ID token
- `403`: Forbidden - User not authorized for this action
- `409`: Conflict - User already exists or data conflict
- `500`: Internal Server Error - Server-side issue

## Testing the Complete Workflow

You can test the complete workflow using the PowerShell script:

```powershell
.\test-full-workflow.ps1
```

Or use the HTML test interface:
```bash
open test-api-browser.html
```
