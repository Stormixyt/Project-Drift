-- Project Drift Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    CONSTRAINT valid_username CHECK (length(username) >= 3 AND length(username) <= 20),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Build metadata table
CREATE TABLE IF NOT EXISTS builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    season VARCHAR(50),
    download_url TEXT,
    file_size VARCHAR(20),
    checksum VARCHAR(64),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    is_public BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Player bans table
CREATE TABLE IF NOT EXISTS bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID REFERENCES users(id),
    reason TEXT NOT NULL,
    banned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    permanent BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE
);

-- Game events log
CREATE TABLE IF NOT EXISTS game_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    server_id VARCHAR(255),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_builds_uploaded_by ON builds(uploaded_by);
CREATE INDEX idx_builds_verified ON builds(verified, active);
CREATE INDEX idx_bans_user_id ON bans(user_id);
CREATE INDEX idx_bans_active ON bans(active);
CREATE INDEX idx_game_events_type ON game_events(event_type);
CREATE INDEX idx_game_events_user ON game_events(user_id);
CREATE INDEX idx_game_events_created_at ON game_events(created_at);

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION)
INSERT INTO users (username, email, password_hash, is_admin)
VALUES ('admin', 'admin@projectdrift.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLhJ45pK', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Sample builds (no download URLs - users must import)
INSERT INTO builds (name, version, season, file_size, is_public, verified)
VALUES 
    ('Fortnite Season 7', '7.40-CL-5046157', 'Season 7', '33 GB', TRUE, TRUE),
    ('Fortnite Season 8', '8.00-CL-5203069', 'Season 8', '34 GB', TRUE, TRUE),
    ('Fortnite Season 9', '9.00-CL-6005771', 'Season 9', '35 GB', TRUE, TRUE)
ON CONFLICT DO NOTHING;
