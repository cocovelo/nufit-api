# API Owner Guide: What to Give External Developers

## 📋 Summary: What Developers Need From YOU

| Item | Do You Provide? | How | When Needed |
|------|----------------|-----|-------------|
| **Firebase Config** | ✅ YES | Give them the `firebaseConfig` object | Always (Required) |
| **Auth Token** | ❌ NO | They generate it themselves after user login | Never (Auto-generated) |
| **Backend API Key** | 🟡 Optional | Only for advanced recipe search | Only if using `/recipes/search` |

---

## 1️⃣ Firebase Configuration (ALWAYS REQUIRED)

### What to Provide:

Give developers this configuration object:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA",
  authDomain: "nufit-67bf0.firebaseapp.com",
  projectId: "nufit-67bf0",
  storageBucket: "nufit-67bf0.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### How to Get It:

1. **Open Firebase Console:**
   ```
   https://console.firebase.google.com/project/nufit-67bf0/settings/general
   ```

2. **Scroll to "Your apps" section**

3. **If you see a Web app (</>):**
   - Click on the app name
   - Copy the `firebaseConfig` object
   - Skip to step 5

4. **If NO web app exists:**
   - Click "Add app" button
   - Choose "Web" (</> icon)
   - Give it a nickname (e.g., "Nufit Public API")
   - Click "Register app"
   - Copy the `firebaseConfig` object shown

5. **Your Firebase Configuration:**
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

6. **Send this to developers via:**
   - Email
   - Documentation
   - Developer portal
   - Slack/Discord

### Is This Secret?

**NO!** This Firebase config is **safe to share publicly**. It's meant to be included in client apps.

- ✅ Safe to share
- ✅ Safe to commit to GitHub
- ✅ Safe to include in app code
- ✅ Can be in public documentation

**Why it's safe:**
- Firebase has security rules that protect your data
- The API key in this config only allows Firebase SDK initialization
- Actual security comes from Firebase Auth tokens (which ARE secret)

---

## 2️⃣ Auth Tokens (NEVER PROVIDED BY YOU)

### What Are Auth Tokens?

Auth tokens prove that a user is logged in. Each user gets their own unique token.

### Do You Provide These?

**NO!** Here's why:

1. **Auto-generated:** Firebase creates these automatically when users log in
2. **User-specific:** Each user gets a different token
3. **Short-lived:** Tokens expire after 1 hour
4. **Secret:** Should never be shared

### How Developers Get Them:

```javascript
// Developer's code (you don't need to do anything)
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Initialize with YOUR firebase config
const app = initializeApp(firebaseConfig);  // Using config you provided
const auth = getAuth(app);

// User logs in
const userCredential = await signInWithEmailAndPassword(auth, email, password);

// Firebase automatically generates auth token
const token = await userCredential.user.getIdToken();  // ← This is the auth token
```

### Your Role:

✅ **You provide:** Firebase config  
❌ **You DON'T provide:** Auth tokens  
✅ **Developer gets:** Auth tokens automatically after login

---

## 3️⃣ Backend API Keys (OPTIONAL - Only for Advanced Features)

### What Are Backend API Keys?

These are separate from Firebase. They're for rate limiting and tracking which developer is calling your advanced endpoints.

### When Are They Needed?

**Only if developer wants to use:**
- Advanced recipe search: `POST /recipes/search`

**NOT needed for:**
- User registration
- Login
- Generating nutrition plans
- Creating shopping lists
- All other endpoints

### How to Create API Keys for Developers:

#### Step 1: Get Firebase Service Account Key

1. Go to: https://console.firebase.google.com/project/nufit-67bf0/settings/serviceaccounts
2. Click "Generate new private key"
3. Save as `serviceAccountKey.json` in your `functions/` folder
4. ⚠️ **NEVER commit this file to GitHub!**

#### Step 2: Create API Key for Developer

```bash
cd functions
node api-key-manager.js create "Developer Name" "developer@email.com"
```

**Example:**
```bash
node api-key-manager.js create "John Doe" "john@example.com"
```

**Output:**
```
✅ API Key Created Successfully!

════════════════════════════════════════════════════════════
Developer: John Doe
Email: john@example.com
API Key: nf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
Expires: 2026-11-11T12:00:00.000Z
════════════════════════════════════════════════════════════

⚠️  IMPORTANT: Save this API key securely. It will not be shown again.
```

#### Step 3: Send API Key to Developer

**Via secure channel:**
- Email (use encrypted email if possible)
- Password manager share
- Secure messaging (Signal, etc.)

**Tell them:**
```
Here's your API key for advanced features:

API Key: nf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
Expires: November 11, 2026

Use it in requests like this:
fetch(url, {
  headers: {
    'x-api-key': 'nf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
  }
});
```

### Managing API Keys:

#### List All Keys:
```bash
node api-key-manager.js list
```

#### Check Key Usage:
```bash
node api-key-manager.js stats nf_abc123...
```

#### Revoke a Key:
```bash
node api-key-manager.js revoke nf_abc123...
```

#### Update Permissions:
```bash
node api-key-manager.js permissions nf_abc123... read:recipes,search:recipes
```

---

## 🎯 Quick Start: Onboarding a New Developer

### Scenario 1: Basic Integration (Most Common)

**Developer wants:** User registration, nutrition plans, shopping lists

**You provide:**
1. ✅ Firebase configuration object
2. ✅ API base URL: `https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1`
3. ✅ Link to documentation: `API_QUICK_REFERENCE.md`

**Developer does NOT need:**
- ❌ Auth tokens (they get these automatically)
- ❌ Backend API keys (not needed for basic features)

**Email Template:**
```
Hi [Developer Name],

Welcome to Nufit API! Here's everything you need to get started:

📍 API Base URL:
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1

🔑 Firebase Configuration:
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

📚 Documentation:
- Quick Start: [link to API_QUICK_REFERENCE.md]
- Full Guide: [link to DEVELOPER_INTEGRATION_GUIDE.md]
- Example Code: [link to complete-workflow-demo.js]

Need help? Reply to this email or contact: chep1987@gmail.com

Happy coding!
```

---

### Scenario 2: Advanced Integration (With Recipe Search)

**Developer wants:** Everything + advanced recipe search

**You provide:**
1. ✅ Firebase configuration object
2. ✅ API base URL
3. ✅ Documentation links
4. ✅ Backend API key (generated with api-key-manager.js)

**Email template:**
```
Hi [Developer Name],

Welcome to Nufit API with advanced features! Here's your setup:

📍 API Base URL:
https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1

🔑 Firebase Configuration:
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

🔐 Backend API Key (for advanced search):
nf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
Expires: November 11, 2026

⚠️ Keep this API key secret! Don't commit to GitHub.

Use it like this:
fetch('https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1/recipes/search', {
  method: 'POST',
  headers: {
    'x-api-key': 'nf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'high protein' })
});

📚 Documentation:
- Quick Start: [link]
- Full Guide: [link]

Need help? Reply to this email.
```

---

## ❓ FAQ for API Owners

### Q: Can developers use the API without any keys?
**A:** Yes! Public endpoints (health check, recipe listing, registration) work without any authentication.

### Q: Do I need to create a Firebase account for each developer?
**A:** No! All developers use YOUR Firebase project. They just need your Firebase config.

### Q: Will developers be able to see other users' data?
**A:** No! Firebase security rules and your API code ensure users can only access their own data.

### Q: Should I keep Firebase API key secret?
**A:** No! The Firebase config (including apiKey) is meant to be public. Real security comes from:
- Firebase Auth tokens (auto-generated per user)
- Firestore security rules
- Your API authentication middleware

### Q: What if a developer's API key is compromised?
**A:** Revoke it immediately:
```bash
node api-key-manager.js revoke nf_abc123...
```
Then create a new one for them.

### Q: Can I limit what developers can do?
**A:** Yes! Use the permissions system:
```bash
node api-key-manager.js permissions nf_abc123... read:recipes
```

### Q: How do I track API usage?
**A:** Check stats:
```bash
node api-key-manager.js stats nf_abc123...
```

Or view in Firestore Console → `apiKeys` collection

---

## 🔒 Security Best Practices

### ✅ DO:
- Share Firebase config publicly (it's safe)
- Create separate backend API keys for each developer
- Set expiration dates on backend API keys (default: 1 year)
- Monitor API key usage regularly
- Revoke keys when developers leave or projects end
- Keep serviceAccountKey.json secret and never commit it

### ❌ DON'T:
- Share your service account key
- Share your .env file with Stripe/Gemini keys
- Give one API key to multiple developers (create one per developer)
- Let developers share their API keys
- Commit serviceAccountKey.json to GitHub

---

## 📊 Monitoring Developer Usage

### Check All Active Keys:
```bash
cd functions
node api-key-manager.js list
```

### Check Specific Developer:
```bash
node api-key-manager.js stats nf_abc123...
```

### View in Firestore Console:
1. Go to: https://console.firebase.google.com/project/nufit-67bf0/firestore
2. Open `apiKeys` collection
3. See all keys with usage stats

---

## 🆘 Need Help?

If you have questions about:
- Setting up developer access
- Creating API keys
- Security concerns
- API usage monitoring

Contact: chep1987@gmail.com
