import { PrismaClient } from '@prisma/client'
import { WiringService } from './wiring'
import { TriggerService } from './trigger'
import { EventService } from './event'
import { NotificationService } from './notification'
import { TagService } from './tagService'
import { generateFakeDataFromSchema } from '../utils/fakeDataGenerator'
import { TemplateService } from './template'
import { broadcastNotificationToUser } from '../routes/realtime'

/**
 * Wiring Executor Service
 *
 * Executes wiring configurations by simulating triggers and executing
 * connected events. Used for testing wiring flows with fake data.
 */
export class WiringExecutorService {
	constructor(
		private prisma: PrismaClient,
		private wiringService: WiringService,
		private triggerService: TriggerService,
		private eventService: EventService,
		private notificationService: NotificationService
	) {}

	/**
	 * Execute a trigger with test data and process all connected events
	 * @param workspaceId - Workspace ID
	 * @param triggerId - Trigger ID to execute
	 * @param testData - Optional test data (will be generated from trigger schema if not provided)
	 * @param userId - User ID to scope test actions to (notifications/emails only go to this user)
	 * @param isTest - Whether this is a test execution (defaults to true for this method)
	 * @param nodeConfig - Optional node_config to use current frontend selections instead of saved config
	 * @returns Execution results
	 */
	async executeTrigger(
		workspaceId: number,
		triggerId: number,
		testData?: any,
		userId?: string,
		isTest: boolean = true,
		nodeConfig?: any
	): Promise<{
		trigger: any
		executedEvents: Array<{
			event: any
			success: boolean
			result?: any
			error?: string
		}>
	}> {
		// Get trigger
		const trigger = await this.triggerService.getTriggerById(triggerId)
		if (!trigger) {
			throw new Error(`Trigger ${triggerId} not found`)
		}

		if (!trigger.enabled) {
			throw new Error(`Trigger ${triggerId} is disabled`)
		}

		// Generate test data if not provided
		let triggerData = testData
		if (!triggerData && trigger.output_schema) {
			triggerData = generateFakeDataFromSchema(
				trigger.output_schema,
				undefined,
				trigger.trigger_code,
				trigger.trigger_name
			)
		} else if (!triggerData) {
			// Default test data
			triggerData = {
				device: {
					id: 1,
					device_id: 'DEV-001',
					hostname: 'test-device',
					status: 'online',
				},
				timestamp: new Date(),
			}
		}

		// Add test flag to trigger data
		triggerData = {
			...triggerData,
			test: true,
		}

		// Load trigger tags for tag inheritance
		const tagService = new TagService(this.prisma)
		const triggerTags = await tagService.getEntityTags('trigger', triggerId)
		const triggerTagIds = triggerTags.map(tag => tag.id)

		// Create event context to track accumulating tags
		const eventContext = {
			tags: new Set<number>(triggerTagIds), // Start with trigger tags
		}

		// Get wiring configuration
		const wiring = await this.wiringService.getWiringConfiguration(
			workspaceId
		)
		if (!wiring || !wiring.edges || !wiring.nodes) {
			throw new Error(
				`No wiring configuration found for workspace ${workspaceId}`
			)
		}

		// Find trigger node
		const triggerNode = (wiring.nodes as any[]).find(
			(node: any) => node.id && node.id.startsWith(`trigger-${triggerId}`)
		)

		if (!triggerNode) {
			throw new Error(`Trigger node not found in wiring configuration`)
		}

		// Find all edges connected to this trigger
		const connectedEdges = (wiring.edges as any[]).filter(
			(edge: any) => edge.source === triggerNode.id
		)

		// Get node configs for effective event schemas
		// Use provided node_config (current frontend selections) if available, otherwise use saved config
		const nodeConfigs = nodeConfig || (wiring.node_config as any) || {}

		// Execute each connected event
		const executedEvents: Array<{
			event: any
			success: boolean
			result?: any
			error?: string
		}> = []

		for (const edge of connectedEdges) {
			// Skip invalid connections
			if (edge.data?.validationError) {
				executedEvents.push({
					event: { id: null, event_name: 'Invalid Connection' },
					success: false,
					error: edge.data.validationError,
				})
				continue
			}

			// Extract event ID from target node ID
			const eventMatch = edge.target.match(/^event-(\d+)/)
			if (!eventMatch) {
				executedEvents.push({
					event: { id: null, event_name: 'Unknown Event' },
					success: false,
					error: 'Invalid event node ID format',
				})
				continue
			}

			const eventId = parseInt(eventMatch[1])
			const event = await this.eventService.getEventById(eventId)

			if (!event) {
				executedEvents.push({
					event: { id: eventId, event_name: 'Unknown' },
					success: false,
					error: `Event ${eventId} not found`,
				})
				continue
			}

			if (!event.enabled) {
				executedEvents.push({
					event,
					success: false,
					error: 'Event is disabled',
				})
				continue
			}

			// Get effective event schema based on node configuration
			let effectiveEvent = event
			const eventNodeId = edge.target
			const eventNodeConfig = nodeConfigs[eventNodeId]

			// For variable event types, check node configuration
			if (
				event.event_code === 'show_notification' &&
				eventNodeConfig?.notification_id
			) {
				// Get notification's variable_schema
				const notification = await this.prisma.notification.findUnique({
					where: { id: parseInt(eventNodeConfig.notification_id) },
				})
				if (notification?.variable_schema) {
					effectiveEvent = {
						...event,
						input_schema: notification.variable_schema,
					}
				}
			} else if (
				event.event_code === 'send_email' &&
				eventNodeConfig?.message_code
			) {
				// Email events typically require device data
				effectiveEvent = {
					...event,
					input_schema: {
						type: 'object',
						properties: {
							device: { type: 'object' },
						},
						required: ['device'],
					},
				}
			} else if (
				event.event_code === 'execute_command' &&
				eventNodeConfig?.command
			) {
				// Commands always require device
				effectiveEvent = {
					...event,
					input_schema: {
						type: 'object',
						properties: {
							device: { type: 'object' },
						},
						required: ['device'],
					},
				}
			}

			// Validate connection
			const validation = this.wiringService.validateConnection(
				trigger,
				effectiveEvent
			)

			if (!validation.valid) {
				executedEvents.push({
					event,
					success: false,
					error: validation.error || 'Connection validation failed',
				})
				continue
			}

			// Load event tags and merge into context
			const eventTags = await tagService.getEntityTags('event', eventId)
			const eventTagIds = eventTags.map(tag => tag.id)
			eventTagIds.forEach(tagId => eventContext.tags.add(tagId))

			// Execute event handler
			try {
				const result = await this.executeEvent(
					event,
					eventNodeConfig,
					triggerData,
					userId,
					isTest,
					eventContext
				)
				executedEvents.push({
					event,
					success: true,
					result,
				})
			} catch (error: any) {
				executedEvents.push({
					event,
					success: false,
					error: error.message || 'Execution failed',
				})
			}
		}

		return {
			trigger,
			executedEvents,
		}
	}

	/**
	 * Execute an event handler with test data
	 */
	private async executeEvent(
		event: any,
		nodeConfig: any,
		triggerData: any,
		userId?: string,
		isTest: boolean = true,
		eventContext?: { tags: Set<number> }
	): Promise<any> {
		switch (event.event_code) {
			case 'show_notification':
				return this.executeShowNotification(
					event,
					nodeConfig,
					triggerData,
					userId,
					isTest,
					eventContext
				)

			case 'send_email':
				return this.executeSendEmail(
					event,
					nodeConfig,
					triggerData,
					userId,
					isTest
				)

			case 'execute_command':
				return this.executeCommand(
					event,
					nodeConfig,
					triggerData,
					isTest
				)

			default:
				// Unknown event type - just log
				console.log(`Unknown event type: ${event.event_code}`)
				return {
					message: 'Event type not implemented',
					event_code: event.event_code,
				}
		}
	}

	/**
	 * Execute show_notification event
	 * Uses the selected notification from the dropdown if configured,
	 * otherwise creates a default test notification.
	 * The test simulates the entire chain using the test data from the trigger.
	 */
	private async executeShowNotification(
		event: any,
		nodeConfig: any,
		triggerData: any,
		userId?: string,
		isTest: boolean = true,
		eventContext?: { tags: Set<number> }
	): Promise<any> {
		// For real execution (not test), userId should be provided (we get all users in executeTriggerForAllWorkspaces)
		if (!userId) {
			throw new Error('User ID required for notification creation')
		}

		// notification_id is always required - both for testing and real execution
		if (!nodeConfig?.notification_id) {
			throw new Error(
				'Notification ID not configured for this event. Please select a notification in the wiring manager.'
			)
		}

		const notificationId = parseInt(nodeConfig.notification_id)

		// Verify the notification exists and is enabled
		const selectedNotification = await this.prisma.notification.findUnique({
			where: { id: notificationId },
		})

		if (!selectedNotification) {
			throw new Error(
				`Selected notification ${notificationId} not found. Please select a valid notification.`
			)
		}

		if (!selectedNotification.enabled) {
			throw new Error(
				`Selected notification "${selectedNotification.name}" is disabled. Please enable it or select a different notification.`
			)
		}

		// Create the test notification using the selected/default notification template
		// This simulates the entire chain: trigger data -> notification template rendering -> user notification
		// The createTestNotificationForUser method will:
		// 1. Use the notification template (with its message_template and variable_schema)
		// 2. Render the template with the trigger test data
		// 3. Create a UserNotification instance
		// 4. Apply tags from the context
		const result =
			await this.notificationService.createTestNotificationForUser(
				userId,
				notificationId,
				triggerData
			)

		// Apply accumulated tags from event context (trigger + event tags)
		if (eventContext && eventContext.tags.size > 0) {
			const tagService = new TagService(this.prisma)
			const contextTagIds = Array.from(eventContext.tags)

			// Get notification template tags
			const notificationTags = await tagService.getEntityTags(
				'notification',
				notificationId
			)
			const notificationTagIds = notificationTags.map(tag => tag.id)

			// Merge context tags with notification tags (deduplicated)
			const allTagIds = new Set([...contextTagIds, ...notificationTagIds])

			// Apply tags to the user notification (only tags that aren't already on the notification template)
			for (const tagId of allTagIds) {
				// Only create tag associations for tags not already on the notification template
				// (notification template tags are automatically inherited via getEntityTags query)
				if (!notificationTagIds.includes(tagId)) {
					await tagService.associateTag(
						'user_notification',
						result.id,
						tagId,
						false
					)
				}
			}
		}

		// Broadcast notification via WebSocket to the user (same as test endpoint)
		try {
			broadcastNotificationToUser(userId, {
				id: result.id,
				notification_id: result.notification_id,
				name: result.notification.name,
				message: result.rendered_message,
				notification_type: result.notification.notification_type,
				viewed: result.viewed,
				viewed_at: result.viewed_at,
				created_at: result.created_at,
				tags: result.tags,
				show_popup: result.notification.show_popup,
			})
		} catch (wsError) {
			// Log but don't fail the request if WebSocket broadcast fails
			console.error(
				'Failed to broadcast test notification via WebSocket:',
				wsError
			)
		}

		return result
	}

	/**
	 * Execute send_email event
	 */
	private async executeSendEmail(
		event: any,
		nodeConfig: any,
		triggerData: any,
		userId?: string,
		isTest: boolean = true
	): Promise<any> {
		if (!nodeConfig?.message_code) {
			throw new Error('Message code not configured for this event')
		}

		if (!userId) {
			throw new Error('User ID required for test emails')
		}

		// Get user email
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		})

		if (!user?.email) {
			throw new Error('User email not found')
		}

		// Get message template
		const message = await this.prisma.message.findFirst({
			where: { message_code: nodeConfig.message_code },
		})

		if (!message) {
			throw new Error(`Message ${nodeConfig.message_code} not found`)
		}

		// Render message template
		const renderedMessage = message.body_template
			? TemplateService.render(message.body_template, triggerData)
			: message.message_name

		// In a real implementation, this would send an email
		// For testing, we just return what would be sent
		return {
			to: user.email,
			subject: message.message_name,
			body: renderedMessage,
			message_code: nodeConfig.message_code,
			test_mode: true,
		}
	}

	/**
	 * Execute execute_command event
	 * In test mode, we don't actually execute commands - just log them
	 */
	private async executeCommand(
		event: any,
		nodeConfig: any,
		triggerData: any,
		isTest: boolean = true
	): Promise<any> {
		if (!nodeConfig?.command) {
			throw new Error('Command not configured for this event')
		}

		// In test mode, don't actually execute commands
		// Just return what would be executed
		return {
			command: nodeConfig.command,
			device: triggerData.device,
			test_mode: true,
			message: 'Command would be executed in production mode',
		}
	}

	/**
	 * Execute wiring configurations for all workspaces when a trigger code occurs
	 * This is called when real events happen (device online, offline, etc.)
	 * @param triggerCode - The trigger code (e.g., 'device.online', 'device.offline')
	 * @param triggerData - The actual event data (not test data)
	 * @returns Array of execution results per workspace
	 */
	async executeTriggerForAllWorkspaces(
		triggerCode: string,
		triggerData: any
	): Promise<Array<{
		workspaceId: number
		success: boolean
		executedEvents: number
		errors?: string[]
	}>> {
		console.log(`[WiringExecutor] Executing trigger ${triggerCode} for all workspaces`)

		// Find all workspaces with wiring configurations
		const workspaces = await this.prisma.workspace.findMany({
			include: {
				wiring_configuration: true,
			},
		})

		console.log(`[WiringExecutor] Found ${workspaces.length} workspaces`)

		const results: Array<{
			workspaceId: number
			success: boolean
			executedEvents: number
			errors?: string[]
		}> = []

		// Find the trigger by code
		const trigger = await this.triggerService.getTriggerByCode(triggerCode)
		if (!trigger) {
			console.warn(`[WiringExecutor] Trigger ${triggerCode} not found`)
			return results
		}
		if (!trigger.enabled) {
			console.warn(`[WiringExecutor] Trigger ${triggerCode} is disabled`)
			return results
		}

		console.log(`[WiringExecutor] Found trigger: ${trigger.trigger_name} (ID: ${trigger.id})`)

		// Process each workspace
		for (const workspace of workspaces) {
			if (!workspace.wiring_configuration) {
				continue // No wiring configuration for this workspace
			}

			const wiring = workspace.wiring_configuration
			if (!wiring.nodes || !wiring.edges) {
				continue // Invalid wiring configuration
			}

			try {
				// Find trigger node with matching trigger code
				const triggerNode = (wiring.nodes as any[]).find(
					(node: any) =>
						node.id &&
						node.id.startsWith(`trigger-${trigger.id}`) &&
						node.data?.trigger_code === triggerCode
				)

				if (!triggerNode) {
					console.log(`[WiringExecutor] Workspace ${workspace.id}: No trigger node found for ${triggerCode}`)
					continue // This workspace doesn't have this trigger configured
				}

				console.log(`[WiringExecutor] Workspace ${workspace.id}: Found trigger node ${triggerNode.id}`)

				// Find all edges connected to this trigger
				const connectedEdges = (wiring.edges as any[]).filter(
					(edge: any) => edge.source === triggerNode.id
				)

				console.log(`[WiringExecutor] Workspace ${workspace.id}: Found ${connectedEdges.length} connected edges`)

				if (connectedEdges.length === 0) {
					console.log(`[WiringExecutor] Workspace ${workspace.id}: No events connected to trigger`)
					continue // No events connected to this trigger
				}

				// Get node configs from saved wiring configuration
				const nodeConfigs = (wiring.node_config as any) || {}

				// Execute each connected event (not in test mode - real execution)
				let executedCount = 0
				const errors: string[] = []

				for (const edge of connectedEdges) {
					// Skip invalid connections
					if (edge.data?.validationError) {
						errors.push(
							`Invalid connection: ${edge.data.validationError}`
						)
						continue
					}

					// Extract event ID from target node ID
					const eventMatch = edge.target.match(/^event-(\d+)/)
					if (!eventMatch) {
						errors.push(`Invalid event node ID: ${edge.target}`)
						continue
					}

					const eventId = parseInt(eventMatch[1])
					const event = await this.eventService.getEventById(eventId)

					if (!event || !event.enabled) {
						continue // Event not found or disabled
					}

					// Get effective event schema based on node configuration
					let effectiveEvent = event
					const eventNodeId = edge.target
					const eventNodeConfig = nodeConfigs[eventNodeId]

					// For variable event types, check node configuration
					if (
						event.event_code === 'show_notification' &&
						eventNodeConfig?.notification_id
					) {
						// Get notification's variable_schema
						const notification = await this.prisma.notification.findUnique(
							{
								where: { id: parseInt(eventNodeConfig.notification_id) },
							}
						)
						if (notification?.variable_schema) {
							effectiveEvent = {
								...event,
								input_schema: notification.variable_schema,
							}
						}
					}

					// Validate connection
					const validation = this.wiringService.validateConnection(
						trigger,
						effectiveEvent
					)

					if (!validation.valid) {
						errors.push(
							`Validation failed for event ${eventId}: ${validation.error}`
						)
						continue
					}

					// Execute event handler (not in test mode - real execution)
					try {
						console.log(`[WiringExecutor] Workspace ${workspace.id}: Executing event ${eventId} (${event.event_code})`)

						// For real events, get all users and execute for each
						// For show_notification events, we need to create notifications for all users
						if (event.event_code === 'show_notification') {
							try {
								// Get all users from the User table (Prisma model)
								const users = await this.prisma.user.findMany({
									select: {
										id: true,
									},
								})

								console.log(`[WiringExecutor] Workspace ${workspace.id}: Found ${users.length} users for notifications`)

								if (users.length === 0) {
									console.warn(`[WiringExecutor] Workspace ${workspace.id}: No users found - skipping notification creation`)
									errors.push('No users found for notification creation')
									continue
								}

								// Execute for each user
								let userSuccessCount = 0
								for (const user of users) {
									try {
										const result = await this.executeEvent(
											event,
											eventNodeConfig,
											triggerData,
											user.id, // User ID for notification creation
											false, // isTest = false for real execution
											undefined // eventContext
										)
										console.log(`[WiringExecutor] Workspace ${workspace.id}: Event ${eventId} executed for user ${user.id}`)
										userSuccessCount++
									} catch (userError: any) {
										console.error(`[WiringExecutor] Workspace ${workspace.id}: Failed to execute event ${eventId} for user ${user.id}:`, userError)
										errors.push(`Failed for user ${user.id}: ${userError.message}`)
										// Continue with other users even if one fails
									}
								}

								if (userSuccessCount > 0) {
									executedCount++
									console.log(`[WiringExecutor] Workspace ${workspace.id}: Created notifications for ${userSuccessCount}/${users.length} users`)
								}
							} catch (userQueryError: any) {
								console.error(`[WiringExecutor] Workspace ${workspace.id}: Failed to query users:`, userQueryError)
								errors.push(`Failed to query users: ${userQueryError.message}`)
							}
						} else {
							// For other event types, execute once (they don't need user context)
							const result = await this.executeEvent(
								event,
								eventNodeConfig,
								triggerData,
								undefined, // No specific user
								false, // isTest = false for real execution
								undefined // eventContext
							)
							console.log(`[WiringExecutor] Workspace ${workspace.id}: Event ${eventId} executed successfully`, result)
							executedCount++
						}
					} catch (error: any) {
						console.error(`[WiringExecutor] Workspace ${workspace.id}: Failed to execute event ${eventId}:`, error)
						errors.push(
							`Failed to execute event ${eventId}: ${error.message}`
						)
					}
				}

				results.push({
					workspaceId: workspace.id,
					success: errors.length === 0,
					executedEvents: executedCount,
					errors: errors.length > 0 ? errors : undefined,
				})
			} catch (error: any) {
				results.push({
					workspaceId: workspace.id,
					success: false,
					executedEvents: 0,
					errors: [error.message || 'Unknown error'],
				})
			}
		}

		return results
	}
}
