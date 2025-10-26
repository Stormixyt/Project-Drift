const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
const { auth, db } = require('./supabase');

let sevenZipPath = null;
try {
  // 7zip binary for extracting .rar/.7z archives on Windows
  sevenZipPath = require('7zip-bin').path7za || null;
} catch (_) {
  // optional dependency
}

// Local HTTP server for OAuth callback handling
const http = require('http');
let callbackServer = null;

// Start local HTTP server for OAuth callbacks
function startCallbackServer() {
  if (callbackServer) return;

  callbackServer = http.createServer(async (req, res) => {
    console.log('Received callback request:', req.url);
    
    // Check if this is an OAuth error
    const url = new URL(req.url, `http://localhost:3001`);
    const error = url.searchParams.get('error');
    const errorCode = url.searchParams.get('error_code');
    const errorDescription = url.searchParams.get('error_description');
    
    // Also check for errors in hash fragment
    const hash = url.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const hashError = hashParams.get('error');
    const hashErrorCode = hashParams.get('error_code');
    const hashErrorDescription = hashParams.get('error_description');
    
    const finalError = error || hashError;
    const finalErrorCode = errorCode || hashErrorCode;
    const finalErrorDescription = errorDescription || hashErrorDescription;
    
    if (finalError) {
      console.log('OAuth error received:', { error: finalError, errorCode: finalErrorCode, errorDescription: finalErrorDescription });
      
      // Send error to renderer process
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('oauth-error', {
          error: finalError,
          errorCode: finalErrorCode,
          errorDescription: finalErrorDescription
        });
      }
      
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0b0c0f; color: #e6e6e6; }
            .error { color: #ff4444; font-size: 24px; margin: 20px 0; }
            .details { font-size: 14px; color: #aaa; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="error">✗ Authentication Failed</h1>
          <p class="details">Error: ${finalError}</p>
          <p class="details">${finalErrorDescription}</p>
          <p>Please try again or contact support if the problem persists.</p>
        </body>
        </html>
      `);
      return;
    }
    
    // Handle OAuth callback - Discord redirects to root path with hash fragment
    if (req.url === '/' || req.url.startsWith('/?')) {
      console.log('Serving OAuth callback page');

      // Serve an HTML page that will extract the OAuth tokens from the URL fragment
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Processing Authentication...</title>
          <style>
            body {
              font-family: 'Inter', Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #0b0c0f 0%, #1a1d23 100%);
              color: #e6e6e6;
              margin: 0;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .container {
              max-width: 500px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 16px;
              padding: 40px;
              box-shadow: 0 8px 32px rgba(0, 217, 255, 0.1);
              border: 1px solid rgba(0, 217, 255, 0.2);
            }
            .loading {
              color: #00d9ff;
              font-size: 48px;
              margin: 20px 0;
              animation: spin 1s linear infinite;
            }
            .message {
              font-size: 18px;
              margin: 20px 0;
              line-height: 1.6;
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="loading">⟳</div>
            <h1>Processing Authentication...</h1>
            <p class="message">Please wait while we complete your sign-in.</p>
          </div>

          <script>
            // Extract OAuth tokens from URL fragment
            const hash = window.location.hash.substring(1);
            if (hash) {
              const params = new URLSearchParams(hash);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              const providerToken = params.get('provider_token');
              const expiresAt = params.get('expires_at');

              if (accessToken) {
                console.log('Found OAuth tokens in fragment, sending to main process...');

                // Send tokens to main process via a special endpoint
                fetch('/oauth-callback', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    provider_token: providerToken,
                    expires_at: expiresAt
                  })
                })
                .then(response => response.json())
                .then(data => {
                  if (data.success) {
                    // Show success and auto-close
                    document.querySelector('.container').innerHTML = \`
                      <div class="loading" style="color: #00d9ff; animation: none;">✓</div>
                      <h1>Authentication Successful!</h1>
                      <p class="message">You have been successfully signed in with Discord.<br>Please close this browser window and return to Project Drift.</p>
                    \`;

                    // Auto-close after 3 seconds
                    setTimeout(() => {
                      window.close();
                    }, 3000);
                  } else {
                    throw new Error(data.error || 'Authentication failed');
                  }
                })
                .catch(error => {
                  console.error('OAuth callback error:', error);
                  document.querySelector('.container').innerHTML = \`
                    <div class="loading" style="color: #ff4444; animation: none;">✗</div>
                    <h1>Authentication Failed</h1>
                    <p class="message">An error occurred during sign-in. Please try again.</p>
                    <p style="font-size: 14px; color: #aaa;">\${error.message}</p>
                  \`;
                });
              } else {
                document.querySelector('.container').innerHTML = \`
                  <div class="loading" style="color: #ff4444; animation: none;">✗</div>
                  <h1>Authentication Failed</h1>
                  <p class="message">No access token found. Please try again.</p>
                \`;
              }
            } else {
              // Check for error parameters in query string
              const urlParams = new URLSearchParams(window.location.search);
              const error = urlParams.get('error');
              const errorDescription = urlParams.get('error_description');

              if (error) {
                document.querySelector('.container').innerHTML = \`
                  <div class="loading" style="color: #ff4444; animation: none;">✗</div>
                  <h1>Authentication Failed</h1>
                  <p class="message">\${errorDescription || error}</p>
                  <p class="message">Please try again.</p>
                \`;
              } else {
                document.querySelector('.container').innerHTML = \`
                  <div class="loading" style="color: #ff4444; animation: none;">?</div>
                  <h1>Invalid Request</h1>
                  <p class="message">This page should only be accessed through Discord OAuth.</p>
                \`;
              }
            }
          </script>
        </body>
        </html>
      `);
      return;
    }

    // Handle the POST request from the JavaScript above
    if (req.url === '/oauth-callback' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const tokens = JSON.parse(body);
          console.log('Received OAuth tokens via POST:', { hasAccessToken: !!tokens.access_token });

          if (tokens.access_token) {
            // Set the session in the main process
            const sessionResult = await auth.setSession(tokens.access_token, tokens.refresh_token);

            if (sessionResult.success) {
                  // Persist tokens so session can be restored after restart
                  try {
                    await saveAuthTokens({
                      access_token: tokens.access_token,
                      refresh_token: tokens.refresh_token,
                      expires_at: tokens.expires_at
                    });
                  } catch (err) {
                    console.warn('Failed to persist auth tokens:', err.message);
                  }
              console.log('Session set successfully in main process');

              // Verify the session was set by checking it immediately
              const { data: sessionData } = await auth.getCurrentSession();
              console.log('Verified session after setting:', { hasSession: !!sessionData.session, hasUser: !!sessionData.session?.user });

              // Notify the renderer that authentication succeeded
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('oauth-success');
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } else {
              console.error('Failed to set session:', sessionResult.error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: sessionResult.error }));
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'No access token provided' }));
          }
        } catch (error) {
          console.error('Error processing OAuth callback POST:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
      return;
    }

    // Handle 404 for other requests
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Not Found</title>
      </head>
      <body>
        <h1>404 - Not Found</h1>
      </body>
      </html>
    `);
  });

  // Try to listen on port 3001 first (required by Discord OAuth config)
  callbackServer.listen(3001, 'localhost', () => {
    console.log('OAuth callback server listening on http://localhost:3001');
  });

  callbackServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Port 3001 is busy, attempting to free it...');

      // Try to kill any process using port 3001
      const { exec } = require('child_process');
      exec('netstat -ano | findstr :3001', (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.includes('LISTENING')) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && pid !== '0') {
                console.log(`Attempting to kill process ${pid} using port 3001`);
                exec(`taskkill /f /pid ${pid}`, (killError) => {
                  if (!killError) {
                    console.log('Killed conflicting process, retrying server start...');
                    setTimeout(() => {
                      callbackServer.listen(3001, 'localhost', () => {
                        console.log('OAuth callback server listening on http://localhost:3001');
                      });
                    }, 1000);
                  } else {
                    console.error('Failed to kill conflicting process:', killError);
                    console.log('Please close any applications using port 3001 and restart Project Drift');
                  }
                });
                break;
              }
            }
          }
        } else {
          console.log('Could not identify process using port 3001');
          console.log('Please close any development servers or applications using port 3001');
        }
      });
    } else {
      console.error('Callback server error:', err);
    }
  });
}

// Persist auth tokens to disk so session survives restarts
const AUTH_STORE_PATH = path.join(app.getPath ? app.getPath('userData') : __dirname, 'auth.json');

async function saveAuthTokens(tokens) {
  try {
    const toSave = {
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expires_at || null
    };
    await fs.writeFile(AUTH_STORE_PATH, JSON.stringify(toSave, null, 2), { encoding: 'utf8' });
    console.log('Saved auth tokens to', AUTH_STORE_PATH);
  } catch (err) {
    console.warn('Failed to save auth tokens:', err.message);
  }
}

async function loadAuthTokens() {
  try {
    if (fsSync.existsSync(AUTH_STORE_PATH)) {
      const raw = await fs.readFile(AUTH_STORE_PATH, { encoding: 'utf8' });
      const parsed = JSON.parse(raw);
      console.log('Loaded saved auth tokens');
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to load auth tokens:', err.message);
  }
  return null;
}

// Stop the callback server
function stopCallbackServer() {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
  }
}

// Handle OAuth callback URLs
function handleOAuthCallback(url) {
  console.log('Handling OAuth callback:', url);
  
  // Send the callback URL to the renderer process
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('oauth-callback', url);
  }
}

// App event handlers
app.whenReady().then(() => {
  // Start the local callback server
  startCallbackServer();

  // Create the main window
  createMainWindow();
});

// After app ready, attempt to rehydrate saved session (if any)
app.whenReady().then(async () => {
  try {
    const tokens = await loadAuthTokens();
    if (tokens && tokens.access_token) {
      console.log('Rehydrating saved auth session');
      const setResult = await auth.setSession(tokens.access_token, tokens.refresh_token);
      if (setResult && setResult.success) {
        console.log('Session rehydrated successfully from disk');
      } else {
        console.warn('Failed to rehydrate session:', setResult && setResult.error);
      }
    }
  } catch (err) {
    console.warn('Error during session rehydration:', err.message);
  }
});

app.on('window-all-closed', () => {
  // Stop the callback server when app closes
  stopCallbackServer();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Function to create the main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0c0f',
      symbolColor: '#e6e6e6'
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Handle OAuth callback in renderer
  mainWindow.webContents.on('did-finish-load', () => {
    // Check if app was launched with OAuth callback
    const url = process.argv.find(arg => arg.startsWith('projectdrift://'));
    if (url) {
      handleOAuthCallback(url);
    }
  });
}

// Download file with progress callback
async function downloadFile(url, destPath, progressCallback) {
  console.log(`[Download] Starting download: ${url} -> ${destPath}`);
  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(destPath);
    let totalSize = 0;
    let downloadedSize = 0;
    let lastProgressUpdate = 0;

    const request = https.get(url, (response) => {
      console.log(`[Download] Response status: ${response.statusCode}`);
      console.log(`[Download] Content-Type: ${response.headers['content-type']}`);
      console.log(`[Download] Content-Length: ${response.headers['content-length']}`);

      // Check if this is actually a download page instead of a file
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        console.log(`[Download] Detected HTML/text response, likely a download page instead of file`);
        file.end();
        reject(new Error('URL returned HTML page instead of file download'));
        return;
      }

      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        console.log(`[Download] Redirecting to: ${response.headers.location}`);
        file.end();
        // Follow redirect
        downloadFile(response.headers.location, destPath, progressCallback).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.end();
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      totalSize = parseInt(response.headers['content-length'], 10) || 0;
      console.log(`[Download] Total size: ${totalSize} bytes`);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);

        // Throttle progress updates to every 200ms to prevent erratic speed/ETA
        const now = Date.now();
        if (progressCallback && totalSize > 0 && (now - lastProgressUpdate) >= 200) {
          const progress = (downloadedSize / totalSize) * 100;
          progressCallback(progress, totalSize);
          lastProgressUpdate = now;
        }
      });

      response.on('end', () => {
        file.end();
        console.log(`[Download] Download completed, downloaded ${downloadedSize} bytes`);
        // Validate download was successful
        try {
          const stats = fsSync.statSync(destPath);
          console.log(`[Download] File size on disk: ${stats.size} bytes`);
          if (stats.size === 0) {
            reject(new Error('Downloaded file is empty'));
            return;
          }
          // Check for minimum reasonable file size (Fortnite builds are at least 100MB)
          if (stats.size < 100 * 1024 * 1024) { // 100MB minimum
            console.log(`[Download] File too small (${stats.size} bytes), likely not a real build`);
            reject(new Error(`Downloaded file too small (${Math.round(stats.size / 1024 / 1024)}MB), likely not a valid build`));
            return;
          }
          // Send final progress update
          if (progressCallback && totalSize > 0) {
            progressCallback(100, totalSize);
          }
          resolve();
        } catch (err) {
          console.error(`[Download] Failed to validate file: ${err.message}`);
          reject(new Error('Failed to validate downloaded file'));
        }
      });

      response.on('error', (err) => {
        console.error(`[Download] Response error: ${err.message}`);
        file.end();
        reject(err);
      });
    });

    request.on('error', (err) => {
      console.error(`[Download] Request error: ${err.message}`);
      file.end();
      reject(err);
    });

    file.on('error', (err) => {
      console.error(`[Download] File write error: ${err.message}`);
      reject(err);
    });
  });
}

// Check available disk space
async function checkDiskSpace(requiredBytes, directory) {
  try {
    // Use a simple check - just ensure the directory exists and is writable
    await fs.access(directory, fs.constants.W_OK);
    console.log(`[Storage] Directory is writable: ${directory}`);
    // For now, assume enough space - the download will fail if there's not enough space anyway
    return { available: true };
  } catch (error) {
    console.warn('[Storage] Could not access directory:', error.message);
    return { 
      available: false, 
      message: `Cannot write to download directory: ${directory}`
    };
  }
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
    icon: path.join(__dirname, '../assets/icon.png'), // TODO: Add icon file
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
    // Use custom download path if provided, otherwise use default
    const downloadDir = build.downloadPath || BUILDS_DIR;
    await fs.mkdir(downloadDir, { recursive: true });
    
    const buildPath = path.join(downloadDir, `build-${build.id}`);
    await fs.mkdir(buildPath, { recursive: true });
    
    // Try multiple download URLs (mirrors) in order
    const urls = build.downloadUrls || [build.downloadUrl || build.url];
    
    // Add some common fallback mirrors based on the build version
    const fallbackUrls = [];
    if (build.version || build.name) {
      const version = build.version || build.name;
      // Try some common mirror patterns
      if (version.includes('1.11')) {
        fallbackUrls.push('https://archive.org/download/fortnite-1.11/Fortnite_1.11.zip');
      } else if (version.includes('5.00')) {
        fallbackUrls.push('https://archive.org/download/fortnite-5.00/Fortnite_5.00.rar');
      } else if (version.includes('7.00')) {
        fallbackUrls.push('https://archive.org/download/fortnite-7.00/Fortnite_7.00.zip');
      }
    }
    
    const allUrls = [...urls, ...fallbackUrls];
    
    if (!urls || urls.length === 0 || !urls[0]) {
      return {
        success: false,
        error: 'No download URL provided for this build'
      };
    }
    
    // Check available disk space before downloading
    // Estimate required space: Fortnite builds are typically 10-20GB, plus extraction space
    const estimatedSize = 25 * 1024 * 1024 * 1024; // 25GB estimate
    const spaceCheck = await checkDiskSpace(estimatedSize, downloadDir);
    if (!spaceCheck.available) {
      return {
        success: false,
        error: spaceCheck.message || 'Not enough disk space for download'
      };
    }
    
    // Try each URL until one succeeds
    for (let i = 0; i < allUrls.length; i++) {
      const downloadUrl = allUrls[i];
      
      try {
        console.log(`Trying URL ${i + 1}/${urls.length}: ${downloadUrl}`);
        
        if (i > 0) {
          event.sender.send('download-status', { 
            buildId: build.id, 
            status: `Trying mirror ${i + 1}/${allUrls.length}...` 
          });
        }
    
        const lowerUrl = downloadUrl.toLowerCase();
        const isZip = lowerUrl.endsWith('.zip');
        const isRar = lowerUrl.endsWith('.rar');
        const is7z = lowerUrl.endsWith('.7z');

        if (isZip || isRar || is7z) {
          const archivePath = path.join(buildPath, `build${isZip ? '.zip' : isRar ? '.rar' : '.7z'}`);

          // Download the archive
          console.log(`[Download] Starting download of archive: ${downloadUrl}`);
          await downloadFile(downloadUrl, archivePath, (progress, totalSize) => {
            event.sender.send('download-progress', { buildId: build.id, progress, totalSize });
          });
          console.log(`[Download] Archive download completed`);

          // Extract the archive
          event.sender.send('download-status', { buildId: build.id, status: 'Extracting files...' });

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
          console.log(`[Download] Removing archive file: ${archivePath}`);
          await fs.unlink(archivePath).catch((err) => {
            console.warn(`[Download] Failed to remove archive: ${err.message}`);
          });
        } else {
          // Direct download (assume executable)
          const exePath = path.join(buildPath, 'FortniteClient-Win64-Shipping.exe');
          console.log(`[Download] Starting direct download: ${downloadUrl}`);
          await downloadFile(downloadUrl, exePath, (progress, totalSize) => {
            event.sender.send('download-progress', { buildId: build.id, progress, totalSize });
          });
          console.log(`[Download] Direct download completed`);
        }
        
        // Save metadata
        const metaPath = path.join(buildPath, 'meta.json');
        await fs.writeFile(metaPath, JSON.stringify(build, null, 2));
        
        console.log(`Successfully downloaded build ${build.name} using URL ${i + 1}`);
        return { success: true, path: buildPath };
        
      } catch (error) {
        console.warn(`URL ${i + 1} failed: ${error.message}`);
        lastError = error;
        
        // Clean up failed download
        try {
          await fs.rm(buildPath, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn('Failed to clean up failed download:', cleanupError.message);
        }
        
        // If this isn't the last URL, continue to next mirror
        if (i < allUrls.length - 1) {
          // Small delay before trying next mirror
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    // All URLs failed
    console.error('All download URLs failed for build:', build.name);
    return { 
      success: false, 
      error: `All download URLs failed. Last error: ${lastError?.message || 'Unknown error'}` 
    };
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
          onProgress(progress, totalSize);
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
// ========================================
// PROJECT REBOOT LAUNCH METHOD
// Integrated LawinServer + DLL Injection
// ========================================
let mcpBackendProcess = null;

async function startMcpBackend() {
  return new Promise((resolve, reject) => {
    const mcpPath = path.join(__dirname, '..', '..', 'mcp-backend');
    const lawinExe = path.join(mcpPath, 'lawinserver.exe');
    
    console.log('[MCP] Starting LawinServer executable');
    
    // Check if lawinserver.exe exists
    if (!fsSync.existsSync(lawinExe)) {
      reject(new Error('lawinserver.exe not found! Copy from Reboot Launcher.'));
      return;
    }
    
    mcpBackendProcess = spawn(lawinExe, [], {
      cwd: mcpPath,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let startupOutput = '';
    mcpBackendProcess.stdout.on('data', (data) => {
      const text = data.toString();
      startupOutput += text;
      console.log('[MCP]', text.trim());
      
      // LawinServer.exe likely outputs different startup message
      if (text.includes('listening') || text.includes('started')) {
        resolve(true);
      }
    });
    
    mcpBackendProcess.stderr.on('data', (data) => {
      console.error('[MCP Error]', data.toString().trim());
    });
    
    mcpBackendProcess.on('error', (err) => {
      console.error('[MCP] Failed to start:', err);
      reject(err);
    });
    
    mcpBackendProcess.on('exit', (code) => {
      console.log(`[MCP] Backend exited with code ${code}`);
      mcpBackendProcess = null;
    });
    
    // Timeout after 5 seconds - exe starts faster than Node.js
    setTimeout(() => {
      resolve(true); // Assume success if no errors
    }, 5000);
  });
}

ipcMain.handle('launch-game', async (event, { buildId }) => {
  try {
    console.log('========================================');
    console.log('PROJECT DRIFT LAUNCHER');
    console.log('========================================');
    
    // STEP 1: Start MCP Backend (LawinServer)
    console.log('[1/6] Starting MCP Backend...');
    if (!mcpBackendProcess) {
      try {
        await startMcpBackend();
        console.log('✓ MCP Backend started');
    
    // Ensure hosts file has Epic redirects
    try {
      const hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
      const hostsContent = fsSync.readFileSync(hostsPath, 'utf8');
      
      const requiredRedirects = [
        '127.0.0.1 account-public-service-prod03.ol.epicgames.com',
        '127.0.0.1 fortnite-public-service-prod11.ol.epicgames.com',
        '127.0.0.1 lightswitch-public-service-prod06.ol.epicgames.com'
      ];
      
      let needsUpdate = false;
      for (const redirect of requiredRedirects) {
        if (!hostsContent.includes(redirect.split(' ')[1])) {
          needsUpdate = true;
          break;
        }
      }
      
      if (needsUpdate) {
        console.log('⚠ Hosts file needs Epic redirects. Please run setup-mcp.ps1 as administrator.');
      }
    } catch (err) {
      console.warn('Could not check hosts file:', err.message);
    }
      } catch (err) {
        console.error('✗ MCP Backend failed:', err.message);
        return { success: false, error: 'Failed to start MCP Backend: ' + err.message };
      }
    } else {
      console.log('✓ MCP Backend already running');
    }
    
    // STEP 2: Get build info
    console.log('[2/6] Loading build...');
    const buildPath = path.join(BUILDS_DIR, `build-${buildId}`);
    const metaPath = path.join(buildPath, 'meta.json');
    const metaData = await fs.readFile(metaPath, 'utf8');
    const build = JSON.parse(metaData);
    
    // Find game executable
    let exePath = build.exePath;
    if (!exePath) {
      const possiblePaths = [
        path.join(buildPath, 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe'),
        path.join(buildPath, 'FortniteClient-Win64-Shipping.exe')
      ];
      
      for (const p of possiblePaths) {
        if (fsSync.existsSync(p)) {
          exePath = p;
          break;
        }
      }
    }
    
    if (!exePath || !fsSync.existsSync(exePath)) {
      return { success: false, error: 'Could not find game executable' };
    }
    
    const gameDir = path.dirname(exePath);
    const launcherPath = path.join(gameDir, 'FortniteLauncher.exe');
    
    // Check launcher size to detect ERA builds
    if (fsSync.existsSync(launcherPath)) {
      const stats = await fs.stat(launcherPath);
      if (stats.size < 200000) {
        return { 
          success: false, 
          error: 'ERA build detected! Project Drift does not support ERA builds. Please use a stock Fortnite build.' 
        };
      }
    }
    
    console.log(`✓ Build loaded: ${build.name}`);
    
    // STEP 3: Disable anti-cheat
    console.log('[3/6] Disabling anti-cheat...');
    
    // COMPLETELY REMOVE BattlEye folder (not just DLL)
    const battleEyeFolder = path.join(gameDir, 'BattlEye');
    if (fsSync.existsSync(battleEyeFolder)) {
      try {
        // Backup BattlEye folder if not already backed up
        const backupFolder = battleEyeFolder + '.bak';
        if (!fsSync.existsSync(backupFolder)) {
          await fs.rename(battleEyeFolder, backupFolder);
          console.log('✓ BattlEye folder backed up and removed');
        } else {
          // Backup exists, just delete current BattlEye folder
          await fs.rm(battleEyeFolder, { recursive: true, force: true });
          console.log('✓ BattlEye folder deleted');
        }
      } catch (err) {
        console.error('✗ Failed to remove BattlEye:', err.message);
      }
    }
    
    // Also remove EasyAntiCheat if present
    const eacFolder = path.join(gameDir, 'EasyAntiCheat');
    if (fsSync.existsSync(eacFolder)) {
      try {
        const backupFolder = eacFolder + '.bak';
        if (!fsSync.existsSync(backupFolder)) {
          await fs.rename(eacFolder, backupFolder);
        } else {
          await fs.rm(eacFolder, { recursive: true, force: true });
        }
        console.log('✓ EasyAntiCheat removed');
      } catch (err) {
        console.error('✗ Failed to remove EasyAntiCheat:', err.message);
      }
    }
    
    // Remove NVIDIA Aftermath
    try {
      const aftermathFiles = fsSync.readdirSync(gameDir, { recursive: true })
        .filter(f => f.includes('GFSDK_Aftermath_Lib'));
      for (const file of aftermathFiles) {
        await fs.unlink(path.join(gameDir, file)).catch(() => {});
      }
      if (aftermathFiles.length > 0) {
        console.log('✓ NVIDIA Aftermath removed');
      }
    } catch {}
    console.log('✓ Anti-cheat disabled');
    
    // STEP 4: Start and suspend launcher (CRITICAL for game to work)
    console.log('[4/6] Starting and suspending launcher...');
    
    let launcherPid = null;
    if (fsSync.existsSync(launcherPath)) {
      try {
        // Create a PowerShell script file to suspend the launcher
        const suspendScript = path.join(require('os').tmpdir(), 'suspend-launcher.ps1');
        const psContent = `
$launcherProc = Start-Process "${launcherPath.replace(/\\/g, '\\\\')}" -PassThru -WindowStyle Hidden

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NativeMethods {
    [DllImport("ntdll.dll", SetLastError=true)]
    public static extern uint NtSuspendProcess(IntPtr processHandle);
    
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, int processId);
    
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool CloseHandle(IntPtr hObject);
}
"@

# IMMEDIATELY suspend - no delay for BattlEye to start!
$handle = [NativeMethods]::OpenProcess(0x1F0FFF, $false, $launcherProc.Id)
if ($handle -ne [IntPtr]::Zero) {
    [NativeMethods]::NtSuspendProcess($handle) | Out-Null
    [NativeMethods]::CloseHandle($handle) | Out-Null
    Write-Output $launcherProc.Id
} else {
    Write-Error "Failed to open process"
    exit 1
}
`;
        
        await fs.writeFile(suspendScript, psContent);
        
        const { stdout } = await execPromise(`powershell -ExecutionPolicy Bypass -File "${suspendScript}"`);
        launcherPid = stdout.trim();
        
        await fs.unlink(suspendScript).catch(() => {});
        
        console.log(`✓ Launcher suspended (PID: ${launcherPid})`);
      } catch (err) {
        console.error('✗ Failed to suspend launcher:', err.message);
        console.error('  Game will likely crash without suspended launcher!');
        return { success: false, error: 'Failed to suspend launcher: ' + err.message };
      }
    } else {
      console.error('✗ FortniteLauncher.exe not found!');
      return { success: false, error: 'FortniteLauncher.exe not found' };
    }
    
    // Wait a bit for launcher to fully suspend
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[4/6] Starting Fortnite...');
    
    // Launch game - LET REBOOT.DLL HANDLE SERVER SETUP!
    const gameArgs = [
      '-epicapp=Fortnite',
      '-epicenv=Prod',
      '-epicportal',
      '-skippatchcheck',
      '-nobe',
      '-noeac',
      '-windowed',
      '-ResX=1920',
      '-ResY=1080',
      '-AUTH_LOGIN=drift@projectdrift.dev',
      '-AUTH_PASSWORD=ProjectDrift',
      '-AUTH_TYPE=epic',
      '-log'               // Enable logging
    ];
    
    const gameProcess = spawn(exePath, gameArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: gameDir
    });
    
    gameProcess.stdout.on('data', (data) => console.log('[Fortnite]', data.toString().trim()));
    gameProcess.stderr.on('data', (data) => console.log('[Fortnite Err]', data.toString().trim()));
    
    gameProcess.on('error', (err) => {
      console.error('[Fortnite] Failed to start:', err);
    });
    
    gameProcess.on('exit', (code, signal) => {
      console.log(`[Fortnite] Process exited with code ${code}, signal ${signal}`);
      if (code !== 0 && code !== null) {
        console.error('[Fortnite] Game crashed! Check logs above for errors.');
      }
    });
    
    console.log(`✓ Game started (PID: ${gameProcess.pid})`);
    
    // STEP 5: Wait and inject DLLs (Project Reboot sequence)
    console.log('[5/6] Injecting DLLs (Reboot sequence)...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds (reduced!)
    
    // Essential patches - INJECT reboot.dll EARLIER!
    const dllsToInject = [
      { name: 'cobalt.dll', desc: 'auth redirect', critical: true, delayAfter: 800 },
      { name: 'memory.dll', desc: 'memory leak fix', critical: false, delayAfter: 500 },
      { name: 'reboot.dll', desc: 'game server handler', critical: true, delayAfter: 1000 }, // INJECT EARLY!
      { name: 'console.dll', desc: 'UE4 console', critical: false, delayAfter: 2000 } // Console last
    ];
    
    const injectorPath = path.join(__dirname, '..', '..', 'release', 'bypass', 'injector.exe');
    let injectedCount = 0;
    let gameStillRunning = true;
    
    for (const dll of dllsToInject) {
      // Check if game is still running before injecting next DLL
      try {
        process.kill(gameProcess.pid, 0); // Check if process exists
      } catch {
        console.error(`  ✗ Game crashed before injecting ${dll.name}`);
        gameStillRunning = false;
        break;
      }
      
      const dllPath = path.join(__dirname, '..', '..', 'release', 'bypass', dll.name);
      if (fsSync.existsSync(dllPath) && fsSync.existsSync(injectorPath)) {
        try {
          // Run injector as administrator for reboot.dll
          const injectCmd = dll.name === 'reboot.dll' 
            ? `powershell -Command "Start-Process '${injectorPath}' -ArgumentList '${gameProcess.pid} \\"${dllPath}\\"' -Verb RunAs -Wait"`
            : `"${injectorPath}" ${gameProcess.pid} "${dllPath}"`;
          
          await execPromise(injectCmd);
          console.log(`  ✓ ${dll.name} injected (${dll.desc})`);
          injectedCount++;
          
          // Wait after each injection with specific timing
          if (dll.delayAfter) {
            await new Promise(resolve => setTimeout(resolve, dll.delayAfter));
          }
        } catch (err) {
          console.error(`  ✗ ${dll.name} failed:`, err.message);
          if (dll.critical) {
            console.error(`     ${dll.name} is critical - game may not work properly`);
          }
        }
      } else {
        console.warn(`  ⚠ ${dll.name} not found, skipping`);
      }
    }
    
    if (!gameStillRunning) {
      console.error('Game crashed during DLL injection!');
      console.error('This might be a DLL compatibility issue with Season 4.');
      return { success: false, error: 'Game crashed during DLL injection' };
    }
    
    console.log(`✓ Injected ${injectedCount}/${dllsToInject.length} DLLs`);
    
    // STEP 6: Complete
    console.log('[6/6] Launch complete!');
    console.log('========================================');
    console.log(`✓ MCP Backend: Running on port 3551`);
    console.log(`✓ Fortnite: PID ${gameProcess.pid}`);
    console.log(`✓ DLLs: ${injectedCount}/${dllsToInject.length} injected`);
    console.log('========================================\n');
    
    // Cleanup on exit
    gameProcess.on('exit', () => {
      console.log('Game exited');
    });
    
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
    
    return { success: true, message: 'Game launched successfully!' };
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

// Download path selection
ipcMain.handle('select-download-path', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Download Directory',
      defaultPath: path.join(app.getPath('downloads'), 'Project Drift Builds')
    });
    return result;
  } catch (error) {
    console.error('Failed to select download path:', error);
    return { canceled: true };
  }
});

// Get default download path
ipcMain.handle('get-default-download-path', () => {
  return path.join(app.getPath('downloads'), 'Project Drift Builds');
});

// Authentication IPC handlers
ipcMain.handle('auth-signin-discord', async () => {
  console.log('Processing Discord signin');
  try {
    const result = await auth.signInWithDiscord();
    if (result.success && result.url) {
      // Open the OAuth URL in the user's default browser
      const { shell } = require('electron');
      await shell.openExternal(result.url);
      return { success: true, message: 'OAuth URL opened in browser' };
    } else {
      throw new Error(result.error || 'Failed to get OAuth URL');
    }
  } catch (error) {
    console.error('Discord signin error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-signout', async () => {
  console.log('Processing signout');
  const result = await auth.signOut();
  if (result && result.success) {
    try {
      if (fsSync.existsSync(AUTH_STORE_PATH)) fsSync.unlinkSync(AUTH_STORE_PATH);
      console.log('Removed persisted auth tokens');
    } catch (err) {
      console.warn('Failed to remove persisted auth tokens:', err.message);
    }
  }
  return result;
});

ipcMain.handle('auth-get-current-user', async () => {
  const { data: { user } } = await auth.getCurrentUser();
  return user;
});

ipcMain.handle('auth-get-session', async () => {
  const { data: { session } } = await auth.getCurrentSession();
  return session;
});

ipcMain.handle('auth-check-discord-server', async (event, userId) => {
  return await auth.checkDiscordServerMembership(userId);
});

// Handle OAuth callback
ipcMain.handle('auth-handle-callback', async (event, url) => {
  try {
    // Extract the authorization code from the URL
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');

    if (error) {
      return { success: false, error: `OAuth error: ${error}` };
    }

    if (!code) {
      return { success: false, error: 'No authorization code received' };
    }

    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) throw exchangeError;

    return { success: true, session: data.session, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Cancel download
ipcMain.handle('cancel-download', async (event, buildId) => {
  // For now, just return success - in a real implementation you'd need to track
  // active downloads and cancel them properly
  console.log(`Cancelling download for build: ${buildId}`);
  return { success: true };
});

// Database IPC handlers
ipcMain.handle('db-get-user-profile', async (event, userId) => {
  return await db.getUserProfile(userId);
});

ipcMain.handle('db-upsert-user-profile', async (event, { userId, profileData }) => {
  return await db.upsertUserProfile(userId, profileData);
});

ipcMain.handle('db-get-download-history', async (event, userId) => {
  return await db.getDownloadHistory(userId);
});

ipcMain.handle('db-add-download-history', async (event, { userId, buildId, buildName, buildVersion }) => {
  return await db.addDownloadHistory(userId, buildId, buildName, buildVersion);
});