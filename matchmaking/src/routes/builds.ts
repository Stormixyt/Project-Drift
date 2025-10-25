import { Router, Request, Response } from 'express';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Get all public builds
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name, version, season, download_url, file_size, is_public, created_at FROM builds WHERE is_public = true ORDER BY created_at DESC'
    );

    const builds = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      season: row.season,
      downloadUrl: row.download_url,
      size: row.file_size,
      public: row.is_public,
      createdAt: row.created_at,
    }));

    res.json({ success: true, builds });
  } catch (error) {
    logger.error('Failed to fetch builds:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch builds' });
  }
});

// Get build by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, version, season, download_url, file_size, is_public, created_at FROM builds WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Build not found' });
    }

    const row = result.rows[0];
    const build = {
      id: row.id,
      name: row.name,
      version: row.version,
      season: row.season,
      downloadUrl: row.download_url,
      size: row.file_size,
      public: row.is_public,
      createdAt: row.created_at,
    };

    res.json({ success: true, build });
  } catch (error) {
    logger.error('Failed to fetch build:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch build' });
  }
});

export default router;
