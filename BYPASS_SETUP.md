# Bypass & Injector Setup

## Quick Start

1. **Build the bypass DLL and injector:**
   ```batch
   build-bypass.bat
   ```

2. **Launch game from launcher** - it will auto-inject the bypass

## Manual Build (if script fails)

### Prerequisites
- Visual Studio 2022 with "Desktop development with C++" workload
- Windows 10 SDK

### Steps
```batch
# Build bypass DLL
cd bypass
msbuild bypass.vcxproj /p:Configuration=Release /p:Platform=x64

# Build injector
cd ..\injector
msbuild injector.vcxproj /p:Configuration=Release /p:Platform=x64

# Copy outputs
copy bypass\x64\Release\bypass.dll release\bypass\
copy injector\x64\Release\injector.exe release\bypass\
```

## What Gets Built

- **`release/bypass/bypass.dll`** - The bypass library that hooks Fortnite functions
- **`release/bypass/injector.exe`** - Tool to inject the DLL into the game process

## How It Works

1. Launcher starts Fortnite with custom server arguments
2. After 2 seconds, injector.exe loads bypass.dll into the Fortnite process
3. bypass.dll hooks:
   - `LoadPackageAsync` → Provides default map when package name is empty
   - `IsDebuggerPresent` → Returns false to bypass launcher checks
   - `NtQueryInformationProcess` → Hides debugger flags

## Troubleshooting

**Build errors:**
- Install Visual Studio 2022 Community (free)
- Select "Desktop development with C++" workload
- Make sure Windows 10 SDK is installed

**Injection fails:**
- Disable antivirus temporarily (it may block DLL injection)
- Run launcher as Administrator
- Check that bypass.dll exists in `release/bypass/`

**Game still crashes:**
- The LoadPackageAsync pattern may need updating for your Fortnite version
- Check DebugView++ for bypass logs
- See `bypass/hooks.h` to adjust patterns

## Credits

Inspired by EraFN (danii, kyiro, mix, fischsalat)  
Uses MinHook by Tsuda Kageyu
