# 🚀 Quick Start - MCP Backend + P2P Matchmaking

Get Project Drift running with **zero game crashes** in 5 minutes!

## What You Get

✅ **No LauncherCheck crashes** - MCP backend emulates Epic services  
✅ **P2P matchmaking** - Auto-host servers when you open games  
✅ **Server browser** - Join friends' servers directly  
✅ **Build management** - Import, download, delete game builds  
✅ **All existing features** - Everything works together!

## Prerequisites

- Windows 10/11
- Node.js 20+ ([download](https://nodejs.org))
- Docker Desktop (optional, for P2P matchmaking)
- Administrator access (for hosts file)

## Step 1: Setup MCP Backend (2 minutes)

**Right-click PowerShell → Run as Administrator**

```powershell
cd "C:\Users\Stormix\Downloads\Project Drift"
.\setup-mcp.ps1
```

This will:
- ✅ Backup your hosts file
- ✅ Redirect Epic Games domains to localhost
- ✅ Flush DNS cache

You'll see:
```
✅ MCP Backend Setup Complete!

Next steps:
1. Start the MCP backend: cd mcp-backend && npm install && npm run dev
2. Start P2P matchmaking: docker-compose up -d
3. Start launcher: cd launcher && npm run dev
```

## Step 2: Install MCP Dependencies (1 minute)

```powershell
cd mcp-backend
npm install
```

## Step 3: Start Everything (1 minute)

**Close the Admin PowerShell, open a regular PowerShell:**

```powershell
cd "C:\Users\Stormix\Downloads\Project Drift"
.\start-with-mcp.ps1
```

This starts:
1. **MCP Backend** (port 3551) - New terminal window
2. **P2P Matchmaking** (port 8080) - Docker container
3. **Launcher** (Electron app) - New terminal window

Wait ~10 seconds for everything to start.

## Step 4: Launch Fortnite (1 minute)

1. Launcher opens automatically
2. Go to **Library** tab
3. Click any Fortnite build
4. **Watch the MCP Backend terminal!**

You'll see Epic API requests:
```
[INFO] POST /account/api/oauth/token
[INFO] GET /fortnite/api/calendar/v1/timeline
[INFO] POST /fortnite/api/game/v2/profile/xxx/client/QueryProfile
```

**Game launches and DOESN'T CRASH! 🎉**

Before:
```
Shutting down and abandoning module LauncherCheck (2)
Exiting.
```

After:
```
✓ Game runs!
✓ Server registered: p2p_xxx
✓ Visible in server list!
```

## Verify Everything Works

### Check 1: MCP Backend
```powershell
curl http://localhost:3551/lightswitch/api/service/Fortnite/status
```

Should return:
```json
{
  "status": "UP",
  "message": "Project Drift MCP is running"
}
```

### Check 2: P2P Matchmaking
```powershell
curl http://localhost:8080/health
```

Should return `OK`

### Check 3: Server Registration

1. Go to **Servers** tab in launcher
2. Your server should appear within 5 seconds:
   - Server name (from settings)
   - IP address
   - Version badge
   - Player count (1/100)

## What's Happening Behind the Scenes

```
Fortnite
  ↓
Tries to connect to Epic Games
  ↓
Hosts file redirects to 127.0.0.1
  ↓
MCP Backend responds (port 3551)
  ↓
Fortnite thinks it's connected to Epic!
  ↓
Game runs normally
  ↓
Launcher registers P2P server (port 8080)
  ↓
Server appears in Servers tab
```

## Configure Your Server (Optional)

1. Go to **Servers** tab
2. Click **Hosting Settings**
3. Set:
   - Server Name: "My Awesome Server"
   - Host Name: Your name
   - Game Mode: Battle Royale / Creative / Playground
   - Max Players: 100
   - Enable LTM: ✓
   - Enable Events: ✓
   - Private Server: ✗
4. Click **Save Settings**

Next game launch will use these settings!

## Join a Friend's Server

1. Make sure you have the same game version
2. Go to **Servers** tab
3. Find their server in the list
4. Click the server card
5. Game launches with their IP:PORT automatically!

## Troubleshooting

### Game Still Crashes

**Check MCP is running:**
```powershell
curl http://localhost:3551/lightswitch/api/service/Fortnite/status
```

If this fails:
- MCP backend isn't running
- Start it: `cd mcp-backend && npm run dev`

**Check hosts file:**
```powershell
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "epicgames"
```

Should show:
```
127.0.0.1    account-public-service-prod03.ol.epicgames.com
127.0.0.1    fortnite-public-service-prod11.ol.epicgames.com
...
```

If not, run `.\setup-mcp.ps1` again as Admin.

**Flush DNS:**
```powershell
ipconfig /flushdns
```

### No Server Appears in List

**Check Docker:**
```powershell
docker ps
```

Should show `drift-matchmaking` container.

If not:
```powershell
docker-compose up -d
```

**Check settings saved:**
```powershell
Get-Content "$env:APPDATA\project-drift-launcher\server-settings.json"
```

Should show your settings. If not, save again in launcher.

### Port Already in Use

**MCP Backend (3551):**
Edit `mcp-backend/src/index.js` line 447:
```javascript
const PORT = process.env.MCP_PORT || 3552; // Change to 3552
```

**P2P Matchmaking (8080):**
Edit `docker-compose.yml`:
```yaml
ports:
  - "8081:8080"  # Change to 8081
```

Then update `launcher/src/main.js` line 62:
```javascript
const API_URL = 'http://localhost:8081/api';
```

## Restore Original Settings

When you're done testing:

```powershell
# Run as Administrator
.\restore-hosts.ps1
```

This removes all Epic domain redirects.

## File Locations

- **Builds**: `%APPDATA%\project-drift-launcher\builds\`
- **Settings**: `%APPDATA%\project-drift-launcher\server-settings.json`
- **Hosts Backup**: `C:\Windows\System32\drivers\etc\hosts.backup.YYYYMMDD-HHMMSS`

## Next Steps

### Add More Builds

1. **Import existing**:
   - Library → Import
   - Select folder with `FortniteClient-Win64-Shipping.exe`

2. **Download from URL**:
   - Add build to database with `download_url`
   - Launcher shows it in Library
   - Click to download automatically

### Customize MCP

Edit `mcp-backend/src/index.js`:
- Add custom skins (line 50-80)
- Change events (line 250-280)
- Modify timeline (line 285)

### Deploy for Friends

1. Deploy matchmaking to VPS:
   ```bash
   docker-compose up -d
   ```

2. Update launcher API URL:
   ```javascript
   const API_URL = 'https://your-server.com/api';
   ```

3. Friends install launcher pointing to your server

4. Everyone sees each other's servers!

## Performance

- **MCP Backend**: ~50MB RAM, <1% CPU
- **P2P Matchmaking**: ~100MB RAM, <2% CPU
- **Launcher**: ~150MB RAM, <5% CPU
- **Total**: ~300MB RAM when idle

## What's Different from Other Solutions

| Feature | Project Reboot | EraFN | Project Drift |
|---------|---------------|-------|---------------|
| MCP Backend | ✓ | ✓ | ✓ |
| P2P Hosting | ✗ | ✗ | ✓ |
| Server Browser | ✗ | ✗ | ✓ |
| Auto-Hosting | ✗ | ✗ | ✓ |
| Build Manager | Manual | Manual | ✓ |
| Version Matching | Manual | Manual | ✓ |
| Join Flow | Manual IP | Manual IP | ✓ Auto |

## Support

Issues? Check:
1. MCP terminal for errors
2. Launcher console (F12) for errors
3. Game logs: `%LOCALAPPDATA%\FortniteGame\Saved\Logs`

---

## Summary

You now have:
✅ Working MCP backend (no crashes)  
✅ P2P matchmaking (auto-host + server list)  
✅ Build management (import + delete)  
✅ Server browser (join friends)  
✅ Settings persistence  
✅ Version checking  

**All in ~5 minutes! 🚀**

Now go play some Fortnite!
