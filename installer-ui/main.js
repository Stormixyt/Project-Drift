const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const extract = require('./extract');

function createWindow() {
  try {
    const iconPath = path.join(__dirname, '..', 'Project Drift Website', 'installer', 'AppIcon.ico');
    
    const win = new BrowserWindow({
      width: 600,
      height: 500,
      resizable: false,
      icon: iconPath,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    win.loadFile('index.html').catch(err => {
      console.error('Failed to load index.html:', err);
    });
    
    // For debugging
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load page:', errorCode, errorDescription);
    });
    
  } catch (error) {
    console.error('Error creating window:', error);
  }
}

app.whenReady().then(createWindow);

ipcMain.on('install', async (event, runAfter, withTerminal) => {
  try {
    event.reply('install-progress', 10, 'Checking installation...');
    await new Promise(resolve => setTimeout(resolve, 500));

    event.reply('install-progress', 30, 'Preparing installation...');
    await new Promise(resolve => setTimeout(resolve, 500));

    event.reply('install-progress', 50, 'Downloading launcher...');
    await extract.downloadLauncher((progress) => {
      // Map download progress to overall progress (50-80%)
      const overallProgress = 50 + Math.round(progress * 0.3);
      event.reply('install-progress', overallProgress, `Downloading launcher... ${progress}%`);
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    event.reply('install-progress', 70, 'Creating shortcuts...');
    extract.createShortcut(path.join(extract.installDir, 'Project Drift.exe'), extract.desktopShortcut);
    extract.createShortcut(path.join(extract.installDir, 'Project Drift.exe'), extract.startMenuShortcut);
    await new Promise(resolve => setTimeout(resolve, 500));

    event.reply('install-progress', 90, 'Finalizing installation...');
    await new Promise(resolve => setTimeout(resolve, 500));

    event.reply('install-progress', 100, 'Installation complete!');
    await new Promise(resolve => setTimeout(resolve, 500));

    if (runAfter) {
      extract.runLauncher(withTerminal);
    }

    event.reply('install-complete');
  } catch (error) {
    console.error('Installation failed:', error);
    event.reply('install-error', `Installation failed: ${error.message}`);
  }
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('launch-app', () => {
  extract.runLauncher(false);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
