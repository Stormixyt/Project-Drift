# Project Drift

> A multiplayer game platform for hosting and joining custom game builds with authoritative server control

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/yourusername/project-drift/workflows/CI/badge.svg)](https://github.com/yourusername/project-drift/actions)

## Overview

Project Drift is a production-ready multiplayer framework that enables players to experience custom game builds through private servers. Whether you want to play older versions of games or test custom modifications, Project Drift provides the infrastructure to host locally or globally with full NAT traversal support.

### ✅ Working Features

- ✅ **DLL Injection System**: Starfall bypass injection finally works with proper timing and error handling
- ✅ **Momentum Backend**: Full Epic Games service emulation (MCP, XMPP, Discord bot integration)
- ✅ **Discord Authentication**: OAuth login with account management via Discord commands
- ✅ **Cloud Features**: Shop rotation, item management, profile synchronization
- ✅ **P2P Matchmaking**: Auto-host servers when you open a game, join friends directly
- ✅ **Standalone Installer**: One-click installation with no developer tools required
- ✅ **Custom Build Support**: Import and run game builds from GitHub repos or local files
- ✅ **Modern Electron Launcher**: Beautiful UI with Discord integration and build management
- ✅ **One-Command Setup**: Get started with `./start-with-mcp.ps1`

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  Unity Client   │ ◄─UDP──►│   Rust Server    │
│   (Windows)     │         │  (Authoritative) │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ WebSocket/REST            │
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│  Matchmaking    │ ◄──────►│    Redis +       │
│   (Node.js)     │         │   PostgreSQL     │
└─────────────────┘         └──────────────────┘
         ▲
         │ HTTPS
         ▼
┌─────────────────┐
│ Admin Dashboard │
│     (React)     │
└─────────────────┘
```

## Quick Start

### Prerequisites

- **Windows**: For game client builds
- **Node.js 20+**: For MCP backend & matchmaking service
- **Docker & Docker Compose**: For Redis/PostgreSQL (optional)
- **Administrator Access**: For hosts file modification (MCP setup)

### With MCP Backend (Recommended - No Game Crashes!)

```powershell
# Clone the repository
git clone https://github.com/yourusername/project-drift.git
cd project-drift

# Setup MCP backend (run as Administrator - modifies hosts file)
.\setup-mcp.ps1

# Start all services (MCP + P2P + Launcher)
.\start-with-mcp.ps1
```

This will:
1. ✅ Redirect Epic Games domains to localhost (hosts file)
2. ✅ Start MCP backend (port 3551) - emulates Epic services
3. ✅ Start P2P matchmaking (port 8080) - server browser
4. ✅ Launch the game launcher

**No more LauncherCheck crashes! Games run perfectly.**

### Traditional Mode (Without MCP)

```powershell
# Start all services
.\start-local.ps1

# Or on Linux/macOS
./start-local.sh
```

This single command will:
1. Start PostgreSQL and Redis containers
2. Launch the Rust game server
3. Start the Node.js matchmaking service
4. Serve the React admin dashboard
5. Configure coturn TURN server

Access points:
- **Admin Dashboard**: http://localhost:3000
- **Matchmaking API**: http://localhost:8080
- **Game Server**: UDP port 7777
- **TURN Server**: UDP port 3478

### Building the Unity Client

```powershell
# Open Unity project
cd client/unity
# Open in Unity Editor 2022.3 LTS

# Build Windows .exe
# Build Settings → PC, Mac & Linux Standalone → Windows → IL2CPP → Build
```

Or use the automated build:

```powershell
cd ci
.\build-client.ps1
```

## Project Structure

```
project-drift/
├── mcp-backend/            # Epic Games service emulation (NEW!)
│   ├── src/
│   │   └── index.js        # MCP server (OAuth, profiles, etc.)
│   ├── package.json
│   └── README.md
├── launcher/               # Electron game launcher
│   ├── src/
│   │   ├── main.js         # IPC, game launch, P2P hosting
│   │   └── renderer/       # UI (Library, Servers, Settings)
│   └── package.json
├── matchmaking/            # Node.js P2P matchmaking service
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   └── server.ts   # P2P server registration API
│   │   └── websocket.ts    # Real-time updates
│   └── package.json
├── bypass/                 # DLL injection for launcher checks
│   ├── dllmain.cpp         # MinHook-based bypass
│   ├── hooks.h
│   └── minhook/            # MinHook library
├── injector/               # DLL injector executable
│   └── main.cpp
├── admin/                  # React admin dashboard
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Dashboard pages
│   │   └── api/            # API client
│   └── package.json
├── server/                 # Rust authoritative server (optional)
│   ├── src/
│   │   ├── main.rs
│   │   ├── tick.rs         # Game loop
│   │   ├── physics.rs      # Deterministic physics
│   │   ├── anticheat.rs    # Validation
│   │   └── network.rs      # UDP/QUIC
│   └── Cargo.toml
├── docs/                   # Documentation
│   ├── MCP_BACKEND_GUIDE.md      # MCP setup & usage
│   ├── SIMPLE_P2P_GUIDE.md       # P2P matchmaking guide
│   ├── BUILD_DELETE_FEATURE.md   # Build management docs
│   ├── architecture.mmd    # Mermaid diagram
│   └── deployment.md       # Deployment guide
├── tests/                  # Test suites
│   ├── determinism/        # Physics determinism tests
│   ├── network/            # Network simulation tests
│   └── integration/        # End-to-end tests
├── docker/                 # Docker configurations
│   ├── matchmaking.Dockerfile
│   ├── admin.Dockerfile
│   └── coturn.Dockerfile
├── k8s/                    # Kubernetes manifests
│   ├── server-deployment.yaml
│   ├── matchmaking-deployment.yaml
│   └── admin-deployment.yaml
├── release/                # Release artifacts
│   ├── installer.iss       # Inno Setup config
│   └── version.txt
├── docker-compose.yml      # Local development
├── start-local.sh          # Quick start script
├── start-local.ps1         # Windows quick start
└── README.md
```

## Development

### Server Development

```bash
cd server
cargo build --release
cargo run
```

### Matchmaking Development

```bash
cd matchmaking
npm install
npm run dev
```

### Admin Dashboard Development

```bash
cd admin
npm install
npm run dev
```

### Unity Client Development

Open `client/unity` in Unity Editor 2022.3 LTS. The project is pre-configured with all necessary networking scripts.

## Deployment

### Local Mode

Run everything on your local machine:

```powershell
.\start-local.ps1
```

### Public Mode

Deploy to a VPS for global access:

1. **Enable TURN relay**: Configure coturn with public IP
2. **Port forwarding**: Open UDP 7777 (game) and 3478 (TURN)
3. **Security**: Restrict admin endpoints to VPN/whitelist
4. **TLS**: Configure SSL certificates for HTTPS

See [docs/deployment.md](docs/deployment.md) for detailed instructions.

### Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check status
kubectl get pods
```

## Testing

```bash
# Run all tests
npm test

# Determinism tests
cd tests/determinism && cargo test

# Load tests (100 players)
cd tests/load && npm run load-test

# Integration tests
cd tests/integration && npm run test
```

## Security

- **TLS**: All API endpoints use HTTPS
- **JWT Authentication**: HS256 tokens for client auth
- **Rate Limiting**: Configured on all endpoints
- **Anti-Cheat**: Server-side velocity and teleport detection
- **Sandboxing**: Imported builds run in isolated processes
- **2FA**: Optional for admin panel

## Roadmap

- [x] Core server tick + client prediction
- [x] Lobby + matchmaking tokens
- [x] Admin dashboard + TURN integration
- [x] **MCP Backend (Project Reboot style) - No launcher crashes!**
- [x] **P2P Matchmaking - Auto-host servers, join friends**
- [x] **Build Management - Import, download, delete builds**
- [x] **Server Browser - Real-time server list with filters**
- [x] **Bypass System - DLL injection for launcher checks**
- [ ] Custom item shop integration
- [ ] Persistent stats tracking
- [ ] Anti-cheat enhancements
- [ ] CI/CD + release packaging
- [ ] Mobile client support
- [ ] Spectator mode

## UI Design

### Color Palette

- **Primary**: #00D9FF (Neon Blue)
- **Background**: #0A0A0A (Deep Black)
- **Surface**: #1A1A1A (Dark Gray)
- **Text**: #FFFFFF (White)
- **Text Secondary**: #A0A0A0 (Light Gray)

### Typography

- **Web**: Inter font family
- **Unity**: Default Unity fonts

### Design Principles

- Minimalist, flat UI
- Glass morphism effects
- Generous spacing
- High contrast for readability

See [docs/ui-guidelines.md](docs/ui-guidelines.md) for complete design system.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Project ERA and the custom game build community
- Built with modern networking best practices
- Designed for performance and stability

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/project-drift/issues)
- **Discord**: [Join our server](https://discord.gg/project-drift)
- **Documentation**: [Full docs](docs/)

---

**Built with ❤️ for the custom game community**
