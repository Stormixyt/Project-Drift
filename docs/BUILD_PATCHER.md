# Project Drift - Build Patcher Documentation

## Overview

The Project Drift Build Patcher automatically patches any Fortnite build to work with custom private servers. It eliminates the need for the Epic Games Launcher and redirects all server communication to your local MCP backend.

## What Gets Patched?

### 1. **Launch Arguments**
Creates launcher scripts with critical bypass arguments:
- `-NOSSLPINNING` - Disables SSL certificate pinning
- `-skippatchcheck` - Skips Epic's patch verification
- `-HTTP=WinInet` - Uses Windows HTTP stack (easier to intercept)
- `-epicapp=Fortnite -epicenv=Prod` - Proper game identification

### 2. **Binary Patches** (Optional)
Modifies the executable to bypass:
- SSL certificate verification
- Code signature checks  
- Anti-debug protections
- Epic Launcher process checks

### 3. **Launcher Scripts**
- `Launcher.bat` - Basic game launcher
- `Quick-Start.bat` - One-click launch with backend check
- `Inject-Bypass.bat` - DLL injection for runtime bypasses

### 4. **Documentation**
- `PROJECT_DRIFT_README.txt` - User guide for the patched build

## How It Works

### ERA Build Analysis

The 7.20 ERA build that works uses this approach:

1. **Launch with bypass flags**:
   ```bat
   FortniteLauncher.exe ... -NOSSLPINNING -skippatchcheck
   ```

2. **Hosts file redirection** (already configured by Project Drift):
   ```
   127.0.0.1 account-public-service-prod.ol.epicgames.com
   127.0.0.1 fortnite-public-service-prod.ol.epicgames.com
   ... (all Epic domains)
   ```

3. **MCP Backend** responds to auth requests on port 3551

4. **Optional DLL injection** to bypass:
   - Epic Launcher process check
   - Anti-cheat (BattlEye/EasyAntiCheat)
   - Debug detection

### Automated Patching Process

```
┌─────────────────────────────────────────┐
│  1. Validate Build Structure            │
│     - Check for FortniteClient.exe      │
│     - Check for FortniteLauncher.exe    │
│     - Check for Content/Paks folder     │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  2. Detect Version                      │
│     - Based on file size                │
│     - Season 7-8, 9-10, 11+             │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  3. Check Anti-Cheat                    │
│     - BattlEye folder present?          │
│     - EasyAntiCheat folder present?     │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  4. Binary Patching (Optional)          │
│     - Backup original .exe              │
│     - Find SSL verification patterns    │
│     - Patch with NOP/JMP instructions   │
│     - Find signature check patterns     │
│     - Patch to always pass              │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  5. Create Launch Scripts               │
│     - Launcher.bat with bypass args     │
│     - Quick-Start.bat for automation    │
│     - Inject-Bypass.bat for DLL         │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  6. Generate Documentation              │
│     - README with instructions          │
│     - Troubleshooting guide             │
└─────────────────────────────────────────┘
```

## Usage

### Node.js Version (Recommended for scripting)

```bash
# Basic usage
node tools/build-patcher.js "C:\Path\To\Fortnite\Build"

# With custom project root
node tools/build-patcher.js "D:\Fortnite\7.20" "C:\Project Drift"
```

### Python Version (Advanced binary patching)

```bash
# Basic usage with binary patching
python tools/build-patcher.py "C:\Path\To\Fortnite\Build"

# Dry run (analyze only, no changes)
python tools/build-patcher.py "C:\Path\To\Fortnite\Build" --dry-run

# Skip binary patching (scripts only)
python tools/build-patcher.py "C:\Path\To\Fortnite\Build" --no-binary-patch

# Custom project root
python tools/build-patcher.py "D:\Fortnite" --project-root "C:\Project Drift"
```

### PowerShell Wrapper

```powershell
# Interactive patcher
.\patch-build.ps1

# Automated
.\patch-build.ps1 -BuildPath "C:\Fortnite\7.20"
```

## Binary Patching Details

### SSL Certificate Verification Bypass

**Pattern to find:**
```asm
test al, al    ; Check if SSL verification passed
jz   fail      ; Jump if zero (failed)
```
Hex: `84 C0 0F 84`

**Patch to:**
```asm
test al, al    ; Check (preserved for compatibility)
nop            ; No operation
jmp  success   ; Always jump (bypass check)
```
Hex: `84 C0 90 E9`

### Signature Verification Bypass

**Pattern:**
```asm
jz   short +5  ; Jump if signature valid
call verify    ; Call verification function
```
Hex: `74 05 E8`

**Patch:**
```asm
jmp  short +5  ; Always jump (skip verification)
call verify    ; Keep call for stability
```
Hex: `EB 05 E8`

### Anti-Debug Bypass

**Pattern:**
```asm
call [IsDebuggerPresent]
```
Hex: `FF 15 ?? ?? ?? ??`

**Patch:**
```asm
xor eax, eax   ; Set EAX to 0 (no debugger)
```
Hex: `33 C0`

## Integration with Build Importer

The build patcher integrates with Unity's build importer:

```csharp
// In BuildImporter.cs
private async Task PatchBuild(string buildPath) {
    // Run Node.js patcher
    var process = new Process {
        StartInfo = new ProcessStartInfo {
            FileName = "node",
            Arguments = $"tools/build-patcher.js \"{buildPath}\"",
            UseShellExecute = false,
            RedirectStandardOutput = true
        }
    };
    
    process.Start();
    string output = await process.StandardOutput.ReadToEndAsync();
    await process.WaitForExitAsync();
    
    if (process.ExitCode == 0) {
        Debug.Log("✅ Build patched successfully!");
    }
}
```

## Testing

### Manual Test

1. Get a clean Fortnite build (any season 7+)
2. Run the patcher:
   ```bash
   python tools/build-patcher.py "C:\Fortnite\Clean\7.40"
   ```
3. Navigate to `FortniteGame\Binaries\Win64`
4. Run `Quick-Start.bat`
5. Verify game launches and shows login screen
6. Login with any credentials
7. Confirm connection to MCP backend

### Automated Test

```python
# test-patcher.py
import subprocess
import sys

def test_patcher(build_path):
    # Run patcher
    result = subprocess.run(
        ['python', 'tools/build-patcher.py', build_path, '--dry-run'],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ Patcher analysis successful")
        print(result.stdout)
        return True
    else:
        print("❌ Patcher failed")
        print(result.stderr)
        return False

if __name__ == '__main__':
    success = test_patcher(sys.argv[1])
    sys.exit(0 if success else 1)
```

## Troubleshooting

### Patcher fails with "Missing required file"

**Cause**: Incomplete or corrupted build

**Solution**: 
- Verify build has all files
- Re-extract if from archive
- Check disk space

### Binary patching finds no patterns

**Cause**: Different Fortnite version with different code

**Solution**:
- Use `--no-binary-patch` to skip binary patching
- Rely on launch arguments and DLL injection
- Most modern builds work without binary patches

### Game crashes after patching

**Cause**: Anti-cheat interference or bad patch

**Solution**:
1. Restore from backup: `FortniteClient-Win64-Shipping.exe.backup`
2. Try without binary patching
3. Rename/disable BattlEye and EasyAntiCheat folders
4. Check if Visual C++ Redistributables are installed

### "Can't connect to servers" after launch

**Cause**: MCP backend not running or hosts file not configured

**Solution**:
1. Start MCP backend: `cd mcp-backend && npm run dev`
2. Verify it's running on port 3551: `netstat -an | findstr 3551`
3. Check hosts file has Epic domain redirects
4. Run as Administrator if hosts file changes needed

## Future Enhancements

### Planned Features

- [ ] **GUI Application**: Windows Forms/Electron UI for easy patching
- [ ] **Version Detection**: Auto-detect season from executable metadata
- [ ] **Pattern Database**: Maintain database of known patterns per version
- [ ] **Cloud Patterns**: Download latest patterns from Project Drift server
- [ ] **Batch Patching**: Patch multiple builds at once
- [ ] **Pak Modification**: Modify game assets (maps, modes)
- [ ] **Auto-Update**: Check for patcher updates

### Advanced Patterns

Research needed for:
- Memory integrity checks
- Pak file signature verification
- Network encryption keys
- Map loading hardcoded paths

## Contributing

To add new patch patterns:

1. Reverse engineer the target function using:
   - IDA Pro / Ghidra / Binary Ninja
   - x64dbg for dynamic analysis
   - Cheat Engine for memory scanning

2. Document the pattern in `PATTERNS` dict:
   ```python
   'my_new_patch': {
       'pattern': b'\x84\xC0\x0F\x84',
       'patch': b'\x84\xC0\x90\xE9',
       'description': 'Description of what this bypasses'
   }
   ```

3. Test on multiple Fortnite versions
4. Submit PR with test results

## Security Considerations

### Safety

- ✅ Only patches local game files
- ✅ Creates backups before modifying
- ✅ No network communication
- ✅ Open source and auditable

### Legal

- ⚠️ Modifying game files may violate Epic's ToS
- ⚠️ Only use with builds you own
- ⚠️ For educational/research purposes
- ⚠️ Not for use on official Epic servers

## License

MIT License - See PROJECT LICENSE file

---

**Project Drift Build Patcher v1.0**  
Part of Project Drift - Multiplayer Game Platform
