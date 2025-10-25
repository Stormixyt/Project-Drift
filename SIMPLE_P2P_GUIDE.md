# 🎯 P2P Matchmaking - SIMPLE 3-STEP GUIDE

## ✅ Good News: Docker Services Already Running!

I can see these are already up:
- ✅ **drift-redis** - Running on port 6379
- ✅ **drift-matchmaking** - Running on port 8080
- ✅ **drift-postgres** - Running on port 5432

**You can skip the Docker setup!** Just follow these 3 steps:

---

## Step 1️⃣: Check Services Are Working

```powershell
# Test matchmaking API is responding
curl http://localhost:8080/api/servers/available
```

**Expected response:**
```json
[]
```
(Empty array = no servers yet, which is correct!)

---

## Step 2️⃣: Start the Launcher

```powershell
cd launcher
npm run dev
```

**Wait for:** Electron window to open with Project Drift launcher

---

## Step 3️⃣: Test P2P Hosting

### A. Configure Your Server Settings
1. In launcher, click **"Servers"** tab (in left sidebar - has server icon)
2. Click **"Hosting Settings"** button (top right)
3. Fill in:
   ```
   Server Name: My Test Server
   Host Name: YourUsername
   Game Mode: Battle Royale
   Max Players: 100
   ✓ Save Settings
   ```

### B. Launch a Game
1. Go to **"Library"** tab
2. Find a Fortnite build
3. Click **"Launch"**
4. **Wait 2-3 seconds** for injection

### C. Check Your Server Appears
1. Go back to **"Servers"** tab
2. **You should see your server in the list!** 🎉

---

## 🔍 What You Should See

### In the Servers Tab:
```
┌─────────────────────────────────────────────┐
│  P2P Servers              [⚙️ Hosting Settings] │
│                                    1 server  │
├─────────────────────────────────────────────┤
│  My Test Server          [4.5-CL-4169740]   │
│  Host: YourUsername                         │
│  👥 1/100  |  🎮 Battle Royale  |  📍 192.168.1.X:7777
└─────────────────────────────────────────────┘
```

### In PowerShell (Matchmaking Logs):
```
[INFO] Server registered: p2p_1729887654321_abc123
[INFO] Server: My Test Server (4.5-CL-4169740)
[INFO] Heartbeat received from p2p_1729887654321_abc123
```

### In Browser (Optional Debug):
```powershell
curl http://localhost:8080/api/servers/version/4.5-CL-4169740
```

Response:
```json
{
  "success": true,
  "count": 1,
  "servers": [
    {
      "id": "p2p_1729887654321_abc123",
      "serverName": "My Test Server",
      "hostName": "YourUsername",
      "ip": "192.168.1.X",
      "port": 7777,
      "buildVersion": "4.5-CL-4169740",
      "mode": "Battle Royale",
      "maxPlayers": 100,
      "currentPlayers": 1
    }
  ]
}
```

---

## ⚠️ Common Issues

### Issue: "No servers available" message
**Possible causes:**
1. Game not launched yet → Launch a game first
2. API URL wrong → Check `launcher/src/main.js` has `http://localhost:8080/api`
3. Matchmaking not running → Check `docker ps` shows drift-matchmaking

**Fix:**
```javascript
// In launcher/src/main.js, line ~60
const API_URL = 'http://localhost:8080/api';  // Should match docker port
```

---

### Issue: Server doesn't register
**Check:**
1. Launcher console (F12) for errors
2. Matchmaking docker logs: `docker logs drift-matchmaking -f`
3. Redis working: `docker exec -it drift-redis redis-cli ping` → should return `PONG`

---

### Issue: Can't see Servers tab
**Problem:** The HTML/JS might not be loaded yet
**Fix:** 
1. Close launcher
2. Run `cd launcher && npm install` (rebuild)
3. Run `npm run dev` again

---

## 🧪 Advanced Testing

### Test Auto-Refresh (5 second interval)
1. Stay on Servers tab
2. Have a friend launch a game (or use 2nd computer)
3. **Wait 5 seconds**
4. Their server appears automatically!

### Test Join Flow
1. Click a server card
2. If you have that version → Game launches with server IP
3. If you don't have version → Download prompt appears

### Test Version Filter
1. Import multiple Fortnite versions (4.5, 7.20, etc.)
2. Launch different versions in separate instances
3. Use version dropdown to filter

### Test Cleanup
1. Close game
2. Check Servers tab
3. Your server disappears within 5 seconds (TTL expires)

---

## 📊 Debug Commands

### Check Redis Data
```powershell
docker exec -it drift-redis redis-cli
```

Inside Redis CLI:
```redis
# List all active servers
SMEMBERS servers:active

# Get specific server
GET server:p2p_1729887654321_abc123

# List servers for version
SMEMBERS servers:version:4.5-CL-4169740

# Check TTL
TTL server:p2p_1729887654321_abc123
```

### Monitor Matchmaking Logs
```powershell
docker logs drift-matchmaking -f --tail 50
```

### Test API Directly
```powershell
# Get all servers
curl http://localhost:8080/api/servers/available

# Get servers for version
curl http://localhost:8080/api/servers/version/4.5-CL-4169740

# Check health
curl http://localhost:8080/health
```

---

## 🎮 Quick Demo Script

Run this to test everything at once:

```powershell
# 1. Check services
Write-Host "Checking services..." -ForegroundColor Cyan
docker ps | Select-String "drift"

# 2. Test API
Write-Host "`nTesting API..." -ForegroundColor Cyan
curl http://localhost:8080/api/servers/available

# 3. Start launcher
Write-Host "`nStarting launcher..." -ForegroundColor Cyan
cd launcher
npm run dev
```

---

## 🎯 Success Checklist

- [ ] Docker containers running (drift-redis, drift-matchmaking)
- [ ] Matchmaking API responds: `curl http://localhost:8080/api/servers/available`
- [ ] Launcher opens without errors
- [ ] Servers tab visible in navigation
- [ ] Hosting Settings modal opens
- [ ] Settings save successfully
- [ ] Game launches from Library
- [ ] Server appears in Servers tab within 5 seconds
- [ ] Server has correct name, version, IP
- [ ] Auto-refresh updates every 5 seconds
- [ ] Closing game removes server from list

---

## 🚀 You're Ready!

If you see your server in the Servers tab after launching a game, **P2P matchmaking is working! 🎉**

Next person who runs the launcher will see your server and can join!

**Note:** For the matchmaking API URL, check if it's using port **8080** (docker) or **3001** (local dev).
Your docker-compose shows **8080**, so make sure launcher uses that.
