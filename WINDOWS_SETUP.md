# 🚀 Project Drift - Windows Setup Guide

## Current Status

Your system needs the following tools installed:

### ❌ Required (Missing)
1. **Docker Desktop** - For running all services in containers
2. **Node.js** - For matchmaking service and admin dashboard
3. **Git** - For version control (you likely have this since you cloned the repo)

### ⚠️ Optional (For Development)
4. **Rust** - Only if you want to modify the game server code locally
5. **Unity 2022.3 LTS** - Only if you want to modify the game client

---

## Installation Steps

### 1. Install Docker Desktop (Required)

**Download:** https://www.docker.com/products/docker-desktop

1. Download Docker Desktop for Windows
2. Run the installer
3. Follow the installation wizard
4. Restart your computer if prompted
5. Launch Docker Desktop
6. Wait for Docker to start (whale icon in system tray should be steady)

**Verify:**
```powershell
docker --version
docker info
```

---

### 2. Install Node.js 20 LTS (Required)

**Download:** https://nodejs.org/

1. Download the **LTS version** (20.x)
2. Run the installer
3. Accept all defaults
4. Check "Automatically install necessary tools" if prompted

**Verify:**
```powershell
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

---

### 3. Install Git (Required)

**Download:** https://git-scm.com/download/win

1. Download Git for Windows
2. Run the installer
3. Accept defaults (or customize as needed)
4. Important: Choose "Use Git from Windows Command Prompt"

**Verify:**
```powershell
git --version
```

---

### 4. Install Rust (Optional - for server development)

**Download:** https://rustup.rs/

1. Download and run `rustup-init.exe`
2. Follow the prompts (choose default installation)
3. Restart PowerShell after installation

**Verify:**
```powershell
rustc --version
cargo --version
```

---

## After Installation

### Option A: Run with Docker (Recommended - Easy)

Once Docker Desktop is running:

```powershell
# Start all services with one command
.\start-local.ps1
```

This will:
- Start PostgreSQL database
- Start Redis cache
- Build and run the Rust game server
- Build and run the matchmaking service
- Build and run the admin dashboard
- Start the TURN server

**Access:**
- Admin Dashboard: http://localhost:3000 (login: admin/admin123)
- Matchmaking API: http://localhost:8080
- Game Server: UDP port 7777

### Option B: Run Locally (For Development)

If you want to develop without Docker:

**1. Install Dependencies:**
```powershell
# Matchmaking service
cd matchmaking
npm install
cd ..

# Admin dashboard
cd admin
npm install
cd ..

# Game server (requires Rust)
cd server
cargo build
cd ..
```

**2. Start Services Manually:**

Open 4 separate PowerShell windows:

```powershell
# Window 1: PostgreSQL (use Docker or local install)
docker run -p 5432:5432 -e POSTGRES_PASSWORD=drift -e POSTGRES_USER=drift -e POSTGRES_DB=drift postgres:16

# Window 2: Redis (use Docker or local install)
docker run -p 6379:6379 redis:7-alpine

# Window 3: Matchmaking Service
cd matchmaking
npm run dev

# Window 4: Admin Dashboard
cd admin
npm run dev
```

---

## Quick Commands Reference

### PowerShell Syntax (NOT Bash!)

❌ **Don't use** (bash syntax):
```powershell
cd matchmaking && npm install   # This won't work!
```

✅ **Use** (PowerShell syntax):
```powershell
cd matchmaking; npm install     # Semicolon, not &&
```

Or run commands separately:
```powershell
cd matchmaking
npm install
```

---

## Troubleshooting

### Docker Won't Start

1. Enable Virtualization in BIOS (VT-x/AMD-V)
2. Enable Hyper-V in Windows Features
3. Restart computer
4. Try running Docker Desktop as Administrator

### Port Already in Use

```powershell
# Find what's using a port
netstat -ano | findstr :3000

# Kill the process (replace <PID> with actual number)
taskkill /PID <PID> /F
```

### npm Not Found After Installing Node.js

1. Close and reopen PowerShell
2. Or restart your computer
3. Verify PATH includes: `C:\Program Files\nodejs\`

---

## Next Steps

1. **Install the required tools** (Docker, Node.js, Git)
2. **Run the environment check:**
   ```powershell
   .\check-env.ps1
   ```
3. **Start Docker Desktop** and wait for it to be ready
4. **Run the startup script:**
   ```powershell
   .\start-local.ps1
   ```
5. **Open your browser:** http://localhost:3000

---

## Support

- Check `GETTING_STARTED.md` for detailed documentation
- Check `docs/deployment.md` for production setup
- Open an issue on GitHub if you encounter problems

---

**Once everything is installed, come back and run:**
```powershell
.\check-env.ps1      # Verify installation
.\start-local.ps1    # Start the platform
```
