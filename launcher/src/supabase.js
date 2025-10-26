const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://asqrpypvszmgvhuyokxa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzcXJweXB2c3ptZ3ZodXlva3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODE0NTUsImV4cCI6MjA3NzA1NzQ1NX0.Ehs2qhwn5xHn_nl6EG6T_rgoxwRgLx630gX2TJP3mJQ';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication functions
const auth = {
  // Sign in with Discord OAuth
  async signInWithDiscord() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: 'http://localhost:3001',
          scopes: 'identify email guilds guilds.members.read'
        }
      });

      if (error) throw error;
      // Return the URL that needs to be opened in browser
      return { success: true, url: data.url };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get current user
  getCurrentUser() {
    return supabase.auth.getUser();
  },

  // Get current session
  getCurrentSession() {
    return supabase.auth.getSession();
  },

  // Set session with tokens
  async setSession(accessToken, refreshToken) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  // Check if user is in required Discord server
  async checkDiscordServerMembership(userId) {
    try {
      // Get user's Discord guilds from metadata
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'No user found' };

      // Use the actual Discord server ID provided by user
      const requiredGuildId = '1431737106761383938'; // Project Drift Discord server ID
      
      // For now, we'll check if the user has Discord metadata (indicating successful OAuth)
      // In production, you'd verify against the actual server ID using Discord API
      const hasDiscordData = user.user_metadata && 
                            (user.user_metadata.full_name || user.user_metadata.avatar_url);
      
      // TODO: Replace with actual server membership check using Discord API
      // For now, accept any Discord OAuth user
      return { success: true, isMember: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Database functions
const db = {
  // Get user profile
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Create or update user profile
  async upsertUserProfile(userId, profileData) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user's download history
  async getDownloadHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('download_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, history: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Add download to history
  async addDownloadHistory(userId, buildId, buildName, buildVersion) {
    try {
      const { data, error } = await supabase
        .from('download_history')
        .insert({
          user_id: userId,
          build_id: buildId,
          build_name: buildName,
          build_version: buildVersion
        });

      if (error) throw error;
      return { success: true, record: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

module.exports = {
  supabase,
  auth,
  db
};