#!/bin/bash
# setup-token-refresh-cron.sh - Set up automatic token refresh

echo "🔧 Setting up TTLock Token Auto-Refresh"
echo "========================================="

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODE_PATH=$(which node)

# Create cron job that runs daily at 2 AM
CRON_COMMAND="0 2 * * * cd $SCRIPT_DIR && $NODE_PATH auto-refresh-ttlock-token.js >> $SCRIPT_DIR/logs/token-refresh.log 2>&1"

echo ""
echo "📋 Cron job to be added:"
echo "$CRON_COMMAND"
echo ""

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto-refresh-ttlock-token.js"; then
    echo "⚠️  Cron job already exists!"
    echo ""
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 0
    fi

    # Remove existing job
    crontab -l 2>/dev/null | grep -v "auto-refresh-ttlock-token.js" | crontab -
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo "✅ Cron job added successfully!"
echo ""
echo "📅 Schedule: Daily at 2:00 AM"
echo "📝 Logs: $SCRIPT_DIR/logs/token-refresh.log"
echo ""
echo "To view your cron jobs: crontab -l"
echo "To remove this cron job: crontab -e (then delete the line)"
echo ""
echo "✨ Setup complete!"
