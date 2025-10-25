use glam::{Vec3, Quat};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub position: Vec3,
    pub rotation: Quat,
    pub velocity: Vec3,
    pub angular_velocity: Vec3,
    pub is_grounded: bool,
    pub is_connected: bool,
    
    // Anti-cheat state
    pub last_validated_position: Option<Vec3>,
    pub last_input_time: Option<Instant>,
    pub input_count: u32,
    pub validation_failures: u32,
    pub last_violation: Option<String>,
    
    // Networking
    pub last_ack_tick: u64,
    pub pending_inputs: Vec<PlayerInput>,
}

impl Player {
    pub fn new(id: Uuid, name: String) -> Self {
        Self {
            id,
            name,
            position: Vec3::ZERO,
            rotation: Quat::IDENTITY,
            velocity: Vec3::ZERO,
            angular_velocity: Vec3::ZERO,
            is_grounded: true,
            is_connected: true,
            last_validated_position: None,
            last_input_time: None,
            input_count: 0,
            validation_failures: 0,
            last_violation: None,
            last_ack_tick: 0,
            pending_inputs: Vec::new(),
        }
    }

    pub fn disconnect(&mut self) {
        self.is_connected = false;
    }

    pub fn add_input(&mut self, input: PlayerInput) {
        self.pending_inputs.push(input);
    }

    pub fn take_pending_inputs(&mut self) -> Vec<PlayerInput> {
        std::mem::take(&mut self.pending_inputs)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerInput {
    pub forward: bool,
    pub backward: bool,
    pub left: bool,
    pub right: bool,
    pub jump: bool,
    pub look_delta: Vec3,
    pub tick: u64,
}

impl PlayerInput {
    pub fn new(tick: u64) -> Self {
        Self {
            tick,
            ..Default::default()
        }
    }
}
