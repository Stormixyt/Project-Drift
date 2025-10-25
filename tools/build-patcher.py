#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Drift - Advanced Build Patcher
Automatically patches Fortnite builds for private server use
Includes binary patching for SSL pinning and signature checks
"""

import os
import sys
import shutil
import hashlib
import struct
from pathlib import Path
from typing import List, Tuple, Optional
import argparse

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

class BinaryPatcher:
    """Handles binary patching of Fortnite executable"""
    
    # Common patterns to patch in Fortnite executables
    PATTERNS = {
        # SSL Certificate verification - replace with NOP or always return true
        'ssl_cert_verify': {
            'pattern': b'\x84\xC0\x0F\x84',  # test al, al; jz
            'patch': b'\x84\xC0\x90\xE9',     # test al, al; nop; jmp (always jump)
            'description': 'SSL certificate verification bypass'
        },
        
        # Signature check - common in UE4 games
        'signature_check': {
            'pattern': b'\x74\x05\xE8',  # jz short; call
            'patch': b'\xEB\x05\xE8',     # jmp short; call (always jump)
            'description': 'Signature verification bypass'
        },
        
        # Anti-debug checks
        'isdebuggerpresent': {
            'pattern': b'\xFF\x15',  # call [IsDebuggerPresent]
            'patch': b'\x33\xC0',     # xor eax, eax (return 0)
            'description': 'IsDebuggerPresent bypass'
        }
    }
    
    def __init__(self, exe_path: Path):
        self.exe_path = exe_path
        self.backup_path = exe_path.with_suffix('.exe.backup')
        self.patches_applied = []
        
    def create_backup(self) -> bool:
        """Create backup of original executable"""
        if not self.backup_path.exists():
            print(f"📦 Creating backup: {self.backup_path.name}")
            shutil.copy2(self.exe_path, self.backup_path)
            return True
        print(f"ℹ️  Backup already exists: {self.backup_path.name}")
        return False
    
    def find_pattern(self, data: bytes, pattern: bytes) -> List[int]:
        """Find all occurrences of a pattern in binary data"""
        offsets = []
        start = 0
        while True:
            offset = data.find(pattern, start)
            if offset == -1:
                break
            offsets.append(offset)
            start = offset + 1
        return offsets
    
    def apply_patch(self, data: bytearray, offset: int, patch: bytes) -> bool:
        """Apply a patch at a specific offset"""
        try:
            for i, byte in enumerate(patch):
                data[offset + i] = byte
            return True
        except Exception as e:
            print(f"❌ Failed to apply patch at offset 0x{offset:X}: {e}")
            return False
    
    def patch_executable(self, dry_run: bool = False) -> int:
        """
        Patch the executable with all known patterns
        Returns number of patches applied
        """
        print(f"\n🔧 Analyzing: {self.exe_path.name}")
        
        # Read executable
        with open(self.exe_path, 'rb') as f:
            data = bytearray(f.read())
        
        original_hash = hashlib.md5(data).hexdigest()
        print(f"📊 Original MD5: {original_hash}")
        print(f"📊 File size: {len(data):,} bytes")
        
        patches_count = 0
        
        # Try each known pattern
        for name, patch_info in self.PATTERNS.items():
            pattern = patch_info['pattern']
            patch = patch_info['patch']
            desc = patch_info['description']
            
            offsets = self.find_pattern(data, pattern)
            
            if offsets:
                print(f"\n✓ Found pattern '{name}' at {len(offsets)} location(s):")
                for offset in offsets:
                    print(f"  → 0x{offset:08X}")
                    
                    if not dry_run:
                        if self.apply_patch(data, offset, patch):
                            patches_count += 1
                            self.patches_applied.append({
                                'name': name,
                                'offset': offset,
                                'description': desc
                            })
            else:
                print(f"⚠️  Pattern '{name}' not found (may not be needed)")
        
        # Write patched executable
        if not dry_run and patches_count > 0:
            with open(self.exe_path, 'wb') as f:
                f.write(data)
            
            new_hash = hashlib.md5(data).hexdigest()
            print(f"\n✅ Patched executable saved")
            print(f"📊 New MD5: {new_hash}")
        
        return patches_count

class BuildPatcher:
    """Main build patcher class"""
    
    def __init__(self, build_path: Path, project_root: Path):
        self.build_path = build_path
        self.project_root = project_root
        self.binaries_path = build_path / 'FortniteGame' / 'Binaries' / 'Win64'
        self.exe_name = 'FortniteClient-Win64-Shipping.exe'
        self.launcher_name = 'FortniteLauncher.exe'
        
    def validate_build(self) -> bool:
        """Validate build structure"""
        print("\n🔍 Validating build structure...")
        
        required_paths = [
            self.binaries_path / self.exe_name,
            self.binaries_path / self.launcher_name,
            self.build_path / 'FortniteGame' / 'Content' / 'Paks'
        ]
        
        for path in required_paths:
            if not path.exists():
                print(f"❌ Missing: {path}")
                return False
            print(f"✓ Found: {path.name}")
        
        print("✅ Build structure valid")
        return True
    
    def detect_version(self) -> str:
        """Detect Fortnite version based on file size"""
        exe_path = self.binaries_path / self.exe_name
        size_mb = exe_path.stat().st_size / 1024 / 1024
        
        if 80 <= size_mb < 100:
            return "Season 7-8"
        elif 100 <= size_mb < 120:
            return "Season 9-10"
        elif size_mb >= 120:
            return "Season 11+"
        return "Unknown"
    
    def check_anticheat(self) -> dict:
        """Check for anti-cheat files"""
        print("\n🛡️  Checking anti-cheat status...")
        
        status = {
            'battleye': (self.binaries_path / 'BattlEye').exists(),
            'eac': (self.binaries_path / 'EasyAntiCheat').exists()
        }
        
        if status['battleye']:
            print("  ⚠️  BattlEye detected")
        if status['eac']:
            print("  ⚠️  EasyAntiCheat detected")
        
        if not any(status.values()):
            print("  ✓ No anti-cheat detected")
        
        return status
    
    def create_launcher_scripts(self):
        """Create launcher batch files"""
        print("\n📝 Creating launcher scripts...")
        
        # Main launcher
        launcher_bat = """@echo off
echo ================================================
echo Project Drift - Fortnite Build Launcher
echo ================================================
echo.
echo Starting Fortnite with custom backend...
echo.

REM Kill any existing Fortnite processes
taskkill /F /IM FortniteClient-Win64-Shipping.exe 2>nul
taskkill /F /IM FortniteLauncher.exe 2>nul
taskkill /F /IM BEService_x64.exe 2>nul
timeout /t 1 /nobreak >nul

REM Disable BattlEye (rename folder temporarily)
if exist "BattlEye" (
    if not exist "BattlEye.disabled" (
        echo Disabling BattlEye...
        ren "BattlEye" "BattlEye.disabled"
    )
)

REM Disable EasyAntiCheat (rename folder temporarily)
if exist "EasyAntiCheat" (
    if not exist "EasyAntiCheat.disabled" (
        echo Disabling EasyAntiCheat...
        ren "EasyAntiCheat" "EasyAntiCheat.disabled"
    )
)

REM Start the game with bypass arguments (using clean executable, not _BE or _EAC versions)
echo Launching Fortnite (no anti-cheat)...
start "" FortniteLauncher.exe -epicapp=Fortnite -epicenv=Prod -epicportal -epiclocale=en-us -skippatchcheck -HTTP=WinInet -NOSSLPINNING -nobe -noeac

echo.
echo Game launched! You should see the login screen.
echo Use any username/password to connect to Project Drift backend.
echo.
pause
"""
        
        launcher_path = self.binaries_path / 'Launcher.bat'
        launcher_path.write_text(launcher_bat, encoding='utf-8')
        print(f"✓ Created: {launcher_path.name}")
        
        # Quick start
        quick_start = """@echo off
title Project Drift - Quick Start
color 0A

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          PROJECT DRIFT - FORTNITE BUILD LAUNCHER          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if MCP backend is running
echo [1/2] Checking MCP backend...
netstat -an | findstr ":3551" >nul
if %ERRORLEVEL% EQU 0 (
    echo       ✓ MCP backend is running on port 3551
) else (
    echo       ⚠ MCP backend not detected - please start it manually
    echo       Run: cd mcp-backend ^&^& npm run dev
    pause
)

echo.
echo [2/2] Launching Fortnite...
call Launcher.bat

echo.
echo ════════════════════════════════════════════════════════════
echo All done! Check the game window.
echo ════════════════════════════════════════════════════════════
"""
        
        quick_start_path = self.binaries_path / 'Quick-Start.bat'
        quick_start_path.write_text(quick_start, encoding='utf-8')
        print(f"✓ Created: {quick_start_path.name}")
        
        # Restore anti-cheat script
        restore_anticheat = """@echo off
echo ================================================
echo Project Drift - Restore Anti-Cheat
echo ================================================
echo.
echo This will re-enable BattlEye and EasyAntiCheat
echo (Only use this if you need to launch via Epic)
echo.
pause

if exist "BattlEye.disabled" (
    echo Restoring BattlEye...
    ren "BattlEye.disabled" "BattlEye"
    echo ✓ BattlEye restored
)

if exist "EasyAntiCheat.disabled" (
    echo Restoring EasyAntiCheat...
    ren "EasyAntiCheat.disabled" "EasyAntiCheat"
    echo ✓ EasyAntiCheat restored
)

echo.
echo Done! Anti-cheat has been restored.
pause
"""
        
        restore_path = self.binaries_path / 'Restore-AntiCheat.bat'
        restore_path.write_text(restore_anticheat, encoding='utf-8')
        print(f"✓ Created: {restore_path.name}")
        
        # Direct launcher (bypasses FortniteLauncher.exe which might be BattlEye wrapper)
        direct_launcher = """@echo off
echo ================================================
echo Project Drift - Direct Launcher
echo ================================================
echo.
echo Launching game executable DIRECTLY
echo (bypassing FortniteLauncher.exe)
echo.

REM Kill any existing processes
taskkill /F /IM FortniteClient-Win64-Shipping.exe 2>nul
taskkill /F /IM FortniteLauncher.exe 2>nul
taskkill /F /IM BEService_x64.exe 2>nul
timeout /t 1 /nobreak >nul

REM Launch game directly
echo Starting FortniteClient-Win64-Shipping.exe...
start "" FortniteClient-Win64-Shipping.exe -epicapp=Fortnite -epicenv=Prod -epicportal -epiclocale=en-us -skippatchcheck -HTTP=WinInet -NOSSLPINNING -nobe -noeac -fromfl=eac -fltoken=3db3ba5dcbd2e16703f3978d

echo.
echo ✓ Game launched directly!
echo ✓ Bypassed FortniteLauncher.exe
echo.
echo If Launcher.bat shows BattlEye errors, use this instead!
echo.
pause
"""
        
        direct_path = self.binaries_path / 'Launcher-Direct.bat'
        direct_path.write_text(direct_launcher, encoding='utf-8')
        print(f"✓ Created: {direct_path.name}")
    
    def create_readme(self, patches_applied: int):
        """Create README file"""
        readme = f"""# Project Drift - Patched Build

This Fortnite build has been automatically patched by Project Drift.

## Patches Applied: {patches_applied}

## Quick Start

1. **Start MCP Backend** (in Project Drift folder):
   ```
   cd mcp-backend
   npm run dev
   ```

2. **Double-click Quick-Start.bat** in this folder

3. **Login** with any username/password at the Fortnite login screen

## What Was Patched?

- ✅ Launcher script with -NOSSLPINNING and -skippatchcheck
- ✅ Binary patches: {patches_applied} patches applied to executable
- ✅ Quick-start automation scripts

## Requirements

- Windows 10/11
- Visual C++ Redistributable 2015-2022
- Project Drift MCP backend running on port 3551
- Administrator privileges (for hosts file editing)

## Troubleshooting

### "Can't connect to Fortnite servers"
1. Make sure MCP backend is running: `npm run dev` in mcp-backend folder
2. Check hosts file has Epic domain redirects to 127.0.0.1
3. Try running as Administrator

### Game crashes
1. If anti-cheat interferes, rename BattlEye/EasyAntiCheat folders
2. Make sure Visual C++ Redistributables are installed
3. Check Windows Defender isn't blocking the patched exe

## Support

Check Project Drift documentation or GitHub issues.

---
Patched by Project Drift Build Patcher v1.0
{Path.cwd()}
"""
        
        readme_path = self.binaries_path / 'PROJECT_DRIFT_README.txt'
        readme_path.write_text(readme, encoding='utf-8')
        print(f"✓ Created: {readme_path.name}")
    
    def patch_build(self, binary_patch: bool = True, dry_run: bool = False):
        """Main patching routine"""
        print("""
╔════════════════════════════════════════════════════════════╗
║       PROJECT DRIFT - AUTOMATED BUILD PATCHER v1.0        ║
╚════════════════════════════════════════════════════════════╝
        """)
        
        print(f"📂 Build path: {self.build_path}")
        print(f"📂 Project root: {self.project_root}")
        
        # Validate
        if not self.validate_build():
            sys.exit(1)
        
        # Detect version
        version = self.detect_version()
        print(f"\n🎮 Detected version: {version}")
        
        # Check anti-cheat
        ac_status = self.check_anticheat()
        
        # Binary patching
        patches_applied = 0
        if binary_patch:
            exe_path = self.binaries_path / self.exe_name
            patcher = BinaryPatcher(exe_path)
            
            if not dry_run:
                patcher.create_backup()
            
            patches_applied = patcher.patch_executable(dry_run=dry_run)
            print(f"\n✅ Applied {patches_applied} binary patches")
        
        # Create scripts
        if not dry_run:
            self.create_launcher_scripts()
            self.create_readme(patches_applied)
        
        # Summary
        print("\n" + "="*60)
        print("✅ BUILD PATCHING COMPLETE!")
        print("="*60)
        print(f"\n📍 Patched build location:")
        print(f"   {self.binaries_path}")
        print(f"\n🚀 Next steps:")
        print(f"   1. Start MCP backend: cd mcp-backend && npm run dev")
        print(f"   2. Run: {self.binaries_path / 'Quick-Start.bat'}")
        print(f"   3. Login with any credentials")
        print(f"\n📖 Read PROJECT_DRIFT_README.txt for more info")
        print()

def main():
    parser = argparse.ArgumentParser(
        description='Project Drift - Automated Fortnite Build Patcher'
    )
    parser.add_argument(
        'build_path',
        type=str,
        help='Path to Fortnite build directory'
    )
    parser.add_argument(
        '--project-root',
        type=str,
        default=None,
        help='Path to Project Drift root (default: auto-detect)'
    )
    parser.add_argument(
        '--no-binary-patch',
        action='store_true',
        help='Skip binary patching (only create scripts)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Analyze only, don\'t modify files'
    )
    
    args = parser.parse_args()
    
    build_path = Path(args.build_path).resolve()
    project_root = Path(args.project_root).resolve() if args.project_root else Path(__file__).parent.parent
    
    if not build_path.exists():
        print(f"❌ Build path not found: {build_path}")
        sys.exit(1)
    
    patcher = BuildPatcher(build_path, project_root)
    
    try:
        patcher.patch_build(
            binary_patch=not args.no_binary_patch,
            dry_run=args.dry_run
        )
    except Exception as e:
        print(f"\n❌ Patching failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
