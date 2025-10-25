use std::collections::HashMap;
use uuid::Uuid;
use crate::config::ServerConfig;
use crate::player::{Player, PlayerInput};
use crate::snapshot::Snapshot;
use crate::anticheat::{AntiCheat, ValidationResult};
use crate::physics::PhysicsEngine;

pub struct GameState {
    pub players: HashMap<Uuid, Player>,
    pub config: ServerConfig,
    pub anticheat: AntiCheat,
    pub current_tick: u64,
}

impl GameState {
    pub fn new(config: ServerConfig) -> Self {
        let anticheat = AntiCheat::new(config.clone());
        
        Self {
            players: HashMap::new(),
            config,
            anticheat,
            current_tick: 0,
        }
    }

    pub fn add_player(&mut self, player: Player) {
        self.players.insert(player.id, player);
    }

    pub fn remove_player(&mut self, player_id: &Uuid) {
        self.players.remove(player_id);
    }

    pub fn get_player(&self, player_id: &Uuid) -> Option<&Player> {
        self.players.get(player_id)
    }

    pub fn get_player_mut(&mut self, player_id: &Uuid) -> Option<&mut Player> {
        self.players.get_mut(player_id)
    }

    pub fn players(&self) -> impl Iterator<Item = &Player> {
        self.players.values()
    }

    pub fn players_mut(&mut self) -> impl Iterator<Item = &mut Player> {
        self.players.values_mut()
    }

    pub fn player_count(&self) -> usize {
        self.players.len()
    }

    pub fn process_player_inputs(&mut self) {
        let dt = 1.0 / self.config.tick_rate as f32;

        for player in self.players.values_mut() {
            let inputs = player.take_pending_inputs();
            
            for input in inputs {
                // Validate input with anti-cheat
                match self.anticheat.validate_input(player, &input) {
                    ValidationResult::Valid => {
                        // Apply input to player
                        PhysicsEngine::apply_input_to_player(player, &input, dt);
                        self.anticheat.update_validation_state(player);
                    }
                    ValidationResult::Invalid(reason) => {
                        self.anticheat.record_violation(player, reason);
                    }
                }
            }
        }
    }

    pub fn update_game_logic(&mut self, tick: u64) {
        self.current_tick = tick;
        // Add game-specific logic here (scoring, objectives, etc.)
    }

    pub async fn broadcast_snapshot(&self, snapshot: Snapshot) {
        // Broadcast to all connected players
        // This will be implemented in network.rs
    }

    pub fn cleanup_disconnected_players(&mut self) {
        self.players.retain(|_, player| player.is_connected);
    }
}
