# Project Drift Bypass & Injector

Bypass DLL and injector for running Fortnite builds standalone (without Epic Games Launcher).

## What it does

- **bypass.dll**: Hooks into Fortnite to bypass Epic launcher verification and fix LoadPackageAsync errors
- **injector.exe**: Injects the bypass DLL into the Fortnite process

## Features

✅ Bypass Epic Games Launcher requirement  
✅ Fix LoadPackageAsync empty package errors  
✅ Support for older Fortnite builds (4.5, 5.41, etc.)  
✅ Anti-debugging bypasses  
✅ Pattern scanning for cross-version compatibility

## Building

### Prerequisites
- Visual Studio 2022 with C++ Desktop Development workload
- Windows SDK 10.0

### Build Steps

1. Run the build script:
```batch
build-bypass.bat
```

2. Output will be in `release/bypass/`:
   - `bypass.dll` - The bypass library
   - `injector.exe` - The injection tool

## Usage

### Method 1: Manual Injection
1. Start Fortnite (it will error out)
2. Run injector:
```batch
cd release\bypass
injector.exe FortniteClient-Win64-Shipping.exe
```

### Method 2: Launcher Integration (Automatic)
The Project Drift launcher will automatically inject the bypass when launching builds.

## How It Works

1. **MinHook**: Uses Microsoft Detours-style hooking to intercept function calls
2. **LoadPackageAsync Hook**: Provides default map path when package name is empty
3. **Anti-Debug Hooks**: Bypasses IsDebuggerPresent and NtQueryInformationProcess
4. **Pattern Scanning**: Finds functions dynamically across different Fortnite versions

## Technical Details

### Hooked Functions
- `LoadPackageAsync` - Fixes empty package name errors
- `IsDebuggerPresent` - Returns false to bypass debugger detection
- `NtQueryInformationProcess` - Hides debugger presence from kernel queries

### Default Map
When Fortnite requests an empty/null package, the bypass provides:
```
/Game/Athena/Maps/Athena_Terrain
```

## Troubleshooting

**"Failed to inject"**
- Run injector as Administrator
- Make sure bypass.dll is in the same folder as injector.exe

**"Process not found"**
- Start Fortnite first, then inject
- Check Task Manager for the correct process name

**Game still crashes**
- Check build version compatibility
- Some builds may require custom patterns (see hooks.h)
- Use DebugView++ to see bypass logs

## Credits

Based on techniques from:
- EraFN by danii, kyiro, mix, and fischsalat
- MinHook by Tsuda Kageyu

## License

GPL-3.0 - This is for educational and compatibility purposes for Project Drift platform.
