// test-ttlock.js - Diagnostic script for TTLock API issues
// Run with: node test-ttlock.js

const axios = require('axios');
require('dotenv').config();

const CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const ACCESS_TOKEN = process.env.TTLOCK_ACCESS_TOKEN;

// All TTLock API regions
const API_REGIONS = [
  'https://euapi.ttlock.com',
  'https://api.ttlock.com',
  'https://api.sciener.com'
];

console.log('🔐 TTLock API Diagnostic Tool\n');
console.log('=' .repeat(60));

// Check credentials
console.log('\n📋 Step 1: Checking Credentials');
console.log('-'.repeat(60));
if (!CLIENT_ID) {
  console.log('❌ TTLOCK_CLIENT_ID is missing!');
} else {
  console.log(`✅ TTLOCK_CLIENT_ID: ${CLIENT_ID.substring(0, 10)}...`);
}

if (!ACCESS_TOKEN) {
  console.log('❌ TTLOCK_ACCESS_TOKEN is missing!');
} else {
  console.log(`✅ TTLOCK_ACCESS_TOKEN: ${ACCESS_TOKEN.substring(0, 15)}...`);
}

if (!CLIENT_ID || !ACCESS_TOKEN) {
  console.log('\n⚠️ Missing credentials! Please check your .env file.');
  process.exit(1);
}

// Test each region
async function testRegion(apiBase) {
  console.log(`\n🌐 Testing: ${apiBase}`);
  console.log('-'.repeat(60));

  const payload = {
    clientId: CLIENT_ID,
    accessToken: ACCESS_TOKEN,
    date: Date.now(),
    pageNo: 1,
    pageSize: 20
  };

  try {
    console.log(`📤 Sending request to: ${apiBase}/v3/lock/list`);
    console.log(`⏱️ Timeout: 15 seconds`);

    const startTime = Date.now();
    const response = await axios.post(`${apiBase}/v3/lock/list`, payload, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    const endTime = Date.now();

    console.log(`⏱️ Response time: ${endTime - startTime}ms`);
    console.log(`📥 HTTP Status: ${response.status}`);
    console.log(`📥 Response data:`, JSON.stringify(response.data, null, 2));

    if (response.data.errcode === 0 || !response.data.errcode) {
      console.log(`✅ SUCCESS! Found ${response.data.list?.length || 0} locks`);
      return { success: true, region: apiBase, data: response.data };
    } else {
      console.log(`⚠️ API returned error code: ${response.data.errcode}`);
      console.log(`⚠️ Error message: ${response.data.errmsg}`);
      return { success: false, region: apiBase, error: response.data };
    }

  } catch (error) {
    console.log(`❌ Request Failed!`);

    if (error.response) {
      // Server responded with error status
      console.log(`❌ HTTP Status: ${error.response.status}`);
      console.log(`❌ Response data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.log(`❌ No response received`);
      console.log(`❌ Error code: ${error.code}`);
      console.log(`❌ Error message: ${error.message}`);
    } else {
      // Error setting up request
      console.log(`❌ Error: ${error.message}`);
    }

    return { success: false, region: apiBase, error: error.message };
  }
}

// Run tests
async function runDiagnostics() {
  console.log('\n\n📋 Step 2: Testing API Regions');
  console.log('='.repeat(60));

  const results = [];

  for (const region of API_REGIONS) {
    const result = await testRegion(region);
    results.push(result);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n📊 Summary');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;

  if (successCount > 0) {
    console.log(`\n✅ ${successCount}/${results.length} regions working!`);
    results.filter(r => r.success).forEach(r => {
      console.log(`  ✓ ${r.region}`);
    });
  } else {
    console.log(`\n❌ All ${results.length} regions failed!`);
  }

  if (successCount < results.length) {
    console.log(`\n❌ Failed regions:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ✗ ${r.region}`);
      console.log(`    Reason: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
    });
  }

  // Recommendations
  console.log('\n\n💡 Recommendations');
  console.log('='.repeat(60));

  if (successCount === 0) {
    console.log(`
Possible issues:
1. Invalid credentials (CLIENT_ID or ACCESS_TOKEN)
2. Token expired - refresh your access token
3. Network/firewall blocking requests
4. Account suspended or locked
5. API endpoint changes

Next steps:
→ Verify credentials in TTLock developer portal
→ Generate new access token if expired
→ Check network connectivity
→ Contact TTLock support if issue persists
    `);
  } else {
    console.log(`
✅ At least one region is working!
→ Update TTLOCK_API_BASE in ttlock-integration.js to use working region
→ Or rely on the automatic fallback mechanism
    `);
  }
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error('\n❌ Fatal error running diagnostics:', error);
  process.exit(1);
});
