import express from 'express';
import { z } from 'zod';

const router = express.Router();

// Device registration schema
const deviceRegistrationSchema = z.object({
  deviceId: z.string().min(1),
  hostname: z.string().optional(),
  vin: z.string().optional(),
  hardwareRev: z.string().optional(),
  buildId: z.string().optional(),
  registrationToken: z.string().min(1),
});

// Heartbeat schema
const heartbeatSchema = z.object({
  deviceId: z.string().min(1),
  version: z.string().optional(),
  buildId: z.string().optional(),
  uptime: z.number().optional(),
  ip: z.string().optional(),
  services: z.record(z.string(), z.boolean()).optional(),
});

// Register a new device
router.post('/register', async (req, res) => {
  try {
    const data = deviceRegistrationSchema.parse(req.body);

    // Validate registration token
    const expectedToken = process.env.DEVICE_REGISTRATION_TOKEN;
    if (!expectedToken || data.registrationToken !== expectedToken) {
      return res.status(401).json({ error: 'Invalid registration token' });
    }

    const db = req.db;

    // Check if device already exists
    const existingDevice = await db.query(
      'SELECT id FROM devices WHERE device_id = $1',
      [data.deviceId]
    );

    if (existingDevice.rows.length > 0) {
      return res.status(409).json({ error: 'Device already registered' });
    }

    // Insert new device
    const result = await db.query(
      `INSERT INTO devices (device_id, hostname, vin, hardware_rev, build_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'offline', NOW(), NOW())
       RETURNING *`,
      [data.deviceId, data.hostname || null, data.vin || null, data.hardwareRev || null, data.buildId || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat endpoint
router.post('/heartbeat', async (req, res) => {
  try {
    const data = heartbeatSchema.parse(req.body);
    const db = req.db;

    // Update device status
    await db.query(
      `UPDATE devices
       SET last_seen = NOW(),
           updated_at = NOW(),
           current_version = $1,
           current_build_id = $2,
           current_ip = $3,
           uptime = $4,
           services_status = $5,
           status = 'online'
       WHERE device_id = $6`,
      [
        data.version || null,
        data.buildId || null,
        data.ip || null,
        data.uptime || null,
        data.services ? JSON.stringify(data.services) : null,
        data.deviceId,
      ]
    );

    // Check for pending commands
    const commands = await db.query(
      `SELECT * FROM commands
       WHERE device_id = (SELECT id FROM devices WHERE device_id = $1)
       AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 10`,
      [data.deviceId]
    );

    res.json({
      status: 'ok',
      pendingCommands: commands.rows,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all devices
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const result = await db.query(
      `SELECT * FROM devices
       ORDER BY last_seen DESC NULLS LAST, created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get device by ID
router.get('/:deviceId', async (req, res) => {
  try {
    const db = req.db;
    const result = await db.query(
      `SELECT * FROM devices WHERE device_id = $1`,
      [req.params.deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

