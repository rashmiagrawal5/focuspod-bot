// get-ttlock-token-simple.js - Get TTLock token using username/password
// Run with: node get-ttlock-token-simple.js

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;

// TTLock account credentials
const USERNAME = 'rashmi.agrawal0905@gmail.com';
const PASSWORD = 'Geet@@300322';

console.log('🔐 TTLock Token Generator (Username/Password)\n');
console.log('=' .repeat(60));

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('❌ Missing CLIENT_ID or CLIENT_SECRET in .env file');
  process.exit(1);
}

console.log(`✅ Client ID: ${CLIENT_ID.substring(0, 10)}...`);
console.log(`✅ Client Secret: ${CLIENT_SECRET.substring(0, 10)}...`);
console.log(`✅ Username: ${USERNAME}`);
console.log('\n🔄 Attempting to get access token...\n');

async function getAccessToken() {
  try {
    // Method 1: Try password grant type
    console.log('📤 Method 1: Trying password grant...');

    // Create MD5 hash of password (some APIs require this)
    const passwordMd5 = crypto.createHash('md5').update(PASSWORD).digest('hex');

    const response = await axios.post('https://euapi.ttlock.com/oauth2/token', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: passwordMd5,
        grant_type: 'password'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    if (response.data.access_token) {
      console.log('✅ Success! Token received:\n');
      console.log(JSON.stringify(response.data, null, 2));

      const { access_token, refresh_token, expires_in } = response.data;

      console.log('\n📝 Update your .env file with:');
      console.log('=' .repeat(60));
      console.log(`TTLOCK_ACCESS_TOKEN=${access_token}`);
      if (refresh_token) {
        console.log(`TTLOCK_REFRESH_TOKEN=${refresh_token}`);
      }
      console.log(`\n⏰ Token expires in: ${expires_in} seconds (${Math.floor(expires_in / 3600)} hours)`);

      console.log('\n🚀 Next steps:');
      console.log('1. Update your .env file with the new token');
      console.log('2. Update Railway: railway variables --set TTLOCK_ACCESS_TOKEN="' + access_token + '"');
      if (refresh_token) {
        console.log('3. Save refresh token: railway variables --set TTLOCK_REFRESH_TOKEN="' + refresh_token + '"');
      }
      console.log('4. Restart your bot server');
      console.log('5. Test with: node test-ttlock.js\n');

      return;
    }

  } catch (error) {
    console.log('❌ Method 1 failed:', error.response?.data || error.message);
  }

  // Method 2: Try with plain password
  try {
    console.log('\n📤 Method 2: Trying with plain password...');

    const response = await axios.post('https://euapi.ttlock.com/oauth2/token', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD,
        grant_type: 'password'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    if (response.data.access_token) {
      console.log('✅ Success! Token received:\n');
      console.log(JSON.stringify(response.data, null, 2));

      const { access_token, refresh_token, expires_in } = response.data;

      console.log('\n📝 Update your .env file with:');
      console.log('=' .repeat(60));
      console.log(`TTLOCK_ACCESS_TOKEN=${access_token}`);
      if (refresh_token) {
        console.log(`TTLOCK_REFRESH_TOKEN=${refresh_token}`);
      }

      return;
    }

  } catch (error) {
    console.log('❌ Method 2 failed:', error.response?.data || error.message);
  }

  console.log('\n❌ All methods failed. You need to:');
  console.log('1. Configure redirect_uri in TTLock portal');
  console.log('2. Or contact TTLock support for token generation\n');
}

getAccessToken();
