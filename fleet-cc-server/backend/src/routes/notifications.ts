import express from 'express'
import { z } from 'zod'
import { NotificationService } from '../services/notification'
import { TagService } from '../services/tagService'
import { TemplateService } from '../services/template'
import { generateFakeDataFromSchema } from '../utils/fakeDataGenerator'
import { optionalAuth, requireAuth } from '../middleware/auth'

const router = express.Router()

// Apply optional authentication to all routes (for backward compatibility)
router.use(optionalAuth)

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications
 *     description: Returns a list of all notifications, optionally filtered by device, type, or read status
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Return only unread notifications
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: integer
 *         description: Filter by device ID
 *       - in: query
 *         name: typeCode
 *         schema:
 *           type: string
 *         description: Filter by notification type code (e.g., device.online, device.offline)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [created_at, read]
 *           default: created_at
 *         description: Field to order by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const unreadOnly = req.query.unreadOnly === 'true'
		const deviceId = req.query.deviceId
			? parseInt(req.query.deviceId as string, 10)
			: undefined
		const typeCode = req.query.typeCode as string | undefined
		const limit = req.query.limit
			? parseInt(req.query.limit as string, 10)
			: 100
		const offset = req.query.offset
			? parseInt(req.query.offset as string, 10)
			: 0
		const orderBy =
			(req.query.orderBy as 'created_at' | 'read') || 'created_at'
		const order = (req.query.order as 'asc' | 'desc') || 'desc'

		const notifications = await notificationService.getAllNotifications({
			unreadOnly,
			deviceId,
			typeCode,
			limit,
			offset,
			orderBy,
			order,
		})

		// Convert BigInt values to strings for JSON serialization
		const jsonString = JSON.stringify(notifications, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error) {
		console.error('Get notifications error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/device/{deviceId}:
 *   get:
 *     summary: Get notifications for a specific device
 *     description: Returns all notifications for a specific device
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device ID
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Return only unread notifications
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *     responses:
 *       200:
 *         description: List of notifications for the device
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/device/:deviceId', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const deviceId = parseInt(req.params.deviceId, 10)

		if (isNaN(deviceId)) {
			return res.status(400).json({ error: 'Invalid device ID' })
		}

		// Check if device exists
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: { id: true },
		})

		if (!device) {
			return res.status(404).json({ error: 'Device not found' })
		}

		const unreadOnly = req.query.unreadOnly === 'true'
		const limit = req.query.limit
			? parseInt(req.query.limit as string, 10)
			: 100
		const offset = req.query.offset
			? parseInt(req.query.offset as string, 10)
			: 0

		const notifications = await notificationService.getDeviceNotifications(
			deviceId,
			{
				unreadOnly,
				limit,
				offset,
				orderBy: 'created_at',
				order: 'desc',
			}
		)

		// Convert BigInt values to strings for JSON serialization
		const jsonString = JSON.stringify(notifications, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error) {
		console.error('Get device notifications error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   post:
 *     summary: Mark a notification as read
 *     description: Marks a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:notificationId/read', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const notificationId = parseInt(req.params.notificationId, 10)

		if (isNaN(notificationId)) {
			return res.status(400).json({ error: 'Invalid notification ID' })
		}

		const notification = await notificationService.markAsRead(
			notificationId
		)

		if (!notification) {
			return res.status(404).json({ error: 'Notification not found' })
		}

		res.json(notification)
	} catch (error) {
		console.error('Mark notification as read error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/device/{deviceId}/read-all:
 *   post:
 *     summary: Mark all notifications as read for a device
 *     description: Marks all unread notifications for a specific device as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Device ID
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of notifications marked as read
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/device/:deviceId/read-all', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const deviceId = parseInt(req.params.deviceId, 10)

		if (isNaN(deviceId)) {
			return res.status(400).json({ error: 'Invalid device ID' })
		}

		// Check if device exists
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: { id: true },
		})

		if (!device) {
			return res.status(404).json({ error: 'Device not found' })
		}

		const result = await notificationService.markAllAsRead(deviceId)

		res.json(result)
	} catch (error) {
		console.error('Mark all notifications as read error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Returns the total count of unread notifications across all devices, optionally filtered by device
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: integer
 *         description: Get unread count for a specific device (omit for total count)
 *     responses:
 *       200:
 *         description: Unread notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/unread-count', async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		const deviceId = req.query.deviceId
			? parseInt(req.query.deviceId as string, 10)
			: undefined

		let count: number

		if (deviceId) {
			if (isNaN(deviceId)) {
				return res.status(400).json({ error: 'Invalid device ID' })
			}

			// Check if device exists
			const device = await prisma.device.findUnique({
				where: { id: deviceId },
				select: { id: true },
			})

			if (!device) {
				return res.status(404).json({ error: 'Device not found' })
			}

			count = await notificationService.getUnreadCount(deviceId)
		} else {
			count = await notificationService.getTotalUnreadCount()
		}

		res.json({ count })
	} catch (error) {
		console.error('Get unread count error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/user/me:
 *   get:
 *     summary: Get current user's notifications
 *     description: Returns notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unviewedOnly
 *         schema:
 *           type: boolean
 *         description: Return only unviewed notifications
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *     responses:
 *       200:
 *         description: List of user notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/me', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const unviewedOnly = req.query.unviewedOnly === 'true'
		const limit = req.query.limit
			? parseInt(req.query.limit as string, 10)
			: 100
		const offset = req.query.offset
			? parseInt(req.query.offset as string, 10)
			: 0

		const notifications = await notificationService.getUserNotifications(
			req.user.id,
			{
				unviewedOnly,
				limit,
				offset,
				orderBy: 'created_at',
				order: 'desc',
			}
		)

		const jsonString = JSON.stringify(notifications, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error) {
		console.error('Get user notifications error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/user/me/unread-count:
 *   get:
 *     summary: Get current user's unviewed notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unviewed notification count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/me/unread-count', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const count = await notificationService.getUnviewedCountForUser(
			req.user.id
		)

		res.json({ count })
	} catch (error) {
		console.error('Get user unviewed count error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/user/me/feed:
 *   get:
 *     summary: Get user notifications for feed
 *     description: Returns notifications that should appear in the navbar feed (show_in_feed = true)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of notifications to return
 *       - in: query
 *         name: unviewedOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only unviewed notifications
 *     responses:
 *       200:
 *         description: List of notifications for feed
 *       401:
 *         description: Unauthorized
 */
router.get('/user/me/feed', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const limit = req.query.limit
			? parseInt(req.query.limit as string, 10)
			: 20
		const unviewedOnly = req.query.unviewedOnly === 'true'

		// Get user notifications that have show_in_feed = true and hidden = false
		const userNotifications = await prisma.userNotification.findMany({
			where: {
				user_id: req.user.id,
				hidden: false, // Filter out hidden notifications
				...(unviewedOnly && { viewed: false }),
				notification: {
					show_in_feed: true,
				},
			},
			include: {
				notification: true,
			},
			orderBy: {
				created_at: 'desc', // Use UserNotification.created_at
			},
			take: limit,
		})

		// Get tags for each notification and user notification
		const notificationsWithTags = await Promise.all(
			userNotifications.map(async un => {
				// Get tags for the notification template
				const notificationTags = await tagService.getEntityTags(
					'notification',
					un.notification_id
				)

				// Get tags for the user notification (including inherited)
				const userNotificationTags = await tagService.getEntityTags(
					'user_notification',
					un.id
				)

				// Combine tags (user notification tags take precedence for display)
				const allTags =
					userNotificationTags.length > 0
						? userNotificationTags
						: notificationTags

				// Render message template if available
				let renderedMessage =
					un.notification.message_template || un.notification.name
				if (
					un.notification.message_template &&
					un.notification.variable_schema
				) {
					try {
						// Generate fake data from schema to render template
						const fakeData = generateFakeDataFromSchema(
							un.notification.variable_schema
						)
						renderedMessage = TemplateService.render(
							un.notification.message_template,
							fakeData
						)
					} catch (error) {
						console.error(
							`Failed to render template for notification ${un.notification_id}:`,
							error
						)
						// Keep original template if rendering fails
					}
				}

				return {
					id: un.id, // Use UserNotification ID for feed
					notification_id: un.notification.id,
					name: un.notification.name,
					message: renderedMessage, // Rendered message
					message_template: un.notification.message_template, // Keep template for reference
					notification_type: un.notification.notification_type,
					viewed: un.viewed,
					viewed_at: un.viewed_at,
					created_at: un.created_at, // Use UserNotification.created_at
					tags: allTags.map(tag => ({
						id: tag.id,
						name: tag.name,
						color: tag.color,
						category: tag.category,
						inherited: tag.inherited,
					})),
					device: null, // Can be populated if needed
				}
			})
		)

		const jsonString = JSON.stringify(notificationsWithTags, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error) {
		console.error('Get user feed notifications error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/{notificationId}/view:
 *   post:
 *     summary: Mark notification as viewed by current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as viewed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Invalid notification ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found for user
 *       500:
 *         description: Internal server error
 */
router.post('/:notificationId/view', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const notificationId = parseInt(req.params.notificationId, 10)

		if (isNaN(notificationId)) {
			return res.status(400).json({ error: 'Invalid notification ID' })
		}

		const result = await notificationService.markAsViewedByUser(
			notificationId,
			req.user.id
		)

		res.json(result)
	} catch (error: any) {
		if (error.code === 'P2025') {
			return res
				.status(404)
				.json({ error: 'Notification not found for user' })
		}
		console.error('Mark notification as viewed error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/user/me/view-all:
 *   post:
 *     summary: Mark all notifications as viewed for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as viewed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of notifications marked as viewed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/user/me/view-all', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const notificationService = new NotificationService(prisma)

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const result = await notificationService.markAllAsViewedByUser(
			req.user.id
		)

		res.json(result)
	} catch (error) {
		console.error('Mark all notifications as viewed error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/user/me/{notificationId}/hide:
 *   patch:
 *     summary: Hide notification from feed for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: UserNotification ID (not Notification ID)
 *     responses:
 *       200:
 *         description: Notification hidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 hidden:
 *                   type: boolean
 *       400:
 *         description: Invalid notification ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found for user
 *       500:
 *         description: Internal server error
 */
router.patch('/user/me/:notificationId/hide', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const notificationId = parseInt(req.params.notificationId, 10)

		if (isNaN(notificationId)) {
			return res.status(400).json({ error: 'Invalid notification ID' })
		}

		// Update UserNotification to set hidden = true
		const userNotification = await prisma.userNotification.update({
			where: {
				id: notificationId,
				user_id: req.user.id, // Ensure user owns this notification
			},
			data: {
				hidden: true,
			},
			include: {
				notification: true,
			},
		})

		res.json({
			id: userNotification.id,
			hidden: userNotification.hidden,
		})
	} catch (error: any) {
		if (error.code === 'P2025') {
			return res.status(404).json({
				error: 'Notification not found for user',
			})
		}
		console.error('Hide notification error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/notifications/user/me/preferences:
 *   get:
 *     summary: Get current user's notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 user_id:
 *                   type: string
 *                 auto_read:
 *                   type: boolean
 *                 enabled_notification_types:
 *                   type: array
 *                   items:
 *                     type: string
 *                   nullable: true
 *                 urgency_filters:
 *                   type: array
 *                   items:
 *                     type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/me/preferences', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		let preferences = await prisma.userNotificationPreferences.findUnique({
			where: { user_id: req.user.id },
		})

		// Create default preferences if none exist
		if (!preferences) {
			try {
				// First ensure user exists in database
				const user = await prisma.user.findUnique({
					where: { id: req.user.id },
				})

				if (!user) {
					// User doesn't exist - return default preferences without saving
					return res.json({
						id: 0,
						user_id: req.user.id,
						auto_read: false,
						enabled_notification_types: null,
						urgency_filters: null,
						created_at: new Date(),
						updated_at: new Date(),
					})
				}

				preferences = await prisma.userNotificationPreferences.create({
					data: {
						user_id: req.user.id,
						auto_read: false,
						enabled_notification_types: undefined,
						urgency_filters: undefined,
					},
				})
			} catch (createError: any) {
				// If creation fails, return default preferences
				console.error('Failed to create preferences:', createError)
				return res.json({
					id: 0,
					user_id: req.user.id,
					auto_read: false,
					enabled_notification_types: null,
					urgency_filters: null,
					created_at: new Date(),
					updated_at: new Date(),
				})
			}
		}

		res.json(preferences)
	} catch (error: any) {
		console.error('Get user preferences error:', error)
		// Return a default response instead of error to prevent empty response
		if (!res.headersSent) {
			res.status(500).json({
				error: 'Internal server error',
				message: error?.message || 'Unknown error',
			})
		}
	}
})

/**
 * @swagger
 * /api/notifications/user/me/preferences:
 *   put:
 *     summary: Update current user's notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auto_read:
 *                 type: boolean
 *                 description: Automatically mark notifications as read
 *               enabled_notification_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Array of enabled notification type codes (null for all)
 *               urgency_filters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Array of urgency levels to filter (null for all)
 *     responses:
 *       200:
 *         description: Preferences updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 user_id:
 *                   type: string
 *                 auto_read:
 *                   type: boolean
 *                 enabled_notification_types:
 *                   type: array
 *                   items:
 *                     type: string
 *                   nullable: true
 *                 urgency_filters:
 *                   type: array
 *                   items:
 *                     type: string
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
const updatePreferencesSchema = z.object({
	auto_read: z.boolean().optional(),
	enabled_notification_types: z.array(z.string()).optional().nullable(),
	urgency_filters: z.array(z.string()).optional().nullable(),
})

router.put('/user/me/preferences', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const data = updatePreferencesSchema.parse(req.body)

		const preferences = await prisma.userNotificationPreferences.upsert({
			where: { user_id: req.user.id },
			create: {
				user_id: req.user.id,
				auto_read: data.auto_read || false,
				enabled_notification_types:
					data.enabled_notification_types || undefined,
				urgency_filters: data.urgency_filters || undefined,
			},
			update: {
				...(data.auto_read !== undefined && {
					auto_read: data.auto_read,
				}),
				...(data.enabled_notification_types !== undefined && {
					enabled_notification_types:
						data.enabled_notification_types !== null
							? data.enabled_notification_types
							: undefined,
				}),
				...(data.urgency_filters !== undefined && {
					urgency_filters:
						data.urgency_filters !== null
							? data.urgency_filters
							: undefined,
				}),
			},
		})

		res.json(preferences)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
			return
		}
		console.error('Update user preferences error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
