import express from 'express';
import { z } from 'zod';

const router = express.Router();

// Command creation schema
const commandSchema = z.object({
  deviceId: z.string().min(1),
  command: z.enum(['reboot', 'start_service', 'stop_service', 'trigger_rsync', 'collect_logs', 'update']),
  parameters: z.record(z.any()).optional(),
});

// Command status update schema
const commandStatusSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  result: z.any().optional(),
  error: z.string().optional(),
});

// Create a new command
router.post('/', async (req, res) => {
  try {
    const data = commandSchema.parse(req.body);
    const db = req.db;

    // Get device ID from device_id
    const deviceResult = await db.query(
      'SELECT id FROM devices WHERE device_id = $1',
      [data.deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const deviceDbId = deviceResult.rows[0].id;

    // Insert command
    const result = await db.query(
      `INSERT INTO commands (device_id, command, parameters, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING *`,
      [deviceDbId, data.command, data.parameters ? JSON.stringify(data.parameters) : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create command error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update command status (called by device)
router.patch('/:commandId/status', async (req, res) => {
  try {
    const { commandId } = req.params;
    const data = commandStatusSchema.parse(req.body);
    const db = req.db;

    const result = await db.query(
      `UPDATE commands
       SET status = $1,
           result = $2,
           error = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        data.status,
        data.result ? JSON.stringify(data.result) : null,
        data.error || null,
        commandId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Command not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update command status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get commands for a device
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const db = req.db;

    // Get device ID from device_id
    const deviceResult = await db.query(
      'SELECT id FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const deviceDbId = deviceResult.rows[0].id;

    const result = await db.query(
      `SELECT * FROM commands
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [deviceDbId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get commands error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get command by ID
router.get('/:commandId', async (req, res) => {
  try {
    const { commandId } = req.params;
    const db = req.db;

    const result = await db.query(
      'SELECT * FROM commands WHERE id = $1',
      [commandId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get command error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

