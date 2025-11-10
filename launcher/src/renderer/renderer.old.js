const { ipcRenderer } = require('electron');

console.log('[Launcher] Script loaded!');

// State
let currentUser = null;
let currentBuilds = [];
let isOffline = false;

// Check if user is already logged in
async function checkAuth() {
  try {
    const session = await ipcRenderer.invoke('auth-get-session');
    if (session && session.authenticated) {
      currentUser = session.user;
      return true;
    }
  } catch (error) {
    console.error('[Auth] Failed to check session:', error);
  }
  return false;
}

// Show/hide login modal
function showLoginModal() {
  document.getElementById('login-modal').style.display = 'flex';
}

function hideLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
}

// Discord login button
document.getElementById('discord-login-btn').addEventListener('click', async () => {
  try {
    console.log('[Auth] Starting Discord login...');
    const result = await ipcRenderer.invoke('auth-signin-discord');
    
    if (result.success) {
      currentUser = result.user;
      hideLoginModal();
      await initializeUI();
    }
  } catch (error) {
    console.error('[Auth] Discord login failed:', error);
    alert('Failed to sign in with Discord: ' + error.message);
  }
});

// Guest login button
document.getElementById('guest-login-btn').addEventListener('click', () => {
  console.log('[Auth] Continuing as guest...');
  currentUser = {
    username: 'Guest',
    provider: 'guest'
  };
  hideLoginModal();
  initializeUI();
});

// Sign out function
async function signOut() {
  try {
    await ipcRenderer.invoke('auth-signout');
    currentUser = null;
    showLoginModal();
    
    // Clear UI
    const usernameEl = document.getElementById('username');
    if (usernameEl) usernameEl.textContent = 'Not logged in';
    
    // Navigate to home view
    document.querySelector('[data-view="home"]')?.click();
    
    console.log('[Auth] Signed out successfully');
  } catch (error) {
    console.error('[Auth] Sign out failed:', error);
  }
}

// User profile click to show context menu (sign out option)
document.addEventListener('DOMContentLoaded', () => {
  const userProfile = document.querySelector('.user-profile');
  if (userProfile) {
    userProfile.addEventListener('click', () => {
      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.cssText = 'position: fixed; bottom: 80px; left: 20px; background: rgba(30, 30, 40, 0.98); border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 8px; padding: 8px; z-index: 9999;';
      menu.innerHTML = `
        <button class="context-menu-item" style="display: block; width: 100%; padding: 12px 16px; background: none; border: none; color: #fff; text-align: left; cursor: pointer; border-radius: 4px; font-size: 14px;">
          Sign Out
        </button>
      `;
      
      const signOutBtn = menu.querySelector('.context-menu-item');
      signOutBtn.addEventListener('mouseover', () => {
        signOutBtn.style.background = 'rgba(255, 59, 48, 0.2)';
      });
      signOutBtn.addEventListener('mouseout', () => {
        signOutBtn.style.background = 'none';
      });
      signOutBtn.addEventListener('click', async () => {
        document.body.removeChild(menu);
        await signOut();
      });
      
      document.body.appendChild(menu);
      
      // Close on outside click
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && !userProfile.contains(e.target)) {
          document.body.removeChild(menu);
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 100);
    });
  }
});

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
      if (viewId === 'downloads-view') {
        loadDownloadCatalog().catch(console.error);
      }
    }
  });
});

// Initialize - connect to REAL backend
async function initializeUI() {
  try {
    console.log('[Launcher] Initializing UI...');
    
    // Make sure we have a user
    if (!currentUser) {
      console.error('[Launcher] No user logged in!');
      return;
    }
    
    console.log('[Launcher] Logged in as:', currentUser.username);
    
    // Safely set UI elements
    const usernameEl = document.getElementById('username');
    const welcomeEl = document.getElementById('welcome-username');
    const avatarEl = document.querySelector('.user-profile .avatar');
    
    if (usernameEl) usernameEl.textContent = currentUser.username;
    
    // Update avatar if Discord user
    if (avatarEl && currentUser.avatarUrl) {
      avatarEl.src = currentUser.avatarUrl;
    }
    if (welcomeEl) welcomeEl.textContent = currentUser.username;
    
    console.log('[Launcher] Loading builds...');
    // Load REAL builds from backend
    await loadBuilds();
    
    console.log('[Launcher] Loading download catalog...');
    // Preload catalog seasons
    await loadDownloadCatalog();
    
    console.log('[Launcher] Initialization complete!');
  } catch (error) {
    console.error('[Launcher] Initialization failed:', error);
    alert('Failed to initialize launcher: ' + error.message);
  }
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
  
  if (!build.downloadUrl && !build.url) {
    alert('No download URL available for this build.\n\nPlease import it manually or contact the server admin.');
    return;
  }
  
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
      <div class="download-name">${build.name}</div>
      <div class="download-size">Connecting...</div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: 0%"></div>
      </div>
    </div>
  `;
  
  downloadsList.appendChild(downloadItem);
  
  const progressBar = downloadItem.querySelector('.download-progress-fill');
  const sizeText = downloadItem.querySelector('.download-size');
  
  // Listen for progress events
  ipcRenderer.on('download-progress', (event, data) => {
    if (data.buildId === build.id) {
      progressBar.style.width = data.progress + '%';
      sizeText.textContent = `${Math.round(data.progress)}%`;
    }
  });
  
  ipcRenderer.on('download-status', (event, data) => {
    if (data.buildId === build.id) {
      sizeText.textContent = data.status;
    }
  });
  
  try {
    const result = await ipcRenderer.invoke('download-build', build);
    
    if (result.success) {
      sizeText.textContent = 'Complete!';
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
      sizeText.textContent = 'Failed: ' + result.error;
      progressBar.style.background = '#EF4444';
    }
  } catch (error) {
    sizeText.textContent = 'Error: ' + error.message;
    progressBar.style.background = '#EF4444';
  }
}

// Downloads Catalog
async function loadDownloadCatalog() {
  const catalogContainer = document.getElementById('catalog-container');
  const seasonFilter = document.getElementById('catalog-season-filter');
  if (!catalogContainer || !seasonFilter) return;

  // Fetch latest builds (server + local merged)
  let result;
  try {
    result = await ipcRenderer.invoke('get-builds');
  } catch (e) {
    catalogContainer.innerHTML = '<div style="padding:16px;color:#EF4444;">Failed to load catalog from server.</div>';
    return;
  }

  // Also pull optional local catalog (user-managed file)
  let localCatalog = { success: true, builds: [] };
  try {
    localCatalog = await ipcRenderer.invoke('get-local-catalog');
  } catch (e) {
    // ignore
  }

  // Show all public builds even if they lack a downloadUrl; we'll offer Import as fallback
  const allBuilds = [
    ...(localCatalog?.builds || []),
    ...(result?.builds || [])
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
    const filtered = selected === 'all' ? allBuilds : allBuilds.filter(b => (b.season || 'Unknown') === selected);

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
      catalogContainer.innerHTML = '<div style="padding:16px;color:#999;">No public builds are available yet.</div>';
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
        const date = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—';
        const size = b.size || '—';
        const hasUrl = !!b.downloadUrl;
        const isLocalCatalog = b.source === 'local-catalog';
        row.innerHTML = `
          <div>${b.name || b.version || 'Build'}</div>
          <div>${date}</div>
          <div>${size}</div>
          <div>
            ${hasUrl
              ? `<button class=\"download-btn\">${isLocalCatalog ? 'Open Link' : 'Download'}</button>`
              : '<button class="download-btn" id="import-btn">Import…</button>'}
          </div>
        `;
        const btn = row.querySelector('button');
        if (hasUrl) {
          if (isLocalCatalog) {
            btn.addEventListener('click', () => require('electron').shell.openExternal(b.downloadUrl));
          } else {
            btn.addEventListener('click', () => downloadBuild(b));
          }
        } else {
          btn.addEventListener('click', async () => {
            // Reuse import flow
            try {
              const result = await ipcRenderer.invoke('import-build');
              if (result?.success) {
                await loadBuilds();
                await loadDownloadCatalog();
              }
            } catch (e) {
              console.error('Import failed from catalog:', e);
            }
          });
        }
        list.appendChild(row);
      });

      catalogContainer.appendChild(section);
    }
  };

  seasonFilter.onchange = render;
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
window.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already authenticated
  const isAuthenticated = await checkAuth();
  
  if (isAuthenticated) {
    // User already logged in, initialize UI
    console.log('[Launcher] User already authenticated, initializing...');
    hideLoginModal();
    await initializeUI();
  } else {
    // Show login modal
    console.log('[Launcher] No authentication found, showing login modal...');
    showLoginModal();
  }
  
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

