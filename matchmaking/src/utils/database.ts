import { Pool } from 'pg';
import { createClient } from 'redis';
import { logger } from './logger';

// PostgreSQL connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://drift:drift@localhost:5432/drift',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

export async function connectDatabase(): Promise<void> {
  try {
    await pool.connect();
    logger.info('✅ PostgreSQL connected successfully');
  } catch (error) {
    logger.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
}

export async function connectRedis(): Promise<void> {
  try {
    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    await redisClient.connect();
    logger.info('✅ Redis connected successfully');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await pool.end();
  await redisClient.quit();
  logger.info('Database connections closed');
}
