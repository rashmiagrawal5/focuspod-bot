// test-token-sheets.js - Test reading TTLock tokens from Google Sheets
require('dotenv').config();
const { getTTLockTokens, shouldRefreshTTLockToken } = require('./sheets');

async function test() {
  console.log('🧪 Testing TTLock Token from Google Sheets\n');
  console.log('=' .repeat(60));

  // Test 1: Read tokens
  console.log('\n📖 Test 1: Reading tokens from Google Sheets...');
  const tokens = await getTTLockTokens();

  if (tokens) {
    console.log('✅ Tokens loaded successfully!');
    console.log(`🔑 Access Token: ${tokens.accessToken.substring(0, 15)}...`);
    console.log(`🔄 Refresh Token: ${tokens.refreshToken.substring(0, 15)}...`);
    console.log(`📅 Last Refresh: ${tokens.lastRefresh}`);
  } else {
    console.log('❌ Failed to load tokens');
  }

  // Test 2: Check if refresh is needed
  console.log('\n📖 Test 2: Checking if token refresh is needed...');
  const needsRefresh = await shouldRefreshTTLockToken();
  console.log(`Result: ${needsRefresh ? '⚠️  Needs refresh' : '✅ Token is valid'}`);

  console.log('\n' + '=' .repeat(60));
  console.log('✨ Test complete!\n');
}

test().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
