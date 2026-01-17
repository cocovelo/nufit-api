# Changelog

All notable changes to the Nufit API are documented in this file.

## [1.3.0] - 2026-01-17

### Added - Subscription Management & Access Control
- **NEW FEATURE**: Subscription-based nutrition plan generation quota system
  - Plans are now gated behind active subscriptions or free trial
  - Three subscription tiers with different quotas:
    - `trial`: 1 nutrition plan generation
    - `one-month`: 4 nutrition plan generations per billing period
    - `three-month`: 12 nutrition plan generations per billing period
  
- **NEW MIDDLEWARE**: `verifyActiveSubscription`
  - Checks subscription status, expiry date, and remaining quota
  - Applied to `POST /users/:userId/generate-nutrition-plan`
  - Returns `402 Payment Required` if no active subscription or quota exceeded
  - Returns quota information in error responses
  
- **NEW MIDDLEWARE**: `verifySubscriptionForAccess`
  - Soft-blocks access to saved nutrition plans for expired subscriptions
  - Applied to `GET /users/:userId/nutrition-plans`
  - Preserves data but prevents access until subscription renewed
  
- **NEW ENDPOINT**: `POST /admin/plan-generation-reset`
  - Admin endpoint to reset plan generation quotas
  - Can reset single user or all users with active subscriptions
  - Supports filtering by subscription tier
  - Requires API Key authentication
  - Automatically sets quota based on user's subscription tier
  
- **NEW FIELDS** in user documents:
  - `planGenerationQuota`: Number of plans remaining in current period (default: 0)
  - `lastPlanGeneratedAt`: Timestamp of most recent plan generation
  - `totalPlansGenerated`: Lifetime counter of all plans generated

### Changed
- `POST /users/:userId/generate-nutrition-plan` now requires active subscription
  - Checks subscription status before allowing plan generation
  - Decrements `planGenerationQuota` after successful generation
  - Returns `quotaRemaining` and `subscriptionTier` in response
  - Returns `402 Payment Required` for inactive/expired subscriptions
  - Returns `429 Quota Exceeded` when quota depleted

- `GET /users/:userId/nutrition-plans` now requires active subscription
  - Blocks access to saved plans if subscription expired
  - Returns `402 Access Denied` for expired/inactive subscriptions
  - Existing 7-day cooldown between generations still applies

- Updated registration to initialize quota tracking fields
  - New users start with `planGenerationQuota: 0`
  - Must activate subscription or free trial to generate plans

### Migration Guide

**For existing users without subscriptions:**
```javascript
// Users created before v1.3.0 will have planGenerationQuota: 0
// To generate plans, users must now:
// 1. Start free trial, OR
// 2. Subscribe to a paid plan

// Free trial activation (7 days, 1 plan):
PUT /users/{userId}/subscription
{
  "subscriptionTier": "trial",
  "subscriptionStatus": "active",
  "freeTrialStartDate": "2026-01-17T00:00:00Z",
  "freeTrialEndDate": "2026-01-24T00:00:00Z",
  "planGenerationQuota": 1,
  "hasUsedFreeTrial": true,
  "isInFreeTrial": true
}

// Paid subscription activation (handled via Stripe webhook):
// Stripe checkout → webhook updates user with quota
```

**For administrators managing quotas:**
```javascript
// Reset quota for specific user
POST /admin/plan-generation-reset
Headers: { "x-api-key": "your-api-key" }
Body: { "userId": "user123" }

// Reset all one-month tier users
POST /admin/plan-generation-reset
Headers: { "x-api-key": "your-api-key" }
Body: { "tier": "one-month" }

// Reset all active subscriptions
POST /admin/plan-generation-reset
Headers: { "x-api-key": "your-api-key" }
Body: {}
```

**Expected response changes:**
```javascript
// Before (v1.2.0):
POST /users/{userId}/generate-nutrition-plan
Response: {
  success: true,
  planId: "plan123",
  plan: { ... }
}

// After (v1.3.0):
POST /users/{userId}/generate-nutrition-plan
Response: {
  success: true,
  planId: "plan123",
  plan: { ... },
  quotaRemaining: 3,           // NEW
  subscriptionTier: "one-month" // NEW
}

// Error when no subscription:
Response: 402 Payment Required {
  error: "Payment Required",
  message: "This feature requires an active subscription",
  subscriptionStatus: "inactive",
  hasUsedFreeTrial: false,
  canStartFreeTrial: true,
  suggestion: "Start your free trial to access this feature"
}

// Error when quota exceeded:
Response: 429 Quota Exceeded {
  error: "Quota Exceeded",
  message: "You have used all your nutrition plan generations for this billing period",
  currentQuota: 0,
  subscriptionTier: "one-month",
  suggestion: "Your quota will reset on your next billing date, or upgrade to a higher tier for more plans"
}
```

### Security
- Premium features now properly gated behind authentication AND subscription validation
- Quota tracking prevents abuse even with active subscription
- Admin endpoints require API key authentication

### Developer Notes
- Existing 7-day cooldown between plan generations remains active
- Subscription check happens BEFORE cooldown check
- Quota is decremented AFTER successful plan generation
- Failed generations do not consume quota
- GET endpoints use soft-blocking (data preserved, access blocked)
- POST endpoints require active subscription with available quota

---

## [1.2.0] - 2026-01-17

### Changed
- **BREAKING**: Registration endpoint (`POST /users/register`) now requires all five fields
  - `name` - Full name (required)
  - `email` - Email address (required)
  - `password` - Min 6 characters (required)
  - `mobile` - Phone number (required, previously optional)
  - `address` - Address (required, previously optional)
  - Updated error responses to clearly indicate all required fields

- **BREAKING**: Diet information endpoint (`PUT /users/:userId/diet-information`) array field changes
  - `preference` - Now accepts arrays only: `["vegetarian", "gluten-free"]` (was string)
  - `foodPreference` - Now accepts arrays only: `["organic", "local"]` (was string)
  - `snackHabits` - Now accepts arrays only: `["nuts", "fruits"]` (was string)
  - `willingness` - Now accepts arrays only: `["reduce sugar", "exercise more"]` (was string)
  - Existing array fields remain unchanged: `allergies`, `supplementIntake`, `preferredEatingTimes`, `foodDislikes`
  - API now validates these fields are arrays; strings will be rejected with clear error messages
  - Schema response explicitly defines these as array type

- **BREAKING**: Exercise preference endpoint (`PUT /users/:userId/exercise-preference`) array field changes
  - `workoutPreferredType` - Now accepts arrays only: `["cardio", "strength", "yoga"]` (was string)
  - `equipmentAccess` - Now accepts arrays only: `["dumbbells", "treadmill", "yoga mat"]` (was string)
  - API now validates these fields are arrays; strings will be rejected with clear error messages
  - Schema response explicitly defines these as array type

### Added
- Extended validation error messages for array field conversions in diet and exercise endpoints
- `arrayFields` hint in error responses showing which fields must be arrays
- Schema always included in error responses for quick reference

### Deprecated
- All string-based inputs for fields now defined as arrays (preference, foodPreference, snackHabits, willingness, workoutPreferredType, equipmentAccess)
- Clients must update to array format before next major version

### Migration Guide

**For clients using old registration flow (mobile/address optional):**
```javascript
// Before
const regResp = await fetch('/api/v1/users/register', {
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
    password: "SecurePass123"
    // mobile and address could be omitted
  })
});

// After - all five fields required
const regResp = await fetch('/api/v1/users/register', {
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
    password: "SecurePass123",
    mobile: "+1234567890",
    address: "123 Main St"
  })
});
```

**For clients using old diet-information field formats:**
```javascript
// Before
const dietResp = await fetch(`/api/v1/users/${userId}/diet-information`, {
  body: JSON.stringify({
    preference: "vegetarian",
    foodPreference: "healthy",
    snackHabits: "occasional",
    willingness: "very willing"
  })
});

// After - all must be arrays
const dietResp = await fetch(`/api/v1/users/${userId}/diet-information`, {
  body: JSON.stringify({
    preference: ["vegetarian"],
    foodPreference: ["organic", "local"],
    snackHabits: ["fruits", "nuts"],
    willingness: ["reduce sugar", "eat more vegetables"]
  })
});
```

**For clients using old exercise-preference field formats:**
```javascript
// Before
const exerciseResp = await fetch(`/api/v1/users/${userId}/exercise-preference`, {
  body: JSON.stringify({
    workoutPreferredType: "cardio",
    equipmentAccess: "full gym"
  })
});

// After - all must be arrays
const exerciseResp = await fetch(`/api/v1/users/${userId}/exercise-preference`, {
  body: JSON.stringify({
    workoutPreferredType: ["cardio", "strength"],
    equipmentAccess: ["treadmill", "dumbbells", "yoga mat"]
  })
});
```

## [1.1.0] - 2026-01-13

### Added
- Gender field support in Phase 3 (health-information endpoint)
- Age, height, weight fields now stored during registration for nutrition plan generation
- Debug logging for custom token creation (internal use)

### Changed
- **BREAKING**: Registration endpoint no longer returns custom tokens
  - Clients now use Firebase SDK directly for authentication (`signInWithEmailAndPassword`)
  - This aligns with production best practices and reduces unnecessary server operations
  - See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for updated authentication flow
- Removed custom token generation from registration handler
- Removed `/users/exchange-token/:customToken` endpoint from public API (still available for testing)
- Registration response now simpler: returns only `userId`, `email`, `nextStep`, and `registrationProgress`

### Fixed
- User profile demographics (age, height, weight) now properly stored for nutrition plan generation
- Gender field in health information now correctly stored in user profile
- All 5 registration phases now work with Firebase ID token authentication

### Migration Guide

**For existing clients using custom tokens:**

**Before (Old Flow):**
```javascript
// Register
const regResp = await fetch('/api/v1/users/register', { ... });
const { customToken } = await regResp.json();

// Exchange token
const exchangeResp = await fetch(`/api/v1/users/exchange-token/${customToken}`);
const { idToken } = await exchangeResp.json();

// Use idToken for authenticated calls
```

**After (New Flow - Firebase SDK):**
```javascript
// Register
const regResp = await fetch('/api/v1/users/register', { ... });
const { userId } = await regResp.json();

// Sign in with Firebase SDK
import { signInWithEmailAndPassword } from 'firebase/auth';
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const idToken = await userCredential.user.getIdToken();

// Use idToken for authenticated calls (same as before)
```

### Notes
- The custom token generation functionality remains in the codebase for potential future use but is not exposed in the registration endpoint
- All authenticated endpoints continue to accept Firebase ID tokens as before
- No changes required for clients already using Firebase SDK authentication

---

## [1.0.0] - 2025-12-15

### Initial Release
- User registration (Phase 1)
- Diet information (Phase 2)
- Health information (Phase 3)
- Exercise preference (Phase 4)
- Weekly exercise schedule (Phase 5)
- Nutrition plan generation
- Recipe search and retrieval
- Public health endpoints
