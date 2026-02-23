// ttlock-token-checker.js - Check and refresh TTLock token on bot startup
// Uses refresh token for secure token renewal (no password storage)
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Import Google Sheets token management
const { getTTLockTokens, saveTTLockTokens, shouldRefreshTTLockToken } = require('./sheets');

const CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;

const REFRESH_THRESHOLD_DAYS = 7;
const TOKEN_VALIDITY_DAYS = 90;

// Fallback credentials (only used if refresh token fails)
// TODO: Remove these after verifying refresh token flow works
// const USERNAME = 'rashmi.agrawal0905@gmail.com';
// const PASSWORD = 'Geet@@300322';

// Check if token needs refresh (using Google Sheets)
async function checkTokenNeedsRefresh() {
  try {
    return await shouldRefreshTTLockToken();
  } catch (error) {
    console.log('⚠️  Error checking token from Google Sheets:', error.message);

    // Fallback to local file
    const tokenFile = path.join(__dirname, '.ttlock-token-info.json');

    try {
      if (fs.existsSync(tokenFile)) {
        const tokenInfo = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        const lastRefresh = new Date(tokenInfo.lastRefresh);
        const now = new Date();
        const daysSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60 * 24);

        console.log(`🔑 TTLock token age (local): ${Math.floor(daysSinceRefresh)} days (expires in ~${Math.floor(TOKEN_VALIDITY_DAYS - daysSinceRefresh)} days)`);

        return daysSinceRefresh >= (TOKEN_VALIDITY_DAYS - REFRESH_THRESHOLD_DAYS);
      }
    } catch (fileError) {
      console.log('⚠️  Unable to read local token info');
    }

    return false;
  }
}

// Save token info
function saveTokenInfo() {
  const tokenFile = path.join(__dirname, '.ttlock-token-info.json');
  const tokenInfo = {
    lastRefresh: new Date().toISOString(),
    expiresIn: TOKEN_VALIDITY_DAYS * 24 * 60 * 60
  };

  fs.writeFileSync(tokenFile, JSON.stringify(tokenInfo, null, 2));
}

// Update .env file
function updateEnvFile(accessToken, refreshToken) {
  const envPath = path.join(__dirname, '.env');

  try {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update ACCESS_TOKEN
    if (envContent.includes('TTLOCK_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /TTLOCK_ACCESS_TOKEN=.*/,
        `TTLOCK_ACCESS_TOKEN=${accessToken}`
      );
    }

    // Update REFRESH_TOKEN
    if (refreshToken && envContent.includes('TTLOCK_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /TTLOCK_REFRESH_TOKEN=.*/,
        `TTLOCK_REFRESH_TOKEN=${refreshToken}`
      );
    }

    fs.writeFileSync(envPath, envContent);
    process.env.TTLOCK_ACCESS_TOKEN = accessToken;
    if (refreshToken) {
      process.env.TTLOCK_REFRESH_TOKEN = refreshToken;
    }

    console.log('✅ Token updated in .env and environment');

  } catch (error) {
    console.error('❌ Error updating .env:', error.message);
  }
}

// Refresh token using refresh_token grant type (secure, no password needed)
async function refreshToken() {
  console.log('🔄 Refreshing TTLock token using refresh token...');

  let currentRefreshToken = process.env.TTLOCK_REFRESH_TOKEN;

  // Try to get refresh token from Google Sheets if not in env
  if (!currentRefreshToken) {
    try {
      const tokens = await getTTLockTokens();
      if (tokens && tokens.refreshToken) {
        currentRefreshToken = tokens.refreshToken;
        console.log('📝 Using refresh token from Google Sheets');
      }
    } catch (error) {
      console.log('⚠️  Could not load refresh token from Google Sheets');
    }
  }

  if (!currentRefreshToken) {
    console.error('❌ No refresh token available. Please run: node get-ttlock-token-simple.js');
    return false;
  }

  try {
    console.log('📤 Using refresh_token grant type (secure method)');

    const response = await axios.post('https://euapi.ttlock.com/oauth2/token', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: currentRefreshToken
      },
      timeout: 15000
    });

    if (response.data.access_token) {
      const { access_token, refresh_token } = response.data;

      // Update .env file (for local development)
      updateEnvFile(access_token, refresh_token);
      saveTokenInfo();

      // Save to Google Sheets (primary storage)
      console.log('💾 Saving tokens to Google Sheets...');
      const sheetSaved = await saveTTLockTokens(access_token, refresh_token);

      console.log('✅ TTLock token refreshed successfully (using refresh token)');
      console.log('🔑 New token preview: ' + access_token.substring(0, 15) + '...');

      if (sheetSaved) {
        console.log('✅ Tokens saved to Google Sheets (Railway will auto-sync)');
      } else {
        console.log('⚠️  Google Sheets update failed. Update Railway manually:');
        console.log('   railway variables --set TTLOCK_ACCESS_TOKEN="' + access_token + '"');
        console.log('   railway variables --set TTLOCK_REFRESH_TOKEN="' + refresh_token + '"');
      }

      return true;
    }

  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
    console.error('⚠️  You may need to regenerate tokens manually: node get-ttlock-token-simple.js');
    return false;
  }
}

// Check token on startup
async function checkTokenOnStartup() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('⚠️  TTLock credentials not configured, skipping token check');
    return;
  }

  console.log('🔍 Checking TTLock token status...');

  const needsRefresh = await checkTokenNeedsRefresh();

  if (needsRefresh) {
    console.log('⚠️  TTLock token needs refresh (within 7 days of expiry)');
    await refreshToken();
  } else {
    console.log('✅ TTLock token is valid');
  }
}

module.exports = {
  checkTokenOnStartup,
  checkTokenNeedsRefresh,
  refreshToken
};
