# Developer Integration Guide: Building a Nutrition App with Nufit API

## Complete App Integration Example

This guide shows you **exactly** how to integrate the Nufit API into your app, from user registration through nutrition plan generation.

---

## Table of Contents
1. [Quick Overview](#quick-overview)
2. [Step-by-Step Integration](#step-by-step-integration)
3. [Platform-Specific Examples](#platform-specific-examples)
4. [API Request/Response Details](#api-requestresponse-details)
5. [Error Handling](#error-handling)
6. [Complete Working Example](#complete-working-example)

---

## Quick Overview

### What You Need
- Firebase project credentials (for authentication)
- Nufit API base URL: `https://us-central1-nufit-67bf0.cloudfunctions.net/api`
- Optional: API key (for advanced recipe search only)

### Integration Flow
```
1. User Signs Up → POST /v1/users/register
2. User Signs In → Firebase Auth SDK
3. Get Auth Token → Firebase Auth SDK
4. Save/Update Profile → PUT /v1/users/{userId}/profile
5. Generate Plan → POST /v1/users/{userId}/generate-nutrition-plan
6. Get Plan → GET /v1/users/{userId}/nutrition-plans/{planId}
7. Generate Shopping List → POST /v1/users/{userId}/nutrition-plans/{planId}/generate-shopping-list
```

---

## Step-by-Step Integration

### Step 1: User Registration (5-Phase Progressive System)

**Important:** Registration is now split into 5 phases for better UX. All phases must be completed before users can generate nutrition plans.

---

#### **Phase 1: Basic Information**

**What to Submit:**
```json
{
  "NAME": "John Doe",
  "EMAIL": "user@example.com",
  "MOBILE": "+1234567890",
  "ADDRESS": "123 Main St, City, Country",
  "PASSKEY": "SecurePass123!"
}
```

**API Call:**
```javascript
const registerPhase1 = async (basicInfo) => {
  const response = await fetch(
    'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basicInfo)
    }
  );
  return await response.json();
};

// Usage
const result = await registerPhase1({
  NAME: "John Doe",
  EMAIL: "user@example.com",
  MOBILE: "+1234567890",
  ADDRESS: "123 Main St",
  PASSKEY: "SecurePass123!"
});
console.log('User ID:', result.userId); // Save this!
```

**What You Receive:**
```json
{
  "success": true,
  "message": "User registered successfully (Phase 1/5)",
  "userId": "abc123xyz789",
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

**What to Submit:**
```json
{
  "GOAL": "lose weight",
  "FOOD_ALLERGIES": "peanuts, shellfish",
  "FOOD_LIKES": "chicken, vegetables, rice",
  "FOOD_DISLIKES": "mushrooms, olives",
  "PROTEIN_PERCENTAGE": 0.4,
  "CARBS_PERCENTAGE": 0.35,
  "FAT_PERCENTAGE": 0.25
}
```

**API Call:**
```javascript
const updateDietInfo = async (userId, token, dietInfo) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/diet-information`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dietInfo)
    }
  );
  return await response.json();
};

// Usage (after Phase 1 and Firebase sign-in)
const result = await updateDietInfo(userId, authToken, {
  GOAL: "lose weight",
  FOOD_ALLERGIES: "peanuts",
  FOOD_LIKES: "chicken, rice",
  FOOD_DISLIKES: "mushrooms",
  PROTEIN_PERCENTAGE: 0.4,
  CARBS_PERCENTAGE: 0.35,
  FAT_PERCENTAGE: 0.25
});
```

**What You Receive:**
```json
{
  "success": true,
  "message": "Diet information updated successfully (Phase 2/5)",
  "nextStep": "Complete health information at PUT /v1/users/{userId}/health-information",
  "registrationProgress": {
    "basicInfo": true,
    "dietInformation": true,
    "healthInformation": false,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  }
}
```

---

#### **Phase 3: Health Information**

**What to Submit:**
```json
{
  "AGE": 30,
  "GENDER": "male",
  "HEIGHT": 180,
  "WEIGHT": 75,
  "FITNESS_LEVEL": "intermediate"
}
```

**API Call:**
```javascript
const updateHealthInfo = async (userId, token, healthInfo) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/health-information`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(healthInfo)
    }
  );
  return await response.json();
};

// Usage
const result = await updateHealthInfo(userId, authToken, {
  AGE: 30,
  GENDER: "male",
  HEIGHT: 180,
  WEIGHT: 75,
  FITNESS_LEVEL: "intermediate"
});
```

---

#### **Phase 4: Exercise Preference**

**What to Submit:**
```json
{
  "EXERCISE_PREFERENCE": "gym, running, swimming, cycling"
}
```

**API Call:**
```javascript
const updateExercisePref = async (userId, token, exercisePref) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/exercise-preference`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(exercisePref)
    }
  );
  return await response.json();
};

// Usage
const result = await updateExercisePref(userId, authToken, {
  EXERCISE_PREFERENCE: "gym, running, swimming"
});
```

---

#### **Phase 5: Weekly Exercise Schedule (Final Phase)**

**What to Submit:**
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

**API Call:**
```javascript
const updateWeeklyExercise = async (userId, token, weeklyExercise) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/weekly-exercise`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(weeklyExercise)
    }
  );
  return await response.json();
};

// Usage
const result = await updateWeeklyExercise(userId, authToken, {
  WEEKLY_EXERCISE: {
    Monday: { activityName: "Running", duration: 45, calories: 400 },
    Tuesday: { activityName: "Rest", duration: 0, calories: 0 },
    Wednesday: { activityName: "Gym", duration: 60, calories: 350 },
    Thursday: { activityName: "Rest", duration: 0, calories: 0 },
    Friday: { activityName: "Swimming", duration: 30, calories: 300 },
    Saturday: { activityName: "Cycling", duration: 90, calories: 500 },
    Sunday: { activityName: "Yoga", duration: 45, calories: 150 }
  }
});
```

**What You Receive:**
```json
{
  "success": true,
  "message": "Registration completed successfully! You can now generate nutrition plans.",
  "registrationProgress": {
    "basicInfo": true,
    "dietInformation": true,
    "healthInformation": true,
    "exercisePreference": true,
    "weeklyExercise": true,
    "complete": true
  }
}
```

---

### **Complete Registration Helper Function**

```javascript
const API_BASE = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';

// Complete registration flow
const completeRegistration = async (userData) => {
  try {
    // Phase 1: Basic info
    const phase1 = await fetch(`${API_BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        NAME: userData.name,
        EMAIL: userData.email,
        MOBILE: userData.mobile,
        ADDRESS: userData.address,
        PASSKEY: userData.password
      })
    });
    const { userId } = await phase1.json();
    
    // Sign in with Firebase to get token
    const userCredential = await signInWithEmailAndPassword(
      auth, 
      userData.email, 
      userData.password
    );
    const token = await userCredential.user.getIdToken();
    
    // Phase 2: Diet info
    await fetch(`${API_BASE}/users/${userId}/diet-information`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        GOAL: userData.goal,
        FOOD_ALLERGIES: userData.allergies,
        FOOD_LIKES: userData.likes,
        FOOD_DISLIKES: userData.dislikes,
        PROTEIN_PERCENTAGE: userData.proteinPct,
        CARBS_PERCENTAGE: userData.carbsPct,
        FAT_PERCENTAGE: userData.fatPct
      })
    });
    
    // Phase 3: Health info
    await fetch(`${API_BASE}/users/${userId}/health-information`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        AGE: userData.age,
        GENDER: userData.gender,
        HEIGHT: userData.height,
        WEIGHT: userData.weight,
        FITNESS_LEVEL: userData.fitnessLevel
      })
    });
    
    // Phase 4: Exercise preference
    await fetch(`${API_BASE}/users/${userId}/exercise-preference`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        EXERCISE_PREFERENCE: userData.exercisePreference
      })
    });
    
    // Phase 5: Weekly exercise (completes registration)
    await fetch(`${API_BASE}/users/${userId}/weekly-exercise`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        WEEKLY_EXERCISE: userData.weeklyExercise
      })
    });
    
    return { userId, token };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};
```

---

### Step 2: Authenticate with Firebase

**Install Firebase SDK:**
```bash
# For web apps
npm install firebase

# For Flutter
flutter pub add firebase_auth

# For React Native
npm install @react-native-firebase/app @react-native-firebase/auth
```

**Initialize Firebase:**
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Your Firebase configuration (get from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "nufit-67bf0.firebaseapp.com",
  projectId: "nufit-67bf0",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

**Sign In and Get Token:**
```javascript
const signInUser = async (email, password) => {
  try {
    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get ID token (this is what you need for API calls)
    const idToken = await user.getIdToken();
    
    return {
      userId: user.uid,
      token: idToken,
      email: user.email
    };
  } catch (error) {
    console.error('Sign in error:', error.message);
    throw error;
  }
};

// Usage
const authData = await signInUser('user@example.com', 'SecurePass123!');
console.log('User ID:', authData.userId);
console.log('Auth Token:', authData.token);
```

**What You Get:**
```javascript
{
  userId: "abc123xyz789",  // Use this in API URLs
  token: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE...",  // Use in Authorization header
  email: "user@example.com"
}
```

---

### Step 3: Save/Update User Profile

**What to Submit:**
```json
{
  "name": "John Doe Updated",
  "age": 31,
  "weight": 73,
  "goal": "lose",
  "weeklyActivity": {
    "Monday": { "activityName": "Running", "duration": 60, "calories": 500 },
    "Tuesday": { "activityName": "Rest", "duration": 0, "calories": 0 },
    "Wednesday": { "activityName": "Gym", "duration": 60, "calories": 350 },
    "Thursday": { "activityName": "Swimming", "duration": 45, "calories": 400 },
    "Friday": { "activityName": "Rest", "duration": 0, "calories": 0 },
    "Saturday": { "activityName": "Cycling", "duration": 120, "calories": 700 },
    "Sunday": { "activityName": "Hiking", "duration": 90, "calories": 450 }
  }
}
```

**API Call:**
```javascript
const updateProfile = async (userId, token, profileData) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/profile`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`  // Firebase ID token
      },
      body: JSON.stringify(profileData)
    }
  );
  
  const data = await response.json();
  return data;
};

// Usage
const result = await updateProfile(
  authData.userId,
  authData.token,
  {
    name: "John Doe Updated",
    weight: 73,
    goal: "lose"
  }
);
```

**What You Receive:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "email": "user@example.com",
    "name": "John Doe Updated",
    "age": 31,
    "gender": "male",
    "height": 180,
    "weight": 73,
    "goal": "lose",
    "weeklyActivity": {
      "Monday": { "activityName": "Running", "duration": 60, "calories": 500 },
      "Tuesday": { "activityName": "Rest", "duration": 0, "calories": 0 },
      "Wednesday": { "activityName": "Gym", "duration": 60, "calories": 350 },
      "Thursday": { "activityName": "Swimming", "duration": 45, "calories": 400 },
      "Friday": { "activityName": "Rest", "duration": 0, "calories": 0 },
      "Saturday": { "activityName": "Cycling", "duration": 120, "calories": 700 },
      "Sunday": { "activityName": "Hiking", "duration": 90, "calories": 450 }
    },
    "updatedAt": "2025-11-10T15:45:00.000Z",
    "isPremium": false
  }
}
```

---

### Step 4: Generate Nutrition Plan (Like generateCalorieTargets)

This is the main function - it calculates calorie targets and generates a complete 7-day meal plan.

**Requirements:**
- All 5 registration phases must be completed
- Can only generate once per 7 days (weekly updates allowed)
- Previous plans are automatically deactivated

**What to Submit:**
Nothing! The API uses the user's profile data already saved in Firebase.

**API Call:**
```javascript
const generateNutritionPlan = async (userId, token) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/generate-nutrition-plan`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  return data;
};

// Usage
const plan = await generateNutritionPlan(authData.userId, authData.token);
console.log('Plan ID:', plan.planId);
console.log('Monday Breakfast:', plan.plan.days.Monday.breakfast);
```

**What You Receive:**
```json
{
  "success": true,
  "message": "Nutrition plan generated successfully",
  "planId": "plan_abc123xyz",
  "plan": {
    "userId": "abc123xyz789",
    "createdAt": "2025-11-10T16:00:00.000Z",
    "userProfile": {
      "age": 31,
      "gender": "male",
      "height": 180,
      "weight": 73,
      "goal": "lose"
    },
    "dailyTargets": {
      "Monday": {
        "bmr": 1750,
        "activityCalories": 500,
        "totalCalories": 2250,
        "goalAdjustment": -500,
        "targetCalories": 1750,
        "proteinGrams": 131,
        "carbsGrams": 197,
        "fatGrams": 49
      },
      "Tuesday": {
        "bmr": 1750,
        "activityCalories": 0,
        "totalCalories": 1750,
        "goalAdjustment": -500,
        "targetCalories": 1250,
        "proteinGrams": 94,
        "carbsGrams": 141,
        "fatGrams": 35
      },
      // ... similar for Wednesday through Sunday
    },
    "days": {
      "Monday": {
        "targetCalories": 1750,
        "breakfast": {
          "Recipe_Name": "Greek Yogurt Parfait with Berries",
          "Calories_kcal": 320,
          "Protein_g": 18,
          "Carbs_g": 45,
          "Fat_g": 8,
          "Prep_Time_min": 10,
          "Servings": 1,
          "Instructions": "Layer Greek yogurt with fresh berries, granola, and honey...",
          "Ingredients": "1 cup Greek yogurt, 1/2 cup mixed berries, 2 tbsp granola, 1 tsp honey",
          "Cuisine": "Mediterranean",
          "Difficulty": "Easy"
        },
        "lunch": {
          "Recipe_Name": "Grilled Chicken Salad",
          "Calories_kcal": 450,
          "Protein_g": 38,
          "Carbs_g": 25,
          "Fat_g": 22,
          "Prep_Time_min": 20,
          "Servings": 1,
          "Instructions": "Grill chicken breast, slice and serve over mixed greens...",
          "Ingredients": "150g chicken breast, 2 cups mixed greens, 1 tbsp olive oil, cherry tomatoes, cucumber",
          "Cuisine": "American",
          "Difficulty": "Medium"
        },
        "dinner": {
          "Recipe_Name": "Baked Salmon with Vegetables",
          "Calories_kcal": 520,
          "Protein_g": 42,
          "Carbs_g": 35,
          "Fat_g": 24,
          "Prep_Time_min": 30,
          "Servings": 1,
          "Instructions": "Season salmon with lemon and herbs, bake with vegetables...",
          "Ingredients": "180g salmon fillet, broccoli, carrots, olive oil, lemon",
          "Cuisine": "Mediterranean",
          "Difficulty": "Medium"
        },
        "snacks": [
          {
            "Recipe_Name": "Apple with Almond Butter",
            "Calories_kcal": 180,
            "Protein_g": 4,
            "Carbs_g": 22,
            "Fat_g": 9,
            "Prep_Time_min": 5,
            "Servings": 1,
            "Instructions": "Slice apple and serve with almond butter",
            "Ingredients": "1 medium apple, 2 tbsp almond butter",
            "Cuisine": "American",
            "Difficulty": "Easy"
          },
          {
            "Recipe_Name": "Protein Shake",
            "Calories_kcal": 280,
            "Protein_g": 25,
            "Carbs_g": 30,
            "Fat_g": 8,
            "Prep_Time_min": 5,
            "Servings": 1,
            "Instructions": "Blend protein powder with banana and milk",
            "Ingredients": "1 scoop whey protein, 1 banana, 1 cup almond milk",
            "Cuisine": "American",
            "Difficulty": "Easy"
          }
        ],
        "totalCalories": 1750,
        "totalProtein": 127,
        "totalCarbs": 157,
        "totalFat": 71
      },
      "Tuesday": {
        // ... similar structure for Tuesday
      },
      // ... Wednesday through Sunday with similar structure
    }
  }
}
```

**Key Points:**
- The API automatically calculates BMR based on user's age, gender, height, weight
- Adjusts calories based on goal (lose: -500 cal, gain: +500 cal, maintain: 0)
- Generates balanced meals for all 7 days
- Each day includes breakfast, lunch, dinner, and 2 snacks
- All recipes selected from the 5000+ recipe database
- Nutritional values are automatically balanced to meet targets

---

### Step 5: Retrieve Existing Nutrition Plans

**API Call:**
```javascript
const getNutritionPlans = async (userId, token) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/nutrition-plans`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  return data;
};

// Usage
const allPlans = await getNutritionPlans(authData.userId, authData.token);
console.log('Total plans:', allPlans.plans.length);
```

**What You Receive:**
```json
{
  "success": true,
  "plans": [
    {
      "planId": "plan_abc123xyz",
      "createdAt": "2025-11-10T16:00:00.000Z",
      "userProfile": {
        "age": 31,
        "gender": "male",
        "height": 180,
        "weight": 73,
        "goal": "lose"
      },
      "days": {
        "Monday": { /* full day data */ },
        "Tuesday": { /* full day data */ },
        // ... etc
      }
    },
    {
      "planId": "plan_def456uvw",
      "createdAt": "2025-11-03T10:15:00.000Z",
      // ... older plan
    }
  ]
}
```

---

### Step 6: Generate Shopping List

**What to Submit:**
```json
{
  "days": ["Monday", "Wednesday", "Friday"]
}
```

**API Call:**
```javascript
const generateShoppingList = async (userId, planId, token, selectedDays) => {
  const response = await fetch(
    `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/nutrition-plans/${planId}/generate-shopping-list`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ days: selectedDays })
    }
  );
  
  const data = await response.json();
  return data;
};

// Usage
const shoppingList = await generateShoppingList(
  authData.userId,
  plan.planId,
  authData.token,
  ['Monday', 'Tuesday', 'Wednesday']
);
```

**What You Receive:**
```json
{
  "success": true,
  "message": "Shopping list generated successfully",
  "listId": "list_xyz789abc",
  "shoppingList": [
    {
      "item": "Greek yogurt",
      "quantity": "3 cups",
      "category": "Dairy",
      "aisle": "Refrigerated section"
    },
    {
      "item": "Mixed berries",
      "quantity": "1.5 cups",
      "category": "Produce",
      "aisle": "Fresh produce"
    },
    {
      "item": "Chicken breast",
      "quantity": "450g",
      "category": "Meat",
      "aisle": "Butcher/Meat counter"
    },
    {
      "item": "Salmon fillet",
      "quantity": "540g",
      "category": "Seafood",
      "aisle": "Seafood counter"
    },
    {
      "item": "Mixed greens",
      "quantity": "6 cups",
      "category": "Produce",
      "aisle": "Fresh produce"
    },
    {
      "item": "Olive oil",
      "quantity": "1/4 cup",
      "category": "Oils & Condiments",
      "aisle": "Cooking oils"
    },
    {
      "item": "Almond butter",
      "quantity": "6 tbsp",
      "category": "Spreads",
      "aisle": "Nut butters"
    },
    {
      "item": "Whey protein powder",
      "quantity": "3 scoops",
      "category": "Supplements",
      "aisle": "Health foods"
    }
    // ... more items, organized by category
  ],
  "totalItems": 42,
  "estimatedCost": 85.50
}
```

---

## Platform-Specific Examples

### React Native Complete App

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, TextInput, ScrollView } from 'react-native';
import auth from '@react-native-firebase/auth';

const API_BASE = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';

const NutritionApp = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sign up new user
  const signUp = async (email, password, userData) => {
    setLoading(true);
    try {
      // Register with API
      const response = await fetch(`${API_BASE}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...userData
        })
      });
      const data = await response.json();
      
      if (data.success) {
        // Sign in with Firebase
        await auth().signInWithEmailAndPassword(email, password);
        const idToken = await auth().currentUser.getIdToken();
        setToken(idToken);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate nutrition plan
  const generatePlan = async () => {
    if (!user || !token) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/users/${user.userId}/generate-nutrition-plan`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      
      if (data.success) {
        setPlan(data.plan);
      }
    } catch (error) {
      console.error('Generate plan error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Nufit App</Text>
      
      {!user ? (
        <View>
          <Text>Sign Up Form Here</Text>
          <Button title="Sign Up" onPress={() => signUp(/*...*/)} />
        </View>
      ) : (
        <View>
          <Text>Welcome, {user.name}!</Text>
          <Button 
            title="Generate Meal Plan" 
            onPress={generatePlan}
            disabled={loading}
          />
          
          {plan && (
            <View>
              <Text style={{ fontSize: 20 }}>Your Weekly Plan</Text>
              {Object.keys(plan.days).map(day => (
                <View key={day}>
                  <Text style={{ fontWeight: 'bold' }}>{day}</Text>
                  <Text>Target: {plan.days[day].targetCalories} cal</Text>
                  <Text>Breakfast: {plan.days[day].breakfast.Recipe_Name}</Text>
                  <Text>Lunch: {plan.days[day].lunch.Recipe_Name}</Text>
                  <Text>Dinner: {plan.days[day].dinner.Recipe_Name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default NutritionApp;
```

---

### Flutter Complete Integration

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:convert';

class NutritionService {
  static const String apiBase = 
    'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';
  
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // Register user
  Future<Map<String, dynamic>> registerUser(Map<String, dynamic> userData) async {
    final response = await http.post(
      Uri.parse('$apiBase/users/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(userData),
    );
    return jsonDecode(response.body);
  }

  // Sign in and get token
  Future<String> signIn(String email, String password) async {
    final userCredential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    return await userCredential.user!.getIdToken();
  }

  // Generate nutrition plan
  Future<Map<String, dynamic>> generateNutritionPlan(
    String userId,
    String token,
  ) async {
    final response = await http.post(
      Uri.parse('$apiBase/users/$userId/generate-nutrition-plan'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return jsonDecode(response.body);
  }

  // Update profile
  Future<Map<String, dynamic>> updateProfile(
    String userId,
    String token,
    Map<String, dynamic> profileData,
  ) async {
    final response = await http.put(
      Uri.parse('$apiBase/users/$userId/profile'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(profileData),
    );
    return jsonDecode(response.body);
  }
}

// Usage in a widget
class NutritionScreen extends StatefulWidget {
  @override
  _NutritionScreenState createState() => _NutritionScreenState();
}

class _NutritionScreenState extends State<NutritionScreen> {
  final NutritionService _service = NutritionService();
  Map<String, dynamic>? _plan;
  bool _loading = false;

  Future<void> _generatePlan() async {
    setState(() => _loading = true);
    
    try {
      // Get current user
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      
      // Get token
      final token = await user.getIdToken();
      
      // Generate plan
      final result = await _service.generateNutritionPlan(user.uid, token!);
      
      if (result['success']) {
        setState(() => _plan = result['plan']);
      }
    } catch (e) {
      print('Error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Nutrition Plan')),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : _plan == null
              ? Center(
                  child: ElevatedButton(
                    onPressed: _generatePlan,
                    child: Text('Generate My Plan'),
                  ),
                )
              : ListView.builder(
                  itemCount: (_plan!['days'] as Map).length,
                  itemBuilder: (context, index) {
                    final day = (_plan!['days'] as Map).keys.elementAt(index);
                    final dayData = _plan!['days'][day];
                    
                    return Card(
                      child: ListTile(
                        title: Text(day),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Target: ${dayData['targetCalories']} cal'),
                            Text('Breakfast: ${dayData['breakfast']['Recipe_Name']}'),
                            Text('Lunch: ${dayData['lunch']['Recipe_Name']}'),
                            Text('Dinner: ${dayData['dinner']['Recipe_Name']}'),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
```

---

### Web App (JavaScript/React)

```javascript
// api.js - API service
import { getAuth } from 'firebase/auth';

const API_BASE = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';

export const nutritionAPI = {
  // Register
  async register(userData) {
    const response = await fetch(`${API_BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return response.json();
  },

  // Get auth token
  async getToken() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return await user.getIdToken();
  },

  // Generate nutrition plan
  async generatePlan(userId) {
    const token = await this.getToken();
    const response = await fetch(
      `${API_BASE}/users/${userId}/generate-nutrition-plan`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    return response.json();
  },

  // Update profile
  async updateProfile(userId, profileData) {
    const token = await this.getToken();
    const response = await fetch(
      `${API_BASE}/users/${userId}/profile`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      }
    );
    return response.json();
  },

  // Get recipes
  async getRecipes(mealType, limit = 10) {
    const response = await fetch(
      `${API_BASE}/recipes/${mealType}?limit=${limit}`
    );
    return response.json();
  }
};

// React component
import React, { useState, useEffect } from 'react';
import { nutritionAPI } from './api';

function NutritionPlan() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('YOUR_USER_ID');

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const result = await nutritionAPI.generatePlan(userId);
      if (result.success) {
        setPlan(result.plan);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>My Nutrition Plan</h1>
      <button onClick={handleGeneratePlan} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Plan'}
      </button>

      {plan && (
        <div>
          {Object.entries(plan.days).map(([day, dayData]) => (
            <div key={day} style={{ marginBottom: '20px' }}>
              <h2>{day}</h2>
              <p>Target: {dayData.targetCalories} calories</p>
              
              <div>
                <h3>Breakfast</h3>
                <p>{dayData.breakfast.Recipe_Name}</p>
                <p>{dayData.breakfast.Calories_kcal} cal</p>
              </div>

              <div>
                <h3>Lunch</h3>
                <p>{dayData.lunch.Recipe_Name}</p>
                <p>{dayData.lunch.Calories_kcal} cal</p>
              </div>

              <div>
                <h3>Dinner</h3>
                <p>{dayData.dinner.Recipe_Name}</p>
                <p>{dayData.dinner.Calories_kcal} cal</p>
              </div>

              <div>
                <h3>Snacks</h3>
                {dayData.snacks.map((snack, idx) => (
                  <p key={idx}>
                    {snack.Recipe_Name} - {snack.Calories_kcal} cal
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NutritionPlan;
```

---

## API Request/Response Details

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER SIGNS UP                            │
│  POST /v1/users/register                                         │
│  ↓                                                                │
│  { email, password, name, age, gender, height, weight, goal }   │
│  ↓                                                                │
│  API creates Firebase Auth user + Firestore document            │
│  ↓                                                                │
│  { success: true, userId: "abc123", user: {...} }               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    USER SIGNS IN (FIREBASE)                      │
│  signInWithEmailAndPassword(email, password)                     │
│  ↓                                                                │
│  Firebase validates credentials                                  │
│  ↓                                                                │
│  { userId, token: "eyJhbG..." }                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    UPDATE PROFILE (OPTIONAL)                     │
│  PUT /v1/users/{userId}/profile                                  │
│  Headers: Authorization: Bearer {token}                          │
│  ↓                                                                │
│  { name, age, weight, goal, weeklyActivity }                     │
│  ↓                                                                │
│  API updates Firestore document                                  │
│  ↓                                                                │
│  { success: true, user: {...updated data...} }                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              GENERATE NUTRITION PLAN (Main Function)             │
│  POST /v1/users/{userId}/generate-nutrition-plan                 │
│  Headers: Authorization: Bearer {token}                          │
│  Body: (empty - uses profile data)                               │
│  ↓                                                                │
│  API Process:                                                    │
│  1. Fetch user profile from Firestore                           │
│  2. Calculate BMR (Basal Metabolic Rate)                        │
│  3. Calculate daily calorie targets for each day                │
│  4. Adjust for goal (lose/gain/maintain)                        │
│  5. Fetch recipes from 4 meal type collections                  │
│  6. Select balanced recipes for each meal                       │
│  7. Create 7-day plan                                            │
│  8. Save plan to Firestore                                      │
│  ↓                                                                │
│  { success: true, planId: "plan_abc", plan: {                   │
│      days: {                                                     │
│        Monday: { breakfast, lunch, dinner, snacks, totals },    │
│        Tuesday: { ... },                                         │
│        ... all 7 days                                            │
│      }                                                            │
│  }}                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATE SHOPPING LIST                        │
│  POST /v1/users/{userId}/nutrition-plans/{planId}/              │
│       generate-shopping-list                                     │
│  Headers: Authorization: Bearer {token}                          │
│  Body: { days: ["Monday", "Wednesday", "Friday"] }              │
│  ↓                                                                │
│  API Process:                                                    │
│  1. Fetch nutrition plan from Firestore                         │
│  2. Extract recipes for selected days                           │
│  3. Send recipe data to Google Gemini AI                        │
│  4. AI generates organized shopping list                        │
│  5. Save list to Firestore                                      │
│  ↓                                                                │
│  { success: true, listId: "list_xyz", shoppingList: [          │
│      { item, quantity, category, aisle },                       │
│      ...                                                         │
│  ]}                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Common Errors and Solutions

```javascript
// Error handling wrapper
const apiCall = async (url, options) => {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    
    // Handle specific errors
    if (error.message.includes('auth')) {
      // Token expired - refresh it
      const newToken = await refreshAuthToken();
      // Retry with new token
      options.headers.Authorization = `Bearer ${newToken}`;
      return fetch(url, options).then(r => r.json());
    }
    
    if (error.message.includes('rate limit')) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetch(url, options).then(r => r.json());
    }
    
    throw error;
  }
};
```

### Error Response Format

```json
{
  "success": false,
  "error": "Invalid user profile data",
  "details": "Missing required field: age"
}
```

---

## Complete Working Example

Here's a full working example you can copy and run:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Nufit API Demo</title>
  <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js"></script>
</head>
<body>
  <h1>Nufit Nutrition App Demo</h1>
  
  <div id="auth-section">
    <h2>Sign Up / Sign In</h2>
    <input id="email" type="email" placeholder="Email">
    <input id="password" type="password" placeholder="Password">
    <input id="name" type="text" placeholder="Name">
    <input id="age" type="number" placeholder="Age">
    <select id="gender">
      <option value="male">Male</option>
      <option value="female">Female</option>
    </select>
    <input id="height" type="number" placeholder="Height (cm)">
    <input id="weight" type="number" placeholder="Weight (kg)">
    <select id="goal">
      <option value="lose">Lose Weight</option>
      <option value="maintain">Maintain</option>
      <option value="gain">Gain Weight</option>
    </select>
    <button onclick="signUp()">Sign Up</button>
    <button onclick="signIn()">Sign In</button>
  </div>

  <div id="app-section" style="display: none;">
    <h2>Welcome, <span id="user-name"></span>!</h2>
    <button onclick="generatePlan()">Generate Nutrition Plan</button>
    <div id="plan-display"></div>
  </div>

  <script>
    const API_BASE = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';
    
    // Initialize Firebase (replace with your config)
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "nufit-67bf0.firebaseapp.com",
      projectId: "nufit-67bf0"
    };
    firebase.initializeApp(firebaseConfig);

    let currentUser = null;
    let currentToken = null;

    // Sign up
    async function signUp() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const name = document.getElementById('name').value;
      const age = parseInt(document.getElementById('age').value);
      const gender = document.getElementById('gender').value;
      const height = parseInt(document.getElementById('height').value);
      const weight = parseInt(document.getElementById('weight').value);
      const goal = document.getElementById('goal').value;

      try {
        // Register with API
        const response = await fetch(`${API_BASE}/users/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, password, name, age, gender, height, weight, goal,
            weeklyActivity: {
              Monday: { activityName: "Gym", duration: 60, calories: 300 },
              Tuesday: { activityName: "Rest", duration: 0, calories: 0 },
              Wednesday: { activityName: "Running", duration: 45, calories: 400 },
              Thursday: { activityName: "Rest", duration: 0, calories: 0 },
              Friday: { activityName: "Gym", duration: 60, calories: 300 },
              Saturday: { activityName: "Cycling", duration: 90, calories: 500 },
              Sunday: { activityName: "Rest", duration: 0, calories: 0 }
            }
          })
        });

        const data = await response.json();
        if (data.success) {
          alert('Sign up successful! Now signing in...');
          await signIn();
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    // Sign in
    async function signIn() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const userCredential = await firebase.auth()
          .signInWithEmailAndPassword(email, password);
        
        currentUser = userCredential.user;
        currentToken = await currentUser.getIdToken();

        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('user-name').textContent = currentUser.email;
      } catch (error) {
        alert('Sign in error: ' + error.message);
      }
    }

    // Generate nutrition plan
    async function generatePlan() {
      if (!currentUser || !currentToken) {
        alert('Please sign in first');
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/users/${currentUser.uid}/generate-nutrition-plan`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
          }
        );

        const data = await response.json();
        if (data.success) {
          displayPlan(data.plan);
        }
      } catch (error) {
        alert('Error generating plan: ' + error.message);
      }
    }

    // Display plan
    function displayPlan(plan) {
      const display = document.getElementById('plan-display');
      let html = '<h3>Your 7-Day Nutrition Plan</h3>';

      Object.keys(plan.days).forEach(day => {
        const dayData = plan.days[day];
        html += `
          <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
            <h4>${day}</h4>
            <p><strong>Target:</strong> ${dayData.targetCalories} calories</p>
            <p><strong>Breakfast:</strong> ${dayData.breakfast.Recipe_Name} 
               (${dayData.breakfast.Calories_kcal} cal)</p>
            <p><strong>Lunch:</strong> ${dayData.lunch.Recipe_Name} 
               (${dayData.lunch.Calories_kcal} cal)</p>
            <p><strong>Dinner:</strong> ${dayData.dinner.Recipe_Name} 
               (${dayData.dinner.Calories_kcal} cal)</p>
            <p><strong>Snacks:</strong> 
               ${dayData.snacks.map(s => s.Recipe_Name).join(', ')}</p>
            <p><strong>Total:</strong> ${dayData.totalCalories} cal, 
               Protein: ${dayData.totalProtein}g, 
               Carbs: ${dayData.totalCarbs}g, 
               Fat: ${dayData.totalFat}g</p>
          </div>
        `;
      });

      display.innerHTML = html;
    }
  </script>
</body>
</html>
```

---

## Summary

### What Developers Submit

1. **Registration**: Email, password, name, age, gender, height, weight, goal, weekly activity
2. **Authentication**: Email and password → Get Firebase token
3. **Profile Updates**: Any user fields they want to change
4. **Nutrition Plan**: Nothing (uses saved profile)
5. **Shopping List**: Array of days to include

### What Developers Receive

1. **Registration**: User ID, complete user profile, success confirmation
2. **Authentication**: Firebase ID token (valid for 1 hour)
3. **Profile Updates**: Updated user object
4. **Nutrition Plan**: 
   - Plan ID
   - 7-day meal plan
   - Daily calorie targets
   - Complete recipes with instructions
   - Nutritional breakdown
5. **Shopping List**: 
   - List ID
   - Organized shopping items by category
   - Quantities and aisle locations

### Key Integration Points

- **Base URL**: `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1`
- **Authentication**: Firebase Auth SDK + Bearer token in headers
- **Data Storage**: Firestore (automatic via API)
- **Rate Limits**: 100 requests per 15 minutes per IP
- **Recipe Database**: 5000+ recipes across 4 meal types

---

Need help integrating? Contact: support@nufit.app
