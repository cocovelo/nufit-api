# Nufit Cloud Functions - API Setup

This project implements a hybrid API approach with both REST endpoints and Firebase Callable Functions.

**Version:** 1.4.0  
**Last Updated:** January 21, 2026

## 🔐 Important: GitHub Security Alert Response

**GitHub detected Firebase API keys in this repository - this is SAFE and intentional!**

The Firebase API keys in this documentation are **public configuration keys** that are meant to be included in client-side applications. They are NOT secret credentials.

### Why This is Safe:

1. **Firebase API Keys are not secret** - They identify your Firebase project to Google's servers
2. **Security comes from Firebase Security Rules** - Your data is protected by server-side rules  
3. **These keys are meant to be public** - Every mobile/web app includes them in client code
4. **Google's official guidance** - Firebase explicitly states these keys can be public

**Reference:** [Firebase: API Keys for Firebase are Different](https://firebase.google.com/docs/projects/api-keys#api-keys-for-firebase-are-different)

### What IS Secret (Not in this repo):

- ❌ Backend API Keys (format: `nf_...`) - These are sent privately to developers via email
- ❌ Service Account Keys (`serviceAccountKey.json`) - Never committed (in `.gitignore`)
- ❌ Stripe secret keys - Stored in Firebase environment config
- ❌ User passwords and auth tokens

## Architecture

### 🔵 Public REST API (`/api/v1/*`)
- Simple CRUD operations
- Public read access for recipes
- Rate-limited (100 requests/15 min per IP)
- API key required for advanced features
- Subscription tier pricing endpoint

### 🟢 Firebase Callable Functions
- Complex authenticated operations
- Automatic Firebase Auth integration
- Type-safe requests/responses
- Used for: nutrition planning, shopping lists, Stripe

### ⏰ Scheduled Functions
- **Subscription Expiry**: Daily at 2:00 AM UTC - automatically expires subscriptions
- **Quota Reset**: Daily at 3:00 AM UTC - resets monthly plan generation quotas
- Runs via Cloud Scheduler with Pub/Sub triggers

## Key Features

### Subscription Management (v1.4.0)
- **Three subscription tiers**: Free trial (7 days), Monthly (300 AED), Quarterly (750 AED)
- **Plan generation quotas**: 1, 4, and 12 plans respectively
- **Automated lifecycle**: Scheduled functions handle expiry and quota resets
- **Free trial eligibility**: Prevents multiple free trials per user
- **Public pricing endpoint**: `GET /subscription/tiers` for app display

### API Documentation
- **Complete REST API docs**: See `API_DOCUMENTATION.md`
- **Field reference**: All endpoints with request/response schemas
- **Workflow examples**: Step-by-step integration guides
- **Error codes**: Comprehensive error handling documentation

## Setup Instructions

### 1. Install Dependencies

```bash
cd nufit-data-collection
npm install
```

### 2. Configure Firebase

Ensure you have `firebase.json` in the parent directory with:

```json
{
  "functions": {
    "source": "nufit-data-collection",
    "runtime": "nodejs18"
  }
}
```

### 3. Set Environment Variables

```bash
# Set Stripe keys
firebase functions:config:set stripe.secret_key="sk_test_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."

# Set Gemini API key (for shopping list generation)
firebase functions:config:set gemini.api_key="your-gemini-api-key"

# Set parser auth key (for CSV processing)
firebase functions:config:set parser.auth_key="your-secret-key"
```

View current config:
```bash
firebase functions:config:get
```

### 4. Deploy Functions

Deploy all functions:
```bash
firebase deploy --only functions
```

Deploy specific function:
```bash
firebase deploy --only functions:api
firebase deploy --only functions:generateCalorieTargets
```

### 5. Test Locally (Optional)

```bash
# Start Firebase emulators
firebase emulators:start

# Functions will be available at:
# http://localhost:5001/nufit-67bf0/us-central1/api
```

## Managing API Keys

### Create an API Key

```bash
# Create a never-expiring API key (default)
node api-key-manager.js create "Developer Name" "email@example.com"

# Or create a key that expires in 2 years
node api-key-manager.js create "Developer Name" "email@example.com" 2
```

This will output:
```
✅ API Key Created Successfully!
═══════════════════════════════════════
Developer: Developer Name
Email: email@example.com
API Key: nf_a1b2c3d4e5f6...
Expires: Never (no expiration)
═══════════════════════════════════════
```

### List All API Keys

```bash
node api-key-manager.js list
```

### Revoke an API Key

```bash
node api-key-manager.js revoke nf_a1b2c3d4e5f6...
```

### Check API Key Stats

```bash
node api-key-manager.js stats nf_a1b2c3d4e5f6...
```

### Update Permissions

```bash
node api-key-manager.js permissions nf_abc123... read:recipes,search:recipes,read:users
```

### Set Key to Never Expire

```bash
node api-key-manager.js set-no-expiration nf_abc123...
```

## Available Functions

### Deployed Functions

After deployment, your functions will be available at:

```
https://us-central1-nufit-67bf0.cloudfunctions.net/
```

#### HTTP Functions (REST API)
- `api` - Main REST API entry point
  - `GET /v1/health` - Health check
  - `GET /v1/recipes/count` - Recipe counts
  - `GET /v1/recipes/:mealType` - List recipes
  - `GET /v1/recipes/:mealType/:recipeId` - Get recipe
  - `POST /v1/recipes/search` - Advanced search (requires API key)
  - `GET /v1/user/:userId/nutrition-plans` - User plans (requires auth + API key)

- `handleStripeWebhook` - Stripe webhook handler
- `countRecipes` - Legacy endpoint (deprecated, use `/api/v1/recipes/count`)
- `recipeDebuggerHttp` - Debug endpoint for recipe filtering
- `methodsIngredientsParser` - Batch recipe parsing

#### Callable Functions
- `generateCalorieTargets` - Generate 7-day nutrition plan
- `generateShoppingList` - Generate shopping list from plan
- `createStripeCheckout` - Create Stripe checkout session
- `cancelStripeSubscription` - Cancel user subscription

#### Storage Triggers
- `processCSVsToFirestore` - Auto-import CSVs to Firestore

## Testing the API

### Test Public Endpoints

```bash
# Health check
curl https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/health

# Get recipe counts
curl https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/count

# List breakfast recipes
curl "https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast?limit=5"

# Get specific recipe
curl https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/breakfast/RECIPE_ID
```

### Test Protected Endpoints (with API Key)

```bash
# Advanced search
curl -X POST https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "mealTypes": ["breakfast"],
    "maxCalories": 400,
    "minCalories": 200,
    "limit": 10
  }'
```

### Test Callable Functions

**JavaScript:**
```javascript
const functions = firebase.functions();

// Generate nutrition plan
const generatePlan = functions.httpsCallable('generateCalorieTargets');
const result = await generatePlan();
console.log(result.data.plan);

// Generate shopping list
const generateList = functions.httpsCallable('generateShoppingList');
const list = await generateList({
  userId: 'user-id',
  nutritionPlanId: 'plan-id'
});
console.log(list.data.shoppingList);
```

**Flutter:**
```dart
final callable = FirebaseFunctions.instance.httpsCallable('generateCalorieTargets');
final result = await callable.call();
print(result.data['plan']);
```

## Documentation

- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API endpoint reference
- **[COMPLETE_WORKFLOW.md](COMPLETE_WORKFLOW.md)** - End-to-end workflow examples with all required fields
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and migration guides
- **[API_FIELD_REFERENCE.md](API_FIELD_REFERENCE.md)** - Detailed field specifications for all endpoints
- **[QUICK_REFERENCE_DEVELOPER.md](QUICK_REFERENCE_DEVELOPER.md)** - Quick lookup guide for developers

## Project Structure

```
nufit-data-collection/
├── index.js                  # Main functions file
├── api-routes.js            # REST API routes and middleware
├── api-key-manager.js       # CLI tool for API key management
├── package.json             # Dependencies
├── API_DOCUMENTATION.md     # Complete API documentation
├── COMPLETE_WORKFLOW.md     # Full workflow examples
├── CHANGELOG.md             # Version history and changes
├── API_FIELD_REFERENCE.md   # Detailed field specifications
├── README.md               # This file
└── main.py                 # Python script for data download
```

## Monitoring

### View Logs

```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only api
```

### Cloud Console
- Functions: https://console.firebase.google.com/project/nufit-67bf0/functions
- Firestore: https://console.firebase.google.com/project/nufit-67bf0/firestore
- Cloud Scheduler: https://console.cloud.google.com/cloudscheduler?project=nufit-67bf0
- Cloud Logging: https://console.cloud.google.com/logs?project=nufit-67bf0

## Scheduled Functions

### Monitoring Scheduled Tasks

```bash
# View scheduled jobs
gcloud scheduler jobs list --project nufit-67bf0

# Manually trigger subscription expiry check
gcloud scheduler jobs run firebase-schedule-scheduledExpireSubscriptions-us-central1 --project nufit-67bf0

# Manually trigger quota reset
gcloud scheduler jobs run firebase-schedule-scheduledResetQuotas-us-central1 --project nufit-67bf0

# View logs for scheduled functions
gcloud logging read "resource.labels.function_name=scheduledExpireSubscriptions" --limit=10 --project nufit-67bf0
gcloud logging read "resource.labels.function_name=scheduledResetQuotas" --limit=10 --project nufit-67bf0
```

### Testing Scheduled Functions

```powershell
# Run the automated test script
.\test-scheduled-functions.ps1
```

See `SCHEDULED_FUNCTIONS_TEST_RESULTS.md` for detailed test documentation.

## Rate Limiting

Public endpoints are rate-limited to **100 requests per 15 minutes per IP**.

To adjust rate limits, edit `api-routes.js`:

```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // Time window
  max: 100,                   // Max requests
  message: { error: 'Too many requests' }
});
```

## Security Best Practices

1. **Never commit API keys or secrets** to version control
2. **Use environment variables** for configuration
3. **Validate all inputs** in your functions
4. **Implement proper CORS** (already configured)
5. **Monitor API usage** regularly via Firestore `apiKeys` collection
6. **Rotate API keys** periodically
7. **Set expiration dates** for API keys
8. **Use Firebase Auth** for user-specific operations

## Common Issues

### Issue: CORS errors
**Solution:** CORS is already configured in `api-routes.js`. Ensure you're including proper headers in requests.

### Issue: API key not working
**Solution:** Check if:
- Key is active: `node api-key-manager.js stats YOUR_KEY`
- Key hasn't expired
- Header name is correct: `x-api-key`

### Issue: Rate limit exceeded
**Solution:** Wait 15 minutes or contact admin to increase limits for your API key.

### Issue: Firebase Auth token invalid
**Solution:** Get a fresh token from Firebase Auth:
```javascript
const token = await firebase.auth().currentUser.getIdToken(true);
```

## Support

- **API Documentation:** See `API_DOCUMENTATION.md`
- **Firebase Console:** https://console.firebase.google.com/project/nufit-67bf0
- **Issues:** Create an issue in the repository

## License

Proprietary - Nufit 2025
