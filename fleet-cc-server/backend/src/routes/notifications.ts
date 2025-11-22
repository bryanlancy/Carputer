import express from 'express'
import { z } from 'zod'
import { NotificationService } from '../services/notification'

const router = express.Router()

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications
 *     description: Returns a list of all notifications, optionally filtered by device, type, or read status
 *     tags: [Notifications]
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

export default router

