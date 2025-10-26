const { ipcRenderer } = require('electron');

// State
let currentUser = null;
let currentBuilds = [];
let isOffline = false;
let downloadPath = null; // Will be set when app is ready
let authModal = null;
let isAuthenticating = false;

// Helper function to format time
function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Authentication functions
async function checkAuthState() {
  try {
    const session = await ipcRenderer.invoke('auth-get-session');
    if (session) {
      currentUser = session.user;
      updateAuthUI();
      console.log('User authenticated:', currentUser.email);
    } else {
      currentUser = null;
      updateAuthUI();
    }
  } catch (error) {
    console.error('Failed to check auth state:', error);
  }
}

function updateAuthUI() {
  const userInfo = document.getElementById('user-info');
  const loginBtn = document.getElementById('login-btn');

  if (currentUser) {
    userInfo.innerHTML = `
      <div class="user-avatar">${currentUser.email.charAt(0).toUpperCase()}</div>
      <div class="user-details">
        <div class="user-name">${currentUser.user_metadata?.username || 'User'}</div>
        <div class="user-email">${currentUser.email}</div>
      </div>
      <button id="logout-btn" class="logout-btn">Logout</button>
    `;
    userInfo.style.display = 'flex';
    loginBtn.style.display = 'none';

    // Add logout handler
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
  } else {
    userInfo.style.display = 'none';
    loginBtn.style.display = 'block';
  }
}

function createAuthModal() {
  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-content">
      <div class="auth-modal-header">
        <h2 id="auth-title">Sign In</h2>
        <button id="auth-close" class="auth-close-btn">&times;</button>
      </div>
      <div class="auth-modal-body">
        <div class="auth-tabs">
          <button id="signin-tab" class="auth-tab active">Sign In</button>
          <button id="signup-tab" class="auth-tab">Sign Up</button>
        </div>
        <form id="auth-form">
          <div id="username-field" class="form-group" style="display: none;">
            <label for="username">Username</label>
            <input type="text" id="username" placeholder="Choose a username">
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" placeholder="Enter your email" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Enter your password" required>
          </div>
          <div id="auth-error" class="auth-error" style="display: none;"></div>
          <button type="submit" id="auth-submit" class="auth-submit-btn">Sign In</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function showAuthModal(mode = 'signin') {
  if (!authModal) {
    authModal = createAuthModal();
    setupAuthModalHandlers();
  }

  const title = document.getElementById('auth-title');
  const signinTab = document.getElementById('signin-tab');
  const signupTab = document.getElementById('signup-tab');
  const usernameField = document.getElementById('username-field');
  const submitBtn = document.getElementById('auth-submit');

  if (mode === 'signup') {
    title.textContent = 'Sign Up';
    signupTab.classList.add('active');
    signinTab.classList.remove('active');
    usernameField.style.display = 'block';
    submitBtn.textContent = 'Sign Up';
  } else {
    title.textContent = 'Sign In';
    signinTab.classList.add('active');
    signupTab.classList.remove('active');
    usernameField.style.display = 'none';
    submitBtn.textContent = 'Sign In';
  }

  authModal.style.display = 'flex';
}

function hideAuthModal() {
  if (authModal) {
    authModal.style.display = 'none';
  }
}

function setupAuthModalHandlers() {
  const closeBtn = document.getElementById('auth-close');
  const signinTab = document.getElementById('signin-tab');
  const signupTab = document.getElementById('signup-tab');
  const form = document.getElementById('auth-form');

  closeBtn.addEventListener('click', hideAuthModal);

  signinTab.addEventListener('click', () => showAuthModal('signin'));
  signupTab.addEventListener('click', () => showAuthModal('signup'));

  form.addEventListener('submit', handleAuthSubmit);

  // Close modal when clicking outside
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      hideAuthModal();
    }
  });
}

async function handleAuthSubmit(e) {
  e.preventDefault();

  if (isAuthenticating) return;

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const username = document.getElementById('username').value;
  const isSignup = document.getElementById('signup-tab').classList.contains('active');

  const submitBtn = document.getElementById('auth-submit');
  const errorDiv = document.getElementById('auth-error');

  submitBtn.textContent = 'Processing...';
  submitBtn.disabled = true;
  errorDiv.style.display = 'none';
  isAuthenticating = true;

  try {
    let result;
    if (isSignup) {
      result = await ipcRenderer.invoke('auth-signup', { email, password, username });
    } else {
      result = await ipcRenderer.invoke('auth-signin', { email, password });
    }

    if (result.success) {
      currentUser = result.user;
      updateAuthUI();
      hideAuthModal();
      showNotification('Successfully signed in!', 'success');
    } else {
      errorDiv.textContent = result.error;
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'An unexpected error occurred';
    errorDiv.style.display = 'block';
  } finally {
    submitBtn.textContent = isSignup ? 'Sign Up' : 'Sign In';
    submitBtn.disabled = false;
    isAuthenticating = false;
  }
}

async function handleLogout() {
  try {
    const result = await ipcRenderer.invoke('auth-signout');
    if (result.success) {
      currentUser = null;
      updateAuthUI();
      showNotification('Successfully signed out', 'info');
    } else {
      showNotification('Failed to sign out', 'error');
    }
  } catch (error) {
    showNotification('Failed to sign out', 'error');
  }
}

function showNotification(message, type = 'info') {
  // Create a simple notification
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Window controls
document.getElementById('minimize-btn').addEventListener('click', () => {
  ipcRenderer.send('window-minimize');
});

document.getElementById('maximize-btn').addEventListener('click', () => {
  ipcRenderer.send('window-maximize');
});

document.getElementById('close-btn').addEventListener('click', () => {
  ipcRenderer.send('window-close');
});

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    navItems.forEach(nav => nav.classList.remove('active'));
    views.forEach(view => view.classList.remove('active'));
    
    item.classList.add('active');
    
    const viewId = item.dataset.view + '-view';
    const view = document.getElementById(viewId);
    if (view) {
      view.classList.add('active');
      // Lazy-load content per view
      if (viewId === 'catalog-view') {
        loadCatalog().catch(console.error);
      } else if (viewId === 'downloads-view') {
        loadDownloadCatalog().catch(console.error);
      }
    }
  });
});

// Download settings
document.getElementById('download-settings-btn').addEventListener('click', () => {
  document.getElementById('download-settings-modal').classList.add('show');
  document.getElementById('download-path').value = downloadPath;
});

document.getElementById('close-download-settings').addEventListener('click', () => {
  document.getElementById('download-settings-modal').classList.remove('show');
});

document.getElementById('cancel-download-settings').addEventListener('click', () => {
  document.getElementById('download-settings-modal').classList.remove('show');
});

document.getElementById('browse-download-path').addEventListener('click', async () => {
  try {
    const result = await ipcRenderer.invoke('select-download-path');
    if (result && !result.canceled) {
      downloadPath = result.filePaths[0];
      document.getElementById('download-path').value = downloadPath;
    }
  } catch (error) {
    console.error('Failed to select download path:', error);
  }
});

document.getElementById('save-download-settings').addEventListener('click', () => {
  downloadPath = document.getElementById('download-path').value;
  // Save to settings (could be implemented later)
  document.getElementById('download-settings-modal').classList.remove('show');
});

// Initialize - connect to REAL backend
async function initializeUI() {
  // Set default download path
  downloadPath = await ipcRenderer.invoke('get-default-download-path');
  
  // For now, use guest mode (no auth required)
  // For now, use guest mode (no auth required)
  currentUser = {
    username: 'Guest',
    stats: {
      kdRatio: 0,
      wins: 0,
      matchesPlayed: 0,
      timePlayed: '0:00:00'
    }
  };
  
  document.getElementById('username').textContent = currentUser.username;
  document.getElementById('welcome-username').textContent = currentUser.username;
  
  document.getElementById('kd-ratio').textContent = currentUser.stats.kdRatio;
  document.getElementById('total-wins').textContent = currentUser.stats.wins;
  document.getElementById('matches-played').textContent = currentUser.stats.matchesPlayed;
  document.getElementById('time-played').textContent = currentUser.stats.timePlayed;
  
  // Load REAL builds from backend
  await loadBuilds();

  // Preload catalog seasons
  await loadDownloadCatalog();
  
  // Mock friends for now
  loadFriends();
}

// Load builds from REAL backend
async function loadBuilds() {
  const buildsGrid = document.getElementById('builds-grid');
  buildsGrid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Loading builds...</div>';
  
  try {
    // Call backend to get builds
    const result = await ipcRenderer.invoke('get-builds');
    
    if (result.success) {
      currentBuilds = result.builds;
      isOffline = result.offline || false;
      
      buildsGrid.innerHTML = '';
      
      if (currentBuilds.length === 0) {
        buildsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #999;">
            <h3>No builds available</h3>
            <p style="margin-top: 12px;">Import a build or wait for builds to be added to the server</p>
          </div>
        `;
      } else {
        // Add each build
        currentBuilds.forEach(build => {
          const buildCard = createBuildCard(build);
          buildsGrid.appendChild(buildCard);
        });
      }
      
      // Add import card
      const importCard = createImportCard();
      buildsGrid.appendChild(importCard);
      
    } else {
      buildsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #EF4444;">
          <h3>Failed to load builds</h3>
          <p style="margin-top: 12px;">${result.error || 'Unknown error'}</p>
          <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #1a1a1a; border: none; border-radius: 8px; color: #fff; cursor: pointer;">Retry</button>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Failed to load builds:', error);
    buildsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #EF4444;">
        <h3>Connection Error</h3>
        <p style="margin-top: 12px;">Make sure the backend is running: docker-compose -f docker-compose.dev.yml up -d</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #1a1a1a; border: none; border-radius: 8px; color: #fff; cursor: pointer;">Retry</button>
      </div>
    `;
  }
}

// Create import card
function createImportCard() {
  const importCard = document.createElement('div');
  importCard.className = 'import-card';
  importCard.innerHTML = `
    <div class="import-card-content">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
      </svg>
      <div>Import</div>
      <div style="font-size: 12px;">Add existing installation</div>
    </div>
  `;
  
  importCard.addEventListener('click', async () => {
    // Live status updates during import
    const updateStatus = (text) => {
      importCard.innerHTML = `<div style="text-align: center; color: #999;">${text}</div>`;
    };
    updateStatus('Preparing import...');

    const onStatus = (_, data) => {
      if (data?.status) updateStatus(data.status);
    };
    ipcRenderer.on('import-status', onStatus);

    try {
      const result = await ipcRenderer.invoke('import-build');
      
      if (result.success) {
        updateStatus('Import complete!');
        await loadBuilds(); // Refresh builds list
      } else {
        alert('Import failed: ' + result.error);
        await loadBuilds(); // Restore the grid
      }
    } catch (error) {
      alert('Import failed: ' + error.message);
      await loadBuilds();
    } finally {
      ipcRenderer.removeListener('import-status', onStatus);
    }
  });
  
  return importCard;
}

// Create build card element
function createBuildCard(build) {
  const card = document.createElement('div');
  card.className = 'build-card';
  
  const seasonBadge = build.season ? build.season.replace('Season ', 'S') : 'LOCAL';
  const versionText = build.version || 'Unknown';
  const sizeText = build.size || '—';

  card.innerHTML = `
    <div class="build-card-image">
      <span>${seasonBadge}</span>
    </div>
    <div class="build-card-content">
      <div class="build-card-title">${build.name}</div>
      <div class="build-card-version">${versionText}</div>
      <div class="build-card-meta">
        ${build.imported ? '<span class="build-card-status">Imported</span>' : (build.public ? '<span class="build-card-status">✓ Public</span>' : '')}
        <span>${sizeText}</span>
      </div>
    </div>
    <button class="build-card-delete" data-build-id="${build.id}" title="Remove build">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
      </svg>
    </button>
  `;
  
  // Launch on card click
  const cardContent = card.querySelector('.build-card-content, .build-card-image');
  card.addEventListener('click', async (e) => {
    // Don't launch if clicking delete button
    if (e.target.closest('.build-card-delete')) {
      return;
    }
    
    if (build.downloaded) {
      await launchBuild(build);
    } else {
      await downloadBuild(build);
    }
  });
  
  // Delete button handler
  const deleteBtn = card.querySelector('.build-card-delete');
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent card click
    
    const confirmed = confirm(
      `Remove "${build.name}" from library?\n\n` +
      `Version: ${versionText}\n` +
      `This will delete all files for this build.`
    );
    
    if (confirmed) {
      await deleteBuild(build);
    }
  });
  
  return card;
}

// Load friends list (mock for now)
function loadFriends() {
  const friendsList = document.getElementById('friends-list');
  
  friendsList.innerHTML = '';
  
  const mockFriends = [
    { name: 'Player1', status: 'online', avatar: 'player1' },
    { name: 'Player2', status: 'online', avatar: 'player2' },
    { name: 'Player3', status: 'offline', avatar: 'player3' },
  ];
  
  mockFriends.forEach(friend => {
    const friendItem = document.createElement('div');
    friendItem.className = 'friend-item';
    
    friendItem.innerHTML = `
      <div class="friend-avatar">
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.avatar}" alt="${friend.name}">
        <span class="status-indicator ${friend.status}"></span>
      </div>
      <div class="friend-info">
        <div class="friend-name">${friend.name}</div>
        <div class="friend-status">${friend.status === 'online' ? 'Online' : 'Offline'}</div>
      </div>
    `;
    
    friendsList.appendChild(friendItem);
  });
}

// Delete build
async function deleteBuild(build) {
  try {
    console.log('Deleting build:', build);
    
    // Show deleting message
    const card = document.querySelector(`[data-build-id="${build.id}"]`)?.closest('.build-card');
    if (card) {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }
    
    const result = await ipcRenderer.invoke('delete-build', { buildId: build.id });
    
    if (result.success) {
      console.log('Build deleted successfully');
      
      // Remove from UI with animation
      if (card) {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        
        setTimeout(() => {
          card.remove();
          
          // If no builds left, reload to show empty state
          const remainingBuilds = document.querySelectorAll('.build-card').length;
          if (remainingBuilds === 0) {
            loadBuilds();
          }
        }, 300);
      }
      
      // Reload builds list to update
      setTimeout(() => loadBuilds(), 500);
      
    } else {
      console.error('Failed to delete build:', result.error);
      alert(`Failed to delete build: ${result.error || 'Unknown error'}`);
      
      // Restore card
      if (card) {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
    }
  } catch (error) {
    console.error('Error deleting build:', error);
    alert(`Error deleting build: ${error.message}`);
  }
}

// Launch build - REAL implementation
async function launchBuild(build) {
  console.log('Launching build:', build);
  
  if (!build.downloaded) {
    alert('Build not downloaded yet. Please download it first.');
    return;
  }
  
  const launchBtn = document.getElementById('launch-btn');
  if (launchBtn) {
    const originalText = launchBtn.textContent;
    launchBtn.textContent = 'Launching...';
    launchBtn.disabled = true;
  }
  
  try {
    const result = await ipcRenderer.invoke('launch-game', { buildId: build.id });
    
    if (result.success) {
      alert(`Game launching!\n\nConnecting to: ${result.server}\n\nThe game window should open shortly.`);
    } else {
      alert('Failed to launch game: ' + result.error);
    }
  } catch (error) {
    alert('Failed to launch game: ' + error.message);
  } finally {
    if (launchBtn) {
      launchBtn.textContent = 'Launch';
      launchBtn.disabled = false;
    }
  }
}

// Download build - REAL implementation
async function downloadBuild(build) {
  console.log('Downloading build:', build);
  
  // Handle multiple download URLs (try them in order)
  const urls = build.downloadUrls || [build.downloadUrl || build.url];
  if (!urls || urls.length === 0 || !urls[0]) {
    alert('No download URL available for this build.\n\nPlease import it manually or contact the server admin.');
    return;
  }
  
  // Create a modified build object with the primary URL
  const downloadBuild = { ...build, downloadUrl: urls[0], downloadUrls: urls };
  
  // Switch to downloads view
  document.querySelector('[data-view="downloads"]').click();
  
  const downloadsList = document.getElementById('downloads-list');
  const downloadsEmpty = document.getElementById('downloads-empty');
  
  downloadsEmpty.style.display = 'none';
  downloadsList.style.display = 'flex';
  
  const downloadItem = document.createElement('div');
  downloadItem.className = 'download-item';
  
  downloadItem.innerHTML = `
    <div class="download-info">
      <div class="download-name">${build.name || build.version || build.cl || 'Unknown Build'}</div>
      <div class="download-details">
        <span class="download-size">Connecting...</span>
        <span class="download-speed">—</span>
        <span class="download-eta">—</span>
      </div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: 0%"></div>
      </div>
      <div class="download-stats">
        <span class="download-percentage">0%</span>
        <span class="download-transferred">0 MB / — MB</span>
      </div>
    </div>
    <button class="download-cancel-btn" title="Cancel Download">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
      </svg>
    </button>
  `;
  
  downloadsList.appendChild(downloadItem);
  
  const cancelBtn = downloadItem.querySelector('.download-cancel-btn');
  let isCancelled = false;
  
  // Cancel button functionality
  cancelBtn.addEventListener('click', async () => {
    clearTimeout(timeoutId); // Clear timeout on manual cancel
    isCancelled = true;
    sizeText.textContent = 'Cancelling...';
    speedText.textContent = '—';
    etaText.textContent = '—';
    
    try {
      // Send cancel signal to main process
      await ipcRenderer.invoke('cancel-download', build.id);
      
      // Clean up the download item
      downloadItem.remove();
      if (downloadsList.children.length === 0) {
        downloadsEmpty.style.display = 'block';
        downloadsList.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to cancel download:', error);
      sizeText.textContent = 'Failed to cancel';
    }
  });
  
  const progressBar = downloadItem.querySelector('.download-progress-fill');
  const sizeText = downloadItem.querySelector('.download-size');
  const speedText = downloadItem.querySelector('.download-speed');
  const etaText = downloadItem.querySelector('.download-eta');
  const percentageText = downloadItem.querySelector('.download-percentage');
  const transferredText = downloadItem.querySelector('.download-transferred');
  
  let startTime = Date.now();
  let lastProgress = 0;
  let lastUpdateTime = Date.now();
  let totalSize = 0;
  let speedHistory = []; // Keep last 5 speed measurements for smoothing
  const maxSpeedHistory = 5;
  let lastDisplayUpdate = 0; // Track last time speed/ETA were displayed
  
  // Add timeout for stuck downloads
  const timeoutId = setTimeout(() => {
    if (sizeText.textContent === 'Connecting...') {
      console.log('Download timeout - offering manual download option');
      
      // Create manual download button
      const manualDownloadBtn = document.createElement('button');
      manualDownloadBtn.className = 'manual-download-btn';
      manualDownloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 8px;">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586 14.293 4.293a1 1 0 111.414 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 01-.001-1.414z"/>
        </svg>
        Download Manually
      `;
      manualDownloadBtn.style.cssText = `
        margin-top: 8px;
        padding: 8px 16px;
        background: #00D9FF;
        border: none;
        border-radius: 6px;
        color: #000;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      manualDownloadBtn.addEventListener('click', () => {
        // Open the download URL in browser
        const url = urls[0];
        if (url) {
          require('electron').shell.openExternal(url);
          sizeText.textContent = 'Opened in browser - please download manually';
        } else {
          sizeText.textContent = 'No download URL available';
        }
      });
      
      // Replace the download details with timeout message and manual button
      const downloadDetails = downloadItem.querySelector('.download-details');
      downloadDetails.innerHTML = '<span style="color: #EF4444;">Download stuck - try manual download</span>';
      downloadDetails.appendChild(manualDownloadBtn);
      
      // Cancel the automatic download
      isCancelled = true;
      ipcRenderer.invoke('cancel-download', build.id).catch(console.error);
    }
  }, 15000); // 15 second timeout
  
  // Listen for progress events
  ipcRenderer.on('download-progress', (event, data) => {
    if (data.buildId === build.id) {
      const now = Date.now();
      const timeDiff = (now - lastUpdateTime) / 1000; // seconds
      
      if (data.totalSize) {
        totalSize = data.totalSize;
      }
      
      const progress = data.progress;
      const progressDiff = progress - lastProgress;
      
      // Calculate speed (MB/s) with smoothing
      const speedMBps = timeDiff > 0 ? (progressDiff / 100 * totalSize / 1024 / 1024 / timeDiff) : 0;
      
      // Add to speed history for smoothing
      if (speedMBps > 0) {
        speedHistory.push(speedMBps);
        if (speedHistory.length > maxSpeedHistory) {
          speedHistory.shift(); // Remove oldest
        }
      }
      
      // Use average of recent speeds for smoother display
      const avgSpeed = speedHistory.length > 0 ? speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length : 0;
      const speedTextValue = avgSpeed > 0 ? `${avgSpeed.toFixed(1)} MB/s` : '—';
      
      // Calculate ETA using smoothed speed
      const remainingProgress = 100 - progress;
      const etaSeconds = avgSpeed > 0 ? (remainingProgress / 100 * totalSize / 1024 / 1024 / avgSpeed) : 0;
      const etaTextValue = etaSeconds > 0 ? formatTime(etaSeconds) : '—';
      
      // Update progress bar and percentage immediately
      progressBar.style.width = progress + '%';
      percentageText.textContent = Math.round(progress) + '%';
      
      if (totalSize > 0) {
        const downloadedMB = (progress / 100 * totalSize / 1024 / 1024).toFixed(1);
        const totalMB = (totalSize / 1024 / 1024).toFixed(1);
        transferredText.textContent = `${downloadedMB} MB / ${totalMB} MB`;
        sizeText.textContent = `${totalMB} MB`;
      } else {
        sizeText.textContent = 'Downloading...';
        transferredText.textContent = `${Math.round(progress)}%`;
      }
      
      // Only update speed and ETA display every 5 seconds
      const timeSinceLastDisplay = (now - lastDisplayUpdate) / 1000;
      if (timeSinceLastDisplay >= 5) {
        speedText.textContent = speedTextValue;
        etaText.textContent = etaTextValue;
        lastDisplayUpdate = now;
      }
      
      lastProgress = progress;
      lastUpdateTime = now;
    }
  });
  
  ipcRenderer.on('download-status', (event, data) => {
    if (data.buildId === build.id) {
      sizeText.textContent = data.status;
      speedText.textContent = '—';
      etaText.textContent = '—';
    }
  });
  
  try {
    const result = await ipcRenderer.invoke('download-build', { 
      ...downloadBuild, 
      downloadPath,
      cancelToken: { cancelled: false } 
    });
    
    if (isCancelled) {
      return; // Don't process result if cancelled
    }
    
    if (result.success) {
      clearTimeout(timeoutId); // Clear timeout on success
      sizeText.textContent = 'Complete!';
      speedText.textContent = '—';
      etaText.textContent = '—';
      percentageText.textContent = '100%';
      progressBar.style.width = '100%';
      
      // Refresh builds list
      await loadBuilds();
      
      // Remove from downloads after delay
      setTimeout(() => {
        downloadItem.remove();
        if (downloadsList.children.length === 0) {
          downloadsEmpty.style.display = 'block';
          downloadsList.style.display = 'none';
        }
      }, 2000);
    } else {
      clearTimeout(timeoutId); // Clear timeout on failure
      sizeText.textContent = 'Failed: ' + result.error;
      speedText.textContent = '—';
      etaText.textContent = '—';
      progressBar.style.background = '#EF4444';
    }
  } catch (error) {
    clearTimeout(timeoutId); // Clear timeout on error
    console.error('Download error:', error);
    sizeText.textContent = `Failed: ${error.message}`;
    speedText.textContent = '—';
    etaText.textContent = '—';
    percentageText.textContent = 'Error';
    transferredText.textContent = '0 MB / — MB';
    progressBar.style.background = '#EF4444';
    progressBar.style.width = '100%';
    
    // Don't remove the item on error - let user see what happened
    // Add a close button for failed downloads
    const closeBtn = document.createElement('button');
    closeBtn.className = 'download-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = () => downloadItem.remove();
    downloadItem.appendChild(closeBtn);
  }
}

// Downloads Catalog
// Parse Fortnite builds from Ralzify/FortniteBuilds README
function parseFortniteBuildsFromReadme(readmeText) {
  const builds = [];
  
  // Split README into sections
  const sections = readmeText.split(/^#+\s+/m);
  
  for (const section of sections) {
    if (!section.includes('|') || !section.includes('Download')) continue;
    
    // Extract section title (season/category)
    const titleMatch = section.match(/^(.+?)\n/);
    if (!titleMatch) continue;
    
    let season = titleMatch[1].trim();
    
    // Map section titles to proper season names
    const seasonMap = {
      'Online Testing': 'Online Testing',
      'Pre-Season': 'Pre-Season',
      'Season 1': 'Season 1',
      'Season 2': 'Season 2',
      'Season 3': 'Season 3',
      'Season 4': 'Season 4',
      'Season 5': 'Season 5',
      'Season 6': 'Season 6',
      'Season 7': 'Season 7',
      'Season 8': 'Season 8',
      'Season 9': 'Season 9',
      'Season 10': 'Season 10',
      'Season 11': 'Season 11',
      'Season 12': 'Season 12',
      'Season 13': 'Season 13',
      'Season 14': 'Season 14',
      'Season 15': 'Season 15',
      'Season 16': 'Season 16',
      'Season 17': 'Season 17',
      'Season 18': 'Season 18',
      'Season 19': 'Season 19',
      'Season 20': 'Season 20',
      'Season 21': 'Season 21',
      'Season 22': 'Season 22',
      'Season 23': 'Season 23',
      'Season 24': 'Season 24',
      'Season 25': 'Season 25',
      'Season 26': 'Season 26',
      'Season 27': 'Season 27',
      'Season 28': 'Season 28',
      'Season 29': 'Season 29',
      'Season 30': 'Season 30',
      'Season 31': 'Season 31',
      'Season 32': 'Season 32',
      'Season 33': 'Season 33',
      'Season 34': 'Season 34',
      'Season 35': 'Season 35'
    };
    
    season = seasonMap[season] || season;
    
    // Parse markdown table
    const lines = section.split('\n');
    let inTable = false;
    let headers = [];
    
    for (const line of lines) {
      if (line.includes('|') && !line.includes('|---')) {
        if (!inTable) {
          // This is the header row
          headers = line.split('|').map(h => h.trim()).filter(h => h);
          inTable = true;
        } else {
          // This is a data row
          const cells = line.split('|').map(c => c.trim()).filter(c => c);
          if (cells.length >= headers.length) {
            const build = {};
            
            // Map headers to build properties
            headers.forEach((header, index) => {
              const value = cells[index] || '';
              
              if (header.toLowerCase().includes('build') || header.toLowerCase().includes('version')) {
                build.name = value;
                build.version = value;
              } else if (header.toLowerCase().includes('cl') || header.toLowerCase().includes('change list')) {
                build.cl = value;
              } else if (header.toLowerCase().includes('date')) {
                build.date = value;
              } else if (header.toLowerCase().includes('size')) {
                build.size = value;
              } else if (header.toLowerCase().includes('download') || header.toLowerCase().includes('link')) {
                // Extract download URLs from the cell, prioritizing direct download services
                const urls = [];
                const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
                let match;
                while ((match = urlRegex.exec(value)) !== null) {
                  // Clean up the URL (remove trailing punctuation, etc.)
                  let url = match[1].replace(/[.,;]$/, '');
                  
                  // Prioritize direct download services, but allow others as fallback
                  const directDownloadServices = [
                    'galaxiafn.com',
                    'galaxiafn.net',
                    'cdn.galaxiafn.com',
                    'download.galaxiafn.com'
                  ];
                  
                  const sharingServices = [
                    'drive.google.com',
                    'gofile.io',
                    'store4.gofile.io',
                    'mega.nz',
                    'dropbox.com',
                    'onedrive.live.com',
                    'mediafire.com',
                    'zippyshare.com',
                    'gigafile.nu',
                    '106.gigafile.nu'
                  ];
                  
                  const isDirectDownload = directDownloadServices.some(service => url.includes(service));
                  const isSharingLink = sharingServices.some(service => url.includes(service));
                  
                  // Include direct downloads first, then other links as fallback
                  if (isDirectDownload || !isSharingLink) {
                    urls.push(url);
                  }
                }
                if (urls.length > 0) {
                  build.downloadUrls = urls;
                  build.downloadUrl = urls[0]; // Primary URL
                }
              }
            });
            
            // Set season and other metadata
            build.season = season;
            build.source = 'github-catalog';
            
            // Generate a unique ID
            build.id = `${season}-${build.name || build.version || 'unknown'}`.replace(/[^a-zA-Z0-9]/g, '-');
            
            // Only add if it has a name/version and download URL
            if ((build.name || build.version) && build.downloadUrl) {
              builds.push(build);
            }
          }
        }
      } else if (line.includes('|---') && inTable) {
        // This is the separator row, skip it
        continue;
      } else if (inTable && !line.includes('|')) {
        // End of table
        break;
      }
    }
  }
  
  return builds;
}

async function loadDownloadCatalog() {
  const catalogContainer = document.getElementById('catalog-container');
  const seasonFilter = document.getElementById('catalog-season-filter');
  if (!catalogContainer || !seasonFilter) return;

  // Show loading state
  catalogContainer.innerHTML = '<div style="padding:16px;color:#999;">Loading Fortnite build catalog...</div>';

  // Fetch builds from Ralzify/FortniteBuilds GitHub repository
  let allBuilds = [];
  try {
    const response = await fetch('https://raw.githubusercontent.com/Ralzify/FortniteBuilds/main/README.md');
    if (!response.ok) throw new Error('Failed to fetch build catalog');
    
    const readmeText = await response.text();
    allBuilds = parseFortniteBuildsFromReadme(readmeText);
  } catch (e) {
    console.error('Failed to load Fortnite build catalog:', e);
    catalogContainer.innerHTML = '<div style="padding:16px;color:#EF4444;">Failed to load Fortnite build catalog from GitHub.</div>';
    return;
  }

  // Also pull optional local catalog (user-managed file)
  let localCatalog = { success: true, builds: [] };
  try {
    localCatalog = await ipcRenderer.invoke('get-local-catalog');
  } catch (e) {
    // ignore
  }

  // Merge with local catalog
  allBuilds = [
    ...(localCatalog?.builds || []),
    ...allBuilds
  ];

  // Build season list - preserve order from catalog
  const seasonOrder = ['Season 0 & 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5', 'Season 6', 'Season 7', 'Season 8', 'Season 9', 'Season X/10', 'Season 11', 'Season 12', 'Season 13', 'Season 14', 'Season 15', 'Season 16', 'Season 17', 'Season 18', 'Season 19', 'Season 20'];
  const seasons = Array.from(new Set(allBuilds.map(b => b.season || 'Unknown')));
  const sortedSeasons = seasons.sort((a, b) => {
    const aIdx = seasonOrder.indexOf(a);
    const bIdx = seasonOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  // Populate filter
  seasonFilter.innerHTML = '<option value="all">All</option>' + sortedSeasons.map(s => `<option value="${s}">${s}</option>`).join('');

  const render = () => {
    const selected = seasonFilter.value;
    console.log('Season filter selected:', selected);
    console.log('Total builds before filter:', allBuilds.length);
    const filtered = selected === 'all' ? allBuilds : allBuilds.filter(b => (b.season || 'Unknown') === selected);
    console.log('Filtered builds:', filtered.length);
    console.log('Sample build seasons:', allBuilds.slice(0, 3).map(b => b.season));

    // Group by season
    const bySeason = filtered.reduce((acc, b) => {
      const key = b.season || 'Unknown';
      (acc[key] = acc[key] || []).push(b);
      return acc;
    }, {});

    catalogContainer.innerHTML = '';
    const seasonKeys = Object.keys(bySeason);
    // Sort by season order
    const seasonOrder = ['Season 0 & 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5', 'Season 6', 'Season 7', 'Season 8', 'Season 9', 'Season X/10', 'Season 11', 'Season 12', 'Season 13', 'Season 14', 'Season 15', 'Season 16', 'Season 17', 'Season 18', 'Season 19', 'Season 20'];
    const sortedSeasonKeys = seasonKeys.sort((a, b) => {
      const aIdx = seasonOrder.indexOf(a);
      const bIdx = seasonOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    if (sortedSeasonKeys.length === 0) {
      catalogContainer.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #666;
          text-align: center;
        ">
          <div style="font-size: 18px; margin-bottom: 8px;">There's no builds found</div>
          <div style="font-size: 14px;">Try adjusting your search or filters</div>
        </div>
      `;
      return;
    }

    for (const season of sortedSeasonKeys) {
      const section = document.createElement('div');
      section.className = 'catalog-season-section';
      section.innerHTML = `
        <div class="catalog-season-header">
          <h4>${season}</h4>
        </div>
        <div class="catalog-list">
          <div class="catalog-row catalog-row-head">
            <div>Build</div>
            <div>Date</div>
            <div>Size</div>
            <div></div>
          </div>
        </div>
      `;
      const list = section.querySelector('.catalog-list');

      // Sort builds by date within each season
      const sortedBuilds = bySeason[season].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateA - dateB;
      });

      sortedBuilds.forEach(b => {
        const row = document.createElement('div');
        row.className = 'catalog-row';
        const date = b.date || b.createdAt ? new Date(b.createdAt || b.date).toLocaleDateString() : '—';
        const size = b.size || '—';
        const hasUrls = !!(b.downloadUrls && b.downloadUrls.length > 0) || !!b.downloadUrl;
        const isLocalCatalog = b.source === 'local-catalog';
        const isGitHubCatalog = b.source === 'github-catalog';
        
        row.innerHTML = `
          <div>${b.name || b.version || b.cl || 'Build'}</div>
          <div>${date}</div>
          <div>${size}</div>
          <div>
            ${hasUrls
              ? `<button class="download-btn">${isLocalCatalog ? 'Open Link' : isGitHubCatalog ? 'Download' : 'Download'}</button>`
              : '<button class="download-btn" disabled>No Download</button>'}
          </div>
        `;
        
        const btn = row.querySelector('button');
        if (hasUrls && !btn.disabled) {
          if (isLocalCatalog) {
            btn.addEventListener('click', () => require('electron').shell.openExternal(b.downloadUrl));
          } else {
            btn.addEventListener('click', () => downloadBuild(b));
          }
        }
        
        list.appendChild(row);
      });

      catalogContainer.appendChild(section);
    }
  };

  seasonFilter.onchange = render;
  render();
}

// Load Catalog View
async function loadCatalog() {
  const catalogGrid = document.getElementById('catalog-grid');
  const catalogLoading = document.getElementById('catalog-loading');
  const catalogEmpty = document.getElementById('catalog-empty');
  const seasonFilter = document.getElementById('catalog-season-filter');
  const searchInput = document.getElementById('catalog-search');

  if (!catalogGrid || !catalogLoading || !catalogEmpty) return;

  // Show loading state
  catalogLoading.style.display = 'flex';
  catalogGrid.style.display = 'none';
  catalogEmpty.style.display = 'none';

  let allBuilds = [];
  try {
    const response = await fetch('https://raw.githubusercontent.com/Ralzify/FortniteBuilds/main/README.md');
    if (!response.ok) throw new Error('Failed to fetch build catalog');

    const readmeText = await response.text();
    allBuilds = parseFortniteBuildsFromReadme(readmeText);
  } catch (e) {
    console.error('Failed to load Fortnite build catalog:', e);
    catalogLoading.style.display = 'none';
    catalogEmpty.style.display = 'flex';
    catalogEmpty.innerHTML = `
      <h3>Failed to load catalog</h3>
      <p>Unable to fetch builds from GitHub. Please check your internet connection.</p>
    `;
    return;
  }

  // Hide loading, show grid
  catalogLoading.style.display = 'none';
  catalogGrid.style.display = 'grid';

  // Render function
  const render = () => {
    const seasonFilterValue = seasonFilter.value;
    const searchValue = searchInput.value.toLowerCase();

    // Filter builds
    let filteredBuilds = allBuilds.filter(build => {
      const matchesSeason = !seasonFilterValue || build.season === seasonFilterValue;
      const matchesSearch = !searchValue ||
        (build.name || build.version || '').toLowerCase().includes(searchValue) ||
        (build.cl || '').toLowerCase().includes(searchValue) ||
        (build.season || '').toLowerCase().includes(searchValue);
      return matchesSeason && matchesSearch;
    });

    console.log('Filtering:', { seasonFilterValue, searchValue, totalBuilds: allBuilds.length, filteredCount: filteredBuilds.length });
    console.log('Sample builds:', allBuilds.slice(0, 3).map(b => ({ name: b.name, season: b.season })));

    // Clear grid
    catalogGrid.innerHTML = '';

    if (filteredBuilds.length === 0) {
      catalogEmpty.style.display = 'flex';
      catalogEmpty.innerHTML = `
        <h3>No builds found</h3>
        <p>Try adjusting your search or filters.</p>
      `;
      return;
    }

    catalogEmpty.style.display = 'none';

    // Render build cards
    filteredBuilds.forEach(build => {
      const card = document.createElement('div');
      card.className = 'catalog-card';

      const hasUrls = !!(build.downloadUrls && build.downloadUrls.length > 0) || !!build.downloadUrl;
      const size = build.size || 'Unknown size';
      const date = build.date || 'Unknown date';

      card.innerHTML = `
        <div class="catalog-card-header">
          <h3>${build.name || build.version || build.cl || 'Unknown Build'}</h3>
          <span class="catalog-card-season">${build.season || 'Unknown'}</span>
        </div>
        <div class="catalog-card-info">
          <div class="catalog-card-detail">
            <span class="catalog-card-label">CL:</span>
            <span class="catalog-card-value">${build.cl || '—'}</span>
          </div>
          <div class="catalog-card-detail">
            <span class="catalog-card-label">Size:</span>
            <span class="catalog-card-value">${size}</span>
          </div>
          <div class="catalog-card-detail">
            <span class="catalog-card-label">Date:</span>
            <span class="catalog-card-value">${date}</span>
          </div>
        </div>
        <div class="catalog-card-actions">
          <button class="catalog-download-btn ${hasUrls ? '' : 'disabled'}" ${hasUrls ? '' : 'disabled'}>
            ${hasUrls ? 'Download' : 'No Download Available'}
          </button>
        </div>
      `;

      const downloadBtn = card.querySelector('.catalog-download-btn');
      if (hasUrls && !downloadBtn.disabled) {
        downloadBtn.addEventListener('click', () => downloadBuild(build));
      }

      catalogGrid.appendChild(card);
    });
  };

  // Event listeners
  seasonFilter.addEventListener('change', render);
  searchInput.addEventListener('input', render);

  // Initial render
  render();
}

// Launch button handler
document.getElementById('launch-btn').addEventListener('click', async () => {
  if (currentBuilds.length > 0) {
    const mainBuild = currentBuilds.find(b => b.downloaded) || currentBuilds[0];
    
    if (!mainBuild.downloaded) {
      alert('Please download or import a build first!');
      document.querySelector('[data-view="library"]').click();
    } else {
      await launchBuild(mainBuild);
    }
  } else {
    alert('No builds available. Please import a build or contact the server admin.');
  }
});

// Discord button handler
document.querySelector('.discord-btn').addEventListener('click', () => {
  require('electron').shell.openExternal('https://discord.gg/your-server');
});

// Help button handler
document.querySelector('.help-btn').addEventListener('click', () => {
  alert('Help & Support\n\nFor assistance, please visit:\n- Discord: discord.gg/your-server\n- Documentation: docs.projectdrift.com\n- GitHub: github.com/your-repo');
});

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  
  // Auto-update timer
  setInterval(() => {
    const timer = document.querySelector('.build-timer span');
    if (timer) {
      const parts = timer.textContent.split(':');
      let minutes = parseInt(parts[0]);
      let seconds = parseInt(parts[1]);
      
      seconds--;
      if (seconds < 0) {
        seconds = 59;
        minutes--;
      }
      
      if (minutes >= 0) {
        timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
  }, 1000);
});

// Error handling for IPC calls
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// ============================================
// Server List & P2P Hosting
// ============================================

let serverRefreshInterval = null;

// Load server settings
async function loadServerSettings() {
  try {
    const settings = await ipcRenderer.invoke('get-server-settings');
    document.getElementById('server-name').value = settings.serverName;
    document.getElementById('host-name').value = settings.hostName;
    document.getElementById('server-mode').value = settings.mode;
    document.getElementById('max-players').value = settings.maxPlayers;
    document.getElementById('max-players-value').textContent = settings.maxPlayers;
    document.getElementById('ltm-enabled').checked = settings.ltmEnabled;
    document.getElementById('event-enabled').checked = settings.eventEnabled;
    document.getElementById('private-server').checked = settings.isPrivate;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Save server settings
async function saveServerSettings() {
  try {
    const settings = {
      serverName: document.getElementById('server-name').value,
      hostName: document.getElementById('host-name').value,
      mode: document.getElementById('server-mode').value,
      maxPlayers: parseInt(document.getElementById('max-players').value),
      ltmEnabled: document.getElementById('ltm-enabled').checked,
      eventEnabled: document.getElementById('event-enabled').checked,
      isPrivate: document.getElementById('private-server').checked
    };

    console.log('Saving settings:', settings);
    const result = await ipcRenderer.invoke('save-server-settings', settings);
    console.log('Save result:', result);
    
    if (result.success) {
      closeModal();
      showNotification('Settings saved successfully!', 'success');
    } else {
      showNotification('Failed to save settings: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
    showNotification('Error saving settings: ' + err.message, 'error');
  }
}

// Load server list
async function loadServerList(buildVersion = null) {
  const serversList = document.getElementById('servers-list');
  const serversEmpty = document.getElementById('servers-empty');
  const serverCount = document.getElementById('server-count');

  try {
    // If no version specified, get current builds and use first one
    if (!buildVersion) {
      const builds = await ipcRenderer.invoke('get-builds');
      if (builds.length > 0) {
        buildVersion = builds[0].version;
      } else {
        // No builds available
        serversList.style.display = 'none';
        serversEmpty.style.display = 'flex';
        serverCount.textContent = '0 servers';
        return;
      }
    }

    const result = await ipcRenderer.invoke('get-server-list', buildVersion);
    
    if (result.success && result.servers.length > 0) {
      serversList.style.display = 'flex';
      serversEmpty.style.display = 'none';
      serverCount.textContent = `${result.count} server${result.count !== 1 ? 's' : ''}`;

      serversList.innerHTML = result.servers.map(server => `
        <div class="server-card" data-server-id="${server.id}" data-build-version="${server.buildVersion}" data-ip="${server.ip}" data-port="${server.port}">
          <div class="server-card-header">
            <div>
              <div class="server-name">${escapeHtml(server.serverName)}</div>
              <div class="server-host">Host: ${escapeHtml(server.hostName)}</div>
            </div>
            <div class="server-badge version">${escapeHtml(server.buildVersion)}</div>
          </div>
          
          <div class="server-card-body">
            <div class="server-info-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
              </svg>
              <div>
                <div class="server-info-label">Players</div>
                <div class="server-info-value">${server.currentPlayers}/${server.maxPlayers}</div>
              </div>
            </div>

            <div class="server-info-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
              </svg>
              <div>
                <div class="server-info-label">Mode</div>
                <div class="server-info-value">${escapeHtml(server.mode)}</div>
              </div>
            </div>

            <div class="server-info-item">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
              </svg>
              <div>
                <div class="server-info-label">IP</div>
                <div class="server-info-value">${server.ip}:${server.port}</div>
              </div>
            </div>
          </div>

          ${server.ltmEnabled || server.eventEnabled ? `
            <div class="server-tags">
              ${server.ltmEnabled ? '<span class="server-tag ltm">LTM</span>' : ''}
              ${server.eventEnabled ? '<span class="server-tag event">EVENT</span>' : ''}
            </div>
          ` : ''}
        </div>
      `).join('');

      // Add click handlers
      document.querySelectorAll('.server-card').forEach(card => {
        card.addEventListener('click', () => {
          const serverId = card.dataset.serverId;
          const buildVersion = card.dataset.buildVersion;
          const ip = card.dataset.ip;
          const port = card.dataset.port;
          joinServer(serverId, buildVersion, ip, port);
        });
      });
    } else {
      serversList.style.display = 'none';
      serversEmpty.style.display = 'flex';
      serverCount.textContent = '0 servers';
    }
  } catch (err) {
    console.error('Failed to load server list:', err);
    serversList.style.display = 'none';
    serversEmpty.style.display = 'flex';
    serverCount.textContent = 'Error loading servers';
  }
}

// Join server
async function joinServer(serverId, buildVersion, ip, port) {
  try {
    const result = await ipcRenderer.invoke('join-server', {
      serverId,
      buildVersion,
      ip,
      port
    });

    if (result.success) {
      showNotification(`Joining server at ${ip}:${port}`, 'success');
    } else if (result.needsDownload) {
      // User doesn't have this build version
      const download = confirm(
        `You need Fortnite version ${buildVersion} to join this server.\n\n` +
        (result.downloadUrl 
          ? `Click OK to download it.`
          : `Download link not available. Please find and import this version manually.`)
      );

      if (download && result.downloadUrl) {
        require('electron').shell.openExternal(result.downloadUrl);
      }
    } else {
      showNotification(result.error || 'Failed to join server', 'error');
    }
  } catch (err) {
    console.error('Failed to join server:', err);
    showNotification('Error joining server', 'error');
  }
}

// Populate version filter
async function populateVersionFilter() {
  try {
    const builds = await ipcRenderer.invoke('get-builds');
    const filter = document.getElementById('server-version-filter');
    
    filter.innerHTML = '<option value="">All Versions</option>' + 
      builds.map(b => `<option value="${b.version}">${b.version} - ${b.name}</option>`).join('');
  } catch (err) {
    console.error('Failed to populate version filter:', err);
  }
}

// Show/hide modal
function openModal() {
  document.getElementById('server-settings-modal').classList.add('active');
  loadServerSettings();
}

function closeModal() {
  document.getElementById('server-settings-modal').classList.remove('active');
}

// Notification helper
function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // TODO: Add toast notifications
}

// HTML escape helper
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Event listeners
document.getElementById('server-settings-btn').addEventListener('click', openModal);
document.getElementById('close-settings-modal').addEventListener('click', closeModal);
document.getElementById('cancel-settings').addEventListener('click', closeModal);

document.getElementById('server-settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveServerSettings();
});

document.getElementById('max-players').addEventListener('input', (e) => {
  document.getElementById('max-players-value').textContent = e.target.value;
});

document.getElementById('refresh-servers-btn').addEventListener('click', () => {
  const version = document.getElementById('server-version-filter').value;
  loadServerList(version || null);
});

document.getElementById('server-version-filter').addEventListener('change', (e) => {
  loadServerList(e.target.value || null);
});

// Auto-refresh servers when on servers view
const originalInitView = window.initView || (() => {});
window.initView = function(viewName) {
  // Call original if exists
  if (typeof originalInitView === 'function') {
    originalInitView(viewName);
  }

  // Start/stop auto-refresh based on view
  if (viewName === 'servers') {
    populateVersionFilter();
    loadServerList();
    
    // Refresh every 5 seconds
    if (serverRefreshInterval) clearInterval(serverRefreshInterval);
    serverRefreshInterval = setInterval(() => {
      const version = document.getElementById('server-version-filter').value;
      loadServerList(version || null);
    }, 5000);
  } else {
    // Stop refresh when leaving servers view
    if (serverRefreshInterval) {
      clearInterval(serverRefreshInterval);
      serverRefreshInterval = null;
    }
  }
};

// Close modal on outside click
document.getElementById('server-settings-modal').addEventListener('click', (e) => {
  if (e.target.id === 'server-settings-modal') {
    closeModal();
  }
});

// Authentication initialization
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication state on app start
  checkAuthState();

  // Add login button handler
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => showAuthModal('signin'));
  }
});

