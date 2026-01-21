# Subscription Tiers Implementation Summary

**Date:** January 21, 2026  
**Status:** ✅ Complete - Ready for Testing

---

## What Was Implemented

### 1. **New Public Endpoint: GET /subscription/tiers**

**Purpose:** Returns available subscription plans with pricing in AED

**Features:**
- Public access (no authentication required)
- Optional authentication for personalized eligibility info
- Returns all 3 tiers: Free Trial, Monthly (300 AED), Quarterly (750 AED)

**Response includes:**
- Tier details (name, price, duration, quota for nutrition plan generations)
- Feature lists for each tier
- Savings calculation (quarterly vs monthly)
- User-specific eligibility (if authenticated)

---

### 2. **Updated Endpoint: GET /users/:userId/subscription**

**Enhanced to include:**
- Subscription start and end dates
- Quota information (remaining, total, last used)
- Enhanced free trial status
- Better eligibility flags

---

### 3. **Updated Endpoint: PUT /users/:userId/subscription**

**New capabilities:**
- Free trial activation with automatic date calculation
- Subscription tier management (one-month, three-month)
- Discount code application
- Automatic quota assignment based on tier
- Prevents mid-subscription tier switching
- Enforces free trial eligibility rules

---

### 4. **Subscription Tier Constants**

Defined in `api-routes.js`:

| Tier ID | Name | Price | Duration | Quota | Description |
|---------|------|-------|----------|-------|-------------|
| `free-trial` | Free Trial | Free | 7 days | 1 plan | One-time trial for new users |
| `one-month` | Monthly | 300 AED | 1 month | 4 plans | Standard monthly subscription |
| `three-month` | Quarterly | 750 AED | 3 months | 12 plans | Best value (16.7% savings) |

---

### 5. **Helper Functions**

#### `calculateSubscriptionEndDate(tierId, startDate)`
- Automatically calculates end date based on tier duration
- Handles days and months properly

#### `checkFreeTrialEligibility(userData)`
- Validates if user can start free trial
- Checks trial history and active subscription status

#### `expireSubscriptions()` ⚠️ **Needs Scheduled Function**
- Checks and expires subscriptions past end date
- Should run daily via Cloud Scheduler

#### `resetQuotasOnAnniversary()` ⚠️ **Needs Scheduled Function**
- Resets quotas on subscription anniversary (every 30 days)
- Should run daily via Cloud Scheduler

---

## Business Logic Implemented

### Free Trial Rules ✅
- Available only once per user
- Cannot activate if already has active subscription
- 7 days duration, 1 plan generation quota
- Tracked via `freeTrial.hasEverUsedTrial` field

### Subscription Management ✅
- Start and end dates automatically calculated
- Status tracked: `active`, `inactive`, `expired`, `cancelled`, `paused`
- Quota assigned based on tier at activation

### No Mid-Subscription Switching ✅
- Users cannot change tiers while subscription is active
- Must wait for expiration before switching
- Enforced in PUT endpoint validation

### Quota Reset on Anniversary ✅
- Monthly subscriptions: Reset every 30 days from start date
- Quarterly subscriptions: Reset every 30 days (4 per month)
- Free trial: No reset (one-time quota)

### Discount Codes ✅
- Tracked per user in `discountCode` object
- Percentage stored for pricing calculations
- Applied via PUT /subscription endpoint

---

## Data Structure

### User Document Fields (All Existing Field Names Preserved)

```javascript
{
  // Existing fields (unchanged)
  subscribed: false,                    // Legacy boolean
  subscriptionStatus: 'inactive',       // 'active', 'inactive', 'expired', 'cancelled', 'paused'
  subscriptionTier: null,               // 'free-trial', 'one-month', 'three-month'
  
  // Date tracking (now automatically set)
  subscriptionStartDate: null,          // ISO date or Firestore Timestamp
  subscriptionEndDate: null,            // ISO date or Firestore Timestamp
  
  // Nested subscription object
  subscription: {
    isActive: false,
    status: 'inactive',
    tier: null
  },
  
  // Free trial tracking
  freeTrial: {
    hasEverUsedTrial: false,            // Prevents re-use
    isCurrentlyInTrial: false,
    daysRemaining: 0
  },
  
  // Discount tracking
  discountCode: {
    hasUsedDiscount: false,
    code: null,
    discountPercentage: null
  },
  
  // Quota management
  planGenerationQuota: 0,               // Remaining quota
  lastPlanGeneratedAt: null,            // Last usage timestamp
  totalPlansGenerated: 0                // Lifetime counter
}
```

---

## API Endpoints Summary

### Public Endpoints
- ✅ `GET /subscription/tiers` - Get pricing tiers (new)

### Protected Endpoints (Auth Required)
- ✅ `GET /users/:userId/subscription` - Get subscription details (updated)
- ✅ `PUT /users/:userId/subscription` - Update subscription (updated)

### Existing Payment Endpoints (Unchanged)
- `POST /payments/create-checkout` - Create Stripe session
- `POST /payments/cancel-subscription` - Cancel subscription
- `GET /payments/subscription-status` - Get Stripe status

---

## Workflow Examples

### New User → Free Trial → Monthly Subscription

```javascript
// 1. User registers
POST /users/register
Response: { userId: "abc123", ... }

// 2. User checks available tiers
GET /subscription/tiers
Response: { tiers: [...], userStatus: { canStartFreeTrial: true } }

// 3. User activates free trial
PUT /users/abc123/subscription
Body: { "activateFreeTrial": true }
Response: {
  subscription: {
    tier: "free-trial",
    status: "active",
    startDate: "2026-01-21",
    endDate: "2026-01-28",
    quotaRemaining: 1
  }
}

// 4. Free trial expires automatically (scheduled function)
// subscriptionStatus → "expired"
// subscription.isActive → false
// planGenerationQuota → 0

// 5. User purchases monthly subscription
POST /payments/create-checkout
Body: { email: "user@example.com", priceId: "price_monthly_300_aed" }
Response: { sessionUrl: "https://checkout.stripe.com/..." }

// 6. After payment, webhook updates subscription
PUT /users/abc123/subscription
Body: {
  subscriptionTier: "one-month",
  subscriptionStatus: "active",
  subscriptionStartDate: "2026-01-29",
  subscriptionEndDate: "2026-02-28"
}
Response: {
  subscription: {
    tier: "one-month",
    status: "active",
    quotaRemaining: 4
  }
}
```

---

## Integration Points

### Stripe Integration
When creating Stripe checkout sessions, use tier pricing:
```javascript
const tier = SUBSCRIPTION_TIERS['one-month'];
const discountedPrice = tier.price * (1 - (discountPercentage / 100));

// Create Stripe Price or use existing Price ID
// Pass to checkout session
```

### Stripe Webhook
When payment succeeds, update user subscription:
```javascript
PUT /users/:userId/subscription
{
  subscriptionTier: "one-month",
  subscriptionStatus: "active"
  // Dates will be calculated automatically
}
```

---

## Next Steps Required

### 1. Set Up Scheduled Functions ⚠️ **REQUIRED**

Add to `index.js`:

```javascript
const { expireSubscriptions, resetQuotasOnAnniversary } = require('./api-routes');

exports.scheduledExpireSubscriptions = functions.pubsub
  .schedule('0 2 * * *')  // Daily at 2 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    return await expireSubscriptions();
  });

exports.scheduledResetQuotas = functions.pubsub
  .schedule('0 3 * * *')  // Daily at 3 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    return await resetQuotasOnAnniversary();
  });
```

Deploy: `firebase deploy --only functions`

### 2. Create Stripe Products & Prices

Create in Stripe Dashboard:
- Product: "Nufit Monthly" → Price: 300 AED (recurring monthly)
- Product: "Nufit Quarterly" → Price: 750 AED (recurring every 3 months)

### 3. Update Payment Webhook

Ensure Stripe webhook handler updates subscription with:
- `subscriptionTier` (based on price ID)
- `subscriptionStatus: 'active'`
- Auto-calculates start/end dates

### 4. Test the Flow

1. Create test user
2. Call GET /subscription/tiers (verify tiers returned)
3. Activate free trial via PUT /subscription
4. Verify quota and dates set correctly
5. Test payment flow with Stripe test mode
6. Verify scheduled functions run properly

---

## Documentation Updated

✅ **API_DOCUMENTATION.md**
- Added GET /subscription/tiers endpoint
- Updated GET /users/:userId/subscription response
- Enhanced PUT /users/:userId/subscription examples

✅ **SUBSCRIPTION_EXPIRY_SETUP.md** (New)
- Complete guide for setting up scheduled functions
- Testing instructions
- Troubleshooting tips

---

## Files Modified

1. `api-routes.js` - Added tier constants, endpoints, and helper functions
2. `API_DOCUMENTATION.md` - Updated with new endpoint documentation
3. `SUBSCRIPTION_EXPIRY_SETUP.md` - Created setup guide (new file)

---

## Testing Checklist

- [ ] GET /subscription/tiers returns tiers (unauthenticated)
- [ ] GET /subscription/tiers returns user eligibility (authenticated)
- [ ] GET /users/:userId/subscription returns full subscription data
- [ ] PUT /users/:userId/subscription activates free trial
- [ ] Free trial eligibility check prevents duplicate trials
- [ ] PUT /users/:userId/subscription prevents mid-subscription switching
- [ ] Discount code application works correctly
- [ ] Subscription dates calculated correctly for each tier
- [ ] Quota assigned correctly based on tier
- [ ] Scheduled function expires subscriptions
- [ ] Scheduled function resets quotas on anniversary
- [ ] Payment webhook integration updates subscription correctly

---

## Pricing Summary

| Tier | Price (AED) | Duration | Plans | Monthly Cost | Savings |
|------|-------------|----------|-------|--------------|---------|
| Free Trial | 0 | 7 days | 1 | - | - |
| Monthly | 300 | 30 days | 4 | 300 | - |
| Quarterly | 750 | 90 days | 12 | 250 | 150 AED (16.7%) |

---

## Support

For questions or issues: cshep1987@gmail.com

**All field names preserved as requested ✓**  
**Discount codes: Option B (user document tracking) ✓**  
**Trial for new users only ✓**  
**No mid-subscription switching ✓**  
**Quota resets on anniversary ✓**
