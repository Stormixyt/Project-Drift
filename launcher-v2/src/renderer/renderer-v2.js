const { ipcRenderer } = require('electron');

// ============================================
// State Management
// ============================================
let currentUser = null;
let currentBuilds = [];
let isOffline = false;
let activeDownloads = new Map();

// ============================================
// Window Controls
// ============================================
document.getElementById('minimize-btn')?.addEventListener('click', () => {
  ipcRenderer.send('window-minimize');
});

document.getElementById('maximize-btn')?.addEventListener('click', () => {
  ipcRenderer.send('window-maximize');
});

document.getElementById('close-btn')?.addEventListener('click', () => {
  ipcRenderer.send('window-close');
});

// ============================================
// Navigation System
// ============================================
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update active states
      navItems.forEach(nav => nav.classList.remove('active'));
      sections.forEach(section => section.classList.remove('active'));
      
      item.classList.add('active');
      
      // Show corresponding section
      const targetSection = item.dataset.section;
      const section = document.getElementById(`${targetSection}-section`);
      
      if (section) {
        section.classList.add('active');
        
        // Lazy-load content based on section
        if (targetSection === 'downloads') {
          loadDownloadCatalog().catch(console.error);
        } else if (targetSection === 'servers') {
          loadServers().catch(console.error);
        }
      }
      
      // Update breadcrumb
      updateBreadcrumb(targetSection);
    });
  });
}

function updateBreadcrumb(section) {
  const breadcrumbCurrent = document.getElementById('breadcrumb-current');
  if (breadcrumbCurrent) {
    const sectionNames = {
      'library': 'Game Library',
      'downloads': 'Download Catalog',
      'servers': 'Server Browser'
    };
    breadcrumbCurrent.textContent = sectionNames[section] || section;
  }
}

// ============================================
// Initialization
// ============================================
async function initializeUI() {
  console.log('Initializing Project Drift UI...');
  
  // Set up user (guest mode for now)
  currentUser = {
    username: 'Guest',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
    stats: {
      kdRatio: 0,
      wins: 0,
      matchesPlayed: 0,
      timePlayed: '0:00:00'
    }
  };
  
  // Update user avatar
  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar) {
    userAvatar.src = currentUser.avatar;
  }
  
  // Initialize navigation
  initNavigation();
  
  // Load initial data
  await loadBuilds();
  
  // Preload catalog for faster switching
  await loadDownloadCatalog();
  
  console.log('UI initialized successfully');
}

// ============================================
// Library Section - Load Builds
// ============================================
async function loadBuilds() {
  const buildsList = document.getElementById('builds-list');
  
  if (!buildsList) return;
  
  // Show loading state
  buildsList.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading builds...</p>
    </div>
  `;
  
  try {
    // Fetch builds from backend
    const result = await ipcRenderer.invoke('get-builds');
    
    if (result.success) {
      currentBuilds = result.builds || [];
      isOffline = result.offline || false;
      
      if (currentBuilds.length === 0) {
        // Show empty state
        buildsList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">No Builds Yet</div>
            <div class="empty-description">
              Import a build to get started or wait for builds to be added to the server
            </div>
          </div>
        `;
      } else {
        // Show builds grid
        buildsList.innerHTML = '';
        buildsList.className = 'builds-grid';
        
        // Render each build
        currentBuilds.forEach(build => {
          const buildCard = createBuildCard(build);
          buildsList.appendChild(buildCard);
        });
      }
      
    } else {
      // Show error
      buildsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Failed to Load Builds</div>
          <div class="empty-description">${result.error || 'Unknown error occurred'}</div>
          <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;">
            Retry
          </button>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Failed to load builds:', error);
    
    buildsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <div class="empty-title">Connection Error</div>
        <div class="empty-description">
          Make sure the backend is running:<br>
          <code>docker-compose -f docker-compose.dev.yml up -d</code>
        </div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 20px;">
          Retry
        </button>
      </div>
    `;
  }
}

// Create build card element
function createBuildCard(build) {
  const card = document.createElement('div');
  card.className = 'build-card';
  
  const seasonBadge = build.season ? build.season.replace('Season ', 'S') : 'LOCAL';
  const versionText = build.version || 'Unknown';
  const sizeText = build.size || '—';
  const imported = build.imported ? '📁 Imported' : '';
  
  card.innerHTML = `
    <div class="build-header">
      <div class="build-icon">🎮</div>
      <div class="build-info">
        <div class="build-name">${build.name}</div>
        <div class="build-version">${versionText}</div>
      </div>
    </div>
    <div class="build-meta">
      <div class="build-meta-item">
        <span>⭐</span>
        <span>${seasonBadge}</span>
      </div>
      <div class="build-meta-item">
        <span>💾</span>
        <span>${sizeText}</span>
      </div>
      ${imported ? `<div class="build-meta-item"><span>${imported}</span></div>` : ''}
    </div>
    <div class="build-actions">
      <button class="build-button" onclick="window.launchBuild('${build.id}')">
        ${build.downloaded ? '🚀 Launch' : '⬇️ Download'}
      </button>
      ${build.downloaded ? `<button class="build-button danger" onclick="window.removeBuild('${build.id}')">🗑️</button>` : ''}
    </div>
  `;
  
  return card;
}

// ============================================
// Build Actions (Global Functions)
// ============================================
window.launchBuild = async function(buildId) {
  const build = currentBuilds.find(b => b.id === buildId);
  if (!build) {
    alert('Build not found!');
    return;
  }
  
  if (!build.downloaded) {
    // Start download instead
    await downloadBuild(build);
    return;
  }
  
  console.log('Launching build:', build);
  
  try {
    const result = await ipcRenderer.invoke('launch-game', { buildId: build.id });
    
    if (result.success) {
      alert(`🚀 Game Launching!\n\nConnecting to: ${result.server}\n\nThe game window should open shortly.`);
    } else {
      alert('❌ Failed to launch game:\n\n' + result.error);
    }
  } catch (error) {
    console.error('Launch error:', error);
    alert('❌ Failed to launch game:\n\n' + error.message);
  }
};

window.removeBuild = async function(buildId) {
  if (!confirm('Are you sure you want to remove this build?\n\nThis will delete the build files from your computer.')) {
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('remove-build', { buildId });
    
    if (result.success) {
      await loadBuilds(); // Refresh the list
    } else {
      alert('Failed to remove build: ' + result.error);
    }
  } catch (error) {
    alert('Failed to remove build: ' + error.message);
  }
};

window.importBuild = async function() {
  const importBtn = document.getElementById('import-btn');
  if (importBtn) {
    importBtn.disabled = true;
    importBtn.textContent = '⏳ Importing...';
  }
  
  try {
    const result = await ipcRenderer.invoke('import-build');
    
    if (result.success) {
      await loadBuilds(); // Refresh builds list
      alert('✅ Build imported successfully!');
    } else {
      alert('❌ Import failed:\n\n' + result.error);
    }
  } catch (error) {
    console.error('Import error:', error);
    alert('❌ Import failed:\n\n' + error.message);
  } finally {
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.textContent = '📁 Import Build';
    }
  }
};

// ============================================
// Download Catalog Section
// ============================================
async function loadDownloadCatalog() {
  const catalogContainer = document.getElementById('catalog-container');
  const seasonFilter = document.getElementById('season-filter');
  const catalogCount = document.getElementById('catalog-count');
  
  if (!catalogContainer || !seasonFilter) return;
  
  // Show loading
  catalogContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading catalog...</p>
    </div>
  `;
  
  try {
    // Fetch builds from backend
    const result = await ipcRenderer.invoke('get-builds');
    let allBuilds = result?.builds || [];
    
    // Also fetch local catalog
    try {
      const localCatalog = await ipcRenderer.invoke('get-local-catalog');
      if (localCatalog?.builds) {
        allBuilds = [...localCatalog.builds, ...allBuilds];
      }
    } catch (e) {
      console.warn('Local catalog not available:', e);
    }
    
    // Hide loading
    catalogContainer.innerHTML = '';
    
    if (allBuilds.length === 0) {
      catalogContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📥</div>
          <div class="empty-title">No Builds Available</div>
          <div class="empty-description">
            Check back later for available builds to download
          </div>
        </div>
      `;
      return;
    }
    
    // Build season list
    const seasonOrder = [
      'Season 0 & 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5',
      'Season 6', 'Season 7', 'Season 8', 'Season 9', 'Season X/10',
      'Season 11', 'Season 12', 'Season 13', 'Season 14', 'Season 15',
      'Season 16', 'Season 17', 'Season 18', 'Season 19', 'Season 20'
    ];
    
    const seasons = Array.from(new Set(allBuilds.map(b => b.season || 'Unknown')));
    const sortedSeasons = seasons.sort((a, b) => {
      const aIdx = seasonOrder.indexOf(a);
      const bIdx = seasonOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    
    // Populate season filter
    seasonFilter.innerHTML = '<option value="all">All Seasons</option>' + 
      sortedSeasons.map(s => `<option value="${s}">${s}</option>`).join('');
    
    // Render function
    const renderCatalog = () => {
      const selectedSeason = seasonFilter.value;
      const filtered = selectedSeason === 'all' 
        ? allBuilds 
        : allBuilds.filter(b => (b.season || 'Unknown') === selectedSeason);
      
      // Update count
      if (catalogCount) {
        catalogCount.innerHTML = `Showing <strong>${filtered.length}</strong> builds`;
      }
      
      // Group by season
      const bySeason = filtered.reduce((acc, b) => {
        const key = b.season || 'Unknown';
        (acc[key] = acc[key] || []).push(b);
        return acc;
      }, {});
      
      const seasonKeys = Object.keys(bySeason);
      const sortedKeys = seasonKeys.sort((a, b) => {
        const aIdx = seasonOrder.indexOf(a);
        const bIdx = seasonOrder.indexOf(b);
        if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
      
      catalogContainer.innerHTML = '';
      catalogContainer.style.display = 'block';
      
      if (sortedKeys.length === 0) {
        catalogContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">No Builds Found</div>
            <div class="empty-description">
              Try selecting a different season filter
            </div>
          </div>
        `;
        return;
      }
      
      // Render each season
      sortedKeys.forEach(season => {
        const seasonSection = document.createElement('div');
        seasonSection.className = 'catalog-season';
        
        seasonSection.innerHTML = `
          <div class="season-header">
            <div class="season-icon">⭐</div>
            <div class="season-title">${season}</div>
          </div>
          <div class="season-builds" data-season="${season}"></div>
        `;
        
        const seasonBuildsContainer = seasonSection.querySelector('.season-builds');
        
        // Sort builds by date
        const sortedBuilds = bySeason[season].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateA - dateB;
        });
        
        // Render each build
        sortedBuilds.forEach(build => {
          const catalogCard = createCatalogCard(build);
          seasonBuildsContainer.appendChild(catalogCard);
        });
        
        catalogContainer.appendChild(seasonSection);
      });
    };
    
    // Attach filter handler
    seasonFilter.onchange = renderCatalog;
    
    // Initial render
    renderCatalog();
    
  } catch (error) {
    console.error('Failed to load catalog:', error);
    
    catalogContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <div class="empty-title">Failed to Load Catalog</div>
        <div class="empty-description">${error.message}</div>
      </div>
    `;
  }
}

// Create catalog card
function createCatalogCard(build) {
  const card = document.createElement('div');
  card.className = 'catalog-card';
  
  const date = build.createdAt ? new Date(build.createdAt).toLocaleDateString() : '—';
  const size = build.size || '—';
  const hasUrl = !!build.downloadUrl;
  const isLocalCatalog = build.source === 'local-catalog';
  
  card.innerHTML = `
    <div class="catalog-header">
      <div class="catalog-icon">🎮</div>
      <div class="catalog-info-block">
        <div class="catalog-name">${build.name || build.version || 'Build'}</div>
        <div class="catalog-version">${build.version || 'Unknown Version'}</div>
      </div>
    </div>
    <div class="catalog-meta">
      <div class="catalog-meta-item">
        <span>📅</span>
        <span>${date}</span>
      </div>
      <div class="catalog-meta-item">
        <span>💾</span>
        <span>${size}</span>
      </div>
    </div>
    <button class="catalog-button" data-build-id="${build.id}">
      ${hasUrl ? (isLocalCatalog ? '🔗 Open Link' : '⬇️ Download') : '📁 Import'}
    </button>
  `;
  
  const button = card.querySelector('.catalog-button');
  
  if (hasUrl) {
    if (isLocalCatalog) {
      button.addEventListener('click', () => {
        require('electron').shell.openExternal(build.downloadUrl);
      });
    } else {
      button.addEventListener('click', () => {
        downloadBuild(build);
      });
    }
  } else {
    button.addEventListener('click', async () => {
      await window.importBuild();
    });
  }
  
  return card;
}

// Download build
async function downloadBuild(build) {
  console.log('Starting download:', build);
  
  if (!build.downloadUrl && !build.url) {
    alert('No download URL available for this build.\n\nPlease import it manually.');
    return;
  }
  
  // TODO: Implement proper download tracking with progress bars
  // For now, just invoke the download
  
  try {
    const result = await ipcRenderer.invoke('download-build', build);
    
    if (result.success) {
      alert('✅ Download complete!\n\nBuild: ' + build.name);
      await loadBuilds(); // Refresh library
    } else {
      alert('❌ Download failed:\n\n' + result.error);
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('❌ Download failed:\n\n' + error.message);
  }
}

// ============================================
// Servers Section
// ============================================
async function loadServers() {
  const serversGrid = document.getElementById('servers-list');
  
  if (!serversGrid) return;
  
  // Show loading
  serversGrid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading servers...</p>
    </div>
  `;
  
  try {
    // Fetch servers from backend
    const result = await ipcRenderer.invoke('get-servers');
    
    if (result?.success && result.servers && result.servers.length > 0) {
      serversGrid.innerHTML = '';
      serversGrid.className = 'servers-grid';
      const serverCount = document.getElementById('server-count');
      if (serverCount) serverCount.textContent = String(result.servers.length);
      
      result.servers.forEach(server => {
        const serverCard = createServerCard(server);
        serversGrid.appendChild(serverCard);
      });
    } else {
      serversGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌐</div>
          <div class="empty-title">No Servers Available</div>
          <div class="empty-description">
            No game servers are currently online. Check back later!
          </div>
        </div>
      `;
      const serverCount = document.getElementById('server-count');
      if (serverCount) serverCount.textContent = '0';
    }
    
  } catch (error) {
    console.error('Failed to load servers:', error);
    
    serversGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <div class="empty-title">Failed to Load Servers</div>
        <div class="empty-description">${error.message}</div>
      </div>
    `;
  }
}

// Create server card
function createServerCard(server) {
  const card = document.createElement('div');
  card.className = 'server-card';
  
  const isOnline = server.status === 'online';
  const players = server.players || '0/0';
  const ping = server.ping || '—';
  const gameMode = server.gameMode || 'Unknown';
  const map = server.map || 'Unknown';
  
  card.innerHTML = `
    <div class="server-header">
      <div>
        <div class="server-title">${server.name}</div>
        <div class="server-host">${server.host || 'Unknown Host'}</div>
      </div>
      <div class="server-status ${isOnline ? 'online' : 'offline'}">
        ${isOnline ? '🟢 Online' : '🔴 Offline'}
      </div>
    </div>
    <div class="server-details">
      <div class="server-detail">
        <strong>Players</strong>
        ${players}
      </div>
      <div class="server-detail">
        <strong>Ping</strong>
        ${ping}ms
      </div>
      <div class="server-detail">
        <strong>Game Mode</strong>
        ${gameMode}
      </div>
      <div class="server-detail">
        <strong>Map</strong>
        ${map}
      </div>
    </div>
    <div class="server-actions">
      <button class="server-button" ${!isOnline ? 'disabled' : ''}>
        🎮 Join Server
      </button>
      <button class="server-button secondary">
        ℹ️ Details
      </button>
    </div>
  `;
  
  return card;
}

// ============================================
// Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing...');
  initializeUI();
  
  // Refresh servers button
  const refreshServersBtn = document.getElementById('refresh-servers-btn');
  if (refreshServersBtn) {
    refreshServersBtn.addEventListener('click', () => loadServers());
  }
});

// Error handling
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
