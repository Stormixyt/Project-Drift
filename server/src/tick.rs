use anyhow::Result;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time;
use tracing::{debug, warn};

use crate::config::ServerConfig;
use crate::state::GameState;
use crate::physics::PhysicsEngine;
use crate::snapshot::Snapshot;

pub async fn tick_loop(game_state: Arc<RwLock<GameState>>, config: ServerConfig) -> Result<()> {
    let tick_duration = Duration::from_secs_f64(1.0 / config.tick_rate as f64);
    let mut interval = time::interval(tick_duration);
    interval.set_missed_tick_behavior(time::MissedTickBehavior::Burst);

    let mut tick_number: u64 = 0;
    let mut physics_engine = PhysicsEngine::new();

    loop {
        let tick_start = Instant::now();

        // Wait for next tick
        interval.tick().await;

        // Process game tick
        {
            let mut state = game_state.write().await;
            
            // 1. Process all pending player inputs
            state.process_player_inputs();
            
            // 2. Run physics simulation
            physics_engine.step(&mut state, tick_duration);
            
            // 3. Update game logic
            state.update_game_logic(tick_number);
            
            // 4. Generate snapshot for clients
            let snapshot = Snapshot::create(&state, tick_number);
            
            // 5. Broadcast snapshot to all connected clients
            state.broadcast_snapshot(snapshot).await;
            
            // 6. Cleanup disconnected players
            state.cleanup_disconnected_players();
            
            tick_number += 1;
        }

        let tick_elapsed = tick_start.elapsed();
        
        // Warn if tick took longer than expected
        if tick_elapsed > tick_duration {
            warn!(
                "Tick {} took {:.2}ms (expected {:.2}ms)",
                tick_number,
                tick_elapsed.as_secs_f64() * 1000.0,
                tick_duration.as_secs_f64() * 1000.0
            );
        }

        // Debug every 60 ticks (1 second at 60Hz)
        if tick_number % 60 == 0 {
            let state = game_state.read().await;
            debug!(
                "Tick {}: {} players, {:.2}ms/tick",
                tick_number,
                state.player_count(),
                tick_elapsed.as_secs_f64() * 1000.0
            );
        }
    }
}
