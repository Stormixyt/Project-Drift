# Getting Started with Project Drift

Welcome to Project Drift! This guide will help you set up and run the complete platform in minutes.

## What You'll Need

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Git** for version control
- (Optional) **Node.js 20+** for local development
- (Optional) **Rust 1.75+** for local game server development
- (Optional) **Unity 2022.3 LTS** for client development

## Quick Start (Recommended)

The fastest way to get Project Drift running locally:

### 1. Clone the Repository

```powershell
git clone https://github.com/yourusername/project-drift.git
cd project-drift
```

### 2. Start All Services

**Windows (PowerShell):**
```powershell
.\start-local.ps1
```

**Linux/macOS:**
```bash
chmod +x start-local.sh
./start-local.sh
```

This single command will:
- Start PostgreSQL database
- Start Redis cache
- Launch the Rust game server (UDP port 7777)
- Start the Node.js matchmaking service (port 8080)
- Serve the React admin dashboard (port 3000)
- Configure coturn TURN/STUN server (port 3478)

### 3. Access the Platform

**Admin Dashboard:** http://localhost:3000
- Default login: `admin` / `admin123` (⚠️ change in production!)

**Matchmaking API:** http://localhost:8080
- Health check: http://localhost:8080/health

**Game Server:** UDP port 7777
- Connect from Unity client

### 4. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f gameserver
docker-compose logs -f matchmaking
docker-compose logs -f admin
```

### 5. Stop All Services

```powershell
docker-compose down

# To also remove data volumes:
docker-compose down -v
```

---

## Development Workflow

### Working on the Game Server (Rust)

```bash
cd server

# Run directly (without Docker)
cargo run

# Run tests
cargo test

# Run with debug logging
RUST_LOG=debug cargo run

# Build release version
cargo build --release
```

### Working on Matchmaking Service (Node.js)

```bash
cd matchmaking

# Install dependencies
npm install

# Run in dev mode (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Working on Admin Dashboard (React)

```bash
cd admin

# Install dependencies
npm install

# Run dev server (hot reload)
npm run dev
# Opens at http://localhost:3000

# Build for production
npm run build

# Preview production build
npm run preview
```

### Working on Unity Client

1. Install **Unity Hub** and **Unity 2022.3 LTS**
2. Open the project: `client/unity/`
3. Scripts are in: `client/unity/Assets/Scripts/`
4. Build for Windows: `File > Build Settings > PC, Mac & Linux Standalone > Windows > Build`

---

## Project Structure Overview

```
project-drift/
├── server/              # Rust game server (authoritative)
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── tick.rs      # Game loop (30-60Hz)
│   │   ├── physics.rs   # Deterministic physics
│   │   ├── anticheat.rs # Validation & detection
│   │   └── network.rs   # UDP/QUIC networking
│   └── Cargo.toml
│
├── matchmaking/         # Node.js matchmaking service
│   ├── src/
│   │   ├── index.ts     # Express server
│   │   ├── routes/      # API endpoints
│   │   ├── websocket.ts # Socket.io handlers
│   │   └── middleware/  # Auth, rate limiting
│   └── package.json
│
├── admin/               # React admin dashboard
│   ├── src/
│   │   ├── pages/       # Dashboard & Login
│   │   ├── components/  # UI components
│   │   ├── services/    # API client
│   │   └── store/       # State management (Zustand)
│   └── package.json
│
├── client/unity/        # Unity game client
│   └── Assets/Scripts/
│       ├── NetworkClient.cs   # Client-side prediction
│       └── BuildImporter.cs   # Custom build loader
│
├── docs/                # Documentation
│   ├── architecture.mmd # System architecture diagram
│   ├── ui-guidelines.md # Design system
│   └── deployment.md    # Production deployment
│
├── docker/              # Docker configurations
│   ├── postgres/init.sql
│   ├── coturn/turnserver.conf
│   └── *.Dockerfile
│
├── .github/workflows/   # CI/CD pipelines
│   └── ci-cd.yml        # GitHub Actions
│
├── docker-compose.yml   # Local development setup
├── start-local.ps1      # Quick start (Windows)
└── start-local.sh       # Quick start (Linux/macOS)
```

---

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `matchmaking/src/routes/`
2. Add to `matchmaking/src/index.ts`
3. Update `admin/src/services/api.ts` (if needed)

### Modifying Game Physics

1. Edit `server/src/physics.rs`
2. Run determinism tests: `cd server && cargo test`
3. Rebuild: `cargo build --release`

### Changing UI Design

1. Update `admin/tailwind.config.js` for colors/theme
2. Modify components in `admin/src/components/`
3. Follow `docs/ui-guidelines.md` for consistency

### Importing a Custom Build

1. Open Unity client launcher
2. Click "Import Build"
3. Enter GitHub URL (e.g., `https://github.com/n6617x/Fortnitebuilds`)
4. Wait for download and verification
5. Build appears in launcher UI

---

## Testing

### Server Tests (Rust)

```bash
cd server

# All tests
cargo test

# Specific test
cargo test test_determinism

# With output
cargo test -- --nocapture
```

### Matchmaking Tests (Node.js)

```bash
cd matchmaking

# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Integration Tests

```bash
cd tests/integration
npm install
npm test
```

### Load Testing

```bash
cd tests/load
npm install
npm run load-test  # Simulates 100 players
```

---

## Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# General
NODE_ENV=development

# Database
DATABASE_URL=postgres://drift:drift@localhost:5432/drift
REDIS_URL=redis://localhost:6379

# Security (CHANGE IN PRODUCTION!)
JWT_SECRET=your-secret-here

# Game Server
TICK_RATE=60
MAX_PLAYERS=100
ENABLE_ANTICHEAT=true
```

---

## Troubleshooting

### Docker won't start

```powershell
# Check if Docker is running
docker info

# Restart Docker Desktop (Windows/Mac)
# Or restart Docker service (Linux):
sudo systemctl restart docker
```

### Port already in use

```powershell
# Find what's using the port (Windows)
netstat -ano | findstr :8080

# Kill the process
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
```

### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Recreate database
docker-compose down -v
docker-compose up -d postgres
```

### Can't connect to game server

1. Ensure UDP port 7777 is open in firewall
2. Check game server is running: `docker-compose ps gameserver`
3. View logs: `docker-compose logs gameserver`
4. Test TURN server: `docker-compose ps coturn`

---

## Next Steps

1. **Read the Architecture**: See `docs/architecture.mmd` for system design
2. **Customize UI**: Follow `docs/ui-guidelines.md` for design system
3. **Deploy to Production**: See `docs/deployment.md` for VPS/K8s deployment
4. **Add Custom Builds**: Import builds from GitHub or local files
5. **Enable Security**: Change default passwords, enable TLS, configure firewall

---

## Support

- **Issues**: https://github.com/yourusername/project-drift/issues
- **Discussions**: https://github.com/yourusername/project-drift/discussions
- **Documentation**: https://github.com/yourusername/project-drift/wiki

---

## License

Project Drift is open-source software licensed under the [MIT License](LICENSE).

---

**Happy building! 🎮**
