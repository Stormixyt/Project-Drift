# Project Drift Standalone Installer

This is a completely standalone installer for Project Drift that downloads and sets up everything automatically without requiring any additional setup or dependencies.

## How to Use

1. **Download the installer**: Get the `Install-ProjectDrift.bat` file
2. **Run as administrator** (recommended for shortcut creation)
3. **Follow the prompts**: The installer will:
   - Check for existing installations
   - Download the latest launcher from GitHub
   - Extract and install to `%USERPROFILE%\Project Drift\`
   - Create desktop and start menu shortcuts
   - Launch Project Drift automatically

## Features

- ✅ **Zero dependencies** - Works on any Windows 10/11 system
- ✅ **Automatic downloads** - Gets the latest version from GitHub releases
- ✅ **Offline fallback** - Uses local files if internet is unavailable
- ✅ **Progress feedback** - Shows download and installation progress
- ✅ **Shortcut creation** - Adds shortcuts to desktop and start menu
- ✅ **Auto-launch** - Starts Project Drift after installation

## What Gets Installed

- Project Drift launcher executable
- All required dependencies and libraries
- Configuration files
- Desktop and Start Menu shortcuts

## Installation Location

```
%USERPROFILE%\Project Drift\
├── Project Drift.exe (main launcher)
├── resources\
├── locales\
└── [other launcher files]
```

## Troubleshooting

- **Download fails**: The installer will automatically try a local fallback
- **Permission errors**: Run the batch file as administrator
- **Already installed**: The installer will detect and launch existing installations

## For Developers

To create a new release:

1. Build the launcher: `cd launcher && npm run build:win`
2. Create a GitHub release with the zip file from `launcher/dist/`
3. Update the download URL in the batch file if needed

The installer is completely self-contained and requires no external tools or runtimes.