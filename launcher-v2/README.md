# Project Drift Launcher

Desktop launcher application for Project Drift - manage and launch custom Fortnite builds.

## Features

- 🎮 **Library Management** - Browse and organize your game builds
- 📥 **Download Manager** - Download builds from the server or import local installations
- 🚀 **Quick Launch** - One-click launch into your favorite build
- 👥 **Friends List** - See who's online and playing
- 📊 **Stats Tracking** - Track your K/D ratio, wins, and playtime
- 🎨 **Modern UI** - Clean, dark interface inspired by Era launcher
- 🔔 **Notifications** - Stay updated on new builds and updates

## Installation

### Option 1: Download Pre-built Installer (Recommended)

1. Go to the [Releases](releases) page
2. Download `Project-Drift-Setup-1.0.0.exe`
3. Run the installer
4. Launch Project Drift from your desktop or start menu

### Option 2: Build from Source

**Prerequisites:**
- Node.js 20+ installed
- npm or yarn package manager

**Steps:**

```powershell
# Navigate to launcher directory
cd launcher

# Install dependencies
npm install

# Run in development mode
npm start

# Build installer for Windows
npm run build:win
```

The built installer will be in `launcher/dist/Project Drift Setup 1.0.0.exe`

## Development

### Running in Dev Mode

```powershell
cd launcher
npm install
npm run dev
```

This opens the launcher with DevTools enabled.

### Project Structure

```
launcher/
├── src/
│   ├── main.js              # Electron main process
│   └── renderer/
│       ├── index.html       # Main UI
│       ├── styles.css       # Styling
│       └── renderer.js      # UI logic
├── assets/
│   └── icon.png             # App icon
├── package.json
└── README.md
```

### Configuration

The launcher connects to the matchmaking API at `http://localhost:8080` by default.

To change this, set the `API_URL` environment variable:

```powershell
$env:API_URL="https://your-api-server.com/api"
npm start
```

## Usage

### Launching a Game

1. **Select a Build** - Go to Library and click on a build
2. **Download** (if needed) - If not downloaded, it will start downloading
3. **Launch** - Click the Launch button on the home screen or in Library
4. The game will connect to an available server automatically

### Importing a Build

1. Go to **Library**
2. Click the **Import** card
3. Select the folder containing your Fortnite build
4. The build will be added to your library

### Managing Downloads

- View active downloads in the **Downloads** tab
- Downloads continue in the background
- Pause/resume not yet implemented (coming soon)

## Troubleshooting

### Launcher Won't Start

- Make sure Docker services are running (`docker ps` should show services)
- Check that the matchmaking API is accessible at `http://localhost:8080`
- Try running as Administrator

### Game Won't Launch

- Verify the build is fully downloaded
- Check that the game files are not corrupted
- Make sure your antivirus isn't blocking the launcher

### Connection Issues

- Ensure the matchmaking service is running
- Check your firewall settings
- Verify network connectivity

## Features Roadmap

- [ ] Pause/resume downloads
- [ ] Background updates
- [ ] Custom server browser
- [ ] In-app voice chat
- [ ] Achievement system
- [ ] Replay system
- [ ] Custom cosmetics manager
- [ ] Party/squad system

## API Integration

The launcher communicates with the Project Drift backend:

- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Builds**: `/api/builds` (list), `/api/builds/:id/download`
- **Stats**: `/api/users/:id/stats`
- **Friends**: `/api/users/:id/friends`
- **Servers**: `/api/servers` (find available game servers)

## Building an Installer

To create a Windows installer:

```powershell
npm run build:win
```

This uses `electron-builder` and creates:
- Portable .exe
- NSIS installer with uninstaller
- Auto-updater support (if configured)

## Tech Stack

- **Electron** - Desktop application framework
- **Node.js** - Backend runtime
- **Vanilla JS** - No frameworks, lightweight and fast
- **CSS3** - Modern styling with animations

## License

MIT License - see LICENSE file

## Credits

- Inspired by Era launcher
- Built for the Project Drift community
- Icons from Heroicons

## Support

- Discord: [Join our server](https://discord.gg/your-server)
- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: [docs.projectdrift.com](https://docs.projectdrift.com)
