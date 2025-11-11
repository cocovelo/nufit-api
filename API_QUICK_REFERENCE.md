# Nufit API - Quick Start Guide for Developers

## 📍 API Base URL (Copy This!)
```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1
```
**Important:** All API calls start with this URL.

---

## 🎯 Quick Start - What You Need Before Starting

### Prerequisites (Things You Must Have)

1. **Firebase Project Access**
   - If using Nufit API: Contact owner for Firebase config
   - If building your own: Create Firebase project at https://console.firebase.google.com

2. **Firebase Configuration** (looks like this):
   ```javascript
   {
     apiKey: "AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA",
     authDomain: "nufit-67bf0.firebaseapp.com",
     projectId: "nufit-67bf0"
   }
   ```

3. **Development Environment**
   - Node.js installed (for web/React Native)
   - OR Flutter SDK (for Flutter apps)

### What Are These Two Keys?

Many developers get confused between **Firebase API Key** and **Auth Token**. Here's the difference:

| | Firebase API Key | Auth Token |
|---|---|---|
| **What is it?** | Your app's Firebase project identifier | Proof that a user is logged in |
| **Where from?** | Firebase Console (Project Settings) | Firebase Auth after user login |
| **Looks like** | `AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA` | `eyJhbGciOiJSUzI1NiIsImtpZCI6...` (very long) |
| **Used where?** | Firebase SDK initialization in your app | API request headers |
| **Secret?** | ❌ No - safe to include in app code | ✅ Yes - never share, each user different |
| **Valid for?** | Forever (until regenerated) | 1 hour |
| **Used how?** | `initializeApp({ apiKey: "..." })` | `headers: { Authorization: "Bearer ..." }` |

**Important:** You need BOTH:
- Firebase API Key → to initialize Firebase in your app
- Auth Token → to make API calls after user logs in

---

## 🚀 How to Use This API - Simple Steps

### Step 1: Understand What You Can Do

This API has **3 types of endpoints** (API calls):

#### 🔓 Type 1: Public Endpoints (No Login Needed)
These work without any authentication. Anyone can call them.

| What to Call | What It Does |
|-------------|--------------|
| GET `/health` | Check if API is working |
| GET `/recipes/count` | See how many recipes we have |
| GET `/recipes/breakfast` | Get breakfast recipes |
| GET `/recipes/lunch` | Get lunch recipes |
| GET `/recipes/dinner` | Get dinner recipes |
| GET `/recipes/snack` | Get snack recipes |
| POST `/users/register` | Create new user account |

#### 🔒 Type 2: Protected Endpoints (Login Required)
These need a **Firebase authentication token**. User must login first.

| What to Call | What It Does |
|-------------|--------------|
| GET `/users/:userId/profile` | Get user's saved information |
| PUT `/users/:userId/profile` | Update user information |
| POST `/users/:userId/generate-nutrition-plan` | **MAIN FEATURE** - Create 7-day meal plan |
| GET `/users/:userId/nutrition-plans` | See all saved meal plans |
| POST `/users/:userId/nutrition-plans/:planId/generate-shopping-list` | Create shopping list |
| POST `/payments/create-checkout` | Start payment for premium |
| POST `/payments/cancel-subscription` | Cancel premium subscription |
| GET `/payments/subscription-status` | Check if user is premium |

**Note:** Replace `:userId` with actual user ID, replace `:planId` with actual plan ID

#### 🔐 Type 3: API Key Endpoints (Special Access)
These need an API key for advanced features.

| What to Call | What It Does |
|-------------|--------------|
| POST `/recipes/search` | Search recipes with filters |

---

## 📝 Complete Workflow - Do This Step by Step

### ✅ STEP 1: Create New User Account

**What you send to API:**
```javascript
const API_URL = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';

// Collect this data from your app's signup form
const userData = {
  email: 'user@example.com',
  password: 'password123',
  name: 'Rahul Kumar',
  age: 25,
  gender: 'male',        // Must be 'male' or 'female'
  height: 170,           // In centimeters (cm)
  weight: 70,            // In kilograms (kg)
  goal: 'lose',          // Can be 'lose', 'maintain', or 'gain'
  weeklyActivity: {
    Monday: { activityName: 'Gym', duration: 60, calories: 300 },
    Tuesday: { activityName: 'Rest', duration: 0, calories: 0 },
    Wednesday: { activityName: 'Running', duration: 45, calories: 400 },
    Thursday: { activityName: 'Rest', duration: 0, calories: 0 },
    Friday: { activityName: 'Gym', duration: 60, calories: 300 },
    Saturday: { activityName: 'Cycling', duration: 90, calories: 500 },
    Sunday: { activityName: 'Rest', duration: 0, calories: 0 }
  }
};

// Make the API call
const response = await fetch(`${API_URL}/users/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userData)
});

const result = await response.json();
console.log('User ID:', result.userId);  // Save this! You need it later
```

**What you get back:**
```javascript
{
  success: true,
  userId: "abc123xyz789",  // IMPORTANT: Save this user ID!
  message: "User registered successfully"
}
```

---

### ✅ STEP 2: Get Firebase Configuration (One-Time Setup)

**Before you can login users, you need Firebase configuration from the project owner.**

#### Option A: You Are Building Your Own App (Your Own Firebase Project)
If you want to use your own Firebase project instead of Nufit's:

1. **Go to Firebase Console:** https://console.firebase.google.com
2. **Create new project** or select existing project
3. **Go to Project Settings** (click gear icon ⚙️ near "Project Overview")
4. **Scroll down to "Your apps"** section
5. **Click "Add app"** and choose your platform (Web, iOS, Android)
6. **Copy the Firebase config** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",           // Your Firebase API key
  authDomain: "yourproject.firebaseapp.com",
  projectId: "yourproject",
  storageBucket: "yourproject.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. **Enable Email/Password Authentication:**
   - Go to "Authentication" in Firebase Console
   - Click "Get Started"
   - Go to "Sign-in method" tab
   - Enable "Email/Password"

#### Option B: Using Nufit's Firebase Project (Recommended)
Use this Firebase configuration to connect to the Nufit API:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBou0UNhWnqJBAPrDw7sQ9f-gVsHWfHB6A",
  authDomain: "nufit-67bf0.firebaseapp.com",
  databaseURL: "https://nufit-67bf0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nufit-67bf0",
  storageBucket: "nufit-67bf0.firebasestorage.app",
  messagingSenderId: "395553270793",
  appId: "1:395553270793:web:cf40affea53c5d3b471cd8",
  measurementId: "G-0GGSJ1R2WL"
};
```

**Important:** 
- The `apiKey` in config is NOT secret - it's safe to include in your app code
- This is different from API keys for backend services
- This key allows users to authenticate, not access your backend directly

---

### ✅ STEP 3: User Login (Get Authentication Token)

**Install Firebase SDK first:**
```bash
npm install firebase
```

**Then use this code to login:**
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Use the Firebase configuration from Step 2
const firebaseConfig = {
  apiKey: "AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA",
  authDomain: "nufit-67bf0.firebaseapp.com",
  projectId: "nufit-67bf0"
};

// Initialize Firebase (do this once in your app)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Login user (call this when user clicks "Login" button)
const userCredential = await signInWithEmailAndPassword(
  auth, 
  'user@example.com',  // Email from registration (Step 1)
  'password123'        // Password from registration (Step 1)
);

// Get the authentication token (THIS is what you send to API!)
const token = await userCredential.user.getIdToken();
const userId = userCredential.user.uid;

console.log('Token:', token);      // This is your AUTH TOKEN! Use in API calls
console.log('User ID:', userId);   // This is your USER ID! Use in API URLs

// Save these - you need them for all API calls
localStorage.setItem('authToken', token);
localStorage.setItem('userId', userId);
```

**What is the difference between API Key and Auth Token?**

| Item | What It Is | Where It Comes From | Where to Use It | How Long Valid |
|------|-----------|---------------------|-----------------|----------------|
| **Firebase API Key** | Project configuration | Firebase Console | Initialize Firebase in your app | Forever (until you regenerate) |
| **Auth Token** | User's login proof | Firebase Auth after login | API call headers (`Authorization: Bearer <token>`) | 1 hour |

**Example:**
```javascript
// Firebase API Key - in your config (not secret)
const firebaseConfig = {
  apiKey: "AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA",  // ← This
  // ...
};

// Auth Token - from login (secret, expires in 1 hour)
const token = await user.getIdToken();  // ← This
// Token looks like: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MDI..."

// Use token in API calls:
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`  // ← Use AUTH TOKEN here
  }
});
```

**Important Notes:**
- **Firebase API Key** goes in your app's Firebase config (one-time setup)
- **Auth Token** must be obtained for each user after they login
- Auth Token expires after **1 hour** - get a new one when it expires
- Never share Auth Token between users - each user gets their own

---

### ✅ STEP 4: Generate Nutrition Plan (Main Feature!)

**This is the most important API call. It creates a 7-day meal plan.**

```javascript
const API_URL = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';

// Get userId and token from previous step
const userId = localStorage.getItem('userId');      // From Step 3
const token = localStorage.getItem('authToken');    // From Step 3

// Call the API
const response = await fetch(
  `${API_URL}/users/${userId}/generate-nutrition-plan`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`  // Must include Bearer + space + token!
    }
  }
);

const result = await response.json();
console.log('Plan ID:', result.planId);        // Save this for shopping list
console.log('Plan:', result.plan);             // Full 7-day meal plan
```

**What you get back:**
```javascript
{
  success: true,
  planId: "plan123",  // IMPORTANT: Save this for shopping list!
  plan: {
    days: {
      Monday: {
        breakfast: { Title: 'Oatmeal', Calories: 300, Protein: 10, ... },
        lunch: { Title: 'Chicken Salad', Calories: 450, ... },
        dinner: { Title: 'Grilled Fish', Calories: 500, ... },
        snack: { Title: 'Apple', Calories: 95, ... }
      },
      Tuesday: { breakfast: {...}, lunch: {...}, dinner: {...}, snack: {...} },
      // ... Wednesday to Sunday similar structure
    }
  }
}
```

---

### ✅ STEP 5: Generate Shopping List

**After creating meal plan, create shopping list for selected days:**

```javascript
// Get saved values
const userId = localStorage.getItem('userId');
const planId = localStorage.getItem('planId');        // From Step 4
const token = localStorage.getItem('authToken');

// Select which days you want shopping list for
const selectedDays = ['Monday', 'Tuesday', 'Wednesday'];

const response = await fetch(
  `${API_URL}/users/${userId}/nutrition-plans/${planId}/generate-shopping-list`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ days: selectedDays })
  }
);

const result = await response.json();
console.log('Shopping list:', result.shoppingList);
```

**What you get back:**
```javascript
{
  success: true,
  shoppingList: {
    categories: {
      'Produce (Fruits & Vegetables)': [
        'Avocado - 1 ripe',
        'Lemons - 3',
        'Tomatoes - 5'
      ],
      'Dairy & Alternatives': [
        'Greek yogurt - 2 cups',
        'Milk - 1 liter'
      ],
      'Meat & Poultry': [
        'Chicken breast - 500g',
        'Fish fillet - 300g'
      ]
      // ... more categories
    },
    totalItems: 42
  }
}
```

---

## 🔑 How to Send Authentication (Very Important!)

### For Public Endpoints (No Authentication Needed)
```javascript
// Simple fetch - no special headers needed
fetch('https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/health')
```

### For Protected Endpoints (Authentication Required)
```javascript
// MUST include Authorization header with Bearer token
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`  // Token from Firebase login
  }
})
```

**Common Mistake:** Forgetting to add `Bearer ` before the token. 
- ❌ Wrong: `'Authorization': token`
- ✅ Correct: `'Authorization': 'Bearer ' + token`

---

## 📊 Understanding API Responses

### ✅ When API Call Succeeds
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "planId": "plan123",
  "plan": { ... }
}
```
**Check:** Always look for `success: true` to know it worked.

### ❌ When API Call Fails
```json
{
  "success": false,
  "error": "Invalid user data",
  "message": "Age must be a positive number"
}
```
**Check:** Look at `error` and `message` to understand what went wrong.

---

## 🚨 Common Error Codes (What They Mean)

| Code | What It Means | What to Do |
|------|---------------|------------|
| 200 | ✅ Success! Everything worked | Nothing - display the data |
| 201 | ✅ Created! New resource made | Save the ID returned |
| 400 | ❌ Bad Request - Wrong data sent | Check your JSON data format |
| 401 | ❌ Not Logged In | Get new Firebase token, user must login |
| 403 | ❌ Forbidden - No permission | User trying to access someone else's data |
| 404 | ❌ Not Found | Wrong URL or ID doesn't exist |
| 409 | ❌ Already Exists | Email already registered, try login instead |
| 429 | ❌ Too Many Requests | Wait 15 minutes, you made too many calls |
| 500 | ❌ Server Error | Wait and try again, or contact support |

### Example: Handling Errors in Your Code
```javascript
const response = await fetch(url, options);
const data = await response.json();

if (response.status === 401) {
  // Token expired - get new token and try again
  alert('Please login again');
  // Redirect to login page
}

if (response.status === 409) {
  // Email already exists
  alert('This email is already registered. Please login instead.');
}

if (data.success) {
  // Everything worked!
  console.log('Success:', data);
} else {
  // Something went wrong
  console.error('Error:', data.message);
  alert('Error: ' + data.message);
}
```

---

## 📋 User Profile - What Fields to Send

When registering or updating user, send this data:

```javascript
{
  // Basic Information (Required)
  name: 'Rahul Kumar',
  email: 'rahul@example.com',
  password: 'SecurePass123',  // Only for registration
  age: 25,
  gender: 'male',             // MUST be 'male' or 'female'
  height: 170,                // In centimeters (cm) - e.g., 170cm = 5'7"
  weight: 70,                 // In kilograms (kg) - e.g., 70kg = 154 lbs
  
  // Goal (Required) - Choose ONE
  goal: 'lose',               // Options: 'lose', 'maintain', 'gain'
  
  // Weekly Activity (Required)
  weeklyActivity: {
    Monday: {
      activityName: 'Gym',    // Name of activity
      duration: 60,           // In minutes
      calories: 300           // Calories burned
    },
    Tuesday: {
      activityName: 'Rest',
      duration: 0,
      calories: 0
    },
    // ... repeat for all 7 days
  },
  
  // Optional Fields (Can skip these)
  foodAllergies: 'peanuts, shellfish',  // Comma separated
  foodLikes: 'chicken, rice, vegetables',
  foodDislikes: 'mushrooms, olives'
}
```

**Important Notes:**
- Height in **centimeters** (not inches!)
- Weight in **kilograms** (not pounds!)
- Goal must be exactly: `'lose'` or `'maintain'` or `'gain'`
- All 7 days of weeklyActivity required

**To Convert:**
- Feet to cm: Multiply by 30.48 (e.g., 5'7" = 5.7 × 30.48 = 170cm)
- Pounds to kg: Divide by 2.205 (e.g., 154 lbs = 154 ÷ 2.205 = 70kg)

---

## 🍽️ Meal Types - What to Use

When calling recipe endpoints, use these exact meal types:

| Meal Type | Use This Value | Example |
|-----------|---------------|---------|
| Breakfast | `'breakfast'` | `GET /recipes/breakfast` |
| Lunch | `'lunch'` | `GET /recipes/lunch` |
| Dinner | `'dinner'` | `GET /recipes/dinner` |
| Snacks | `'snack'` | `GET /recipes/snack` |

**Common Mistake:** Using `'snacks'` (with 's') instead of `'snack'` (without 's')

---

## 📦 Shopping List Categories

When you get shopping list, items are organized in these categories:

```javascript
{
  'Produce (Fruits & Vegetables)': ['Tomatoes - 5', 'Onions - 2', ...],
  'Dairy & Alternatives': ['Milk - 1 liter', 'Yogurt - 2 cups', ...],
  'Meat & Poultry': ['Chicken breast - 500g', ...],
  'Seafood': ['Fish fillet - 300g', ...],
  'Pantry (Dry Goods, Canned, Jarred)': ['Rice - 1kg', 'Olive oil - 200ml', ...],
  'Spices & Condiments': ['Salt', 'Pepper', 'Turmeric', ...],
  'Baked Goods': ['Bread - 1 loaf', ...],
  'Frozen': ['Frozen peas - 200g', ...],
  'Beverages': ['Orange juice - 1 liter', ...],
  'Other': ['Any items that don't fit above categories']
}
```

**Use this to display items by category in your app!**

---

## 🍴 Recipe Object - What You Get

When you fetch recipes, each recipe looks like this:

```javascript
{
  id: 'recipe123',
  Title: 'Chicken Tikka Masala',          // Recipe name
  Blurb: 'Delicious Indian curry...',     // Short description
  Calories: '450',                         // Total calories (as string)
  Protein: '35',                           // Protein in grams (as string)
  Carbs: '40',                            // Carbs in grams (as string)
  Fat: '18',                              // Fat in grams (as string)
  Fibre: '5',                             // Fiber in grams (as string)
  Ingredients: 'chicken breast/n500g yogurt/nonions/n...',  // Split by '/n'
  Method: 'Step 1: Marinate chicken... Step 2: Cook...',    // Instructions
  ImageURL: 'https://example.com/image.jpg',
  Times: 'Preparation: 20 mins ; Cooking: 30 mins',
  Webpage: 'https://example.com/recipe',
  servings: '4'
}
```

**Important Notes:**
- Calories, Protein, Carbs, Fat are **strings**, not numbers
- Ingredients separated by `/n` (not `\n`)
- Convert to number: `parseInt(recipe.Calories)`

---

## ⏱️ Rate Limits (How Many Calls You Can Make)

**What is rate limit?** 
It's a limit on how many API calls you can make in a time period.

| Endpoint Type | Limit | Time Period |
|---------------|-------|-------------|
| Public endpoints (no auth) | 100 requests | Per 15 minutes |
| Protected endpoints (with auth) | No limit | - |

**What happens if you exceed limit?**
- You get error code `429 (Too Many Requests)`
- Wait 15 minutes and try again
- Or spread out your API calls

**Example:** If your app calls `/recipes/breakfast` 100 times in 10 minutes, the 101st call will fail. Wait 15 minutes to reset.

---

## 🧪 Testing the API (Try Before Building Your App)

### Test 1: Check if API is Working
**Open your browser and go to:**
```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/health
```
**You should see:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-11T15:30:00.000Z",
  "version": "1.0.0"
}
```

### Test 2: Get Some Recipes
**Open your browser and go to:**
```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast?limit=3
```
**You should see 3 breakfast recipes with all details.**

### Test 3: Count All Recipes
**Open your browser and go to:**
```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/count
```
**You should see:**
```json
{
  "breakfast": 1074,
  "lunch": 1593,
  "dinner": 1479,
  "snack": 1213
}
```

### Test 4: Test Protected Endpoint (Need Code)
**You can't test protected endpoints in browser. Use this code:**

```javascript
// First, register and login to get token
const userId = 'your_user_id_here';
const token = 'your_firebase_token_here';

// Then test profile endpoint
fetch(`https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/profile`, {
  headers: { 'Authorization': `Bearer ${token}` }
})
  .then(response => response.json())
  .then(data => console.log('Profile:', data));
```

---

## 📱 Example for Different Platforms

### For React Native Developers

```javascript
import React, { useState } from 'react';
import auth from '@react-native-firebase/auth';

const API_URL = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';

function NutritionApp() {
  const [plan, setPlan] = useState(null);

  // Generate nutrition plan
  const generatePlan = async () => {
    // Get current user and token
    const user = auth().currentUser;
    const token = await user.getIdToken();
    
    // Call API
    const response = await fetch(`${API_URL}/users/${user.uid}/generate-nutrition-plan`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      setPlan(data.plan);
    }
  };

  return (
    <View>
      <Button title="Generate My Meal Plan" onPress={generatePlan} />
      {plan && <Text>Monday Breakfast: {plan.days.Monday.breakfast.Title}</Text>}
    </View>
  );
}
```

### For Flutter Developers

```dart
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:convert';

class NufitApi {
  final String apiUrl = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';
  
  // Generate nutrition plan
  Future<Map> generatePlan() async {
    // Get current user and token
    final user = FirebaseAuth.instance.currentUser;
    final token = await user!.getIdToken();
    
    // Call API
    final response = await http.post(
      Uri.parse('$apiUrl/users/${user.uid}/generate-nutrition-plan'),
      headers: {'Authorization': 'Bearer $token'},
    );
    
    return jsonDecode(response.body);
  }
  
  // Get recipes
  Future<List> getBreakfastRecipes() async {
    final response = await http.get(
      Uri.parse('$apiUrl/recipes/breakfast?limit=10')
    );
    
    final data = jsonDecode(response.body);
    return data['recipes'];
  }
}

// Usage in widget
ElevatedButton(
  onPressed: () async {
    final api = NufitApi();
    final result = await api.generatePlan();
    print('Plan created: ${result['planId']}');
  },
  child: Text('Generate Plan'),
)
```

---

## 💡 Important Notes to Remember

### 1. Token Expiration (Very Important!)
**Firebase auth tokens expire after 1 hour.**

**Problem:** After 1 hour, your API calls will fail with 401 Unauthorized error.

**Solution:** Always get a fresh token before making API calls:

```javascript
import { getAuth } from 'firebase/auth';

// Method 1: Force refresh token
const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken(true);  // true = force refresh

// Method 2: Check if token is old, then refresh
async function getFreshToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not logged in');
  }
  
  // Get token (Firebase SDK auto-refreshes if expired)
  return await user.getIdToken();
}

// Method 3: Wrapper function for API calls (Recommended)
async function apiCall(url, options = {}) {
  // Get fresh token
  const token = await getFreshToken();
  
  // Add token to headers
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  
  // Make API call
  return fetch(url, { ...options, headers });
}

// Usage:
const response = await apiCall(
  `${API_URL}/users/${userId}/generate-nutrition-plan`,
  { method: 'POST' }
);
```

**Best Practice:** Create a wrapper function that automatically refreshes tokens for all API calls.

### 2. Calories Calculation
**How meal plan calories are calculated:**
- Step 1: Calculate BMR (Basal Metabolic Rate) from age, gender, height, weight
- Step 2: Add daily activity calories
- Step 3: Apply goal adjustment (-500 for lose, +500 for gain, 0 for maintain)
- Step 4: Ensure minimum calories (1200 for women, 1500 for men)

### 3. Recipe Selection
**How recipes are selected:**
- ✅ Excludes allergens you specified
- ✅ Excludes foods you dislike
- ✅ Prep time ≤ 30 minutes
- ✅ Cook time ≤ 60 minutes
- ✅ Balanced nutrition matching your targets

### 4. Shopping List
**Generated using Google Gemini AI:**
- Combines all ingredients from selected days
- Removes duplicates and consolidates quantities
- Organizes by supermarket categories
- Takes 5-10 seconds to generate

### 5. Data Format
- All dates are in ISO format: `"2025-11-11T15:30:00.000Z"`
- Numbers might be strings: Convert with `parseInt()` or `parseFloat()`
- Ingredients separated by `/n`: Split with `.split('/n')`

---

## 📞 Need Help?

**Full Documentation:** See `DEVELOPER_INTEGRATION_GUIDE.md` file
**Complete Example:** See `complete-workflow-demo.js` file
**Testing Guide:** See `TESTING_GUIDE.md` file

**Questions?** Contact: chep1987@gmail.com

---

## ✅ Checklist Before Starting

### Getting Firebase API Key (One-Time Setup)
- [ ] **Option A:** Contact Nufit owner for Firebase config (for testing)
  - Email: chep1987@gmail.com
  - Ask for: Firebase configuration object
  
- [ ] **Option B:** Create your own Firebase project (for production app)
  - Go to: https://console.firebase.google.com
  - Click "Add project"
  - Go to Project Settings → Your apps → Add app
  - Copy the Firebase config object
  - Enable Email/Password authentication

### Setting Up Your App
- [ ] I have Firebase API key (in firebaseConfig object)
- [ ] I installed Firebase SDK (`npm install firebase`)
- [ ] I initialized Firebase in my app (`initializeApp(firebaseConfig)`)
- [ ] I tested `/health` endpoint in browser (https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/health)

### Understanding Authentication
- [ ] I understand Firebase API Key vs Auth Token difference
- [ ] I know Firebase API Key goes in Firebase config (one-time)
- [ ] I know Auth Token comes from user login (each session)
- [ ] I know Auth Token expires every 1 hour
- [ ] I created a function to refresh tokens automatically

### API Integration
- [ ] I know the difference between public and protected endpoints
- [ ] I save userId after registration
- [ ] I save planId after generating nutrition plan
- [ ] I include `Bearer ` before token in Authorization header
- [ ] I handle errors with try-catch
- [ ] I show loading indicators during API calls (10-15 seconds for plans)

### Testing
- [ ] Registration works (STEP 1)
- [ ] Login works and I can get auth token (STEP 3)
- [ ] I can generate nutrition plan (STEP 4)
- [ ] I can generate shopping list (STEP 5)

**Ready to start building? Good luck! 🚀**

---

## 🆘 Still Confused About Firebase API Key vs Auth Token?

**Simple Example:**

```javascript
// ========================================
// PART 1: FIREBASE API KEY (One-Time Setup)
// ========================================
// This is like your "building entrance key" - everyone in your company uses same key

const firebaseConfig = {
  apiKey: "AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA",  // ← FIREBASE API KEY
  authDomain: "nufit-67bf0.firebaseapp.com",
  projectId: "nufit-67bf0"
};

// Initialize Firebase ONCE when app starts
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ========================================
// PART 2: AUTH TOKEN (After User Login)
// ========================================
// This is like user's "office key card" - each employee has unique card

// When user logs in:
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const authToken = await userCredential.user.getIdToken();  // ← AUTH TOKEN

// Use AUTH TOKEN for API calls:
fetch('https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/123/profile', {
  headers: {
    'Authorization': `Bearer ${authToken}`  // ← Use AUTH TOKEN here
  }
});
```

**Remember:**
- **Firebase API Key** = Building key (everyone uses same, goes in config)
- **Auth Token** = Personal key card (each user different, goes in API headers)

**Where to get them:**
- **Firebase API Key**: Firebase Console → Project Settings → Your apps
- **Auth Token**: Call `user.getIdToken()` after user logs in with Firebase Auth
