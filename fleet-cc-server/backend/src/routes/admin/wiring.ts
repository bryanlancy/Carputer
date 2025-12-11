import express from 'express'
import { z } from 'zod'
import { WiringService } from '../../services/wiring'
import { TriggerService } from '../../services/trigger'
import { EventService } from '../../services/event'
import { NotificationService } from '../../services/notification'
import { WiringExecutorService } from '../../services/wiringExecutor'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(requireAuth)
router.use(requireAdmin)

const saveWiringSchema = z.object({
	nodes: z.any(),
	edges: z.any(),
	viewport: z.any().optional().nullable(),
	node_config: z.any().optional().nullable(),
})

const createConnectionSchema = z.object({
	trigger_id: z.number().int(),
	event_id: z.number().int(),
	connection_config: z.any().optional(),
	enabled: z.boolean().default(true),
})

const validateConnectionSchema = z.object({
	trigger_id: z.number().int(),
	event_id: z.number().int(),
})

/**
 * GET /api/admin/wiring/:workspaceId
 * Get wiring configuration for a workspace
 */
router.get('/:workspaceId', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)

		const workspaceId = parseInt(req.params.workspaceId)
		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		const wiring = await wiringService.getWiringConfiguration(workspaceId)
		const connections = wiring
			? await wiringService.getConnectionsForWorkspace(workspaceId)
			: []

		res.json({
			wiring: wiring || null,
			connections,
		})
	} catch (error: any) {
		console.error('Get wiring configuration error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * POST /api/admin/wiring/:workspaceId
 * Save wiring configuration for a workspace
 */
router.post('/:workspaceId', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)

		const workspaceId = parseInt(req.params.workspaceId)
		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		const data = saveWiringSchema.parse(req.body)
		if (!data.nodes || !data.edges) {
			return res
				.status(400)
				.json({ error: 'nodes and edges are required' })
		}
		const wiring = await wiringService.saveWiringConfiguration(
			workspaceId,
			{
				nodes: data.nodes,
				edges: data.edges,
				viewport: data.viewport,
				node_config: data.node_config,
			}
		)

		res.json(wiring)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}

		console.error('Save wiring configuration error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

/**
 * POST /api/admin/wiring/:workspaceId/connections
 * Create a trigger-event connection
 * Note: This endpoint is deprecated. Connections should be managed through saveWiringConfiguration with edges.
 */
router.post('/:workspaceId/connections', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)

		const workspaceId = parseInt(req.params.workspaceId)
		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		const data = createConnectionSchema.parse(req.body)
		const connection = await wiringService.createConnection(
			workspaceId,
			data
		)

		res.status(201).json(connection)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}

		console.error('Create connection error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

/**
 * PUT /api/admin/wiring/connections/:connectionId
 * Update a connection
 */
router.put('/connections/:connectionId', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)

		const connectionId = parseInt(req.params.connectionId)
		if (isNaN(connectionId)) {
			return res.status(400).json({ error: 'Invalid connection ID' })
		}

		const data = z
			.object({
				connection_config: z.any().optional(),
				enabled: z.boolean().optional(),
			})
			.parse(req.body)

		const connection = await wiringService.updateConnection(
			connectionId,
			data
		)
		res.json(connection)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}

		console.error('Update connection error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

/**
 * DELETE /api/admin/wiring/connections/:connectionId
 * Delete a connection
 */
router.delete('/connections/:connectionId', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)

		const connectionId = parseInt(req.params.connectionId)
		if (isNaN(connectionId)) {
			return res.status(400).json({ error: 'Invalid connection ID' })
		}

		await wiringService.deleteConnection(connectionId)
		res.status(204).send()
	} catch (error: any) {
		console.error('Delete connection error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

/**
 * GET /api/admin/commands/list
 * Get list of available commands for Execute Command action
 */
router.get('/commands/list', async (req, res) => {
	try {
		// Return the list of available commands
		const commands = [
			{ value: 'reboot', label: 'Reboot' },
			{ value: 'start_service', label: 'Start Service' },
			{ value: 'stop_service', label: 'Stop Service' },
			{ value: 'trigger_rsync', label: 'Trigger Rsync' },
			{ value: 'collect_logs', label: 'Collect Logs' },
			{ value: 'update', label: 'Update' },
		]
		res.json(commands)
	} catch (error: any) {
		console.error('Get commands list error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * POST /api/admin/wiring/:workspaceId/triggers/:triggerId/test
 * Test a trigger by executing it with fake data and processing connected events
 */
router.post('/:workspaceId/triggers/:triggerId/test', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)
		const notificationService = new NotificationService(prisma)
		const executorService = new WiringExecutorService(
			prisma,
			wiringService,
			triggerService,
			eventService,
			notificationService
		)

		const workspaceId = parseInt(req.params.workspaceId)
		const triggerId = parseInt(req.params.triggerId)
		const userId = req.user?.id

		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		if (isNaN(triggerId)) {
			return res.status(400).json({ error: 'Invalid trigger ID' })
		}

		if (!userId) {
			return res.status(401).json({ error: 'User not authenticated' })
		}

		// Execute trigger with test data
		const result = await executorService.executeTrigger(
			workspaceId,
			triggerId,
			undefined, // Will generate from trigger schema
			userId
		)

		res.json(result)
	} catch (error: any) {
		if (error.message?.includes('not found')) {
			return res.status(404).json({ error: error.message })
		}
		if (error.message?.includes('disabled')) {
			return res.status(400).json({ error: error.message })
		}
		console.error('Test trigger error:', error)
		res.status(500).json({ error: error.message || 'Internal server error' })
	}
})

/**
 * POST /api/admin/wiring/validate
 * Validate a trigger-to-event connection
 */
router.post('/validate', async (req, res) => {
	try {
		const prisma = req.prisma
		const triggerService = new TriggerService(prisma)
		const eventService = new EventService(prisma)
		const wiringService = new WiringService(
			prisma,
			triggerService,
			eventService
		)

		const data = validateConnectionSchema.parse(req.body)

		const trigger = await triggerService.getTriggerById(data.trigger_id)
		if (!trigger) {
			return res.status(404).json({ error: 'Trigger not found' })
		}

		const event = await eventService.getEventById(data.event_id)
		if (!event) {
			return res.status(404).json({ error: 'Event not found' })
		}

		const validation = wiringService.validateConnection(trigger, event)
		res.json(validation)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}

		console.error('Validate connection error:', error)
		res.status(500).json({
			error: error.message || 'Internal server error',
		})
	}
})

export default router
