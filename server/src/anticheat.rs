use glam::Vec3;
use std::time::{Duration, Instant};
use tracing::warn;
use crate::player::{Player, PlayerInput};
use crate::config::ServerConfig;

pub struct AntiCheat {
    config: ServerConfig,
}

impl AntiCheat {
    pub fn new(config: ServerConfig) -> Self {
        Self { config }
    }

    /// Validate player input and detect cheating
    pub fn validate_input(&self, player: &mut Player, input: &PlayerInput) -> ValidationResult {
        if !self.config.enable_anticheat {
            return ValidationResult::Valid;
        }

        // Check input rate limiting
        if let Some(reason) = self.check_input_rate(player) {
            return ValidationResult::Invalid(reason);
        }

        // Check for velocity hacks
        if let Some(reason) = self.check_velocity(player) {
            return ValidationResult::Invalid(reason);
        }

        // Check for teleport hacks
        if let Some(reason) = self.check_teleport(player, input) {
            return ValidationResult::Invalid(reason);
        }

        // Check for impossible actions
        if let Some(reason) = self.check_impossible_actions(player, input) {
            return ValidationResult::Invalid(reason);
        }

        ValidationResult::Valid
    }

    fn check_input_rate(&self, player: &mut Player) -> Option<String> {
        let now = Instant::now();
        
        // Initialize if first input
        if player.last_input_time.is_none() {
            player.last_input_time = Some(now);
            player.input_count = 1;
            return None;
        }

        let last_input = player.last_input_time.unwrap();
        let elapsed = now.duration_since(last_input);

        // Reset counter every second
        if elapsed >= Duration::from_secs(1) {
            player.input_count = 1;
            player.last_input_time = Some(now);
            return None;
        }

        player.input_count += 1;

        // Check if exceeding rate limit
        if player.input_count > self.config.input_rate_limit {
            warn!(
                "Player {} exceeded input rate limit: {} inputs/sec",
                player.id, player.input_count
            );
            return Some(format!(
                "Input rate limit exceeded: {} > {}",
                player.input_count, self.config.input_rate_limit
            ));
        }

        None
    }

    fn check_velocity(&self, player: &Player) -> Option<String> {
        let velocity_magnitude = player.velocity.length();
        
        if velocity_magnitude > self.config.max_velocity {
            warn!(
                "Player {} has impossible velocity: {:.2} > {:.2}",
                player.id, velocity_magnitude, self.config.max_velocity
            );
            return Some(format!(
                "Velocity hack detected: {:.2} m/s",
                velocity_magnitude
            ));
        }

        None
    }

    fn check_teleport(&self, player: &Player, input: &PlayerInput) -> Option<String> {
        if let Some(last_pos) = player.last_validated_position {
            let distance = (player.position - last_pos).length();
            
            // Calculate maximum possible distance in one tick
            let max_distance = self.config.max_velocity / self.config.tick_rate as f32;
            
            if distance > self.config.max_teleport_distance || distance > max_distance * 2.0 {
                warn!(
                    "Player {} teleported {:.2} units (max: {:.2})",
                    player.id, distance, self.config.max_teleport_distance
                );
                return Some(format!(
                    "Teleport detected: {:.2} units",
                    distance
                ));
            }
        }

        None
    }

    fn check_impossible_actions(&self, player: &Player, input: &PlayerInput) -> Option<String> {
        // Can't jump while in air
        if input.jump && !player.is_grounded {
            warn!("Player {} attempted air jump", player.id);
            return Some("Cannot jump while airborne".to_string());
        }

        // Can't have contradictory inputs
        if input.forward && input.backward {
            return Some("Contradictory input: forward and backward".to_string());
        }

        if input.left && input.right {
            return Some("Contradictory input: left and right".to_string());
        }

        // Look delta sanity check (shouldn't exceed reasonable mouse movement)
        let max_look_delta = 100.0;
        if input.look_delta.length() > max_look_delta {
            warn!(
                "Player {} has impossible look delta: {:.2}",
                player.id,
                input.look_delta.length()
            );
            return Some("Impossible mouse movement detected".to_string());
        }

        None
    }

    pub fn update_validation_state(&self, player: &mut Player) {
        player.last_validated_position = Some(player.position);
        player.validation_failures = 0;
    }

    pub fn record_violation(&self, player: &mut Player, reason: String) {
        player.validation_failures += 1;
        player.last_violation = Some(reason.clone());

        warn!(
            "Player {} violation #{}: {}",
            player.id, player.validation_failures, reason
        );

        // Auto-kick after threshold
        if player.validation_failures >= 10 {
            warn!("Player {} kicked for repeated violations", player.id);
            player.is_connected = false;
        }
    }
}

pub enum ValidationResult {
    Valid,
    Invalid(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_velocity_check() {
        let config = ServerConfig::default();
        let anticheat = AntiCheat::new(config.clone());
        let mut player = Player::new(Uuid::new_v4(), "Cheater".to_string());

        // Set impossible velocity
        player.velocity = Vec3::new(200.0, 0.0, 0.0);

        let result = anticheat.check_velocity(&player);
        assert!(result.is_some());
    }

    #[test]
    fn test_teleport_check() {
        let config = ServerConfig::default();
        let anticheat = AntiCheat::new(config.clone());
        let mut player = Player::new(Uuid::new_v4(), "Teleporter".to_string());

        player.last_validated_position = Some(Vec3::ZERO);
        player.position = Vec3::new(100.0, 0.0, 0.0);

        let input = PlayerInput::default();
        let result = anticheat.check_teleport(&player, &input);
        assert!(result.is_some());
    }
}
