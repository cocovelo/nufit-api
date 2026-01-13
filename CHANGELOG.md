# Changelog

All notable changes to the Nufit API are documented in this file.

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
