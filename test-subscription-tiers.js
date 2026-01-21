/**
 * Test script for subscription tiers endpoint
 * Run with: node test-subscription-tiers.js
 */

const BASE_URL = 'http://localhost:5001/nufit-67bf0/us-central1/api/v1';
// Or use production: 'https://us-central1-nufit-67bf0.cloudfunctions.net/api/v1'

async function testPublicTiersEndpoint() {
  console.log('\n🧪 Testing GET /subscription/tiers (public)...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/subscription/tiers`);
    const data = await response.json();
    
    console.log('✅ Status:', response.status);
    console.log('📊 Response:\n', JSON.stringify(data, null, 2));
    
    // Validate response structure
    if (data.success && data.tiers && data.tiers.length === 3) {
      console.log('\n✅ Test PASSED: All 3 tiers returned');
      
      // Verify pricing
      const tiers = data.tiers;
      const freeTrial = tiers.find(t => t.id === 'free-trial');
      const monthly = tiers.find(t => t.id === 'one-month');
      const quarterly = tiers.find(t => t.id === 'three-month');
      
      console.log('\n💰 Pricing Verification:');
      console.log(`  Free Trial: ${freeTrial.price} AED (Expected: 0)`);
      console.log(`  Monthly: ${monthly.price} AED (Expected: 300)`);
      console.log(`  Quarterly: ${quarterly.price} AED (Expected: 750)`);
      
      if (freeTrial.price === 0 && monthly.price === 300 && quarterly.price === 750) {
        console.log('  ✅ All prices correct!');
      } else {
        console.log('  ❌ Price mismatch detected!');
      }
      
      // Verify quota
      console.log('\n📊 Quota Verification:');
      console.log(`  Free Trial: ${freeTrial.planGenerationQuota} plan(s) (Expected: 1)`);
      console.log(`  Monthly: ${monthly.planGenerationQuota} plan(s) (Expected: 4)`);
      console.log(`  Quarterly: ${quarterly.planGenerationQuota} plan(s) (Expected: 12)`);
      
    } else {
      console.log('\n❌ Test FAILED: Invalid response structure');
    }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testAuthenticatedTiersEndpoint(token) {
  console.log('\n🧪 Testing GET /subscription/tiers (authenticated)...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/subscription/tiers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    console.log('✅ Status:', response.status);
    console.log('📊 Response:\n', JSON.stringify(data, null, 2));
    
    // Validate response includes user status
    if (data.userStatus) {
      console.log('\n✅ Test PASSED: User-specific eligibility returned');
      console.log(`  Can Start Free Trial: ${data.userStatus.canStartFreeTrial}`);
      console.log(`  Current Tier: ${data.userStatus.currentTier || 'None'}`);
      console.log(`  Quota Remaining: ${data.userStatus.quotaRemaining}`);
    } else {
      console.log('\n⚠️  User status not included (token may be invalid)');
    }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testActivateFreeTrial(userId, token) {
  console.log('\n🧪 Testing PUT /users/:userId/subscription (activate trial)...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/users/${userId}/subscription`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        activateFreeTrial: true
      })
    });
    const data = await response.json();
    
    console.log('✅ Status:', response.status);
    console.log('📊 Response:\n', JSON.stringify(data, null, 2));
    
    if (data.success && data.subscription?.tier === 'free-trial') {
      console.log('\n✅ Test PASSED: Free trial activated successfully');
      console.log(`  Start Date: ${data.subscription.startDate}`);
      console.log(`  End Date: ${data.subscription.endDate}`);
      console.log(`  Quota: ${data.subscription.quotaRemaining}`);
    } else if (response.status === 403) {
      console.log('\n⚠️  Free trial not available (expected if already used)');
    } else {
      console.log('\n❌ Test FAILED: Unexpected response');
    }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testGetUserSubscription(userId, token) {
  console.log('\n🧪 Testing GET /users/:userId/subscription...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/users/${userId}/subscription`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    console.log('✅ Status:', response.status);
    console.log('📊 Response:\n', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Test PASSED: User subscription retrieved');
      console.log(`  Active: ${data.subscription.isActive}`);
      console.log(`  Status: ${data.subscription.status}`);
      console.log(`  Tier: ${data.subscription.tier || 'None'}`);
      console.log(`  Can Start Trial: ${data.flags.canStartFreeTrial}`);
    } else {
      console.log('\n❌ Test FAILED');
    }
    
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Subscription Tiers API Tests\n');
  console.log('=' .repeat(60));
  
  // Test 1: Public endpoint (no auth)
  await testPublicTiersEndpoint();
  
  console.log('\n' + '=' .repeat(60));
  
  // For authenticated tests, you need to provide:
  // - A valid Firebase ID token
  // - A user ID
  
  const TEST_USER_ID = process.env.TEST_USER_ID;
  const TEST_TOKEN = process.env.TEST_TOKEN;
  
  if (TEST_TOKEN && TEST_USER_ID) {
    // Test 2: Authenticated tiers endpoint
    await testAuthenticatedTiersEndpoint(TEST_TOKEN);
    console.log('\n' + '=' .repeat(60));
    
    // Test 3: Get user subscription
    await testGetUserSubscription(TEST_USER_ID, TEST_TOKEN);
    console.log('\n' + '=' .repeat(60));
    
    // Test 4: Activate free trial
    await testActivateFreeTrial(TEST_USER_ID, TEST_TOKEN);
    console.log('\n' + '=' .repeat(60));
  } else {
    console.log('\n⚠️  Skipping authenticated tests');
    console.log('   Set TEST_TOKEN and TEST_USER_ID environment variables to run them\n');
    console.log('   Example:');
    console.log('   TEST_USER_ID=your_user_id TEST_TOKEN=your_token node test-subscription-tiers.js');
  }
  
  console.log('\n✅ Tests complete!\n');
}

// Run the tests
runTests().catch(console.error);
