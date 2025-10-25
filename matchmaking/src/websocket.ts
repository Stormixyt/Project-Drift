import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { redisClient } from './utils/database';
import { logger } from './utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export function setupWebSocket(io: Server) {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`WebSocket connected: ${socket.username} (${socket.userId})`);

    // Join lobby room
    socket.on('lobby:join', async (lobbyId: string) => {
      try {
        const data = await redisClient.get(`lobby:${lobbyId}`);
        if (!data) {
          return socket.emit('error', { message: 'Lobby not found' });
        }

        await socket.join(`lobby:${lobbyId}`);
        
        // Notify others in lobby
        socket.to(`lobby:${lobbyId}`).emit('player:joined', {
          userId: socket.userId,
          username: socket.username,
        });

        logger.info(`${socket.username} joined lobby ${lobbyId} via WebSocket`);
      } catch (error) {
        logger.error('Lobby join error:', error);
        socket.emit('error', { message: 'Failed to join lobby' });
      }
    });

    // Leave lobby room
    socket.on('lobby:leave', async (lobbyId: string) => {
      await socket.leave(`lobby:${lobbyId}`);
      
      socket.to(`lobby:${lobbyId}`).emit('player:left', {
        userId: socket.userId,
        username: socket.username,
      });

      logger.info(`${socket.username} left lobby ${lobbyId}`);
    });

    // Chat message
    socket.on('chat:message', async (data: { lobbyId: string; message: string }) => {
      const { lobbyId, message } = data;

      // Broadcast to lobby
      io.to(`lobby:${lobbyId}`).emit('chat:message', {
        userId: socket.userId,
        username: socket.username,
        message,
        timestamp: Date.now(),
      });
    });

    // Player ready status
    socket.on('player:ready', async (data: { lobbyId: string; ready: boolean }) => {
      const { lobbyId, ready } = data;

      io.to(`lobby:${lobbyId}`).emit('player:ready', {
        userId: socket.userId,
        ready,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`WebSocket disconnected: ${socket.username}`);
    });
  });

  logger.info('✅ WebSocket server initialized');
}
