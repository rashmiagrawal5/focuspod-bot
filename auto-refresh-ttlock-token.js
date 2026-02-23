// auto-refresh-ttlock-token.js - Automatically refresh TTLock token before expiry
// Run with: node auto-refresh-ttlock-token.js

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Google Sheets token management
const { saveTTLockTokens, shouldRefreshTTLockToken } = require('./sheets');

const CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const CURRENT_TOKEN = process.env.TTLOCK_ACCESS_TOKEN;
const CURRENT_REFRESH_TOKEN = process.env.TTLOCK_REFRESH_TOKEN;

// Fallback credentials (commented out - using refresh token instead)
// const USERNAME = 'rashmi.agrawal0905@gmail.com';
// const PASSWORD = 'Geet@@300322';

// Token refresh threshold: refresh if token expires in less than 11 days
const REFRESH_THRESHOLD_DAYS = 11;
const TOKEN_VALIDITY_DAYS = 90; // TTLock tokens are valid for 90 days

console.log('🔄 TTLock Auto Token Refresh\n');
console.log('=' .repeat(60));

// Check if token needs refresh based on Google Sheets timestamp
async function checkIfRefreshNeeded() {
  console.log('🔍 Checking token status from Google Sheets...');

  try {
    const needsRefresh = await shouldRefreshTTLockToken();
    return needsRefresh;
  } catch (error) {
    console.log('⚠️  Error checking Google Sheets. Checking local file...');

    // Fallback to local file check
    const tokenFile = path.join(__dirname, '.ttlock-token-info.json');

    try {
      if (fs.existsSync(tokenFile)) {
        const tokenInfo = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        const lastRefresh = new Date(tokenInfo.lastRefresh);
        const now = new Date();
        const daysSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60 * 24);

        console.log(`📅 Last token refresh (local): ${lastRefresh.toLocaleString()}`);
        console.log(`⏱️  Days since refresh: ${Math.floor(daysSinceRefresh)}`);
        console.log(`⏳ Token expires in ~${Math.floor(TOKEN_VALIDITY_DAYS - daysSinceRefresh)} days`);

        if (daysSinceRefresh >= (TOKEN_VALIDITY_DAYS - REFRESH_THRESHOLD_DAYS)) {
          console.log(`\n⚠️  Token needs refresh (${REFRESH_THRESHOLD_DAYS} day threshold reached)`);
          return true;
        } else {
          console.log(`\n✅ Token is still valid. No refresh needed.`);
          return false;
        }
      } else {
        console.log('⚠️  No token info found. Refreshing token...');
        return true;
      }
    } catch (fileError) {
      console.log('⚠️  Error reading local token info. Refreshing token...');
      return true;
    }
  }
}

// Save token refresh timestamp
function saveTokenInfo(accessToken, refreshToken) {
  const tokenFile = path.join(__dirname, '.ttlock-token-info.json');
  const tokenInfo = {
    lastRefresh: new Date().toISOString(),
    expiresIn: TOKEN_VALIDITY_DAYS * 24 * 60 * 60, // seconds
    tokenPreview: accessToken.substring(0, 10) + '...'
  };

  fs.writeFileSync(tokenFile, JSON.stringify(tokenInfo, null, 2));
  console.log(`💾 Token info saved to ${tokenFile}`);
}

// Update .env file with new token
function updateEnvFile(accessToken, refreshToken) {
  const envPath = path.join(__dirname, '.env');

  try {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update or add ACCESS_TOKEN
    if (envContent.includes('TTLOCK_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /TTLOCK_ACCESS_TOKEN=.*/,
        `TTLOCK_ACCESS_TOKEN=${accessToken}`
      );
    } else {
      envContent += `\nTTLOCK_ACCESS_TOKEN=${accessToken}`;
    }

    // Update or add REFRESH_TOKEN
    if (refreshToken) {
      if (envContent.includes('TTLOCK_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
          /TTLOCK_REFRESH_TOKEN=.*/,
          `TTLOCK_REFRESH_TOKEN=${refreshToken}`
        );
      } else {
        envContent += `\nTTLOCK_REFRESH_TOKEN=${refreshToken}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated with new token');

  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
    throw error;
  }
}

// Get new access token using refresh token (secure method)
async function refreshAccessToken() {
  console.log('\n🔄 Refreshing access token using refresh token...\n');

  if (!CURRENT_REFRESH_TOKEN) {
    console.error('❌ No refresh token available in .env');
    console.error('⚠️  Please run: node get-ttlock-token-simple.js');
    return false;
  }

  try {
    console.log('📤 Using refresh_token grant type (secure, no password needed)');

    const response = await axios.post('https://euapi.ttlock.com/oauth2/token', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: CURRENT_REFRESH_TOKEN
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    if (response.data.access_token) {
      const { access_token, refresh_token, expires_in } = response.data;

      console.log('✅ New token obtained successfully (via refresh token)!');
      console.log(`🔑 Token: ${access_token.substring(0, 15)}...`);
      console.log(`⏰ Expires in: ${expires_in} seconds (${Math.floor(expires_in / 86400)} days)`);

      // Update .env file
      updateEnvFile(access_token, refresh_token);

      // Save token info for future checks
      saveTokenInfo(access_token, refresh_token);

      // Save to Google Sheets (primary storage)
      console.log('\n💾 Saving tokens to Google Sheets...');
      const sheetSaved = await saveTTLockTokens(access_token, refresh_token);

      console.log('\n📋 Next Steps:');
      console.log('=' .repeat(60));
      console.log('1. ✅ Local .env updated automatically');
      if (sheetSaved) {
        console.log('2. ✅ Google Sheets updated (Railway will auto-sync)');
        console.log('3. 🚀 No Railway manual update needed!');
      } else {
        console.log('2. ⚠️  Google Sheets update failed');
        console.log('3. 🚀 Update Railway manually (if using):');
        console.log(`   railway variables --set TTLOCK_ACCESS_TOKEN="${access_token}"`);
        if (refresh_token) {
          console.log(`   railway variables --set TTLOCK_REFRESH_TOKEN="${refresh_token}"`);
        }
      }
      console.log('\n✨ Token refresh complete!\n');

      return true;
    }

  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    console.error('⚠️  Refresh token may be invalid. Run: node get-ttlock-token-simple.js');
    return false;
  }
}

// Main function
async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('❌ Missing CLIENT_ID or CLIENT_SECRET in .env file');
    process.exit(1);
  }

  // Check if refresh is needed
  const needsRefresh = await checkIfRefreshNeeded();

  if (needsRefresh) {
    const success = await refreshAccessToken();
    process.exit(success ? 0 : 1);
  } else {
    console.log('\n✨ All good! Token is still valid.\n');
    process.exit(0);
  }
}

main();
