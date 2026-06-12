# Nufit API - Complete Documentation

**Last Updated:** June 12, 2026  
**API Version:** 1.8.0  
**Status:** Production  
**Field Names:** Frozen - No changes permitted without explicit request

---

## Quick Links

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Field Reference](#complete-field-reference)
- [Response Schema](#response-schema)
- [Error Codes](#error-codes)
- [Workflow Examples](#workflow-examples)

---

## Quick Start

### Base URL
```
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1
```

### Firebase Configuration

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

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

### Three Types of Endpoints

#### 🔓 **Public Endpoints** (No auth required)
- `GET /health` - Health check
- `GET /recipes/count` - Recipe counts
- `GET /recipes/:mealType` - Browse recipes
- `GET /recipes/:mealType/:recipeId` - Get specific recipe
- `GET /subscription/tiers` - Get pricing and subscription tiers
- `POST /users/register` - Create account
- `POST /users/login` - Login

#### 🔒 **Protected Endpoints** (Firebase auth token required)
Include header: `Authorization: Bearer <firebase-id-token>`

**Getting a token:**
```javascript
const token = await user.getIdToken();
```

#### 🔐 **API Key Endpoints** (External developers only)
Include header: `x-api-key: your-api-key-here`
Contact: cshep1987@gmail.com to request

---

## Authentication

### Firebase Auth (Protected Endpoints)

```javascript
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();

// Use in API calls
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### API Key (External Developers)

```javascript
const response = await fetch(url, {
  headers: {
    'x-api-key': 'your-api-key-here'
  }
});
```

---

## API Endpoints

### PUBLIC ENDPOINTS

#### GET /health
Health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

#### GET /recipes/count
Get recipe counts.

**Response:**
```json
{
  "success": true,
  "counts": {
    "breakfast_list_full_may2025": 150,
    "lunch_list_full_may2025": 200,
    "dinner_list_full_may2025": 180,
    "snack_list_full_may2025": 95
  },
  "total": 625
}
```

---

#### GET /recipes/:mealType
Fetch recipes by meal type.

**Parameters:**
- `:mealType` - `breakfast`, `lunch`, `dinner`, or `snack`
- `limit` (optional) - Results per page (default: 20, max: 100)
- `offset` (optional) - Items to skip (default: 0)
- `search` (optional) - Search term

**Example:**
```
GET /recipes/breakfast?limit=10&search=oatmeal
```

**Response:**
```json
{
  "success": true,
  "mealType": "breakfast",
  "count": 10,
  "limit": 10,
  "offset": 0,
  "recipes": [...]
}
```

---

#### GET /recipes/:mealType/:recipeId
Get specific recipe.

**Response:**
```json
{
  "success": true,
  "recipe": {
    "id": "recipe_001",
    "Title": "Oatmeal with Berries",
    "Calories": 350,
    "Protein": 12,
    "Carbs": 55,
    "Fat": 8,
    "Ingredients": "1 cup oats, 1/2 cup berries...",
    "Method": "Mix oats with water..."
  }
}
```

---

#### GET /subscription/tiers
Get available subscription tiers with pricing and features.

**Authentication:** Optional - Returns user-specific eligibility if authenticated. When authenticated, the `free-trial` tier is automatically removed from the `tiers` array if the user has already used their free trial, so the list is always safe to render directly in the UI.

**Response (Public):**
```json
{
  "success": true,
  "currency": "AED",
  "tiers": [
    {
      "id": "free-trial",
      "name": "Free Trial",
      "price": 0,
      "priceFormatted": "Free",
      "currency": "AED",
      "duration": 7,
      "durationUnit": "days",
      "planGenerationQuota": 1,
      "features": [
        "1 nutrition plan generation",
        "7 days full access",
        "All app features included",
        "Shopping list generation"
      ],
      "description": "Try Nufit free for 7 days",
      "eligibility": {
        "requiresNoTrialHistory": true,
        "requiresNoActivePurchase": false
      }
    },
    {
      "id": "one-month",
      "name": "Monthly Subscription",
      "price": 300,
      "priceFormatted": "300 AED",
      "currency": "AED",
      "duration": 1,
      "durationUnit": "months",
      "planGenerationQuota": 4,
      "features": [
        "4 nutrition plan generations per month",
        "Continuous access",
        "All app features included",
        "Shopping list generation",
        "Priority support"
      ],
      "description": "Perfect for committed users",
      "popular": false
    },
    {
      "id": "three-month",
      "name": "Quarterly Subscription",
      "price": 750,
      "priceFormatted": "750 AED",
      "currency": "AED",
      "duration": 3,
      "durationUnit": "months",
      "planGenerationQuota": 12,
      "features": [
        "12 nutrition plan generations (4 per month)",
        "Best value - 16.7% savings",
        "Continuous access",
        "All app features included",
        "Shopping list generation",
        "Priority support"
      ],
      "description": "Best value for long-term success",
      "popular": true,
      "savings": {
        "compared": "one-month",
        "savingsAmount": 150,
        "savingsPercentage": 16.67
      }
    }
  ]
}
```

**Response (Authenticated - includes userStatus):**
```json
{
  "success": true,
  "currency": "AED",
  "tiers": [...],
  "userStatus": {
    "currentTier": "one-month",
    "currentStatus": "active",
    "daysRemaining": 15,
    "expiresAt": "2026-07-10T00:00:00.000Z",
    "canStartFreeTrial": false,
    "hasEverUsedTrial": true,
    "isCurrentlyInTrial": false,
    "quotaRemaining": 2,
    "hasActiveSubscription": true
  }
}
```

---

#### POST /users/register
Register new user (Phase 1/5).

**Required (all fields required):**
- `name` - Full name
- `email` - Email address
- `password` - Password (min 6 chars)
- `mobile` - Phone number
- `address` - Address

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "mobile": "+1234567890",
  "address": "123 Main St"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully (Phase 1/5)",
  "userId": "abc123xyz...",
  "email": "john@example.com",
  "registrationProgress": {
    "basicInfo": true,
    "dietInfo": false,
    "healthInfo": false,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  },
  "schema": {
    "name": { "type": "string", "required": true },
    "email": { "type": "string", "required": true },
    "password": { "type": "string", "required": true, "description": "Min 6 characters" },
    "mobile": { "type": "string", "required": true },
    "address": { "type": "string", "required": true }
  }
}
```

---

#### POST /users/login
Login and get authentication token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "customToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6I...",
  "userId": "abc123xyz...",
  "email": "john@example.com"
}
```

---

#### POST /users/forgot-password
Request a password reset email. Firebase sends a secure reset link to the user's email.

**Required:**
- `email`: User's registered email address

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent successfully",
  "email": "john@example.com",
  "instructions": "Check your email for a password reset link. The link expires in 1 hour.",
  "next_steps": [
    "Check your email (including spam folder)",
    "Click the reset link in the email",
    "Enter your new password",
    "Sign in with your new password"
  ]
}
```

**Error Responses:**
```json
{
  "error": "Invalid email format",
  "message": "Please provide a valid email address"
}
```

**Note:** For security, the API does not reveal whether an email exists in the system.

---

#### POST /users/reset-password
Complete password reset using the code from the reset email. This endpoint validates the reset code and sets a new password.

> **Note:** All invalid, expired, or malformed reset codes return HTTP `400`. Only a disabled account returns HTTP `403`. No server error (500) is returned for client-side code problems.

**Required:**
- `oobCode`: The reset code from the password reset email link (from `?oobCode=xxx`)
- `newPassword`: New password (minimum 6 characters)

**Request:**
```json
{
  "oobCode": "AEdPqk7y-XYzAbCdEfGhIjKlMnOpQrStUvWxYz",
  "newPassword": "NewSecurePass456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "email": "john@example.com",
  "next_steps": "You can now sign in with your new password"
}
```

**Error Responses:**
```json
{
  "error": "Invalid or expired reset code",
  "message": "The password reset link has expired or is invalid. Please request a new one.",
  "next_steps": "Use /users/forgot-password to request a new reset link"
}
```

---

#### PUT /users/:userId/change-password
Change password for an authenticated user. Requires a valid Firebase auth token.

**Authentication:** Required (Bearer token)

**Required:**
- `newPassword`: New password (minimum 6 characters)

**Request:**
```json
{
  "newPassword": "AnotherSecurePass789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "userId": "abc123xyz...",
  "next_steps": "You may need to sign in again with your new password"
}
```

---

### PROTECTED ENDPOINTS (Auth Required)

#### GET /users/:userId/profile
Get user profile.

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "abc123xyz...",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+1234567890",
    "address": "123 Main St",
    "age": 28,
    "gender": "male",
    "height": 180,
    "weight": 75,
    "registrationComplete": false,
    "registrationSteps": {...}
  }
}
```

---

#### PUT /users/:userId/profile
Update profile fields.

**Optional fields:**
- `name`, `mobile`, `address`, `gender`, `sleepDuration`, `waterIntake`, `mealsPerDay`

**Request:**
```json
{
  "mobile": "+1-555-0123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "updatedFields": ["mobile"],
  "updatedData": {"mobile": "+1-555-0123"}
}
```

---

#### PUT /users/:userId/diet-information
Update diet preferences (Phase 2/5).

**Required:**
- `goal` - `lose weight`, `gain muscle`, or `maintain`

**Optional (all must be arrays if provided):**
- `preference` - **ARRAY**: `["vegetarian", "gluten-free"]`
- `allergies` - **ARRAY**: `["peanuts", "shellfish"]`
- `waterIntake` - Liters (0-10)
- `foodPreference` - **ARRAY**: `["organic", "local", "non-GMO"]`
- `useSupplements` - Boolean
- `supplementIntake` - **ARRAY**: `["protein powder", "vitamins"]`
- `mealsPerDay` - 1-8
- `preferredEatingTimes` - **ARRAY**: `["08:00", "12:00", "18:00"]`
- `snackHabits` - **ARRAY**: `["nuts", "fruits", "yogurt"]`
- `foodDislikes` - **ARRAY**: `["spicy foods", "mushrooms"]`
- `willingness` - **ARRAY**: `["reduce sugar", "eat more vegetables"]`

**Request:**
```json
{
  "goal": "lose weight",
  "preference": ["vegetarian"],
  "allergies": ["peanuts", "shellfish"],
  "foodPreference": ["organic", "local"],
  "supplementIntake": ["protein powder"],
  "preferredEatingTimes": ["08:00", "12:00", "18:00"],
  "snackHabits": ["fruits", "nuts"],
  "foodDislikes": ["spicy foods"],
  "willingness": ["reduce sugar", "eat more vegetables"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Diet information updated successfully (Phase 2/5)",
  "registrationProgress": {...},
  "schema": {...}
}
```

**IMPORTANT:** Array fields MUST be arrays:
- ✅ `allergies: ["peanuts", "shellfish"]`
- ✅ `preference: ["vegetarian"]` 
- ❌ `allergies: "peanuts, shellfish"`
- ❌ `preference: "vegetarian"`

---

#### PUT /users/:userId/health-information
Update health info (Phase 3/5).

**Required for nutrition plan generation:**
- `age` - 18-120
- `gender` - `male` or `female`
- `height` - 100-250 cm
- `weight` - 30-300 kg

**Optional:**
- `medicalConditions` - **ARRAY**: `["diabetes", "hypertension"]`
- `allergies` - **ARRAY**: `["penicillin"]` (drug allergies)
- `smokingHabit` - `non-smoker`, `occasional`, `regular`
- `sleepDuration` - 0-24 hours
- `stressLevel` - `low`, `moderate`, `high`
- `pastInjuries` - **ARRAY**: `["knee injury in 2020"]`
- `medications` - **ARRAY**: `["metformin", "aspirin"]`
- `currentAlcohol` - `none`, `occasional`, `moderate`, `frequent`
- `lastAlcohol` - ISO date (YYYY-MM-DD)
- `otherIssues` - String

**Request:**
```json
{
  "age": 28,
  "gender": "male",
  "height": 180,
  "weight": 75,
  "medicalConditions": [],
  "medications": [],
  "smokingHabit": "non-smoker",
  "sleepDuration": 7.5,
  "stressLevel": "moderate",
  "currentAlcohol": "occasional"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Health information updated successfully (Phase 3/5)",
  "registrationProgress": {...},
  "schema": {...}
}
```

---

#### PUT /users/:userId/exercise-preference
Update exercise preferences (Phase 4/5).

**Optional:**
- `fitnessGoal` - Fitness goal
- `workoutFrequency` - 1-7 times/week
- `workoutPreferredTime` - `morning`, `afternoon`, `evening`
- `workoutSetting` - `gym`, `home`, `park`, `pool`
- `workoutPreferredType` - **ARRAY**: `["cardio", "strength", "yoga"]`
- `workoutDuration` - Minutes per session
- `equipmentAccess` - **ARRAY**: `["dumbbells", "treadmill", "yoga mat"]`
- `workoutNotification` - Boolean

**Request:**
```json
{
  "fitnessGoal": "lose weight",
  "workoutFrequency": 4,
  "workoutPreferredTime": "morning",
  "workoutPreferredType": ["cardio", "strength"],
  "workoutDuration": 60,
  "equipmentAccess": ["treadmill", "dumbbells"],
  "workoutNotification": true
}
```

**IMPORTANT:** Array fields MUST be arrays:
- ✅ `workoutPreferredType: ["cardio", "strength"]`
- ✅ `equipmentAccess: ["dumbbells", "treadmill"]`
- ❌ `workoutPreferredType: "cardio, strength"`
- ❌ `equipmentAccess: "dumbbells"`

---

#### PUT /users/:userId/weekly-exercise
Update weekly exercise (Phase 5/5 - Final).

**Required:**
- `weeklyActivity` - Object with days as keys

**Structure:**
```json
{
  "weeklyActivity": {
    "Monday": {"activityName": "Running", "duration": 45, "calories": 400},
    "Tuesday": {"activityName": "Rest", "duration": 0, "calories": 0},
    "Wednesday": {"activityName": "Gym", "duration": 60, "calories": 350},
    "Thursday": {"activityName": "Rest", "duration": 0, "calories": 0},
    "Friday": {"activityName": "Swimming", "duration": 30, "calories": 300},
    "Saturday": {"activityName": "Cycling", "duration": 90, "calories": 500},
    "Sunday": {"activityName": "Yoga", "duration": 45, "calories": 150}
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Weekly exercise schedule updated successfully. Registration complete!",
  "registrationComplete": true,
  "totalWeeklyCalories": 2100
}
```

---

#### POST /users/:userId/generate-nutrition-plan
Generate 7-day personalized nutrition plan.

**Requirements:**
- All 5 registration phases complete
- age, gender, height, weight must be set
- Can only generate once per 7 days

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Nutrition plan generated successfully",
  "planId": "plan_abc123xyz...",
  "plan": {
    "active": true,
    "planStartDate": "2026-01-17T00:00:00.000Z",
    "planEndDate": "2026-01-24T00:00:00.000Z",
    "dailyTargetDetails": {
      "Monday": {
        "calories": 1800,
        "proteinGrams": 180,
        "carbsGrams": 225,
        "fatGrams": 50
      }
    },
    "days": {
      "Monday": {
        "breakfast": {...},
        "lunch": {...},
        "dinner": {...},
        "snack": {...}
      }
    }
  }
}
```

---

#### GET /users/:userId/nutrition-plans
Get user's nutrition plans with pagination. Returns all plans sorted by most recent first.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `limit` (optional): Number of plans per page (default: 10, max: 100)
- `offset` (optional): Number of plans to skip for pagination (default: 0)

**Example:**
```
GET /users/abc123xyz/nutrition-plans?limit=10&offset=0
```

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "plan_abc123xyz...",
      "active": true,
      "planStartDate": "2026-01-17T00:00:00.000Z",
      "generatedAt": "2026-01-17T10:30:00.000Z",
      "days": {
        "day1": {...},
        "day2": {...}
      }
    },
    {
      "id": "plan_previous123...",
      "active": false,
      "planStartDate": "2026-01-10T00:00:00.000Z",
      "generatedAt": "2026-01-10T14:22:00.000Z",
      "days": {...}
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0,
  "hasMore": false,
  "message": "Showing 2 of 5 plans"
}
```

**Empty Response (No Plans):**
```json
{
  "success": true,
  "plans": [],
  "total": 0,
  "limit": 10,
  "offset": 0,
  "hasMore": false,
  "message": "No nutrition plans found. Please generate a nutrition plan first."
}
```

**Pagination Example:**
To get the next 10 plans:
```
GET /users/abc123xyz/nutrition-plans?limit=10&offset=10
```

---

#### POST /users/:userId/nutrition-plans/:planId/generate-shopping-list
Generate shopping list from plan.

**Response:**
```json
{
  "success": true,
  "message": "Shopping list generated successfully",
  "shoppingList": [
    {"item": "Chicken Breast", "quantity": "1.5 lbs", "category": "Meat & Poultry"},
    {"item": "Broccoli", "quantity": "2 heads", "category": "Produce (Fruits & Vegetables)"}
  ]
}
```

---

#### GET /users/:userId/nutrition-plans/:planId/shopping-list
Get existing shopping list.

**Response:**
```json
{
  "success": true,
  "shoppingList": {
    "generatedAt": "2026-01-17T10:30:00.000Z",
    "items": [...]
  }
}
```

---

#### GET /users/:userId/subscription
Get full subscription details for the authenticated user. Returns all subscription lifecycle information in a single call.

**Authentication:** Required (Bearer token). Users can only access their own subscription.

**Response:**
```json
{
  "success": true,
  "subscription": {
    "isActive": true,
    "status": "active",
    "tier": "one-month",
    "packageId": null,
    "stripeSubscriptionId": "sub_xxx",
    "stripeCustomerId": "cus_xxx"
  },
  "freeTrial": {
    "hasEverUsedTrial": false,
    "isCurrentlyInTrial": false,
    "startDate": null,
    "endDate": null,
    "daysRemaining": 0
  },
  "discountCode": {
    "hasUsedDiscount": false,
    "code": null,
    "discountPercentage": null,
    "usedDate": null
  },
  "dates": {
    "subscriptionStarted": "2026-05-01T00:00:00.000Z",
    "subscriptionEnds": "2026-06-01T00:00:00.000Z",
    "subscriptionCancelled": null,
    "currentPeriodEnd": "2026-06-01T00:00:00.000Z"
  },
  "flags": {
    "hasActiveSubscription": true,
    "isInFreeTrial": false,
    "hasValidAccess": true,
    "canStartFreeTrial": true
  }
}
```

> **Note:** `currentPeriodEnd` is always returned as an ISO date string regardless of how it is stored in Firestore (Timestamp object or Unix millisecond number). Clients do not need to handle raw Firestore Timestamp formats.

---

#### PUT /users/:userId/subscription
Update subscription.

**Optional:**
- `subscribed` - Boolean
- `subscriptionStatus` - `active`, `inactive`, `cancelled`, `expired`, `paused`
- `subscriptionTier` - Tier name
- `activateFreeTrial` - Boolean (starts 7-day trial)
- `discountCode` - String
- `discountPercentage` - 0-100
- `subscriptionStartDate` - ISO date
- `subscriptionEndDate` - ISO date

**Request:**
```json
{
  "activateFreeTrial": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Free trial activated successfully",
  "subscription": {
    "tier": "free-trial",
    "status": "active",
    "startDate": "2026-01-21T00:00:00.000Z",
    "endDate": "2026-01-28T00:00:00.000Z",
    "quotaRemaining": 1
  }
}
```

**Example - Update with Discount Code:**
```json
{
  "discountCode": "NEWYEAR20",
  "discountPercentage": 20
}
```

**Example - Activate Paid Subscription (typically called by payment webhook):**
```json
{
  "subscriptionTier": "one-month",
  "subscriptionStatus": "active"
}
```
> `subscriptionEndDate` and `planGenerationQuota` are **auto-calculated** from the tier definition when not provided. You may still pass them explicitly to override.

**Example - Activate Paid Subscription with explicit dates:**
```json
{
  "subscriptionTier": "one-month",
  "subscriptionStatus": "active",
  "subscriptionStartDate": "2026-06-10T00:00:00.000Z",
  "subscriptionEndDate": "2026-07-10T00:00:00.000Z"
}
```

---

### Subscription System: How It Works

#### Overview

The subscription system controls how many nutrition plans users can generate based on their subscription tier. Each tier has a defined quota that is automatically managed through middleware checks, scheduled functions, and database updates.

#### Subscription Tiers & Quotas

| Tier | Price | Duration | Quota | Reset |
|------|-------|----------|-------|-------|
| Free Trial | Free | 7 days | 1 plan | Never (one-time) |
| Monthly | 300 AED | 30 days | 4 plans | Every 30 days |
| Quarterly | 750 AED | 90 days | 12 plans | Every 30 days |

#### User Subscription Fields

Each user document in Firestore contains:

```javascript
{
  subscriptionTier: "one-month",           // Current tier
  subscriptionStatus: "active",            // active/inactive/expired
  subscriptionStartDate: "2026-01-21",     // When subscription started
  subscriptionEndDate: "2026-02-21",       // When it expires
  planGenerationQuota: 3,                  // Plans remaining this period
  lastPlanGeneratedAt: "2026-01-18",       // Last generation timestamp
  totalPlansGenerated: 1,                  // Lifetime counter
  
  freeTrial: {
    hasEverUsedTrial: false,               // Prevents multiple trials
    isCurrentlyInTrial: false              // Currently in trial period
  }
}
```

#### Plan Generation Flow

**1. User Request:** `POST /users/:userId/generate-nutrition-plan`

**2. Middleware Checks** (`verifyActiveSubscription`):
   - ✅ Subscription status must be `'active'`
   - ✅ Current date must be before `subscriptionEndDate`
   - ✅ `planGenerationQuota` must be > 0
   - ❌ If any check fails → `402 Payment Required` or `429 Quota Exceeded`

**3. Plan Generation:**
   - Generate the 7-day nutrition plan
   - Decrement `planGenerationQuota` by 1
   - Update `lastPlanGeneratedAt` timestamp
   - Increment `totalPlansGenerated` counter

**4. Response:**
```json
{
  "success": true,
  "planId": "plan_abc123",
  "quotaRemaining": 3,
  "subscriptionTier": "one-month"
}
```

#### Free Trial vs Paid Subscriptions

**Free Trial Activation:**
- User calls: `PUT /users/:userId/subscription` with `{ activateFreeTrial: true }`
- System checks: User hasn't used trial before
- Sets: `subscribed: true`, `subscriptionStatus: 'active'`, `subscriptionTier: 'free-trial'`, `subscriptionStartDate`, `subscriptionEndDate` (now + 7 days), `planGenerationQuota: 1`
- User can generate **1 plan only**, quota never resets
- After 7 days, `scheduledExpireSubscriptions` sets `status = 'expired'` and `quota = 0`
- Plan generation is **manual** — the user chooses when to use their single credit

**Paid Subscription Activation:**
- Triggered by Stripe webhook after successful payment (or manually via the PUT endpoint during pre-launch)
- Sets: `quota = 4` (one-month) or `quota = 12` (three-month), calculates end date automatically if not provided
- If `subscriptionTier` + `subscriptionStatus: 'active'` are set without an explicit `subscriptionEndDate`, the system auto-calculates: one-month = +1 month, three-month = +3 months
- User can generate multiple plans across the subscription period, one per 7-day window
- **Unused quota credits are forfeited at expiry** — they do not carry over to a renewal
- Quota resets every 30 days on subscription anniversary (for monthly/quarterly tiers)

#### Automated Quota Management

**Quota Reset (3:00 AM UTC daily):**
```javascript
// scheduledResetQuotas function
// For each active subscription:
//   - Calculate days since subscription start
//   - If it's a 30-day anniversary (day 30, 60, 90...):
//     - Reset quota to tier default (4 or 12)
//   - Free trial: Skip (never resets)
```

**Subscription Expiry (2:00 AM UTC daily):**
```javascript
// scheduledExpireSubscriptions function
// Find subscriptions where endDate <= today:
//   - Set status to 'expired'
//   - Set quota to 0
//   - End free trial if active
```

#### Complete User Journey Example

**Day 1 - Sign Up & Free Trial:**
```
→ User registers
→ Calls: PUT /subscription { activateFreeTrial: true }
→ Gets: quota=1, status=active, endDate=Day 8
→ Generates 1 plan → quota=0
→ Tries again → 429 "Quota exceeded"
```

**Day 8 - Trial Expires:**
```
→ scheduledExpireSubscriptions runs at 2 AM
→ status=expired, quota=0
→ User blocked from generating plans
```

**Day 9 - Upgrade to Monthly:**
```
→ User pays 300 AED via Stripe
→ Webhook updates: tier=one-month, quota=4, endDate=Day 39
→ User can generate 4 plans
```

**Day 39 - Monthly Reset:**
```
→ scheduledResetQuotas runs at 3 AM
→ 30 days passed since Day 9
→ quota reset to 4
→ User can generate 4 more plans
```

**Day 69 - Second Reset:**
```
→ Another 30 days passed
→ quota reset to 4 again
```

**Day 109 - Subscription Expires:**
```
→ No payment renewal
→ scheduledExpireSubscriptions runs
→ status=expired, quota=0
→ User must renew to continue
```

#### API Error Responses

**No Active Subscription (402):**
```json
{
  "error": "No active subscription",
  "message": "Please activate a subscription or free trial to generate nutrition plans"
}
```

**Subscription Expired (402):**
```json
{
  "error": "Subscription expired",
  "expiresAt": "2026-01-28T00:00:00.000Z",
  "message": "Your subscription has expired. Please renew to continue."
}
```

**Quota Exceeded (429):**
```json
{
  "error": "Quota exceeded",
  "message": "You have used all your plan generations for this period",
  "quotaRemaining": 0,
  "nextResetDate": "2026-02-20T00:00:00.000Z"
}
```

---

#### POST /payments/create-checkout
Create Stripe checkout session.

**Required:**
- `email` - User email

**Optional:**
- `priceId` - Stripe price ID
- `successUrl` - Success redirect
- `cancelUrl` - Cancel redirect

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_live_abc123...",
  "sessionUrl": "https://checkout.stripe.com/pay/cs_live_abc123..."
}
```

---

#### POST /payments/cancel-subscription
Cancel subscription.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

---

#### GET /payments/subscription-status
Get subscription status.

**Response:**
```json
{
  "success": true,
  "subscribed": false,
  "subscriptionId": null,
  "currentPeriodEnd": null,
  "stripeCustomerId": null
}
```

---

#### POST /recipes/search (API Key Required)
Advanced recipe search.

**Headers:**
```
x-api-key: your-api-key-here
```

**Optional:**
- `mealTypes` - Array: `["breakfast", "lunch"]`
- `maxCalories` - Number
- `minCalories` - Number
- `allergies` - Array: `["peanuts"]`
- `limit` - Max 50

**Request:**
```json
{
  "mealTypes": ["breakfast"],
  "maxCalories": 600,
  "minCalories": 300,
  "allergies": ["peanuts"]
}
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "recipes": [...]
}
```

---

## Complete Field Reference

### ALL ARRAY FIELDS (Must be arrays)

These fields **MUST ALWAYS** be provided as arrays, never strings:

| Field | Phase | Type | Example | Required |
|-------|-------|------|---------|----------|
| `allergies` | 2 (Diet) | array[string] | `["peanuts", "shellfish"]` | No |
| `supplementIntake` | 2 (Diet) | array[string] | `["protein powder", "vitamins"]` | No |
| `preferredEatingTimes` | 2 (Diet) | array[string] | `["08:00", "12:00", "18:00"]` | No |
| `foodDislikes` | 2 (Diet) | array[string] | `["spicy foods", "mushrooms"]` | No |
| `medicalConditions` | 3 (Health) | array[string] | `["diabetes", "hypertension"]` | No |
| `allergies` | 3 (Health) | array[string] | `["penicillin"]` | No |
| `pastInjuries` | 3 (Health) | array[string] | `["knee injury in 2020"]` | No |
| `medications` | 3 (Health) | array[string] | `["metformin", "aspirin"]` | No |

---

### Phase 1: Basic Information
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | User's full name |
| `email` | string | ✓ | Email address |
| `password` | string | ✓ | Min 6 characters |
| `mobile` | string | ✓ | Phone number |
| `address` | string | ✓ | User address |

---

### Phase 2: Diet Information
| Field | Type | Required | Format |
|-------|------|----------|--------|
| `goal` | string | ✓ | `lose weight`, `gain muscle`, `maintain` |
| `preference` | array | - | `["vegetarian", "gluten-free"]` |
| `allergies` | array | - | `["peanuts", "shellfish"]` |
| `waterIntake` | number | - | 0-10 liters |
| `foodPreference` | array | - | `["organic", "local"]` |
| `useSupplements` | boolean | - | Uses supplements? |
| `supplementIntake` | array | - | `["protein powder", "vitamins"]` |
| `mealsPerDay` | number | - | 1-8 |
| `preferredEatingTimes` | array | - | `["08:00", "12:00", "18:00"]` |
| `snackHabits` | array | - | `["nuts", "fruits", "yogurt"]` |
| `foodDislikes` | array | - | `["spicy foods", "mushrooms"]` |
| `willingness` | array | - | `["reduce sugar", "eat more vegetables"]` |

---

### Phase 3: Health Information
| Field | Type | Required* | Format |
|-------|------|-----------|--------|
| `age` | number | ✓* | 18-120 |
| `gender` | string | ✓* | `male`, `female` |
| `height` | number | ✓* | 100-250 cm |
| `weight` | number | ✓* | 30-300 kg |
| `medicalConditions` | array | - | `["item1", "item2"]` |
| `allergies` | array | - | `["item1", "item2"]` |
| `smokingHabit` | string | - | `non-smoker`, `occasional`, `regular` |
| `sleepDuration` | number | - | 0-24 hours |
| `stressLevel` | string | - | `low`, `moderate`, `high` |
| `pastInjuries` | array | - | `["item1", "item2"]` |
| `medications` | array | - | `["item1", "item2"]` |
| `currentAlcohol` | string | - | `none`, `occasional`, `moderate`, `frequent` |
| `lastAlcohol` | string | - | YYYY-MM-DD |
| `otherIssues` | string | - | Text |

*Required for nutrition plan generation

---

### Phase 4: Exercise Preferences
| Field | Type | Format | Description |
|-------|------|--------|-------------|
| `fitnessGoal` | string | Single value | Fitness goal |
| `workoutFrequency` | number | Single value | 1-7 times/week |
| `workoutPreferredTime` | string | Single value | `morning`, `afternoon`, `evening` |
| `workoutSetting` | string | Single value | `gym`, `home`, `park`, `pool` |
| `workoutPreferredType` | array | `["cardio", "strength"]` | Exercise types |
| `workoutDuration` | number | Single value | Minutes per session |
| `equipmentAccess` | array | `["dumbbells", "treadmill"]` | Equipment available |
| `workoutNotification` | boolean | Single value | Send reminders? |

---

### Phase 5: Weekly Exercise
| Field | Type | Description |
|-------|------|-------------|
| `weeklyActivity` | object | Activity by day |
| `weeklyActivity.[Day]` | object | Day's activity |
| `weeklyActivity.[Day].activityName` | string | Activity name |
| `weeklyActivity.[Day].duration` | number | 0-300 minutes |
| `weeklyActivity.[Day].calories` | number | 0-2000 calories |

---

## Response Schema

All responses include schema definitions:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ },
  "schema": {
    "fieldName": {
      "type": "string | number | boolean | array",
      "required": true | false,
      "description": "Field description",
      "format": "format if applicable",
      "range": "range if applicable",
      "enum": ["value1", "value2"],
      "itemType": "array item type",
      "example": "example value"
    }
  }
}
```

---

## Error Codes

### 400 Bad Request
Invalid input or missing required fields.

```json
{
  "error": "Invalid field format",
  "message": "allergies must be an array",
  "hint": "Use format: [\"item1\", \"item2\"]",
  "arrayFields": ["allergies", "medicalConditions", "medications"],
  "schema": {...}
}
```

### 401 Unauthorized
Missing or invalid authentication.

### 403 Forbidden
Access denied or insufficient permissions.

### 404 Not Found
Resource not found.

### 409 Conflict
Resource already exists (e.g., email taken).

### 429 Too Many Requests
Rate limit exceeded or operation not allowed yet.

```json
{
  "error": "Rate limit exceeded",
  "message": "You can only generate one nutrition plan every 7 days",
  "nextAllowedAt": "2026-01-24T10:30:00.000Z",
  "daysRemaining": 7
}
```

### 500 Internal Server Error
Server-side error.

---

## Workflow Examples

### Complete 5-Phase Registration

```javascript
const userId = 'user_id_from_registration';
const token = 'firebase_id_token';

// Phase 1: Register (public, no auth needed)
await fetch('/users/register', {
  method: 'POST',
  body: JSON.stringify({name, email, password})
});

// Phases 2-5: Use auth token
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// Phase 2: Diet
await fetch(`/users/${userId}/diet-information`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    goal: 'lose weight',
    allergies: ['peanuts'],
    preferredEatingTimes: ['08:00', '12:00', '18:00']
  })
});

// Phase 3: Health
await fetch(`/users/${userId}/health-information`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    age: 28,
    gender: 'male',
    height: 180,
    weight: 75
  })
});

// Phase 4: Exercise Preference
await fetch(`/users/${userId}/exercise-preference`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    fitnessGoal: 'lose weight',
    workoutFrequency: 4
  })
});

// Phase 5: Weekly Exercise
await fetch(`/users/${userId}/weekly-exercise`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    weeklyActivity: {
      Monday: {activityName: 'Running', duration: 45, calories: 400},
      Tuesday: {activityName: 'Rest', duration: 0, calories: 0},
      // ... rest of week
    }
  })
});
```

---

## Important Notes

⚠️ **Field Names Are Frozen**
- All field names remain unchanged
- No modifications to field names permitted without explicit request
- Changes will be documented here with version bumps

⚠️ **Array Fields Must Be Arrays**
- Always use: `allergies: ["peanuts", "shellfish"]`
- Never use: `allergies: "peanuts, shellfish"`
- Never use: `allergies: "peanuts"`
- Response schema always includes array field definitions

📊 **Response Includes Schema**
- Every response includes field definitions
- Use schema for validation on your client
- Arrays always have `itemType` property

🔐 **Rate Limits**
- 100 requests per 15 minutes per IP
- Nutrition plan: once per 7 days per user
- All responses show remaining limits

---

## Support

**Issues or Questions?**  
Email: cshep1987@gmail.com

---

**Documentation Version:** 1.4.0  
**Last Updated:** January 21, 2026
