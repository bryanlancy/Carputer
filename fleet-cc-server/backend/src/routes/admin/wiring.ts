import express from 'express';
import { z } from 'zod';
import { WiringService } from '../../services/wiring';
import { TriggerService } from '../../services/trigger';
import { EventService } from '../../services/event';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/authorize';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(requireAuth);
router.use(requireAdmin);

const saveWiringSchema = z.object({
  nodes: z.any(),
  edges: z.any(),
  viewport: z.any().optional(),
});

const createConnectionSchema = z.object({
  trigger_id: z.number().int(),
  event_id: z.number().int(),
  connection_config: z.any().optional(),
  enabled: z.boolean().default(true),
});

const validateConnectionSchema = z.object({
  trigger_id: z.number().int(),
  event_id: z.number().int(),
});

/**
 * GET /api/admin/wiring/:ruleId
 * Get wiring configuration for a rule
 */
router.get('/:ruleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);
    const eventService = new EventService(prisma);
    const wiringService = new WiringService(prisma, triggerService, eventService);

    const ruleId = parseInt(req.params.ruleId);
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const wiring = await wiringService.getWiringConfiguration(ruleId);
    const connections = await wiringService.getConnectionsForRule(ruleId);

    res.json({
      wiring: wiring || null,
      connections,
    });
  } catch (error: any) {
    console.error('Get wiring configuration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/wiring/:ruleId
 * Save wiring configuration for a rule
 */
router.post('/:ruleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);
    const eventService = new EventService(prisma);
    const wiringService = new WiringService(prisma, triggerService, eventService);

    const ruleId = parseInt(req.params.ruleId);
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const data = saveWiringSchema.parse(req.body);
    const wiring = await wiringService.saveWiringConfiguration(ruleId, data);

    res.json(wiring);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Save wiring configuration error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/admin/wiring/:ruleId/connections
 * Create a trigger-event connection
 */
router.post('/:ruleId/connections', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);
    const eventService = new EventService(prisma);
    const wiringService = new WiringService(prisma, triggerService, eventService);

    const ruleId = parseInt(req.params.ruleId);
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const data = createConnectionSchema.parse(req.body);
    const connection = await wiringService.createConnection(ruleId, data);

    res.status(201).json(connection);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create connection error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * PUT /api/admin/wiring/connections/:connectionId
 * Update a connection
 */
router.put('/connections/:connectionId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);
    const eventService = new EventService(prisma);
    const wiringService = new WiringService(prisma, triggerService, eventService);

    const connectionId = parseInt(req.params.connectionId);
    if (isNaN(connectionId)) {
      return res.status(400).json({ error: 'Invalid connection ID' });
    }

    const data = z.object({
      connection_config: z.any().optional(),
      enabled: z.boolean().optional(),
    }).parse(req.body);

    const connection = await wiringService.updateConnection(connectionId, data);
    res.json(connection);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Update connection error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /api/admin/wiring/connections/:connectionId
 * Delete a connection
 */
router.delete('/connections/:connectionId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);
    const eventService = new EventService(prisma);
    const wiringService = new WiringService(prisma, triggerService, eventService);

    const connectionId = parseInt(req.params.connectionId);
    if (isNaN(connectionId)) {
      return res.status(400).json({ error: 'Invalid connection ID' });
    }

    await wiringService.deleteConnection(connectionId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Delete connection error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/admin/wiring/validate
 * Validate a trigger-to-event connection
 */
router.post('/validate', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);
    const eventService = new EventService(prisma);
    const wiringService = new WiringService(prisma, triggerService, eventService);

    const data = validateConnectionSchema.parse(req.body);

    const trigger = await triggerService.getTriggerById(data.trigger_id);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    const event = await eventService.getEventById(data.event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const validation = wiringService.validateConnection(trigger, event);
    res.json(validation);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Validate connection error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

export default router;

