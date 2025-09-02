// ttlock-integration.js - Production TTLock integration for FocusPod

const axios = require('axios');
require('dotenv').config();

// Import date utilities for consistency
const { toSheetFormat, fromSheetFormat, getISTTime } = require('./date-utils');

// TTLock API Configuration
const TTLOCK_API_BASE = 'https://euapi.ttlock.com'; // Your working region
const CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const ACCESS_TOKEN = process.env.TTLOCK_ACCESS_TOKEN;

// Fallback API regions if primary fails
const FALLBACK_REGIONS = [
  'https://api.ttlock.com',
  'https://api.sciener.com'
];

// Helper function to make TTLock API calls with fallback
async function makeTTLockRequest(endpoint, data = {}, retries = 2) {
  const payload = {
    clientId: CLIENT_ID,
    accessToken: ACCESS_TOKEN,
    date: Date.now(),
    ...data
  };

  console.log(`🔐 TTLock API Call: ${endpoint}`);
  console.log(`📤 Request data:`, { ...payload, accessToken: '[HIDDEN]' });

  // Try primary region first, then fallbacks
  const regionsToTry = [TTLOCK_API_BASE, ...FALLBACK_REGIONS];

  for (const apiBase of regionsToTry) {
    try {
      const response = await axios.post(`${apiBase}${endpoint}`, payload, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log(`📥 TTLock Response from ${apiBase}:`, response.data);

      if (response.data.errcode === 0 || !response.data.errcode) {
        console.log(`✅ TTLock API Success via ${apiBase}`);
        return { success: true, data: response.data, region: apiBase };
      } else {
        console.log(`⚠️ TTLock API Error from ${apiBase}:`, response.data.errmsg);
        // Try next region if available
        continue;
      }
    } catch (error) {
      console.error(`❌ TTLock Request Failed for ${apiBase}:`, error.message);
      // Try next region if available
      continue;
    }
  }

  // All regions failed
  return { 
    success: false, 
    error: 'All TTLock API regions failed',
    regions_tried: regionsToTry
  };
}

// Generate random timed passcode for booking (YOUR WORKING METHOD)
async function generateBookingPIN(lockId, startTime, endTime, bookingId, bookingDate = null) {
  console.log(`🎲 Generating random PIN for booking: ${bookingId}`);
  console.log(`🔒 Lock ID: ${lockId}`);
  console.log(`⏰ Duration: ${startTime} - ${endTime}`);
  console.log(`📅 Received booking date: "${bookingDate}"`);
  
 // FIXED: Properly convert the booking date using IST
let targetDate;
 
if (bookingDate) {
  // Convert from sheet format to Date object
  targetDate = fromSheetFormat(bookingDate);
  
  // If conversion failed, try direct parsing
  if (!targetDate || isNaN(targetDate.getTime())) {
    console.log(`⚠️ Sheet format conversion failed, trying direct parsing...`);
    targetDate = new Date(bookingDate);
  }
  
  // Final fallback to IST today
  if (!targetDate || isNaN(targetDate.getTime())) {
    console.log(`❌ All date parsing failed for "${bookingDate}", using IST today`);
    targetDate = getISTTime();
  }
} else {
  console.log(`📅 No booking date provided, using IST today`);
  targetDate = getISTTime();
}

 console.log(`📅 Final target date: ${targetDate.toDateString()}`);
 
 // Convert times to TTLock format (timestamps in milliseconds)
 const startTimestamp = convertToTimestamp(startTime, targetDate);
 const endTimestamp = convertToTimestamp(endTime, targetDate);
 
  console.log(`🕐 Start timestamp: ${startTimestamp} (${new Date(startTimestamp)})`);
  console.log(`🕐 End timestamp: ${endTimestamp} (${new Date(endTimestamp)})`);
  
  const result = await makeTTLockRequest('/v3/keyboardPwd/get', {
    lockId: parseInt(lockId),
    keyboardPwdVersion: 4,
    keyboardPwdType: 3, // Timed passcode
    startDate: startTimestamp,
    endDate: endTimestamp
  });

  if (result.success) {
    const generatedPIN = result.data.keyboardPwd;
    const keyboardPwdId = result.data.keyboardPwdId;
    
    console.log(`✅ Random PIN generated successfully for ${bookingId}`);
    console.log(`🔢 Generated PIN: ${generatedPIN}`);
    console.log(`🆔 Keyboard PWD ID: ${keyboardPwdId}`);
    
    return {
      success: true,
      pin: generatedPIN,
      keyboardPwdId: keyboardPwdId,
      message: 'Random booking PIN generated successfully',
      validFrom: new Date(startTimestamp),
      validUntil: new Date(endTimestamp)
    };
  }

  console.error(`❌ Failed to generate PIN for ${bookingId}:`, result.error);
  return {
    success: false,
    error: result.error || 'Failed to generate random PIN'
  };
}

// Get default PIN from Society_Pod sheet for fallback
async function getDefaultPIN(lockId) {
  try {
    const { google } = require('googleapis');
    const path = require('path');

    // FIXED: Handle both local and Railway deployment
let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  // Production: Use environment variable
  auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} else {
  // Development: Use local file
  auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1TOQ9QT2zYj7uH0Y32OIHDY-iUC0gvYMRnLNJLaYhfwY';

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Society_Pod!A2:G', // Include DefaultLockPin column
    });

    const rows = res.data.values || [];
    
    for (const row of rows) {
      const [societyId, societyName, podId, podName, podAddress, lockDeviceId, defaultLockPin] = row;
      
      if (lockDeviceId && lockDeviceId === lockId.toString()) {
        console.log(`🔍 Found default PIN for lock ${lockId}: ${defaultLockPin}`);
        return defaultLockPin;
      }
    }

    console.log(`⚠️ No default PIN found for lock ${lockId}`);
    return null;

  } catch (error) {
    console.error('❌ Error getting default PIN:', error);
    return null;
  }
}

// Main function to handle booking lock access
async function handleBookingLockAccess(bookingData) {
  const {
    lockId,
    startTime,
    endTime,
    bookingId,
    societyName,
    bookingDate,
    podId
  } = bookingData;

  console.log(`🎯 Processing lock access for booking: ${bookingId}`);
  console.log(`🔒 Lock ID: ${lockId}, Pod: ${podId}, Time: ${startTime}-${endTime}`);

  try {
    // Generate random timed PIN
    const pinResult = await generateBookingPIN(lockId, startTime, endTime, bookingId, bookingDate);

    if (pinResult.success) {
      return {
        success: true,
        pin: pinResult.pin,
        keyboardPwdId: pinResult.keyboardPwdId,
        pinStatus: 'active',
        message: `Access PIN generated: ${pinResult.pin}`,
        validFrom: pinResult.validFrom,
        validUntil: pinResult.validUntil,
        fallback: false
      };
    } else {
      // TTLock failed - use default PIN as fallback
      console.log(`⚠️ TTLock PIN generation failed for ${bookingId}, using fallback`);
      
      const defaultPIN = await getDefaultPIN(lockId);
      
      if (defaultPIN) {
        return {
          success: true,
          pin: defaultPIN,
          keyboardPwdId: null,
          pinStatus: 'fallback_default',
          message: `Using default PIN: ${defaultPIN}`,
          fallback: true,
          fallbackReason: pinResult.error
        };
      } else {
        return {
          success: false,
          pin: null,
          keyboardPwdId: null,
          pinStatus: 'failed',
          message: 'Lock access will be manually configured',
          fallback: true,
          error: pinResult.error
        };
      }
    }

  } catch (error) {
    console.error(`❌ Error handling booking lock access:`, error);
    
    // Final fallback - try to get default PIN
    const defaultPIN = await getDefaultPIN(lockId);
    
    return {
      success: defaultPIN ? true : false,
      pin: defaultPIN,
      keyboardPwdId: null,
      pinStatus: defaultPIN ? 'fallback_default' : 'failed',
      message: defaultPIN ? 
        `Using default PIN: ${defaultPIN}` : 
        'Booking confirmed - lock access will be manually configured',
      fallback: true,
      error: error.message
    };
  }
}

// Convert time string to timestamp for TTLock API using IST
function convertToTimestamp(timeString, date = null) {
  let targetDate;
  
  if (date) {
    // Use provided date
    targetDate = new Date(date);
  } else {
    // Use current IST time
    targetDate = getISTTime();
  }
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const timestamp = new Date(targetDate);
  timestamp.setHours(hours, minutes, 0, 0);
  
  console.log(`🕐 TTLock: Converting ${timeString} on ${targetDate.toDateString()} to timestamp`);
  
  return timestamp.getTime(); // TTLock uses milliseconds
}

// Test TTLock connection
async function testTTLockConnection() {
  console.log('🧪 Testing TTLock API connection...');

  if (!CLIENT_ID || !ACCESS_TOKEN) {
    return {
      success: false,
      error: 'Missing TTLock API credentials in environment variables'
    };
  }

  try {
    const result = await makeTTLockRequest('/v3/lock/list', {
      pageNo: 1,
      pageSize: 20
    });

    if (result.success) {
      console.log(`✅ TTLock API connection successful via ${result.region}!`);
      console.log(`🔒 Found ${result.data.list?.length || 0} locks`);
      
      return {
        success: true,
        message: 'TTLock API connection successful',
        locks: result.data.list || [],
        region: result.region
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// List all current PINs on a lock (for debugging)
async function listLockPINs(lockId) {
  console.log(`📋 Listing all PINs for lock: ${lockId}`);
  
  const result = await makeTTLockRequest('/v3/lock/listKeyboardPwd', {
    lockId: parseInt(lockId),
    pageNo: 1,
    pageSize: 50
  });

  if (result.success) {
    return {
      success: true,
      pins: result.data.list || []
    };
  }

  return {
    success: false,
    error: result.error || 'Failed to list lock PINs'
  };
}

// Initialize lock verification (optional)
async function verifyLockAccess(lockId) {
  console.log(`🔍 Verifying lock access: ${lockId}`);

  try {
    const result = await makeTTLockRequest('/v3/lock/detail', {
      lockId: parseInt(lockId)
    });

    if (result.success) {
      const lock = result.data;
      return {
        success: true,
        lockInfo: {
          name: lock.lockName,
          battery: lock.electricQuantity,
          status: lock.lockSound ? 'online' : 'unknown',
          mac: lock.lockMac
        }
      };
    }

    return {
      success: false,
      error: result.error
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  handleBookingLockAccess,
  generateBookingPIN,
  getDefaultPIN,
  testTTLockConnection,
  listLockPINs,
  verifyLockAccess
};