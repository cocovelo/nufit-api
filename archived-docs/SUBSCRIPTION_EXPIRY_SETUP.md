# Subscription Expiry & Quota Reset - Setup Guide

**Created:** January 21, 2026  
**Purpose:** Automate subscription expiration and quota resets

---

## Overview

Two automated tasks need to run periodically to manage subscriptions:

1. **Expire Subscriptions** - Check and expire subscriptions past their end date
2. **Reset Quotas** - Reset plan generation quotas on subscription anniversaries

---

## Setup Instructions

### Option 1: Cloud Scheduler + Cloud Functions (Recommended)

Add these scheduled functions to your `index.js`:

```javascript
const { expireSubscriptions, resetQuotasOnAnniversary } = require('./api-routes');

/**
 * Scheduled function to expire subscriptions
 * Runs daily at 2:00 AM UTC
 */
exports.scheduledExpireSubscriptions = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting scheduled subscription expiry check...');
    
    try {
      const result = await expireSubscriptions();
      console.log('Subscription expiry complete:', result);
      return result;
    } catch (error) {
      console.error('Error in scheduled subscription expiry:', error);
      throw error;
    }
  });

/**
 * Scheduled function to reset quotas
 * Runs daily at 3:00 AM UTC
 */
exports.scheduledResetQuotas = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting scheduled quota reset check...');
    
    try {
      const result = await resetQuotasOnAnniversary();
      console.log('Quota reset complete:', result);
      return result;
    } catch (error) {
      console.error('Error in scheduled quota reset:', error);
      throw error;
    }
  });
```

### Schedule Format (Cron)

- `0 2 * * *` - Every day at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Every day at midnight

---

## Manual Execution (For Testing)

### Using Firebase CLI

```bash
# Deploy the scheduled functions
firebase deploy --only functions:scheduledExpireSubscriptions,scheduledResetQuotas

# Manually trigger (requires emulator or direct call)
```

### Using Cloud Console

1. Go to Cloud Scheduler in GCP Console
2. Find the scheduled job
3. Click "Run Now"

---

## Testing Locally

Create a test script `test-subscription-expiry.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const { expireSubscriptions, resetQuotasOnAnniversary } = require('./api-routes');

async function testExpiry() {
  console.log('Testing subscription expiry...');
  const result = await expireSubscriptions();
  console.log('Result:', result);
}

async function testQuotaReset() {
  console.log('Testing quota reset...');
  const result = await resetQuotasOnAnniversary();
  console.log('Result:', result);
}

// Run tests
testExpiry()
  .then(() => testQuotaReset())
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
```

Run with: `node test-subscription-expiry.js`

---

## What Each Function Does

### `expireSubscriptions()`

**Runs:** Daily at 2:00 AM UTC

**Actions:**
- Queries all users with `subscriptionStatus: 'active'`
- Checks if `subscriptionEndDate <= currentDate`
- Updates expired subscriptions:
  - `subscriptionStatus` → `'expired'`
  - `subscription.isActive` → `false`
  - `subscribed` → `false`
  - `planGenerationQuota` → `0`
  - `freeTrial.isCurrentlyInTrial` → `false`

**Returns:**
```json
{
  "success": true,
  "expiredCount": 5,
  "timestamp": "2026-01-21T02:00:00.000Z"
}
```

---

### `resetQuotasOnAnniversary()`

**Runs:** Daily at 3:00 AM UTC

**Actions:**
- Queries all users with `subscriptionStatus: 'active'`
- Calculates days since `subscriptionStartDate`
- For monthly subscriptions (one-month, three-month):
  - Resets `planGenerationQuota` every 30 days
- Free trial quotas are NOT reset (one-time only)

**Returns:**
```json
{
  "success": true,
  "resetCount": 12,
  "timestamp": "2026-01-21T03:00:00.000Z"
}
```

---

## Monitoring

### Check Logs

```bash
# View function logs
firebase functions:log --only scheduledExpireSubscriptions
firebase functions:log --only scheduledResetQuotas

# Or in GCP Console
# Cloud Functions > Select function > Logs
```

### Expected Log Output

```
Starting scheduled subscription expiry check...
Expiring subscription for user abc123 (tier: free-trial)
Expiring subscription for user def456 (tier: one-month)
Successfully expired 2 subscriptions
Subscription expiry complete: { success: true, expiredCount: 2, ... }
```

---

## Important Notes

### Quota Reset Logic

- **Free Trial:** No quota reset (one-time 1 plan)
- **One-Month:** Resets to 4 every 30 days from start date
- **Three-Month:** Resets to 12 every 30 days (4 per month × 3 months)

### Time Zone Considerations

- All dates stored in Firestore are UTC
- Scheduled functions run in UTC
- User-facing dates should be converted to local time in the app

### Subscription End Date Calculation

When activating subscriptions:
- Free trial: `startDate + 7 days`
- One-month: `startDate + 1 month`
- Three-month: `startDate + 3 months`

### No Mid-Subscription Switching

The PUT endpoint prevents users from changing tiers while subscription is active. They must wait for expiration.

---

## Troubleshooting

### Subscriptions Not Expiring

**Check:**
1. Is the scheduled function deployed?
2. Are logs showing execution?
3. Is `subscriptionEndDate` properly set in Firestore?
4. Is the date comparison working (Timestamp vs Date)?

### Quotas Not Resetting

**Check:**
1. Is `subscriptionStartDate` set correctly?
2. Is the tier ID valid in SUBSCRIPTION_TIERS?
3. Are there error logs in the function execution?

### Deploy Errors

```bash
# Check function status
firebase functions:list

# Redeploy specific function
firebase deploy --only functions:scheduledExpireSubscriptions
```

---

## Future Enhancements

- [ ] Send email notifications before expiry (3 days, 1 day)
- [ ] Add analytics tracking for subscription metrics
- [ ] Implement grace period (1-2 days after expiry)
- [ ] Add Slack/Discord notifications for admin
- [ ] Support proration for mid-month upgrades

---

## Contact

For issues or questions: cshep1987@gmail.com
