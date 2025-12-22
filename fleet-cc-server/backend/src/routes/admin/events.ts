import express from 'express'
import { z } from 'zod'
import { EventService } from '../../services/event'
import { TagService } from '../../services/tagService'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(requireAuth)
router.use(requireAdmin)

const createEventSchema = z.object({
	event_code: z.string().min(1),
	event_name: z.string().min(1),
	description: z.string().optional().nullable(),
	input_schema: z.any(),
	handler_type: z.string().min(1),
	enabled: z.boolean().default(true),
	tagIds: z.array(z.number().int()).optional().default([]),
})

const updateEventSchema = z.object({
	event_name: z.string().min(1).optional(),
	description: z.string().optional().nullable(),
	input_schema: z.any().optional(),
	handler_type: z.string().min(1).optional(),
	enabled: z.boolean().optional(),
	tagIds: z.array(z.number().int()).optional(),
})

/**
 * GET /api/admin/events
 * List all events
 */
router.get('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const eventService = new EventService(prisma)
		const tagService = new TagService(prisma)

		const enabled =
			req.query.enabled !== undefined
				? req.query.enabled === 'true'
				: undefined
		const handlerType = req.query.handler_type as string | undefined

		const events = await eventService.getAllEvents({
			enabled,
			handler_type: handlerType,
		})

		// Load tags for each event
		const eventsWithTags = await Promise.all(
			events.map(async event => {
				const tags = await tagService.getEntityTags('event', event.id)
				return {
					...event,
					tags: tags.map(tag => ({
						id: tag.id,
						name: tag.name,
						color: tag.color,
					})),
				}
			})
		)

		res.json(eventsWithTags)
	} catch (error: any) {
		console.error('Get events error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * GET /api/admin/events/:eventId
 * Get event by ID
 */
router.get('/:eventId', async (req, res) => {
	try {
		const prisma = req.prisma
		const eventService = new EventService(prisma)
		const tagService = new TagService(prisma)

		const eventId = parseInt(req.params.eventId)
		if (isNaN(eventId)) {
			return res.status(400).json({ error: 'Invalid event ID' })
		}

		const event = await eventService.getEventById(eventId)
		if (!event) {
			return res.status(404).json({ error: 'Event not found' })
		}

		// Load tags
		const tags = await tagService.getEntityTags('event', event.id)
		const eventWithTags = {
			...event,
			tags: tags.map(tag => ({
				id: tag.id,
				name: tag.name,
				color: tag.color,
			})),
		}

		res.json(eventWithTags)
	} catch (error: any) {
		console.error('Get event error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * GET /api/admin/events/code/:eventCode
 * Get event by code
 */
router.get('/code/:eventCode', async (req, res) => {
	try {
		const prisma = req.prisma
		const eventService = new EventService(prisma)

		const event = await eventService.getEventByCode(req.params.eventCode)
		if (!event) {
			return res.status(404).json({ error: 'Event not found' })
		}

		res.json(event)
	} catch (error: any) {
		console.error('Get event by code error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * POST /api/admin/events
 * Create a new event
 */
router.post('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const eventService = new EventService(prisma)
		const tagService = new TagService(prisma)

		const data = createEventSchema.parse(req.body)
		if (!data.input_schema) {
			return res.status(400).json({ error: 'input_schema is required' })
		}
		const event = await eventService.createEvent({
			event_code: data.event_code,
			event_name: data.event_name,
			description: data.description ?? undefined,
			input_schema: data.input_schema,
			handler_type: data.handler_type,
			enabled: data.enabled,
		})

		// Associate tags
		if (data.tagIds && data.tagIds.length > 0) {
			for (const tagId of data.tagIds) {
				await tagService.associateTag('event', event.id, tagId, false)
			}
		}

		// Load tags for response
		const tags = await tagService.getEntityTags('event', event.id)
		const eventWithTags = {
			...event,
			tags: tags.map(tag => ({
				id: tag.id,
				name: tag.name,
				color: tag.color,
			})),
		}

		res.status(201).json(eventWithTags)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}

		console.error('Create event error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

/**
 * PUT /api/admin/events/:eventId
 * Update event
 */
router.put('/:eventId', async (req, res) => {
	try {
		const prisma = req.prisma
		const eventService = new EventService(prisma)
		const tagService = new TagService(prisma)

		const eventId = parseInt(req.params.eventId)
		if (isNaN(eventId)) {
			return res.status(400).json({ error: 'Invalid event ID' })
		}

		const data = updateEventSchema.parse(req.body)
		const event = await eventService.updateEvent(eventId, {
			event_name: data.event_name,
			description: data.description ?? undefined,
			input_schema: data.input_schema,
			handler_type: data.handler_type,
			enabled: data.enabled,
		})

		// Update tag associations if tagIds provided
		if (data.tagIds !== undefined) {
			// Get current tags
			const currentTags = await tagService.getEntityTags(
				'event',
				event.id
			)
			const currentTagIds = new Set(currentTags.map(t => t.id))
			const newTagIds = new Set(data.tagIds)

			// Remove tags that are no longer associated
			for (const tag of currentTags) {
				if (!newTagIds.has(tag.id)) {
					await tagService.removeTagAssociation(
						'event',
						event.id,
						tag.id
					)
				}
			}

			// Add new tags
			for (const tagId of data.tagIds) {
				if (!currentTagIds.has(tagId)) {
					await tagService.associateTag(
						'event',
						event.id,
						tagId,
						false
					)
				}
			}
		}

		// Load tags for response
		const tags = await tagService.getEntityTags('event', event.id)
		const eventWithTags = {
			...event,
			tags: tags.map(tag => ({
				id: tag.id,
				name: tag.name,
				color: tag.color,
			})),
		}

		res.json(eventWithTags)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}

		console.error('Update event error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

/**
 * DELETE /api/admin/events/:eventId
 * Delete event
 */
router.delete('/:eventId', async (req, res) => {
	try {
		const prisma = req.prisma
		const eventService = new EventService(prisma)

		const eventId = parseInt(req.params.eventId)
		if (isNaN(eventId)) {
			return res.status(400).json({ error: 'Invalid event ID' })
		}

		await eventService.deleteEvent(eventId)
		res.status(204).send()
	} catch (error: any) {
		console.error('Delete event error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

export default router
