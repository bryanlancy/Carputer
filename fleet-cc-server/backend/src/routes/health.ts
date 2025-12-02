import express from 'express'

const router = express.Router()

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server and database connection
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: connected
 *       503:
 *         description: Server is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 error:
 *                   type: string
 */
router.get('/', async (req, res) => {
	try {
		// Check database connection
		const prisma = req.prisma

		if (!prisma) {
			return res.status(503).json({
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: 'Database connection not available',
			})
		}

		await prisma.$queryRaw`SELECT 1`

		res.json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			services: {
				database: 'connected',
			},
		})
	} catch (error: any) {
		console.error('Health check error:', error)
		if (!res.headersSent) {
			res.status(503).json({
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}
})

export default router
