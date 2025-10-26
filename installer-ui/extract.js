const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const https = require('https');
const { app } = require('electron');

// Download URL for the launcher - points to local file for now
const LAUNCHER_DOWNLOAD_URL = 'https://github.com/Stormixyt/Project-Drift/releases/latest/download/ProjectDriftLauncher.exe';
const LAUNCHER_ZIP_URL = 'file:///C:/Users/Stormix/Downloads/Project%20Drift/launcher/dist/Project-Drift-Launcher-v1.0.0.zip';

// Bundled launcher zip (included in the installer executable)
const BUNDLED_ZIP_PATH = path.join(__dirname, 'launcher.zip');

const installDir = path.join(os.homedir(), 'Project Drift');
const desktopShortcut = path.join(os.homedir(), 'Desktop', 'Project Drift.lnk');
const startMenuShortcut = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Project Drift.lnk');

function downloadFile(url, destPath, progressCallback) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    let totalSize = 0;
    let downloadedSize = 0;

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      totalSize = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (progressCallback && totalSize) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          progressCallback(progress);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete the file on error
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

function extractZip(zipPath, extractTo, progressCallback) {
  return new Promise((resolve, reject) => {
    // Use PowerShell to extract zip (more reliable than node modules)
    const script = `
      try {
        $ProgressPreference = 'SilentlyContinue'
        Expand-Archive -Path "${zipPath}" -DestinationPath "${extractTo}" -Force
        Write-Host "Extraction complete"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    const child = child_process.spawn('powershell.exe', ['-Command', script], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let extractionProgress = 0;
    const progressInterval = setInterval(() => {
      extractionProgress += 10;
      if (progressCallback && extractionProgress <= 90) {
        progressCallback(extractionProgress);
      }
    }, 500);

    child.on('close', (code) => {
      clearInterval(progressInterval);
      if (code === 0) {
        if (progressCallback) progressCallback(100);
        resolve();
      } else {
        reject(new Error('Failed to extract zip file'));
      }
    });

    child.on('error', reject);
  });
}

function isInstallationComplete() {
  const exePath = path.join(installDir, 'Project Drift.exe');
  const appPath = path.join(installDir, 'resources', 'app');
  return fs.existsSync(exePath) && fs.existsSync(appPath);
}

function downloadLauncher(progressCallback) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if already installed and working
      if (isInstallationComplete()) {
        console.log('Installation already exists, skipping download');
        if (progressCallback) progressCallback(100);
        resolve();
        return;
      }

      // Clean the install directory first
      if (fs.existsSync(installDir)) {
        try {
          fs.rmSync(installDir, { recursive: true, force: true });
          console.log('Cleaned install directory');
        } catch (error) {
          console.warn('Could not clean install directory, proceeding anyway:', error.message);
        }
      }

      fs.mkdirSync(installDir, { recursive: true });

      // Create temp directory for download
      const tempDir = path.join(os.tmpdir(), 'project-drift-installer');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const zipPath = 'C:\\Users\\Stormix\\Downloads\\Project Drift\\launcher\\dist\\Project-Drift-Launcher-v1.0.0.zip';

      console.log('Using local launcher zip...');

      // Copy the local zip to temp location for extraction
      const tempZipPath = path.join(tempDir, 'launcher.zip');
      fs.copyFileSync(zipPath, tempZipPath);

      console.log('Copy complete, extracting...');

      // Extract the zip
      await extractZip(tempZipPath, installDir, (progress) => {
        if (progressCallback) {
          // Extraction is remaining 30% of progress
          progressCallback(70 + Math.round(progress * 0.3));
        }
      });

      // Clean up temp file
      try {
        fs.unlinkSync(tempZipPath);
        fs.rmdirSync(extractTempDir);
      } catch (error) {
        console.warn('Could not clean up temp file:', error.message);
      }

      // Verify the exe was extracted
      const exePath = path.join(installDir, 'Project Drift.exe');
      if (!fs.existsSync(exePath)) {
        // Try alternative path
        const altExePath = path.join(installDir, 'ProjectDriftLauncher.exe');
        if (fs.existsSync(altExePath)) {
          // Rename to expected name
          fs.renameSync(altExePath, exePath);
        } else {
          throw new Error('Main executable was not found after extraction');
        }
      }

      console.log('Launcher downloaded and extracted successfully');
      if (progressCallback) progressCallback(100);
      resolve();

    } catch (error) {
      console.error('Error downloading/extracting launcher:', error);
      reject(error);
    }
  });
}

function createShortcut(target, shortcutPath) {
  const script = `
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('${shortcutPath}')
    $Shortcut.TargetPath = '${target}'
    $Shortcut.IconLocation = '${target},0'
    $Shortcut.Save()
  `;
  child_process.spawnSync('powershell.exe', ['-Command', script]);
}

function runLauncher(withTerminal = false) {
  const exePath = path.join(installDir, 'Project Drift.exe');

  if (fs.existsSync(exePath)) {
    if (withTerminal) {
      // Run with terminal for debugging/output visibility
      const child = child_process.spawn('cmd.exe', ['/c', `start "" "${exePath}"`], {
        shell: true,
        detached: true,
        cwd: installDir,
        stdio: 'inherit'
      });
    } else {
      // Run normally without terminal
      const child = child_process.spawn(`"${exePath}"`, [], {
        shell: true,
        detached: true,
        cwd: installDir,
        stdio: 'ignore'
      });
    }
  }
}

module.exports = { downloadLauncher, createShortcut, runLauncher, installDir, desktopShortcut, startMenuShortcut };
