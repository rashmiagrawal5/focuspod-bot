// simple-availability.js - Clean union-based availability system

const { google } = require('googleapis');
const path = require('path');

// Import date utilities for consistency  
const { toSheetFormat } = require('./date-utils');

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = '1TOQ9QT2zYj7uH0Y32OIHDY-iUC0gvYMRnLNJLaYhfwY';
const POD_DAILY_STATUS_SHEET = 'Pod_Daily_Status';
const POD_MAINTENANCE_SHEET = 'Pod_Maintenance';
const BOOKINGS_SHEET = 'Bookings';

async function getSheetClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// MAIN FUNCTION - Simple Union Logic
async function getAvailableSlots(societyName, date, durationHours) {
  try {
    console.log(`🔍 SIMPLE: Checking availability for ${societyName} on ${date} for ${durationHours}hrs`);
    
    const sheets = await getSheetClient();
    
    // Step 1: Get all pods for this society (priority sorted)
    const pods = await getSocietyPods(sheets, societyName);
    if (pods.length === 0) {
      console.log(`❌ No active pods found for ${societyName}`);
      return { slots: [], actualDuration: durationHours, isDowngraded: false };
    }
    
    // Step 2: Get all constraints for this date
    const constraints = await getDateConstraints(sheets, date);
    
    // Step 3: Generate ALL possible slot candidates
    const allCandidates = generateSlotCandidates(durationHours, date);
    console.log(`📅 Generated ${allCandidates.length} slot candidates`);
    
    // Step 4: Filter - keep only slots where ANY pod is available
    const availableSlots = allCandidates.filter(candidate => 
      canAnyPodServeSlot(candidate, pods, constraints)
    );
    
    console.log(`✅ Found ${availableSlots.length} available slots (union of all pods)`);
    
    // Step 5: Try shorter durations if no slots found
    if (availableSlots.length === 0) {
      return await tryFallbackDurations(societyName, date, durationHours);
    }
    
    return {
      slots: availableSlots,
      actualDuration: durationHours,
      isDowngraded: false
    };
    
  } catch (error) {
    console.error('❌ Error in simple availability system:', error);
    throw error;
  }
}

// Get all pods for society (priority sorted)
async function getSocietyPods(sheets, societyName) {
  const podsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${POD_DAILY_STATUS_SHEET}!A2:E1000`,
  });
  
  const podRows = podsRes.data.values || [];
  const pods = podRows
    .filter(row => {
      const [societyId, rowSocietyName, podId, isActive, operatingHours] = row;
      return rowSocietyName === societyName && isActive === 'TRUE';
    })
    .map(row => ({
      societyId: row[0],
      societyName: row[1], 
      podId: row[2],
      isActive: row[3],
      operatingHours: row[4],
      priority: parseInt(row[2].replace(/\D/g, '')) || 999
    }))
    .sort((a, b) => a.priority - b.priority); // Pod_1 > Pod_2 > Pod_3
  
  console.log(`🏢 Found ${pods.length} active pods:`, pods.map(p => p.podId));
  return pods;
}

// Get all constraints (bookings + maintenance) for this date
async function getDateConstraints(sheets, date) {
  const [bookingsRes, maintenanceRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BOOKINGS_SHEET}!A2:O1000`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${POD_MAINTENANCE_SHEET}!A2:F1000`,
    })
  ]);
  
  const bookings = (bookingsRes.data.values || [])
    .filter(row => {
      const [, , bookingDate, , , , , , status] = row;
      return bookingDate === date && (status === 'Confirmed' || status === 'Booked');
    })
    .map(row => ({
      podId: row[3],
      startTime: row[4],
      endTime: row[5],
      type: 'booking'
    }));
  
  const maintenance = (maintenanceRes.data.values || [])
    .filter(row => {
      const [, , maintenanceDate] = row;
      return maintenanceDate === date;
    })
    .map(row => ({
      podId: row[1],
      startTime: row[3],
      endTime: row[4],
      type: 'maintenance',
      reason: row[5]
    }));
  
  console.log(`📅 Found ${bookings.length} bookings, ${maintenance.length} maintenance blocks`);
  return { bookings, maintenance };
}

// FIXED: Generate slot candidates with proper date handling
function generateSlotCandidates(durationHours, date) {
  const candidates = [];
  const durationMinutes = durationHours * 60;
  
  // FIXED: Check if this is today for current time bonus using consistent date format
  const today = new Date();
  const todayFormatted = toSheetFormat(today);
  const isToday = date === todayFormatted;
  
  console.log(`📅 DEBUG: Today formatted: ${todayFormatted}, Target date: ${date}, Is today: ${isToday}`);
  
  if (isToday) {
    // CURRENT TIME BONUS - immediate start option
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const operatingEndMinutes = 21 * 60; // 21:00
    
    // Only if there's enough time left
    if (currentTotalMinutes + durationMinutes <= operatingEndMinutes) {
      const startTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      const endTime = minutesToTime(currentTotalMinutes + durationMinutes);
      
      candidates.push({
        startTime: startTime,
        endTime: endTime,
        timeSlot: `${startTime}-${endTime}`,  // ✅ FIXED: Changed em dash to regular dash
        startMinutes: currentTotalMinutes,
        endMinutes: currentTotalMinutes + durationMinutes,
        isCurrentTimeBonus: true
      });
    }
    
    // REGULAR HOURLY SLOTS - start from next hour
    const nextHour = currentHour + 1;
    for (let hour = nextHour; hour <= 21 - durationHours; hour++) {
      candidates.push(createHourlySlot(hour, durationHours));
    }
  } else {
    // FUTURE DATES - only regular hourly slots from 6 AM
    for (let hour = 6; hour <= 21 - durationHours; hour++) {
      candidates.push(createHourlySlot(hour, durationHours));
    }
  }
  
  return candidates;
}

// Create a clean hourly slot
function createHourlySlot(hour, durationHours) {
  const startMinutes = hour * 60;
  const endMinutes = startMinutes + (durationHours * 60);
  const startTime = minutesToTime(startMinutes);
  const endTime = minutesToTime(endMinutes);
  
  return {
    startTime: startTime,
    endTime: endTime,
    timeSlot: `${startTime}-${endTime}`,  // ✅ FIXED: Changed em dash to regular dash
    startMinutes: startMinutes,
    endMinutes: endMinutes,
    isCurrentTimeBonus: false
  };
}

// Check if ANY pod can serve this slot (union logic)
function canAnyPodServeSlot(candidate, pods, constraints) {
  return pods.some(pod => isPodAvailableForSlot(pod, candidate, constraints));
}

// Check if specific pod is available for specific slot
function isPodAvailableForSlot(pod, candidate, constraints) {
  // Check operating hours
  const [startHour, endHour] = pod.operatingHours.split('-');
  const operatingStart = timeToMinutes(startHour);
  const operatingEnd = timeToMinutes(endHour);
  
  if (candidate.startMinutes < operatingStart || candidate.endMinutes > operatingEnd) {
    return false; // Outside operating hours
  }
  
  // Check conflicts with bookings and maintenance
  const allBlocks = [
    ...constraints.bookings.filter(b => b.podId === pod.podId),
    ...constraints.maintenance.filter(m => m.podId === pod.podId)
  ];
  
  const hasConflict = allBlocks.some(block => {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);
    
    // Check if candidate overlaps with this block
    return !(candidate.endMinutes <= blockStart || candidate.startMinutes >= blockEnd);
  });
  
  return !hasConflict; // Available if no conflict
}

async function assignPodForSlot(societyName, selectedSlot, date) {
  try {
    console.log(`🎯 Assigning pod for slot: ${selectedSlot.timeSlot}`);
    
    const sheets = await getSheetClient();
    const pods = await getSocietyPods(sheets, societyName);
    const constraints = await getDateConstraints(sheets, date);
    
    // Find all pods that can serve this slot
    const availablePods = pods.filter(pod => 
      isPodAvailableForSlot(pod, selectedSlot, constraints)
    );
    
    if (availablePods.length === 0) {
      console.log(`❌ No pods available for slot ${selectedSlot.timeSlot}`);
      return null;
    }
    
    // Return highest priority pod (already sorted)
    const assignedPod = availablePods[0];
    
    // ADDED: Fetch PodName from Society_Pod sheet
    try {
      const societyPodRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Society_Pod!A2:D1000',
      });
      
      const societyPodRows = societyPodRes.data.values || [];
      const podInfo = societyPodRows.find(row => row[2] === assignedPod.podId);
      
      // Add PodName to assigned pod
      assignedPod.podName = podInfo ? podInfo[3] : assignedPod.podId;
      
      console.log(`✅ Assigned ${assignedPod.podId}(${assignedPod.podName}) for slot ${selectedSlot.timeSlot}`);
    } catch (nameError) {
      console.log(`⚠️ Could not fetch PodName, using PodId: ${nameError.message}`);
      assignedPod.podName = assignedPod.podId; // Fallback
    }
    
    return assignedPod;
    
  } catch (error) {
    console.error('❌ Error assigning pod:', error);
    return null;
  }
}

// Try shorter durations if no slots found
async function tryFallbackDurations(societyName, date, originalDuration) {
  console.log(`⚠️ No ${originalDuration}hr slots found, trying shorter durations...`);
  
  const fallbackDurations = [4, 2].filter(d => d < originalDuration);
  
  for (const duration of fallbackDurations) {
    const result = await getAvailableSlots(societyName, date, duration);
    if (result.slots.length > 0) {
      console.log(`✅ Found ${result.slots.length} slots for ${duration}hrs`);
      return {
        slots: result.slots,
        actualDuration: duration,
        isDowngraded: true
      };
    }
  }
  
  return { slots: [], actualDuration: originalDuration, isDowngraded: false };
}

// Helper functions
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// FIXED: Use the centralized date utility function
function formatDateForSheet(date) {
  return toSheetFormat(date);}

// CREATE BOOKING FUNCTION - With TTLock integration
async function createBooking(bookingData) {
  try {
    console.log('📝 Creating booking with TTLock integration:', bookingData);
    
    const sheets = await getSheetClient();
    
    // Import TTLock functions
    const { 
      handleBookingLockAccess
    } = require('./ttlock-integration');
    
    const {
      generateTransactionId
    } = require('./sheets');
    
    // Generate booking ID if not provided
    const bookingId = bookingData.bookingId || generateTransactionId();
    const createdAt = new Date().toISOString();
    
    // Get society and pod info for TTLock
    const societyRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Society_Pod!A2:I1000',
    });
    
    const societyRows = societyRes.data.values || [];
    const podInfo = societyRows.find(row => {
      const [societyId, societyName, podId] = row;
      return societyId == bookingData.societyId && podId === bookingData.podId;
    });
    
    if (!podInfo) {
      throw new Error(`Pod ${bookingData.podId} not found for society ${bookingData.societyId}`);
    }
    
    const [, , , , , lockDeviceId, defaultLockPin] = podInfo;
    console.log(`🔐 TTLock info: Device ${lockDeviceId}, Default PIN ${defaultLockPin}`);
    
    // Generate TTLock PIN
    let assignedLockPin;
    let keyboardPwdId = null;
    let pinStatus = 'unknown';
    
    try {
      // FIXED: Pass the booking date properly to TTLock
      console.log(`📅 DEBUG: Passing booking date to TTLock: ${bookingData.date}`);
     
      const lockResult = await handleBookingLockAccess({
        lockId: parseInt(lockDeviceId),
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        bookingId: bookingId,
        societyName: 'Unknown',
        podId: bookingData.podId,
        bookingDate: bookingData.date
      });
      
      if (lockResult.success) {
        assignedLockPin = lockResult.pin;
        keyboardPwdId = lockResult.keyboardPwdId;
        pinStatus = lockResult.pinStatus; 
        console.log(`✅ TTLock PIN generated: ${assignedLockPin} (ID: ${keyboardPwdId})`);
      } else {
        throw new Error(lockResult.error);
      }
      
    } catch (ttlockError) {
      console.log(`⚠️ TTLock PIN generation failed: ${ttlockError.message}`);
      console.log('🔄 Using default PIN as fallback');
      
      // Fallback to default PIN
      assignedLockPin = defaultLockPin;
      pinStatus = 'fallback_default';
    }
    
    // Create booking record in Google Sheets
    const bookingRow = [
      bookingId,                    // BookingId
      bookingData.societyId,        // SocietyId
      bookingData.date,             // Date
      bookingData.podId,            // PodId
      bookingData.startTime,        // StartTime
      bookingData.endTime,          // EndTime
      bookingData.duration,         // Duration
      bookingData.userId,           // UserId
      'Confirmed',                  // Status
      bookingData.bookingType || 'Regular', // BookingType
      bookingData.amount || 0,      // Amount
      createdAt,                    // CreatedAt
      assignedLockPin,              // AssignedLockPin
      keyboardPwdId || '',          // KeyboardPwdId
      pinStatus                     // PINStatus
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Bookings!A2',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [bookingRow],
      },
    });
    
    console.log(`✅ Booking created successfully: ${bookingId}`);
    
    return {
      success: true,
      bookingId: bookingId,
      assignedLockPin: assignedLockPin,
      keyboardPwdId: keyboardPwdId,
      pinStatus: pinStatus,
      lockInfo: {
        deviceId: lockDeviceId,
        defaultPin: defaultLockPin
      }
    };
    
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    
    // Return fallback result with default PIN
    return {
      success: false,
      error: error.message,
      assignedLockPin: '1234', // Emergency fallback
      pinStatus: 'error_fallback'
    };
  }
}

module.exports = {
  getAvailableSlots,
  assignPodForSlot,
  createBooking,
  formatDateForSheet
};