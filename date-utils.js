// date-utils.js - Simple date standardization utility

// Convert any date to the Google Sheets format: "Aug 21, 2025"
function toSheetFormat(date) {
    if (!date) return null;
    
    // Handle different input types
    let dateObj;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return null;
    }
    
    // Check if date is valid
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
  
  // Simple display format for users: "21 Aug"
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
  
  // Get today in sheet format
  function getTodaySheetFormat() {
    return toSheetFormat(new Date());
  }
  
  // Get tomorrow in sheet format  
  function getTomorrowSheetFormat() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toSheetFormat(tomorrow);
  }
  
  // Get day after tomorrow in sheet format
  function getDayAfterSheetFormat() {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return toSheetFormat(dayAfter);
  }
  
  module.exports = {
    toSheetFormat,
    fromSheetFormat,
    toDisplayFormat,
    getTodaySheetFormat,
    getTomorrowSheetFormat,
    getDayAfterSheetFormat
  };