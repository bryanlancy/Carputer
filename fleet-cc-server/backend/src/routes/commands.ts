import express from 'express'
import { z } from 'zod'

const router = express.Router()

// Command creation schema
const commandSchema = z.object({
	deviceId: z.string().min(1),
	command: z.enum([
		'reboot',
		'start_service',
		'stop_service',
		'trigger_rsync',
		'collect_logs',
		'update',
	]),
	parameters: z.record(z.any()).optional(),
})

// Command status update schema
const commandStatusSchema = z.object({
	status: z.enum(['pending', 'running', 'completed', 'failed']),
	result: z.any().optional(),
	error: z.string().optional(),
})

/**
 * @swagger
 * /api/commands:
 *   post:
 *     summary: Create a new command
 *     description: Creates a new command for a device. The command will be in 'pending' status until the device picks it up.
 *     tags: [Commands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - command
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device identifier
 *               command:
 *                 type: string
 *                 enum: [reboot, start_service, stop_service, trigger_rsync, collect_logs, update]
 *               parameters:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Command-specific parameters
 *     responses:
 *       201:
 *         description: Command created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Command'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.post('/', async (req, res) => {
	try {
		const data = commandSchema.parse(req.body)
		const prisma = req.prisma

		// Get device ID from device_id
		const device = await prisma.device.findUnique({
			where: { device_id: data.deviceId },
			select: { id: true },
		})

		if (!device) {
			return res.status(404).json({ error: 'Device not found' })
		}

		// Insert command
		const command = await prisma.command.create({
			data: {
				device_id: device.id,
				command: data.command,
				parameters: data.parameters || undefined,
				status: 'pending',
			},
		})

		res.status(201).json(command)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Create command error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/commands/{commandId}/status:
 *   patch:
 *     summary: Update command status
 *     description: Updates the status of a command. Typically called by the device to report command execution results.
 *     tags: [Commands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Command ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, running, completed, failed]
 *               result:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Command execution result
 *               error:
 *                 type: string
 *                 description: Error message if command failed
 *     responses:
 *       200:
 *         description: Command status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Command'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Command not found
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
router.patch('/:commandId/status', async (req, res) => {
	try {
		const { commandId } = req.params
		const data = commandStatusSchema.parse(req.body)
		const prisma = req.prisma

		const command = await prisma.command.update({
			where: { id: parseInt(commandId) },
			data: {
				status: data.status,
				result: data.result || null,
				error: data.error || null,
				completed_at:
					data.status === 'completed' || data.status === 'failed'
						? new Date()
						: undefined,
			},
		})

		res.json(command)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			error.code === 'P2025'
		) {
			return res.status(404).json({ error: 'Command not found' })
		}
		console.error('Update command status error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/commands/device/{deviceId}:
 *   get:
 *     summary: Get commands for a device
 *     description: Returns all commands for a specific device, ordered by creation date (newest first)
 *     tags: [Commands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of commands to return
 *     responses:
 *       200:
 *         description: List of commands
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Command'
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
		const { deviceId } = req.params
		const limit = parseInt(req.query.limit as string) || 50
		const prisma = req.prisma

		// Get device ID from device_id
		const device = await prisma.device.findUnique({
			where: { device_id: deviceId },
			select: { id: true },
		})

		if (!device) {
			return res.status(404).json({ error: 'Device not found' })
		}

		const commands = await prisma.command.findMany({
			where: { device_id: device.id },
			orderBy: { created_at: 'desc' },
			take: limit,
		})

		res.json(commands)
	} catch (error) {
		console.error('Get commands error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/commands/{commandId}:
 *   get:
 *     summary: Get command by ID
 *     description: Returns a single command by its ID
 *     tags: [Commands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Command ID
 *     responses:
 *       200:
 *         description: Command details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Command'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Command not found
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
router.get('/:commandId', async (req, res) => {
	try {
		const { commandId } = req.params
		const prisma = req.prisma

		const command = await prisma.command.findUnique({
			where: { id: parseInt(commandId) },
		})

		if (!command) {
			return res.status(404).json({ error: 'Command not found' })
		}

		res.json(command)
	} catch (error) {
		console.error('Get command error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
