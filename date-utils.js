// date-utils.js - FIXED: Simpler IST handling

// Helper function to get current IST time - SIMPLIFIED
function getISTTime() {
  // Much simpler: just add 5.5 hours to UTC
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  return new Date(now.getTime() + istOffset);
}

// Convert any date to Google Sheets format: "Sep 02, 2025"
function toSheetFormat(date) {
  if (!date) return null;
  
  let dateObj;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return null;
  }
  
  if (isNaN(dateObj.getTime())) return null;
  
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: '2-digit'
  };
  return dateObj.toLocaleDateString('en-US', options);
}

// Convert sheet format back to Date object
function fromSheetFormat(sheetDateString) {
  if (!sheetDateString) return null;
  return new Date(sheetDateString);
}

// Simple display format for users: "2 Sep"
function toDisplayFormat(date) {
  if (!date) return null;
  
  let dateObj;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return null;
  }
  
  if (isNaN(dateObj.getTime())) return null;
  
  const options = { 
    day: 'numeric',
    month: 'short'
  };
  return dateObj.toLocaleDateString('en-US', options);
}

// Get today in IST and convert to sheet format
function getTodaySheetFormat() {
  const todayIST = getISTTime();
  return toSheetFormat(todayIST);
}

// Get tomorrow in IST and convert to sheet format  
function getTomorrowSheetFormat() {
  const todayIST = getISTTime();
  const tomorrow = new Date(todayIST);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toSheetFormat(tomorrow);
}

// Get day after tomorrow in IST and convert to sheet format
function getDayAfterSheetFormat() {
  const todayIST = getISTTime();
  const dayAfter = new Date(todayIST);
  dayAfter.setDate(dayAfter.getDate() + 2);
  return toSheetFormat(dayAfter);
}

// Convert "HH:mm" + Date object (in IST) to UTC timestamp for TTLock
function convertToTimestamp(timeString, dateObj) {
  if (!timeString || !dateObj) return null;

  const [hours, minutes] = timeString.split(':').map(Number);

  // Work on a copy of the date
  const d = new Date(dateObj);
  d.setHours(hours, minutes || 0, 0, 0);

  // Adjust IST → UTC (IST = UTC+5:30, so subtract 5.5h)
  const utcMillis = d.getTime() - (5.5 * 60 * 60 * 1000);

  return utcMillis;
}


module.exports = {
  toSheetFormat,
  fromSheetFormat,
  toDisplayFormat,
  getTodaySheetFormat,
  getTomorrowSheetFormat,
  getDayAfterSheetFormat,
  getISTTime,
  convertToTimestamp
};