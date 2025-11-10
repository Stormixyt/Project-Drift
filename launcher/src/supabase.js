const Store = require('electron-store');
const axios = require('axios');

// Discord OAuth configuration
const DISCORD_CLIENT_ID = '1432021829924552825';
const DISCORD_CLIENT_SECRET = 'ZabkK80oVPUMWP_uO9RMTJtbAoBU6nsA';
const REDIRECT_URI = 'http://localhost:3001/oauth-callback';

// Create electron-store for session persistence
const store = new Store({
  name: 'auth',
  defaults: {
    session: null,
    user: null
  }
});

// Authentication functions
const auth = {
  // Sign in with Discord OAuth
  async signInWithDiscord() {
    try {
      // Generate state token for security
      const state = Math.random().toString(36).substring(2);
      store.set('oauth.state', state);

      // Build Discord OAuth URL
      const scopes = 'identify email guilds';
      const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`;

      console.log('[Auth] Generated Discord OAuth URL');
      return { success: true, url };
    } catch (error) {
      console.error('[Auth] Failed to generate OAuth URL:', error);
      return { success: false, error: error.message };
    }
  },

  // Set session after OAuth callback
  async setSession(accessToken, refreshToken) {
    try {
      console.log('[Auth] Setting session with access token');
      
      // Store tokens
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
      };
      
      store.set('session', session);
      
      // Get user data from Discord
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const discordUser = userResponse.data;
      const user = {
        id: discordUser.id,
        email: discordUser.email,
        user_metadata: {
          full_name: discordUser.username,
          name: discordUser.username,
          avatar: discordUser.avatar,
          discriminator: discordUser.discriminator,
          provider_id: discordUser.id,
          avatar_url: discordUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`
        }
      };

      store.set('user', user);
      console.log('[Auth] ✓ Session set successfully for user:', user.user_metadata.name);

      return { success: true, session, user };
    } catch (error) {
      console.error('[Auth] Failed to set session:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current session
  async getCurrentSession() {
    try {
      const session = store.get('session');
      if (!session) {
        return { data: { session: null } };
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at < Date.now()) {
        console.log('[Auth] Session expired');
        store.delete('session');
        store.delete('user');
        return { data: { session: null } };
      }

      return { data: { session } };
    } catch (error) {
      console.error('[Auth] Failed to get session:', error);
      return { data: { session: null } };
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const user = store.get('user');
      return { data: { user: user || null } };
    } catch (error) {
      console.error('[Auth] Failed to get user:', error);
      return { data: { user: null } };
    }
  },

  // Sign out
  async signOut() {
    try {
      store.delete('session');
      store.delete('user');
      store.delete('oauth.state');
      console.log('[Auth] ✓ Signed out successfully');
      return { success: true };
    } catch (error) {
      console.error('[Auth] Sign out failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Check if user is in required Discord server
  async checkDiscordServerMembership(userId) {
    try {
      const session = store.get('session');
      if (!session || !session.access_token) {
        return { success: false, isMember: false, error: 'Not authenticated' };
      }

      // Get user's Discord guilds
      const response = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      // Check if user is in Project Drift server
      const PROJECT_DRIFT_SERVER_ID = '1431737106761383938';
      const isMember = response.data.some(guild => guild.id === PROJECT_DRIFT_SERVER_ID);

      console.log('[Auth] Discord server check:', { isMember, serverCount: response.data.length });
      return { success: true, isMember };
    } catch (error) {
      console.error('[Auth] Failed to check server membership:', error);
      return { success: false, isMember: false, error: error.message };
    }
  }
};

// Database functions (using local storage)
const db = {
  // Get user profile
  async getUserProfile(userId) {
    try {
      const profiles = store.get('profiles', {});
      const profile = profiles[userId];
      return { success: true, profile: profile || null };
    } catch (error) {
      console.error('[DB] Failed to get profile:', error);
      return { success: false, error: error.message };
    }
  },

  // Create or update user profile
  async upsertUserProfile(userId, profileData) {
    try {
      const profiles = store.get('profiles', {});
      profiles[userId] = {
        user_id: userId,
        ...profileData,
        updated_at: new Date().toISOString()
      };
      store.set('profiles', profiles);
      console.log('[DB] ✓ Profile saved for user:', userId);
      return { success: true, profile: profiles[userId] };
    } catch (error) {
      console.error('[DB] Failed to upsert profile:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user's download history
  async getDownloadHistory(userId) {
    try {
      const history = store.get('download_history', {});
      const userHistory = history[userId] || [];
      return { success: true, history: userHistory };
    } catch (error) {
      console.error('[DB] Failed to get download history:', error);
      return { success: false, error: error.message };
    }
  },

  // Add download to history
  async addDownloadHistory(userId, buildId, buildName, buildVersion) {
    try {
      const history = store.get('download_history', {});
      if (!history[userId]) {
        history[userId] = [];
      }
      
      const record = {
        build_id: buildId,
        build_name: buildName,
        build_version: buildVersion,
        created_at: new Date().toISOString()
      };
      
      history[userId].unshift(record); // Add to beginning
      
      // Keep only last 50 downloads
      if (history[userId].length > 50) {
        history[userId] = history[userId].slice(0, 50);
      }
      
      store.set('download_history', history);
      console.log('[DB] ✓ Added to download history:', buildName);
      return { success: true, record };
    } catch (error) {
      console.error('[DB] Failed to add download history:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = {
  auth,
  db
};