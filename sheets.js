const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load credentials from the downloaded JSON
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Spreadsheet ID and sheet names
const SPREADSHEET_ID = '1TOQ9QT2zYj7uH0Y32OIHDY-iUC0gvYMRnLNJLaYhfwY';
const USERS_SHEET = 'Users';

async function getSheetClient() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  return sheets;
}

// Find user by phone number
async function findUserByPhone(phone) {
  const sheets = await getSheetClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${USERS_SHEET}!A2:H`,
  });

  const rows = res.data.values || [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === phone) {
      return { rowIndex: i + 2, data: rows[i] }; // +2 accounts for 0-index and header
    }
  }
  return null;
}

// Add a new user row
async function addNewUser(phone, name, societyId = '') {
  const sheets = await getSheetClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${USERS_SHEET}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[ '', phone, name, societyId, 'No', '', '', '' ]],
    },
  });
}

module.exports = {
  findUserByPhone,
  addNewUser,
};