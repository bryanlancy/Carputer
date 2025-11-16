import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check database connection
    const db = req.db as Pool;
    await db.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

