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

const SPREADSHEET_ID = '1TOQ9QT2zYj7uH0Y32OIHDY-iUC0gvYMRnLNJLaYhfwY';
const USERS_SHEET = 'Users';
const PRICING_SHEET = 'Pricing';

async function getSheetClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// Keep all your existing functions below this line...
// (rest of your sheets.js code remains the same)

// NEW: Get dynamic pricing from Google Sheets
async function getPricing() {
  try {
    const sheets = await getSheetClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PRICING_SHEET}!A2:B`, // SlotDuration, Price
    });

    const rows = res.data.values || [];
    const pricing = {};

    for (const row of rows) {
      const [duration, price] = row;
      if (duration && price) {
        pricing[parseInt(duration)] = parseInt(price);
      }
    }

    console.log(`📊 Loaded pricing:`, pricing);
    return pricing;

  } catch (error) {
    console.error('❌ Error getting pricing from sheets:', error);
    // Fallback to hardcoded pricing if sheet fails
    return {
      2: 199,
      4: 349,
      8: 599
    };
  }
}

// NEW: Get price for specific duration
async function getPriceForDuration(hours) {
  try {
    const pricing = await getPricing();
    return pricing[hours] || 0;
  } catch (error) {
    console.error('❌ Error getting price for duration:', error);
    // Fallback pricing
    const fallbackPricing = { 2: 199, 4: 349, 8: 599 };
    return fallbackPricing[hours] || 0;
  }
}

// Get user by phone number and return structured object
async function getUserByPhone(phone) {
  try {
    const sheets = await getSheetClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:H`,
    });

    const rows = res.data.values || [];
    console.log(`🔍 Searching for user with phone: ${phone}`);
    console.log(`📊 Found ${rows.length} rows in Users sheet`);

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === phone) {
        const [
          UserId, PhoneNumber, Name, SocietyId,
          FirstBookingDone, FirstBookingDate,
          FirstBookingSlotDuration, TowerNumber
        ] = rows[i];

        const user = {
          rowIndex: i + 2, // +2 because we start from A2 and arrays are 0-indexed
          UserId, 
          PhoneNumber, 
          Name: Name || '', 
          SocietyId: SocietyId || '',
          FirstBookingDone: FirstBookingDone || 'No',
          FirstBookingDate: FirstBookingDate || '',
          FirstBookingSlotDuration: FirstBookingSlotDuration || '',
          TowerNumber: TowerNumber || ''
        };

        console.log(`✅ User found:`, user);
        return user;
      }
    }

    console.log(`❌ User not found with phone: ${phone}`);
    return null;

  } catch (error) {
    console.error('❌ Error getting user by phone:', error);
    throw error;
  }
}

// Add user with phone number only (name will be added later)
async function addNewUser(phone) {
  try {
    const sheets = await getSheetClient();

    // Get current data to determine next UserId
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:A`,
    });

    const rows = res.data.values || [];
    const nextUserId = rows.length + 1;

    console.log(`🔢 Creating new user with ID: ${nextUserId}, Phone: ${phone}`);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[nextUserId, phone, '', '', 'No', '', '', '']],
      },
    });

    console.log(`✅ New user created successfully with ID: ${nextUserId}`);
    return nextUserId;

  } catch (error) {
    console.error('❌ Error adding new user:', error);
    throw error;
  }
}

// Update name by phone number
async function updateUserName(phone, name) {
  try {
    const sheets = await getSheetClient();
    const user = await getUserByPhone(phone);

    if (!user) {
      console.log(`❌ Cannot update name: User not found with phone ${phone}`);
      return false;
    }

    console.log(`🔄 Updating name for user at row ${user.rowIndex}: ${name}`);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!C${user.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[name]],
      },
    });

    console.log(`✅ Name updated successfully for ${phone}: ${name}`);
    return true;

  } catch (error) {
    console.error('❌ Error updating user name:', error);
    throw error;
  }
}

// Update society for a user
async function updateUserSociety(phone, societyId) {
  try {
    const sheets = await getSheetClient();
    const user = await getUserByPhone(phone);

    if (!user) {
      console.log(`❌ Cannot update society: User not found with phone ${phone}`);
      return false;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!D${user.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[societyId]],
      },
    });

    console.log(`✅ Society updated successfully for ${phone}: ${societyId}`);
    return true;

  } catch (error) {
    console.error('❌ Error updating user society:', error);
    throw error;
  }
}

// Get all available societies
async function getSocieties() {
  try {
    const sheets = await getSheetClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Society_Pod!A2:B', // SocietyId, SocietyName
    });

    const rows = res.data.values || [];
    const societies = [];
    const seenSocieties = new Set();

    for (const row of rows) {
      const [societyId, societyName] = row;
      if (societyId && societyName && !seenSocieties.has(societyId)) {
        societies.push({ id: societyId, name: societyName });
        seenSocieties.add(societyId);
      }
    }

    console.log(`📊 Found ${societies.length} unique societies`);
    return societies;

  } catch (error) {
    console.error('❌ Error getting societies:', error);
    throw error;
  }
}

// Update first booking status
async function updateFirstBookingStatus(phone, bookingDate, slotDuration) {
  try {
    const sheets = await getSheetClient();
    const user = await getUserByPhone(phone);

    if (!user) {
      console.log(`❌ Cannot update first booking: User not found with phone ${phone}`);
      return false;
    }

    console.log(`🔄 Updating first booking status for user at row ${user.rowIndex}`);

    // Update FirstBookingDone, FirstBookingDate, and FirstBookingSlotDuration
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!E${user.rowIndex}:G${user.rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Yes', bookingDate, slotDuration]],
      },
    });

    console.log(`✅ First booking status updated for ${phone}`);
    return true;

  } catch (error) {
    console.error('❌ Error updating first booking status:', error);
    throw error;
  }
}

// Add booking record to Booking sheet with TTLock PIN support
async function addBookingRecord(bookingData) {
  try {
    const sheets = await getSheetClient();
    const BOOKING_SHEET = 'Booking';

    const {
      transactionId,
      transactionDate,
      transactionTime,
      transactionAmount,
      bookingDate,
      bookedSlotDuration,
      slotStartTime,
      slotEndTime,
      assignedLockPin,
      userId,
      podId,
      societyId,
      keyboardPwdId,  // NEW: TTLock PIN ID for tracking
      pinStatus       // NEW: PIN status (active/expired/fallback_default/failed)
    } = bookingData;

    console.log(`🔄 Adding booking record for user ${userId}`);
    console.log(`🔐 PIN: ${assignedLockPin}, Status: ${pinStatus}, PWD ID: ${keyboardPwdId}`);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BOOKING_SHEET}!A2`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[
          transactionId,
          transactionDate,
          transactionTime,
          transactionAmount,
          bookingDate,
          bookedSlotDuration,
          slotStartTime,
          slotEndTime,
          assignedLockPin,
          userId,
          podId,
          societyId,
          keyboardPwdId || '',  // NEW: Store TTLock PIN ID
          pinStatus || 'unknown' // NEW: Store PIN status
        ]],
      },
    });

    console.log(`✅ Booking record added successfully with TTLock data`);
    return true;

  } catch (error) {
    console.error('❌ Error adding booking record:', error);
    throw error;
  }
}

// NEW: Get lock ID from Society_Pod sheet
async function getLockIdForPod(societyId, podId) {
  try {
    const sheets = await getSheetClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Society_Pod!A2:G', // Include LockDeviceId column
    });

    const rows = res.data.values || [];
    console.log(`🔍 Looking for lock ID - Society: ${societyId}, Pod: ${podId}`);
    console.log(`📊 Found ${rows.length} rows in Society_Pod sheet`);
    
    for (const row of rows) {
      const [rowSocietyId, societyName, rowPodId, podName, podAddress, lockDeviceId, defaultLockPin] = row;
      
      console.log(`🔎 Checking row: Society=${rowSocietyId}, Pod=${rowPodId}, Lock=${lockDeviceId}`);
      
      if (rowSocietyId === societyId && rowPodId === podId) {
        console.log(`✅ Found lock ID for ${societyId}/${podId}: ${lockDeviceId}`);
        return {
          lockId: lockDeviceId,
          defaultPin: defaultLockPin,
          podName: podName,
          podAddress: podAddress
        };
      }
    }

    console.log(`❌ No lock ID found for ${societyId}/${podId}`);
    return null;

  } catch (error) {
    console.error('❌ Error getting lock ID:', error);
    throw error;
  }
}

// Generate transaction ID
function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TXN${timestamp}${random}`;
}

// Generate lock PIN (first 4 digits of phone number)
function generateLockPin(phone) {
  return phone.substring(phone.length - 4); // Last 4 digits
}


// Log support request to Support_Requests sheet
async function logSupportRequest(phone, requestType, message = '', userName = '') {
  try {
    const sheets = await getSheetClient();
    const SUPPORT_SHEET = 'Support_Requests';
    
    const requestId = `SUP${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Get user info if not provided
    if (!userName) {
      const user = await getUserByPhone(phone);
      userName = user?.Name || 'Unknown';
    }
    
    const user = await getUserByPhone(phone);
    const societyId = user?.SocietyId || '';
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUPPORT_SHEET}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          requestId,
          phone,
          requestType,
          message.substring(0, 500), // Limit message length
          timestamp,
          userName,
          societyId,
          'Pending'
        ]],
      },
    });
    
    console.log(`📝 Support request logged: ${requestType} from ${phone}`);
    return requestId;
    
  } catch (error) {
    console.error('❌ Error logging support request:', error);
    return null;
  }
}

// Log errors to Error_Logs sheet
async function logError(errorType, phone = '', errorMessage = '') {
  try {
    const sheets = await getSheetClient();
    const ERROR_LOG_SHEET = 'Error_Logs';
    
    const logId = `ERR${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ERROR_LOG_SHEET}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          logId,
          errorType,
          phone,
          errorMessage.substring(0, 500), // Limit message length
          timestamp,
          'No'
        ]],
      },
    });
    
    console.log(`🚨 Error logged: ${errorType} - ${errorMessage.substring(0, 50)}`);
    return logId;
    
  } catch (error) {
    console.error('❌ Error logging to Error_Logs:', error);
    return null;
  }
}

// ==========================================
// TTLock Token Management (Google Sheets)
// ==========================================
const TTLOCK_CONFIG_SHEET = 'TTLock_Config';

// Get TTLock tokens from Google Sheets
async function getTTLockTokens() {
  try {
    const sheets = await getSheetClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TTLOCK_CONFIG_SHEET}!A2:D2`, // Key, AccessToken, RefreshToken, LastRefresh
    });

    const rows = res.data.values || [];

    if (rows.length === 0 || !rows[0][1]) {
      console.log('⚠️  No TTLock tokens found in Google Sheets');
      return null;
    }

    const [key, accessToken, refreshToken, lastRefresh] = rows[0];

    console.log(`🔑 TTLock tokens loaded from Google Sheets`);
    console.log(`📅 Last refresh: ${lastRefresh || 'Unknown'}`);

    return {
      accessToken,
      refreshToken,
      lastRefresh: lastRefresh ? new Date(lastRefresh) : null
    };

  } catch (error) {
    console.error('❌ Error reading TTLock tokens from Google Sheets:', error.message);

    // If sheet doesn't exist, return null (will fall back to env vars)
    if (error.message.includes('Unable to parse range')) {
      console.log('⚠️  TTLock_Config sheet not found. Create it or use env vars as fallback.');
    }

    return null;
  }
}

// Ensure TTLock_Config sheet exists
async function ensureTTLockConfigSheetExists() {
  try {
    const sheets = await getSheetClient();

    // Try to get the sheet metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    const sheetExists = spreadsheet.data.sheets.some(
      sheet => sheet.properties.title === TTLOCK_CONFIG_SHEET
    );

    if (!sheetExists) {
      console.log(`📝 Creating ${TTLOCK_CONFIG_SHEET} sheet...`);

      // Create the new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: TTLOCK_CONFIG_SHEET
              }
            }
          }]
        }
      });

      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${TTLOCK_CONFIG_SHEET}!A1:D1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Key', 'AccessToken', 'RefreshToken', 'LastRefresh']]
        },
      });

      console.log(`✅ ${TTLOCK_CONFIG_SHEET} sheet created successfully`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error ensuring TTLock_Config sheet exists:', error.message);
    return false;
  }
}

// Save TTLock tokens to Google Sheets
async function saveTTLockTokens(accessToken, refreshToken) {
  try {
    // Ensure the sheet exists
    await ensureTTLockConfigSheetExists();

    const sheets = await getSheetClient();
    const timestamp = new Date().toISOString();

    // Update or insert token data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TTLOCK_CONFIG_SHEET}!A2:D2`,
      valueInputOption: 'RAW',
      resource: {
        values: [['ttlock_tokens', accessToken, refreshToken, timestamp]]
      },
    });

    console.log(`✅ TTLock tokens saved to Google Sheets`);
    console.log(`🔑 Access Token: ${accessToken.substring(0, 15)}...`);
    console.log(`📅 Timestamp: ${timestamp}`);

    return true;

  } catch (error) {
    console.error('❌ Error saving TTLock tokens to Google Sheets:', error.message);
    return false;
  }
}

// Check if TTLock token needs refresh (based on Google Sheets timestamp)
async function shouldRefreshTTLockToken() {
  try {
    const tokens = await getTTLockTokens();

    if (!tokens || !tokens.lastRefresh) {
      console.log('⚠️  No token refresh date found, needs refresh');
      return true;
    }

    const lastRefresh = new Date(tokens.lastRefresh);
    const now = new Date();
    const daysSinceRefresh = (now - lastRefresh) / (1000 * 60 * 60 * 24);

    console.log(`🔍 TTLock token age: ${Math.floor(daysSinceRefresh)} days`);

    // Refresh if older than 79 days (11 days before 90-day expiry)
    const needsRefresh = daysSinceRefresh >= 79;

    if (needsRefresh) {
      console.log('⚠️  TTLock token needs refresh (>79 days old)');
    } else {
      console.log(`✅ TTLock token still valid (${Math.floor(90 - daysSinceRefresh)} days remaining)`);
    }

    return needsRefresh;

  } catch (error) {
    console.error('❌ Error checking token refresh status:', error);
    return false;
  }
}

module.exports = {
  getUserByPhone,
  addNewUser,
  updateUserName,
  updateUserSociety,
  getSocieties,
  updateFirstBookingStatus,
  addBookingRecord,
  generateTransactionId,
  generateLockPin,
  getPricing,              // NEW: Export pricing functions
  getPriceForDuration,     // NEW: Export pricing functions
  getLockIdForPod,          // NEW: Export lock ID lookup
  logSupportRequest,
  logError,
  getTTLockTokens,         // NEW: TTLock token management
  saveTTLockTokens,        // NEW: TTLock token management
  shouldRefreshTTLockToken // NEW: TTLock token management
};