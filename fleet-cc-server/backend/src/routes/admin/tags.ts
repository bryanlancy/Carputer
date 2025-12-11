import express from 'express'
import { z } from 'zod'
import { TagService } from '../../services/tagService'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(requireAuth)
router.use(requireAdmin)

/**
 * @swagger
 * /api/admin/tags:
 *   get:
 *     summary: Get all tags (admin)
 *     tags: [Admin Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *     responses:
 *       200:
 *         description: List of tags
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)

		const category = req.query.category as string | undefined
		const search = req.query.search as string | undefined

		const tags = await tagService.getAllTags({
			category,
			search,
		})

		res.json(tags)
	} catch (error) {
		console.error('Get tags error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/tags:
 *   post:
 *     summary: Create a new tag (admin)
 *     tags: [Admin Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
const createTagSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional().nullable(),
	color: z.string().optional().nullable(),
	category: z.string().optional().nullable(),
})

router.post('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)

		const data = createTagSchema.parse(req.body)

		const tag = await tagService.createTag(data)

		res.json(tag)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
			return
		}
		if (error.message?.includes('already exists')) {
			res.status(409).json({ error: error.message })
			return
		}
		console.error('Create tag error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   get:
 *     summary: Get tag by ID (admin)
 *     tags: [Admin Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag details
 *       404:
 *         description: Tag not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)
		const { id } = req.params

		const tag = await tagService.getTagById(parseInt(id))

		if (!tag) {
			return res.status(404).json({ error: 'Tag not found' })
		}

		res.json(tag)
	} catch (error) {
		console.error('Get tag error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   put:
 *     summary: Update tag (admin)
 *     tags: [Admin Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tag not found
 *       401:
 *         description: Unauthorized
 */
const updateTagSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional().nullable(),
	color: z.string().optional().nullable(),
	category: z.string().optional().nullable(),
})

router.put('/:id', async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)
		const { id } = req.params
		const data = updateTagSchema.parse(req.body)

		const tag = await tagService.updateTag(parseInt(id), data)

		res.json(tag)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
			return
		}
		if (error.message?.includes('not found')) {
			return res.status(404).json({ error: error.message })
		}
		if (error.message?.includes('already exists')) {
			return res.status(409).json({ error: error.message })
		}
		console.error('Update tag error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   delete:
 *     summary: Delete tag (admin)
 *     tags: [Admin Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag deleted
 *       400:
 *         description: Cannot delete tag with associations
 *       404:
 *         description: Tag not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)
		const { id } = req.params

		await tagService.deleteTag(parseInt(id))

		res.json({ message: 'Tag deleted' })
	} catch (error: any) {
		if (error.message?.includes('not found')) {
			return res.status(404).json({ error: error.message })
		}
		if (error.message?.includes('associations')) {
			return res.status(400).json({ error: error.message })
		}
		console.error('Delete tag error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/admin/tags/{id}/associations:
 *   get:
 *     summary: Get all entities using a tag (admin)
 *     tags: [Admin Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag usage information
 *       404:
 *         description: Tag not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/associations', async (req, res) => {
	try {
		const prisma = req.prisma
		const tagService = new TagService(prisma)
		const { id } = req.params

		const usage = await tagService.getTagUsage(parseInt(id))

		res.json(usage)
	} catch (error: any) {
		if (error.message?.includes('not found')) {
			return res.status(404).json({ error: error.message })
		}
		console.error('Get tag usage error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
