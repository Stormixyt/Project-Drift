const { ipcRenderer } = require('electron');

console.log('[Launcher] Perfect launcher loading...');

// ============================================
// STATE MANAGEMENT
// ============================================
let currentUser = null;
let currentBuilds = [];
let currentServers = [];
let isOffline = false;

// ============================================
// AUTHENTICATION
// ============================================
async function checkAuth() {
  try {
    const session = await ipcRenderer.invoke('auth-get-session');
    if (session && session.authenticated) {
      currentUser = session.user;
      console.log('[Auth] Session restored:', currentUser.username);
      return true;
    }
  } catch (error) {
    console.error('[Auth] Failed to check session:', error);
  }
  return false;
}

function showLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Discord login
const discordBtn = document.getElementById('discord-login-btn');
if (discordBtn) {
  discordBtn.addEventListener('click', async () => {
    try {
      console.log('[Auth] Starting Discord login...');
      discordBtn.disabled = true;
      discordBtn.innerHTML = `
        <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
        <span>Connecting...</span>
      `;
      
      const result = await ipcRenderer.invoke('auth-signin-discord');
      
      if (result.success) {
        currentUser = result.user;
        console.log('[Auth] Discord login successful:', currentUser.username);
        hideLoginModal();
        await initializeUI();
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('[Auth] Discord login failed:', error);
      alert('Failed to sign in with Discord:\n' + error.message);
      discordBtn.disabled = false;
      discordBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        <span>Sign in with Discord</span>
      `;
    }
  });
}

// Guest login
const guestBtn = document.getElementById('guest-login-btn');
if (guestBtn) {
  guestBtn.addEventListener('click', () => {
    console.log('[Auth] Continuing as guest...');
    currentUser = {
      username: 'Guest',
      provider: 'guest'
    };
    hideLoginModal();
    initializeUI();
  });
}

// Sign out
async function signOut() {
  if (!confirm('Are you sure you want to sign out?')) return;
  
  try {
    await ipcRenderer.invoke('auth-signout');
    currentUser = null;
    console.log('[Auth] Signed out successfully');
    
    // Reset UI
    showLoginModal();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('library-view')?.classList.add('active');
    
    // Clear content
    currentBuilds = [];
    currentServers = [];
    renderBuilds();
    renderServers();
    
  } catch (error) {
    console.error('[Auth] Sign out failed:', error);
    alert('Failed to sign out: ' + error.message);
  }
}

// User profile menu
document.addEventListener('DOMContentLoaded', () => {
  const userProfile = document.querySelector('.user-profile');
  if (userProfile) {
    userProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Remove existing menu
      document.querySelector('.profile-menu')?.remove();
      
      // Create menu
      const menu = document.createElement('div');
      menu.className = 'profile-menu';
      menu.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 16px;
        width: 208px;
        background: rgba(15, 16, 20, 0.98);
        backdrop-filter: blur(20px);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 8px;
        z-index: 9999;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        animation: slideInUp 0.2s ease;
      `;
      
      menu.innerHTML = `
        <button class="menu-item" style="
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          background: none;
          border: none;
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.15s;
        " onmouseover="this.style.background='rgba(255, 59, 48, 0.15)'; this.style.color='var(--error)';" onmouseout="this.style.background='none'; this.style.color='var(--text-primary)';">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Sign Out</span>
        </button>
      `;
      
      document.body.appendChild(menu);
      
      const signOutBtn = menu.querySelector('.menu-item');
      signOutBtn.addEventListener('click', () => {
        menu.remove();
        signOut();
      });
      
      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        });
      }, 10);
    });
  }
});

// ============================================
// UI INITIALIZATION
// ============================================
async function initializeUI() {
  console.log('[UI] Initializing with user:', currentUser?.username);
  
  // Update user profile
  const usernameEl = document.getElementById('username');
  const avatarEl = document.getElementById('user-avatar');
  const statusEl = document.getElementById('user-status');
  
  if (usernameEl) {
    usernameEl.textContent = currentUser.username;
  }
  
  if (avatarEl && currentUser.avatarUrl) {
    avatarEl.src = currentUser.avatarUrl;
  } else if (avatarEl) {
    avatarEl.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${currentUser.username}`;
  }
  
  if (statusEl) {
    statusEl.textContent = currentUser.provider === 'discord' ? 'Online' : 'Guest Mode';
  }
  
  // Load initial data
  await Promise.all([
    loadBuilds(),
    loadServers(),
    loadCatalog()
  ]);
}

// ============================================
// NAVIGATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view') + '-view';
      
      // Update nav
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      // Update view
      views.forEach(v => v.classList.remove('active'));
      document.getElementById(viewId)?.classList.add('active');
      
      console.log('[Nav] Switched to:', viewId);
    });
  });
  
  // Set default view
  document.querySelector('[data-view="library"]')?.classList.add('active');
  document.getElementById('library-view')?.classList.add('active');
});

// ============================================
// BUILDS MANAGEMENT
// ============================================
async function loadBuilds() {
  const container = document.getElementById('builds-container');
  if (!container) return;
  
  // Show loading
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading your builds...</p>
    </div>
  `;
  
  try {
    const builds = await ipcRenderer.invoke('builds-get-all');
    currentBuilds = builds || [];
    console.log('[Builds] Loaded:', currentBuilds.length);
    renderBuilds();
  } catch (error) {
    console.error('[Builds] Failed to load:', error);
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <h3>Failed to load builds</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderBuilds() {
  const container = document.getElementById('builds-container');
  if (!container) return;
  
  if (currentBuilds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <h3>No builds yet</h3>
        <p>Import your first Fortnite build to get started</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `<div class="builds-grid"></div>`;
  const grid = container.querySelector('.builds-grid');
  
  currentBuilds.forEach((build, index) => {
    const card = document.createElement('div');
    card.className = 'build-card';
    card.style.setProperty('--index', index);
    
    card.innerHTML = `
      <div class="build-header">
        <div class="build-info">
          <h3>${escapeHtml(build.name || 'Unnamed Build')}</h3>
          <p class="build-version">Version ${escapeHtml(build.version || 'Unknown')}</p>
        </div>
        <div class="build-actions">
          <button class="icon-btn delete" onclick="deleteBuild('${build.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="build-meta">
        <div class="meta-item">
          <span class="meta-label">Size</span>
          <span class="meta-value">${formatBytes(build.size || 0)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Added</span>
          <span class="meta-value">${formatDate(build.addedAt || Date.now())}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Patch</span>
          <span class="meta-value">${escapeHtml(build.patch || 'N/A')}</span>
        </div>
      </div>
      <div class="build-footer">
        <button class="btn-primary" onclick="launchBuild('${build.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Launch</span>
        </button>
        <button class="btn-secondary" onclick="showBuildDetails('${build.id}')">
          Details
        </button>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// Import build
const importBtn = document.getElementById('import-build-btn');
if (importBtn) {
  importBtn.addEventListener('click', async () => {
    try {
      const result = await ipcRenderer.invoke('builds-import');
      if (result.success) {
        console.log('[Builds] Import successful');
        await loadBuilds();
      }
    } catch (error) {
      console.error('[Builds] Import failed:', error);
      alert('Failed to import build: ' + error.message);
    }
  });
}

// Launch build
window.launchBuild = async function(buildId) {
  try {
    console.log('[Builds] Launching:', buildId);
    const result = await ipcRenderer.invoke('builds-launch', buildId);
    if (result.success) {
      console.log('[Builds] Launch successful');
    } else {
      throw new Error(result.error || 'Launch failed');
    }
  } catch (error) {
    console.error('[Builds] Launch failed:', error);
    alert('Failed to launch build:\n' + error.message);
  }
};

// Delete build
window.deleteBuild = async function(buildId) {
  if (!confirm('Are you sure you want to delete this build?')) return;
  
  try {
    console.log('[Builds] Deleting:', buildId);
    const result = await ipcRenderer.invoke('builds-delete', buildId);
    if (result.success) {
      console.log('[Builds] Delete successful');
      await loadBuilds();
    } else {
      throw new Error(result.error || 'Delete failed');
    }
  } catch (error) {
    console.error('[Builds] Delete failed:', error);
    alert('Failed to delete build:\n' + error.message);
  }
};

// Show build details
window.showBuildDetails = function(buildId) {
  const build = currentBuilds.find(b => b.id === buildId);
  if (!build) return;
  
  alert(`Build Details:\n\nName: ${build.name}\nVersion: ${build.version}\nPatch: ${build.patch}\nSize: ${formatBytes(build.size)}\nPath: ${build.path}`);
};

// ============================================
// SERVERS MANAGEMENT
// ============================================
async function loadServers() {
  const container = document.getElementById('servers-container');
  if (!container) return;
  
  // Show loading
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Finding servers...</p>
    </div>
  `;
  
  try {
    const servers = await ipcRenderer.invoke('servers-get-all');
    currentServers = servers || [];
    console.log('[Servers] Loaded:', currentServers.length);
    renderServers();
  } catch (error) {
    console.error('[Servers] Failed to load:', error);
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
          <line x1="6" y1="6" x2="6.01" y2="6"></line>
          <line x1="6" y1="18" x2="6.01" y2="18"></line>
        </svg>
        <h3>Failed to load servers</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderServers() {
  const container = document.getElementById('servers-container');
  if (!container) return;
  
  if (currentServers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
          <line x1="6" y1="6" x2="6.01" y2="6"></line>
          <line x1="6" y1="18" x2="6.01" y2="18"></line>
        </svg>
        <h3>No servers online</h3>
        <p>Be the first to host a server!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `<div class="servers-list"></div>`;
  const list = container.querySelector('.servers-list');
  
  currentServers.forEach((server, index) => {
    const card = document.createElement('div');
    card.className = 'server-card';
    card.style.setProperty('--index', index);
    
    card.innerHTML = `
      <div class="server-info">
        <h3 class="server-name">${escapeHtml(server.name || 'Unnamed Server')}</h3>
        <div class="server-details">
          <span class="server-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${server.players || 0}/${server.maxPlayers || 16}
          </span>
          <span class="server-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${server.ping || '?'}ms
          </span>
          <span class="server-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
            ${escapeHtml(server.version || 'Unknown')}
          </span>
        </div>
      </div>
      <div class="server-actions">
        <button class="btn-primary" onclick="joinServer('${server.id}')">
          Join
        </button>
      </div>
    `;
    
    list.appendChild(card);
  });
}

// Host server
const hostServerBtn = document.getElementById('host-server-btn');
if (hostServerBtn) {
  hostServerBtn.addEventListener('click', () => {
    showHostServerModal();
  });
}

function showHostServerModal() {
  const modal = document.getElementById('host-server-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

function hideHostServerModal() {
  const modal = document.getElementById('host-server-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Modal close buttons
document.querySelectorAll('.modal-close, .cancel-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal');
    if (modal) {
      modal.classList.remove('active');
    }
  });
});

// Host server form
const hostServerForm = document.getElementById('host-server-form');
if (hostServerForm) {
  // Max players slider
  const slider = document.getElementById('max-players-slider');
  const value = document.getElementById('max-players-value');
  if (slider && value) {
    slider.addEventListener('input', () => {
      value.textContent = slider.value;
    });
  }
  
  hostServerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      serverName: document.getElementById('server-name').value,
      hostName: document.getElementById('host-name').value,
      gameMode: document.getElementById('game-mode').value,
      maxPlayers: parseInt(document.getElementById('max-players-slider').value),
      ltmMode: document.getElementById('ltm-mode').checked,
      eventMode: document.getElementById('event-mode').checked,
      privateServer: document.getElementById('private-server').checked
    };
    
    try {
      console.log('[Servers] Creating server:', formData);
      const result = await ipcRenderer.invoke('servers-host', formData);
      if (result.success) {
        console.log('[Servers] Server created successfully');
        hideHostServerModal();
        await loadServers();
      } else {
        throw new Error(result.error || 'Failed to create server');
      }
    } catch (error) {
      console.error('[Servers] Failed to host:', error);
      alert('Failed to create server:\n' + error.message);
    }
  });
}

// Join server
window.joinServer = async function(serverId) {
  try {
    console.log('[Servers] Joining:', serverId);
    const result = await ipcRenderer.invoke('servers-join', serverId);
    if (result.success) {
      console.log('[Servers] Joined successfully');
    } else {
      throw new Error(result.error || 'Failed to join');
    }
  } catch (error) {
    console.error('[Servers] Join failed:', error);
    alert('Failed to join server:\n' + error.message);
  }
};

// ============================================
// DOWNLOADS/CATALOG
// ============================================
async function loadCatalog() {
  const container = document.getElementById('catalog-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading catalog...</p>
    </div>
  `;
  
  try {
    const catalog = await ipcRenderer.invoke('catalog-get-all');
    console.log('[Catalog] Loaded:', catalog?.length || 0);
    renderCatalog(catalog || []);
  } catch (error) {
    console.error('[Catalog] Failed to load:', error);
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <h3>Catalog unavailable</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderCatalog(catalog) {
  const container = document.getElementById('catalog-container');
  if (!container) return;
  
  if (catalog.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <h3>No builds available</h3>
        <p>Check back later for new builds</p>
      </div>
    `;
    return;
  }
  
  // Group by season
  const seasons = {};
  catalog.forEach(item => {
    const season = item.season || 'Unknown';
    if (!seasons[season]) seasons[season] = [];
    seasons[season].push(item);
  });
  
  container.innerHTML = '';
  Object.entries(seasons).forEach(([season, items]) => {
    const seasonSection = document.createElement('div');
    seasonSection.className = 'catalog-season';
    
    seasonSection.innerHTML = `
      <h3 class="season-header">${escapeHtml(season)}</h3>
      <div class="catalog-list"></div>
    `;
    
    const list = seasonSection.querySelector('.catalog-list');
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'catalog-row';
      
      row.innerHTML = `
        <div>${escapeHtml(item.name || 'Unnamed')}</div>
        <div>${escapeHtml(item.version || 'Unknown')}</div>
        <div>${formatBytes(item.size || 0)}</div>
        <button class="btn-primary" onclick="downloadBuild('${item.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download
        </button>
      `;
      
      list.appendChild(row);
    });
    
    container.appendChild(seasonSection);
  });
}

window.downloadBuild = async function(buildId) {
  try {
    console.log('[Catalog] Downloading:', buildId);
    const result = await ipcRenderer.invoke('catalog-download', buildId);
    if (result.success) {
      console.log('[Catalog] Download started');
      alert('Download started! Check the Downloads view for progress.');
    } else {
      throw new Error(result.error || 'Download failed');
    }
  } catch (error) {
    console.error('[Catalog] Download failed:', error);
    alert('Failed to start download:\n' + error.message);
  }
};

// ============================================
// SETTINGS
// ============================================
const launchArgsInput = document.getElementById('launch-args');
if (launchArgsInput) {
  // Load saved args
  ipcRenderer.invoke('settings-get', 'launchArgs').then(args => {
    if (args) launchArgsInput.value = args;
  });
  
  // Save on change
  launchArgsInput.addEventListener('change', async () => {
    try {
      await ipcRenderer.invoke('settings-set', 'launchArgs', launchArgsInput.value);
      console.log('[Settings] Launch args saved');
    } catch (error) {
      console.error('[Settings] Failed to save:', error);
    }
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Launcher] DOM loaded, checking auth...');
  
  const isAuthenticated = await checkAuth();
  
  if (isAuthenticated) {
    hideLoginModal();
    await initializeUI();
  } else {
    showLoginModal();
  }
  
  console.log('[Launcher] Perfect launcher ready! 🚀');
});
