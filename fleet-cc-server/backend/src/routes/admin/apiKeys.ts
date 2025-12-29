import express from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'
import {
	createApiKey,
	revokeApiKey,
	updateApiKey,
	getApiKeyPermissions,
	deleteApiKey,
} from '../../services/apiKeyService'
import { prisma } from '../../db/prisma'
import type { Prisma } from '@prisma/client'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(requireAuth)
router.use(requireAdmin)

const permissionSchema = z.object({
	resource_type: z.string().min(1),
	allowed_endpoints: z.array(z.string()).optional().nullable(),
	allowed_fields: z.record(z.string(), z.array(z.string())).optional().nullable(),
})

const createApiKeySchema = z.object({
	description: z.string().optional().nullable(),
	permissions: z.array(permissionSchema).min(1),
})

const updateApiKeySchema = z.object({
	description: z.string().optional().nullable(),
	permissions: z.array(permissionSchema).min(1),
})

/**
 * GET /api/admin/api-keys
 * List all API keys
 */
router.get('/', async (req, res) => {
	try {
		const apiKeys = await (prisma as any).apiKey.findMany({
			include: {
				permissions: true,
				user: {
					select: {
						id: true,
						email: true,
						full_name: true,
					},
				},
			},
			orderBy: {
				created_at: 'desc',
			},
		})

		// Remove key_hash from response for security
		const sanitized = apiKeys.map((key: any) => ({
			id: key.id,
			key_prefix: key.key_prefix,
			user_id: key.user_id,
			user: key.user,
			description: key.description,
			revoked_at: key.revoked_at,
			last_used_at: key.last_used_at,
			created_at: key.created_at,
			updated_at: key.updated_at,
			permissions: key.permissions,
		}))

		res.json(sanitized)
	} catch (error: any) {
		console.error('Get API keys error:', error)
		// Never expose detailed error messages to the frontend
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * GET /api/admin/api-keys/:id
 * Get API key by ID
 */
router.get('/:id', async (req, res) => {
	try {
		const id = parseInt(req.params.id)
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid API key ID' })
		}

		const apiKey = await (prisma as any).apiKey.findUnique({
			where: { id },
			include: {
				permissions: true,
				user: {
					select: {
						id: true,
						email: true,
						full_name: true,
					},
				},
			},
		})

		if (!apiKey) {
			return res.status(404).json({ error: 'API key not found' })
		}

		// Remove key_hash from response
		const sanitized = {
			id: apiKey.id,
			key_prefix: apiKey.key_prefix,
			user_id: apiKey.user_id,
			user: apiKey.user,
			description: apiKey.description,
			revoked_at: apiKey.revoked_at,
			last_used_at: apiKey.last_used_at,
			created_at: apiKey.created_at,
			updated_at: apiKey.updated_at,
			permissions: apiKey.permissions,
		}

		res.json(sanitized)
	} catch (error: any) {
		console.error('Get API key error:', error)
		// Never expose detailed error messages to the frontend
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * POST /api/admin/api-keys
 * Create a new API key
 */
router.post('/', async (req, res) => {
	try {
		const validationResult = createApiKeySchema.safeParse(req.body)
		if (!validationResult.success) {
			return res.status(400).json({
				error: 'Validation error',
				details: validationResult.error.errors,
			})
		}

		const { description, permissions } = validationResult.data

		if (!req.user) {
			return res.status(401).json({ error: 'Authentication required' })
		}

		const { apiKey, plainKey } = await createApiKey(
			req.user.id,
			description || null,
			permissions
		)

		// Return the API key with the plain key (only shown once)
		res.status(201).json({
			id: apiKey.id,
			key: plainKey, // Only returned on creation
			key_prefix: apiKey.key_prefix,
			user_id: apiKey.user_id,
			description: apiKey.description,
			created_at: apiKey.created_at,
			permissions: apiKey.permissions,
		})
	} catch (error: any) {
		console.error('Create API key error:', error)
		// Never expose detailed error messages to the frontend
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * PUT /api/admin/api-keys/:id
 * Update API key description and permissions
 */
router.put('/:id', async (req, res) => {
	try {
		const id = parseInt(req.params.id)
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid API key ID' })
		}

		const validationResult = updateApiKeySchema.safeParse(req.body)
		if (!validationResult.success) {
			return res.status(400).json({
				error: 'Validation error',
				details: validationResult.error.errors,
			})
		}

		const { description, permissions } = validationResult.data

		// Check if API key exists
		const existing = await (prisma as any).apiKey.findUnique({
			where: { id },
		})

		if (!existing) {
			return res.status(404).json({ error: 'API key not found' })
		}

		const updated = await updateApiKey(id, description || null, permissions)

		// Remove key_hash from response
		const sanitized = {
			id: updated.id,
			key_prefix: updated.key_prefix,
			user_id: updated.user_id,
			description: updated.description,
			revoked_at: updated.revoked_at,
			last_used_at: updated.last_used_at,
			created_at: updated.created_at,
			updated_at: updated.updated_at,
			permissions: updated.permissions,
		}

		res.json(sanitized)
	} catch (error: any) {
		console.error('Update API key error:', error)
		// Never expose detailed error messages to the frontend
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * DELETE /api/admin/api-keys/:id
 * Revoke an API key (if used) or delete it (if never used)
 */
router.delete('/:id', async (req, res) => {
	try {
		const id = parseInt(req.params.id)
		if (isNaN(id)) {
			return res.status(400).json({ error: 'Invalid API key ID' })
		}

		// Check if API key exists
		const existing = await (prisma as any).apiKey.findUnique({
			where: { id },
		})

		if (!existing) {
			return res.status(404).json({ error: 'API key not found' })
		}

		// Check if query parameter indicates deletion
		const shouldDelete = req.query.delete === 'true'

		if (shouldDelete) {
			// Try to delete (only works if never used)
			try {
				await deleteApiKey(id)
				return res.json({ message: 'API key deleted successfully' })
			} catch (error: any) {
				if (error.message === 'Cannot delete API key that has been used') {
					return res.status(400).json({ error: 'Cannot delete API key that has been used' })
				}
				throw error
			}
		} else {
			// Revoke the key
			await revokeApiKey(id)
			return res.json({ message: 'API key revoked successfully' })
		}
	} catch (error: any) {
		console.error('Delete/Revoke API key error:', error)
		// Never expose detailed error messages to the frontend
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router

