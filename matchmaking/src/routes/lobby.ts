import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Create lobby
router.post('/create', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, maxPlayers = 16, isPublic = true } = req.body;
    const userId = req.user.userId;

    const lobbyId = uuidv4();
    const lobby = {
      id: lobbyId,
      name,
      hostId: userId,
      maxPlayers,
      isPublic,
      players: [userId],
      createdAt: Date.now(),
      status: 'waiting',
    };

    // Store in Redis
    await redisClient.setEx(`lobby:${lobbyId}`, 3600, JSON.stringify(lobby));
    await redisClient.sAdd('lobbies:active', lobbyId);

    logger.info(`Lobby created: ${lobbyId} by user ${userId}`);

    res.status(201).json(lobby);
  } catch (error) {
    logger.error('Create lobby error:', error);
    res.status(500).json({ error: 'Failed to create lobby' });
  }
});

// List lobbies
router.get('/list', async (req: any, res: any) => {
  try {
    const lobbyIds = await redisClient.sMembers('lobbies:active');
    const lobbies = [];

    for (const id of lobbyIds) {
      const data = await redisClient.get(`lobby:${id}`);
      if (data) {
        lobbies.push(JSON.parse(data));
      }
    }

    // Filter public lobbies only
    const publicLobbies = lobbies.filter((l: any) => l.isPublic);

    res.json({ lobbies: publicLobbies });
  } catch (error) {
    logger.error('List lobbies error:', error);
    res.status(500).json({ error: 'Failed to list lobbies' });
  }
});

// Join lobby
router.post('/:lobbyId/join', authenticateToken, async (req: any, res: any) => {
  try {
    const { lobbyId } = req.params;
    const userId = req.user.userId;

    const data = await redisClient.get(`lobby:${lobbyId}`);
    if (!data) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const lobby = JSON.parse(data);

    if (lobby.players.length >= lobby.maxPlayers) {
      return res.status(400).json({ error: 'Lobby is full' });
    }

    if (lobby.players.includes(userId)) {
      return res.status(400).json({ error: 'Already in lobby' });
    }

    lobby.players.push(userId);
    await redisClient.setEx(`lobby:${lobbyId}`, 3600, JSON.stringify(lobby));

    logger.info(`User ${userId} joined lobby ${lobbyId}`);

    res.json(lobby);
  } catch (error) {
    logger.error('Join lobby error:', error);
    res.status(500).json({ error: 'Failed to join lobby' });
  }
});

// Leave lobby
router.post('/:lobbyId/leave', authenticateToken, async (req: any, res: any) => {
  try {
    const { lobbyId } = req.params;
    const userId = req.user.userId;

    const data = await redisClient.get(`lobby:${lobbyId}`);
    if (!data) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const lobby = JSON.parse(data);
    lobby.players = lobby.players.filter((id: string) => id !== userId);

    // Delete lobby if empty
    if (lobby.players.length === 0) {
      await redisClient.del(`lobby:${lobbyId}`);
      await redisClient.sRem('lobbies:active', lobbyId);
      logger.info(`Lobby ${lobbyId} deleted (empty)`);
    } else {
      await redisClient.setEx(`lobby:${lobbyId}`, 3600, JSON.stringify(lobby));
    }

    logger.info(`User ${userId} left lobby ${lobbyId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Leave lobby error:', error);
    res.status(500).json({ error: 'Failed to leave lobby' });
  }
});

export default router;
