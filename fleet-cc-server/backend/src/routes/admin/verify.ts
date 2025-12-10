import express from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()

/**
 * @swagger
 * /api/admin/verify:
 *   get:
 *     summary: Verify admin access
 *     description: Simple endpoint to verify if the current user has admin access. Returns 200 if admin, 403 if not.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User has admin access
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authorized:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user is authenticated but not admin
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
	res.json({ authorized: true })
})

export default router

