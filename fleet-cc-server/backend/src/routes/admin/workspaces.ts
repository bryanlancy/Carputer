import express from 'express'
import { z } from 'zod'
import { WorkspaceService } from '../../services/workspace'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()
router.use(requireAuth)
router.use(requireAdmin)

const createWorkspaceSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional().nullable(),
})

const updateWorkspaceSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional().nullable(),
})

/**
 * GET /api/admin/workspaces
 * List all workspaces
 */
router.get('/', async (req, res) => {
	try {
		const workspaceService = new WorkspaceService(req.prisma)
		const workspaces = await workspaceService.getAllWorkspaces()
		res.json(workspaces)
	} catch (error: any) {
		console.error('Error fetching workspaces:', error)
		res.status(500).json({ error: 'Failed to fetch workspaces' })
	}
})

/**
 * GET /api/admin/workspaces/:id
 * Get workspace by ID
 */
router.get('/:id', async (req, res) => {
	try {
		const workspaceId = parseInt(req.params.id)
		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		const workspaceService = new WorkspaceService(req.prisma)
		const workspace = await workspaceService.getWorkspaceById(workspaceId)

		if (!workspace) {
			return res.status(404).json({ error: 'Workspace not found' })
		}

		res.json(workspace)
	} catch (error: any) {
		console.error('Error fetching workspace:', error)
		res.status(500).json({ error: 'Failed to fetch workspace' })
	}
})

/**
 * POST /api/admin/workspaces
 * Create a new workspace
 */
router.post('/', async (req, res) => {
	try {
		const data = createWorkspaceSchema.parse(req.body)
		const workspaceService = new WorkspaceService(req.prisma)
		const workspace = await workspaceService.createWorkspace(data)
		res.status(201).json(workspace)
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
		console.error('Error creating workspace:', error)
		res.status(500).json({
			error: error.message || 'Failed to create workspace',
		})
	}
})

/**
 * PUT /api/admin/workspaces/:id
 * Update workspace
 */
router.put('/:id', async (req, res) => {
	try {
		const workspaceId = parseInt(req.params.id)
		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		const data = updateWorkspaceSchema.parse(req.body)
		const workspaceService = new WorkspaceService(req.prisma)
		const workspace = await workspaceService.updateWorkspace(
			workspaceId,
			data
		)
		res.json(workspace)
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
		console.error('Error updating workspace:', error)
		res.status(500).json({
			error: error.message || 'Failed to update workspace',
		})
	}
})

/**
 * DELETE /api/admin/workspaces/:id
 * Delete workspace
 */
router.delete('/:id', async (req, res) => {
	try {
		const workspaceId = parseInt(req.params.id)
		if (isNaN(workspaceId)) {
			return res.status(400).json({ error: 'Invalid workspace ID' })
		}

		const workspaceService = new WorkspaceService(req.prisma)
		await workspaceService.deleteWorkspace(workspaceId)
		res.status(204).send()
	} catch (error: any) {
		console.error('Error deleting workspace:', error)
		res.status(500).json({
			error: error.message || 'Failed to delete workspace',
		})
	}
})

export default router
