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
		if (!userId) {
			throw new Error('User ID required for test notifications')
		}

		let notificationId: number

		// PRIORITY: Always use the selected notification from the dropdown if configured
		// This ensures the test uses the actual notification template that will be used in production
		if (nodeConfig?.notification_id) {
			notificationId = parseInt(nodeConfig.notification_id)

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
		} else {
			// Fallback: For testing without a configured notification_id, create or get a default test notification
			// This allows testing the show_notification action without requiring configuration
			const defaultNotification = await this.notificationService.getOrCreateNotification(
				'Test Notification',
				{
					description: 'Default notification for testing wiring configurations',
					priority: 0,
					enabled: true,
				}
			)
			notificationId = defaultNotification.id

			// If the default notification doesn't have a message template, set a simple one
			if (!defaultNotification.message_template) {
				// Generate a simple message from trigger data
				let message = 'Test notification'
				if (triggerData?.device?.device_id) {
					message = `Test notification for device ${triggerData.device.device_id}`
				} else if (triggerData?.device?.hostname) {
					message = `Test notification for ${triggerData.device.hostname}`
				}

				// Update the notification template with a simple message
				await this.prisma.notification.update({
					where: { id: notificationId },
					data: {
						message_template: message,
					},
				})
			}
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
}
