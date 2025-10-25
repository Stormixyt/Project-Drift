# 🎯 P2P Matchmaking - Visual Step-by-Step

Everything is already set up! Just follow these steps:

---

## ✅ Prerequisites (Already Done!)

Your docker-compose is running these services:
```
✓ drift-redis        → localhost:6379
✓ drift-matchmaking  → localhost:8080  
✓ drift-postgres     → localhost:5432
```

**Status: READY TO GO! 🚀**

---

## 📋 Step-by-Step Instructions

### **Step 1: Open PowerShell in Project Directory**

```powershell
cd "c:\Users\Stormix\Downloads\Project Drift"
```

---

### **Step 2: Start the Launcher**

```powershell
cd launcher
npm run dev
```

**What you'll see:**
- NPM compiling...
- Electron window opens
- Project Drift launcher appears

**Screenshot reference:**
```
┌──────────────────────────────────────────────┐
│  ─  □  ✕                   Project Drift     │
├──────┬───────────────────────────────────────┤
│ 🏠 Home│                                      │
│ 🛒 Store│                                     │
│ 📚 Library│                                   │
│ 🖥️ Servers│  ← THIS IS NEW!                   │
│ 🏪 Shop│                                      │
└──────┴───────────────────────────────────────┘
```

---

### **Step 3: Go to Servers Tab**

Click the **"Servers"** item in the left sidebar (🖥️ icon)

**You'll see:**
```
┌─────────────────────────────────────────────────────┐
│  P2P Servers              [⚙️ Hosting Settings]     │
│                                       0 servers     │
├─────────────────────────────────────────────────────┤
│                                                     │
│              🖥️  No servers available              │
│                                                     │
│     No one is hosting right now. Launch a game     │
│              to start hosting!                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### **Step 4: Configure Your Server**

Click **"Hosting Settings"** button (top right with ⚙️ icon)

**Modal appears:**
```
┌──────────────────────────────────────────┐
│  Server Hosting Settings            ✕   │
├──────────────────────────────────────────┤
│                                          │
│  Server Name                             │
│  ┌────────────────────────────────────┐  │
│  │ My Awesome Server                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Host Name                               │
│  ┌────────────────────────────────────┐  │
│  │ YourUsername                       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Game Mode                               │
│  ┌────────────────────────────────────┐  │
│  │ Battle Royale            ▼         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Max Players: 100                        │
│  ├───────●─────────────────────────┤     │
│                                          │
│  ☐ Limited Time Mode (LTM) Enabled       │
│  ☐ Special Event Enabled                 │
│  ☐ Private Server (hidden from list)     │
│                                          │
│              [ Cancel ]  [ Save Settings ]│
└──────────────────────────────────────────┘
```

**Fill in:**
1. Server Name: `My Test Server` (or anything you want)
2. Host Name: Your username
3. Game Mode: Leave as `Battle Royale`
4. Max Players: Leave at `100`
5. Leave checkboxes unchecked for now

Click **"Save Settings"** ✅

---

### **Step 5: Launch a Fortnite Build**

1. Click **"Library"** tab in sidebar
2. Find your Fortnite build (e.g., "4.5-CL-4169740")
3. Click the **"Launch"** button

**What happens:**
```
1. Game process starts
   → FortniteClient-Win64-Shipping.exe

2. After 2 seconds:
   → bypass.dll injects
   → "Bypass injected successfully" message

3. After 3 seconds:
   → Server registers with matchmaking
   → "Registered as P2P server: p2p_XXX"
   
4. Heartbeat starts:
   → POST /heartbeat every 60 seconds
```

---

### **Step 6: Check Your Server Appears!**

Go back to **"Servers"** tab

**You should now see:**
```
┌─────────────────────────────────────────────────────┐
│  P2P Servers              [⚙️ Hosting Settings]     │
│                                       1 server      │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │  My Test Server            [4.5-CL-4169740]   │ │
│  │  Host: YourUsername                           │ │
│  │                                               │ │
│  │  👥 1/100  │  🎮 Battle Royale  │  📍 192.168.1.X:7777 │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**🎉 SUCCESS! Your server is live!**

---

## 🧪 Testing Features

### Test 1: Auto-Refresh
- Stay on Servers tab
- Wait 5 seconds
- Server list automatically refreshes
- ✅ Server count updates

### Test 2: Version Filter
- Click version dropdown (top left)
- Select specific version
- Only servers with that version show
- ✅ Filter works!

### Test 3: Manual Refresh
- Click "🔄 Refresh" button
- Server list updates immediately
- ✅ Refresh works!

### Test 4: Server Cleanup
- Close the Fortnite game
- Watch the Servers tab
- After 5 seconds, your server disappears
- ✅ Auto-cleanup works!

### Test 5: Re-launch
- Launch game again
- Server reappears
- ✅ Registration works multiple times!

---

## 🎮 Multi-Player Test (Joining Another Server)

**If you have 2 computers or a friend:**

### Computer 1 (Host):
1. Launch game (server registers)
2. Note your IP: `192.168.X.X:7777`

### Computer 2 (Client):
1. Open launcher
2. Go to Servers tab
3. **See Computer 1's server in the list!**
4. Click the server card
5. **Game launches and connects!**

---

## 📊 Behind the Scenes

When you launch a game, this happens:

```
Launcher (main.js)
    ↓
registerServer() called
    ↓
POST http://localhost:8080/api/servers/register
    ↓
{
  "serverName": "My Test Server",
  "buildVersion": "4.5-CL-4169740",
  "ip": "192.168.1.X",
  "port": 7777,
  "mode": "Battle Royale",
  "maxPlayers": 100
}
    ↓
Matchmaking Service (routes/server.ts)
    ↓
Stores in Redis with 300s TTL
    ↓
Returns serverId: "p2p_1729887654321_abc"
    ↓
Launcher starts heartbeat (every 60s)
    ↓
Server appears in list!
```

**When someone clicks your server:**
```
Click server card
    ↓
join-server IPC called
    ↓
Check if they have version 4.5
    ↓
✓ Have it → Launch with -ServerIP=X.X.X.X -ServerPort=7777
✗ Don't have it → Prompt to download
```

---

## 🐛 Troubleshooting Quick Fixes

### Server Not Appearing?

**Check 1: Is matchmaking running?**
```powershell
docker ps | Select-String "matchmaking"
```
Should show: `drift-matchmaking   Up X minutes`

**Check 2: Test API manually**
```powershell
curl http://localhost:8080/api/servers/available
```
Should return: `[]` or `[{server data}]`

**Check 3: Check launcher console**
Press `F12` in launcher window → Console tab
Look for: `Registered as P2P server: p2p_XXX`

**Fix:** Restart launcher: Close window → `npm run dev`

---

### Redis Connection Error?

```powershell
docker restart drift-redis
docker logs drift-redis -f
```

Should see: `Ready to accept connections`

---

### Wrong Port?

**Symptom:** API calls fail with connection refused

**Check `launcher/src/main.js` line 62:**
```javascript
const API_URL = process.env.API_URL || 'http://localhost:8080/api';
```

**Check docker port:**
```powershell
docker ps | Select-String "matchmaking"
```
Should show: `0.0.0.0:8080->8080/tcp`

**Match the ports!** If docker says 3001, change launcher to 3001.

---

## ✅ Success Indicators

You know it's working when you see:

**In Launcher Console (F12):**
```
[Fortnite] LogInit: Build: ++Fortnite+Release-4.5-CL-4169740
Bypass injected successfully
Server registered: p2p_1729887654321_abc
```

**In Servers Tab:**
```
1 server (or more!)
Your server card shows up
Players: 1/100
Correct version badge
Correct IP:PORT
```

**In Docker Logs:**
```powershell
docker logs drift-matchmaking -f
```
```
[INFO] Server registered: p2p_1729887654321_abc
[INFO] Heartbeat received from p2p_1729887654321_abc
```

**In Redis:**
```powershell
docker exec -it drift-redis redis-cli SMEMBERS servers:active
```
```
1) "p2p_1729887654321_abc"
```

---

## 🎯 Final Checklist

Before asking for help, verify:

- [ ] Docker containers running: `docker ps`
- [ ] Matchmaking API responds: `curl http://localhost:8080/api/servers/available`
- [ ] Launcher starts: `cd launcher && npm run dev`
- [ ] Servers tab visible in sidebar
- [ ] Hosting Settings modal opens and saves
- [ ] Game launches from Library
- [ ] Check launcher console (F12) for "Server registered" message
- [ ] Server appears in Servers tab
- [ ] Server has correct name and version

---

## 🚀 You're All Set!

**Next time someone asks "How do I test P2P?":**

1. `cd launcher && npm run dev`
2. Click Servers → Hosting Settings → Save
3. Launch game from Library
4. Check Servers tab → **Your server is there!** 🎉

**That's it!** The system handles everything else automatically.

---

## 📁 Key Files Reference

| What | Where |
|------|-------|
| **Server registration logic** | `launcher/src/main.js` lines 380-472 |
| **Server list UI** | `launcher/src/renderer/index.html` lines 215-263 |
| **Auto-refresh code** | `launcher/src/renderer/renderer.js` lines 750-830 |
| **API endpoints** | `matchmaking/src/routes/server.ts` lines 5-145 |
| **Your settings** | `%APPDATA%\project-drift-launcher\server-settings.json` |

---

**Questions?** Check the detailed guides:
- `SIMPLE_P2P_GUIDE.md` - Troubleshooting
- `P2P_MATCHMAKING_SETUP.md` - Architecture
- `TESTING_P2P.md` - Full test scenarios
