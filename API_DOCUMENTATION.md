# Nufit API Documentation

## Overview

The Nufit API provides access to recipe data, nutrition planning, and user management features. The API uses a hybrid approach:

- **Public REST API** (`/api/v1/*`) - Simple read operations, requires API key for advanced features
- **Callable Functions** - Complex operations requiring authentication (nutrition plan generation, shopping lists, Stripe)

---

## Base URL

```
https://us-central1-nufit-67bf0.cloudfunctions.net/api
```

---

## Authentication

### Firebase Configuration

To use the Nufit API, you need to initialize Firebase in your application with this configuration:

```javascript
// Firebase Configuration for Nufit API
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

// Initialize Firebase (do this once in your app)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

**Note:** This Firebase configuration is safe to include in your client-side code. It's meant to be public.

---

### API Key (for external developers - Advanced Features Only)

Include in request headers for advanced recipe search:
```
x-api-key: your-api-key-here
```

**To get an API key:** Contact chep1987@gmail.com

---

### Firebase Auth (for user-specific operations)

After users log in with Firebase Auth, include their ID token in headers:
```
Authorization: Bearer <firebase-id-token>
```

**How to get Firebase ID token:**
```javascript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();

// Use this token in API calls
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Public REST API Endpoints

### 1. Health Check

**GET** `/v1/health`

Check API status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

## User Management Endpoints

### 2. User Registration

**POST** `/v1/users/register`

Register a new user account with profile data.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "age": 30,
  "gender": "male",
  "height": 180,
  "weight": 75,
  "fitnessLevel": "intermediate",
  "goal": "lose weight",
  "weeklyActivity": {
    "Monday": { "calories": 300 },
    "Tuesday": { "calories": 0 },
    ...
  },
  "foodAllergies": "peanuts, shellfish",
  "foodLikes": "chicken, vegetables",
  "foodDislikes": "mushrooms",
  "proteinPercentage": 0.4,
  "carbsPercentage": 0.35,
  "fatPercentage": 0.25
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": "firebase-user-id",
  "email": "user@example.com"
}
```

---

### 3. Get User Profile

**GET** `/v1/users/:userId/profile`

🔒 Requires: Firebase Auth (user can only access their own profile)

Get user profile data.

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "user-id",
    "name": "John Doe",
    "email": "user@example.com",
    "age": 30,
    "gender": "male",
    "height": 180,
    "weight": 75,
    "subscribed": true,
    ...
  }
}
```

---

### 4. Update User Profile

**PUT** `/v1/users/:userId/profile`

🔒 Requires: Firebase Auth

Update user profile data.

**Request Body:**
```json
{
  "age": 31,
  "weight": 73,
  "goal": "maintain",
  "weeklyActivity": {
    "Monday": { "calories": 400 },
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

## Payment Endpoints

### 5. Create Stripe Checkout Session

**POST** `/v1/payments/create-checkout`

🔒 Requires: Firebase Auth

Create a Stripe checkout session for subscription.

**Request Body:**
```json
{
  "email": "user@example.com",
  "priceId": "price_1RJx3cDNiU7g4QNyVyT5vujC",
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_test_abc123...",
  "sessionUrl": "https://checkout.stripe.com/pay/cs_test_abc123..."
}
```

---

### 6. Cancel Subscription

**POST** `/v1/payments/cancel-subscription`

🔒 Requires: Firebase Auth

Cancel user's active Stripe subscription.

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

---

### 7. Get Subscription Status

**GET** `/v1/payments/subscription-status`

🔒 Requires: Firebase Auth

Get user's current subscription status.

**Response:**
```json
{
  "success": true,
  "subscribed": true,
  "subscriptionId": "sub_abc123",
  "currentPeriodEnd": 1699564800000,
  "stripeCustomerId": "cus_abc123"
}
```

---

## Nutrition Plan Endpoints

### 8. Generate Nutrition Plan

**POST** `/v1/users/:userId/generate-nutrition-plan`

🔒 Requires: Firebase Auth

Generate a personalized 7-day nutrition plan based on user profile.

**Response:**
```json
{
  "success": true,
  "message": "Nutrition plan generated successfully",
  "planId": "plan-abc123",
  "plan": {
    "planStartDate": "2025-11-10T12:00:00.000Z",
    "generatedAt": "2025-11-10T12:00:00.000Z",
    "notes": "Plan based on goal \"lose weight\"",
    "dailyTargetDetails": {
      "Monday": {
        "calories": 1800,
        "proteinGrams": 180,
        "carbsGrams": 158,
        "fatGrams": 50,
        "fuelingDemandCategory": "medium"
      },
      ...
    },
    "days": {
      "Monday": {
        "breakfast": { "id": "recipe-123", "Title": "...", "Calories": "350", ... },
        "lunch": { ... },
        "dinner": { ... },
        "snack": { ... }
      },
      ...
    },
    "inputDetails": { ... }
  }
}
```

---

### 9. Get User's Nutrition Plans

**GET** `/v1/users/:userId/nutrition-plans`

🔒 Requires: Firebase Auth

Get all nutrition plans for a user.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "plans": [
    {
      "id": "plan-abc123",
      "planStartDate": "2025-11-10T...",
      "generatedAt": "2025-11-10T...",
      "dailyTargetDetails": { ... },
      "days": { ... }
    }
  ]
}
```

---

### 10. Generate Shopping List

**POST** `/v1/users/:userId/nutrition-plans/:planId/generate-shopping-list`

🔒 Requires: Firebase Auth

Generate a consolidated shopping list from a nutrition plan using AI.

**Response:**
```json
{
  "success": true,
  "message": "Shopping list generated successfully",
  "shoppingList": [
    {
      "item": "Milk (whole)",
      "quantity": "3 cups",
      "category": "Dairy & Alternatives"
    },
    {
      "item": "Chicken Breasts",
      "quantity": "500g",
      "category": "Meat & Poultry"
    },
    ...
  ]
}
```

---

### 11. Get Shopping List

**GET** `/v1/users/:userId/nutrition-plans/:planId/shopping-list`

🔒 Requires: Firebase Auth

Get the existing shopping list for a nutrition plan.

**Response:**
```json
{
  "success": true,
  "shoppingList": {
    "generatedAt": "2025-11-10T...",
    "items": [
      {
        "item": "Milk (whole)",
        "quantity": "3 cups",
        "category": "Dairy & Alternatives"
      },
      ...
    ]
  }
}
```

---

## Recipe Endpoints

### 12. Get Recipe Counts

**GET** `/v1/recipes/count`

Get total count of recipes by meal type.

**Response:**
```json
{
  "success": true,
  "counts": {
    "breakfast_list_full_may2025": 1074,
    "lunch_list_full_may2025": 1593,
    "dinner_list_full_may2025": 1479,
    "snack_list_full_may2025": 1213
  },
  "total": 5359
}
```

---

### 13. List Recipes by Meal Type

**GET** `/v1/recipes/:mealType`

Fetch recipes for a specific meal type with pagination.

**Path Parameters:**
- `mealType` (string): One of `breakfast`, `lunch`, `dinner`, `snack`

**Query Parameters:**
- `limit` (number, optional): Number of recipes to return (default: 20, max: 100)
- `offset` (number, optional): Number of recipes to skip (default: 0)
- `search` (string, optional): Search term for recipe titles

**Example Request:**
```
GET /v1/recipes/breakfast?limit=10&offset=0&search=oatmeal
```

**Response:**
```json
{
  "success": true,
  "mealType": "breakfast",
  "count": 10,
  "limit": 10,
  "offset": 0,
  "recipes": [
    {
      "id": "03sSfCFNB1EvfXbUceEv",
      "Title": "Plum, raisin & granola porridge topper",
      "Calories": "212",
      "Blurb": "Forget the sprinkling of sugar...",
      "Ingredients": "2 plums/n2 tbsp honey/n30g porridge oats...",
      "Method": "step 1Heat oven to 180C...",
      "ImageURL": "https://...",
      "Carbs": "78",
      "Fat": "4",
      "Protein": "4",
      ...
    }
  ]
}
```

---

### 14. Get Single Recipe

**GET** `/v1/recipes/:mealType/:recipeId`

Get detailed information for a specific recipe.

**Path Parameters:**
- `mealType` (string): One of `breakfast`, `lunch`, `dinner`, `snack`
- `recipeId` (string): The recipe document ID

**Example Request:**
```
GET /v1/recipes/breakfast/03sSfCFNB1EvfXbUceEv
```

**Response:**
```json
{
  "success": true,
  "recipe": {
    "id": "03sSfCFNB1EvfXbUceEv",
    "Title": "Plum, raisin & granola porridge topper",
    "Calories": "212",
    ...
  }
}
```

---

## Protected Endpoints (Require API Key)

### 15. Advanced Recipe Search

**POST** `/v1/recipes/search`

🔒 Requires: `x-api-key` header

Search recipes with advanced filters.

**Request Body:**
```json
{
  "mealTypes": ["breakfast", "lunch"],
  "maxCalories": 500,
  "minCalories": 200,
  "allergies": ["peanuts", "shellfish"],
  "limit": 20
}
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "recipes": [
    {
      "id": "...",
      "mealType": "breakfast",
      "Title": "...",
      "Calories": "350",
      ...
    }
  ]
}
```

---

### 6. Get User Nutrition Plans

**GET** `/v1/user/:userId/nutrition-plans`

🔒 Requires: `x-api-key` header + `Authorization` header with Firebase token

Get nutrition plans for a specific user.

**Headers:**
```
x-api-key: your-api-key
Authorization: Bearer <firebase-id-token>
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "plans": [
    {
      "id": "plan-id-123",
      "generatedAt": "2025-11-10T...",
      "dailyTargetDetails": { ... },
      "days": { ... }
    }
  ]
}
```

---

## Firebase Callable Functions

These functions are called from Firebase SDKs, not via HTTP requests.

### 7. Generate Nutrition Plan

**Function:** `generateCalorieTargets`

🔒 Requires: Firebase Authentication

Generates a personalized 7-day nutrition plan based on user profile.

**Usage (JavaScript):**
```javascript
const functions = firebase.functions();
const generatePlan = functions.httpsCallable('generateCalorieTargets');

const result = await generatePlan();
console.log(result.data.plan);
```

**Usage (Flutter/Dart):**
```dart
final callable = FirebaseFunctions.instance.httpsCallable('generateCalorieTargets');
final result = await callable.call();
print(result.data['plan']);
```

---

### 8. Generate Shopping List

**Function:** `generateShoppingList`

🔒 Requires: Firebase Authentication

Generates a consolidated shopping list from a nutrition plan using AI.

**Usage (JavaScript):**
```javascript
const generateList = functions.httpsCallable('generateShoppingList');

const result = await generateList({
  userId: 'user-id',
  nutritionPlanId: 'plan-id'
});

console.log(result.data.shoppingList);
```

**Response:**
```json
{
  "shoppingList": [
    {
      "item": "Milk (whole)",
      "quantity": "3 cups",
      "category": "Dairy & Alternatives"
    },
    {
      "item": "Chicken Breasts",
      "quantity": "500g",
      "category": "Meat & Poultry"
    }
  ]
}
```

---

### 9. Create Stripe Checkout

**Function:** `createStripeCheckout`

🔒 Requires: Firebase Authentication

Creates a Stripe checkout session for subscription.

**Usage:**
```javascript
const createCheckout = functions.httpsCallable('createStripeCheckout');
const result = await createCheckout({ email: 'user@example.com' });

// Redirect user to checkout
window.location.href = result.data.sessionUrl;
```

---

### 10. Cancel Subscription

**Function:** `cancelStripeSubscription`

🔒 Requires: Firebase Authentication

Cancels the user's active Stripe subscription.

**Usage:**
```javascript
const cancelSub = functions.httpsCallable('cancelStripeSubscription');
const result = await cancelSub();

if (result.data.success) {
  console.log('Subscription cancelled');
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limits

- **Public endpoints**: 100 requests per 15 minutes per IP
- **Protected endpoints**: Tracked per API key

---

## Obtaining an API Key

To get an API key for external development:

1. Contact the Nufit team at cshep1987@gmail.com
2. Provide your use case and expected request volume
3. You'll receive an API key via email
4. Store the key securely (never commit to version control)

**API Key Document Structure (Firestore):**
```javascript
// Collection: apiKeys
// Document ID: your-api-key-string
{
  active: true,
  createdAt: Timestamp,
  expiresAt: Timestamp (optional),
  developer: "Developer Name",
  email: "dev@example.com",
  requestCount: 0,
  lastUsed: Timestamp,
  permissions: ["read:recipes", "search:recipes"]
}
```

---

## Complete Workflow Examples

### Full User Journey: Registration to Nutrition Plan

#### 1. Register User
```javascript
// Step 1: Register new user
const registerResponse = await fetch(
  'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'Jane Doe',
      age: 28,
      gender: 'female',
      height: 165,
      weight: 60,
      goal: 'lose weight',
      weeklyActivity: {
        Monday: { calories: 300 },
        Tuesday: { calories: 400 },
        Wednesday: { calories: 0 },
        Thursday: { calories: 300 },
        Friday: { calories: 500 },
        Saturday: { calories: 400 },
        Sunday: { calories: 200 }
      },
      foodAllergies: 'peanuts',
      foodDislikes: 'mushrooms'
    })
  }
);

const { userId } = await registerResponse.json();
console.log('User registered:', userId);
```

#### 2. Authenticate & Get Token
```javascript
// Step 2: Sign in and get Firebase token
import firebase from 'firebase/app';
import 'firebase/auth';

await firebase.auth().signInWithEmailAndPassword('newuser@example.com', 'securePassword123');
const token = await firebase.auth().currentUser.getIdToken();
```

#### 3. Create Stripe Checkout Session
```javascript
// Step 3: Subscribe to service
const checkoutResponse = await fetch(
  'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/payments/create-checkout',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email: 'newuser@example.com',
      successUrl: 'https://myapp.com/success',
      cancelUrl: 'https://myapp.com/cancel'
    })
  }
);

const { sessionUrl } = await checkoutResponse.json();
// Redirect user to Stripe checkout
window.location.href = sessionUrl;
```

#### 4. Generate Nutrition Plan
```javascript
// Step 4: After successful payment, generate nutrition plan
const planResponse = await fetch(
  `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/generate-nutrition-plan`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }
);

const { planId, plan } = await planResponse.json();
console.log('Nutrition plan generated:', planId);
console.log('Monday breakfast:', plan.days.Monday.breakfast);
```

#### 5. Generate Shopping List
```javascript
// Step 5: Generate shopping list from the plan
const shoppingResponse = await fetch(
  `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/nutrition-plans/${planId}/generate-shopping-list`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }
);

const { shoppingList } = await shoppingResponse.json();
console.log('Shopping list items:', shoppingList.length);

// Group by category
const grouped = shoppingList.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {});
```

#### 6. Update Profile Later
```javascript
// Step 6: User updates their weight
await fetch(
  `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/profile`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      weight: 58,  // Lost 2kg!
      weeklyActivity: {
        Monday: { calories: 400 },  // Increased activity
        ...
      }
    })
  }
);

// Regenerate plan with updated data
const newPlanResponse = await fetch(
  `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/${userId}/generate-nutrition-plan`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

---

## Code Examples

### JavaScript/Web

```javascript
// Public endpoint (no auth)
const response = await fetch(
  'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast?limit=10'
);
const data = await response.json();

// Protected endpoint (with API key)
const searchResponse = await fetch(
  'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/search',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key'
    },
    body: JSON.stringify({
      mealTypes: ['breakfast'],
      maxCalories: 400
    })
  }
);

// Callable function
const functions = firebase.functions();
const generatePlan = functions.httpsCallable('generateCalorieTargets');
const plan = await generatePlan();
```

### Flutter/Dart

```dart
import 'package:http/http.dart' as http;
import 'package:cloud_functions/cloud_functions.dart';

// Public endpoint
Future<void> fetchRecipes() async {
  final response = await http.get(
    Uri.parse('https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast'),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    print(data['recipes']);
  }
}

// Protected endpoint with API key
Future<void> searchRecipes() async {
  final response = await http.post(
    Uri.parse('https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/search'),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key',
    },
    body: jsonEncode({
      'mealTypes': ['breakfast', 'lunch'],
      'maxCalories': 500,
    }),
  );
}

// Callable function
Future<void> generatePlan() async {
  final callable = FirebaseFunctions.instance.httpsCallable('generateCalorieTargets');
  final result = await callable.call();
  print(result.data['plan']);
}
```

### Python

```python
import requests

# Public endpoint
response = requests.get(
    'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast',
    params={'limit': 10}
)
recipes = response.json()

# Protected endpoint with API key
search_response = requests.post(
    'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/search',
    headers={'x-api-key': 'your-api-key'},
    json={
        'mealTypes': ['breakfast'],
        'maxCalories': 400
    }
)
```

---

## Testing

Use the health check endpoint to verify API availability:

```bash
curl https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/health
```

---

## Support

For API support, bug reports, or feature requests:
- Email: cshep1987@gmail.com
- Documentation: [Link to detailed docs]
- Status Page: [Link to status page]

---

## Changelog

### v1.0.0 (2025-11-10)
- Initial API release
- Public REST endpoints for recipe access
- Protected search endpoint
- Firebase callable functions for nutrition planning
- Stripe integration for subscriptions
