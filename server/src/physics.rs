use glam::{Vec3, Quat};
use std::time::Duration;
use crate::state::GameState;
use crate::player::Player;

pub struct PhysicsEngine {
    gravity: Vec3,
}

impl PhysicsEngine {
    pub fn new() -> Self {
        Self {
            gravity: Vec3::new(0.0, -9.81, 0.0),
        }
    }

    pub fn step(&mut self, state: &mut GameState, delta_time: Duration) {
        let dt = delta_time.as_secs_f32();

        // Process each player's physics
        for player in state.players_mut() {
            self.simulate_player_physics(player, dt);
        }
    }

    fn simulate_player_physics(&self, player: &mut Player, dt: f32) {
        if !player.is_connected {
            return;
        }

        // Apply gravity if not grounded
        if !player.is_grounded {
            player.velocity += self.gravity * dt;
        }

        // Apply velocity to position
        player.position += player.velocity * dt;

        // Apply rotation
        // Quaternion multiplication for smooth rotation
        let rotation_delta = Quat::from_euler(
            glam::EulerRot::XYZ,
            player.angular_velocity.x * dt,
            player.angular_velocity.y * dt,
            player.angular_velocity.z * dt,
        );
        player.rotation = player.rotation * rotation_delta;

        // Apply friction
        if player.is_grounded {
            player.velocity.x *= 0.9;
            player.velocity.z *= 0.9;
        } else {
            player.velocity *= 0.98; // Air resistance
        }

        // Ground check (simple height check)
        if player.position.y <= 0.0 {
            player.position.y = 0.0;
            player.velocity.y = 0.0;
            player.is_grounded = true;
        } else {
            player.is_grounded = false;
        }

        // Clamp velocity to prevent extreme speeds
        let max_velocity = 100.0;
        let velocity_magnitude = player.velocity.length();
        if velocity_magnitude > max_velocity {
            player.velocity = player.velocity.normalize() * max_velocity;
        }
    }

    /// Deterministic physics - ensures same input produces same output
    pub fn apply_input_to_player(player: &mut Player, input: &crate::player::PlayerInput, dt: f32) {
        // Movement input (WASD)
        let move_speed = 10.0;
        let forward = player.rotation * Vec3::Z;
        let right = player.rotation * Vec3::X;

        let mut movement = Vec3::ZERO;
        if input.forward {
            movement += forward;
        }
        if input.backward {
            movement -= forward;
        }
        if input.right {
            movement += right;
        }
        if input.left {
            movement -= right;
        }

        // Normalize diagonal movement
        if movement.length() > 0.0 {
            movement = movement.normalize();
        }

        // Apply movement
        player.velocity.x = movement.x * move_speed;
        player.velocity.z = movement.z * move_speed;

        // Jump
        if input.jump && player.is_grounded {
            player.velocity.y = 5.0;
            player.is_grounded = false;
        }

        // Look rotation (mouse delta)
        player.angular_velocity.y = input.look_delta.x * 0.1;
        player.angular_velocity.x = input.look_delta.y * 0.1;
    }
}

impl Default for PhysicsEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_determinism() {
        let mut engine = PhysicsEngine::new();
        let mut player1 = Player::new(Uuid::new_v4(), "Player1".to_string());
        let mut player2 = Player::new(Uuid::new_v4(), "Player2".to_string());

        let input = crate::player::PlayerInput {
            forward: true,
            backward: false,
            left: false,
            right: false,
            jump: false,
            look_delta: Vec3::ZERO,
            tick: 0,
        };

        // Apply same input to both players
        PhysicsEngine::apply_input_to_player(&mut player1, &input, 0.016);
        PhysicsEngine::apply_input_to_player(&mut player2, &input, 0.016);

        // Simulate physics
        engine.simulate_player_physics(&mut player1, 0.016);
        engine.simulate_player_physics(&mut player2, 0.016);

        // Both players should have identical state
        assert_eq!(player1.position, player2.position);
        assert_eq!(player1.velocity, player2.velocity);
    }

    #[test]
    fn test_gravity() {
        let mut engine = PhysicsEngine::new();
        let mut player = Player::new(Uuid::new_v4(), "Player".to_string());
        
        player.position = Vec3::new(0.0, 10.0, 0.0);
        player.is_grounded = false;

        // Simulate 1 second of gravity
        for _ in 0..60 {
            engine.simulate_player_physics(&mut player, 1.0 / 60.0);
        }

        // Player should have fallen
        assert!(player.position.y < 10.0);
    }
}
