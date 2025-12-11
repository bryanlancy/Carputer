import { PrismaClient } from '@prisma/client'
import { generateFakeDataFromSchema } from '../utils/fakeDataGenerator'
import { TemplateService } from './template'
import { TagService } from './tagService'

/**
 * Notification Service
 *
 * Manages creation and retrieval of notifications for various system events.
 * Supports extensible notification types and linking to device logs for deeper tracking.
 */
export class NotificationService {
	constructor(private prisma: PrismaClient) {}

	/**
	 * Get or create a notification by name
	 */
	async getOrCreateNotification(
		name: string,
		options: {
			description?: string
			priority?: number
			enabled?: boolean
		} = {}
	): Promise<any> {
		if (!name) {
			throw new Error('Notification name is required')
		}

		// Try to get existing notification
		let notification = await this.prisma.notification.findFirst({
			where: { name: name },
		})

		if (notification) {
			return notification
		}

		// Create new notification
		notification = await this.prisma.notification.create({
			data: {
				name: name,
				description: options.description || null,
				priority: options.priority || 0,
				enabled: options.enabled !== undefined ? options.enabled : true,
			},
		})

		return notification
	}

	/**
	 * Create a notification for a device
	 */
	async createNotification(
		deviceId: number,
		typeCode: string,
		options: {
			title?: string
			message?: string
			metadata?: any
			deviceLogId?: number
			show_in_feed?: boolean
		} = {}
	): Promise<any> {
		if (!deviceId || !typeCode) {
			throw new Error('Device ID and notification type code are required')
		}

		// Get or create notification (using typeCode as name for backward compatibility)
		const notificationType = await this.getOrCreateNotification(typeCode)

		if (!notificationType.enabled) {
			throw new Error(`Notification ${typeCode} is disabled`)
		}

		// Generate default title if not provided
		const title =
			options.title || `${notificationType.name} - Device ${deviceId}`

		// Note: notification_instances table has been removed
		// This method may need to be refactored based on new requirements
		throw new Error(
			'createNotification is deprecated - notification_instances table has been removed'
		)
	}

	/**
	 * Create a device online notification
	 */
	async createDeviceOnlineNotification(
		deviceId: number,
		options: {
			message?: string
			metadata?: any
			deviceLogId?: number
		} = {}
	): Promise<any> {
		const device = await this.prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				device_id: true,
				hostname: true,
				current_ip: true,
				last_seen: true,
			},
		})

		if (!device) {
			throw new Error(`Device with ID ${deviceId} not found`)
		}

		const hostname = device.hostname || device.device_id
		const title = `Device ${hostname} came online`
		const message =
			options.message ||
			`Device ${hostname} has successfully established connection. ${
				device.current_ip ? `IP: ${device.current_ip}` : ''
			}`

		return this.createNotification(deviceId, 'device.online', {
			title,
			message,
			metadata: {
				...options.metadata,
				ip: device.current_ip,
				last_seen: device.last_seen,
			},
			deviceLogId: options.deviceLogId,
		})
	}

	/**
	 * Create a device offline notification
	 */
	async createDeviceOfflineNotification(
		deviceId: number,
		options: {
			message?: string
			metadata?: any
			deviceLogId?: number
		} = {}
	): Promise<any> {
		const device = await this.prisma.device.findUnique({
			where: { id: deviceId },
			select: {
				device_id: true,
				hostname: true,
				current_ip: true,
				last_seen: true,
			},
		})

		if (!device) {
			throw new Error(`Device with ID ${deviceId} not found`)
		}

		const hostname = device.hostname || device.device_id
		const title = `Device ${hostname} went offline`
		const message =
			options.message ||
			`Device ${hostname} has lost connection or gone offline. ${
				device.last_seen
					? `Last seen: ${device.last_seen.toISOString()}`
					: ''
			}`

		return this.createNotification(deviceId, 'device.offline', {
			title,
			message,
			metadata: {
				...options.metadata,
				ip: device.current_ip,
				last_seen: device.last_seen,
			},
			deviceLogId: options.deviceLogId,
		})
	}

	/**
	 * Get notifications for a device
	 */
	async getDeviceNotifications(
		deviceId: number,
		options: {
			unreadOnly?: boolean
			limit?: number
			offset?: number
			orderBy?: 'created_at' | 'read'
			order?: 'asc' | 'desc'
		} = {}
	): Promise<any[]> {
		const where: any = {
			device_id: deviceId,
		}

		// Note: read status is now handled in UserNotification, not Notification
		// This method can't filter by read status anymore

		// Note: notification_instances table has been removed
		// This method may need to be refactored based on new requirements
		throw new Error(
			'getDeviceNotifications is deprecated - notification_instances table has been removed'
		)
	}

	/**
	 * Get all notifications
	 */
	async getAllNotifications(
		options: {
			unreadOnly?: boolean
			deviceId?: number
			typeCode?: string
			limit?: number
			offset?: number
			orderBy?: 'created_at' | 'read'
			order?: 'asc' | 'desc'
		} = {}
	): Promise<any[]> {
		const where: any = {}

		// Note: read status is now handled in UserNotification, not Notification
		// This method can't filter by read status anymore

		if (options.deviceId) {
			where.device_id = options.deviceId
		}

		if (options.typeCode) {
			const notificationType = await this.prisma.notification.findFirst({
				where: { name: options.typeCode },
			})
			if (notificationType) {
				// Note: This method is deprecated, but keeping for backward compatibility
				// where.notification_type_id = notificationType.id;
			}
		}

		// Note: notification_instances table has been removed
		// This method may need to be refactored based on new requirements
		throw new Error(
			'getAllNotifications is deprecated - notification_instances table has been removed'
		)
	}

	/**
	 * Mark notification as read
	 * @deprecated Use UserNotification methods instead - read status is now per-user
	 */
	async markAsRead(notificationId: number): Promise<any> {
		// This method is deprecated - read status is now in UserNotification
		throw new Error(
			'markAsRead is deprecated. Use UserNotification methods instead.'
		)
	}

	/**
	 * Mark all notifications as read for a device
	 * @deprecated Use UserNotification methods instead - read status is now per-user
	 */
	async markAllAsRead(deviceId: number): Promise<{ count: number }> {
		// This method is deprecated - read status is now in UserNotification
		throw new Error(
			'markAllAsRead is deprecated. Use UserNotification methods instead.'
		)
	}

	/**
	 * Get unread notification count for a device
	 * @deprecated Use UserNotification methods instead - read status is now per-user
	 */
	async getUnreadCount(deviceId: number): Promise<number> {
		// This method is deprecated - read status is now in UserNotification
		throw new Error(
			'getUnreadCount is deprecated. Use UserNotification methods instead.'
		)
	}

	/**
	 * Get unread notification count for all devices
	 * @deprecated Use UserNotification methods instead - read status is now per-user
	 */
	async getTotalUnreadCount(): Promise<number> {
		// This method is deprecated - read status is now in UserNotification
		throw new Error(
			'getTotalUnreadCount is deprecated. Use UserNotification methods instead.'
		)
	}

	// ============================================
	// USER-BASED NOTIFICATION METHODS (NEW)
	// ============================================

	/**
	 * Create a notification for specific users
	 * Creates the notification and links it to the specified users
	 */
	async createUserNotification(
		userIds: string[],
		typeCode: string,
		options: {
			deviceId?: number
			title?: string
			message?: string
			metadata?: any
			deviceLogId?: number
		} = {}
	): Promise<any> {
		if (!userIds || userIds.length === 0) {
			throw new Error('At least one user ID is required')
		}

		if (!typeCode) {
			throw new Error('Notification type code is required')
		}

		// Note: notification_instances table has been removed
		// This method may need to be refactored based on new requirements
		throw new Error(
			'createUserNotification is deprecated - notification_instances table has been removed'
		)
	}

	/**
	 * Create notification for users based on roles
	 */
	async createNotificationForRoles(
		roles: string[],
		typeCode: string,
		options: {
			deviceId?: number
			title?: string
			message?: string
			metadata?: any
			deviceLogId?: number
		} = {}
	): Promise<any> {
		// Find all users with the specified roles
		const users = await this.prisma.user.findMany({
			where: {
				user_roles: {
					some: {
						role: {
							in: roles,
						},
					},
				},
			},
			select: {
				id: true,
			},
		})

		if (users.length === 0) {
			throw new Error(`No users found with roles: ${roles.join(', ')}`)
		}

		const userIds = users.map(u => u.id)
		return this.createUserNotification(userIds, typeCode, options)
	}

	/**
	 * Create notification for all users
	 */
	async createNotificationForAllUsers(
		typeCode: string,
		options: {
			deviceId?: number
			title?: string
			message?: string
			metadata?: any
			deviceLogId?: number
		} = {}
	): Promise<any> {
		// Get all users
		const users = await this.prisma.user.findMany({
			select: {
				id: true,
			},
		})

		if (users.length === 0) {
			throw new Error('No users found in system')
		}

		const userIds = users.map(u => u.id)
		return this.createUserNotification(userIds, typeCode, options)
	}

	/**
	 * Get notifications for a specific user
	 */
	async getUserNotifications(
		userId: string,
		options: {
			unviewedOnly?: boolean
			limit?: number
			offset?: number
			orderBy?: 'created_at' | 'viewed'
			order?: 'asc' | 'desc'
		} = {}
	): Promise<any[]> {
		const where: any = {
			user_id: userId,
		}

		if (options.unviewedOnly) {
			where.viewed = false
		}

		// Note: notifications table now stores templates, not instances
		const userNotifications = await this.prisma.userNotification.findMany({
			where,
			include: {
				notification: true,
			},
			orderBy: {
				[options.orderBy === 'viewed' ? 'viewed_at' : 'created_at']:
					options.order || 'desc',
			},
			take: options.limit || 100,
			skip: options.offset || 0,
		})

		// Transform to include viewed status
		return userNotifications.map(un => ({
			...un.notification,
			viewed: un.viewed,
			viewed_at: un.viewed_at,
			user_notification_id: un.id,
		}))
	}

	/**
	 * Mark notification as viewed by user
	 * @deprecated Use direct UserNotification.id update instead
	 * This method is kept for backward compatibility but may not work correctly
	 * if multiple user_notifications exist for the same notification_id
	 */
	async markAsViewedByUser(
		notificationId: number,
		userId: string
	): Promise<any> {
		// Find the most recent unviewed user_notification for this notification_id and user
		const userNotification = await this.prisma.userNotification.findFirst({
			where: {
				user_id: userId,
				notification_id: notificationId,
				viewed: false,
			},
			orderBy: {
				created_at: 'desc',
			},
		})

		if (!userNotification) {
			throw new Error('Notification not found for user')
		}

		return this.prisma.userNotification.update({
			where: {
				id: userNotification.id,
			},
			data: {
				viewed: true,
				viewed_at: new Date(),
			},
			include: {
				notification: true,
			},
		})
	}

	/**
	 * Mark all notifications as viewed for a user
	 */
	async markAllAsViewedByUser(userId: string): Promise<{ count: number }> {
		return this.prisma.userNotification.updateMany({
			where: {
				user_id: userId,
				viewed: false,
			},
			data: {
				viewed: true,
				viewed_at: new Date(),
			},
		})
	}

	/**
	 * Get unviewed notification count for a user
	 * Only counts notifications that should appear in the feed (hidden = false, show_in_feed = true)
	 */
	async getUnviewedCountForUser(userId: string): Promise<number> {
		return this.prisma.userNotification.count({
			where: {
				user_id: userId,
				viewed: false,
				hidden: false, // Only count non-hidden notifications
				notification: {
					show_in_feed: true, // Only count notifications that should appear in feed
				},
			},
		})
	}

	/**
	 * Deliver notification to users based on rules
	 * This is called by the notification rules engine
	 */
	async deliverNotificationToUsers(
		notification: any,
		targetUsers: string[] | null,
		targetRoles: string[] | null
	): Promise<void> {
		let userIds: string[] = []

		if (targetUsers && targetUsers.length > 0) {
			// Direct user targeting
			userIds = targetUsers
		} else if (targetRoles && targetRoles.length > 0) {
			// Role-based targeting
			const users = await this.prisma.user.findMany({
				where: {
					user_roles: {
						some: {
							role: {
								in: targetRoles,
							},
						},
					},
				},
				select: {
					id: true,
				},
			})
			userIds = users.map(u => u.id)
		} else {
			// All users
			const users = await this.prisma.user.findMany({
				select: {
					id: true,
				},
			})
			userIds = users.map(u => u.id)
		}

		// Get the full notification record to access template and schema
		const fullNotification = await this.prisma.notification.findUnique({
			where: { id: notification.id },
		})

		if (!fullNotification) {
			console.error(`Notification ${notification.id} not found`)
			return
		}

		// Render the message template to store in content field
		// This allows viewing the notification even if the template is deleted later
		let renderedContent: string | null = null
		if (fullNotification.message_template) {
			if (fullNotification.variable_schema) {
				// Generate fake data from schema to render template
				try {
					const fakeData = generateFakeDataFromSchema(
						fullNotification.variable_schema
					)
					// Ensure timestamp is always a Date object if it exists
					// This is needed for proper formatting with custom formats
					// Also handle nested timestamps (e.g., device.timestamp)
					const visited = new WeakSet()
					const ensureTimestampIsDate = (obj: any): void => {
						if (
							!obj ||
							typeof obj !== 'object' ||
							Array.isArray(obj) ||
							obj instanceof Date
						) {
							return
						}

						// Prevent circular reference infinite recursion
						if (visited.has(obj)) {
							return
						}
						visited.add(obj)

						// Check top-level timestamp
						if ('timestamp' in obj) {
							if (typeof obj.timestamp === 'string') {
								obj.timestamp = new Date(obj.timestamp)
							} else if (!(obj.timestamp instanceof Date)) {
								obj.timestamp = new Date()
							}
						} else {
							// Add timestamp if it doesn't exist (common case)
							obj.timestamp = new Date()
						}

						// Recursively check nested objects
						for (const key in obj) {
							if (
								obj.hasOwnProperty(key) &&
								typeof obj[key] === 'object' &&
								obj[key] !== null &&
								!Array.isArray(obj[key]) &&
								!(obj[key] instanceof Date)
							) {
								ensureTimestampIsDate(obj[key])
							}
						}
					}

					if (
						fakeData &&
						typeof fakeData === 'object' &&
						!Array.isArray(fakeData)
					) {
						ensureTimestampIsDate(fakeData)
					}

					renderedContent = TemplateService.render(
						fullNotification.message_template,
						fakeData
					)
				} catch (error) {
					console.error(
						`Failed to render template for notification ${notification.id}:`,
						error
					)
					// Fall back to template as-is if rendering fails
					renderedContent = fullNotification.message_template
				}
			} else {
				// No variable schema, use template as-is
				renderedContent = fullNotification.message_template
			}
		} else {
			// No template, use notification name
			renderedContent = fullNotification.name
		}

		// Link notification to users
		for (const userId of userIds) {
			try {
				// Check if user_notification already exists to avoid duplicates
				const existing = await this.prisma.userNotification.findFirst({
					where: {
						user_id: userId,
						notification_id: notification.id,
					},
				})

				if (!existing) {
					// Only create if it doesn't exist
					await this.prisma.userNotification.create({
						data: {
							user_id: userId,
							notification_id: notification.id,
							viewed: false,
							content: renderedContent, // Store rendered content
						},
					})
				}
			} catch (error: any) {
				// Log but don't fail if there's an issue
				console.error(
					`Failed to link notification ${notification.id} to user ${userId}:`,
					error
				)
			}
		}
	}

	/**
	 * Create a test notification for a specific user with fake data
	 * Creates a UserNotification entry using the existing notification template
	 * Does NOT create a new Notification record - uses the existing one
	 * Used for testing notifications without actually triggering them
	 */
	async createTestNotificationForUser(
		userId: string,
		notificationId: number,
		fakeData?: any
	): Promise<any> {
		const tagService = new TagService(this.prisma)

		// Get the notification template (use existing, don't create new)
		const templateNotification = await this.prisma.notification.findUnique({
			where: { id: notificationId },
		})

		if (!templateNotification) {
			throw new Error(`Notification ${notificationId} not found`)
		}

		if (!templateNotification.enabled) {
			throw new Error(`Notification ${notificationId} is disabled`)
		}

		// Generate fake data if not provided
		let testData = fakeData
		// Helper to ensure timestamps are Date objects
		// Use WeakSet to track visited objects and prevent circular reference infinite recursion
		const visited = new WeakSet()
		const ensureTimestampIsDate = (obj: any): void => {
			if (
				!obj ||
				typeof obj !== 'object' ||
				Array.isArray(obj) ||
				obj instanceof Date
			) {
				return
			}

			// Prevent circular reference infinite recursion
			if (visited.has(obj)) {
				return
			}
			visited.add(obj)

			// Check top-level timestamp
			if ('timestamp' in obj) {
				if (typeof obj.timestamp === 'string') {
					obj.timestamp = new Date(obj.timestamp)
				} else if (!(obj.timestamp instanceof Date)) {
					obj.timestamp = new Date()
				}
			} else {
				// Add timestamp if it doesn't exist (common case)
				obj.timestamp = new Date()
			}

			// Recursively check nested objects
			for (const key in obj) {
				if (
					obj.hasOwnProperty(key) &&
					typeof obj[key] === 'object' &&
					obj[key] !== null &&
					!Array.isArray(obj[key]) &&
					!(obj[key] instanceof Date)
				) {
					ensureTimestampIsDate(obj[key])
				}
			}
		}

		if (!testData && templateNotification.variable_schema) {
			testData = generateFakeDataFromSchema(
				templateNotification.variable_schema
			)
			// Ensure timestamp is always a Date object if it exists
			if (
				testData &&
				typeof testData === 'object' &&
				!Array.isArray(testData)
			) {
				ensureTimestampIsDate(testData)
			}
		} else if (!testData) {
			// Default fake data
			testData = {
				device: {
					id: 1,
					device_id: 'DEV-001',
					hostname: 'test-device',
					status: 'online',
				},
				timestamp: new Date(),
				user: {
					id: userId,
					email: 'test@example.com',
					name: 'Test User',
				},
			}
		} else if (
			testData &&
			typeof testData === 'object' &&
			!Array.isArray(testData)
		) {
			// Ensure timestamp is a Date object even if provided in fakeData
			ensureTimestampIsDate(testData)
		}

		// Render message template if available
		let renderedMessage =
			templateNotification.message_template || templateNotification.name
		if (templateNotification.message_template) {
			renderedMessage = TemplateService.render(
				templateNotification.message_template,
				testData
			)
		}

		// Create a NEW UserNotification record for each test
		// This allows multiple test notifications to be created
		const userNotification = await this.prisma.userNotification.create({
			data: {
				user_id: userId,
				notification_id: notificationId, // Use existing notification template
				viewed: false,
				hidden: false,
				content: renderedMessage, // Store the rendered message content
			},
			include: {
				notification: true,
				user: true,
			},
		})

		// Get or create 'test' tag
		const testTag = await tagService.getOrCreateTag('test')

		// Associate 'test' tag with the user notification (not the notification template)
		await tagService.associateTag(
			'user_notification',
			userNotification.id,
			testTag.id,
			false
		)

		// Inherit tags from notification template to user notification
		await tagService.inheritTags(
			'notification',
			notificationId, // Source: template notification
			'user_notification',
			userNotification.id // Target: user notification
		)

		// Get all tags for the user notification
		const tags = await tagService.getEntityTags(
			'user_notification',
			userNotification.id
		)

		return {
			...userNotification,
			rendered_message: renderedMessage,
			test_data: testData,
			tags: tags.map(tag => ({
				id: tag.id,
				name: tag.name,
				color: tag.color,
				category: tag.category,
				inherited: tag.inherited,
			})),
		}
	}
}
