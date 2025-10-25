use serde::{Deserialize, Serialize};
use glam::{Vec3, Quat};
use uuid::Uuid;
use crate::state::GameState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub tick: u64,
    pub timestamp: u64,
    pub players: Vec<PlayerSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerSnapshot {
    pub id: Uuid,
    pub position: Vec3,
    pub rotation: Quat,
    pub velocity: Vec3,
    pub is_grounded: bool,
}

impl Snapshot {
    pub fn create(state: &GameState, tick: u64) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let players = state
            .players()
            .filter(|p| p.is_connected)
            .map(|p| PlayerSnapshot {
                id: p.id,
                position: p.position,
                rotation: p.rotation,
                velocity: p.velocity,
                is_grounded: p.is_grounded,
            })
            .collect();

        Self {
            tick,
            timestamp,
            players,
        }
    }

    pub fn serialize(&self) -> Vec<u8> {
        bincode::serialize(self).unwrap()
    }

    pub fn deserialize(data: &[u8]) -> Result<Self, bincode::Error> {
        bincode::deserialize(data)
    }
}
