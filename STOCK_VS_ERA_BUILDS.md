# Stock vs ERA Fortnite Builds

## Summary
Your **4.5 build is a STOCK build** and **7.20 is an ERA build**. They require completely different launch methods.

## What's the Difference?

### ERA Builds (Pre-Patched) ✅
- **Example**: Your 7.20 build
- **How to identify**: 
  - FortniteLauncher.exe is ~147KB (clean)
  - Ships with custom Launcher.bat
  - Works immediately with private servers
- **How to launch**: Just run with launch arguments
  ```bash
  FortniteLauncher.exe -NOSSLPINNING -skippatchcheck -HTTP=WinInet
  ```
- **Why it works**: Already patched to bypass Epic's systems

### Stock Builds (Official) ❌  
- **Example**: Your 4.5 build
- **How to identify**:
  - FortniteLauncher.exe is ~373KB (BattlEye wrapper)
  - Requires Epic Games Launcher normally
  - Crashes when launched standalone
- **How to launch**: Requires DLL injection **AT STARTUP**
- **Why it's difficult**: Game crashes before DLL can be injected

## The Problem with 4.5

The crash you're seeing (`exit code -1073741819 = 0xC0000005`) happens because:

1. Stock builds check for Epic Games Launcher on startup
2. Without the launcher, they crash immediately 
3. Our inject-after-start approach fails because the game crashes in < 1 second
4. DLL injection needs to happen **during process creation** (CREATE_SUSPENDED)

## Solutions

### Option 1: Use ERA Builds (RECOMMENDED) ✅
- Find ERA versions of the seasons you want
- They work perfectly with your existing tools
- No DLL injection needed
- Your 7.20 build is an example - it works great!

### Option 2: Advanced Injection (Complex) ⚠️
Requires modifying the injector to:
1. Create process with CREATE_SUSPENDED flag
2. Inject DLL while process is suspended
3. Resume process after injection
4. This is what Project Reboot does internally

### Option 3: Convert Stock to ERA (Very Complex) 🔴
- Binary patch the executable
- Remove Epic launcher checks
- Replace FortniteLauncher.exe
- Not recommended - easier to find ERA builds

## Recommendation

**Use ERA builds for all seasons you want to run**. They're:
- Much easier to work with
- No anti-cheat issues
- No DLL injection needed
- Your current tools work perfectly

The 7.20 ERA build you have is the perfect example of what to look for.

## Current Status

✅ **7.20 (ERA)**: Working perfectly
❌ **4.5 (Stock)**: Crashes on launch - needs ERA version or advanced injection

## Files You Have

```
Project Drift/
├── injector/           # DLL injector (works but needs process suspended)
├── bypass/             # Bypass DLL (works but arrives too late)
├── tools/              # Build patcher (works for ERA builds)
└── mcp-backend/        # Backend server (works with all builds)
```

Your infrastructure is solid - you just need ERA builds to use it with!
