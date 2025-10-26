// Preload script for secure IPC communication
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  signInWithDiscord: () => ipcRenderer.invoke('auth-signin-discord'),
  signOut: () => ipcRenderer.invoke('auth-signout'),
  getCurrentUser: () => ipcRenderer.invoke('auth-get-current-user'),
  getSession: () => ipcRenderer.invoke('auth-get-session'),
  handleCallback: (url) => ipcRenderer.invoke('auth-handle-callback', url),
  checkDiscordServer: (userId) => ipcRenderer.invoke('auth-check-discord-server', userId),

  // Database
  getUserProfile: (userId) => ipcRenderer.invoke('db-get-user-profile', userId),
  upsertUserProfile: (userId, profileData) => ipcRenderer.invoke('db-upsert-user-profile', { userId, profileData }),
  getDownloadHistory: (userId) => ipcRenderer.invoke('db-get-download-history', userId),
  addDownloadHistory: (userId, buildId, buildName, buildVersion) =>
    ipcRenderer.invoke('db-add-download-history', { userId, buildId, buildName, buildVersion }),

  // File operations
  selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),

  // Download management
  startDownload: (build) => ipcRenderer.invoke('start-download', build),
  cancelDownload: (buildId) => ipcRenderer.invoke('cancel-download', buildId),
  getDownloadProgress: (buildId) => ipcRenderer.invoke('get-download-progress', buildId),

  // Server management
  startServer: (config) => ipcRenderer.invoke('start-server', config),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),

  // Settings
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Listen for events
  onOAuthCallback: (callback) => ipcRenderer.on('oauth-callback', callback),
  removeAllListeners: (event) => ipcRenderer.removeAllListeners(event)
});

// Also expose ipcRenderer directly for compatibility (less secure but needed for existing code)
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => {
    // Whitelist of allowed channels
    const validChannels = [
      'auth-signin-discord', 'auth-signout', 'auth-get-current-user', 'auth-get-session',
      'auth-handle-callback', 'auth-check-discord-server',
      'db-get-user-profile', 'db-upsert-user-profile', 'db-get-download-history', 'db-add-download-history',
      'select-download-path', 'get-default-download-path',
      'start-download', 'cancel-download', 'get-download-progress',
      'start-server', 'stop-server', 'get-server-status',
      'load-settings', 'save-settings'
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  on: (channel, func) => {
    // Whitelist of allowed channels for listening
    const validChannels = ['oauth-callback'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    }
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});