const { ipcRenderer } = require('electron');

// State
let currentUser = null;
let currentBuilds = [];
let isOffline = false;

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
  `;
  
  card.addEventListener('click', async () => {
    if (build.downloaded) {
      await launchBuild(build);
    } else {
      await downloadBuild(build);
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
