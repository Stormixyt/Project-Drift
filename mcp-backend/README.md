# Project Drift - MCP Backend

Project Reboot-style Master Control Program backend for Fortnite.

## What This Does

Emulates Epic Games services locally so Fortnite can run without Epic's servers.

## Quick Start

```powershell
# 1. Setup (requires Admin)
cd ..
.\setup-mcp.ps1

# 2. Install
npm install

# 3. Run
npm run dev
```

Server runs on **http://localhost:3551**

## What's Emulated

- ✅ OAuth & Account Services
- ✅ MCP Profiles (athena, common_core)
- ✅ CloudStorage (config files)
- ✅ Matchmaking stubs
- ✅ Timeline & Events
- ✅ Friends & Presence
- ✅ Lightswitch (service status)
- ✅ Analytics (datarouter)

## How It Works

1. Hosts file redirects Epic domains to `127.0.0.1`
2. Fortnite connects to localhost:3551 instead of Epic
3. MCP backend returns fake responses
4. Fortnite thinks it's connected to Epic!

## Endpoints

```javascript
// Account
POST   /account/api/oauth/token
GET    /account/api/oauth/verify
GET    /account/api/public/account/:accountId

// MCP Profiles
POST   /fortnite/api/game/v2/profile/:accountId/client/:command

// CloudStorage
GET    /fortnite/api/cloudstorage/system
GET    /fortnite/api/cloudstorage/user/:accountId

// Timeline
GET    /fortnite/api/calendar/v1/timeline

// Lightswitch
GET    /lightswitch/api/service/Fortnite/status

// And 20+ more...
```

## Testing

```powershell
# Check service status
curl http://localhost:3551/lightswitch/api/service/Fortnite/status

# Should return:
# {
#   "status": "UP",
#   "message": "Project Drift MCP is running"
# }
```

## Logs

Watch the terminal when Fortnite launches:

```
[INFO] POST /account/api/oauth/token
[INFO] OAuth token request: client_credentials
[INFO] GET /fortnite/api/calendar/v1/timeline
[INFO] POST /fortnite/api/game/v2/profile/xxx/client/QueryProfile
[INFO] MCP Command: QueryProfile for xxx (profile: athena)
```

## Integration with Project Drift

Works alongside all existing features:

- ✅ P2P matchmaking (port 8080)
- ✅ Server browser
- ✅ Auto-hosting
- ✅ Build management
- ✅ Bypass injection

Just adds the MCP backend so Fortnite doesn't crash!

## Requirements

- Node.js 20+
- Administrator access (for hosts file)
- Ports 3551 available

## Dependencies

```json
{
  "express": "^4.18.2",
  "uuid": "^9.0.1",
  "winston": "^3.11.0"
}
```

## File Structure

```
mcp-backend/
├── package.json       # This file
├── src/
│   └── index.js      # MCP server (500+ lines)
└── node_modules/     # After npm install
```

## Configuration

Change port by setting environment variable:

```powershell
$env:MCP_PORT=3552
npm run dev
```

## Troubleshooting

**Game still crashes?**
- Check MCP is running: `curl http://localhost:3551/lightswitch/api/service/Fortnite/status`
- Verify hosts file: `Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "epicgames"`
- Flush DNS: `ipconfig /flushdns`

**No logs appearing?**
- Fortnite isn't connecting to MCP
- Check hosts file was modified correctly
- Run `.\setup-mcp.ps1` again as Admin

**Port already in use?**
- Change `MCP_PORT` in src/index.js line 447
- Or set environment variable

## Restore Original Settings

```powershell
cd ..
.\restore-hosts.ps1
```

## License

MIT

## Credits

Based on Project Reboot's MCP implementation approach.
