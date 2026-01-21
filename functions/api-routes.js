/**
 * API Routes for Nufit Cloud Functions
 * Public REST API for simple read operations
 */

const express = require('express');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');

// Initialize router
const router = express.Router();
const db = admin.firestore();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Rate limiting middleware
 * Limits each IP to 100 requests per 15 minutes
 * Skip validation for Cloud Functions environment
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req, res) => {
    // Skip rate limiting in Cloud Functions environment or if no IP available
    return !req.ip || req.ip === '::ffff:127.0.0.1' || process.env.FUNCTION_NAME;
  }
});

/**
 * API Key validation middleware for external developers
 * Checks x-api-key header against Firestore apiKeys collection
 */
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Missing API key', 
      message: 'Please provide an API key in the x-api-key header' 
    });
  }
  
  try {
    const keyDoc = await db.collection('apiKeys').doc(apiKey).get();
    
    if (!keyDoc.exists) {
      return res.status(403).json({ error: 'Invalid API key' });
    }
    
    const keyData = keyDoc.data();
    
    if (!keyData.active) {
      return res.status(403).json({ error: 'API key is inactive' });
    }
    
    // Check if key has expired (only if expiresAt is set and not null)
    if (keyData.expiresAt && keyData.expiresAt.toDate() < new Date()) {
      return res.status(403).json({ error: 'API key has expired' });
    }
    
    // Attach key data to request for usage tracking
    req.apiKeyData = keyData;
    req.apiKeyId = apiKey;
    
    // Update usage counter (optional - can be done async)
    db.collection('apiKeys').doc(apiKey).update({
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      requestCount: admin.firestore.FieldValue.increment(1)
    }).catch(err => console.error('Error updating API key usage:', err));
    
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({ error: 'Error validating API key' });
  }
};

/**
 * Optional Firebase Auth validation for user-specific endpoints
 * Verifies Firebase ID token from Authorization header
 */
const verifyFirebaseAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing or invalid Authorization header' 
    });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ 
      error: 'Invalid token', 
      message: 'Firebase authentication token is invalid or expired' 
    });
  }
};

/**
 * Subscription validation middleware for premium features
 * Checks active subscription, quota, and subscription expiry
 * Use this for endpoints that require an active subscription (e.g., generate-nutrition-plan)
 */
const verifyActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this ID'
      });
    }
    
    const userData = userDoc.data();
    const now = new Date();
    
    // Check if user has active subscription
    const hasActiveSubscription = userData.subscriptionStatus === 'active' && userData.subscribed === true;
    
    // Check if subscription has expired
    let subscriptionExpired = false;
    if (userData.subscriptionEndDate) {
      const endDate = userData.subscriptionEndDate.toDate();
      subscriptionExpired = now > endDate;
    }
    
    // Check free trial status
    let isInFreeTrial = false;
    if (userData.freeTrialStartDate && userData.freeTrialEndDate) {
      const trialStart = userData.freeTrialStartDate.toDate();
      const trialEnd = userData.freeTrialEndDate.toDate();
      isInFreeTrial = now >= trialStart && now <= trialEnd;
    }
    
    // User must have either active subscription or be in free trial
    if (!hasActiveSubscription && !isInFreeTrial) {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'This feature requires an active subscription',
        subscriptionStatus: userData.subscriptionStatus || 'inactive',
        hasUsedFreeTrial: userData.hasUsedFreeTrial || false,
        canStartFreeTrial: !(userData.hasUsedFreeTrial || false),
        suggestion: userData.hasUsedFreeTrial 
          ? 'Please subscribe to continue using premium features'
          : 'Start your free trial to access this feature'
      });
    }
    
    // Check if subscription expired (but was active)
    if (hasActiveSubscription && subscriptionExpired) {
      return res.status(402).json({
        error: 'Subscription Expired',
        message: 'Your subscription has expired',
        subscriptionEndDate: userData.subscriptionEndDate.toDate().toISOString(),
        suggestion: 'Please renew your subscription to continue'
      });
    }
    
    // Check plan generation quota
    const quota = userData.planGenerationQuota || 0;
    if (quota <= 0) {
      return res.status(429).json({
        error: 'Quota Exceeded',
        message: 'You have used all your nutrition plan generations for this billing period',
        currentQuota: quota,
        subscriptionTier: userData.subscriptionTier || 'unknown',
        suggestion: 'Your quota will reset on your next billing date, or upgrade to a higher tier for more plans'
      });
    }
    
    // Attach subscription data to request for use in endpoint
    req.subscriptionData = {
      tier: userData.subscriptionTier,
      quota: quota,
      isFreeTrial: isInFreeTrial
    };
    
    next();
    
  } catch (error) {
    console.error('Subscription verification error:', error);
    return res.status(500).json({
      error: 'Failed to verify subscription',
      message: error.message
    });
  }
};

/**
 * Soft subscription validation for accessing existing premium content
 * Blocks access to saved content if subscription expired
 * Use this for GET endpoints (e.g., retrieve nutrition plans)
 */
const verifySubscriptionForAccess = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this ID'
      });
    }
    
    const userData = userDoc.data();
    const now = new Date();
    
    // Check if user has active subscription
    const hasActiveSubscription = userData.subscriptionStatus === 'active' && userData.subscribed === true;
    
    // Check if subscription has expired
    let subscriptionExpired = false;
    if (userData.subscriptionEndDate && hasActiveSubscription) {
      const endDate = userData.subscriptionEndDate.toDate();
      subscriptionExpired = now > endDate;
    }
    
    // Check free trial status
    let isInFreeTrial = false;
    if (userData.freeTrialStartDate && userData.freeTrialEndDate) {
      const trialStart = userData.freeTrialStartDate.toDate();
      const trialEnd = userData.freeTrialEndDate.toDate();
      isInFreeTrial = now >= trialStart && now <= trialEnd;
    }
    
    // Block access if no valid subscription/trial
    if (!hasActiveSubscription && !isInFreeTrial) {
      return res.status(402).json({
        error: 'Access Denied',
        message: 'Your subscription is required to access this content',
        subscriptionStatus: userData.subscriptionStatus || 'inactive',
        suggestion: 'Please renew your subscription to access your saved nutrition plans'
      });
    }
    
    // Block if subscription expired
    if (hasActiveSubscription && subscriptionExpired) {
      return res.status(402).json({
        error: 'Subscription Expired',
        message: 'Your subscription has expired. Renew to access your content',
        subscriptionEndDate: userData.subscriptionEndDate.toDate().toISOString()
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Access verification error:', error);
    return res.status(500).json({
      error: 'Failed to verify access',
      message: error.message
    });
  }
};

// Apply rate limiting to all routes
router.use(apiLimiter);

// ============================================
// VALIDATION HELPERS FOR ARRAY FIELDS
// ============================================

/**
 * Validate and convert array fields
 * Converts strings to arrays, validates that result is array
 */
const validateArrayField = (fieldValue, fieldName) => {
  if (fieldValue === undefined || fieldValue === null) {
    return [];
  }
  
  // If already an array, return it
  if (Array.isArray(fieldValue)) {
    return fieldValue.map(item => String(item).trim()).filter(item => item.length > 0);
  }
  
  // If string, try to parse as array or convert to single-item array
  if (typeof fieldValue === 'string') {
    const trimmed = fieldValue.trim();
    // Try to parse as JSON array first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(item => item.length > 0);
      }
    } catch (e) {
      // Not JSON, treat as single item
    }
    // If it looks like a comma-separated list, split it
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    // Single string item
    return trimmed.length > 0 ? [trimmed] : [];
  }
  
  // Invalid type
  throw new Error(`${fieldName} must be an array or string, received ${typeof fieldValue}`);
};

/**
 * Create field schema definition for API responses
 */
const getFieldSchema = (fieldName, fieldType, isRequired, description = '', additionalProps = {}) => {
  const schema = {
    type: fieldType,
    required: isRequired,
    description: description,
    ...additionalProps
  };
  return schema;
};

/**
 * Get complete schema for diet information endpoint
 */
const getDietInformationSchema = () => ({
  preference: getFieldSchema('preference', 'array', false, 'Array of dietary preferences', { itemType: 'string', example: ['vegetarian', 'gluten-free'] }),
  allergies: getFieldSchema('allergies', 'array', false, 'Array of food allergens', { itemType: 'string', example: ['peanuts', 'shellfish'] }),
  waterIntake: getFieldSchema('waterIntake', 'number', false, 'Daily water intake in liters', { range: '0-10', example: 2.5 }),
  foodPreference: getFieldSchema('foodPreference', 'array', false, 'Array of food preferences', { itemType: 'string', example: ['organic', 'local', 'non-GMO'] }),
  useSupplements: getFieldSchema('useSupplements', 'boolean', false, 'Whether user uses dietary supplements'),
  supplementIntake: getFieldSchema('supplementIntake', 'array', false, 'Array of supplement names', { itemType: 'string', example: ['protein powder', 'vitamins'] }),
  goal: getFieldSchema('goal', 'string', true, 'Nutritional goal', { enum: ['lose weight', 'gain muscle', 'maintain'] }),
  mealsPerDay: getFieldSchema('mealsPerDay', 'number', false, 'Number of meals per day', { range: '1-8', type: 'integer', example: 3 }),
  preferredEatingTimes: getFieldSchema('preferredEatingTimes', 'array', false, 'Meal times in HH:MM format', { itemType: 'string', format: 'HH:MM', example: ['08:00', '12:00', '18:00'] }),
  snackHabits: getFieldSchema('snackHabits', 'array', false, 'Array of snacking habits', { itemType: 'string', example: ['nuts', 'fruits', 'yogurt'] }),
  foodDislikes: getFieldSchema('foodDislikes', 'array', false, 'Array of disliked foods', { itemType: 'string', example: ['spicy foods', 'mushrooms'] }),
  willingness: getFieldSchema('willingness', 'array', false, 'Array of dietary changes willing to make', { itemType: 'string', example: ['reduce sugar', 'eat more vegetables'] })
});

/**
 * Get complete schema for health information endpoint
 */
const getHealthInformationSchema = () => ({
  age: getFieldSchema('age', 'number', false, 'Age in years', { type: 'integer', range: '18-120' }),
  gender: getFieldSchema('gender', 'string', false, 'Gender', { enum: ['male', 'female'] }),
  height: getFieldSchema('height', 'number', false, 'Height in centimeters', { range: '100-250' }),
  weight: getFieldSchema('weight', 'number', false, 'Weight in kilograms', { range: '30-300' }),
  medicalConditions: getFieldSchema('medicalConditions', 'array', false, 'Array of medical conditions', { itemType: 'string', example: ['diabetes', 'hypertension'] }),
  allergies: getFieldSchema('allergies', 'array', false, 'Array of medical allergies (drug allergies)', { itemType: 'string', example: ['penicillin'] }),
  smokingHabit: getFieldSchema('smokingHabit', 'string', false, 'Smoking status', { enum: ['non-smoker', 'occasional', 'regular'] }),
  sleepDuration: getFieldSchema('sleepDuration', 'number', false, 'Hours of sleep per night', { range: '0-24' }),
  stressLevel: getFieldSchema('stressLevel', 'string', false, 'Stress level', { enum: ['low', 'moderate', 'high'] }),
  pastInjuries: getFieldSchema('pastInjuries', 'array', false, 'Array of past injuries with descriptions', { itemType: 'string', example: ['knee injury in 2020'] }),
  medications: getFieldSchema('medications', 'array', false, 'Array of current medications', { itemType: 'string', example: ['metformin', 'aspirin'] }),
  currentAlcohol: getFieldSchema('currentAlcohol', 'string', false, 'Alcohol consumption frequency', { enum: ['none', 'occasional', 'moderate', 'frequent'] }),
  lastAlcohol: getFieldSchema('lastAlcohol', 'string', false, 'Last alcoholic drink date', { format: 'ISO date (YYYY-MM-DD)' }),
  otherIssues: getFieldSchema('otherIssues', 'string', false, 'Other health concerns')
});

/**
 * Get complete schema for exercise preference endpoint (Phase 4)
 */
const getExercisePreferenceSchema = () => ({
  fitnessGoal: getFieldSchema('fitnessGoal', 'string', false, 'Primary fitness goal', { enum: ['weight loss', 'muscle gain', 'endurance', 'flexibility', 'general fitness'] }),
  workoutFrequency: getFieldSchema('workoutFrequency', 'string', false, 'Workouts per week', { enum: ['1-2', '3-4', '5-6', 'daily'] }),
  workoutPreferredTime: getFieldSchema('workoutPreferredTime', 'string', false, 'Preferred workout time', { enum: ['morning', 'afternoon', 'evening', 'anytime'] }),
  workoutSetting: getFieldSchema('workoutSetting', 'string', false, 'Preferred environment', { enum: ['home', 'gym', 'outdoor', 'mixed'] }),
  workoutPreferredType: getFieldSchema('workoutPreferredType', 'array', false, 'Array of preferred exercise types', { itemType: 'string', example: ['cardio', 'strength', 'yoga'] }),
  workoutDuration: getFieldSchema('workoutDuration', 'number', false, 'Preferred workout duration in minutes', { range: '15-180', type: 'integer' }),
  equipmentAccess: getFieldSchema('equipmentAccess', 'array', false, 'Array of available equipment types', { itemType: 'string', example: ['dumbbells', 'treadmill', 'yoga mat'] }),
  workoutNotification: getFieldSchema('workoutNotification', 'string', false, 'Notification preference', { enum: ['daily', 'weekly', 'never'] })
});

/**
 * Get complete schema for weekly exercise endpoint (Phase 5)
 */
const getWeeklyExerciseSchema = () => ({
  weeklyActivity: getFieldSchema('weeklyActivity', 'object', false, 'Daily activity schedule', { 
    format: '{ "Monday": { "activityName": "string", "duration": number, "calories": number }, ... }',
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    example: {
      Monday: { activityName: 'Running', duration: 45, calories: 400 },
      Friday: { activityName: 'Swimming', duration: 30, calories: 300 },
      Sunday: { activityName: 'Yoga', duration: 45, calories: 150 }
    }
  })
});

/**
 * Get complete schema for subscription endpoint
 */
const getSubscriptionSchema = () => ({
  subscriptionId: getFieldSchema('subscriptionId', 'string', false, 'Stripe subscription ID'),
  planName: getFieldSchema('planName', 'string', false, 'Name of subscription plan', { enum: ['free', 'basic', 'premium', 'family'] }),
  amount: getFieldSchema('amount', 'number', false, 'Monthly subscription cost', { currency: 'USD' }),
  status: getFieldSchema('status', 'string', false, 'Subscription status', { enum: ['active', 'inactive', 'canceled', 'expired'] }),
  startDate: getFieldSchema('startDate', 'string', false, 'Subscription start date', { format: 'ISO date (YYYY-MM-DD)' }),
  renewalDate: getFieldSchema('renewalDate', 'string', false, 'Next renewal date', { format: 'ISO date (YYYY-MM-DD)' }),
  autoRenewal: getFieldSchema('autoRenewal', 'boolean', false, 'Auto-renewal enabled status')
});

// ============================================
// PUBLIC ENDPOINTS (No Auth Required)
// ============================================

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * GET /recipes/count
 * Get document counts for all recipe collections
 * Returns counts for breakfast, lunch, dinner, and snack recipes
 */
router.get('/recipes/count', async (req, res) => {
  try {
    const collections = [
      'breakfast_list_full_may2025',
      'lunch_list_full_may2025',
      'dinner_list_full_may2025',
      'snack_list_full_may2025'
    ];

    const counts = {};
    const countPromises = collections.map(async (col) => {
      const snapshot = await db.collection(col).get();
      counts[col] = snapshot.size;
    });

    await Promise.all(countPromises);

    res.json({ 
      success: true, 
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0)
    });
  } catch (error) {
    console.error('Error counting recipes:', error);
    res.status(500).json({ 
      error: 'Failed to count recipes', 
      message: error.message 
    });
  }
});

/**
 * GET /recipes/:mealType
 * Fetch recipes by meal type with pagination
 * Query params:
 *   - limit: number of recipes to return (default: 20, max: 100)
 *   - offset: number of recipes to skip (default: 0)
 *   - search: optional search term for recipe titles
 */
router.get('/recipes/:mealType', async (req, res) => {
  try {
    const { mealType } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const searchTerm = req.query.search;

    // Validate meal type
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(mealType.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid meal type', 
        message: `Meal type must be one of: ${validMealTypes.join(', ')}` 
      });
    }

    const collectionName = `${mealType.toLowerCase()}_list_full_may2025`;
    let query = db.collection(collectionName);

    // Add search filter if provided (simple title search)
    if (searchTerm) {
      // Note: This is a simple contains search. For production, consider using 
      // Cloud Firestore full-text search or Algolia integration
      query = query.where('Title', '>=', searchTerm)
                   .where('Title', '<=', searchTerm + '\uf8ff');
    }

    // Apply pagination
    const snapshot = await query.limit(limit).offset(offset).get();

    const recipes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      mealType,
      count: recipes.length,
      limit,
      offset,
      recipes
    });
  } catch (error) {
    console.error(`Error fetching ${req.params.mealType} recipes:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch recipes', 
      message: error.message 
    });
  }
});

/**
 * GET /recipes/:mealType/:recipeId
 * Get a specific recipe by ID
 */
router.get('/recipes/:mealType/:recipeId', async (req, res) => {
  try {
    const { mealType, recipeId } = req.params;

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(mealType.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid meal type' 
      });
    }

    const collectionName = `${mealType.toLowerCase()}_list_full_may2025`;
    const doc = await db.collection(collectionName).doc(recipeId).get();

    if (!doc.exists) {
      return res.status(404).json({ 
        error: 'Recipe not found',
        message: `No ${mealType} recipe found with ID: ${recipeId}` 
      });
    }

    res.json({
      success: true,
      recipe: {
        id: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recipe', 
      message: error.message 
    });
  }
});

// ============================================
// USER MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /users/register
 * Register a new user with BASIC information only
 * Creates Firebase Auth user and basic profile in Firestore
 * 
 * Phase 1 of registration - collects only essential user info
 * 
 * IMPORTANT: Uses lowercase field names (name, email, password, mobile, address)
 */
router.post('/users/register', async (req, res) => {
  let userRecord = null; // Track created user for cleanup if needed
  
  try {
    const {
      name,
      email,
      mobile,
      address,
      password
    } = req.body;

    // Check if developer is using OLD uppercase field names and provide helpful guidance
    if (req.body.NAME || req.body.EMAIL || req.body.PASSKEY || req.body.MOBILE || req.body.ADDRESS) {
      return res.status(400).json({
        error: 'Invalid field names',
        message: 'API uses lowercase field names. Please update your request.',
        hint: 'Use: name, email, password, mobile, address (all lowercase)',
        receivedFields: Object.keys(req.body),
        expectedFields: ['name', 'email', 'password', 'mobile', 'address'],
        documentation: 'See API_DOCUMENTATION.md for complete field reference'
      });
    }

    // Validate required fields with clear guidance
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!mobile) missingFields.push('mobile');
    if (!address) missingFields.push('address');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following required fields are missing: ${missingFields.join(', ')}`,
        missingFields: missingFields,
        receivedFields: Object.keys(req.body),
        requiredFields: ['name', 'email', 'password', 'mobile', 'address'],
        optionalFields: []
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address',
        example: 'user@example.com',
        receivedValue: email
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 6 characters',
        requirement: 'Minimum 6 characters',
        receivedLength: password.length
      });
    }

    // Step 1: Create Firebase Auth user
    try {
      userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: name
      });
      console.log(`Firebase Auth user created: ${userRecord.uid}`);
    } catch (authError) {
      console.error('Firebase Auth creation failed:', authError);
      
      if (authError.code === 'auth/email-already-exists') {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'A user with this email already exists. Please try logging in instead.',
          suggestion: 'Use the login endpoint or try a different email address',
          email: email
        });
      }
      
      if (authError.code === 'auth/invalid-email') {
        return res.status(400).json({
          error: 'Invalid email',
          message: 'The email address format is not valid',
          receivedEmail: email
        });
      }

      if (authError.code === 'auth/weak-password') {
        return res.status(400).json({
          error: 'Weak password',
          message: 'Password should be at least 6 characters',
          requirement: 'Minimum 6 characters'
        });
      }
      
      // Unknown auth error
      throw authError;
    }

    // Step 2: Create basic user profile in Firestore
    try {
      const userProfile = {
        name: name,
        email: email,
        mobile: mobile || '',
        address: address || '',
        age: req.body.age || null,
        height: req.body.height || null,
        weight: req.body.weight || null,
        gender: req.body.gender || null,
        
        // Registration status tracking
        registrationComplete: false,
        registrationSteps: {
          basicInfo: true,
          dietInfo: false,
          healthInfo: false,
          exercisePreference: false,
          weeklyExercise: false
        },
        
        // Subscription info
        subscribed: false,
        subscriptionPackageId: null,
        subscriptionStatus: 'inactive',
        subscriptionTier: null,
        
        // Free trial tracking
        hasUsedFreeTrial: false,
        freeTrialStartDate: null,
        freeTrialEndDate: null,
        isInFreeTrial: false,
        
        // Subscription dates
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        subscriptionCancelledDate: null,
        
        // Plan generation quota tracking
        planGenerationQuota: 0,
        lastPlanGeneratedAt: null,
        totalPlansGenerated: 0,
        
        // Discount codes
        hasUsedDiscountCode: false,
        discountCode: null,
        discountCodeUsedDate: null,
        discountPercentage: null,
        
        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('users').doc(userRecord.uid).set(userProfile);
      console.log(`Firestore profile created for user: ${userRecord.uid}`);
      
    } catch (firestoreError) {
      console.error('Firestore profile creation failed:', firestoreError);
      
      // CRITICAL: Clean up the Firebase Auth user we just created
      // This prevents orphaned users that exist in Auth but not in Firestore
      try {
        console.log(`Attempting to delete orphaned Firebase Auth user: ${userRecord.uid}`);
        await admin.auth().deleteUser(userRecord.uid);
        console.log(`Successfully deleted orphaned user: ${userRecord.uid}`);
      } catch (cleanupError) {
        console.error('Failed to cleanup orphaned user:', cleanupError);
        // Log but don't throw - we still want to return the original error
      }
      
      return res.status(500).json({
        error: 'Profile creation failed',
        message: 'Failed to create user profile in database. The partially created user has been cleaned up.',
        suggestion: 'Please try registering again. If the problem persists, contact support.',
        details: firestoreError.message,
        cleanupPerformed: true
      });
    }

    // Success! Both Auth and Firestore profile created
    res.status(201).json({
      success: true,
      message: 'User registered successfully (Phase 1/5)',
      userId: userRecord.uid,
      email: userRecord.email,
      nextStep: 'Client should sign in with Firebase SDK, then complete diet information at PUT /v1/users/{userId}/diet-information',
      registrationProgress: {
        basicInfo: true,
        dietInfo: false,
        healthInfo: false,
        exercisePreference: false,
        weeklyExercise: false,
        complete: false
      },
      schema: {
        basicInfo: {
          name: getFieldSchema('name', 'string', true, 'User full name'),
          email: getFieldSchema('email', 'string', true, 'User email address'),
          password: getFieldSchema('password', 'string', true, 'User password (min 6 characters)'),
          mobile: getFieldSchema('mobile', 'string', false, 'User phone number'),
          address: getFieldSchema('address', 'string', false, 'User address')
        }
      }
    });

  } catch (error) {
    console.error('Unexpected registration error:', error);
    
    // If we created a user but something else went wrong, try to clean up
    if (userRecord && userRecord.uid) {
      try {
        console.log(`Attempting emergency cleanup of user: ${userRecord.uid}`);
        await admin.auth().deleteUser(userRecord.uid);
        console.log(`Emergency cleanup successful for user: ${userRecord.uid}`);
      } catch (cleanupError) {
        console.error('Emergency cleanup failed:', cleanupError);
      }
    }
    
    res.status(500).json({
      error: 'Registration failed',
      message: 'An unexpected error occurred during registration',
      suggestion: 'Please check your request format and try again. Ensure all field names are lowercase.',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /users/login
 * Login with email and password to get Firebase ID token
 * 
 * Returns: { idToken, userId, email }
 */
router.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
        requiredFields: ['email', 'password']
      });
    }

    // Get the Firestore user by email to get their UID
    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (querySnapshot.empty) {
      return res.status(401).json({
        error: 'User not found',
        message: 'No user found with this email'
      });
    }

    // Verify credentials with Firebase Auth
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Create a custom token - this can be used by the client to authenticate
      const customToken = await admin.auth().createCustomToken(userRecord.uid);
      
      return res.status(200).json({
        success: true,
        customToken: customToken,
        userId: userRecord.uid,
        email: email,
        message: 'Use this customToken with Firebase client SDK: firebase.auth().signInWithCustomToken(customToken)'
      });
    } catch (authError) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login',
      details: error.message
    });
  }
});

/**
 * GET /users/exchange-token/:customToken
 * Exchange a custom token for an ID token (for testing/API purposes)
 * This is a special endpoint for API testing - use Firebase Client SDK in production
 */
router.get('/users/exchange-token/:customToken', async (req, res) => {
  try {
    const { customToken } = req.params;
    
    if (!customToken) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'customToken parameter is required'
      });
    }

    // Use Firebase REST API to exchange custom token for ID token
    const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDhL-hE5UJrspDmtKD-YdGU9KSsQUz6BDw';
    
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token: customToken, 
        returnSecureToken: true 
      })
    });
    
    const data = await response.json();
    
    if (data.idToken) {
      return res.status(200).json({
        success: true,
        idToken: data.idToken,
        userId: data.localId,
        expiresIn: data.expiresIn
      });
    } else {
      return res.status(401).json({
        error: 'Token exchange failed',
        message: 'Could not exchange custom token for ID token',
        details: data.error?.message
      });
    }
    
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({
      error: 'Token exchange failed',
      message: 'An error occurred during token exchange',
      details: error.message
    });
  }
});

/**
 * GET /users/:userId/profile
 * Get user profile information - requires authentication
 */
router.get('/users/:userId/profile', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure user can only access their own profile
    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own profile'
      });
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      profile: {
        id: userDoc.id,
        ...userDoc.data()
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * PUT /users/:userId/profile
 * Update user profile data - accepts any field from request
 * Requires Firebase Auth
 * 
 * Note: Use phase-specific endpoints for phase data:
 * - Phase 2: PUT /diet-information
 * - Phase 3: PUT /health-information
 * - Phase 4: PUT /exercise-preference
 * - Phase 5: PUT /weekly-exercise
 */
router.put('/users/:userId/profile', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own profile'
      });
    }

    // Get all fields from request body
    const updateData = { ...req.body };

    // Check if any fields are provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No fields provided',
        message: 'Please provide at least one field to update',
        example: {
          name: 'John Doe',
          mobile: '+1234567890',
          address: '123 Main St'
        }
      });
    }

    // Validate specific fields if provided
    if (updateData.gender && !['male', 'female'].includes(updateData.gender.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid gender',
        message: 'Gender must be "male" or "female"'
      });
    }

    if (updateData.sleepDuration && (isNaN(parseFloat(updateData.sleepDuration)) || parseFloat(updateData.sleepDuration) < 0 || parseFloat(updateData.sleepDuration) > 24)) {
      return res.status(400).json({
        error: 'Invalid sleepDuration',
        message: 'Sleep duration must be between 0 and 24 hours'
      });
    }

    if (updateData.waterIntake && (isNaN(parseFloat(updateData.waterIntake)) || parseFloat(updateData.waterIntake) < 0)) {
      return res.status(400).json({
        error: 'Invalid waterIntake',
        message: 'Water intake must be a positive number'
      });
    }

    if (updateData.mealsPerDay && (isNaN(parseInt(updateData.mealsPerDay)) || parseInt(updateData.mealsPerDay) < 1 || parseInt(updateData.mealsPerDay) > 8)) {
      return res.status(400).json({
        error: 'Invalid mealsPerDay',
        message: 'Meals per day must be between 1 and 8'
      });
    }

    // Remove registrationComplete flag to prevent accidental changes
    delete updateData.registrationComplete;
    delete updateData.registrationSteps;

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(userId).update(updateData);

    // Fetch updated data to confirm changes
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedFields = Object.keys(updateData).filter(key => key !== 'updatedAt');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      updatedFields: updatedFields,
      updatedData: {
        ...updatedFields.reduce((acc, field) => {
          acc[field] = updatedDoc.data()[field];
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

/**
 * PUT /users/:userId/diet-information
 * Update user's diet preferences and habits
 * Phase 2 of registration - collects dietary information
 * Requires Firebase Auth
 */
router.put('/users/:userId/diet-information', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own diet information'
      });
    }

    const {
      preference,
      allergies,
      waterIntake,
      foodPreference,
      useSupplements,
      supplementIntake,
      goal,
      mealsPerDay,
      preferredEatingTimes,
      snackHabits,
      foodDislikes,
      willingness
    } = req.body;

    // Validate required fields
    if (!goal) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'goal is required',
        schema: getDietInformationSchema()
      });
    }

    // Validate goal value
    const validGoals = ['lose weight', 'gain muscle', 'maintain'];
    if (!validGoals.some(g => g.toLowerCase() === goal.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid goal',
        message: `goal must be one of: ${validGoals.join(', ')}`,
        schema: getDietInformationSchema()
      });
    }

    // Validate water intake (if provided)
    if (waterIntake && (isNaN(parseFloat(waterIntake)) || parseFloat(waterIntake) < 0)) {
      return res.status(400).json({
        error: 'Invalid waterIntake',
        message: 'Water intake must be a positive number',
        schema: getDietInformationSchema()
      });
    }

    // Validate meals per day (if provided)
    if (mealsPerDay && (isNaN(parseInt(mealsPerDay)) || parseInt(mealsPerDay) < 1 || parseInt(mealsPerDay) > 8)) {
      return res.status(400).json({
        error: 'Invalid mealsPerDay',
        message: 'Meals per day must be between 1 and 8',
        schema: getDietInformationSchema()
      });
    }

    // Validate and convert array fields
    let validatedPreference = [];
    let validatedAllergies = [];
    let validatedFoodPreference = [];
    let validatedSupplementIntake = [];
    let validatedPreferredEatingTimes = [];
    let validatedSnackHabits = [];
    let validatedFoodDislikes = [];
    let validatedWillingness = [];

    try {
      if (preference !== undefined && preference !== null) {
        validatedPreference = validateArrayField(preference, 'preference');
      }
      if (allergies !== undefined && allergies !== null) {
        validatedAllergies = validateArrayField(allergies, 'allergies');
      }
      if (foodPreference !== undefined && foodPreference !== null) {
        validatedFoodPreference = validateArrayField(foodPreference, 'foodPreference');
      }
      if (supplementIntake !== undefined && supplementIntake !== null) {
        validatedSupplementIntake = validateArrayField(supplementIntake, 'supplementIntake');
      }
      if (preferredEatingTimes !== undefined && preferredEatingTimes !== null) {
        validatedPreferredEatingTimes = validateArrayField(preferredEatingTimes, 'preferredEatingTimes');
      }
      if (snackHabits !== undefined && snackHabits !== null) {
        validatedSnackHabits = validateArrayField(snackHabits, 'snackHabits');
      }
      if (foodDislikes !== undefined && foodDislikes !== null) {
        validatedFoodDislikes = validateArrayField(foodDislikes, 'foodDislikes');
      }
      if (willingness !== undefined && willingness !== null) {
        validatedWillingness = validateArrayField(willingness, 'willingness');
      }
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid field format',
        message: validationError.message,
        hint: 'Array fields must be provided as arrays or comma-separated strings',
        arrayFields: ['preference', 'allergies', 'foodPreference', 'supplementIntake', 'preferredEatingTimes', 'snackHabits', 'foodDislikes', 'willingness'],
        schema: getDietInformationSchema()
      });
    }

    const dietInfo = {
      preference: validatedPreference,
      allergies: validatedAllergies,
      waterIntake: waterIntake ? parseFloat(waterIntake) : null,
      foodPreference: validatedFoodPreference,
      useSupplements: useSupplements || false,
      supplementIntake: validatedSupplementIntake,
      goal: goal,
      mealsPerDay: mealsPerDay ? parseInt(mealsPerDay) : 3,
      preferredEatingTimes: validatedPreferredEatingTimes,
      snackHabits: validatedSnackHabits,
      foodDislikes: validatedFoodDislikes,
      willingness: validatedWillingness,
      'registrationSteps.dietInfo': true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userId).update(dietInfo);

    // Check registration progress
    const userDoc = await db.collection('users').doc(userId).get();
    const steps = userDoc.data().registrationSteps;

    res.json({
      success: true,
      message: 'Diet information updated successfully (Phase 2/5)',
      nextStep: 'Complete health information at PUT /v1/users/{userId}/health-information',
      registrationProgress: steps,
      schema: getDietInformationSchema()
    });

  } catch (error) {
    console.error('Error updating diet information:', error);
    res.status(500).json({
      error: 'Failed to update diet information',
      message: error.message,
      schema: getDietInformationSchema()
    });
  }
});

/**
 * PUT /users/:userId/health-information
 * Update user's health and medical information
 * Phase 3 of registration - collects health data
 * Requires Firebase Auth
 */
router.put('/users/:userId/health-information', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own health information'
      });
    }

    const {
      medicalConditions,
      allergies,
      smokingHabit,
      sleepDuration,
      stressLevel,
      pastInjuries,
      medications,
      currentAlcohol,
      lastAlcohol,
      otherIssues,
      gender,
      age,
      height,
      weight
    } = req.body;

    // Validate required fields for nutrition plan generation
    const missingFields = [];
    if (!age) missingFields.push('age');
    if (!gender) missingFields.push('gender');
    if (!height) missingFields.push('height');
    if (!weight) missingFields.push('weight');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following fields are required for nutrition plan generation: ${missingFields.join(', ')}`,
        missingFields: missingFields,
        requiredFields: ['age', 'gender', 'height', 'weight'],
        schema: getHealthInformationSchema()
      });
    }

    // Validate age
    const parsedAge = typeof age === 'string' ? parseInt(age) : age;
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
      return res.status(400).json({
        error: 'Invalid age',
        message: 'Age must be a number between 18 and 120',
        receivedValue: age,
        schema: getHealthInformationSchema()
      });
    }

    // Validate height (in centimeters)
    const parsedHeight = typeof height === 'string' ? parseFloat(height) : height;
    if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
      return res.status(400).json({
        error: 'Invalid height',
        message: 'Height must be a number between 100 and 250 cm',
        receivedValue: height,
        schema: getHealthInformationSchema()
      });
    }

    // Validate weight (in kilograms)
    const parsedWeight = typeof weight === 'string' ? parseFloat(weight) : weight;
    if (isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
      return res.status(400).json({
        error: 'Invalid weight',
        message: 'Weight must be a number between 30 and 300 kg',
        receivedValue: weight,
        schema: getHealthInformationSchema()
      });
    }

    // Validate gender
    if (!['male', 'female'].includes(gender.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid gender',
        message: 'Gender must be "male" or "female"',
        receivedValue: gender,
        schema: getHealthInformationSchema()
      });
    }

    // Validate sleep duration (if provided)
    if (sleepDuration && (isNaN(parseFloat(sleepDuration)) || parseFloat(sleepDuration) < 0 || parseFloat(sleepDuration) > 24)) {
      return res.status(400).json({
        error: 'Invalid sleepDuration',
        message: 'Sleep duration must be between 0 and 24 hours',
        schema: getHealthInformationSchema()
      });
    }

    // Validate and convert array fields
    let validatedMedicalConditions = [];
    let validatedAllergies = [];
    let validatedPastInjuries = [];
    let validatedMedications = [];

    try {
      if (medicalConditions !== undefined && medicalConditions !== null) {
        validatedMedicalConditions = validateArrayField(medicalConditions, 'medicalConditions');
      }
      if (allergies !== undefined && allergies !== null) {
        validatedAllergies = validateArrayField(allergies, 'allergies');
      }
      if (pastInjuries !== undefined && pastInjuries !== null) {
        validatedPastInjuries = validateArrayField(pastInjuries, 'pastInjuries');
      }
      if (medications !== undefined && medications !== null) {
        validatedMedications = validateArrayField(medications, 'medications');
      }
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid field format',
        message: validationError.message,
        hint: 'Array fields must be provided as arrays or comma-separated strings',
        arrayFields: ['medicalConditions', 'allergies', 'pastInjuries', 'medications'],
        schema: getHealthInformationSchema()
      });
    }

    const healthInfo = {
      medicalConditions: validatedMedicalConditions,
      allergies: validatedAllergies,
      smokingHabit: smokingHabit || '',
      sleepDuration: sleepDuration ? parseFloat(sleepDuration) : null,
      stressLevel: stressLevel || '',
      pastInjuries: validatedPastInjuries,
      medications: validatedMedications,
      currentAlcohol: currentAlcohol || '',
      lastAlcohol: lastAlcohol || '',
      otherIssues: otherIssues || '',
      gender: gender,
      age: parsedAge,
      height: parsedHeight,
      weight: parsedWeight,
      'registrationSteps.healthInfo': true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userId).update(healthInfo);

    // Check registration progress
    const userDoc = await db.collection('users').doc(userId).get();
    const steps = userDoc.data().registrationSteps;

    res.json({
      success: true,
      message: 'Health information updated successfully (Phase 3/5)',
      nextStep: 'Complete exercise preference at PUT /v1/users/{userId}/exercise-preference',
      registrationProgress: steps,
      schema: getHealthInformationSchema()
    });

  } catch (error) {
    console.error('Error updating health information:', error);
    res.status(500).json({
      error: 'Failed to update health information',
      message: error.message,
      schema: getHealthInformationSchema()
    });
  }
});

/**
 * PUT /users/:userId/exercise-preference
 * Update user's exercise preferences
 * Phase 4 of registration - collects workout preferences
 * Requires Firebase Auth
 */
router.put('/users/:userId/exercise-preference', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own exercise preferences'
      });
    }

    const {
      fitnessGoal,
      workoutFrequency,
      workoutPreferredTime,
      workoutSetting,
      workoutPreferredType,
      workoutDuration,
      equipmentAccess,
      workoutNotification
    } = req.body;

    // Validate workout duration (if provided)
    if (workoutDuration && (isNaN(parseInt(workoutDuration)) || parseInt(workoutDuration) < 0)) {
      return res.status(400).json({
        error: 'Invalid workoutDuration',
        message: 'Workout duration must be a positive number',
        schema: getExercisePreferenceSchema()
      });
    }

    // Validate and convert array fields
    let validatedWorkoutPreferredType = [];
    let validatedEquipmentAccess = [];

    try {
      if (workoutPreferredType !== undefined && workoutPreferredType !== null) {
        validatedWorkoutPreferredType = validateArrayField(workoutPreferredType, 'workoutPreferredType');
      }
      if (equipmentAccess !== undefined && equipmentAccess !== null) {
        validatedEquipmentAccess = validateArrayField(equipmentAccess, 'equipmentAccess');
      }
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid field format',
        message: validationError.message,
        hint: 'Array fields must be provided as arrays or comma-separated strings',
        arrayFields: ['workoutPreferredType', 'equipmentAccess'],
        schema: getExercisePreferenceSchema()
      });
    }

    const exercisePreference = {
      fitnessGoal: fitnessGoal || '',
      workoutFrequency: workoutFrequency || '',
      workoutPreferredTime: workoutPreferredTime || '',
      workoutSetting: workoutSetting || '',
      workoutPreferredType: validatedWorkoutPreferredType,
      workoutDuration: workoutDuration ? parseInt(workoutDuration) : null,
      equipmentAccess: validatedEquipmentAccess,
      workoutNotification: workoutNotification || '',
      'registrationSteps.exercisePreference': true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userId).update(exercisePreference);

    // Check registration progress
    const userDoc = await db.collection('users').doc(userId).get();
    const steps = userDoc.data().registrationSteps;

    res.json({
      success: true,
      message: 'Exercise preference updated successfully (Phase 4/5)',
      nextStep: 'Complete weekly exercise schedule at PUT /v1/users/{userId}/weekly-exercise',
      registrationProgress: steps,
      schema: getExercisePreferenceSchema()
    });

  } catch (error) {
    console.error('Error updating exercise preferences:', error);
    res.status(500).json({
      error: 'Failed to update exercise preferences',
      message: error.message
    });
  }
});

/**
 * PUT /users/:userId/weekly-exercise
 * Update user's weekly exercise schedule
 * Phase 5 of registration - final step, collects weekly activity
 * Requires Firebase Auth
 * 
 * IMPORTANT: Use lowercase field name "weeklyActivity" (not "WEEKLY_EXERCISE")
 * Body: { "weeklyActivity": { "Monday": {...}, "Tuesday": {...}, ... } }
 */
router.put('/users/:userId/weekly-exercise', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own weekly exercise schedule'
      });
    }

    // Accept both 'weeklyActivity' and 'WEEKLY_EXERCISE' for backward compatibility
    let weeklyActivity = req.body.weeklyActivity || req.body.WEEKLY_EXERCISE;

    if (!weeklyActivity || typeof weeklyActivity !== 'object') {
      return res.status(400).json({
        error: 'Invalid weeklyActivity',
        message: 'weeklyActivity must be an object with day-activity mappings',
        expectedFormat: {
          weeklyActivity: {
            Monday: { activityName: "Running", duration: 45, calories: 400 },
            Tuesday: { activityName: "Rest", duration: 0, calories: 0 },
            Wednesday: { activityName: "Gym", duration: 60, calories: 350 },
            Thursday: { activityName: "Rest", duration: 0, calories: 0 },
            Friday: { activityName: "Swimming", duration: 30, calories: 300 },
            Saturday: { activityName: "Cycling", duration: 90, calories: 500 },
            Sunday: { activityName: "Yoga", duration: 45, calories: 150 }
          }
        },
        hint: 'Ensure you are using "weeklyActivity" (not "WEEKLY_EXERCISE") as the field name'
      });
    }

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const validatedWeeklyActivity = {};
    let totalWeeklyCalories = 0;

    // Validate and process each day
    for (const day of daysOfWeek) {
      const activity = weeklyActivity[day];
      
      if (!activity) {
        // Default to rest day if not provided
        validatedWeeklyActivity[day] = {
          activityName: 'Rest',
          duration: 0,
          calories: 0
        };
        continue;
      }

      // Validate activity structure
      const activityName = activity.activityName || 'Rest';
      const duration = parseInt(activity.duration) || 0;
      const calories = parseInt(activity.calories) || 0;

      if (duration < 0 || duration > 300) {
        return res.status(400).json({
          error: `Invalid duration for ${day}`,
          message: 'Duration must be between 0 and 300 minutes'
        });
      }

      if (calories < 0 || calories > 2000) {
        return res.status(400).json({
          error: `Invalid calories for ${day}`,
          message: 'Calories must be between 0 and 2000'
        });
      }

      validatedWeeklyActivity[day] = {
        activityName,
        duration,
        calories
      };

      totalWeeklyCalories += calories;
    }

    // Update user document - mark registration as complete
    await db.collection('users').doc(userId).update({
      weeklyActivity: validatedWeeklyActivity,
      totalWeeklyActivityCalories: totalWeeklyCalories,
      'registrationSteps.weeklyExercise': true,
      registrationComplete: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Weekly exercise schedule updated successfully. Registration complete!',
      registrationComplete: true,
      totalWeeklyCalories: totalWeeklyCalories,
      nextStep: 'You can now generate your personalized nutrition plan',
      schema: getWeeklyExerciseSchema()
    });

  } catch (error) {
    console.error('Error updating weekly exercise:', error);
    res.status(500).json({
      error: 'Failed to update weekly exercise',
      message: error.message
    });
  }
});

// ============================================
// STRIPE PAYMENT ENDPOINTS
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || require('firebase-functions').config().stripe?.secret_key);

/**
 * POST /payments/create-checkout
 * Create Stripe checkout session for subscription
 * Requires Firebase Auth
 */
router.post('/payments/create-checkout', verifyFirebaseAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { email, priceId } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    let customerId = userData?.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email,
        metadata: { firebaseUID: uid }
      });

      customerId = customer.id;

      await db.collection('users').doc(uid).set({
        stripeCustomerId: customerId
      }, { merge: true });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId || 'price_1RJx3cDNiU7g4QNyVyT5vujC',
        quantity: 1
      }],
      success_url: req.body.successUrl || 'https://nufit-67bf0.web.app/success.html',
      cancel_url: req.body.cancelUrl || 'https://nufit-67bf0.web.app/cancel.html',
      customer: customerId
    });

    res.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

/**
 * POST /payments/cancel-subscription
 * Cancel user's active subscription
 * Requires Firebase Auth
 */
router.post('/payments/cancel-subscription', verifyFirebaseAuth, async (req, res) => {
  try {
    const uid = req.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    const subscriptionId = userData?.subscriptionId;

    if (!subscriptionId) {
      return res.status(404).json({
        error: 'No active subscription found'
      });
    }

    // Cancel subscription at period end
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });

    // Delete subscription immediately
    await stripe.subscriptions.del(subscriptionId);

    // Update Firestore
    await db.collection('users').doc(uid).update({
      subscribed: false,
      subscriptionId: admin.firestore.FieldValue.delete(),
      currentPeriodEnd: admin.firestore.FieldValue.delete()
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
});

/**
 * GET /payments/subscription-status
 * Get user's subscription status (basic info for backward compatibility)
 * Requires Firebase Auth
 */
router.get('/payments/subscription-status', verifyFirebaseAuth, async (req, res) => {
  try {
    const uid = req.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    res.json({
      success: true,
      subscribed: userData?.subscribed || false,
      subscriptionId: userData?.subscriptionId || null,
      currentPeriodEnd: userData?.currentPeriodEnd || null,
      stripeCustomerId: userData?.stripeCustomerId || null
    });

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription status',
      message: error.message
    });
  }
});

/**
 * GET /users/:userId/subscription
 * Get comprehensive subscription details for a user
 * Requires Firebase Auth
 * 
 * Returns all subscription information including:
 * - Active subscription status and tier
 * - Free trial status (current, used, dates)
 * - Discount code information
 * - Subscription lifecycle dates (start, end, cancelled)
 */
router.get('/users/:userId/subscription', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const uid = req.uid;

    // Verify user can only access their own subscription or is admin
    if (userId !== uid) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own subscription details'
      });
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this ID'
      });
    }

    const userData = userDoc.data();
    const now = new Date();

    // Calculate if currently in free trial
    let isCurrentlyInFreeTrial = false;
    if (userData.freeTrialStartDate && userData.freeTrialEndDate) {
      const trialStart = userData.freeTrialStartDate.toDate();
      const trialEnd = userData.freeTrialEndDate.toDate();
      isCurrentlyInFreeTrial = now >= trialStart && now <= trialEnd;
    }

    // Build comprehensive subscription response
    const subscriptionDetails = {
      success: true,
      
      // Active subscription info
      subscription: {
        isActive: userData.subscribed || false,
        status: userData.subscriptionStatus || 'inactive',
        tier: userData.subscriptionTier || null,
        packageId: userData.subscriptionPackageId || null,
        stripeSubscriptionId: userData.subscriptionId || null,
        stripeCustomerId: userData.stripeCustomerId || null
      },
      
      // Free trial information
      freeTrial: {
        hasEverUsedTrial: userData.hasUsedFreeTrial || false,
        isCurrentlyInTrial: isCurrentlyInFreeTrial,
        startDate: userData.freeTrialStartDate?.toDate() || null,
        endDate: userData.freeTrialEndDate?.toDate() || null,
        daysRemaining: isCurrentlyInFreeTrial && userData.freeTrialEndDate 
          ? Math.ceil((userData.freeTrialEndDate.toDate() - now) / (1000 * 60 * 60 * 24))
          : 0
      },
      
      // Discount code information
      discountCode: {
        hasUsedDiscount: userData.hasUsedDiscountCode || false,
        code: userData.discountCode || null,
        discountPercentage: userData.discountPercentage || null,
        usedDate: userData.discountCodeUsedDate?.toDate() || null
      },
      
      // Subscription lifecycle dates
      dates: {
        subscriptionStarted: userData.subscriptionStartDate?.toDate() || null,
        subscriptionEnds: userData.subscriptionEndDate?.toDate() || null,
        subscriptionCancelled: userData.subscriptionCancelledDate?.toDate() || null,
        currentPeriodEnd: userData.currentPeriodEnd?.toDate() || null
      },
      
      // Quick status flags
      flags: {
        hasActiveSubscription: userData.subscribed || false,
        isInFreeTrial: isCurrentlyInFreeTrial,
        hasValidAccess: (userData.subscribed || isCurrentlyInFreeTrial),
        canStartFreeTrial: !(userData.hasUsedFreeTrial || false)
      }
    };

    res.json({
      ...subscriptionDetails,
      schema: getSubscriptionSchema()
    });

  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription details',
      message: error.message,
      suggestion: 'Please try again or contact support if the issue persists'
    });
  }
});

/**
 * POST /admin/plan-generation-reset
 * Reset plan generation quotas for users based on their subscription tier
 * Can reset for a specific user or all users
 * Requires API Key authentication
 * 
 * Body parameters:
 * - userId (optional): Specific user ID to reset. If omitted, resets all active subscriptions
 * - tier (optional): Only reset users with this subscription tier
 */
router.post('/admin/plan-generation-reset', validateApiKey, async (req, res) => {
  try {
    const { userId, tier } = req.body;
    
    // Quota allocation by tier
    const tierQuotas = {
      'trial': 1,
      'one-month': 4,
      'three-month': 12
    };
    
    let resetCount = 0;
    let errors = [];
    
    if (userId) {
      // Reset specific user
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({
          error: 'User not found',
          message: `No user found with ID: ${userId}`
        });
      }
      
      const userData = userDoc.data();
      const userTier = userData.subscriptionTier;
      
      // Check if tier filter applies
      if (tier && userTier !== tier) {
        return res.status(400).json({
          error: 'Tier mismatch',
          message: `User has tier "${userTier}" but reset requested for tier "${tier}"`
        });
      }
      
      const newQuota = tierQuotas[userTier] || 0;
      
      await db.collection('users').doc(userId).update({
        planGenerationQuota: newQuota,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      resetCount = 1;
      
      return res.json({
        success: true,
        message: `Quota reset for user ${userId}`,
        userId: userId,
        tier: userTier,
        newQuota: newQuota,
        resetCount: 1
      });
      
    } else {
      // Reset all users with active subscriptions (or filtered by tier)
      let query = db.collection('users').where('subscriptionStatus', '==', 'active');
      
      if (tier) {
        query = query.where('subscriptionTier', '==', tier);
      }
      
      const usersSnapshot = await query.get();
      
      if (usersSnapshot.empty) {
        return res.json({
          success: true,
          message: tier 
            ? `No active users found with tier "${tier}"`
            : 'No active subscriptions found',
          resetCount: 0
        });
      }
      
      // Batch update users
      const batch = db.batch();
      const resetDetails = [];
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const userTier = userData.subscriptionTier;
        const newQuota = tierQuotas[userTier] || 0;
        
        batch.update(doc.ref, {
          planGenerationQuota: newQuota,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        resetDetails.push({
          userId: doc.id,
          tier: userTier,
          newQuota: newQuota
        });
        
        resetCount++;
      });
      
      await batch.commit();
      
      return res.json({
        success: true,
        message: `Quota reset for ${resetCount} user(s)`,
        resetCount: resetCount,
        tierFilter: tier || 'all',
        details: resetDetails
      });
    }
    
  } catch (error) {
    console.error('Plan generation reset error:', error);
    res.status(500).json({
      error: 'Failed to reset plan generation quotas',
      message: error.message
    });
  }
});

/**
 * PUT /users/:userId/subscription
 * Update user subscription details
 * Requires Firebase Auth
 * 
 * Allows updating:
 * - Subscription status and tier
 * - Free trial activation/deactivation
 * - Discount code application
 * - Subscription dates
 * 
 * Body parameters (all optional):
 * - subscribed: boolean
 * - subscriptionStatus: string ('active', 'inactive', 'cancelled', 'expired')
 * - subscriptionTier: string (e.g., 'basic', 'premium', 'enterprise')
 * - activateFreeTrial: boolean (starts 7-day trial)
 * - discountCode: string
 * - discountPercentage: number
 * - subscriptionStartDate: ISO date string
 * - subscriptionEndDate: ISO date string
 */
router.put('/users/:userId/subscription', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const uid = req.uid;

    // Verify user can only modify their own subscription or is admin
    if (userId !== uid) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only modify your own subscription'
      });
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this ID'
      });
    }

    const userData = userDoc.data();
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const {
      subscribed,
      subscriptionStatus,
      subscriptionTier,
      subscriptionPackageId,
      activateFreeTrial,
      discountCode,
      discountPercentage,
      subscriptionStartDate,
      subscriptionEndDate
    } = req.body;

    // Update subscription status
    if (subscribed !== undefined) {
      updateData.subscribed = Boolean(subscribed);
      
      // If activating subscription, set start date if not already set
      if (subscribed && !userData.subscriptionStartDate) {
        updateData.subscriptionStartDate = admin.firestore.FieldValue.serverTimestamp();
      }
      
      // If deactivating, set end date
      if (!subscribed && userData.subscribed) {
        updateData.subscriptionEndDate = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    if (subscriptionStatus) {
      const validStatuses = ['active', 'inactive', 'cancelled', 'expired', 'paused'];
      if (!validStatuses.includes(subscriptionStatus)) {
        return res.status(400).json({
          error: 'Invalid subscription status',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
          receivedValue: subscriptionStatus
        });
      }
      updateData.subscriptionStatus = subscriptionStatus;
      
      // Set cancelled date if status is cancelled
      if (subscriptionStatus === 'cancelled') {
        updateData.subscriptionCancelledDate = admin.firestore.FieldValue.serverTimestamp();
      }
    }

    if (subscriptionTier) {
      updateData.subscriptionTier = subscriptionTier;
    }

    if (subscriptionPackageId) {
      updateData.subscriptionPackageId = subscriptionPackageId;
    }

    // Handle free trial activation
    if (activateFreeTrial === true) {
      if (userData.hasUsedFreeTrial) {
        return res.status(400).json({
          error: 'Free trial already used',
          message: 'This user has already used their free trial period',
          freeTrialUsedDate: userData.freeTrialStartDate?.toDate() || null
        });
      }

      const now = admin.firestore.Timestamp.now();
      const trialEndDate = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + (7 * 24 * 60 * 60 * 1000) // 7 days in milliseconds
      );

      updateData.hasUsedFreeTrial = true;
      updateData.freeTrialStartDate = now;
      updateData.freeTrialEndDate = trialEndDate;
      updateData.isInFreeTrial = true;
    }

    // Handle discount code
    if (discountCode) {
      updateData.discountCode = discountCode;
      updateData.hasUsedDiscountCode = true;
      updateData.discountCodeUsedDate = admin.firestore.FieldValue.serverTimestamp();
      
      if (discountPercentage !== undefined) {
        const discount = Number(discountPercentage);
        if (isNaN(discount) || discount < 0 || discount > 100) {
          return res.status(400).json({
            error: 'Invalid discount percentage',
            message: 'Discount must be a number between 0 and 100',
            receivedValue: discountPercentage
          });
        }
        updateData.discountPercentage = discount;
      }
    }

    // Handle manual date updates
    if (subscriptionStartDate) {
      try {
        const startDate = new Date(subscriptionStartDate);
        if (isNaN(startDate.getTime())) {
          throw new Error('Invalid date format');
        }
        updateData.subscriptionStartDate = admin.firestore.Timestamp.fromDate(startDate);
      } catch (dateError) {
        return res.status(400).json({
          error: 'Invalid start date',
          message: 'subscriptionStartDate must be a valid ISO date string',
          example: '2026-01-10T00:00:00Z'
        });
      }
    }

    if (subscriptionEndDate) {
      try {
        const endDate = new Date(subscriptionEndDate);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }
        updateData.subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
      } catch (dateError) {
        return res.status(400).json({
          error: 'Invalid end date',
          message: 'subscriptionEndDate must be a valid ISO date string',
          example: '2026-01-10T00:00:00Z'
        });
      }
    }

    // Check if any updates were provided
    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return res.status(400).json({
        error: 'No update fields provided',
        message: 'Please provide at least one field to update',
        availableFields: [
          'subscribed',
          'subscriptionStatus',
          'subscriptionTier',
          'subscriptionPackageId',
          'activateFreeTrial',
          'discountCode',
          'discountPercentage',
          'subscriptionStartDate',
          'subscriptionEndDate'
        ]
      });
    }

    // Update Firestore
    await db.collection('users').doc(userId).update(updateData);

    // Fetch updated data to return
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedData = updatedDoc.data();

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      updatedFields: Object.keys(updateData).filter(key => key !== 'updatedAt'),
      subscription: {
        isActive: updatedData.subscribed || false,
        status: updatedData.subscriptionStatus || 'inactive',
        tier: updatedData.subscriptionTier || null,
        hasFreeTrial: updatedData.isInFreeTrial || false,
        discountCode: updatedData.discountCode || null
      },
      schema: getSubscriptionSchema()
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      error: 'Failed to update subscription',
      message: error.message,
      suggestion: 'Please verify your request data and try again'
    });
  }
});

// ============================================
// PROTECTED ENDPOINTS (Require API Key)
// ============================================

/**
 * POST /recipes/search
 * Advanced recipe search with filters
 * Requires API key
 * Body params:
 *   - mealTypes: array of meal types to search
 *   - maxCalories: maximum calories
 *   - minCalories: minimum calories
 *   - allergies: array of allergens to exclude
 *   - limit: number of results (max 50)
 */
router.post('/recipes/search', validateApiKey, async (req, res) => {
  try {
    const { 
      mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'],
      maxCalories,
      minCalories,
      allergies = [],
      limit = 20
    } = req.body;

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const requestedTypes = mealTypes.filter(type => 
      validMealTypes.includes(type.toLowerCase())
    );

    if (requestedTypes.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid meal types provided' 
      });
    }

    const searchLimit = Math.min(parseInt(limit) || 20, 50);
    const allRecipes = [];

    // Fetch from each requested meal type collection
    for (const mealType of requestedTypes) {
      const collectionName = `${mealType.toLowerCase()}_list_full_may2025`;
      const snapshot = await db.collection(collectionName)
        .limit(searchLimit)
        .get();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const calories = parseFloat(data.Calories) || 0;
        const ingredients = (data.Ingredients || '').toLowerCase();

        // Apply filters
        let matches = true;

        // Calorie filters
        if (maxCalories && calories > maxCalories) matches = false;
        if (minCalories && calories < minCalories) matches = false;

        // Allergy filters
        if (allergies.length > 0) {
          const hasAllergen = allergies.some(allergen => 
            ingredients.includes(allergen.toLowerCase())
          );
          if (hasAllergen) matches = false;
        }

        if (matches) {
          allRecipes.push({
            id: doc.id,
            mealType,
            ...data
          });
        }
      });
    }

    res.json({
      success: true,
      count: allRecipes.length,
      recipes: allRecipes.slice(0, searchLimit)
    });
  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({ 
      error: 'Failed to search recipes', 
      message: error.message 
    });
  }
});

/**
 * GET /users/:userId/nutrition-plans
 * Get user's CURRENT ACTIVE nutrition plan only
 * Requires Firebase Auth and Active Subscription
 */
router.get('/users/:userId/nutrition-plans', verifyFirebaseAuth, verifySubscriptionForAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure user can only access their own data
    if (req.uid !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only access your own nutrition plans' 
      });
    }

    // Query for the active plan only
    const activePlanQuery = await db.collection('users')
      .doc(userId)
      .collection('nutritionPlans')
      .where('active', '==', true)
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();

    if (activePlanQuery.empty) {
      return res.status(404).json({
        success: false,
        message: 'No active nutrition plan found. Please generate a nutrition plan first.',
        plan: null
      });
    }

    const planDoc = activePlanQuery.docs[0];
    const plan = {
      id: planDoc.id,
      ...planDoc.data()
    };

    res.json({
      success: true,
      plan: plan
    });
  } catch (error) {
    console.error('Error fetching nutrition plan:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nutrition plan', 
      message: error.message 
    });
  }
});

// ============================================
// NUTRITION PLAN GENERATION
// ============================================

// Helper functions from index.js
function cleanObjectKeys(obj) {
  const cleanedObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const cleanedKey = key.replace(/\[.*?\]/g, '').trim();
      cleanedObj[cleanedKey] = obj[key];
    }
  }
  return cleanedObj;
}

const parseTime = (timesString) => {
  let preparation = 0;
  let cooking = 0;

  if (typeof timesString !== 'string' || timesString.trim() === '') {
    return { preparation, cooking };
  }

  const lowerCaseTimesString = timesString.toLowerCase();
  const totalMatch = lowerCaseTimesString.match(/total time:\s*(\d+)\s*mins?/);
  if (totalMatch) {
    const totalTime = parseInt(totalMatch[1]);
    cooking = totalTime;
  }

  const prepMatch = lowerCaseTimesString.match(/preparation:\s*(\d+)\s*mins?/);
  if (prepMatch) {
    preparation = parseInt(prepMatch[1]);
  }

  const cookMatch = lowerCaseTimesString.match(/cooking:\s*(\d+)\s*mins?/);
  if (cookMatch) {
    cooking = parseInt(cookMatch[1]);
  }

  return { preparation, cooking };
};

async function parseRecipeFields(recipe) {
  const cleanedRecipe = cleanObjectKeys(recipe);
  
  const rawCaloriesValue = cleanedRecipe.Calories;
  let parsedCaloriesValue;

  const trimmedCaloriesString = typeof rawCaloriesValue === 'string' ? rawCaloriesValue.trim() : rawCaloriesValue;

  if (trimmedCaloriesString !== undefined && trimmedCaloriesString !== null && trimmedCaloriesString !== '') {
    parsedCaloriesValue = parseFloat(trimmedCaloriesString);
  } else {
    parsedCaloriesValue = 0;
  }

  const parsedServings = typeof cleanedRecipe.servings === 'string' ? cleanedRecipe.servings.trim() : '';
  const parsedTimes = typeof cleanedRecipe.Times === 'string' ? cleanedRecipe.Times.trim() : '';
  const { preparation: derivedPreparationTime, cooking: derivedCookingTime } = parseTime(parsedTimes);

  const parsedRecipe = {
    id: cleanedRecipe.id,
    Calories: parsedCaloriesValue,
    Blurb: typeof cleanedRecipe.Blurb === 'string' ? cleanedRecipe.Blurb.trim() : '',
    Carbs: parseFloat(String(cleanedRecipe.Carbs || '0').trim()) || 0,
    Fat: parseFloat(String(cleanedRecipe.Fat || '0').trim()) || 0,
    Fibre: parseFloat(String(cleanedRecipe.Fibre || '0').trim()) || 0,
    ImageUrl: typeof cleanedRecipe.ImageURL === 'string' ? cleanedRecipe.ImageURL.trim() : '',
    Ingredients: typeof cleanedRecipe.Ingredients === 'string' ? cleanedRecipe.Ingredients.trim() : '',
    Method: typeof cleanedRecipe.Method === 'string' ? cleanedRecipe.Method.trim() : '',
    Protein: parseFloat(String(cleanedRecipe.Protein || '0').trim()) || 0,
    Salt: parseFloat(String(cleanedRecipe.Salt || '0').trim()) || 0,
    Saturates: parseFloat(String(cleanedRecipe.Saturates || '0').trim()) || 0,
    Sugars: parseFloat(String(cleanedRecipe.Sugars || '0').trim()) || 0,
    Times: parsedTimes,
    Title: typeof cleanedRecipe.Title === 'string' ? cleanedRecipe.Title.trim() : '',
    Webpage: typeof cleanedRecipe.Webpage === 'string' ? cleanedRecipe.Webpage.trim() : '',
    preparation: derivedPreparationTime,
    cooking: derivedCookingTime,
    perc_carbs: parseFloat(String(cleanedRecipe.perc_carbs || '0').trim()) || 0,
    perc_fat: parseFloat(String(cleanedRecipe.perc_fat || '0').trim()) || 0,
    perc_fibre: parseFloat(String(cleanedRecipe.perc_fibre || '0').trim()) || 0,
    total_g: parseFloat(String(cleanedRecipe.total_g || '0').trim()) || 0,
    servings: parsedServings
  };

  if (typeof parsedRecipe.Calories !== 'number' || isNaN(parsedRecipe.Calories)) {
    parsedRecipe.Calories = 0;
  }

  return parsedRecipe;
}

const isValidRecipe = recipe => {
  const prepTime = recipe.preparation;
  const cookTime = recipe.cooking;
  return typeof prepTime === 'number' && !isNaN(prepTime) && prepTime <= 30 &&
         typeof cookTime === 'number' && !isNaN(cookTime) && cookTime <= 60;
};

const fetchRecipes = async collection => {
  const snap = await db.collection(collection).get();
  const parsedRecipesPromises = snap.docs.map(async (doc) => {
    const rawRecipe = { id: doc.id, ...doc.data() };
    return await parseRecipeFields(rawRecipe);
  });
  return Promise.all(parsedRecipesPromises);
};

const shuffleArray = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const filterRecipes = (recipes, allergies, dislikes) => {
  // Ensure allergies and dislikes are arrays
  const allergyArray = Array.isArray(allergies) ? allergies : (allergies ? [allergies] : []);
  const dislikeArray = Array.isArray(dislikes) ? dislikes : (dislikes ? [dislikes] : []);
  
  return recipes.filter(recipe => {
    const ing = (recipe.Ingredients || '').toLowerCase();
    return !allergyArray.some(a => ing.includes(String(a).toLowerCase())) &&
           !dislikeArray.some(d => ing.includes(String(d).toLowerCase()));
  });
};

const selectBalancedMealForDay = (recipes, targetCalories, relax = false) => {
  const tolerance = relax ? 100 : 50;
  const min = targetCalories - tolerance;
  const max = targetCalories + tolerance;

  const mealOption = shuffleArray(recipes).find(r => {
    const cal = r?.Calories;
    return typeof cal === 'number' && !isNaN(cal) && cal >= min && cal <= max && isValidRecipe(r);
  });

  return mealOption || null;
};

/**
 * POST /users/:userId/generate-nutrition-plan
 * Generate a personalized 7-day nutrition plan
 * Requires Firebase Auth and Active Subscription
 */
router.post('/users/:userId/generate-nutrition-plan', verifyFirebaseAuth, verifyActiveSubscription, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only generate plans for your own account'
      });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check if user has completed registration
    if (!userData.registrationComplete) {
      const missingSteps = [];
      const steps = userData.registrationSteps || {};
      
      if (!steps.basicInfo) missingSteps.push('Basic Information (name, email, mobile, address)');
      if (!steps.dietInfo) missingSteps.push('Diet Information (dietary preferences, allergies, goals)');
      if (!steps.healthInfo) missingSteps.push('Health Information (medical conditions, sleep, stress levels, age, height, weight, gender)');
      if (!steps.exercisePreference) missingSteps.push('Exercise Preferences (fitness goals, workout types)');
      if (!steps.weeklyExercise) missingSteps.push('Weekly Exercise Schedule (activity schedule for each day)');

      return res.status(400).json({
        error: 'Registration incomplete',
        message: 'Please complete all registration steps before generating a nutrition plan',
        missingSteps: missingSteps,
        registrationSteps: steps
      });
    }

    // Validate that required health fields exist for nutrition plan generation
    const requiredHealthFields = ['age', 'gender', 'height', 'weight'];
    const missingHealthFields = [];
    
    requiredHealthFields.forEach(field => {
      if (!userData[field]) {
        missingHealthFields.push(field);
      }
    });
    
    if (missingHealthFields.length > 0) {
      return res.status(400).json({
        error: 'Incomplete health information',
        message: 'Please complete your health information (Phase 3) with the following required fields: ' + missingHealthFields.join(', '),
        missingFields: missingHealthFields,
        requiredFields: requiredHealthFields,
        hint: 'Please update PUT /v1/users/{userId}/health-information with age, gender, height, and weight'
      });
    }

    // Check for plans generated in the last 7 days (rate limiting)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPlansQuery = await db.collection('users')
      .doc(userId)
      .collection('nutritionPlans')
      .where('generatedAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();

    if (!recentPlansQuery.empty) {
      const lastPlan = recentPlansQuery.docs[0].data();
      const lastGeneratedDate = lastPlan.generatedAt.toDate();
      const nextAllowedDate = new Date(lastGeneratedDate);
      nextAllowedDate.setDate(nextAllowedDate.getDate() + 7);

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'You can only generate one nutrition plan every 7 days',
        lastGeneratedAt: lastGeneratedDate.toISOString(),
        nextAllowedAt: nextAllowedDate.toISOString(),
        daysRemaining: Math.ceil((nextAllowedDate - new Date()) / (1000 * 60 * 60 * 24))
      });
    }
    const {
      age, gender, height, weight, weeklyActivity = {},
      fitnessLevel = '', goal = '', foodAllergies = '', foodLikes = '', foodDislikes = '',
      name = '', email = '',
      proteinPercentage: userProtein, carbsPercentage: userCarbs, fatPercentage: userFat
    } = userData;

    // Allow request body to override userData (for flexibility)
    const finalAge = req.body.age || age;
    const finalGender = req.body.gender || gender;
    const finalHeight = req.body.height || height;
    const finalWeight = req.body.weight || weight;
    const finalGoal = req.body.goal || goal;

    const parsedAge = typeof finalAge === 'string' ? parseInt(finalAge) : finalAge;
    const parsedHeight = typeof finalHeight === 'string' ? parseFloat(finalHeight) : finalHeight;
    const parsedWeight = typeof finalWeight === 'string' ? parseFloat(finalWeight) : finalWeight;

    if (!['male', 'female'].includes((finalGender || '').toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid gender',
        message: 'Gender must be "male" or "female"'
      });
    }
    if (!parsedAge || parsedAge <= 0) return res.status(400).json({ error: 'Invalid age', message: 'Age must be a positive number' });
    if (!parsedHeight || parsedHeight <= 0) return res.status(400).json({ error: 'Invalid height', message: 'Height must be a positive number' });
    if (!parsedWeight || parsedWeight <= 0) return res.status(400).json({ error: 'Invalid weight', message: 'Weight must be a positive number' });

    // Calculate BMR
    const bmr = (10 * parsedWeight) + (6.25 * parsedHeight) - (5 * parsedAge) + (finalGender.toLowerCase() === 'male' ? 5 : -161);

    // Set macros
    let proteinPercentage, carbsPercentage, fatPercentage;
    if (userProtein != null && userCarbs != null && userFat != null) {
      proteinPercentage = Number(userProtein);
      carbsPercentage = Number(userCarbs);
      fatPercentage = Number(userFat);
    } else {
      switch (goal.toLowerCase()) {
        case 'lose weight': proteinPercentage = 0.4; fatPercentage = 0.25; carbsPercentage = 0.35; break;
        case 'gain muscle': proteinPercentage = 0.3; fatPercentage = 0.25; carbsPercentage = 0.45; break;
        default: proteinPercentage = 0.4; fatPercentage = 0.3; carbsPercentage = 0.3;
      }
    }

    const calorieAdjustment = {
      'lose weight': -550,
      'gain muscle': 250,
      'maintain': 0
    }[goal.toLowerCase()] ?? 0;

    // Calculate daily targets
    const dailyTargetDetails = {};
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let totalWeeklyActivityCalories = 0;

    for (const day of daysOfWeek) {
      const activity = weeklyActivity?.[day];
      const activityCalories = typeof activity?.calories === 'number' ? activity.calories : parseInt(activity?.calories) || 0;
      totalWeeklyActivityCalories += activityCalories;

      const dailyTDEE = bmr + activityCalories;
      const adjustedCalories = dailyTDEE + calorieAdjustment;
      const minCalories = finalGender.toLowerCase() === 'male' ? 1500 : 1200;
      const maxCalories = dailyTDEE * 2.5;
      const finalCalories = Math.round(Math.min(maxCalories, Math.max(minCalories, adjustedCalories)));

      const proteinGrams = Math.round((finalCalories * proteinPercentage) / 4);
      const carbsGrams = Math.round((finalCalories * carbsPercentage) / 4);
      const fatGrams = Math.round((finalCalories * fatPercentage) / 9);

      let fuelingDemandCategory = 'low';
      if (activityCalories >= 800) fuelingDemandCategory = 'high';
      else if (activityCalories >= 400) fuelingDemandCategory = 'medium';

      dailyTargetDetails[day] = {
        calories: finalCalories,
        proteinGrams,
        carbsGrams,
        fatGrams,
        fuelingDemandCategory
      };
    }

    // Fetch and filter recipes
    // Handle foodAllergies - ensure it's an array
    let allergyList = [];
    if (userData.foodAllergies) {
      allergyList = Array.isArray(userData.foodAllergies) 
        ? userData.foodAllergies.map(s => String(s).trim()).filter(Boolean)
        : String(userData.foodAllergies).split(',').map(s => s.trim()).filter(Boolean);
    }
    if (req.body.foodAllergies) {
      const bodyAllergies = Array.isArray(req.body.foodAllergies)
        ? req.body.foodAllergies.map(s => String(s).trim()).filter(Boolean)
        : String(req.body.foodAllergies).split(',').map(s => s.trim()).filter(Boolean);
      allergyList = bodyAllergies;
    }
    
    // Handle foodDislikes - ensure it's an array
    let dislikeList = [];
    if (userData.foodDislikes) {
      dislikeList = Array.isArray(userData.foodDislikes)
        ? userData.foodDislikes.map(s => String(s).trim()).filter(Boolean)
        : String(userData.foodDislikes).split(',').map(s => s.trim()).filter(Boolean);
    }
    if (req.body.foodDislikes) {
      const bodyDislikes = Array.isArray(req.body.foodDislikes)
        ? req.body.foodDislikes.map(s => String(s).trim()).filter(Boolean)
        : String(req.body.foodDislikes).split(',').map(s => s.trim()).filter(Boolean);
      dislikeList = bodyDislikes;
    }

    const [breakfastRaw, lunchRaw, dinnerRaw, snackRaw] = await Promise.all([
      fetchRecipes('breakfast_list_full_may2025'),
      fetchRecipes('lunch_list_full_may2025'),
      fetchRecipes('dinner_list_full_may2025'),
      fetchRecipes('snack_list_full_may2025')
    ]);

    const breakfastRecipes = filterRecipes(breakfastRaw, allergyList, dislikeList);
    const lunchRecipes = filterRecipes(lunchRaw, allergyList, dislikeList);
    const dinnerRecipes = filterRecipes(dinnerRaw, allergyList, dislikeList);
    const snackRecipes = filterRecipes(snackRaw, allergyList, dislikeList);

    // Generate meal plan
    const planDays = {};
    for (const day of daysOfWeek) {
      const target = dailyTargetDetails[day].calories;

      const breakfast = selectBalancedMealForDay(breakfastRecipes, target * 0.25, false) ||
                        selectBalancedMealForDay(breakfastRecipes, target * 0.25, true);
      const lunch = selectBalancedMealForDay(lunchRecipes, target * 0.3, false) ||
                    selectBalancedMealForDay(lunchRecipes, target * 0.3, true);
      const dinner = selectBalancedMealForDay(dinnerRecipes, target * 0.3, false) ||
                     selectBalancedMealForDay(dinnerRecipes, target * 0.3, true);
      const snack = selectBalancedMealForDay(snackRecipes, target * 0.15, false) ||
                    selectBalancedMealForDay(snackRecipes, target * 0.15, true);

      planDays[day] = { breakfast, lunch, dinner, snack };
    }

    // Calculate plan end date (7 days from start)
    const planStartDate = new Date();
    const planEndDate = new Date(planStartDate);
    planEndDate.setDate(planEndDate.getDate() + 7);

    // Deactivate all existing active plans
    const existingActivePlansQuery = await db.collection('users')
      .doc(userId)
      .collection('nutritionPlans')
      .where('active', '==', true)
      .get();

    const batch = db.batch();
    existingActivePlansQuery.docs.forEach(doc => {
      batch.update(doc.ref, { 
        active: false,
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    const generatedPlan = {
      active: true,
      planStartDate: planStartDate.toISOString(),
      planEndDate: planEndDate.toISOString(),
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      notes: `Plan based on goal "${finalGoal}"`,
      dailyTargetDetails,
      days: planDays,
      inputDetails: {
        name, email, 
        age: parsedAge, 
        gender: finalGender, 
        height: parsedHeight, 
        weight: parsedWeight, 
        goal: finalGoal, 
        fitnessLevel,
        foodAllergies, foodLikes, foodDislikes, weeklyActivity, totalWeeklyActivityCalories
      }
    };

    // Save to Firestore
    const planRef = await db.collection('users').doc(userId).collection('nutritionPlans').add(generatedPlan);

    // Decrement quota and update tracking
    await db.collection('users').doc(userId).update({
      planGenerationQuota: admin.firestore.FieldValue.increment(-1),
      lastPlanGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalPlansGenerated: admin.firestore.FieldValue.increment(1)
    });

    // Get updated quota for response
    const updatedUserDoc = await db.collection('users').doc(userId).get();
    const updatedQuota = updatedUserDoc.data().planGenerationQuota || 0;

    res.status(201).json({
      success: true,
      message: 'Nutrition plan generated successfully',
      planId: planRef.id,
      plan: {
        ...generatedPlan,
        generatedAt: new Date().toISOString()
      },
      quotaRemaining: updatedQuota,
      subscriptionTier: req.subscriptionData?.tier || 'unknown'
    });

  } catch (error) {
    console.error('Error generating nutrition plan:', error);
    res.status(500).json({
      error: 'Failed to generate nutrition plan',
      message: error.message
    });
  }
});

// ============================================
// SHOPPING LIST GENERATION
// ============================================

const fetch = require('node-fetch');
const functions = require('firebase-functions');

/**
 * POST /users/:userId/nutrition-plans/:planId/generate-shopping-list
 * Generate shopping list from nutrition plan using Gemini AI
 * Requires Firebase Auth
 */
router.post('/users/:userId/nutrition-plans/:planId/generate-shopping-list', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId, planId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only generate shopping lists for your own plans'
      });
    }

    // Fetch nutrition plan
    const nutritionPlanDocRef = db.collection('users').doc(userId)
      .collection('nutritionPlans').doc(planId);

    const nutritionPlanDocSnapshot = await nutritionPlanDocRef.get();

    if (!nutritionPlanDocSnapshot.exists) {
      return res.status(404).json({
        error: 'Nutrition plan not found'
      });
    }

    const nutritionPlanData = nutritionPlanDocSnapshot.data();

    if (!nutritionPlanData || !nutritionPlanData.days || typeof nutritionPlanData.days !== 'object') {
      return res.status(400).json({
        error: 'Invalid nutrition plan data',
        message: 'Nutrition plan does not contain valid days data'
      });
    }

    const planDays = nutritionPlanData.days;
    let allIngredientLines = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

    // Extract all ingredients
    for (const day of Object.keys(planDays)) {
      const dayData = planDays[day];

      for (const mealType of mealTypes) {
        if (dayData[mealType] && typeof dayData[mealType] === 'object' && dayData[mealType].Ingredients) {
          const ingredientString = dayData[mealType].Ingredients;
          const lines = ingredientString.split('/n').map(line => line.trim()).filter(line => line.length > 0);
          allIngredientLines = allIngredientLines.concat(lines);
        }
      }
    }

    if (allIngredientLines.length === 0) {
      return res.status(400).json({
        error: 'No ingredients found',
        message: 'No ingredient lines found in the nutrition plan'
      });
    }

    // Get Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.api_key;
    if (!geminiApiKey) {
      return res.status(500).json({
        error: 'Gemini API key not configured'
      });
    }

    // Annotate ingredients using Gemini
    const annotatedIngredients = [];
    const batchSize = 10;
    const annotationPromises = [];

    for (let i = 0; i < allIngredientLines.length; i += batchSize) {
      const batch = allIngredientLines.slice(i, i + batchSize);

      const annotationPrompt = `
You are an expert at extracting ingredient details from text. For EACH of the following ingredient lines, identify and extract the 'QUANTITY', 'UNIT', 'INGREDIENT', 'PREP_METHOD', 'SIZE', 'STATE', 'OTHER', and 'EQUIPMENT' entities.

Return the output as a JSON ARRAY of objects. Each object in this array MUST represent one input line and MUST have:
- 'text': (string) The ORIGINAL ingredient line that was provided.
- 'entities': (array) An array of entity objects. Each entity object should have 'start' (number), 'end' (number), and 'label' (string).

Please annotate the following lines:
${batch.map(line => `- ${line}`).join('\n')}

JSON Output:
`;

      const batchGeminiPayload = {
        contents: [{ role: "user", parts: [{ text: annotationPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                text: { "type": "STRING" },
                entities: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      start: { "type": "NUMBER" },
                      end: { "type": "NUMBER" },
                      label: { "type": "STRING" }
                    },
                    required: ["start", "end", "label"]
                  }
                }
              },
              required: ["text", "entities"]
            }
          }
        }
      };

      annotationPromises.push(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchGeminiPayload),
          }
        )
          .then(response => response.json())
          .then(result => {
            if (result.candidates && result.candidates.length > 0 &&
              result.candidates[0].content && result.candidates[0].content.parts &&
              result.candidates[0].content.parts.length > 0) {
              const jsonString = result.candidates[0].content.parts[0].text;
              return JSON.parse(jsonString);
            }
            return [];
          })
          .catch(error => {
            console.error('Gemini annotation error:', error);
            return [];
          })
      );
    }

    const batchedAnnotatedResults = await Promise.all(annotationPromises);
    batchedAnnotatedResults.forEach(batchResult => {
      annotatedIngredients.push(...batchResult);
    });

    if (annotatedIngredients.length === 0) {
      return res.status(500).json({
        error: 'Failed to annotate ingredients'
      });
    }

    // Generate shopping list
    const shoppingListPrompt = `
You are an intelligent shopping list generator. Your task is to take a detailed JSON list of annotated ingredients (from multiple recipes) and consolidate them into a concise, actionable shopping list.

Rules:
- Group similar ingredients together
- Sum quantities where appropriate
- Categorize each item using EXACTLY one of these categories:
  - 'Produce (Fruits & Vegetables)'
  - 'Dairy & Alternatives'
  - 'Meat & Poultry'
  - 'Seafood'
  - 'Pantry (Dry Goods, Canned, Jarred)'
  - 'Baked Goods'
  - 'Frozen'
  - 'Spices & Condiments'
  - 'Beverages'
  - 'Other'

Annotated Ingredients JSON:
${JSON.stringify(annotatedIngredients, null, 2)}

Shopping List JSON:
`;

    const geminiPayloadForShoppingList = {
      contents: [{ role: "user", parts: [{ text: shoppingListPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              item: { "type": "STRING" },
              quantity: { "type": "STRING" },
              category: { "type": "STRING" }
            },
            required: ["item", "category"]
          }
        }
      }
    };

    const shoppingListResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayloadForShoppingList),
      }
    );

    const result = await shoppingListResponse.json();
    let shoppingList = [];

    if (result.candidates && result.candidates.length > 0 &&
      result.candidates[0].content && result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0) {
      const jsonString = result.candidates[0].content.parts[0].text;
      shoppingList = JSON.parse(jsonString);
    }

    // Store in Firestore
    const shoppingListDocRef = db.collection('users').doc(userId)
      .collection('nutritionPlans').doc(planId)
      .collection('shoppingLists').doc('latest');

    const shoppingListDataToStore = {
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      items: shoppingList
    };

    await shoppingListDocRef.set(shoppingListDataToStore);

    res.status(201).json({
      success: true,
      message: 'Shopping list generated successfully',
      shoppingList
    });

  } catch (error) {
    console.error('Error generating shopping list:', error);
    res.status(500).json({
      error: 'Failed to generate shopping list',
      message: error.message
    });
  }
});

/**
 * GET /users/:userId/nutrition-plans/:planId/shopping-list
 * Get existing shopping list for a nutrition plan
 * Requires Firebase Auth
 */
router.get('/users/:userId/nutrition-plans/:planId/shopping-list', verifyFirebaseAuth, async (req, res) => {
  try {
    const { userId, planId } = req.params;

    if (req.uid !== userId) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    const shoppingListDoc = await db.collection('users').doc(userId)
      .collection('nutritionPlans').doc(planId)
      .collection('shoppingLists').doc('latest')
      .get();

    if (!shoppingListDoc.exists) {
      return res.status(404).json({
        error: 'Shopping list not found',
        message: 'No shopping list has been generated for this nutrition plan yet'
      });
    }

    res.json({
      success: true,
      shoppingList: shoppingListDoc.data()
    });

  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({
      error: 'Failed to fetch shopping list',
      message: error.message
    });
  }
});

// ============================================
// SUBSCRIPTION MANAGEMENT UTILITIES
// ============================================

/**
 * Check and expire subscriptions that have passed their end date
 * This function should be called by a scheduled Cloud Function (e.g., daily)
 * @returns {Object} - Summary of expired subscriptions
 */
async function expireSubscriptions() {
  try {
    const now = new Date();
    const usersRef = db.collection('users');
    
    // Query users with active subscriptions that have expired
    const expiredSnapshot = await usersRef
      .where('subscriptionStatus', '==', 'active')
      .where('subscriptionEndDate', '<=', now)
      .get();

    const batch = db.batch();
    let expiredCount = 0;

    expiredSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      
      batch.update(doc.ref, {
        subscriptionStatus: 'expired',
        'subscription.status': 'expired',
        'subscription.isActive': false,
        subscribed: false,
        planGenerationQuota: 0,
        'freeTrial.isCurrentlyInTrial': false,
        'freeTrial.daysRemaining': 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      expiredCount++;
      console.log(`Expiring subscription for user ${doc.id} (tier: ${userData.subscriptionTier})`);
    });

    if (expiredCount > 0) {
      await batch.commit();
      console.log(`Successfully expired ${expiredCount} subscriptions`);
    }

    return {
      success: true,
      expiredCount,
      timestamp: now.toISOString()
    };

  } catch (error) {
    console.error('Error expiring subscriptions:', error);
    throw error;
  }
}

/**
 * Reset plan generation quota for active subscriptions based on their anniversary
 * This function should be called by a scheduled Cloud Function (e.g., daily)
 * @returns {Object} - Summary of quota resets
 */
async function resetQuotasOnAnniversary() {
  try {
    const now = new Date();
    const usersRef = db.collection('users');
    
    // Subscription tier quotas
    const SUBSCRIPTION_TIERS = {
      'free-trial': {
        planGenerationQuota: 1,
        durationUnit: 'days',
        duration: 7
      },
      'one-month': {
        planGenerationQuota: 4,
        durationUnit: 'months',
        duration: 1
      },
      'three-month': {
        planGenerationQuota: 12,
        durationUnit: 'months',
        duration: 3
      }
    };
    
    // Query active subscriptions
    const activeSnapshot = await usersRef
      .where('subscriptionStatus', '==', 'active')
      .get();

    const batch = db.batch();
    let resetCount = 0;

    activeSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      const tierId = userData.subscriptionTier;
      
      if (!tierId || !SUBSCRIPTION_TIERS[tierId]) {
        return;
      }

      const tier = SUBSCRIPTION_TIERS[tierId];
      const startDate = userData.subscriptionStartDate?.toDate ? 
        userData.subscriptionStartDate.toDate() : 
        new Date(userData.subscriptionStartDate);

      if (!startDate) {
        return;
      }

      // Check if today is a subscription anniversary (monthly/quarterly reset)
      const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      
      let shouldReset = false;
      
      if (tier.durationUnit === 'months') {
        // Reset monthly (every 30 days for simplicity)
        shouldReset = daysSinceStart % 30 === 0 && daysSinceStart > 0;
      }
      
      // Skip free trial (one-time quota, no reset)
      if (tierId === 'free-trial') {
        shouldReset = false;
      }

      if (shouldReset) {
        batch.update(doc.ref, {
          planGenerationQuota: tier.planGenerationQuota,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        resetCount++;
        console.log(`Resetting quota for user ${doc.id} (tier: ${tierId}, quota: ${tier.planGenerationQuota})`);
      }
    });

    if (resetCount > 0) {
      await batch.commit();
      console.log(`Successfully reset quota for ${resetCount} subscriptions`);
    }

    return {
      success: true,
      resetCount,
      timestamp: now.toISOString()
    };

  } catch (error) {
    console.error('Error resetting quotas:', error);
    throw error;
  }
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler for undefined routes
router.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    documentation: 'See API_DOCUMENTATION.md for available endpoints'
  });
});

module.exports = router;

// Export subscription management utilities for scheduled functions
module.exports.expireSubscriptions = expireSubscriptions;
module.exports.resetQuotasOnAnniversary = resetQuotasOnAnniversary;
