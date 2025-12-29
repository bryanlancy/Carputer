import express from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/authorize'

const router = express.Router()
router.use(requireAuth)
router.use(requireAdmin)

const updateDefaultDeviceSchema = z.object({
	device_id: z.string().min(1).optional(),
	hostname: z.string().nullable().optional(),
	vin: z.string().nullable().optional(),
	hardware_rev: z.string().nullable().optional(),
	build_id: z.string().nullable().optional(),
	current_version: z.string().nullable().optional(),
	current_build_id: z.string().nullable().optional(),
	current_ip: z.string().nullable().optional(),
	uptime: z.number().nullable().optional(),
	services_status: z.record(z.boolean()).nullable().optional(),
	status: z.enum(['online', 'offline', 'stale', 'maintenance']).optional(),
	last_seen: z.string().datetime().nullable().optional(),
})

/**
 * @swagger
 * /api/admin/defaults/device:
 *   get:
 *     summary: Get default device (for template previews)
 *     description: Returns the default device used for message template previews. This device is excluded from device lists and counts.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default device data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       404:
 *         description: Default device not found
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
router.get('/device', async (req, res) => {
	try {
		const prisma = req.prisma

		// Find the default device
		let defaultDevice = await prisma.device.findFirst({
			where: {
				is_default: true,
			},
		})

		// If default device doesn't exist, create it automatically
		if (!defaultDevice) {
			const now = new Date()
			try {
				// Try to create the default device
				defaultDevice = await prisma.device.create({
					data: {
						device_id: 'default-device',
						mac_address: '00:00:00:00:00:00',
						hostname: 'default-carputer',
						vin: '1DEFAULT0000000000',
						hardware_rev: 'rev1.0',
						build_id: 'v1.0.0',
						current_build_id: 'v1.0.0',
						current_version: '1.0.0',
						current_ip: '192.168.1.100',
						status: 'online',
						authorized: true,
						authorized_at: now,
						authorized_by: 'system',
						registration_method: 'manual',
						uptime: BigInt(86400), // 1 day in seconds
						services_status: {
							carputer_hub: true,
							carputer_ui: true,
							network: true,
						},
						first_seen: now,
						last_seen: now,
						last_registration_attempt: now,
						is_default: true,
					},
				})
				console.log('Auto-created default device for template previews')
			} catch (createError: any) {
				// If creation fails due to unique constraint (device_id or mac_address already exists),
				// find the existing device and update it to be the default
				if (
					createError.code === 'P2002' ||
					createError.message?.includes('Unique constraint')
				) {
					console.log(
						'Default device identifiers already exist, updating existing device to be default'
					)
					// Try to find by device_id first
					let existingDevice = await prisma.device.findUnique({
						where: { device_id: 'default-device' },
					})

					// If not found by device_id, try mac_address
					if (!existingDevice) {
						existingDevice = await prisma.device.findUnique({
							where: { mac_address: '00:00:00:00:00:00' },
						})
					}

					// If found, update it to be the default device
					if (existingDevice) {
						defaultDevice = await prisma.device.update({
							where: { id: existingDevice.id },
							data: {
								is_default: true,
								// Update other fields to match defaults if they're null
								hostname:
									existingDevice.hostname || 'default-carputer',
								vin: existingDevice.vin || '1DEFAULT0000000000',
								hardware_rev: existingDevice.hardware_rev || 'rev1.0',
								build_id: existingDevice.build_id || 'v1.0.0',
								current_build_id:
									existingDevice.current_build_id || 'v1.0.0',
								current_version:
									existingDevice.current_version || '1.0.0',
								current_ip:
									existingDevice.current_ip || '192.168.1.100',
								status: existingDevice.status || 'online',
								services_status:
									existingDevice.services_status || {
										carputer_hub: true,
										carputer_ui: true,
										network: true,
									},
							},
						})
						console.log(
							'Updated existing device to be default device for template previews'
						)
					} else {
						// If we can't find it, re-throw the original error
						throw createError
					}
				} else {
					// For other errors, re-throw
					throw createError
				}
			}
		}

		// Convert BigInt values to strings for JSON serialization
		const jsonString = JSON.stringify(defaultDevice, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error: any) {
		console.error('Error fetching default device:', error)
		res.status(500).json({
			error: 'Internal server error',
			message: error?.message || 'Unknown error',
		})
	}
})

/**
 * @swagger
 * /api/admin/defaults/device:
 *   put:
 *     summary: Update default device (for template previews)
 *     description: Updates the default device used for message template previews. Only admin users can update this.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               device_id:
 *                 type: string
 *               hostname:
 *                 type: string
 *                 nullable: true
 *               vin:
 *                 type: string
 *                 nullable: true
 *               hardware_rev:
 *                 type: string
 *                 nullable: true
 *               build_id:
 *                 type: string
 *                 nullable: true
 *               current_version:
 *                 type: string
 *                 nullable: true
 *               current_build_id:
 *                 type: string
 *                 nullable: true
 *               current_ip:
 *                 type: string
 *                 nullable: true
 *               uptime:
 *                 type: number
 *                 nullable: true
 *               services_status:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [online, offline, stale, maintenance]
 *               last_seen:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Default device updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Default device not found
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
router.put('/device', async (req, res) => {
	try {
		const prisma = req.prisma
		const data = updateDefaultDeviceSchema.parse(req.body)

		// Find the default device
		let defaultDevice = await prisma.device.findFirst({
			where: {
				is_default: true,
			},
		})

		// If default device doesn't exist, create it automatically
		if (!defaultDevice) {
			const now = new Date()
			try {
				// Try to create the default device
				defaultDevice = await prisma.device.create({
					data: {
						device_id: 'default-device',
						mac_address: '00:00:00:00:00:00',
						hostname: 'default-carputer',
						vin: '1DEFAULT0000000000',
						hardware_rev: 'rev1.0',
						build_id: 'v1.0.0',
						current_build_id: 'v1.0.0',
						current_version: '1.0.0',
						current_ip: '192.168.1.100',
						status: 'online',
						authorized: true,
						authorized_at: now,
						authorized_by: 'system',
						registration_method: 'manual',
						uptime: BigInt(86400), // 1 day in seconds
						services_status: {
							carputer_hub: true,
							carputer_ui: true,
							network: true,
						},
						first_seen: now,
						last_seen: now,
						last_registration_attempt: now,
						is_default: true,
					},
				})
				console.log('Auto-created default device for template previews')
			} catch (createError: any) {
				// If creation fails due to unique constraint (device_id or mac_address already exists),
				// find the existing device and update it to be the default
				if (
					createError.code === 'P2002' ||
					createError.message?.includes('Unique constraint')
				) {
					console.log(
						'Default device identifiers already exist, updating existing device to be default'
					)
					// Try to find by device_id first
					let existingDevice = await prisma.device.findUnique({
						where: { device_id: 'default-device' },
					})

					// If not found by device_id, try mac_address
					if (!existingDevice) {
						existingDevice = await prisma.device.findUnique({
							where: { mac_address: '00:00:00:00:00:00' },
						})
					}

					// If found, update it to be the default device
					if (existingDevice) {
						defaultDevice = await prisma.device.update({
							where: { id: existingDevice.id },
							data: {
								is_default: true,
								// Update other fields to match defaults if they're null
								hostname:
									existingDevice.hostname || 'default-carputer',
								vin: existingDevice.vin || '1DEFAULT0000000000',
								hardware_rev: existingDevice.hardware_rev || 'rev1.0',
								build_id: existingDevice.build_id || 'v1.0.0',
								current_build_id:
									existingDevice.current_build_id || 'v1.0.0',
								current_version:
									existingDevice.current_version || '1.0.0',
								current_ip:
									existingDevice.current_ip || '192.168.1.100',
								status: existingDevice.status || 'online',
								services_status:
									existingDevice.services_status || {
										carputer_hub: true,
										carputer_ui: true,
										network: true,
									},
							},
						})
						console.log(
							'Updated existing device to be default device for template previews'
						)
					} else {
						// If we can't find it, re-throw the original error
						throw createError
					}
				} else {
					// For other errors, re-throw
					throw createError
				}
			}
		}

		// Prepare update data
		const updateData: any = {}
		if (data.device_id !== undefined) updateData.device_id = data.device_id
		if (data.hostname !== undefined) updateData.hostname = data.hostname
		if (data.vin !== undefined) updateData.vin = data.vin
		if (data.hardware_rev !== undefined)
			updateData.hardware_rev = data.hardware_rev
		if (data.build_id !== undefined) updateData.build_id = data.build_id
		if (data.current_version !== undefined)
			updateData.current_version = data.current_version
		if (data.current_build_id !== undefined)
			updateData.current_build_id = data.current_build_id
		if (data.current_ip !== undefined) updateData.current_ip = data.current_ip
		if (data.uptime !== undefined) updateData.uptime = data.uptime
		if (data.services_status !== undefined)
			updateData.services_status = data.services_status
		if (data.status !== undefined) updateData.status = data.status
		if (data.last_seen !== undefined)
			updateData.last_seen = data.last_seen
				? new Date(data.last_seen)
				: null

		// Update the default device
		const updatedDevice = await prisma.device.update({
			where: {
				id: defaultDevice.id,
			},
			data: updateData,
		})

		// Convert BigInt values to strings for JSON serialization
		const jsonString = JSON.stringify(updatedDevice, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			console.error('Validation error:', error.errors)
			return res.status(400).json({
				error: 'Validation error',
				details: error.errors,
			})
		}
		console.error('Error updating default device:', error)
		res.status(500).json({
			error: 'Internal server error',
			message: error?.message || 'Unknown error',
		})
	}
})

export default router

