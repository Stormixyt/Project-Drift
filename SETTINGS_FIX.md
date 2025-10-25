# 🔧 Server Settings Save Fix

## Problem
The server settings modal wasn't saving because the renderer was using `window.api.invoke()` instead of `ipcRenderer.invoke()`.

## Root Cause
The launcher uses:
```javascript
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false
}
```

This means there's no `window.api` bridge - you need to use `require('electron').ipcRenderer` directly.

## What Was Fixed

### Files Changed:
1. **`launcher/src/renderer/renderer.js`** - Changed all P2P functions from `window.api.invoke` to `ipcRenderer.invoke`

### Specific Changes:
```javascript
// BEFORE (BROKEN):
const settings = await window.api.invoke('get-server-settings');
const result = await window.api.invoke('save-server-settings', settings);
const result = await window.api.invoke('get-server-list', buildVersion);
const result = await window.api.invoke('join-server', {...});
const builds = await window.api.invoke('get-builds');

// AFTER (FIXED):
const settings = await ipcRenderer.invoke('get-server-settings');
const result = await ipcRenderer.invoke('save-server-settings', settings);
const result = await ipcRenderer.invoke('get-server-list', buildVersion);
const result = await ipcRenderer.invoke('join-server', {...});
const builds = await ipcRenderer.invoke('get-builds');
```

## Testing

### 1. Restart Launcher
```powershell
cd launcher
npm run dev
```

### 2. Open Server Settings
1. Click **"Servers"** tab
2. Click **"Hosting Settings"** button (⚙️)

### 3. Fill in Settings
```
Server Name: My Test Server
Host Name: YourUsername
Game Mode: Battle Royale
Max Players: 100
☐ LTM Enabled
☐ Event Enabled
☐ Private Server
```

### 4. Save
Click **"Save Settings"** button

### 5. Verify
**Console Output (F12):**
```
Saving settings: {serverName: "My Test Server", hostName: "YourUsername", ...}
[Main] Saving server settings to: C:\Users\...\AppData\Roaming\project-drift-launcher\server-settings.json
[Main] Settings: {...}
[Main] Settings saved successfully
Save result: {success: true}
Settings saved successfully!
```

**Settings File Created:**
```powershell
Get-Content "$env:APPDATA\project-drift-launcher\server-settings.json"
```

**Expected:**
```json
{
  "serverName": "My Test Server",
  "hostName": "YourUsername",
  "mode": "Battle Royale",
  "maxPlayers": 100,
  "ltmEnabled": false,
  "eventEnabled": false,
  "isPrivate": false
}
```

### 6. Verify Persistence
1. Close settings modal
2. Reopen settings modal
3. **Fields should be pre-filled with saved values!** ✅

## Debug Logging Added

### Renderer Console (F12):
- `Saving settings: {...}` - Shows settings object before saving
- `Save result: {...}` - Shows IPC response from main process
- Error messages include full error text

### Main Process Console:
- `[Main] Saving server settings to: <path>` - Shows file path
- `[Main] Settings: {...}` - Shows settings being saved
- `[Main] Settings saved successfully` - Confirms write success

## Common Issues

### Issue: "Cannot read properties of undefined"
**Cause:** Modal elements not found
**Fix:** Make sure modal HTML IDs match:
- `server-name`
- `host-name`
- `server-mode`
- `max-players`
- `ltm-enabled`
- `event-enabled`
- `private-server`

### Issue: Settings reset after relaunch
**Cause:** File path permission issues
**Fix:** Check file path in console: `[Main] Saving server settings to: ...`
Should be: `%APPDATA%\project-drift-launcher\server-settings.json`

### Issue: Modal doesn't close
**Cause:** `closeModal()` function issue
**Check:** Console for errors after "Save result"

## Next Steps

After verifying settings save:
1. ✅ Launch a game
2. ✅ Check if server registers with saved settings
3. ✅ Verify server appears in Servers tab with correct name
4. ✅ Test joining functionality

## Status
🟢 **FIXED** - All P2P IPC calls now use correct `ipcRenderer.invoke()` method
