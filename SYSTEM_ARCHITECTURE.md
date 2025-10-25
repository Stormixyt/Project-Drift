# Project Drift - Complete System Architecture

## Full Stack Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FORTNITE CLIENT                              │
│                  (FortniteClient-Win64-Shipping.exe)                │
│                                                                      │
│  • Tries to connect to Epic Games services                          │
│  • Bypass DLL injected (hooks active)                               │
│  • LauncherCheck module now passes!                                 │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │ HTTPS requests to Epic domains
             │ (account-public-service-prod03.ol.epicgames.com, etc.)
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         HOSTS FILE REDIRECT                          │
│                  (C:\Windows\System32\drivers\etc\hosts)            │
│                                                                      │
│  127.0.0.1  account-public-service-prod03.ol.epicgames.com         │
│  127.0.0.1  fortnite-public-service-prod11.ol.epicgames.com        │
│  127.0.0.1  lightswitch-public-service-prod06.ol.epicgames.com     │
│  ... (15+ domains)                                                  │
│                                                                      │
│  ✅ Setup with: .\setup-mcp.ps1 (Admin)                            │
│  🔄 Restore with: .\restore-hosts.ps1 (Admin)                      │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │ All Epic traffic now goes to localhost
             │
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP BACKEND (NEW!)                              │
│                     Express.js (Node.js)                            │
│                        Port: 3551                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  OAuth & Account Services                                    │  │
│  │  • POST /account/api/oauth/token                            │  │
│  │  • GET  /account/api/public/account/:accountId              │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  MCP Profiles (Athena, Common Core)                         │  │
│  │  • POST /fortnite/api/game/v2/profile/:id/client/:cmd       │  │
│  │  • Commands: QueryProfile, ClientQuestLogin, etc.           │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  CloudStorage                                                │  │
│  │  • GET /fortnite/api/cloudstorage/system                    │  │
│  │  • Returns empty configs (Fortnite uses defaults)           │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Timeline & Events                                           │  │
│  │  • GET /fortnite/api/calendar/v1/timeline                   │  │
│  │  • GET /fortnite/api/storefront/v2/catalog                  │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Lightswitch (Service Status)                               │  │
│  │  • GET /lightswitch/api/service/Fortnite/status             │  │
│  │  • Always returns: { status: "UP" }                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  📁 Location: mcp-backend/                                          │
│  🚀 Start: npm run dev                                              │
│  ✅ Test: .\test-mcp-backend.ps1                                    │
└──────────────────────────────────────────────────────────────────────┘

             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    GAME LAUNCHES SUCCESSFULLY!                       │
│                                                                      │
│  ✅ No LauncherCheck crash                                          │
│  ✅ Game runs normally                                              │
│  ✅ Launcher registers P2P server                                   │
└────────────┬────────────────────────────────────────────────────────┘
             │
             │ Launcher detects game launched
             │
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    P2P MATCHMAKING SYSTEM                            │
│                   Express + TypeScript                               │
│                        Port: 8080                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Server Registration                                         │  │
│  │  • POST /api/servers/register                               │  │
│  │    - Generates serverId: p2p_timestamp_random               │  │
│  │    - Stores in Redis (300s TTL)                             │  │
│  │    - Adds to servers:active Set                             │  │
│  │    - Adds to servers:version:{version} Set                  │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Heartbeat System                                            │  │
│  │  • POST /api/servers/heartbeat/:serverId                    │  │
│  │    - Updates lastHeartbeat timestamp                        │  │
│  │    - Updates currentPlayers count                           │  │
│  │    - Refreshes Redis TTL (300s)                             │  │
│  │    - Sent every 60 seconds by launcher                      │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Server Discovery                                            │  │
│  │  • GET /api/servers/version/:buildVersion                   │  │
│  │    - Returns all non-private servers                        │  │
│  │    - Filtered by version                                    │  │
│  │    - Auto-refreshes every 5s in UI                          │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Unregistration                                              │  │
│  │  • POST /api/servers/unregister/:serverId                   │  │
│  │    - Removes from Redis                                     │  │
│  │    - Removes from all Sets                                  │  │
│  │    - Called on game exit                                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  📁 Location: matchmaking/                                          │
│  🚀 Start: docker-compose up -d                                     │
│  ✅ Test: .\test-p2p-system.ps1                                     │
└──────────────────────────────────────────────────────────────────────┘

             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         REDIS (Docker)                               │
│                          Port: 6379                                  │
│                                                                      │
│  Storage:                                                            │
│  • server:{serverId} → JSON (300s TTL)                              │
│  • servers:active → Set of all server IDs                           │
│  • servers:version:{version} → Set of server IDs by version         │
│                                                                      │
│  📦 Container: drift-redis                                          │
└──────────────────────────────────────────────────────────────────────┘

             ↑
             │ Stores server data
             │
┌─────────────────────────────────────────────────────────────────────┐
│                    ELECTRON LAUNCHER                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Main Process (main.js)                                      │  │
│  │  ────────────────────────────────────────────────────────   │  │
│  │  • Bypass Injection (MinHook DLL)                           │  │
│  │  • P2P Server Registration                                  │  │
│  │  • Build Management (import, delete, launch)                │  │
│  │  • Server Settings (load/save)                              │  │
│  │  • IPC Handlers (15+ handlers)                              │  │
│  │                                                              │  │
│  │  IPC Handlers:                                               │  │
│  │  • launch-game          → Inject bypass + register server  │  │
│  │  • import-build         → Copy files, create meta.json     │  │
│  │  • delete-build         → Delete build directory           │  │
│  │  • get-server-settings  → Load from JSON file              │  │
│  │  • save-server-settings → Write to JSON file               │  │
│  │  • get-server-list      → Fetch from P2P API               │  │
│  │  • join-server          → Launch with IP:PORT args         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Renderer Process (renderer.js)                             │  │
│  │  ────────────────────────────────────────────────────────   │  │
│  │  📚 Library Tab                                              │  │
│  │     • Grid of build cards                                   │  │
│  │     • Hover → delete button appears (red trash icon)       │  │
│  │     • Click build → launches game                           │  │
│  │     • Click delete → confirmation → remove                  │  │
│  │                                                              │  │
│  │  🖥️ Servers Tab                                             │  │
│  │     • Version filter dropdown                               │  │
│  │     • Server cards (name, IP, players, mode)                │  │
│  │     • LTM/Event badges                                      │  │
│  │     • Auto-refresh every 5s                                 │  │
│  │     • Click server → join (if version matches)              │  │
│  │                                                              │  │
│  │  ⚙️ Server Settings Modal                                   │  │
│  │     • Server name, host name                                │  │
│  │     • Game mode (dropdown)                                  │  │
│  │     • Max players (slider: 1-100)                           │  │
│  │     • LTM enabled (checkbox)                                │  │
│  │     • Event enabled (checkbox)                              │  │
│  │     • Private server (checkbox)                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  📁 Location: launcher/                                             │
│  🚀 Start: npm run dev                                              │
│  💾 Settings: %APPDATA%\project-drift-launcher\                     │
└──────────────────────────────────────────────────────────────────────┘

             │
             │ User clicks "Hosting Settings"
             │
             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER SETTINGS FILE                            │
│                                                                      │
│  📄 %APPDATA%\project-drift-launcher\server-settings.json           │
│                                                                      │
│  {                                                                   │
│    "serverName": "My Awesome Server",                               │
│    "hostName": "PlayerName",                                        │
│    "serverMode": "Battle Royale",                                   │
│    "maxPlayers": 100,                                               │
│    "isLTMEnabled": true,                                            │
│    "isEventEnabled": true,                                          │
│    "isPrivate": false                                               │
│  }                                                                   │
│                                                                      │
│  ✅ Loaded on game launch                                           │
│  ✅ Sent to P2P API during registration                             │
└──────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════
                         COMPLETE FLOW DIAGRAM
═══════════════════════════════════════════════════════════════════════

User Opens Launcher
    ↓
Clicks "Fortnite 4.5" in Library
    ↓
[1] Launcher: Spawns game process
    ↓
[2] Launcher: Injects bypass.dll (MinHook)
    ↓ (Hooks: LoadPackageAsync, IsDebuggerPresent, NtQueryInformationProcess)
    ↓
[3] Game: Tries to connect to Epic
    ↓ (account-public-service-prod03.ol.epicgames.com)
    ↓
[4] Hosts File: Redirects to 127.0.0.1
    ↓
[5] MCP Backend: Receives request on port 3551
    ↓
[6] MCP Backend: Returns fake OAuth token
    ↓ { access_token: "eg1~...", account_id: "uuid" }
    ↓
[7] Game: "Cool, I'm authenticated!"
    ↓
[8] Game: Requests profile data
    ↓ POST /fortnite/api/game/v2/profile/xxx/client/QueryProfile
    ↓
[9] MCP Backend: Returns empty profile
    ↓ { profileId: "athena", profileChanges: [] }
    ↓
[10] Game: "Cool, I have my profile!"
    ↓
[11] Game: Requests timeline/events
    ↓ GET /fortnite/api/calendar/v1/timeline
    ↓
[12] MCP Backend: Returns fake season data
    ↓ { seasonNumber: 1, seasonBegin: "2020-01-01" }
    ↓
[13] Game: "Cool, I know the season!"
    ↓
[14] Game: LauncherCheck module runs
    ↓
[15] LauncherCheck: ✅ PASSES (thinks Epic is connected)
    ↓
[16] Game: Continues loading...
    ↓
[17] Game: NOW RUNNING! 🎉
    ↓
[18] Launcher: Detects game running
    ↓
[19] Launcher: Loads server-settings.json
    ↓
[20] Launcher: POST /api/servers/register
    ↓ { serverName: "My Server", buildVersion: "4.5", ... }
    ↓
[21] P2P API: Generates serverId: p2p_1234_abc
    ↓
[22] P2P API: Stores in Redis (300s TTL)
    ↓
[23] P2P API: Returns { success: true, serverId: "..." }
    ↓
[24] Launcher: Starts heartbeat (every 60s)
    ↓
[25] Launcher: Attaches game exit handler
    ↓
[26] Game: Visible in everyone's server list!
    ↓
    ... User plays game ...
    ↓
[27] User: Closes game
    ↓
[28] Launcher: Detects game exit
    ↓
[29] Launcher: Stops heartbeat interval
    ↓
[30] Launcher: POST /api/servers/unregister/:serverId
    ↓
[31] P2P API: Removes from Redis
    ↓
[32] Server: Disappears from list


═══════════════════════════════════════════════════════════════════════
                          PORTS & SERVICES
═══════════════════════════════════════════════════════════════════════

Port 3551  → MCP Backend         (Epic service emulation)
Port 8080  → P2P Matchmaking     (Server registration/discovery)
Port 6379  → Redis               (P2P server storage)
Port 5432  → PostgreSQL          (User accounts, build catalog)
Port 7777  → Game Server         (UDP, when hosting)


═══════════════════════════════════════════════════════════════════════
                          FILE LOCATIONS
═══════════════════════════════════════════════════════════════════════

Project Files:
  C:\Users\Stormix\Downloads\Project Drift\
  ├── mcp-backend\              → MCP server
  ├── matchmaking\              → P2P API
  ├── launcher\                 → Electron app
  ├── bypass\                   → DLL hooks
  ├── injector\                 → DLL injector
  └── release\bypass\           → Compiled DLL + injector

User Data:
  %APPDATA%\project-drift-launcher\
  ├── builds\                   → Game builds
  │   └── build-{id}\
  │       ├── FortniteGame\
  │       └── meta.json
  └── server-settings.json      → Server config

System Files:
  C:\Windows\System32\drivers\etc\hosts
    → Modified by setup-mcp.ps1
    → Restored by restore-hosts.ps1


═══════════════════════════════════════════════════════════════════════
                          SCRIPTS OVERVIEW
═══════════════════════════════════════════════════════════════════════

Setup & Management:
  setup-mcp.ps1             → Modify hosts file (Admin required)
  restore-hosts.ps1         → Restore hosts file (Admin required)
  start-with-mcp.ps1        → Start all services at once

Testing:
  test-mcp-backend.ps1      → Validate MCP endpoints (8 tests)
  test-p2p-system.ps1       → Validate P2P system
  test-p2p-registration.ps1 → Test server registration


═══════════════════════════════════════════════════════════════════════
                          DOCUMENTATION
═══════════════════════════════════════════════════════════════════════

MCP Backend:
  MCP_BACKEND_GUIDE.md              → Complete guide (300+ lines)
  QUICK_START_MCP.md                → 5-minute setup
  MCP_IMPLEMENTATION_SUMMARY.md     → What was added
  mcp-backend\README.md             → Quick reference

P2P Matchmaking:
  SIMPLE_P2P_GUIDE.md               → Usage guide
  TESTING_P2P.md                    → Testing guide
  VISUAL_P2P_GUIDE.md               → Visual walkthrough

Build Management:
  BUILD_DELETE_FEATURE.md           → Delete builds feature

Overview:
  COMPLETE_FEATURE_SUMMARY.md       → Full platform summary
  README.md                         → Project README


═══════════════════════════════════════════════════════════════════════
                          QUICK COMMANDS
═══════════════════════════════════════════════════════════════════════

First Time Setup:
  .\setup-mcp.ps1                   # Run as Admin
  cd mcp-backend && npm install
  cd ../launcher && npm install

Start Everything:
  .\start-with-mcp.ps1              # Starts MCP + P2P + Launcher

Test:
  .\test-mcp-backend.ps1            # Verify MCP working
  .\test-p2p-system.ps1             # Verify P2P working

Restore:
  .\restore-hosts.ps1               # Remove hosts file changes (Admin)


═══════════════════════════════════════════════════════════════════════
                          SUCCESS INDICATORS
═══════════════════════════════════════════════════════════════════════

✅ MCP Working:
   - curl http://localhost:3551/lightswitch/api/service/Fortnite/status
   - Returns: { "status": "UP" }

✅ P2P Working:
   - curl http://localhost:8080/health
   - Returns: OK

✅ Game Working:
   - MCP terminal shows Epic API requests
   - Game doesn't crash at LauncherCheck
   - Launcher shows "Server registered: p2p_xxx"
   - Server appears in Servers tab

✅ Full System:
   - Launch game from launcher
   - Watch MCP terminal (see requests)
   - Check Servers tab (your server appears)
   - Friend sees your server in their list
   - Friend clicks → launches game with your IP
   - Both playing together! 🎉


═══════════════════════════════════════════════════════════════════════
