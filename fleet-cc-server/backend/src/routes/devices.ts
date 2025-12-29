import express from 'express'
import { z } from 'zod'
import { ImageVerificationService } from '../services/imageVerification'
import { NotificationService } from '../services/notification'
import { DeviceStatusService } from '../services/deviceStatus'
import { authenticateDevice } from '../middleware/deviceAuth'
import { requireAuth } from '../middleware/auth'
import { broadcastDeviceUpdate, broadcastNotification } from '../routes/realtime'
import { handleDeviceOnlineEvent } from '../events/notificationEvents'

const router = express.Router()

// Manual device registration schema (legacy, for backward compatibility)
const deviceRegistrationSchema = z.object({
	deviceId: z.string().min(1),
	hostname: z.string().optional(),
	vin: z.string().optional(),
	hardwareRev: z.string().optional(),
	buildId: z.string().optional(),
	registrationToken: z.string().min(1),
})

// Automatic device registration schema
const autoDeviceRegistrationSchema = z.object({
	macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
		message:
			'MAC address must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
	}),
	deviceId: z.string().min(1).optional(), // Optional, will be generated if not provided
	hostname: z.string().optional(),
	vin: z.string().optional(),
	hardwareRev: z.string().optional(),
	buildId: z.string().optional(),
	imageBuildHash: z.string().min(1), // Required for automatic registration
	imageSignature: z.string().optional(), // Optional signature verification
	version: z.string().optional(),
	ip: z.string().optional(),
})

// Heartbeat schema - macAddress is required for device identification
const heartbeatSchema = z.object({
	macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
		message:
			'MAC address must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
	}),
	deviceId: z.string().min(1).optional(), // Optional, for backward compatibility
	version: z.string().optional(),
	buildId: z.string().optional(),
	uptime: z.number().optional(),
	ip: z.string().optional(),
	services: z.record(z.string(), z.boolean()).optional(),
})

/**
 * @swagger
 * /api/devices/register/auto:
 *   post:
 *     summary: Automatic device registration
 *     description: |
 *       Devices automatically register themselves using their MAC address and image verification.
 *       This endpoint:
 *       1. Verifies the device is running a verified carputer image
 *       2. Registers the device using MAC address as the primary identifier
 *       3. Automatically authorizes devices with verified images
 *       4. Updates existing devices if they re-register (e.g., after updates)
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - macAddress
 *               - imageBuildHash
 *             properties:
 *               macAddress:
 *                 type: string
 *                 pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
 *                 example: "AA:BB:CC:DD:EE:FF"
 *               deviceId:
 *                 type: string
 *                 description: Optional, will be generated if not provided
 *               hostname:
 *                 type: string
 *               vin:
 *                 type: string
 *               hardwareRev:
 *                 type: string
 *               buildId:
 *                 type: string
 *               imageBuildHash:
 *                 type: string
 *                 description: Required for automatic registration
 *               imageSignature:
 *                 type: string
 *                 description: Optional signature verification
 *               version:
 *                 type: string
 *               ip:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device re-registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 device:
 *                   $ref: '#/components/schemas/Device'
 *                 message:
 *                   type: string
 *                 authorized:
 *                   type: boolean
 *                 imageUnknown:
 *                   type: boolean
 *                 imageVerified:
 *                   type: boolean
 *                 requiresReview:
 *                   type: boolean
 *       201:
 *         description: Device registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 device:
 *                   $ref: '#/components/schemas/Device'
 *                 message:
 *                   type: string
 *                 authorized:
 *                   type: boolean
 *                 imageUnknown:
 *                   type: boolean
 *                 imageVerified:
 *                   type: boolean
 *                 requiresReview:
 *                   type: boolean
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Image signature invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Device ID conflict
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
router.post('/register/auto', async (req, res) => {
	const prisma = req.prisma
	const clientIp = req.ip || req.socket.remoteAddress || 'unknown'

	try {
		const data = autoDeviceRegistrationSchema.parse(req.body)

		// Initialize image verification service
		const imageVerification = new ImageVerificationService(prisma)

		// Get or create image (creates with verified=false if it doesn't exist)
		const image = await imageVerification.getOrCreateImage(
			data.imageBuildHash,
			{
				signature: data.imageSignature,
				buildId: data.buildId,
				gitSha: undefined, // Not provided in registration
				buildTimestamp: undefined, // Not provided in registration
				verified: undefined, // Will be false if new image
			}
		)

		// Check if image is verified
		const isImageVerified = image.verified && image.is_active

		// Verify image signature if provided and image is verified
		if (data.imageSignature && isImageVerified) {
			const isSignatureValid =
				await imageVerification.verifyImageSignature(
					data.imageBuildHash,
					data.imageSignature
				)

			if (!isSignatureValid) {
				await prisma.deviceRegistrationAttempt.create({
					data: {
						mac_address: data.macAddress,
						device_id: data.deviceId || null,
						ip_address: clientIp,
						image_build_hash: data.imageBuildHash,
						image_signature: data.imageSignature,
						registration_method: 'auto',
						success: false,
						error_message: 'Image signature verification failed',
					},
				})

				return res.status(403).json({
					error: 'Image signature invalid',
					message: 'Image signature verification failed',
				})
			}
		}

		// Allow registration even for unverified images, but they need manual review
		// Only verified images get automatic authorization
		const shouldAutoAuthorize = isImageVerified

		// Generate device ID if not provided (use MAC-based ID)
		const deviceId =
			data.deviceId ||
			`carputer-${data.macAddress.replace(/[:-]/g, '').toLowerCase()}`

		// Check if device already exists by MAC address
		const existingDeviceByMac = await prisma.device.findUnique({
			where: { mac_address: data.macAddress },
		})

		// Check if device ID is already taken by a different device
		const existingDeviceById = await prisma.device.findUnique({
			where: { device_id: deviceId },
		})

		let device
		let isNewDevice = false
		let wasOffline = false

		if (existingDeviceByMac) {
			// Device exists - update it (handles re-registration after updates)
			device = existingDeviceByMac

			// Track if device was previously offline
			wasOffline = device.status === 'offline'

			// Update authorization if image is now verified and device wasn't authorized
			const newAuthorized = shouldAutoAuthorize ? true : device.authorized
			const now = new Date()

			// Update device information
			device = await prisma.device.update({
				where: { mac_address: data.macAddress },
				data: {
					device_id: deviceId,
					hostname: data.hostname || device.hostname,
					vin: data.vin || device.vin,
					hardware_rev: data.hardwareRev || device.hardware_rev,
					build_id: data.buildId || device.build_id,
					current_build_id: data.buildId || device.current_build_id,
					image_id: image.id,
					image_build_hash: data.imageBuildHash,
					image_signature:
						data.imageSignature || device.image_signature,
					image_verified: isImageVerified,
					image_verified_at: isImageVerified
						? now
						: device.image_verified_at,
					current_version: data.version || device.current_version,
					current_ip: data.ip || clientIp,
					registration_ip: data.ip || clientIp,
					authorized: newAuthorized,
					authorized_at:
						newAuthorized && !device.authorized_at
							? now
							: device.authorized_at,
					authorized_by:
						newAuthorized && !device.authorized_by
							? 'auto'
							: device.authorized_by,
					last_registration_attempt: now,
					status: 'online',
					last_seen: now,
				},
			})
		} else if (
			existingDeviceById &&
			existingDeviceById.mac_address !== data.macAddress
		) {
			// Device ID conflict - different MAC address
			await prisma.deviceRegistrationAttempt.create({
				data: {
					mac_address: data.macAddress,
					device_id: deviceId,
					ip_address: clientIp,
					image_build_hash: data.imageBuildHash,
					image_signature: data.imageSignature || null,
					registration_method: 'auto',
					success: false,
					error_message:
						'Device ID already registered to different MAC address',
				},
			})

			return res.status(409).json({
				error: 'Device ID conflict',
				message:
					'Device ID is already registered to a different device',
			})
		} else {
			// New device - register it
			isNewDevice = true
			const now = new Date()

			device = await prisma.device.create({
				data: {
					device_id: deviceId,
					mac_address: data.macAddress,
					hostname: data.hostname || null,
					vin: data.vin || null,
					hardware_rev: data.hardwareRev || null,
					build_id: data.buildId || null,
					current_build_id: data.buildId || null,
					image_id: image.id,
					image_build_hash: data.imageBuildHash,
					image_signature: data.imageSignature || null,
					image_verified: isImageVerified,
					image_verified_at: isImageVerified ? now : null,
					current_version: data.version || null,
					current_ip: data.ip || clientIp,
					registration_ip: data.ip || clientIp,
					registration_method: 'auto',
					authorized: shouldAutoAuthorize,
					authorized_at: shouldAutoAuthorize ? now : null,
					authorized_by: shouldAutoAuthorize ? 'auto' : null,
					status: 'online',
					first_seen: now,
					last_seen: now,
					last_registration_attempt: now,
				},
			})
		}

		// Log successful registration
		await prisma.deviceRegistrationAttempt.create({
			data: {
				mac_address: data.macAddress,
				device_id: device.device_id,
				ip_address: clientIp,
				image_build_hash: data.imageBuildHash,
				image_signature: data.imageSignature || null,
				registration_method: 'auto',
				success: true,
			},
		})

		// Trigger wiring-based triggers if device came online (new device or was offline)
		// This should happen regardless of whether the legacy notification creation succeeds
		if (isNewDevice || wasOffline) {
			try {
				await handleDeviceOnlineEvent(device.id, {
					hostname: device.hostname,
					mac_address: device.mac_address,
					ip: device.current_ip,
					registration_method: device.registration_method,
				})
			} catch (eventError) {
				// Log but don't fail - event listeners are optional
				console.error('Failed to handle device online event:', eventError)
			}
		}

		// Create legacy notification if device came online (new device or was offline)
		// This is kept for backward compatibility but may fail if the method is deprecated
		if (isNewDevice || wasOffline) {
			try {
				const notificationService = new NotificationService(prisma)
				const notification = await notificationService.createDeviceOnlineNotification(
					device.id,
					{
						message: isNewDevice
							? `Device ${device.hostname || device.device_id} has registered and come online`
							: `Device ${device.hostname || device.device_id} has re-registered and come back online`,
						metadata: {
							registration_method: device.registration_method,
							image_verified: isImageVerified,
							authorized: device.authorized,
						},
					}
				)

				// Broadcast device update and notification to all connected clients
				try {
					broadcastDeviceUpdate(device, notification)
					broadcastNotification(notification)
				} catch (broadcastError) {
					// Log broadcast error but don't fail registration
					console.error('Failed to broadcast device update:', broadcastError)
				}
			} catch (notificationError) {
				// Log notification error but don't fail registration
				// The wiring executor will handle notifications via show_notification events
				console.error(
					'Failed to create legacy online notification:',
					notificationError
				)
				// Still broadcast device update even if notification fails
				try {
					broadcastDeviceUpdate(device)
				} catch (broadcastError) {
					console.error('Failed to broadcast device update:', broadcastError)
				}
			}
		} else {
			// Still broadcast device update for registration/re-registration
			try {
				broadcastDeviceUpdate(device)
			} catch (broadcastError) {
				console.error('Failed to broadcast device update:', broadcastError)
			}
		}

		res.status(isNewDevice ? 201 : 200).json({
			device,
			message: isNewDevice
				? 'Device registered successfully'
				: 'Device re-registered successfully',
			authorized: device.authorized,
			imageVerified: image.verified,
			requiresReview: !image.verified,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Automatic device registration error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/devices/register:
 *   post:
 *     summary: Manual device registration (Legacy)
 *     description: |
 *       For backward compatibility. Manual registration requires a registration token.
 *       New devices should use /register/auto instead.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - registrationToken
 *             properties:
 *               deviceId:
 *                 type: string
 *               hostname:
 *                 type: string
 *               vin:
 *                 type: string
 *               hardwareRev:
 *                 type: string
 *               buildId:
 *                 type: string
 *               registrationToken:
 *                 type: string
 *     responses:
 *       201:
 *         description: Device registered successfully
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
 *       401:
 *         description: Invalid registration token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Device already registered
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
router.post('/register', async (req, res) => {
	try {
		const data = deviceRegistrationSchema.parse(req.body)

		// Validate registration token
		const expectedToken = process.env.DEVICE_REGISTRATION_TOKEN
		if (!expectedToken || data.registrationToken !== expectedToken) {
			return res.status(401).json({ error: 'Invalid registration token' })
		}

		const prisma = req.prisma

		// Check if device already exists
		const existingDevice = await prisma.device.findUnique({
			where: { device_id: data.deviceId },
			select: { id: true },
		})

		if (existingDevice) {
			return res.status(409).json({ error: 'Device already registered' })
		}

		// Insert new device (manual registration - not auto-authorized)
		const device = await prisma.device.create({
			data: {
				device_id: data.deviceId,
				hostname: data.hostname || null,
				vin: data.vin || null,
				hardware_rev: data.hardwareRev || null,
				build_id: data.buildId || null,
				status: 'offline',
				registration_method: 'manual',
			},
		})

		res.status(201).json(device)
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Device registration error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/devices/heartbeat:
 *   post:
 *     summary: Device heartbeat
 *     description: |
 *       Devices send periodic heartbeats to indicate they're online. MAC address is required for device identification (primary identifier). Only authorized devices can send heartbeats.
 *
 *       Authentication Options: Device Authentication (Legacy) uses X-Device-MAC or X-Device-ID headers. API Key Authentication uses Authorization header with Bearer token (API key). When using API Key authentication, the API key must be sent in Authorization header as "Authorization: Bearer <api-key>", the MAC address must be in the request body (not headers), the API key is used for authorization, and MAC address is used for device identification.
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []  # Primary: API key or JWT token authentication
 *       - deviceAuth: []  # Legacy: Device MAC address authentication
 *       - deviceIdAuth: []  # Legacy: Device ID authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - macAddress
 *             properties:
 *               macAddress:
 *                 type: string
 *                 pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
 *                 description: Required - MAC address for device identification. Must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX. When using API key authentication, this must be in the request body.
 *                 example: "AA:BB:CC:DD:EE:FF"
 *               deviceId:
 *                 type: string
 *                 description: Optional - for backward compatibility
 *               version:
 *                 type: string
 *                 description: Device version string
 *               buildId:
 *                 type: string
 *                 description: Build ID
 *               uptime:
 *                 type: number
 *                 description: Device uptime in seconds
 *               ip:
 *                 type: string
 *                 description: Current IP address
 *               services:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 description: Service status map
 *           examples:
 *             apiKeyAuth:
 *               summary: Using API Key Authentication
 *               description: Example request when using API key authentication
 *               value:
 *                 macAddress: "AA:BB:CC:DD:EE:FF"
 *                 version: "1.0.0"
 *                 buildId: "build-123"
 *                 uptime: 3600
 *                 ip: "192.168.1.100"
 *             deviceAuth:
 *               summary: Using Device Authentication (Legacy)
 *               description: Example request when using device authentication headers
 *               value:
 *                 macAddress: "AA:BB:CC:DD:EE:FF"
 *                 deviceId: "device-123"
 *                 version: "1.0.0"
 *     responses:
 *       200:
 *         description: Heartbeat received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 deviceId:
 *                   type: string
 *                 authorized:
 *                   type: boolean
 *                 pendingCommands:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Command'
 *       400:
 *         description: Validation error or device identifier required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Device not authorized
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
router.post('/heartbeat', authenticateDevice, async (req, res) => {
	try {
		const data = heartbeatSchema.parse(req.body)
		const prisma = req.prisma

		// When API key authentication is used, MAC address must come from request body
		// When device authentication is used (via headers), MAC address can come from header or body
		const isApiKeyAuth = !!req.apiKey
		const macAddressFromHeader = req.headers['x-device-mac'] as string
		const macAddressFromBody = data.macAddress

		// If API key is used, prioritize body MAC address (required for device identification)
		// If device auth is used, allow header or body
		const macAddress = isApiKeyAuth
			? macAddressFromBody
			: (macAddressFromHeader || macAddressFromBody)

		const deviceId = (req.headers['x-device-id'] as string) || data.deviceId

		// Validate MAC address format and reject template placeholders
		if (!macAddress) {
			return res.status(400).json({
				error: 'MAC address required',
				message: isApiKeyAuth
					? 'macAddress is required in request body for device identification when using API key authentication'
					: 'macAddress is required in request body or x-device-mac header for device identification',
			})
		}

		// Check if MAC address looks like a UUID (API key format) - common mistake
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		if (uuidRegex.test(macAddress)) {
			console.error('[Heartbeat] Invalid MAC address - appears to be an API key (UUID):', {
				headerValue: macAddressFromHeader,
				bodyValue: macAddressFromBody,
				isApiKeyAuth: isApiKeyAuth,
			})
			return res.status(400).json({
				error: 'Invalid MAC address format',
				message:
					'The provided MAC address appears to be an API key. API keys should be sent in the Authorization header (Bearer <key>), and the MAC address should be in the request body in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
			})
		}

		// Check for template placeholders or invalid MAC address format
		if (macAddress.includes('{{') || macAddress.includes('${')) {
			console.error('[Heartbeat] Invalid MAC address format - appears to contain template placeholder:', {
				headerValue: macAddressFromHeader,
				bodyValue: macAddressFromBody,
			})
			return res.status(400).json({
				error: 'Invalid MAC address format',
				message:
					'MAC address appears to contain a template placeholder. Please provide a valid MAC address in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
			})
		}

		// Validate MAC address format matches regex
		const macAddressRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
		if (!macAddressRegex.test(macAddress)) {
			console.error('[Heartbeat] Invalid MAC address format:', {
				headerValue: macAddressFromHeader,
				bodyValue: macAddressFromBody,
			})
			return res.status(400).json({
				error: 'Invalid MAC address format',
				message:
					'MAC address must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
			})
		}

		console.log('[Heartbeat] Looking up device with MAC address:', macAddress)
		// Find device by MAC address (primary identifier)
		const device = await prisma.device.findUnique({
			where: { mac_address: macAddress },
		})

		if (!device) {
			console.warn('[Heartbeat] Device not found for MAC address:', macAddress)
			return res.status(404).json({
				error: 'Device not found',
				message: `Device with MAC address ${macAddress} must be registered before sending heartbeats`,
			})
		}

		// Check if device is authorized
		if (!device.authorized) {
			return res.status(403).json({
				error: 'Device not authorized',
				message: 'Device registration is pending authorization',
			})
		}

		// Track if device was previously offline
		const wasOffline = device.status === 'offline'

		// Update device status
		// Convert uptime to integer before converting to BigInt (handles float values)
		const uptimeValue = data.uptime
			? BigInt(Math.round(Number(data.uptime)))
			: device.uptime

		// Ensure mac_address is set if it wasn't already
		const updatedDevice = await prisma.device.update({
			where: { id: device.id },
			data: {
				mac_address: macAddress, // Ensure mac_address is set/updated
				last_seen: new Date(),
				current_version: data.version || device.current_version,
				current_build_id: data.buildId || device.current_build_id,
				current_ip: data.ip || device.current_ip,
				uptime: uptimeValue,
				services_status: data.services
					? data.services
					: device.services_status || undefined,
				status: 'online',
			},
		})

		// Trigger wiring-based triggers if device came online (was previously offline)
		// This should happen regardless of whether the legacy notification creation succeeds
		if (wasOffline) {
			try {
				await handleDeviceOnlineEvent(device.id, {
					hostname: device.hostname,
					mac_address: macAddress,
					ip: device.current_ip,
					uptime: data.uptime,
					version: data.version,
				})
			} catch (eventError) {
				// Log but don't fail - event listeners are optional
				console.error('Failed to handle device online event:', eventError)
			}
		}

		// Create legacy notification if device came online (was previously offline)
		// This is kept for backward compatibility but may fail if the method is deprecated
		let notification = null
		if (wasOffline) {
			try {
				const notificationService = new NotificationService(prisma)
				notification = await notificationService.createDeviceOnlineNotification(
					device.id,
					{
						message: `Device ${device.hostname || device.device_id} has sent heartbeat and come back online`,
						metadata: {
							uptime: data.uptime,
							version: data.version,
							build_id: data.buildId,
							services: data.services,
						},
					}
				)
			} catch (notificationError) {
				// Log notification error but don't fail heartbeat
				// The wiring executor will handle notifications via show_notification events
				console.error(
					'Failed to create legacy online notification:',
					notificationError
				)
			}
		}

		// Always broadcast device update on heartbeat (wrapped in try-catch)
		try {
			if (notification) {
				broadcastDeviceUpdate(updatedDevice, notification)
				broadcastNotification(notification)
			} else {
				broadcastDeviceUpdate(updatedDevice)
			}
		} catch (broadcastError) {
			// Log broadcast error but don't fail heartbeat
			console.error('Failed to broadcast device update:', broadcastError)
		}

		// Check for pending commands
		const commands = await prisma.command.findMany({
			where: {
				device_id: device.id,
				status: 'pending',
			},
			orderBy: {
				created_at: 'asc',
			},
			take: 10,
		})

		res.json({
			status: 'ok',
			deviceId: device.device_id,
			authorized: device.authorized,
			pendingCommands: commands,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Heartbeat error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Get all devices
 *     description: Returns a list of all registered devices, sorted by status (online first), then by last_seen, then by device_id
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of devices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Device'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const deviceStatusService = new DeviceStatusService(prisma)

		// Get all devices with status check (automatically marks offline devices)
		const devices = await deviceStatusService.getAllDevicesWithStatusCheck()

		// Custom sort: online first, then by last_seen (desc), then by device_id (asc)
		const sortedDevices = devices.sort((a, b) => {
			const statusOrder = { online: 1, offline: 2 }
			const aOrder =
				statusOrder[a.status as keyof typeof statusOrder] || 3
			const bOrder =
				statusOrder[b.status as keyof typeof statusOrder] || 3
			if (aOrder !== bOrder) return aOrder - bOrder
			if (a.last_seen && b.last_seen) {
				return b.last_seen.getTime() - a.last_seen.getTime()
			}
			if (a.last_seen) return -1
			if (b.last_seen) return 1
			return a.device_id.localeCompare(b.device_id)
		})

		// Convert BigInt values to strings for JSON serialization
		// Use JSON.stringify with a replacer function to handle BigInt values
		const jsonString = JSON.stringify(sortedDevices, (key, value) =>
			typeof value === 'bigint' ? value.toString() : value
		)

		res.setHeader('Content-Type', 'application/json')
		res.send(jsonString)
	} catch (error) {
		console.error('Get devices error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/devices/{deviceId}:
 *   get:
 *     summary: Get device by ID
 *     description: Returns a single device by its device_id
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device identifier
 *     responses:
 *       200:
 *         description: Device details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       401:
 *         description: Unauthorized
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
router.get('/:deviceId', requireAuth, async (req, res) => {
	try {
		const prisma = req.prisma
		const device = await prisma.device.findUnique({
			where: { device_id: req.params.deviceId },
		})

		if (!device) {
			return res.status(404).json({ error: 'Device not found' })
		}

		res.json(device)
	} catch (error) {
		console.error('Get device error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
