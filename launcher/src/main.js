const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const Store = require('electron-store');
const path = require('path');
const axios = require('axios');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const https = require('https');
const { pipeline } = require('stream/promises');
const extract = require('extract-zip');
const util = require('util');
const execPromise = util.promisify(exec);

// Initialize persistent store for session management
const store = new Store();

let sevenZipPath = null;
try {
  // 7zip binary for extracting .rar/.7z archives on Windows
  sevenZipPath = require('7zip-bin').path7za || null;
} catch (_) {
  // optional dependency
}

// Game server process
let gameServerProcess = null;
let serverStarting = false;

// Reduce GPU cache usage to avoid Windows cache permission errors (non-fatal)
try {
  app.disableHardwareAcceleration();
  // Ensure cache/userData go to a writable Roaming path
  const safeUserDir = path.join(app.getPath('appData'), 'Project Drift Launcher');
  app.setPath('userData', safeUserDir);
  app.setPath('cache', path.join(safeUserDir, 'Cache'));
} catch (_) {
  // Best-effort only
}

// Provide optional local catalog of builds (user-managed JSON)
// Looks for catalog.json in userData, then docs/build_catalog.json (dev), then sample as last resort
ipcMain.handle('get-local-catalog', async () => {
  try {
    const candidates = [
      path.join(app.getPath('userData'), 'catalog.json'),
      path.resolve(__dirname, '..', '..', 'docs', 'build_catalog.json'),
      path.resolve(__dirname, '..', '..', 'docs', 'build_catalog.sample.json'),
    ];

    for (const p of candidates) {
      try {
        const raw = await fs.readFile(p, 'utf8');
        const parsed = JSON.parse(raw);
        const builds = Array.isArray(parsed) ? parsed : Array.isArray(parsed.builds) ? parsed.builds : [];
        // Tag source so renderer can decide behavior (e.g., open in browser)
        return { success: true, builds: builds.map(b => ({ ...b, source: 'local-catalog' })) };
      } catch (_) { /* try next */ }
    }
    return { success: true, builds: [] };
  } catch (err) {
    return { success: false, error: 'Failed to read local catalog' };
  }
});

// API configuration - connects to Project Drift matchmaking server
const API_URL = process.env.API_URL || 'http://localhost:8080/api';
const BUILDS_DIR = path.join(app.getPath('userData'), 'builds');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'server-settings.json');

// Server hosting state
let hostedServerId = null;
let heartbeatInterval = null;

let mainWindow;
let userData = null;
let authToken = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile('src/renderer/index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

    // Note: Game server must be started manually for now
    // To start: cd server && cargo run --release (requires Visual Studio Build Tools + Windows SDK)

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

// ============================================
// WINDOW CONTROLS
// ============================================
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// ============================================
// APP LIFECYCLE
// ============================================
app.on('window-all-closed', () => {
  // Unregister P2P server
  if (hostedServerId) {
    unregisterServer().catch(err => console.error('Failed to unregister on close:', err));
  }
  
  // Stop game server when app closes
  if (gameServerProcess) {
    console.log('Stopping game server...');
    gameServerProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================
// Game Server Management
// ============================================

// Check if Rust/Cargo is installed
async function checkRustInstalled() {
  try {
    await execPromise('cargo --version');
    return true;
  } catch (error) {
    return false;
  }
}

// Check if Visual Studio Build Tools are installed
async function checkVSBuildTools() {
  try {
    await execPromise('where link.exe');
    return true;
  } catch (error) {
    return false;
  }
}

// Install Visual Studio Build Tools
async function installVSBuildTools() {
  console.log('Visual Studio Build Tools not found. Downloading...');
  
  return new Promise((resolve, reject) => {
    const vsInstaller = path.join(app.getPath('temp'), 'vs_buildtools.exe');
    const vsUrl = 'https://aka.ms/vs/17/release/vs_buildtools.exe';
    
    const file = fsSync.createWriteStream(vsInstaller);
    https.get(vsUrl, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              console.log('Running VS Build Tools installer with C++ Desktop workload...');
              console.log('This will take several minutes. Please wait...');
              
              // Install with C++ Desktop Development workload
              const installer = spawn(vsInstaller, [
                '--quiet',
                '--wait',
                '--norestart',
                '--nocache',
                '--add', 'Microsoft.VisualStudio.Workload.VCTools',
                '--add', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
                '--add', 'Microsoft.VisualStudio.Component.Windows11SDK.22000'
              ], {
                stdio: 'inherit'
              });
              
              installer.on('close', (code) => {
                if (code === 0 || code === 3010) { // 3010 = success but reboot required
                  console.log('VS Build Tools installed successfully!');
                  resolve();
                } else {
                  reject(new Error(`VS Build Tools installer exited with code ${code}`));
                }
              });
              
              installer.on('error', (err) => {
                reject(err);
              });
            });
          });
        });
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            console.log('Running VS Build Tools installer...');
            resolve();
          });
        });
      }
    }).on('error', (err) => {
      fsSync.unlink(vsInstaller, () => {});
      reject(err);
    });
  });
}

// Install Rust using rustup
async function installRust() {
  return new Promise((resolve, reject) => {
    console.log('Rust not found. Installing rustup...');
    
    const rustupUrl = 'https://win.rustup.rs/x86_64';
    const rustupInstaller = path.join(app.getPath('temp'), 'rustup-init.exe');
    
    // Download rustup installer
    const file = fsSync.createWriteStream(rustupInstaller);
    https.get(rustupUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('Running rustup installer...');
          
          // Run installer with default options
          const installer = spawn(rustupInstaller, ['-y'], {
            stdio: 'inherit'
          });
          
          installer.on('close', (code) => {
            if (code === 0) {
              console.log('Rust installed successfully!');
              // Add cargo to PATH for this session
              process.env.PATH = `${process.env.USERPROFILE}\\.cargo\\bin;${process.env.PATH}`;
              resolve();
            } else {
              reject(new Error(`Rustup installer exited with code ${code}`));
            }
          });
          
          installer.on('error', (err) => {
            reject(err);
          });
        });
      });
    }).on('error', (err) => {
      fsSync.unlink(rustupInstaller, () => {});
      reject(err);
    });
  });
}

// Start the Rust game server
async function startGameServer() {
  if (serverStarting || gameServerProcess) {
    console.log('Game server already running or starting...');
    return;
  }
  
  serverStarting = true;
  
  try {
    // Check if Docker is available
    try {
      await execPromise('docker --version');
      const projectDir = path.join(__dirname, '..', '..');

      // Check if compose file exists and if a 'server' service is defined
      const composeFile = path.join(projectDir, 'docker-compose.dev.yml');
      if (!fsSync.existsSync(composeFile)) {
        console.log('Docker detected but compose file not found, skipping server start');
        serverStarting = false;
        return;
      }

      // Get services list from compose and verify 'server' service exists
      let services = [];
      try {
        const { stdout } = await execPromise('docker-compose -f docker-compose.dev.yml config --services', { cwd: projectDir });
        services = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      } catch (e) {
        console.log('Failed to read docker-compose services, skipping server auto-start');
        serverStarting = false;
        return;
      }

      if (!services.includes('server')) {
        console.log("No 'server' service in docker-compose, skipping server auto-start");
        serverStarting = false;
        return;
      }

      console.log('Docker detected, starting server service via docker-compose...');
      try {
        // Start in detached mode and wait for success
        await execPromise('docker-compose -f docker-compose.dev.yml up -d server', { cwd: projectDir });
        console.log('Docker server service started');
      } catch (e) {
        console.log('Failed to start docker-compose server service:', e.message);
      } finally {
        serverStarting = false;
      }
    } catch (dockerError) {
      console.log('Docker not available, skipping server start');
      console.log('To run the server, install Docker Desktop from: https://www.docker.com/products/docker-desktop/');
      serverStarting = false;
    }
    
  } catch (error) {
    console.error('Error starting game server:', error);
    serverStarting = false;
    throw error;
  }
}

// Stop the game server
async function stopGameServer() {
  if (gameServerProcess) {
    gameServerProcess.kill();
    gameServerProcess = null;
  }

  // Attempt to stop docker service if defined
  try {
    const projectDir = path.join(__dirname, '..', '..');
    const composeFile = path.join(projectDir, 'docker-compose.dev.yml');
    if (fsSync.existsSync(composeFile)) {
      const { stdout } = await execPromise('docker-compose -f docker-compose.dev.yml config --services', { cwd: projectDir });
      const services = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (services.includes('server')) {
        await execPromise('docker-compose -f docker-compose.dev.yml stop server', { cwd: projectDir });
        console.log('Docker server service stopped');
      }
    }
  } catch (err) {
    console.log('Docker stop skipped or failed:', err.message);
  }
}

// IPC handlers for server control
ipcMain.handle('start-server', async () => {
  try {
    await startGameServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-server', async () => {
  try {
    await stopGameServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-server-status', async () => {
  return {
    running: gameServerProcess !== null,
    starting: serverStarting
  };
});

// ============================================
// Discord OAuth Authentication (Direct)
// ============================================

const DISCORD_CLIENT_ID = '1432021829924552825';
const DISCORD_REDIRECT_URI = 'http://localhost:53134/auth/callback'; // Random port to avoid conflicts

let authWindow = null;

// Load user from persistent storage on startup
let currentAuthUser = store.get('auth.user', null);

// Simple callback server for OAuth
const createCallbackServer = () => {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/auth/callback')) {
        const url = new URL(req.url, `http://localhost:53134`);
        const code = url.searchParams.get('code');
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication successful!</h1><p>You can close this window.</p><script>window.close()</script></body></html>');
          
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication failed</h1><p>No code received</p></body></html>');
          
          server.close();
          reject(new Error('No authorization code'));
        }
      }
    });
    
    server.listen(53134, 'localhost', () => {
      console.log('[Auth] Callback server listening on port 53134');
    });
    
    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 120000);
  });
};

ipcMain.handle('auth-signin-discord', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      // Start callback server
      const codePromise = createCallbackServer();
      
      // Create Discord OAuth URL (no client secret exposed!)
      const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
      
      console.log('[Auth] Starting Discord OAuth (direct)');
      
      // Create auth window
      authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      authWindow.loadURL(authUrl);
      
      // Wait for callback server to receive code
      const code = await codePromise;
      console.log('[Auth] Authorization code received');
      
      // Close auth window
      if (authWindow) {
        authWindow.close();
        authWindow = null;
      }
      
      // Exchange code for token (using Discord's public API)
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
        new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET || '0vTx2UYF6VfV4aVYss6-c5qbmiBycxF5', // Move to env var
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: DISCORD_REDIRECT_URI
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const { access_token, refresh_token } = tokenResponse.data;
      console.log('[Auth] Access token received, fetching user data...');
      
      // Fetch user data from Discord
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      
      const discordUser = userResponse.data;
      console.log('[Auth] Discord user authenticated:', discordUser.username);
      
      // Store user with full Discord profile
      currentAuthUser = {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
        avatarUrl: discordUser.avatar 
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${(parseInt(discordUser.discriminator) || 0) % 5}.png`,
        provider: 'discord',
        accessToken: access_token,
        refreshToken: refresh_token
      };
      
      // Save to persistent storage
      store.set('auth.user', currentAuthUser);
      console.log('[Auth] User session saved to storage');
      
      resolve({ success: true, user: currentAuthUser });
      
    } catch (error) {
      console.error('[Auth] Discord OAuth error:', error.message);
      if (authWindow) {
        authWindow.close();
        authWindow = null;
      }
      reject(error);
    }
  });
});

ipcMain.handle('auth-signout', async () => {
  currentAuthUser = null;
  // Clear from persistent storage
  store.delete('auth.user');
  console.log('[Auth] User session cleared from storage');
  return { success: true };
});

ipcMain.handle('auth-get-current-user', async () => {
  return currentAuthUser;
});

ipcMain.handle('auth-get-session', async () => {
  return currentAuthUser ? { authenticated: true, user: currentAuthUser } : { authenticated: false };
});

// ============================================
// P2P Server Hosting Functions
// ============================================

// Load server settings
async function loadServerSettings() {
  try {
    if (fsSync.existsSync(SETTINGS_FILE)) {
      const data = await fs.readFile(SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load server settings:', err);
  }
  
  // Default settings
  return {
    serverName: `${require('os').hostname()}'s Server`,
    hostName: require('os').hostname(),
    ltmEnabled: false,
    eventEnabled: false,
    maxPlayers: 100,
    isPrivate: false,
    mode: 'Battle Royale'
  };
}

// Save server settings
async function saveServerSettings(settings) {
  try {
    console.log('[Main] Saving server settings to:', SETTINGS_FILE);
    console.log('[Main] Settings:', settings);
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('[Main] Settings saved successfully');
    return { success: true };
  } catch (err) {
    console.error('[Main] Failed to save server settings:', err);
    return { success: false, error: err.message };
  }
}

// Get local IP address
function getLocalIP() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // IPv4, not internal
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// Register server with matchmaking
async function registerServer(buildVersion) {
  try {
    const settings = await loadServerSettings();
    const ip = getLocalIP();
    const port = 7777; // Default Fortnite server port

    const response = await axios.post(`${API_URL}/servers/register`, {
      serverName: settings.serverName,
      hostName: settings.hostName,
      ip,
      port,
      buildVersion,
      mode: settings.mode,
      ltmEnabled: settings.ltmEnabled,
      eventEnabled: settings.eventEnabled,
      maxPlayers: settings.maxPlayers,
      isPrivate: settings.isPrivate
    });

    if (response.data.success) {
      hostedServerId = response.data.serverId;
      console.log(`Server registered: ${hostedServerId}`);
      
      // Start heartbeat every 60 seconds
      heartbeatInterval = setInterval(async () => {
        try {
          await axios.post(`${API_URL}/servers/heartbeat/${hostedServerId}`, {
            currentPlayers: 1 // TODO: Get actual player count
          });
        } catch (err) {
          console.error('Heartbeat failed:', err.message);
        }
      }, 60000);

      return { success: true, serverId: hostedServerId };
    }

    return { success: false, error: 'Registration failed' };
  } catch (err) {
    console.error('Failed to register server:', err.message);
    return { success: false, error: err.message };
  }
}

// Unregister server
async function unregisterServer() {
  if (!hostedServerId) return;

  try {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    await axios.post(`${API_URL}/servers/unregister/${hostedServerId}`);
    console.log(`Server unregistered: ${hostedServerId}`);
    hostedServerId = null;
  } catch (err) {
    console.error('Failed to unregister server:', err.message);
  }
}

// IPC Handlers

// Server settings
ipcMain.handle('get-server-settings', async () => {
  return await loadServerSettings();
});

ipcMain.handle('save-server-settings', async (event, settings) => {
  return await saveServerSettings(settings);
});

// Get server list for specific build version
ipcMain.handle('get-server-list', async (event, buildVersion) => {
  try {
    const response = await axios.get(`${API_URL}/servers/version/${buildVersion}`);
    if (response.data.success) {
      return {
        success: true,
        servers: response.data.servers,
        count: response.data.count
      };
    }
    return { success: false, servers: [] };
  } catch (err) {
    console.error('Failed to get server list:', err.message);
    return { success: false, error: err.message, servers: [] };
  }
});

// Join server (verify version and launch)
ipcMain.handle('join-server', async (event, { serverId, buildVersion, ip, port }) => {
  try {
    // Check if user has this build version
    const builds = await getBuilds();
    const build = builds.find(b => b.version === buildVersion);

    if (!build) {
      // Try to find download link in catalog
      const catalogPath = path.join(__dirname, '..', 'docs', 'build_catalog.json');
      let downloadUrl = null;

      if (fsSync.existsSync(catalogPath)) {
        const catalog = JSON.parse(fsSync.readFileSync(catalogPath, 'utf8'));
        const catalogEntry = catalog.builds.find(b => b.version === buildVersion);
        if (catalogEntry && catalogEntry.downloadUrl) {
          downloadUrl = catalogEntry.downloadUrl;
        }
      }

      return {
        success: false,
        needsDownload: true,
        buildVersion,
        downloadUrl
      };
    }

    // Launch game with server IP:PORT
    const exePath = path.join(BUILDS_DIR, build.id, build.exePath);
    const args = [
      `-ServerIP=${ip}`,
      `-ServerPort=${port}`,
      `-log`,
      `-windowed`,
      `-ResX=1280`,
      `-ResY=720`,
      `-NoEAC`,
      `-fromfl=none`,
      `-skippatchcheck`,
      `-nosplash`
    ];

    const gameProcess = spawn(exePath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    gameProcess.unref();

    // Capture output
    gameProcess.stdout.on('data', (data) => {
      console.log(`[Game Output] ${data.toString()}`);
    });

    gameProcess.stderr.on('data', (data) => {
      console.error(`[Game Error] ${data.toString()}`);
    });

    // Inject bypass after 2 seconds
    setTimeout(async () => {
      const injectorPath = path.join(__dirname, '..', 'release', 'bypass', 'injector.exe');
      if (fsSync.existsSync(injectorPath)) {
        try {
          await execPromise(`"${injectorPath}" ${gameProcess.pid}`);
          console.log('Bypass injected for joined server');
        } catch (err) {
          console.error('Bypass injection failed:', err.message);
        }
      }
    }, 2000);

    return {
      success: true,
      message: `Joining server at ${ip}:${port}`
    };
  } catch (err) {
    console.error('Failed to join server:', err.message);
    return { success: false, error: err.message };
  }
});

// Window controls
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});

// Ensure builds directory exists
async function ensureBuildsDir() {
  try {
    await fs.mkdir(BUILDS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create builds directory:', err);
  }
}

ensureBuildsDir();

// Authentication - Real API calls to Project Drift backend
ipcMain.handle('auth-login', async (event, { username, password }) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username,
      password
    }, {
      timeout: 5000
    });
    
    userData = response.data.user;
    authToken = response.data.token;
    
    // Save token for future requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    return { success: true, user: userData, token: authToken };
  } catch (error) {
    console.error('Login failed:', error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Could not connect to server. Make sure the backend is running.' 
    };
  }
});

ipcMain.handle('auth-register', async (event, { username, email, password }) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, {
      username,
      email,
      password
    }, {
      timeout: 5000
    });
    
    userData = response.data.user;
    authToken = response.data.token;
    
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    return { success: true, user: userData, token: authToken };
  } catch (error) {
    console.error('Registration failed:', error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Could not connect to server' 
    };
  }
});

// Get available builds from backend
ipcMain.handle('get-builds', async () => {
  try {
    const response = await axios.get(`${API_URL}/builds`, {
      timeout: 5000
    });
    
    // API returns { success: true, builds: [...] }
    const serverBuilds = response.data.builds || [];
    const localBuilds = await getLocalBuilds();

    // Map for quick lookup of server build IDs
    const serverIds = new Set(serverBuilds.map(b => String(b.id)));

    // Mark downloaded server builds and attach local path
    for (const build of serverBuilds) {
      const local = localBuilds.find(lb => String(lb.id) === String(build.id));
      build.downloaded = !!local;
      build.path = local ? local.path : null;
      // Normalize optional fields for UI
      build.size = build.size || build.file_size || '—';
      build.season = build.season || 'Public';
    }

    // Include local-only builds that aren't on the server list
    const merged = [...serverBuilds];
    for (const lb of localBuilds) {
      if (!serverIds.has(String(lb.id))) {
        merged.push({
          id: lb.id,
          name: lb.name || 'Imported Fortnite',
          version: lb.version || 'Unknown',
          season: lb.season || 'Local',
          size: lb.size || 'Local',
          public: false,
          downloaded: true,
          path: lb.path,
          imported: true
        });
      }
    }
    
    return { success: true, builds: merged };
  } catch (error) {
    console.error('Failed to fetch builds:', error.message);
    
    // Fallback to local builds only
    const localBuilds = await getLocalBuilds();
    return { 
      success: true, 
      builds: localBuilds,
      offline: true 
    };
  }
});

// Get locally installed builds
async function getLocalBuilds() {
  try {
    const entries = await fs.readdir(BUILDS_DIR, { withFileTypes: true });
    const builds = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('build-')) {
        const buildPath = path.join(BUILDS_DIR, entry.name);
        const metaPath = path.join(buildPath, 'meta.json');
        
        try {
          const metaData = await fs.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaData);
          builds.push({
            ...meta,
            downloaded: true,
            path: buildPath
          });
        } catch (err) {
          // Invalid build, skip it
        }
      }
    }
    
    return builds;
  } catch (error) {
    return [];
  }
}

// Download build from GitHub or direct URL
ipcMain.handle('download-build', async (event, build) => {
  try {
    const buildPath = path.join(BUILDS_DIR, `build-${build.id}`);
    await fs.mkdir(buildPath, { recursive: true });
    
    // Download URL can be GitHub release, direct link, etc.
    const downloadUrl = build.downloadUrl || build.url;
    
    if (!downloadUrl) {
      return {
        success: false,
        error: 'No download URL provided for this build'
      };
    }
    
    console.log(`Downloading build ${build.name} from ${downloadUrl}`);
    
    const lowerUrl = downloadUrl.toLowerCase();
    const isZip = lowerUrl.endsWith('.zip');
    const isRar = lowerUrl.endsWith('.rar');
    const is7z = lowerUrl.endsWith('.7z');

    if (isZip || isRar || is7z) {
      const archivePath = path.join(buildPath, `build${isZip ? '.zip' : isRar ? '.rar' : '.7z'}`);

      // Download the archive
      await downloadFile(downloadUrl, archivePath, (progress) => {
        event.sender.send('download-progress', { buildId: build.id, progress });
      });

      // Extract the archive
      event.sender.send('download-status', { buildId: build.id, status: 'Extracting...' });

      if (isZip) {
        await extract(archivePath, { dir: buildPath });
      } else {
        if (!sevenZipPath) {
          throw new Error('RAR/7z extraction requires 7zip. Please install dependency or provide a ZIP file.');
        }
        await new Promise((resolve, reject) => {
          const p = spawn(sevenZipPath, ['x', archivePath, `-o${buildPath}`, '-y'], { stdio: 'ignore' });
          p.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`7zip exited with code ${code}`)));
          p.on('error', reject);
        });
      }

      // Delete the archive file
      await fs.unlink(archivePath).catch(() => {});
    } else {
      // Direct download (assume executable)
      const exePath = path.join(buildPath, 'FortniteClient-Win64-Shipping.exe');
      await downloadFile(downloadUrl, exePath, (progress) => {
        event.sender.send('download-progress', { buildId: build.id, progress });
      });
    }
    
    // Save metadata
    const metaPath = path.join(buildPath, 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify(build, null, 2));
    
    return { success: true, path: buildPath };
  } catch (error) {
    console.error('Download failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to download build' 
    };
  }
});

// Helper function to download a file with progress
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(dest);
    const client = url.startsWith('https') ? https : require('http');
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize) {
          const progress = (downloadedSize / totalSize) * 100;
          onProgress(progress);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fsSync.unlink(dest, () => {});
      reject(err);
    });
    
    file.on('error', (err) => {
      fsSync.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Import existing build
ipcMain.handle('import-build', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Fortnite Build Folder'
    });
    
    if (result.canceled) {
      return { success: false, error: 'Import cancelled' };
    }
    
    const sourcePath = result.filePaths[0];

    // Try to locate the executable in common paths or recursively
    let exePathCandidates = [
      path.join(sourcePath, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe'),
      path.join(sourcePath, 'FortniteClient-Win64-Shipping.exe'),
      path.join(sourcePath, 'Fortnite.exe')
    ];

    let foundExe = null;
    for (const p of exePathCandidates) {
      try { await fs.access(p); foundExe = p; break; } catch {}
    }

    if (!foundExe) {
      // Fallback: recursive search up to a depth
      foundExe = await findExecutableRecursive(sourcePath, 3);
    }

    if (!foundExe) {
      return { success: false, error: 'Invalid build folder. Could not find Fortnite executable' };
    }

    // Generate a stable build ID; if collision, add suffix
    const baseName = path.basename(sourcePath);
    let buildId = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '') || 'fortnite-build';
    let suffix = 1;
    let finalId = buildId;
    let metaPath = path.join(BUILDS_DIR, `build-${finalId}`, 'meta.json');
    
    // Check if this exact path is already imported
    while (fsSync.existsSync(metaPath)) {
      try {
        const existingMeta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        if (existingMeta.path === sourcePath) {
          // Already imported, just return it
          return { success: true, build: existingMeta };
        }
      } catch {}
      suffix += 1;
      finalId = `${buildId}-${suffix}`;
      metaPath = path.join(BUILDS_DIR, `build-${finalId}`, 'meta.json');
    }

    // Create metadata directory (but don't copy the build files)
    const metaDir = path.join(BUILDS_DIR, `build-${finalId}`);
    event.sender.send('import-status', { status: 'Creating reference...' });
    await fs.mkdir(metaDir, { recursive: true });

    // Create metadata with reference to original location
    const meta = {
      id: finalId,
      name: baseName,
      version: 'Unknown',
      season: 'Local',
      size: 'Local',
      imported: true,
      path: sourcePath,  // Reference original location
      exePath: foundExe  // Use original exe path
    };

    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    
    return { success: true, build: meta };
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to import build'
    };
  }
});

// Delete build
ipcMain.handle('delete-build', async (event, { buildId }) => {
  try {
    console.log(`[Main] Deleting build: ${buildId}`);
    
    // Get build directory
    const buildPath = path.join(BUILDS_DIR, `build-${buildId}`);
    
    // Check if directory exists
    if (!fsSync.existsSync(buildPath)) {
      console.warn(`[Main] Build directory not found: ${buildPath}`);
      return {
        success: false,
        error: 'Build directory not found'
      };
    }
    
    // Read metadata to check if imported (only reference, don't delete source)
    const metaPath = path.join(buildPath, 'meta.json');
    let isImported = false;
    
    if (fsSync.existsSync(metaPath)) {
      try {
        const metaData = await fs.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaData);
        isImported = meta.imported === true;
      } catch (err) {
        console.warn('[Main] Could not read meta.json:', err.message);
      }
    }
    
    // Delete the build directory
    await fs.rm(buildPath, { recursive: true, force: true });
    console.log(`[Main] Build deleted: ${buildPath}`);
    
    return {
      success: true,
      message: isImported 
        ? 'Build reference removed (original files not deleted)'
        : 'Build deleted successfully'
    };
    
  } catch (error) {
    console.error('[Main] Failed to delete build:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete build'
    };
  }
});

// Helper to copy directory
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Recursively list files (files only)
async function listFilesRecursive(root) {
  const out = [];
  async function walk(dir, depth = 0) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p, depth + 1);
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  }
  await walk(root, 0);
  return out;
}

// Find Fortnite executable recursively up to maxDepth
async function findExecutableRecursive(startDir, maxDepth = 3, depth = 0) {
  if (depth > maxDepth) return null;
  try {
    const entries = await fs.readdir(startDir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(startDir, e.name);
      if (e.isFile() && /Fortnite(Client-)?Win64-Shipping\.exe|Fortnite\.exe/i.test(e.name)) {
        return p;
      }
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = await findExecutableRecursive(path.join(startDir, e.name), maxDepth, depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

// Launch game - connects to Project Drift game server
ipcMain.handle('launch-game', async (event, { buildId }) => {
  try {
    // Ensure game server is running (only if docker-compose defines a 'server' service)
    if (!gameServerProcess && !serverStarting) {
      try {
        const projectDir = path.join(__dirname, '..', '..');
        const composeFile = path.join(projectDir, 'docker-compose.dev.yml');
        if (fsSync.existsSync(composeFile)) {
          const { stdout } = await execPromise('docker-compose -f docker-compose.dev.yml config --services', { cwd: projectDir });
          const services = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (services.includes('server')) {
            console.log('Starting game server before launch...');
            await startGameServer();
          }
        }
      } catch (_) {
        // Ignore auto-start if detection fails
      }
    }
    
    // Wait for server to be ready
    let waitTime = 0;
    while (serverStarting && waitTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, 500));
      waitTime += 500;
    }
    
    // Get build info
    const buildPath = path.join(BUILDS_DIR, `build-${buildId}`);
    const metaPath = path.join(buildPath, 'meta.json');
    const metaData = await fs.readFile(metaPath, 'utf8');
    const build = JSON.parse(metaData);
    
    // Find the game executable
    let exePath = build.exePath;
    if (!exePath) {
      // Try common locations
      const possiblePaths = [
        path.join(buildPath, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe'),
        path.join(buildPath, 'FortniteClient-Win64-Shipping.exe'),
        path.join(buildPath, 'Fortnite.exe')
      ];
      
      for (const p of possiblePaths) {
        try {
          await fs.access(p);
          exePath = p;
          break;
        } catch {}
      }
    }
    
    if (!exePath) {
      return {
        success: false,
        error: 'Could not find game executable'
      };
    }
    
    // Get available game server from matchmaking API
    let serverIp = '127.0.0.1';
    let serverPort = '7777';
    
    try {
      const response = await axios.get(`${API_URL}/servers/available`, {
        timeout: 3000
      });
      
      if (response.data && response.data.length > 0) {
        const server = response.data[0];
        serverIp = server.ip || server.host;
        serverPort = server.port;
      }
    } catch (err) {
      console.warn('Could not fetch server, using localhost:', err.message);
    }
    
    console.log(`Launching ${build.name} -> ${serverIp}:${serverPort}`);
    
    // Launch arguments for Fortnite
    // Use -epicapp and -AUTH_LOGIN/PASSWORD to simulate Epic Launcher launch
    const args = [
      '-log',
      '-windowed',
      '-ResX=1280',
      '-ResY=720',
      '-NoEAC',
      '-fromfl=eac',  // Tell game it's FROM the launcher (eac = Epic Anti Cheat/Launcher)
      '-fltoken=h1cdhchd10150221h130eB56',  // Fake launcher token
      '-skippatchcheck',
      '-nosplash',
      '-AUTH_LOGIN=unused@unused',  // Fake Epic account email
      '-AUTH_PASSWORD=',  // Empty password (bypassed anyway)
      '-AUTH_TYPE=epic',  // Auth type
      '-epicapp=Fortnite',  // Epic app ID
      '-epicenv=Prod',  // Epic environment
      '-EpicPortal',  // Launched from Epic Games Launcher
      '-epicusername=ProjectDriftUser',  // Display name
      '-epicuserid=0000000000000000000000000000000000000000',  // Fake Epic user ID
      '-epiclocale=en'  // Locale
    ];
    
    // Spawn the game process
    const gameProcess = spawn(exePath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(exePath)
    });
    
    // Log game output for debugging
    if (gameProcess.stdout) {
      gameProcess.stdout.on('data', (data) => {
        console.log('[Fortnite]', data.toString().trim());
      });
    }
    if (gameProcess.stderr) {
      gameProcess.stderr.on('data', (data) => {
        console.log('[Fortnite Error]', data.toString().trim());
      });
    }
    
    gameProcess.on('error', (err) => {
      console.error('Failed to start game:', err);
      event.sender.send('launch-error', { error: err.message });
    });
    
    // Wait for process to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Inject bypass DLL
    const bypassDllPath = path.join(__dirname, '..', '..', 'release', 'bypass', 'bypass.dll');
    const injectorPath = path.join(__dirname, '..', '..', 'release', 'bypass', 'injector.exe');
    
    // Check if bypass exists
    if (fsSync.existsSync(bypassDllPath) && fsSync.existsSync(injectorPath)) {
      console.log('Injecting bypass DLL...');
      try {
        // Wait for FortniteClient-Win64-Shipping.exe to spawn
        let targetPid = null;
        let attempts = 0;
        
        console.log('Waiting for FortniteClient-Win64-Shipping.exe...');
        while (!targetPid && attempts < 30) {
          try {
            // Find FortniteClient-Win64-Shipping.exe process
            const { stdout } = await execPromise('powershell -Command "Get-Process -Name FortniteClient-Win64-Shipping -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"');
            const pids = stdout.trim().split(/\r?\n/).filter(p => p.trim());
            
            if (pids.length > 0) {
              // Get the most recent one (highest PID)
              targetPid = parseInt(pids[pids.length - 1].trim());
              console.log(`Found FortniteClient-Win64-Shipping.exe (PID: ${targetPid})`);
              break;
            }
          } catch {}
          
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!targetPid) {
          console.warn('Could not find FortniteClient-Win64-Shipping.exe process');
          console.warn('Injection failed - game may crash');
        } else {
          // Give the process a moment to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Run injector on the actual game process
          const { stdout, stderr } = await execPromise(`"${injectorPath}" ${targetPid} "${bypassDllPath}"`);
          console.log('[Injector]', stdout);
          if (stderr) console.log('[Injector Err]', stderr);
          
          console.log('Bypass injected successfully - Epic launcher checks bypassed');
        }
      } catch (injectErr) {
        console.warn('Failed to inject bypass (game may not work):', injectErr.message);
        console.warn('To build bypass: run build-bypass.bat');
      }
    } else {
      console.warn('Bypass DLL not found. Build it with: build-bypass.bat');
      console.warn('Game may fail to launch without Epic Games Launcher');
    }
    
    // Register as P2P server
    const registerResult = await registerServer(build.version);
    if (registerResult.success) {
      console.log('Registered as P2P server:', registerResult.serverId);
      
      // Unregister on game exit
      gameProcess.on('exit', async () => {
        console.log('Game closed, unregistering server...');
        await unregisterServer();
      });
    } else {
      console.warn('Failed to register P2P server:', registerResult.error);
    }
    
    gameProcess.unref();
    
    return { success: true, server: `${serverIp}:${serverPort}` };
  } catch (error) {
    console.error('Launch failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to launch game' 
    };
  }
});

// Get user stats
ipcMain.handle('get-user-stats', async () => {
  if (!userData) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await axios.get(`${API_URL}/users/${userData.id}/stats`);
    return { success: true, stats: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: 'Failed to fetch stats' 
    };
  }
});

// Get friends list
ipcMain.handle('get-friends', async () => {
  if (!userData) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await axios.get(`${API_URL}/users/${userData.id}/friends`);
    return { success: true, friends: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: 'Failed to fetch friends' 
    };
  }
});

// ============================================
// SETTINGS HANDLERS
// ============================================
ipcMain.handle('settings-get', async (event, key) => {
  try {
    return store.get(`settings.${key}`, null);
  } catch (error) {
    console.error('[Settings] Get failed:', error);
    return null;
  }
});

ipcMain.handle('settings-set', async (event, key, value) => {
  try {
    store.set(`settings.${key}`, value);
    return { success: true };
  } catch (error) {
    console.error('[Settings] Set failed:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// CATALOG HANDLERS
// ============================================
// Parse GitHub build archive README
async function parseGitHubCatalog() {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/llamaqwerty/fortnite-builds-archive/main/README.md', {
      timeout: 10000
    });
    
    const readme = response.data;
    const builds = [];
    
    // Parse the markdown table structure
    const lines = readme.split('\n');
    let currentSeason = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect season headers
      if (line.match(/^##\s+(Season\s+\d+|Pre-Season|Online Testing)/i)) {
        currentSeason = line.replace(/^##\s+/, '').trim();
        continue;
      }
      
      // Parse build rows (format: | Version | Link1 | Link2 | Link3 |)
      if (line.startsWith('|') && !line.includes('---') && currentSeason) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        
        if (parts.length >= 2) {
          const versionPart = parts[0];
          const links = parts.slice(1).filter(l => l.startsWith('http'));
          
          // Extract version and CL number
          const versionMatch = versionPart.match(/(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)/);
          const clMatch = versionPart.match(/CL-(\d+)/);
          
          if (versionMatch && links.length > 0 && !versionPart.toLowerCase().includes('lost') && !versionPart.toLowerCase().includes('unavailable')) {
            const version = versionMatch[1];
            const cl = clMatch ? clMatch[1] : null;
            
            builds.push({
              id: `fn-${version}-${cl || 'unknown'}`,
              name: `Fortnite ${version}`,
              version: version,
              cl: cl,
              season: currentSeason,
              downloadUrl: links[0], // Primary link
              altLinks: links.slice(1), // Alternative links
              size: 'Unknown', // Size not provided in README
              description: `${currentSeason} - CL-${cl || 'Unknown'}`
            });
          }
        }
      }
    }
    
    console.log(`[Catalog] Parsed ${builds.length} builds from GitHub`);
    return builds;
  } catch (error) {
    console.error('[Catalog] Failed to parse GitHub catalog:', error);
    return [];
  }
}

ipcMain.handle('catalog-get-all', async () => {
  try {
    // Fetch from GitHub build archive
    const builds = await parseGitHubCatalog();
    return builds;
  } catch (error) {
    console.log('[Catalog] Failed to fetch catalog:', error);
    return [];
  }
});

ipcMain.handle('catalog-download', async (event, buildData) => {
  try {
    const { downloadUrl, name, version } = buildData;
    const buildsDir = path.join(app.getPath('userData'), 'builds');
    
    // Create builds directory if it doesn't exist
    if (!fs.existsSync(buildsDir)) {
      fs.mkdirSync(buildsDir, { recursive: true });
    }
    
    // Determine file extension from URL
    const urlPath = new URL(downloadUrl).pathname;
    const ext = path.extname(urlPath) || '.zip';
    const fileName = `${name.replace(/[^a-z0-9]/gi, '_')}${ext}`;
    const filePath = path.join(buildsDir, fileName);
    
    console.log(`[Download] Starting download: ${name} from ${downloadUrl}`);
    
    // Start download with progress tracking
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5
    });
    
    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedSize = 0;
    let lastUpdate = Date.now();
    
    const writer = fs.createWriteStream(filePath);
    
    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      
      // Send progress update every 2.5 seconds
      const now = Date.now();
      if (now - lastUpdate >= 2500) {
        const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        event.sender.send('download-progress', {
          buildId: buildData.id,
          progress,
          downloaded: downloadedSize,
          total: totalSize
        });
        lastUpdate = now;
      }
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`[Download] Completed: ${fileName}`);
        event.sender.send('download-complete', {
          buildId: buildData.id,
          filePath,
          name
        });
        resolve({ success: true, filePath, name });
      });
      
      writer.on('error', (error) => {
        console.error(`[Download] Error:`, error);
        fs.unlinkSync(filePath).catch(() => {});
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('[Catalog] Download failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to start download' 
    };
  }
});

// ============================================
// SERVERS HANDLERS
// ============================================
ipcMain.handle('servers-get-all', async () => {
  try {
    const response = await axios.get(`${API_URL}/servers`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.log('[Servers] Using fallback (matchmaking offline)');
    return [];
  }
});

ipcMain.handle('servers-host', async (event, serverData) => {
  try {
    const response = await axios.post(`${API_URL}/servers/host`, serverData, {
      timeout: 10000
    });
    return { success: true, server: response.data };
  } catch (error) {
    console.error('[Servers] Host failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create server' 
    };
  }
});

ipcMain.handle('servers-join', async (event, serverId) => {
  try {
    const response = await axios.post(`${API_URL}/servers/${serverId}/join`, {
      userId: currentAuthUser?.id
    }, {
      timeout: 10000
    });
    return { success: true, connection: response.data };
  } catch (error) {
    console.error('[Servers] Join failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to join server' 
    };
  }
});
