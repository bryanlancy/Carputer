import express from 'express';
import { z } from 'zod';
import { NotificationRuleService } from '../../services/notificationRules';
import { NotificationService } from '../../services/notification';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/authorize';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/notifications/rules:
 *   get:
 *     summary: Get all notification rules (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter by enabled status
 *       - in: query
 *         name: trigger_type
 *         schema:
 *           type: string
 *           enum: [date_time, backend_event, user_driven]
 *         description: Filter by trigger type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of rules to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of rules to skip
 *     responses:
 *       200:
 *         description: List of notification rules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NotificationRule'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);
    const ruleService = new NotificationRuleService(prisma, notificationService);

    const enabled = req.query.enabled !== undefined
      ? req.query.enabled === 'true'
      : undefined;
    const triggerType = req.query.trigger_type as string | undefined;

    const rules = await ruleService.getAllRules({
      enabled,
      trigger_type: triggerType,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    });

    res.json(rules);
  } catch (error) {
    console.error('Get notification rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/rules:
 *   post:
 *     summary: Create notification rule (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - trigger_type
 *               - notification_type_code
 *             properties:
 *               name:
 *                 type: string
 *                 description: Rule name
 *               description:
 *                 type: string
 *                 description: Optional rule description
 *               trigger_type:
 *                 type: string
 *                 enum: [date_time, backend_event, user_driven]
 *                 description: Type of trigger for the rule
 *               trigger_config:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Trigger-specific configuration
 *                 default: {}
 *               notification_type_code:
 *                 type: string
 *                 description: Code of the notification type to trigger
 *               target_users:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Array of user IDs to target (null for all users)
 *               target_roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Array of role names to target (null for all roles)
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the rule is enabled
 *               priority:
 *                 type: integer
 *                 default: 0
 *                 description: Rule priority (higher numbers execute first)
 *     responses:
 *       201:
 *         description: Notification rule created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationRule'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
const createRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  trigger_type: z.enum(['date_time', 'backend_event', 'user_driven']),
  trigger_config: z.any().optional().default({}),
  notification_type_code: z.string().min(1),
  target_users: z.array(z.string()).optional().nullable(),
  target_roles: z.array(z.string()).optional().nullable(),
  message_template: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
});

router.post('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);
    const ruleService = new NotificationRuleService(prisma, notificationService);

    const data = createRuleSchema.parse(req.body);
    // Ensure trigger_config is always provided
    const ruleData = {
      ...data,
      trigger_config: data.trigger_config || {},
      description: data.description ?? undefined,
      message_template: data.message_template ?? undefined,
    };

    const rule = await ruleService.createRule(ruleData);

    res.status(201).json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      res.status(400).json({
        error: 'Validation error',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }))
      });
      return;
    }
    console.error('Create notification rule error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/admin/notifications/rules/{ruleId}:
 *   get:
 *     summary: Get notification rule by ID (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     responses:
 *       200:
 *         description: Notification rule details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationRule'
 *       400:
 *         description: Invalid rule ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 *       500:
 *         description: Internal server error
 */
router.get('/:ruleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);
    const ruleService = new NotificationRuleService(prisma, notificationService);

    const ruleId = parseInt(req.params.ruleId, 10);

    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const rule = await ruleService.getRuleById(ruleId);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Get notification rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/rules/{ruleId}:
 *   put:
 *     summary: Update notification rule (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Rule name
 *               description:
 *                 type: string
 *                 description: Optional rule description
 *               trigger_type:
 *                 type: string
 *                 enum: [date_time, backend_event, user_driven]
 *                 description: Type of trigger for the rule
 *               trigger_config:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Trigger-specific configuration
 *               notification_type_code:
 *                 type: string
 *                 description: Code of the notification type to trigger
 *               target_users:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Array of user IDs to target (null for all users)
 *               target_roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Array of role names to target (null for all roles)
 *               enabled:
 *                 type: boolean
 *                 description: Whether the rule is enabled
 *               priority:
 *                 type: integer
 *                 description: Rule priority (higher numbers execute first)
 *     responses:
 *       200:
 *         description: Notification rule updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationRule'
 *       400:
 *         description: Validation error or invalid rule ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 *       500:
 *         description: Internal server error
 */
const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  trigger_type: z.enum(['date_time', 'backend_event', 'user_driven']).optional(),
  trigger_config: z.any().optional(),
  notification_type_code: z.string().min(1).optional(),
  target_users: z.array(z.string()).optional().nullable(),
  target_roles: z.array(z.string()).optional().nullable(),
  message_template: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

router.put('/:ruleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);
    const ruleService = new NotificationRuleService(prisma, notificationService);

    const ruleId = parseInt(req.params.ruleId, 10);

    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const data = updateRuleSchema.parse(req.body);

    const rule = await ruleService.updateRule(ruleId, {
      ...data,
      description: data.description ?? undefined,
    });

    res.json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update notification rule error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/rules/{ruleId}:
 *   delete:
 *     summary: Delete notification rule (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     responses:
 *       200:
 *         description: Rule deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid rule ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:ruleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);
    const ruleService = new NotificationRuleService(prisma, notificationService);

    const ruleId = parseInt(req.params.ruleId, 10);

    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    await ruleService.deleteRule(ruleId);

    res.json({ message: 'Rule deleted' });
  } catch (error: any) {
    console.error('Delete notification rule error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/rules/{ruleId}/execute:
 *   post:
 *     summary: Manually execute a notification rule (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Rule ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Optional device ID for context
 *               title:
 *                 type: string
 *                 description: Optional custom title
 *               message:
 *                 type: string
 *                 description: Optional custom message
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Optional metadata
 *     responses:
 *       200:
 *         description: Notification created and sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid rule ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Rule not found
 *       500:
 *         description: Internal server error
 */
router.post('/:ruleId/execute', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);
    const ruleService = new NotificationRuleService(prisma, notificationService);

    const ruleId = parseInt(req.params.ruleId, 10);

    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const notification = await ruleService.executeRule(ruleId, {
      deviceId: req.body.deviceId,
      title: req.body.title,
      message: req.body.message,
      metadata: req.body.metadata,
    });

    res.json(notification);
  } catch (error: any) {
    console.error('Execute notification rule error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

