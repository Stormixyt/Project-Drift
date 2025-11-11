# Server Status Management Guide

## How it Works

The launcher fetches server status from a remote JSON file every 30 seconds (when the Status tab is open). You control the status by updating this JSON file - no need for users to download anything!

## Setup Instructions

### Option 1: GitHub (Recommended - Free & Easy)

1. **Commit the `status.json` file to your GitHub repository:**
   ```bash
   git add status.json
   git commit -m "Add server status file"
   git push
   ```

2. **The launcher will fetch from:**
   ```
   https://raw.githubusercontent.com/Stormixyt/Project-Drift/master/status.json
   ```

3. **To update status, just edit and push the file:**
   - Edit `status.json` locally or on GitHub
   - Commit and push changes
   - All users will see the update within 30 seconds!

### Option 2: Custom Server

1. **Edit the STATUS_API_URL in `launcher/launcher/src/renderer/renderer.js`:**
   ```javascript
   const STATUS_API_URL = 'https://your-domain.com/status.json';
   ```

2. **Host `status.json` on your server with CORS enabled**

## Status File Format

```json
{
  "lastUpdated": "2025-11-11T15:00:00Z",
  "message": "All systems operational",
  "gameServer": {
    "status": "online",    // online | degraded | offline
    "ping": 45            // optional, in milliseconds
  },
  "mcpBackend": {
    "status": "online",
    "ping": 32
  },
  "matchmaking": {
    "status": "online",
    "ping": 28
  },
  "authentication": {
    "status": "online",
    "ping": 15
  },
  "cdn": {
    "status": "online",
    "ping": 12
  }
}
```

## Status Values

- **`online`**: Service is fully operational (green indicator)
- **`degraded`**: Service is experiencing issues (yellow indicator)
- **`offline`**: Service is down (red indicator)

## Quick Status Updates

### All Systems Online
```json
{
  "message": "All systems operational",
  "gameServer": { "status": "online", "ping": 45 },
  "mcpBackend": { "status": "online", "ping": 32 },
  "matchmaking": { "status": "online", "ping": 28 },
  "authentication": { "status": "online", "ping": 15 },
  "cdn": { "status": "online", "ping": 12 }
}
```

### Maintenance Mode
```json
{
  "message": "Scheduled maintenance in progress",
  "gameServer": { "status": "offline" },
  "mcpBackend": { "status": "offline" },
  "matchmaking": { "status": "offline" },
  "authentication": { "status": "online", "ping": 15 },
  "cdn": { "status": "online", "ping": 12 }
}
```

### Partial Outage
```json
{
  "message": "Game servers experiencing connectivity issues",
  "gameServer": { "status": "degraded", "ping": 450 },
  "mcpBackend": { "status": "online", "ping": 32 },
  "matchmaking": { "status": "degraded", "ping": 280 },
  "authentication": { "status": "online", "ping": 15 },
  "cdn": { "status": "online", "ping": 12 }
}
```

## Tips

1. **Update via GitHub Web Interface**: No need to clone - just edit `status.json` directly on GitHub
2. **Status updates are instant**: Users see changes within 30 seconds
3. **No app updates needed**: Status is fetched remotely every time
4. **Can be automated**: Set up a script to update the JSON based on real server health checks

## Example Automation (Optional)

Create a simple script to auto-update status:

```bash
#!/bin/bash
# check-status.sh - Run this on a cron job

# Check if game server is responding
if curl -s --max-time 5 http://your-game-server:port/health > /dev/null; then
  GAME_STATUS="online"
else
  GAME_STATUS="offline"
fi

# Update status.json
cat > status.json <<EOF
{
  "message": "Automated status check",
  "gameServer": { "status": "$GAME_STATUS" },
  ...
}
EOF

# Push to GitHub
git add status.json
git commit -m "Auto-update status"
git push
```

## Support

For questions or issues, join our Discord: https://discord.gg/4mN7ChNJQf
