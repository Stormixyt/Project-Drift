use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::net::SocketAddr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub tick_rate: u32,
    pub max_players: usize,
    pub bind_address: SocketAddr,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub max_velocity: f32,
    pub max_teleport_distance: f32,
    pub input_rate_limit: u32,
    pub enable_anticheat: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            tick_rate: 60,
            max_players: 100,
            bind_address: "0.0.0.0:7777".parse().unwrap(),
            database_url: "postgres://drift:drift@localhost/drift".to_string(),
            redis_url: "redis://localhost:6379".to_string(),
            jwt_secret: "CHANGE_ME_IN_PRODUCTION".to_string(),
            max_velocity: 100.0,
            max_teleport_distance: 50.0,
            input_rate_limit: 120, // inputs per second
            enable_anticheat: true,
        }
    }
}

impl ServerConfig {
    pub fn load() -> Result<Self> {
        dotenv::dotenv().ok();

        let config = Self {
            tick_rate: std::env::var("TICK_RATE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
            max_players: std::env::var("MAX_PLAYERS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(100),
            bind_address: std::env::var("BIND_ADDRESS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or_else(|| "0.0.0.0:7777".parse().unwrap()),
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://drift:drift@localhost/drift".to_string()),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "CHANGE_ME_IN_PRODUCTION".to_string()),
            max_velocity: std::env::var("MAX_VELOCITY")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(100.0),
            max_teleport_distance: std::env::var("MAX_TELEPORT_DISTANCE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(50.0),
            input_rate_limit: std::env::var("INPUT_RATE_LIMIT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(120),
            enable_anticheat: std::env::var("ENABLE_ANTICHEAT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(true),
        };

        Ok(config)
    }
}
