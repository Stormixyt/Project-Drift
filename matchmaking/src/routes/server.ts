import { Router } from 'express';
import { pool, redisClient } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Register a peer-hosted server (P2P matchmaking)
router.post('/register', async (req: any, res: any) => {
  try {
    const {
      serverName,
      hostName,
      ip,
      port,
      buildVersion,
      mode,
      ltmEnabled,
      eventEnabled,
      maxPlayers,
      isPrivate
    } = req.body;

    // Validate required fields
    if (!serverName || !buildVersion || !ip || !port) {
      return res.status(400).json({ error: 'Missing required fields: serverName, buildVersion, ip, port' });
    }

    // Generate server ID
    const serverId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Server data
    const serverData = {
      id: serverId,
      serverName,
      hostName: hostName || 'Unknown Host',
      ip,
      host: ip, // alias for compatibility
      port: parseInt(port),
      buildVersion,
      mode: mode || 'Battle Royale',
      ltmEnabled: ltmEnabled || false,
      eventEnabled: eventEnabled || false,
      maxPlayers: maxPlayers || 100,
      currentPlayers: 1, // Host counts as 1
      isPrivate: isPrivate || false,
      region: 'p2p',
      status: 'online',
      registeredAt: new Date().toISOString(),
      lastHeartbeat: Date.now()
    };

    // Store in Redis with 5 minute TTL (requires heartbeat to stay alive)
    await redisClient.setEx(`server:${serverId}`, 300, JSON.stringify(serverData));
    await redisClient.sAdd('servers:active', serverId);
    await redisClient.sAdd(`servers:version:${buildVersion}`, serverId);

    logger.info(`P2P Server registered: ${serverName} (${buildVersion}) at ${ip}:${port}`);

    res.json({
      success: true,
      serverId,
      message: 'Server registered successfully',
      heartbeatUrl: `/api/servers/heartbeat/${serverId}`
    });
  } catch (error) {
    logger.error('Register server error:', error);
    res.status(500).json({ error: 'Failed to register server' });
  }
});

// Heartbeat endpoint to keep server alive
router.post('/heartbeat/:serverId', async (req: any, res: any) => {
  try {
    const { serverId } = req.params;
    const { currentPlayers } = req.body;

    const data = await redisClient.get(`server:${serverId}`);
    if (!data) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const serverData = JSON.parse(data);
    serverData.lastHeartbeat = Date.now();
    if (currentPlayers !== undefined) {
      serverData.currentPlayers = currentPlayers;
    }

    // Refresh TTL to 5 minutes
    await redisClient.setEx(`server:${serverId}`, 300, JSON.stringify(serverData));

    res.json({ success: true });
  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

// Unregister server (when game closes)
router.post('/unregister/:serverId', async (req: any, res: any) => {
  try {
    const { serverId } = req.params;

    const data = await redisClient.get(`server:${serverId}`);
    if (data) {
      const serverData = JSON.parse(data);
      await redisClient.sRem(`servers:version:${serverData.buildVersion}`, serverId);
    }

    await redisClient.del(`server:${serverId}`);
    await redisClient.sRem('servers:active', serverId);

    logger.info(`Server unregistered: ${serverId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Unregister server error:', error);
    res.status(500).json({ error: 'Failed to unregister server' });
  }
});

// Get servers by build version
router.get('/version/:buildVersion', async (req: any, res: any) => {
  try {
    const { buildVersion } = req.params;
    const serverIds = await redisClient.sMembers(`servers:version:${buildVersion}`);
    const servers = [];

    for (const id of serverIds) {
      const data = await redisClient.get(`server:${id}`);
      if (data) {
        const server = JSON.parse(data);
        // Filter out private servers unless user has permission
        if (!server.isPrivate) {
          servers.push(server);
        }
      }
    }

    res.json({ servers, count: servers.length });
  } catch (error) {
    logger.error('Get servers by version error:', error);
    res.status(500).json({ error: 'Failed to get servers' });
  }
});

// Return first available server in a flat array format for launcher compatibility
router.get('/available', async (req: any, res: any) => {
  try {
    const serverIds = await redisClient.sMembers('servers:active');
    const servers: any[] = [];

    for (const id of serverIds) {
      const data = await redisClient.get(`server:${id}`);
      if (data) {
        const parsed = JSON.parse(data);
        servers.push({
          id: parsed.id || id,
          ip: parsed.ip || parsed.host || '127.0.0.1',
          host: parsed.host || parsed.ip || '127.0.0.1',
          port: parsed.port || 7777,
          region: parsed.region || 'local',
          players: parsed.players || 0,
          maxPlayers: parsed.maxPlayers || 100
        });
      }
    }

    // The launcher expects an array; may be empty
    res.json(servers);
  } catch (error) {
    logger.error('Available servers error:', error);
    res.status(500).json([]);
  }
});

// List game servers
router.get('/list', async (req: any, res: any) => {
  try {
    const serverIds = await redisClient.sMembers('servers:active');
    const servers = [];

    for (const id of serverIds) {
      const data = await redisClient.get(`server:${id}`);
      if (data) {
        servers.push(JSON.parse(data));
      }
    }

    res.json({ servers });
  } catch (error) {
    logger.error('List servers error:', error);
    res.status(500).json({ error: 'Failed to list servers' });
  }
});

// Get server details
router.get('/:serverId', async (req: any, res: any) => {
  try {
    const { serverId } = req.params;
    const data = await redisClient.get(`server:${serverId}`);

    if (!data) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(JSON.parse(data));
  } catch (error) {
    logger.error('Get server error:', error);
    res.status(500).json({ error: 'Failed to get server' });
  }
});

// Start server (admin only)
router.post('/start', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { lobbyId } = req.body;

    // TODO: Implement server spawning logic
    // This would typically spawn a game server process
    
    logger.info(`Server start requested for lobby ${lobbyId}`);

    res.json({ success: true, message: 'Server starting...' });
  } catch (error) {
    logger.error('Start server error:', error);
    res.status(500).json({ error: 'Failed to start server' });
  }
});

// Stop server (admin only)
router.post('/:serverId/stop', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { serverId } = req.params;

    // TODO: Implement server shutdown logic
    
    await redisClient.del(`server:${serverId}`);
    await redisClient.sRem('servers:active', serverId);

    logger.info(`Server ${serverId} stopped`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Stop server error:', error);
    res.status(500).json({ error: 'Failed to stop server' });
  }
});

// Kick player (admin only)
router.post('/:serverId/kick/:playerId', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { serverId, playerId } = req.params;

    // TODO: Implement kick logic via game server API

    logger.info(`Player ${playerId} kicked from server ${serverId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Kick player error:', error);
    res.status(500).json({ error: 'Failed to kick player' });
  }
});

export default router;
