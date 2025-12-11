import express from 'express'
import { z } from 'zod'
import { NotificationService } from '../../services/notification'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'
import { broadcastNotificationToUser } from '../realtime'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(requireAuth)
router.use(requireAdmin)

/**
 * @swagger
 * /api/admin/notifications:
 *   get:
 *     summary: Get all notifications (admin)
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
router.get('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const types = await prisma.notification.findMany({
			orderBy: {
				name: 'asc',
			},
		})

		res.json(types)
	} catch (error) {
		console.error('Get notification types error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

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
		const prisma = req.prisma

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
		})

		res.json(preferences)
	} catch (error) {
		console.error('Get notification preferences error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/notifications:
 *   post:
 *     summary: Create notification (admin)
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
	name: z.string().min(1),
	description: z.string().optional().nullable(),
	enabled: z.boolean().default(true),
	notification_type: z
		.enum(['warning', 'alert', 'default', 'success'])
		.default('default'),
	target_users: z.any().optional().nullable(),
	message_template: z.string().optional().nullable(),
	priority: z.number().default(0),
	variable_schema: z.any().optional().nullable(),
	show_in_feed: z.boolean().default(true),
	show_popup: z.boolean().default(false),
})

router.post('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const data = createTypeSchema.parse(req.body)

		// Create notification with all fields
		const type = await prisma.notification.create({
			data: {
				name: data.name,
				description: data.description ?? null,
				enabled: data.enabled,
				notification_type: data.notification_type || 'default',
				target_users: data.target_users ?? null,
				message_template: data.message_template ?? null,
				priority: data.priority ?? 0,
				variable_schema: data.variable_schema ?? null,
				show_in_feed: data.show_in_feed ?? true,
				show_popup: data.show_popup ?? false,
			},
		})

		res.json(type)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
			return
		}
		console.error('Create notification type error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/notifications/{id}:
 *   put:
 *     summary: Update notification (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name for the notification type
 *               description:
 *                 type: string
 *                 description: Optional description
 *               enabled:
 *                 type: boolean
 *                 description: Whether the notification type is enabled
 *               priority:
 *                 type: integer
 *                 description: Priority level
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
/**
 * @swagger
 * /api/admin/notifications/{id}/test:
 *   post:
 *     summary: Test notification (admin)
 *     description: Creates a test notification for the current user with fake data. The notification will appear in the user's feed.
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Test notification created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 notification:
 *                   type: object
 *                 rendered_message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/test', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)
		const { id } = req.params
		const userId = req.user?.id

		if (!userId) {
			return res.status(401).json({ error: 'User not authenticated' })
		}

		const notificationId = parseInt(id)
		if (isNaN(notificationId)) {
			return res.status(400).json({ error: 'Invalid notification ID' })
		}

		// Create test notification for current user only
		const testNotification =
			await notificationService.createTestNotificationForUser(
			userId,
			notificationId
		)

		// Broadcast notification via WebSocket to the user
		try {
			broadcastNotificationToUser(userId, {
				type: 'notification',
				notification: {
					id: testNotification.id,
					notification_id: testNotification.notification_id,
					name: testNotification.notification.name,
					message: testNotification.rendered_message,
					notification_type:
						testNotification.notification.notification_type,
					viewed: testNotification.viewed,
					viewed_at: testNotification.viewed_at,
					created_at: testNotification.created_at,
					tags: testNotification.tags,
					show_popup: testNotification.notification.show_popup,
				},
				timestamp: new Date().toISOString(),
			})
		} catch (wsError) {
			// Log but don't fail the request if WebSocket broadcast fails
			console.error(
				'Failed to broadcast test notification via WebSocket:',
				wsError
			)
		}

		res.json(testNotification)
	} catch (error: any) {
		if (error.message?.includes('not found')) {
			return res.status(404).json({ error: error.message })
		}
		if (error.message?.includes('disabled')) {
			return res.status(400).json({ error: error.message })
		}
		console.error('Test notification error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

const updateTypeSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional().nullable(),
	enabled: z.boolean().optional(),
	notification_type: z
		.enum(['warning', 'alert', 'default', 'success'])
		.optional(),
	target_users: z.any().optional().nullable(),
	message_template: z.string().optional().nullable(),
	priority: z.number().optional(),
	variable_schema: z.any().optional().nullable(),
	show_in_feed: z.boolean().optional(),
	show_popup: z.boolean().optional(),
})

router.put('/:id', async (req, res) => {
	try {
		const prisma = req.prisma
		const { id } = req.params
		const data = updateTypeSchema.parse(req.body)

		// Check if notification exists
		const existing = await prisma.notification.findUnique({
			where: { id: parseInt(id) },
		})

		if (!existing) {
			return res.status(404).json({ error: 'Notification not found' })
		}

		const type = await prisma.notification.update({
			where: { id: parseInt(id) },
			data: {
				...(data.name && { name: data.name }),
				...(data.description !== undefined && {
					description: data.description ?? null,
				}),
				...(data.enabled !== undefined && { enabled: data.enabled }),
				...(data.notification_type !== undefined && {
					notification_type: data.notification_type,
				}),
				...(data.target_users !== undefined && {
					target_users: data.target_users ?? null,
				}),
				...(data.message_template !== undefined && {
					message_template: data.message_template ?? null,
				}),
				...(data.priority !== undefined && {
					priority: data.priority ?? 0,
				}),
				...(data.variable_schema !== undefined && {
					variable_schema: data.variable_schema ?? null,
				}),
				...(data.show_in_feed !== undefined && {
					show_in_feed: data.show_in_feed,
				}),
				...(data.show_popup !== undefined && {
					show_popup: data.show_popup,
				}),
			},
		})

		res.json(type)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
			return
		}
		if (error.code === 'P2025') {
			// Prisma record not found
			return res.status(404).json({ error: 'Notification not found' })
		}
		console.error('Update notification error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/notifications/{id}:
 *   delete:
 *     summary: Delete notification (admin)
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification type ID
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
router.delete('/:id', async (req, res) => {
	try {
		const prisma = req.prisma
		const { id } = req.params

		await prisma.notification.delete({
			where: { id: parseInt(id) },
		})

		res.json({ message: 'Notification deleted' })
	} catch (error: any) {
		if (error.code === 'P2025') {
			// Prisma record not found
			return res.status(404).json({ error: 'Notification not found' })
		}
		console.error('Delete notification error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
