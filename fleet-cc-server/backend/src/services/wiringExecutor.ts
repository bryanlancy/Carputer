import { PrismaClient } from '@prisma/client'
import { WiringService } from './wiring'
import { TriggerService } from './trigger'
import { EventService } from './event'
import { NotificationService } from './notification'
import { generateFakeDataFromSchema } from '../utils/fakeDataGenerator'
import { TemplateService } from './template'

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
	 * @returns Execution results
	 */
	async executeTrigger(
		workspaceId: number,
		triggerId: number,
		testData?: any,
		userId?: string,
		isTest: boolean = true
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
			triggerData = generateFakeDataFromSchema(trigger.output_schema)
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

		// Get wiring configuration
		const wiring = await this.wiringService.getWiringConfiguration(workspaceId)
		if (!wiring || !wiring.edges || !wiring.nodes) {
			throw new Error(`No wiring configuration found for workspace ${workspaceId}`)
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
		const nodeConfigs = (wiring.node_config as any) || {}

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

			// Execute event handler
			try {
				const result = await this.executeEvent(
					event,
					eventNodeConfig,
					triggerData,
					userId,
					isTest
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
		isTest: boolean = true
	): Promise<any> {
		switch (event.event_code) {
			case 'show_notification':
				return this.executeShowNotification(event, nodeConfig, triggerData, userId, isTest)

			case 'send_email':
				return this.executeSendEmail(event, nodeConfig, triggerData, userId, isTest)

			case 'execute_command':
				return this.executeCommand(event, nodeConfig, triggerData, isTest)

			default:
				// Unknown event type - just log
				console.log(`Unknown event type: ${event.event_code}`)
				return { message: 'Event type not implemented', event_code: event.event_code }
		}
	}

	/**
	 * Execute show_notification event
	 */
	private async executeShowNotification(
		event: any,
		nodeConfig: any,
		triggerData: any,
		userId?: string,
		isTest: boolean = true
	): Promise<any> {
		if (!nodeConfig?.notification_id) {
			throw new Error('Notification ID not configured for this event')
		}

		if (!userId) {
			throw new Error('User ID required for test notifications')
		}

		const notificationId = parseInt(nodeConfig.notification_id)
		// createTestNotificationForUser always creates test notifications with 'test' tag
		// This ensures test notifications are marked and won't cause false positives
		return this.notificationService.createTestNotificationForUser(
			userId,
			notificationId,
			triggerData
		)
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

