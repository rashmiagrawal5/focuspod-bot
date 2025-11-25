# TTLock Token Auto-Refresh System

This system automatically manages your TTLock API access token to prevent expiration issues.

## 🎯 Overview

TTLock access tokens expire after **90 days**. This system provides three ways to automatically refresh your token before it expires:

1. **Automatic check on bot startup** (Recommended - already integrated!)
2. **Manual refresh script** (Run anytime)
3. **Scheduled cron job** (For servers)

---

## ✅ Option 1: Automatic Check on Bot Startup (RECOMMENDED)

**Status: ✅ Already configured in your bot!**

Your bot now automatically checks the token age every time it starts. If the token is within 7 days of expiration, it will automatically refresh.

### How it works:
- On bot startup, checks token age from `.ttlock-token-info.json`
- If token is 83+ days old, automatically refreshes it
- Updates `.env` file with new token
- Logs refresh activity to console

### No action needed!
Just restart your bot periodically (which happens automatically on Railway deployments).

---

## 🔧 Option 2: Manual Refresh Script

Run this anytime to check and refresh your token:

```bash
node auto-refresh-ttlock-token.js
```

### What it does:
- ✅ Checks if token needs refresh (7-day threshold)
- ✅ Only refreshes if needed (safe to run repeatedly)
- ✅ Updates local `.env` file automatically
- ✅ Provides Railway command for production update
- ✅ Creates/updates `.ttlock-token-info.json` tracking file

### Output example:
```
🔄 TTLock Auto Token Refresh
============================================================
📅 Last token refresh: 11/25/2025, 3:00:00 PM
⏱️  Days since refresh: 0
⏳ Token expires in ~90 days

✅ Token is still valid. No refresh needed.
```

---

## ⏰ Option 3: Scheduled Cron Job (For Servers)

Set up automatic daily checks using cron:

### Setup:
```bash
chmod +x setup-token-refresh-cron.sh
./setup-token-refresh-cron.sh
```

This creates a cron job that runs **daily at 2:00 AM** and checks if the token needs refresh.

### Features:
- Runs daily automatically
- Logs to `logs/token-refresh.log`
- Only refreshes when needed (within 7 days of expiry)
- Safe to run even if token is valid

### Manage cron jobs:
```bash
# View current cron jobs
crontab -l

# Edit cron jobs
crontab -e

# View refresh logs
cat logs/token-refresh.log
```

---

## 📋 How Token Tracking Works

The system uses `.ttlock-token-info.json` to track when the token was last refreshed:

```json
{
  "lastRefresh": "2025-11-25T09:30:00.000Z",
  "expiresIn": 7776000,
  "tokenPreview": "19b469adeb..."
}
```

- **lastRefresh**: ISO timestamp of last refresh
- **expiresIn**: Token validity period in seconds (90 days)
- **tokenPreview**: First 10 chars of token (for verification)

---

## 🚀 Railway Deployment

After automatic token refresh, you need to update Railway:

### Manual update:
```bash
railway variables --set TTLOCK_ACCESS_TOKEN="your_new_token"
railway variables --set TTLOCK_REFRESH_TOKEN="your_new_refresh_token"
```

### Automated update (coming soon):
You could integrate Railway CLI into the refresh script to automatically update production.

---

## 🔍 Troubleshooting

### Token refresh fails
```bash
# Test token manually
node test-ttlock.js

# Force refresh
node get-ttlock-token-simple.js
```

### Check token age
```bash
# View token info
cat .ttlock-token-info.json

# Check if refresh is needed
node auto-refresh-ttlock-token.js
```

### Reset token tracking
```bash
# Delete tracking file to force refresh check
rm .ttlock-token-info.json

# Restart bot (will initialize new tracking)
npm start
```

---

## 📁 Files

| File | Purpose |
|------|---------|
| `ttlock-token-checker.js` | Startup token check (integrated in bot) |
| `auto-refresh-ttlock-token.js` | Manual/cron refresh script |
| `get-ttlock-token-simple.js` | Direct token generation |
| `test-ttlock.js` | Test TTLock API connection |
| `test-pin-generation.js` | Test PIN generation |
| `.ttlock-token-info.json` | Token age tracking (auto-generated) |
| `setup-token-refresh-cron.sh` | Cron job installer |

---

## ⚙️ Configuration

Edit credentials in the scripts if needed:

```javascript
const USERNAME = 'rashmi.agrawal0905@gmail.com';
const PASSWORD = 'Geet@@300322';
const REFRESH_THRESHOLD_DAYS = 7;  // Refresh if < 7 days until expiry
const TOKEN_VALIDITY_DAYS = 90;    // TTLock tokens valid for 90 days
```

---

## 🎉 Summary

**You're all set!** Your bot now automatically manages token refresh.

- ✅ Auto-check on every bot startup
- ✅ Manual refresh script available
- ✅ Cron job option for servers
- ✅ Token expires in 90 days
- ✅ Auto-refresh at 83 days (7-day buffer)

No more expired token errors! 🚀
