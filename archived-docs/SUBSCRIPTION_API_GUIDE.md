# Subscription Management API - Quick Reference

## Overview

Two new endpoints have been added for comprehensive subscription management:

- **GET** `/users/:userId/subscription` - Get all subscription details
- **PUT** `/users/:userId/subscription` - Update subscription information

Both endpoints require Firebase Authentication token.

## Endpoint 1: GET Subscription Details

### Request
```
GET /v1/users/{userId}/subscription
Headers:
  Authorization: Bearer {firebase_token}
```

### Response Structure
```json
{
  "success": true,
  
  "subscription": {
    "isActive": false,
    "status": "inactive",
    "tier": null,
    "packageId": null,
    "stripeSubscriptionId": null,
    "stripeCustomerId": null
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
    "subscriptionStarted": null,
    "subscriptionEnds": null,
    "subscriptionCancelled": null,
    "currentPeriodEnd": null
  },
  
  "flags": {
    "hasActiveSubscription": false,
    "isInFreeTrial": false,
    "hasValidAccess": false,
    "canStartFreeTrial": true
  }
}
```

### What Each Section Tells You

**subscription**: Current subscription state
- `isActive`: true if user has paid subscription
- `status`: "active", "inactive", "cancelled", "expired", or "paused"
- `tier`: Subscription level (e.g., "basic", "premium", "enterprise")
- `packageId`: Your internal package identifier

**freeTrial**: Free trial status
- `hasEverUsedTrial`: true if user has ever started a trial
- `isCurrentlyInTrial`: true if trial is active right now
- `startDate` / `endDate`: Trial period dates
- `daysRemaining`: Days left in current trial

**discountCode**: Discount information
- `hasUsedDiscount`: true if user has applied a discount code
- `code`: The discount code used (e.g., "NEWUSER2026")
- `discountPercentage`: Discount amount (0-100)
- `usedDate`: When the discount was applied

**dates**: Subscription lifecycle timestamps
- `subscriptionStarted`: When subscription first activated
- `subscriptionEnds`: When subscription will/did end
- `subscriptionCancelled`: When user cancelled (if applicable)
- `currentPeriodEnd`: Current billing period end (for recurring)

**flags**: Quick boolean checks
- `hasActiveSubscription`: Currently subscribed
- `isInFreeTrial`: Currently in free trial
- `hasValidAccess`: Has either subscription OR free trial
- `canStartFreeTrial`: Eligible to start free trial

---

## Endpoint 2: UPDATE Subscription

### Request
```
PUT /v1/users/{userId}/subscription
Headers:
  Authorization: Bearer {firebase_token}
  Content-Type: application/json
```

### Body Parameters (all optional)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `subscribed` | boolean | Active subscription status | `true` |
| `subscriptionStatus` | string | Status: "active", "inactive", "cancelled", "expired", "paused" | `"active"` |
| `subscriptionTier` | string | Subscription level | `"premium"` |
| `subscriptionPackageId` | string | Package identifier | `"pkg_premium_monthly"` |
| `activateFreeTrial` | boolean | Start 7-day free trial | `true` |
| `discountCode` | string | Discount code to apply | `"NEWUSER2026"` |
| `discountPercentage` | number | Discount amount (0-100) | `25` |
| `subscriptionStartDate` | string (ISO) | Manual start date | `"2026-01-10T00:00:00Z"` |
| `subscriptionEndDate` | string (ISO) | Manual end date | `"2026-02-10T00:00:00Z"` |

### Example Requests

#### 1. Activate Free Trial
```json
{
  "activateFreeTrial": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "updatedFields": ["hasUsedFreeTrial", "freeTrialStartDate", "freeTrialEndDate", "isInFreeTrial"],
  "subscription": {
    "isActive": false,
    "status": "inactive",
    "tier": null,
    "hasFreeTrial": true,
    "discountCode": null
  }
}
```

**Notes:**
- Free trial is automatically 7 days
- User can only use free trial once
- If already used, returns 400 error

---

#### 2. Apply Discount Code
```json
{
  "discountCode": "NEWUSER2026",
  "discountPercentage": 25
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "updatedFields": ["discountCode", "hasUsedDiscountCode", "discountCodeUsedDate", "discountPercentage"],
  "subscription": {
    "isActive": false,
    "status": "inactive",
    "tier": null,
    "hasFreeTrial": false,
    "discountCode": "NEWUSER2026"
  }
}
```

---

#### 3. Activate Paid Subscription
```json
{
  "subscribed": true,
  "subscriptionStatus": "active",
  "subscriptionTier": "premium",
  "subscriptionPackageId": "pkg_premium_monthly"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "updatedFields": ["subscribed", "subscriptionStartDate", "subscriptionStatus", "subscriptionTier", "subscriptionPackageId"],
  "subscription": {
    "isActive": true,
    "status": "active",
    "tier": "premium",
    "hasFreeTrial": false,
    "discountCode": null
  }
}
```

**Notes:**
- Sets `subscriptionStartDate` automatically if first activation
- Updates `subscriptionStatus` to "active"

---

#### 4. Cancel Subscription
```json
{
  "subscribed": false,
  "subscriptionStatus": "cancelled"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "updatedFields": ["subscribed", "subscriptionEndDate", "subscriptionStatus", "subscriptionCancelledDate"],
  "subscription": {
    "isActive": false,
    "status": "cancelled",
    "tier": "premium",
    "hasFreeTrial": false,
    "discountCode": null
  }
}
```

**Notes:**
- Sets `subscriptionEndDate` automatically
- Sets `subscriptionCancelledDate` when status is "cancelled"

---

## User Profile Fields

When a user registers, these subscription fields are automatically created:

```javascript
{
  // Basic subscription info
  "subscribed": false,
  "subscriptionPackageId": null,
  "subscriptionStatus": "inactive",
  "subscriptionTier": null,
  
  // Free trial tracking
  "hasUsedFreeTrial": false,
  "freeTrialStartDate": null,
  "freeTrialEndDate": null,
  "isInFreeTrial": false,
  
  // Subscription dates
  "subscriptionStartDate": null,
  "subscriptionEndDate": null,
  "subscriptionCancelledDate": null,
  
  // Discount codes
  "hasUsedDiscountCode": false,
  "discountCode": null,
  "discountCodeUsedDate": null,
  "discountPercentage": null
}
```

---

## Common Use Cases

### Check if User Has Access
```javascript
GET /v1/users/{userId}/subscription

// Check response.flags.hasValidAccess
// This is true if user has active subscription OR active free trial
```

### Offer Free Trial to New Users
```javascript
GET /v1/users/{userId}/subscription

// Check response.flags.canStartFreeTrial
// If true, user can start free trial
// If false, user has already used their trial
```

### Subscribe User After Free Trial Expires
```javascript
PUT /v1/users/{userId}/subscription
{
  "subscribed": true,
  "subscriptionStatus": "active",
  "subscriptionTier": "premium",
  "subscriptionPackageId": "pkg_premium_monthly"
}
```

### Track Discount Code Usage
```javascript
// Apply discount
PUT /v1/users/{userId}/subscription
{
  "discountCode": "NEWUSER2026",
  "discountPercentage": 25
}

// Later, check if used
GET /v1/users/{userId}/subscription
// response.discountCode.hasUsedDiscount will be true
// response.discountCode.code will show "NEWUSER2026"
```

---

## Error Responses

### Free Trial Already Used
```json
{
  "error": "Free trial already used",
  "message": "This user has already used their free trial period",
  "freeTrialUsedDate": "2026-01-10T12:00:00.000Z"
}
```

### Invalid Subscription Status
```json
{
  "error": "Invalid subscription status",
  "message": "Status must be one of: active, inactive, cancelled, expired, paused",
  "receivedValue": "invalid_status"
}
```

### Invalid Discount Percentage
```json
{
  "error": "Invalid discount percentage",
  "message": "Discount must be a number between 0 and 100",
  "receivedValue": 150
}
```

### Access Denied (Wrong User)
```json
{
  "error": "Access denied",
  "message": "You can only access your own subscription details"
}
```

### No Update Fields Provided
```json
{
  "error": "No update fields provided",
  "message": "Please provide at least one field to update",
  "availableFields": [
    "subscribed",
    "subscriptionStatus",
    "subscriptionTier",
    "subscriptionPackageId",
    "activateFreeTrial",
    "discountCode",
    "discountPercentage",
    "subscriptionStartDate",
    "subscriptionEndDate"
  ]
}
```

---

## Testing with Postman/cURL

### 1. Register a User
```bash
POST https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/register

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "TestPass123!",
  "mobile": "1234567890",
  "address": "123 Test St"
}

# Save the userId from response
```

### 2. Get Firebase Auth Token
```bash
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCGOLbxQYM0yOrwlJ0KSMGw0YvDAo7RqO0

{
  "email": "test@example.com",
  "password": "TestPass123!",
  "returnSecureToken": true
}

# Save the idToken from response
```

### 3. Get Subscription Details
```bash
GET https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/{userId}/subscription
Authorization: Bearer {idToken}
```

### 4. Activate Free Trial
```bash
PUT https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/users/{userId}/subscription
Authorization: Bearer {idToken}
Content-Type: application/json

{
  "activateFreeTrial": true
}
```

---

## Summary

These new endpoints provide complete subscription lifecycle management:

✅ **Track free trials** - 7-day trials, one per user, with automatic date tracking  
✅ **Manage subscriptions** - Activate, pause, cancel with full status tracking  
✅ **Handle discount codes** - Track code usage and discount percentages  
✅ **Monitor dates** - Automatic tracking of start, end, and cancellation dates  
✅ **Quick access checks** - Boolean flags for common authorization checks  
✅ **Flexible updates** - Modify any subscription field independently  
✅ **Comprehensive data** - Single endpoint returns all subscription information  

All data is automatically tracked and timestamped in the user's Firestore profile.
