import express from 'express'

const router = express.Router()

/**
 * @swagger
 * /api/metrics/overview:
 *   get:
 *     summary: Get fleet overview metrics
 *     description: Returns fleet-wide metrics including device counts by status, version distribution, command statistics, and recent activity.
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       200:
 *         description: Fleet metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Metrics'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/overview', async (req, res) => {
	try {
		const prisma = req.prisma

		if (!prisma) {
			return res.status(500).json({ error: 'Database connection not available' })
		}

		// Get device counts by status (excluding default device)
		const statusCounts = await prisma.device.groupBy({
			by: ['status'],
			where: {
				is_default: false, // Exclude default device from counts
			},
			_count: true,
		})

		// Get version distribution (excluding default device)
		const versionDistributionRaw = await prisma.device.groupBy({
			by: ['current_build_id'],
			where: {
				current_build_id: { not: null },
				is_default: false, // Exclude default device
			},
			_count: {
				current_build_id: true,
			},
		})

		// Sort by count descending
		const versionDistribution = versionDistributionRaw.sort(
			(a: any, b: any) =>
				b._count.current_build_id - a._count.current_build_id
		)

		// Get command statistics (last 24 hours)
		const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
		const commandStats = await prisma.command.groupBy({
			by: ['status'],
			where: {
				created_at: {
					gte: twentyFourHoursAgo,
				},
			},
			_count: {
				status: true,
			},
		})

		// Get online devices (status='online' AND seen in last 15 minutes, excluding default device)
		const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
		const onlineDevices = await prisma.device.count({
			where: {
				status: 'online',
				last_seen: {
					gte: fifteenMinutesAgo,
				},
				is_default: false, // Exclude default device from counts
			},
		})

		res.json({
			devices: {
				byStatus: statusCounts.reduce(
					(acc: Record<string, number>, row: any) => {
						acc[row.status] = row._count
						return acc
					},
					{} as Record<string, number>
				),
				online: onlineDevices,
			},
			versions: versionDistribution.map((v: any) => ({
				current_build_id: v.current_build_id,
				count: v._count.current_build_id,
			})),
			commands: {
				last24h: commandStats.reduce(
					(acc: Record<string, number>, row: any) => {
						acc[row.status] = row._count.status
						return acc
					},
					{} as Record<string, number>
				),
			},
		})
	} catch (error: any) {
		console.error('Get metrics error:', error)
		if (!res.headersSent) {
			res.status(500).json({
				error: 'Internal server error',
				message: error?.message || 'Unknown error'
			})
		}
	}
})

export default router
