use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};
use tracing_subscriber::EnvFilter;

mod config;
mod network;
mod tick;
mod physics;
mod anticheat;
mod state;
mod player;
mod snapshot;

use config::ServerConfig;
use state::GameState;
use network::NetworkServer;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_target(false)
        .with_thread_ids(true)
        .with_level(true)
        .init();

    info!("🎮 Project Drift - Authoritative Game Server");
    info!("Version: {}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let config = ServerConfig::load()?;
    info!("Server configuration loaded");
    info!("Tick rate: {} Hz", config.tick_rate);
    info!("Max players: {}", config.max_players);
    info!("Bind address: {}", config.bind_address);

    // Initialize game state
    let game_state = Arc::new(RwLock::new(GameState::new(config.clone())));
    info!("Game state initialized");

    // Initialize network server
    let network_server = NetworkServer::new(config.clone(), game_state.clone()).await?;
    info!("Network server initialized on {}", config.bind_address);

    // Start tick loop in background
    let tick_handle = {
        let game_state = game_state.clone();
        let config = config.clone();
        tokio::spawn(async move {
            if let Err(e) = tick::tick_loop(game_state, config).await {
                error!("Tick loop error: {}", e);
            }
        })
    };

    info!("✅ Server is ready to accept connections");

    // Run network server (blocking)
    tokio::select! {
        result = network_server.run() => {
            if let Err(e) = result {
                error!("Network server error: {}", e);
            }
        }
        result = tick_handle => {
            if let Err(e) = result {
                error!("Tick loop task error: {}", e);
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal");
        }
    }

    info!("Server shutting down...");
    Ok(())
}
