import express from 'express';

const router = express.Router();

// Get fleet overview metrics
router.get('/overview', async (req, res) => {
  try {
    const db = req.db;

    // Get device counts by status
    const statusCounts = await db.query(
      `SELECT status, COUNT(*) as count
       FROM devices
       GROUP BY status`
    );

    // Get version distribution
    const versionDistribution = await db.query(
      `SELECT current_build_id, COUNT(*) as count
       FROM devices
       WHERE current_build_id IS NOT NULL
       GROUP BY current_build_id
       ORDER BY count DESC`
    );

    // Get command statistics
    const commandStats = await db.query(
      `SELECT status, COUNT(*) as count
       FROM commands
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY status`
    );

    // Get recent activity
    const recentActivity = await db.query(
      `SELECT COUNT(*) as count
       FROM devices
       WHERE last_seen > NOW() - INTERVAL '15 minutes'`
    );

    res.json({
      devices: {
        byStatus: statusCounts.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>),
        online: parseInt(recentActivity.rows[0]?.count || '0'),
      },
      versions: versionDistribution.rows,
      commands: {
        last24h: commandStats.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

