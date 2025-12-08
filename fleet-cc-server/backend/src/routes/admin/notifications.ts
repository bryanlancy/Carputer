import express from 'express';
import { z } from 'zod';
import { NotificationService } from '../../services/notification';
import { NotificationRuleService } from '../../services/notificationRules';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/authorize';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/notifications/types:
 *   get:
 *     summary: Get all notification types (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notification types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NotificationType'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/types', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);

    const types = await prisma.notificationType.findMany({
      orderBy: {
        type_code: 'asc',
      },
    });

    res.json(types);
  } catch (error) {
    console.error('Get notification types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/types:
 *   post:
 *     summary: Create notification type (admin)
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
 *               - type_code
 *               - type_name
 *             properties:
 *               type_code:
 *                 type: string
 *                 description: Unique code for the notification type
 *               type_name:
 *                 type: string
 *                 description: Display name for the notification type
 *               description:
 *                 type: string
 *                 description: Optional description
 *               severity:
 *                 type: string
 *                 enum: [info, warning, error, critical]
 *                 default: info
 *                 description: Severity level
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the notification type is enabled
 *     responses:
 *       200:
 *         description: Notification type created or retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationType'
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
const createTypeSchema = z.object({
  type_code: z.string().min(1),
  type_name: z.string().min(1),
  description: z.string().optional().nullable(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('info'),
  enabled: z.boolean().default(true),
});

router.post('/types', async (req, res) => {
  try {
    const prisma = req.prisma;
    const notificationService = new NotificationService(prisma);

    const data = createTypeSchema.parse(req.body);

    const type = await notificationService.getOrCreateNotificationType(
      data.type_code,
      {
        typeName: data.type_name,
        description: data.description ?? undefined,
        severity: data.severity,
        enabled: data.enabled,
      }
    );

    res.json(type);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create notification type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/types/{typeCode}:
 *   put:
 *     summary: Update notification type (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: typeCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification type code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type_name:
 *                 type: string
 *                 description: Display name for the notification type
 *               description:
 *                 type: string
 *                 description: Optional description
 *               severity:
 *                 type: string
 *                 enum: [info, warning, error, critical]
 *                 description: Severity level
 *               enabled:
 *                 type: boolean
 *                 description: Whether the notification type is enabled
 *     responses:
 *       200:
 *         description: Notification type updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationType'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification type not found
 *       500:
 *         description: Internal server error
 */
const updateTypeSchema = z.object({
  type_name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  enabled: z.boolean().optional(),
});

router.put('/types/:typeCode', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { typeCode } = req.params;
    const data = updateTypeSchema.parse(req.body);

    const type = await prisma.notificationType.update({
      where: { type_code: typeCode },
      data: {
        ...(data.type_name && { type_name: data.type_name }),
        ...(data.description !== undefined && { description: data.description ?? null }),
        ...(data.severity && { severity: data.severity }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });

    res.json(type);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update notification type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/types/{typeCode}:
 *   delete:
 *     summary: Delete notification type (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: typeCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification type code
 *     responses:
 *       200:
 *         description: Notification type deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification type not found
 *       500:
 *         description: Internal server error
 */
router.delete('/types/:typeCode', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { typeCode } = req.params;

    await prisma.notificationType.delete({
      where: { type_code: typeCode },
    });

    res.json({ message: 'Notification type deleted' });
  } catch (error: any) {
    console.error('Delete notification type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/admin/notifications/preferences:
 *   get:
 *     summary: Get all user notification preferences (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       full_name:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/preferences', async (req, res) => {
  try {
    const prisma = req.prisma;

    const preferences = await prisma.userNotificationPreferences.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
    });

    res.json(preferences);
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

