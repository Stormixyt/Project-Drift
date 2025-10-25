# 🚀 P2P Matchmaking - Quick Start Guide

## What This Does
When you launch a Fortnite build, it automatically:
1. **Hosts a server** - Registers with the matchmaking service
2. **Shows up in the list** - Other players can see your server
3. **Lets others join** - They click your server and connect
4. **Auto-cleanup** - Unregisters when you close the game

---

## ⚡ Quick Start (5 Steps)

### **Step 1: Start Redis**
Redis stores the active server list.

```powershell
# Run this in PowerShell
docker run -d --name project-drift-redis -p 6379:6379 redis:7-alpine
```

**Check it's running:**
```powershell
docker ps | Select-String "redis"
```

---

### **Step 2: Start Matchmaking Service**
This handles server registration and queries.

```powershell
cd matchmaking
npm run dev
```

**You should see:**
```
[INFO] Matchmaking service started on port 3001
[INFO] Redis connected
```

**Leave this terminal running!** Open a new terminal for next step.

---

### **Step 3: Start Launcher**
```powershell
cd launcher
npm install   # First time only
npm run dev
```

The launcher window opens.

---

### **Step 4: Configure Your Server**
In the launcher:
1. Click **"Servers"** tab in sidebar
2. Click **"Hosting Settings"** button (top right)
3. Fill in:
   - **Server Name**: "My Awesome Server" (or whatever you want)
   - **Host Name**: Your username
   - **Game Mode**: Battle Royale (or Creative/Playground)
   - **Max Players**: 100
   - **LTM Enabled**: ☐ (optional)
   - **Event Enabled**: ☐ (optional)
   - **Private**: ☐ (unchecked = public)
4. Click **"Save Settings"**

---

### **Step 5: Launch Game**
1. Go to **"Library"** tab
2. Click **"Launch"** on a Fortnite build
3. Wait 2 seconds for bypass injection
4. **Game starts AND server auto-registers!**

Now go back to **"Servers"** tab → **You should see your server!**

---

## ✅ Testing the System

### **Test 1: Your Server Appears**
1. Launch a game
2. Go to Servers tab
3. **Expected:** Your server shows up in the list
4. **Check:** Server name, version, players (1/100), IP:PORT

### **Test 2: Auto-Refresh Works**
1. Stay on Servers tab
2. **Expected:** List refreshes every 5 seconds
3. **Check:** Server count updates, new servers appear

### **Test 3: Join Another Server** (Requires 2nd person/computer)
1. Have a friend launch a game (creates their server)
2. You see their server in your list
3. Click their server card
4. **Expected:** 
   - If you have that version → Game launches with their IP
   - If you don't → Prompt to download that version

### **Test 4: Version Filter**
1. Import multiple Fortnite versions
2. In Servers tab, use version dropdown
3. **Expected:** Only servers with selected version show

### **Test 5: Settings Persist**
1. Change server settings (name, mode, etc.)
2. Save and close launcher
3. Reopen launcher
4. Open settings again
5. **Expected:** Your settings are still there

### **Test 6: Cleanup**
1. Launch game (server registers)
2. Close game
3. Check Servers tab
4. **Expected:** Your server disappears within 5 seconds

---

## 🐛 Troubleshooting

### **Problem: Matchmaking service won't start**
```
Error: Redis connection failed
```
**Solution:** 
1. Check Redis is running: `docker ps`
2. Restart Redis: `docker restart project-drift-redis`
3. Check port 6379 isn't blocked

---

### **Problem: Server doesn't appear in list**
**Check:**
1. Matchmaking service running? (Check terminal)
2. Redis running? (`docker ps`)
3. Launch succeeded? (Check launcher console)
4. Version filter set correctly? (Try "All Versions")

**Debug:**
```powershell
# Check Redis has servers
docker exec -it project-drift-redis redis-cli
> SMEMBERS servers:active
> GET server:<serverId>
> exit
```

---

### **Problem: Can't join server**
```
You need version X.XX first
```
**Solution:**
1. Check if you have that build in Library
2. If not, click OK to download (if link available)
3. Or import that version manually

---

### **Problem: Game crashes on launch**
**This is the Fortnite bypass issue, not P2P!**
- Fortnite 4.5 requires backend MCP services
- P2P system works, but game itself needs server backend
- Try newer Fortnite versions (Season 7+)

---

## 📊 Monitoring

### **Check Active Servers (Redis CLI)**
```powershell
docker exec -it project-drift-redis redis-cli
```

```redis
# List all active server IDs
SMEMBERS servers:active

# Get specific server data
GET server:p2p_1729887654321_abc123

# List servers for version
SMEMBERS servers:version:4.5-CL-4169740

# Check TTL (should be ~300s)
TTL server:p2p_1729887654321_abc123
```

### **Check Matchmaking API**
```powershell
# Get servers for version 4.5
curl http://localhost:3001/api/servers/version/4.5-CL-4169740

# Get all available servers
curl http://localhost:3001/api/servers/available
```

---

## 🎮 Full Workflow Example

**Scenario:** You and a friend want to play together

### **You (Host):**
1. Start matchmaking: `cd matchmaking && npm run dev`
2. Start launcher: `cd launcher && npm run dev`
3. Configure server: Servers → Hosting Settings → "Bob's Server"
4. Launch Fortnite 4.5 from Library
5. Your server registers: **"Bob's Server - 4.5-CL-4169740 - 1/100"**

### **Friend (Client):**
1. Start their launcher (connects to YOUR matchmaking service at localhost:3001)
   - **Note:** If remote, they need to change API_URL in matchmaking/.env
2. Go to Servers tab
3. See: **"Bob's Server - 4.5-CL-4169740 - 1/100"**
4. Click the server card
5. If they have 4.5 → Game launches with your IP
6. If not → Download prompt appears

### **For Remote Play (Not Localhost):**
Update `matchmaking/.env`:
```env
API_URL=http://YOUR_PUBLIC_IP:3001
```

And in launcher's `main.js`, update:
```javascript
const API_URL = 'http://YOUR_PUBLIC_IP:3001/api';
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `matchmaking/src/routes/server.ts` | API endpoints for P2P |
| `launcher/src/main.js` | Auto-hosting logic |
| `launcher/src/renderer/renderer.js` | Server list UI |
| `launcher/src/renderer/index.html` | Servers view & modal |
| `server-settings.json` | Your hosting settings |
| `matchmaking/.env` | Service configuration |

---

## 🔥 Pro Tips

1. **Private Servers:** Enable "Private" in settings → Hidden from public list
2. **LTM Tags:** Enable LTM/Event → Shows colored badges
3. **Auto-Refresh:** Servers tab auto-refreshes every 5s
4. **Version Badge:** Purple badge shows required Fortnite version
5. **Manual Refresh:** Click refresh button to update immediately

---

## 📞 Need Help?

### **Check Logs:**
- Launcher: Press F12 in launcher window
- Matchmaking: Check terminal output
- Game: `%LOCALAPPDATA%\FortniteGame\Saved\Logs\`

### **Reset Everything:**
```powershell
# Stop all services
docker stop project-drift-redis
docker rm project-drift-redis

# Clear settings
Remove-Item "$env:APPDATA\project-drift-launcher\server-settings.json"

# Restart from Step 1
```

---

## ✨ What's Next?

After testing P2P matchmaking:
- [ ] Add toast notifications (replace console logs)
- [ ] Hook real player count from game
- [ ] Add ping display to servers
- [ ] WebSocket for real-time updates (no polling)
- [ ] Friends system (see which servers friends are on)
- [ ] Server favorites/bookmarks
- [ ] Direct IP connect option

---

**Status:** ✅ Ready to test!

**Questions?** Check the main `P2P_MATCHMAKING_SETUP.md` for architecture details.
