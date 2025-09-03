// date-utils.js - Luxon based
const { DateTime } = require("luxon");

// Always use Asia/Kolkata timezone
const IST_ZONE = "Asia/Kolkata";

// Get current IST time as a Luxon DateTime
function getISTTime() {
  return DateTime.now().setZone(IST_ZONE);
}

// Convert Date/Luxon/ISO string → Google Sheets format: "Sep 04, 2025"
function toSheetFormat(date) {
  let dt;
  if (!date) return null;

  if (typeof date === "string") {
    dt = DateTime.fromISO(date, { zone: IST_ZONE });
  } else if (date instanceof Date) {
    dt = DateTime.fromJSDate(date, { zone: IST_ZONE });
  } else if (date.setZone) {
    dt = date.setZone(IST_ZONE);
  } else {
    return null;
  }

  return dt.toFormat("MMM dd, yyyy");
}

// Convert sheet format back to Luxon DateTime
function fromSheetFormat(sheetDateString) {
  if (!sheetDateString) return null;
  return DateTime.fromFormat(sheetDateString, "MMM dd, yyyy", { zone: IST_ZONE });
}

// Simple display format for users: "4 Sep"
function toDisplayFormat(date) {
  let dt;
  if (!date) return null;

  if (typeof date === "string") {
    dt = DateTime.fromISO(date, { zone: IST_ZONE });
  } else if (date instanceof Date) {
    dt = DateTime.fromJSDate(date, { zone: IST_ZONE });
  } else if (date.setZone) {
    dt = date.setZone(IST_ZONE);
  } else {
    return null;
  }

  return dt.toFormat("d MMM");
}

// Get today in IST and convert to sheet format
function getTodaySheetFormat() {
  return getISTTime().toFormat("MMM dd, yyyy");
}

// Get tomorrow in IST and convert to sheet format
function getTomorrowSheetFormat() {
  return getISTTime().plus({ days: 1 }).toFormat("MMM dd, yyyy");
}

// Get day after tomorrow in IST and convert to sheet format
function getDayAfterSheetFormat() {
  return getISTTime().plus({ days: 2 }).toFormat("MMM dd, yyyy");
}

// Convert "HH:mm" + Date (in IST sheet format) → UTC timestamp (ms) for TTLock
function convertToTimestamp(timeString, sheetDate) {
  if (!timeString || !sheetDate) return null;

  const [hours, minutes] = timeString.split(":").map(Number);
  const dtIST = DateTime.fromFormat(sheetDate, "MMM dd, yyyy", { zone: IST_ZONE })
    .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

  const dtUTC = dtIST.toUTC();

  // 🔍 Debug logs
  console.log(`🕒 [convertToTimestamp]`);
  console.log(`   Input date (sheet): ${sheetDate}`);
  console.log(`   Time string: ${timeString}`);
  console.log(`   IST DateTime: ${dtIST.toFormat("yyyy-MM-dd HH:mm ZZZZ")}`);
  console.log(`   UTC DateTime: ${dtUTC.toFormat("yyyy-MM-dd HH:mm ZZZZ")}`);
  console.log(`   UTC millis: ${dtUTC.toMillis()}`);

  return dtUTC.toMillis();
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
