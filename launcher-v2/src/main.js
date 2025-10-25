const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const https = require('https');
const { pipeline } = require('stream/promises');
const extract = require('extract-zip');
let sevenZipPath = null;
try {
  // 7zip binary for extracting .rar/.7z archives on Windows
  sevenZipPath = require('7zip-bin').path7za || null;
} catch (_) {
  // optional dependency
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

  mainWindow.loadFile('src/renderer/index-v2.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

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
    let buildPath = path.join(BUILDS_DIR, `build-${buildId}`);
    let suffix = 1;
    while (fsSync.existsSync(buildPath)) {
      suffix += 1;
      buildPath = path.join(BUILDS_DIR, `build-${buildId}-${suffix}`);
    }
    const finalId = suffix > 1 ? `${buildId}-${suffix}` : buildId;

    // Copy with basic progress
    event.sender.send('import-status', { status: 'Scanning files...' });
    const fileList = await listFilesRecursive(sourcePath);
    let copied = 0;
    event.sender.send('import-status', { status: 'Copying files (0%)' });
    await fs.mkdir(buildPath, { recursive: true });
    for (const file of fileList) {
      const rel = path.relative(sourcePath, file);
      const dest = path.join(buildPath, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(file, dest);
      copied++;
      if (copied % 25 === 0) {
        const pct = Math.floor((copied / fileList.length) * 100);
        event.sender.send('import-status', { status: `Copying files (${pct}%)` });
      }
    }

    // Create metadata
    const meta = {
      id: finalId,
      name: baseName,
      version: 'Unknown',
      season: 'Local',
      size: 'Local',
      imported: true,
      path: buildPath,
      exePath: foundExe.replace(sourcePath, buildPath)
    };

    await fs.writeFile(path.join(buildPath, 'meta.json'), JSON.stringify(meta, null, 2));
    
    return { success: true, build: meta };
  } catch (error) {
    console.error('Import failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to import build'
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
    const args = [
      `-server=${serverIp}:${serverPort}`,
      '-AUTH_LOGIN=unused',
      '-AUTH_PASSWORD=unused',
      '-AUTH_TYPE=epic',
      '-epicapp=Fortnite',
      '-epicenv=Prod',
      '-EpicPortal',
      '-nobe',
      '-fromfl=eac',
      '-fltoken=none',
      '-skippatchcheck',
      '-noeac'
    ];
    
    // Spawn the game process
    const gameProcess = spawn(exePath, args, {
      detached: true,
      stdio: 'ignore',
      cwd: path.dirname(exePath)
    });
    
    gameProcess.unref();
    
    gameProcess.on('error', (err) => {
      console.error('Failed to start game:', err);
      event.sender.send('launch-error', { error: err.message });
    });
    
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
