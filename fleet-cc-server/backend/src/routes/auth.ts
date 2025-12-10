import express from 'express'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     description: Returns the currently authenticated user's information including roles
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                 isAdmin:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/me', requireAuth, async (req, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: 'Unauthorized' })
		}

		res.json({
			id: req.user.id,
			email: req.user.email,
			roles: req.user.roles || [],
			isAdmin: req.user.roles?.includes('admin') || false,
		})
	} catch (error) {
		console.error('Get current user error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router

