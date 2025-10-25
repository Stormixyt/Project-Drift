use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use quinn::{Endpoint, ServerConfig as QuinnConfig};
use tracing::{info, error};

use crate::config::ServerConfig;
use crate::state::GameState;

pub struct NetworkServer {
    config: ServerConfig,
    game_state: Arc<RwLock<GameState>>,
    endpoint: Endpoint,
}

impl NetworkServer {
    pub async fn new(config: ServerConfig, game_state: Arc<RwLock<GameState>>) -> Result<Self> {
        // Configure QUIC endpoint
        let server_config = configure_server()?;
        let endpoint = Endpoint::server(server_config, config.bind_address)?;

        info!("QUIC endpoint bound to {}", config.bind_address);

        Ok(Self {
            config,
            game_state,
            endpoint,
        })
    }

    pub async fn run(self) -> Result<()> {
        info!("Network server listening for connections...");

        while let Some(connecting) = self.endpoint.accept().await {
            let game_state = self.game_state.clone();
            let config = self.config.clone();

            tokio::spawn(async move {
                if let Err(e) = handle_connection(connecting, game_state, config).await {
                    error!("Connection error: {}", e);
                }
            });
        }

        Ok(())
    }
}

fn configure_server() -> Result<QuinnConfig> {
    // For development, use self-signed certificate
    // In production, use proper TLS certificates
    let cert = rcgen::generate_simple_self_signed(vec!["localhost".into()])?;
    let cert_der = cert.serialize_der()?;
    let priv_key = cert.serialize_private_key_der();

    let mut server_config = QuinnConfig::with_single_cert(
        vec![rustls::Certificate(cert_der)],
        rustls::PrivateKey(priv_key),
    )?;

    let transport_config = Arc::get_mut(&mut server_config.transport)
        .unwrap();
    
    transport_config.max_concurrent_uni_streams(0_u8.into());
    transport_config.max_concurrent_bidi_streams(100_u8.into());

    Ok(server_config)
}

async fn handle_connection(
    connecting: quinn::Connecting,
    game_state: Arc<RwLock<GameState>>,
    config: ServerConfig,
) -> Result<()> {
    let connection = connecting.await?;
    let remote_addr = connection.remote_address();
    
    info!("New connection from {}", remote_addr);

    // Accept bidirectional stream
    loop {
        tokio::select! {
            stream = connection.accept_bi() => {
                match stream {
                    Ok((send, recv)) => {
                        let game_state = game_state.clone();
                        tokio::spawn(async move {
                            if let Err(e) = handle_stream(send, recv, game_state).await {
                                error!("Stream error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        error!("Failed to accept stream: {}", e);
                        break;
                    }
                }
            }
        }
    }

    info!("Connection from {} closed", remote_addr);
    Ok(())
}

async fn handle_stream(
    mut send: quinn::SendStream,
    mut recv: quinn::RecvStream,
    game_state: Arc<RwLock<GameState>>,
) -> Result<()> {
    // TODO: Implement protocol for receiving inputs and sending snapshots
    // This is a simplified placeholder
    Ok(())
}
