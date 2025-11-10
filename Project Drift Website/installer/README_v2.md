# Project Drift 2.0.0 Installer

## What's Included

This installer packages everything you need to run Project Drift:

- **Launcher**: Electron-based launcher with Discord OAuth
- **Momentum Backend**: Node.js backend server with XMPP, matchmaking, and shop rotation
- **Starfall.dll**: Bypass DLL for redirecting Epic Games API calls
- **Injector**: Tool for injecting Starfall into Fortnite

## Prerequisites

Before running the installer, ensure you have:

1. **Node.js 20+** - [Download](https://nodejs.org)
2. **MongoDB Community** - [Download](https://www.mongodb.com/try/download/community)
3. **Windows 10/11 64-bit**
4. **8GB RAM minimum**
5. **DirectX 11 compatible GPU**

## Installation Steps

1. Run `Project-Drift-Installer-v2.0.0.exe`
2. Follow the installation wizard
3. Choose installation directory (default: `C:\Program Files\Project Drift`)
4. Wait for files to be copied
5. Review post-installation instructions

## Post-Installation

After installation completes:

### 1. Start MongoDB Service
```powershell
net start MongoDB
```

### 2. Configure Momentum Backend
Navigate to: `C:\Program Files\Project Drift\backend\momentum`

Create `.env` file with:
```env
MONGO_URI="mongodb://localhost:27017/momentum"
BOT_TOKEN="YOUR_DISCORD_BOT_TOKEN"
NAME="ProjectDrift"
ENABLE_CLOUD=true
PORT=3551
MATCHMAKER_IP="ws://127.0.0.1:3551/matchmaker"
```

### 3. Install Backend Dependencies
```powershell
cd "C:\Program Files\Project Drift\backend\momentum"
npm install
npm run build
```

### 4. Start Services

**Option A: Start Menu Shortcuts**
- **Start Momentum Backend** - Launches backend server
- **Project Drift** - Launches the game launcher

**Option B: Manual Start**
```powershell
# Terminal 1: Start Backend
cd "C:\Program Files\Project Drift\backend\momentum"
node build/index.js

# Terminal 2: Start Launcher
cd "C:\Program Files\Project Drift\launcher"
npm start
```

## First Launch

1. Start Momentum Backend (wait for "Connected to MongoDB")
2. Launch Project Drift from Start Menu or Desktop
3. Use Discord `/register` command to create account
4. Login with your credentials
5. Select a Fortnite build and launch!

## Troubleshooting

### Backend won't start
- Verify MongoDB is running: `net start MongoDB`
- Check Node.js is installed: `node --version`
- Ensure port 3551 and 80 are available

### Launcher won't start
- Check Node.js dependencies: `cd launcher && npm install`
- Verify electron is installed globally or in node_modules

### Game won't connect
- Confirm Momentum Backend is running on port 3551
- Check Starfall.dll exists in `release\bypass` folder
- Verify injector.exe has admin privileges

## Building from Source

If you want to build the installer yourself:

```powershell
cd "Project Drift Website\installer"
.\build-v2.ps1
```

This will:
1. Clean staging directory
2. Copy launcher files
3. Copy Momentum backend
4. Copy Starfall bypass DLL
5. Copy injector
6. Create configuration files
7. Run Inno Setup to build the installer

## Release Process

1. Build installer with `build-v2.ps1`
2. Create GitHub release: `v2.0.0`
3. Upload `Project-Drift-Installer-v2.0.0.exe`
4. Website automatically detects latest release

The download button on the website uses GitHub API to fetch the latest release asset, so users always get the newest version.

## Support

- **GitHub**: [Stormixyt/Project-Drift](https://github.com/Stormixyt/Project-Drift)
- **Discord**: https://discord.gg/4mN7ChNJQf
- **Issues**: https://github.com/Stormixyt/Project-Drift/issues

## License

Project Drift is provided as-is for educational and nostalgic purposes.
