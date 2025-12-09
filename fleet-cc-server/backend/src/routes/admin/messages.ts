import express from 'express'
import { z } from 'zod'
import { MessageService } from '../../services/message'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()
router.use(requireAuth)
router.use(requireAdmin)

const createMessageSchema = z.object({
	message_code: z.string().min(1),
	message_name: z.string().min(1),
	description: z.string().optional().nullable(),
	message_type: z.string().min(1),
	subject_template: z.string().optional().nullable(),
	body_template: z.string().min(1),
	variable_schema: z.any().optional().nullable(),
	enabled: z.boolean().default(true),
})

const updateMessageSchema = z.object({
	message_name: z.string().min(1).optional(),
	description: z.string().optional().nullable(),
	message_type: z.string().min(1).optional(),
	subject_template: z.string().optional().nullable(),
	body_template: z.string().min(1).optional(),
	variable_schema: z.any().optional().nullable(),
	enabled: z.boolean().optional(),
})

/**
 * GET /api/admin/messages
 * List all messages
 */
router.get('/', async (req, res) => {
	try {
		const messageService = new MessageService(req.prisma)
		const enabled =
			req.query.enabled !== undefined
				? req.query.enabled === 'true'
				: undefined
		const message_type = req.query.message_type as string | undefined

		const messages = await messageService.getAllMessages({
			enabled,
			message_type,
		})
		res.json(messages)
	} catch (error: any) {
		console.error('Error fetching messages:', error)
		res.status(500).json({ error: 'Failed to fetch messages' })
	}
})

/**
 * GET /api/admin/messages/:id
 * Get message by ID
 */
router.get('/:id', async (req, res) => {
	try {
		const messageId = parseInt(req.params.id)
		if (isNaN(messageId)) {
			return res.status(400).json({ error: 'Invalid message ID' })
		}

		const messageService = new MessageService(req.prisma)
		const message = await messageService.getMessageById(messageId)

		if (!message) {
			return res.status(404).json({ error: 'Message not found' })
		}

		res.json(message)
	} catch (error: any) {
		console.error('Error fetching message:', error)
		res.status(500).json({ error: 'Failed to fetch message' })
	}
})

/**
 * POST /api/admin/messages
 * Create a new message
 */
router.post('/', async (req, res) => {
	try {
		const data = createMessageSchema.parse(req.body)
		const messageService = new MessageService(req.prisma)
		const message = await messageService.createMessage({
			...data,
			description: data.description ?? undefined,
			subject_template: data.subject_template ?? undefined,
			variable_schema: data.variable_schema ?? undefined,
		})

		res.status(201).json(message)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			console.error('Validation error:', error.errors)
			res.status(400).json({
				error: 'Validation error',
				details: error.errors.map(e => ({
					path: e.path.join('.'),
					message: e.message,
				})),
			})
			return
		}
		console.error('Error creating message:', error)
		res.status(500).json({
			error: error.message || 'Failed to create message',
		})
	}
})

/**
 * PUT /api/admin/messages/:id
 * Update message
 */
router.put('/:id', async (req, res) => {
	try {
		const messageId = parseInt(req.params.id)
		if (isNaN(messageId)) {
			return res.status(400).json({ error: 'Invalid message ID' })
		}

		const data = updateMessageSchema.parse(req.body)
		const messageService = new MessageService(req.prisma)
		const message = await messageService.updateMessage(messageId, {
			...data,
			description: data.description ?? undefined,
			subject_template: data.subject_template ?? undefined,
			variable_schema: data.variable_schema ?? undefined,
		})

		res.json(message)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			console.error('Validation error:', error.errors)
			res.status(400).json({
				error: 'Validation error',
				details: error.errors.map(e => ({
					path: e.path.join('.'),
					message: e.message,
				})),
			})
			return
		}
		console.error('Error updating message:', error)
		res.status(500).json({
			error: error.message || 'Failed to update message',
		})
	}
})

/**
 * DELETE /api/admin/messages/:id
 * Delete message
 */
router.delete('/:id', async (req, res) => {
	try {
		const messageId = parseInt(req.params.id)
		if (isNaN(messageId)) {
			return res.status(400).json({ error: 'Invalid message ID' })
		}

		const messageService = new MessageService(req.prisma)
		await messageService.deleteMessage(messageId)
		res.status(204).send()
	} catch (error: any) {
		console.error('Error deleting message:', error)
		res.status(500).json({
			error: error.message || 'Failed to delete message',
		})
	}
})

export default router
