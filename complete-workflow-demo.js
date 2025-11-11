// COMPLETE WORKFLOW: Building a Nutrition App with Nufit API
// This demonstrates the FULL process
// Run with: node complete-workflow-demo.js

const fetch = require('node-fetch');

// ============================================
// CONFIGURATION
// ============================================
const API_BASE = 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAYJq0CK3bEkCpxGsaVRDh0JIVZx6wHRiA',
  authDomain: 'nufit-67bf0.firebaseapp.com',
  projectId: 'nufit-67bf0'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '═'.repeat(70));
  log(title, 'cyan');
  console.log('═'.repeat(70) + '\n');
}

// ============================================
// STEP-BY-STEP WORKFLOW
// ============================================

async function completeWorkflow() {
  try {
    section('EXTERNAL DEVELOPER WORKFLOW: Building a Nutrition App');
    
    // ========================================
    // STEP 1: EXPLORE PUBLIC ENDPOINTS
    // ========================================
    section('STEP 1: Explore Public Endpoints (No Auth Required)');
    
    log('As a developer, you first want to see what data is available...', 'blue');
    console.log();
    
    // 1a. Health check
    log('1a. Check if API is online:', 'yellow');
    log('    GET /health', 'magenta');
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    console.log('    Response:', JSON.stringify(health, null, 2));
    console.log();
    
    // 1b. Get recipe counts
    log('1b. See how many recipes are available:', 'yellow');
    log('    GET /recipes/count', 'magenta');
    const counts = await fetch(`${API_BASE}/recipes/count`).then(r => r.json());
    console.log('    Response:');
    console.log(`      - Breakfast recipes: ${counts.counts.breakfast_list_full_may2025}`);
    console.log(`      - Lunch recipes: ${counts.counts.lunch_list_full_may2025}`);
    console.log(`      - Dinner recipes: ${counts.counts.dinner_list_full_may2025}`);
    console.log(`      - Snack recipes: ${counts.counts.snack_list_full_may2025}`);
    console.log();
    
    // 1c. Browse some recipes
    log('1c. Browse sample breakfast recipes:', 'yellow');
    log('    GET /recipes/breakfast?limit=3', 'magenta');
    const recipes = await fetch(`${API_BASE}/recipes/breakfast?limit=3`).then(r => r.json());
    console.log(`    Found ${recipes.recipes.length} recipes:`);
    recipes.recipes.forEach((recipe, idx) => {
      console.log(`      ${idx + 1}. ${recipe.Title || recipe.Recipe_Name || 'Unknown'}`);
      console.log(`         Calories: ${recipe.Calories || recipe.Calories_kcal || 'N/A'} | Protein: ${recipe.Protein || recipe.Protein_g || 'N/A'}g | Carbs: ${recipe.Carbs || recipe.Carbs_g || 'N/A'}g | Fat: ${recipe.Fat || recipe.Fat_g || 'N/A'}g`);
    });
    console.log();
    
    log('✓ Great! The API has 5000+ recipes and is working perfectly.', 'green');
    
    // ========================================
    // STEP 2: USER REGISTRATION
    // ========================================
    section('STEP 2: User Registration (First-time User)');
    
    log('Your app needs to collect user information and create an account...', 'blue');
    console.log();
    
    const newUser = {
      email: `developer_test_${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      name: 'Alex Developer',
      age: 28,
      gender: 'male',
      height: 175,
      weight: 70,
      goal: 'lose', // Options: 'lose', 'maintain', 'gain'
      weeklyActivity: {
        Monday: { activityName: 'Running', duration: 45, calories: 400 },
        Tuesday: { activityName: 'Yoga', duration: 30, calories: 150 },
        Wednesday: { activityName: 'Gym', duration: 60, calories: 350 },
        Thursday: { activityName: 'Rest', duration: 0, calories: 0 },
        Friday: { activityName: 'Swimming', duration: 45, calories: 400 },
        Saturday: { activityName: 'Cycling', duration: 90, calories: 500 },
        Sunday: { activityName: 'Rest', duration: 0, calories: 0 }
      }
    };
    
    log('2a. Your app collects this data from user:', 'yellow');
    console.log('    - Email, password (for authentication)');
    console.log('    - Name, age, gender, height, weight');
    console.log('    - Fitness goal (lose weight, maintain, or gain)');
    console.log('    - Weekly activity schedule');
    console.log();
    
    log('2b. Send registration request:', 'yellow');
    log('    POST /users/register', 'magenta');
    log(`    Body: ${JSON.stringify(newUser, null, 2)}`, 'magenta');
    console.log();
    
    const registerResponse = await fetch(`${API_BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    const registerData = await registerResponse.json();
    
    if (!registerData.success) {
      throw new Error(`Registration failed: ${registerData.error}`);
    }
    
    log('✓ User registered successfully!', 'green');
    console.log(`    User ID: ${registerData.userId}`);
    console.log(`    Email: ${newUser.email}`);
    console.log();
    
    const userId = registerData.userId;
    
    log('💡 Behind the scenes:', 'blue');
    console.log('   - Firebase Auth account created');
    console.log('   - User profile saved to Firestore');
    console.log('   - User can now sign in from any device');
    console.log();
    
    // ========================================
    // STEP 3: AUTHENTICATION
    // ========================================
    section('STEP 3: User Sign In (Return Visits)');
    
    log('When user opens your app, they need to sign in...', 'blue');
    console.log();
    
    log('3a. User provides email and password', 'yellow');
    console.log(`    Email: ${newUser.email}`);
    console.log(`    Password: ********`);
    console.log();
    
    log('3b. Authenticate with Firebase:', 'yellow');
    log('    POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword', 'magenta');
    console.log();
    
    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          returnSecureToken: true
        })
      }
    );
    const authData = await authResponse.json();
    
    if (!authData.idToken) {
      throw new Error(`Authentication failed: ${authData.error?.message}`);
    }
    
    log('✓ Authentication successful!', 'green');
    console.log(`    Token: ${authData.idToken.substring(0, 40)}...`);
    console.log(`    Valid for: ${authData.expiresIn} seconds (1 hour)`);
    console.log();
    
    const token = authData.idToken;
    
    log('💡 Important:', 'blue');
    console.log('   - Store this token securely in your app');
    console.log('   - Include it in ALL authenticated API requests');
    console.log('   - Token expires after 1 hour - refresh when needed');
    console.log();
    
    // ========================================
    // STEP 4: GET USER PROFILE
    // ========================================
    section('STEP 4: Retrieve User Profile');
    
    log('Your app needs to show user their current data...', 'blue');
    console.log();
    
    log('4a. Request user profile:', 'yellow');
    log(`    GET /users/${userId}/profile`, 'magenta');
    log(`    Header: Authorization: Bearer ${token.substring(0, 30)}...`, 'magenta');
    console.log();
    
    const profileResponse = await fetch(`${API_BASE}/users/${userId}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileResponse.json();
    
    if (!profileData.success) {
      throw new Error(`Failed to get profile: ${profileData.error}`);
    }
    
    log('✓ Profile retrieved!', 'green');
    console.log('    User Data:');
    const profile = profileData.profile || profileData.user || {};
    console.log(`      Name: ${profile.name}`);
    console.log(`      Age: ${profile.age}`);
    console.log(`      Weight: ${profile.weight}kg`);
    console.log(`      Goal: ${profile.goal}`);
    console.log(`      Premium: ${profile.isPremium || false}`);
    console.log();
    
    log('💡 Use this data to:', 'blue');
    console.log('   - Display user dashboard');
    console.log('   - Show current settings');
    console.log('   - Pre-fill profile edit forms');
    console.log();
    
    // ========================================
    // STEP 5: UPDATE PROFILE (OPTIONAL)
    // ========================================
    section('STEP 5: Update User Profile (When User Changes Settings)');
    
    log('User wants to update their weight and goal...', 'blue');
    console.log();
    
    const updates = {
      weight: 68, // Lost 2kg!
      goal: 'maintain' // Reached goal weight
    };
    
    log('5a. Send update request:', 'yellow');
    log(`    PUT /users/${userId}/profile`, 'magenta');
    log(`    Header: Authorization: Bearer ${token.substring(0, 30)}...`, 'magenta');
    log(`    Body: ${JSON.stringify(updates, null, 2)}`, 'magenta');
    console.log();
    
    const updateResponse = await fetch(`${API_BASE}/users/${userId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    const updateData = await updateResponse.json();
    
    log('✓ Profile updated!', 'green');
    const updatedProfile = updateData.profile || updateData.user || {};
    console.log(`    New weight: ${updatedProfile.weight}kg`);
    console.log(`    New goal: ${updatedProfile.goal}`);
    console.log();
    
    // ========================================
    // STEP 6: GENERATE NUTRITION PLAN
    // ========================================
    section('STEP 6: Generate Personalized Nutrition Plan');
    
    log('This is the MAIN feature - generating the 7-day meal plan!', 'blue');
    console.log();
    
    log('6a. Request nutrition plan generation:', 'yellow');
    log(`    POST /users/${userId}/generate-nutrition-plan`, 'magenta');
    log(`    Header: Authorization: Bearer ${token.substring(0, 30)}...`, 'magenta');
    console.log();
    
    log('⏳ Generating plan... (this takes 10-15 seconds)', 'yellow');
    console.log('   - Calculating BMR (Basal Metabolic Rate)');
    console.log('   - Adjusting for daily activity levels');
    console.log('   - Applying goal adjustment (-500 cal for weight loss)');
    console.log('   - Calculating macro targets (protein, carbs, fat)');
    console.log('   - Selecting balanced recipes from 5000+ options');
    console.log('   - Creating 7-day meal plan...');
    console.log();
    
    const startTime = Date.now();
    const planResponse = await fetch(
      `${API_BASE}/users/${userId}/generate-nutrition-plan`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const planData = await planResponse.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!planData.success) {
      throw new Error(`Plan generation failed: ${planData.error}`);
    }
    
    log(`✓ Nutrition plan generated in ${duration}s!`, 'green');
    console.log(`    Plan ID: ${planData.planId}`);
    console.log();
    
    log('📊 What you receive:', 'blue');
    console.log('   - Complete 7-day meal plan');
    console.log('   - Daily calorie targets (adjusted per day)');
    console.log('   - Macro targets (protein, carbs, fat)');
    console.log('   - Breakfast, lunch, dinner, 2 snacks per day');
    console.log('   - Full recipes with ingredients & instructions');
    console.log('   - Nutritional information for each meal');
    console.log();
    
    // Show sample day
    const monday = planData.plan.days.Monday;
    const mondayTarget = planData.plan.dailyTargetDetails?.Monday || {};
    
    log('📅 Example: Monday\'s Plan', 'yellow');
    console.log(`    Target Calories: ${mondayTarget.calories || 'N/A'} cal`);
    console.log();
    
    const breakfast = monday.breakfast || {};
    console.log(`    🍳 Breakfast: ${breakfast.Title || breakfast.Recipe_Name || 'N/A'}`);
    console.log(`       ${breakfast.Calories || breakfast.Calories_kcal || 'N/A'} cal | P:${breakfast.Protein || breakfast.Protein_g || 'N/A'}g C:${breakfast.Carbs || breakfast.Carbs_g || 'N/A'}g F:${breakfast.Fat || breakfast.Fat_g || 'N/A'}g`);
    console.log(`       Prep time: ${breakfast.Prep_Time_min || breakfast['Prep Time (min)'] || 'N/A'} min`);
    console.log();
    
    const lunch = monday.lunch || {};
    console.log(`    🥗 Lunch: ${lunch.Title || lunch.Recipe_Name || 'N/A'}`);
    console.log(`       ${lunch.Calories || lunch.Calories_kcal || 'N/A'} cal | P:${lunch.Protein || lunch.Protein_g || 'N/A'}g C:${lunch.Carbs || lunch.Carbs_g || 'N/A'}g F:${lunch.Fat || lunch.Fat_g || 'N/A'}g`);
    console.log();
    
    const dinner = monday.dinner || {};
    console.log(`    🍝 Dinner: ${dinner.Title || dinner.Recipe_Name || 'N/A'}`);
    console.log(`       ${dinner.Calories || dinner.Calories_kcal || 'N/A'} cal | P:${dinner.Protein || dinner.Protein_g || 'N/A'}g C:${dinner.Carbs || dinner.Carbs_g || 'N/A'}g F:${dinner.Fat || dinner.Fat_g || 'N/A'}g`);
    console.log();
    
    // Handle snack (could be single item or array)
    const snackData = monday.snack || monday.snacks || {};
    const snacks = Array.isArray(snackData) ? snackData : [snackData];
    const snackNames = snacks.filter(s => s && (s.Title || s.Recipe_Name)).map(s => s.Title || s.Recipe_Name).join(', ');
    console.log(`    🍎 Snack: ${snackNames || 'N/A'}`);
    snacks.filter(s => s && (s.Calories || s.Calories_kcal)).forEach(snack => {
      console.log(`       ${snack.Calories || snack.Calories_kcal} cal (${snack.Title || snack.Recipe_Name})`);
    });
    console.log();
    
    // Calculate totals
    const totalCals = (breakfast.Calories || breakfast.Calories_kcal || 0) + 
                      (lunch.Calories || lunch.Calories_kcal || 0) + 
                      (dinner.Calories || dinner.Calories_kcal || 0) + 
                      snacks.reduce((sum, s) => sum + (s?.Calories || s?.Calories_kcal || 0), 0);
    console.log(`    Total: ~${Math.round(totalCals)} cal`);
    console.log();
    
    log('💡 In your app, you would:', 'blue');
    console.log('   - Display this in a calendar view');
    console.log('   - Show recipe cards with images');
    console.log('   - Let users view full recipe details');
    console.log('   - Allow users to track completed meals');
    console.log('   - Show progress toward daily goals');
    console.log();
    
    // ========================================
    // STEP 7: RETRIEVE SAVED PLANS
    // ========================================
    section('STEP 7: View Previous Nutrition Plans');
    
    log('User wants to see their meal plan history...', 'blue');
    console.log();
    
    log('7a. Request all nutrition plans:', 'yellow');
    log(`    GET /users/${userId}/nutrition-plans`, 'magenta');
    log(`    Header: Authorization: Bearer ${token.substring(0, 30)}...`, 'magenta');
    console.log();
    
    const plansResponse = await fetch(
      `${API_BASE}/users/${userId}/nutrition-plans`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const plansData = await plansResponse.json();
    
    log(`✓ Retrieved ${plansData.plans.length} plan(s)`, 'green');
    plansData.plans.forEach((plan, idx) => {
      const date = new Date(plan.createdAt).toLocaleString();
      console.log(`    ${idx + 1}. Created: ${date}`);
      console.log(`       Goal: ${plan.userProfile?.goal || 'N/A'}`);
    });
    console.log();
    
    // ========================================
    // STEP 8: GENERATE SHOPPING LIST
    // ========================================
    section('STEP 8: Generate AI-Powered Shopping List');
    
    log('User wants a shopping list for the next 3 days...', 'blue');
    console.log();
    
    const daysToShop = ['Monday', 'Tuesday', 'Wednesday'];
    
    log('8a. Request shopping list:', 'yellow');
    log(`    POST /users/${userId}/nutrition-plans/${planData.planId}/generate-shopping-list`, 'magenta');
    log(`    Header: Authorization: Bearer ${token.substring(0, 30)}...`, 'magenta');
    log(`    Body: { days: ${JSON.stringify(daysToShop)} }`, 'magenta');
    console.log();
    
    log('⏳ Generating shopping list with AI... (5-10 seconds)', 'yellow');
    console.log('   - Extracting ingredients from selected days');
    console.log('   - Using Google Gemini AI to organize items');
    console.log('   - Grouping by category and aisle...');
    console.log();
    
    const listResponse = await fetch(
      `${API_BASE}/users/${userId}/nutrition-plans/${planData.planId}/generate-shopping-list`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ days: daysToShop })
      }
    );
    const listData = await listResponse.json();
    
    if (!listData.success) {
      throw new Error(`Shopping list generation failed: ${listData.error}`);
    }
    
    log('✓ Shopping list generated!', 'green');
    console.log(`    List ID: ${listData.listId}`);
    console.log(`    Total items: ${listData.shoppingList.length}`);
    console.log();
    
    // Group by category
    const categories = {};
    listData.shoppingList.forEach(item => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });
    
    log('🛒 Shopping List (organized by category):', 'yellow');
    Object.keys(categories).slice(0, 5).forEach(category => {
      console.log(`\n    ${category}:`);
      categories[category].slice(0, 3).forEach(item => {
        console.log(`      ☐ ${item.item} - ${item.quantity}`);
      });
      if (categories[category].length > 3) {
        console.log(`      ... and ${categories[category].length - 3} more items`);
      }
    });
    console.log();
    
    log('💡 In your app, you would:', 'blue');
    console.log('   - Display as checkable list');
    console.log('   - Group by store sections');
    console.log('   - Allow users to check off items');
    console.log('   - Export to other shopping apps');
    console.log('   - Share list with family members');
    console.log();
    
    // ========================================
    // STEP 9: PAYMENT INTEGRATION (OPTIONAL)
    // ========================================
    section('STEP 9: Premium Subscription (Optional)');
    
    log('Upgrade user to premium for advanced features...', 'blue');
    console.log();
    
    log('9a. Create Stripe checkout session:', 'yellow');
    log('    POST /payments/create-checkout', 'magenta');
    log(`    Header: Authorization: Bearer ${token.substring(0, 30)}...`, 'magenta');
    log(`    Body: { email: "${newUser.email}" }`, 'magenta');
    console.log();
    
    const checkoutResponse = await fetch(
      `${API_BASE}/payments/create-checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newUser.email })
      }
    );
    const checkoutData = await checkoutResponse.json();
    
    if (checkoutData.success) {
      log('✓ Checkout session created!', 'green');
      console.log(`    Checkout URL: ${checkoutData.sessionUrl.substring(0, 50)}...`);
      console.log();
      log('💡 Next steps:', 'blue');
      console.log('   - Redirect user to this URL');
      console.log('   - They complete payment on Stripe');
      console.log('   - Webhook updates their premium status');
      console.log('   - User gets access to premium features');
      console.log();
    } else {
      log('Note: Payment setup requires Stripe configuration', 'yellow');
      console.log();
    }
    
    // ========================================
    // SUMMARY
    // ========================================
    section('✅ WORKFLOW COMPLETE!');
    
    log('You now know how to:', 'green');
    console.log('  1. ✓ Explore public recipe data');
    console.log('  2. ✓ Register new users');
    console.log('  3. ✓ Authenticate users with Firebase');
    console.log('  4. ✓ Retrieve user profiles');
    console.log('  5. ✓ Update user information');
    console.log('  6. ✓ Generate personalized nutrition plans');
    console.log('  7. ✓ Retrieve saved plans');
    console.log('  8. ✓ Generate AI shopping lists');
    console.log('  9. ✓ Handle premium subscriptions');
    console.log();
    
    log('📚 Resources for Developers:', 'blue');
    console.log('  - API Documentation: API_DOCUMENTATION.md');
    console.log('  - Quick Reference: API_QUICK_REFERENCE.md');
    console.log('  - Integration Guide: DEVELOPER_INTEGRATION_GUIDE.md');
    console.log('  - Testing Guide: TESTING_GUIDE.md');
    console.log();
    
    log('🚀 API Base URL:', 'blue');
    console.log(`  ${API_BASE}`);
    console.log();
    
    log('🔑 What You Need:', 'blue');
    console.log('  - Firebase Web API Key (for authentication)');
    console.log('  - User\'s Firebase ID token (after sign-in)');
    console.log('  - Optional: API key for advanced recipe search');
    console.log();
    
    log('⚡ Key Points:', 'blue');
    console.log('  - Public endpoints: No authentication needed');
    console.log('  - User endpoints: Require Firebase Auth token');
    console.log('  - Rate limit: 100 requests per 15 minutes');
    console.log('  - Token expires: Every 1 hour (refresh as needed)');
    console.log('  - Data storage: Automatic in Firestore');
    console.log();
    
    log('Need help? Contact: cshep1987@gmail.com', 'cyan');
    console.log();
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the complete workflow
completeWorkflow();
