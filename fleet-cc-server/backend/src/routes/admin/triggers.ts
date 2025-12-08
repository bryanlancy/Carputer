import express from 'express';
import { z } from 'zod';
import { TriggerService } from '../../services/trigger';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/authorize';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(requireAuth);
router.use(requireAdmin);

const createTriggerSchema = z.object({
  trigger_code: z.string().min(1),
  trigger_name: z.string().min(1),
  description: z.string().optional().nullable(),
  output_schema: z.any(),
  enabled: z.boolean().default(true),
});

const updateTriggerSchema = z.object({
  trigger_name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  output_schema: z.any().optional(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/admin/triggers
 * List all triggers
 */
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);

    const enabled = req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined;

    const triggers = await triggerService.getAllTriggers({ enabled });
    res.json(triggers);
  } catch (error: any) {
    console.error('Get triggers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/triggers/:triggerId
 * Get trigger by ID
 */
router.get('/:triggerId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);

    const triggerId = parseInt(req.params.triggerId);
    if (isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const trigger = await triggerService.getTriggerById(triggerId);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json(trigger);
  } catch (error: any) {
    console.error('Get trigger error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/triggers/code/:triggerCode
 * Get trigger by code
 */
router.get('/code/:triggerCode', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);

    const trigger = await triggerService.getTriggerByCode(req.params.triggerCode);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json(trigger);
  } catch (error: any) {
    console.error('Get trigger by code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/triggers
 * Create a new trigger
 */
router.post('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);

    const data = createTriggerSchema.parse(req.body);
    if (!data.output_schema) {
      return res.status(400).json({ error: 'output_schema is required' });
    }
    const trigger = await triggerService.createTrigger({
      ...data,
      description: data.description ?? undefined,
      output_schema: data.output_schema,
    });

    res.status(201).json(trigger);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Create trigger error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * PUT /api/admin/triggers/:triggerId
 * Update trigger
 */
router.put('/:triggerId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);

    const triggerId = parseInt(req.params.triggerId);
    if (isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const data = updateTriggerSchema.parse(req.body);
    const trigger = await triggerService.updateTrigger(triggerId, {
      ...data,
      description: data.description ?? undefined,
    });

    res.json(trigger);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Update trigger error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /api/admin/triggers/:triggerId
 * Delete trigger
 */
router.delete('/:triggerId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const triggerService = new TriggerService(prisma);

    const triggerId = parseInt(req.params.triggerId);
    if (isNaN(triggerId)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    await triggerService.deleteTrigger(triggerId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Delete trigger error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

export default router;


