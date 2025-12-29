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
	 * Evaluate a branch node condition
	 * @param branchNodeConfig - The branch node's configuration
	 * @param data - The input data to evaluate against
	 * @returns true if condition passes, false otherwise
	 */
	private evaluateBranchCondition(branchNodeConfig: any, data: any): boolean {
		if (!branchNodeConfig.fieldPath || !branchNodeConfig.operator || branchNodeConfig.comparisonValue === undefined) {
			console.warn('[WiringExecutor] Branch node missing required configuration')
			return false
		}

		// Get the field value from data using dot notation path
		const getNestedValue = (obj: any, path: string): any => {
			const parts = path.split('.')
			const timestampSubfieldKeys = ['year', 'month', 'day', 'hour', 'minute', 'second', 'dayOfWeek', 'dayOfYear', 'week', 'quarter']

			// Check if the last part is a timestamp subfield
			const lastPart = parts[parts.length - 1]
			const isTimestampSubfield = timestampSubfieldKeys.includes(lastPart)

			if (isTimestampSubfield && parts.length > 1) {
				// Get the parent timestamp value (everything except the last part)
				let parentValue = obj
				for (let i = 0; i < parts.length - 1; i++) {
					if (parentValue && typeof parentValue === 'object') {
						parentValue = parentValue[parts[i]]
					} else {
						return undefined
					}
				}

				// Extract the timestamp component from the parent value
				if (parentValue instanceof Date) {
					const date = parentValue
					switch (lastPart) {
						case 'year': return date.getFullYear()
						case 'month': return date.getMonth() + 1
						case 'day': return date.getDate()
						case 'hour': return date.getHours()
						case 'minute': return date.getMinutes()
						case 'second': return date.getSeconds()
						case 'dayOfWeek': return date.getDay()
						case 'dayOfYear': return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
						case 'week': {
							const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
							const dayNum = d.getUTCDay() || 7
							d.setUTCDate(d.getUTCDate() + 4 - dayNum)
							const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
							return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
						}
						case 'quarter': return Math.floor(date.getMonth() / 3) + 1
						default: return undefined
					}
				} else if (typeof parentValue === 'string') {
					// Try to parse as ISO date string
					const date = new Date(parentValue)
					if (!isNaN(date.getTime())) {
						switch (lastPart) {
							case 'year': return date.getFullYear()
							case 'month': return date.getMonth() + 1
							case 'day': return date.getDate()
							case 'hour': return date.getHours()
							case 'minute': return date.getMinutes()
							case 'second': return date.getSeconds()
							case 'dayOfWeek': return date.getDay()
							case 'dayOfYear': return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
							case 'week': {
								const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
								const dayNum = d.getUTCDay() || 7
								d.setUTCDate(d.getUTCDate() + 4 - dayNum)
								const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
								return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
							}
							case 'quarter': return Math.floor(date.getMonth() / 3) + 1
							default: return undefined
						}
					}
				}
				return undefined
			}

			// Regular field navigation
			let current = obj
			for (const key of parts) {
				if (current && typeof current === 'object') {
					current = current[key]
				} else {
					return undefined
				}
			}

			return current
		}

		const fieldPath = branchNodeConfig.fieldPath
		const fieldValue = getNestedValue(data, fieldPath)
		const operator = branchNodeConfig.operator
		const comparisonValue = branchNodeConfig.comparisonValue

		// Convert comparison value to appropriate type
		let typedComparisonValue: any = comparisonValue
		if (typeof fieldValue === 'number') {
			typedComparisonValue = parseFloat(comparisonValue)
			if (isNaN(typedComparisonValue)) {
				console.warn(`[WiringExecutor] Cannot compare number field with non-numeric value: ${comparisonValue}`)
				return false
			}
		} else if (typeof fieldValue === 'boolean') {
			typedComparisonValue = comparisonValue === 'true' || comparisonValue === true
		} else if (fieldValue instanceof Date || (typeof comparisonValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(comparisonValue))) {
			typedComparisonValue = new Date(comparisonValue)
		}

		// Evaluate condition based on operator
		switch (operator) {
			case 'equals':
				return fieldValue == typedComparisonValue
			case 'not_equals':
				return fieldValue != typedComparisonValue
			case 'greater_than':
				return fieldValue > typedComparisonValue
			case 'less_than':
				return fieldValue < typedComparisonValue
			case 'greater_than_or_equal':
				return fieldValue >= typedComparisonValue
			case 'less_than_or_equal':
				return fieldValue <= typedComparisonValue
			case 'contains':
				if (typeof fieldValue === 'string' && typeof typedComparisonValue === 'string') {
					return fieldValue.includes(typedComparisonValue)
				}
				return false
			case 'not_contains':
				if (typeof fieldValue === 'string' && typeof typedComparisonValue === 'string') {
					return !fieldValue.includes(typedComparisonValue)
				}
				return false
			case 'starts_with':
				if (typeof fieldValue === 'string' && typeof typedComparisonValue === 'string') {
					return fieldValue.startsWith(typedComparisonValue)
				}
				return false
			case 'ends_with':
				if (typeof fieldValue === 'string' && typeof typedComparisonValue === 'string') {
					return fieldValue.endsWith(typedComparisonValue)
				}
				return false
			case 'before':
				if (fieldValue instanceof Date && typedComparisonValue instanceof Date) {
					return fieldValue < typedComparisonValue
				}
				return false
			case 'after':
				if (fieldValue instanceof Date && typedComparisonValue instanceof Date) {
					return fieldValue > typedComparisonValue
				}
				return false
			default:
				console.warn(`[WiringExecutor] Unknown branch operator: ${operator}`)
				return false
		}
	}

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

		// Execute each connected event, traversing through branch nodes
		const executedEvents: Array<{
			event: any
			success: boolean
			result?: any
			error?: string
		}> = []

		// Traverse graph starting from trigger node
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

			// Traverse from this edge, passing data through branch nodes
			const results = await this.traverseAndExecute(
				wiring,
				nodeConfigs,
				edge.target,
				triggerData,
				trigger,
				userId,
				isTest,
				eventContext,
				tagService
			)
			executedEvents.push(...results)
		}

		return {
			trigger,
			executedEvents,
		}
	}

	/**
	 * Traverse the wiring graph starting from a node, handling branch nodes and executing events
	 * Branch nodes pass through their input data to their output connections
	 */
	private async traverseAndExecute(
		wiring: any,
		nodeConfigs: any,
		startNodeId: string,
		data: any,
		trigger: any,
		userId?: string,
		isTest: boolean = true,
		eventContext?: { tags: Set<number> },
		tagService?: TagService
	): Promise<Array<{
		event: any
		success: boolean
		result?: any
		error?: string
	}>> {
		const results: Array<{
			event: any
			success: boolean
			result?: any
			error?: string
		}> = []

		// Find the starting node
		const startNode = (wiring.nodes as any[]).find((n: any) => n.id === startNodeId)
		if (!startNode) {
			return results
		}

		// If it's a branch node, evaluate condition and follow appropriate output
		if (startNode.type === 'branch') {
			const branchConfig = nodeConfigs[startNodeId]
			const conditionResult = this.evaluateBranchCondition(branchConfig, data)

			// Find edges from this branch node
			const branchEdges = (wiring.edges as any[]).filter(
				(e: any) => e.source === startNodeId
			)

			// Follow edges based on condition result
			// Branch nodes have two outputs: 'true' (sourceHandle='true') and 'false' (sourceHandle='false')
			for (const edge of branchEdges) {
				const shouldFollow = conditionResult
					? edge.sourceHandle === 'true'
					: edge.sourceHandle === 'false'

				if (shouldFollow) {
					// Continue traversal with the same data (branch nodes pass data through)
					const subResults = await this.traverseAndExecute(
						wiring,
						nodeConfigs,
						edge.target,
						data, // Pass data through
						trigger,
						userId,
						isTest,
						eventContext,
						tagService
					)
					results.push(...subResults)
				}
			}
			return results
		}

		// If it's an event node, execute it
		const eventMatch = startNodeId.match(/^event-(\d+)/)
		if (eventMatch) {
			const eventId = parseInt(eventMatch[1])
			const event = await this.eventService.getEventById(eventId)

			if (!event) {
				results.push({
					event: { id: eventId, event_name: 'Unknown' },
					success: false,
					error: `Event ${eventId} not found`,
				})
				return results
			}

			if (!event.enabled) {
				results.push({
					event,
					success: false,
					error: 'Event is disabled',
				})
				return results
			}

			// Get effective event schema based on node configuration
			let effectiveEvent = event
			const eventNodeConfig = nodeConfigs[startNodeId]

			// For variable event types, check node configuration
			if (
				event.event_code === 'show_notification' &&
				eventNodeConfig?.notification_id
			) {
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

			// Validate connection (use trigger schema for validation)
			const validation = this.wiringService.validateConnection(
				trigger,
				effectiveEvent
			)

			if (!validation.valid) {
				results.push({
					event,
					success: false,
					error: validation.error || 'Connection validation failed',
				})
				return results
			}

			// Load event tags and merge into context
			if (tagService && eventContext) {
				const eventTags = await tagService.getEntityTags('event', eventId)
				const eventTagIds = eventTags.map(tag => tag.id)
				eventTagIds.forEach(tagId => eventContext.tags.add(tagId))
			}

			// Execute event handler
			try {
				const result = await this.executeEvent(
					event,
					eventNodeConfig,
					data, // Use the data passed through from trigger/branch
					userId,
					isTest,
					eventContext
				)
				results.push({
					event,
					success: true,
					result,
				})
			} catch (error: any) {
				results.push({
					event,
					success: false,
					error: error.message || 'Execution failed',
				})
			}
		}

		return results
	}

	/**
	 * Traverse and execute for real execution (not test mode)
	 * Similar to traverseAndExecute but handles user-specific execution for notifications
	 */
	private async traverseAndExecuteForAllWorkspaces(
		wiring: any,
		nodeConfigs: any,
		startNodeId: string,
		data: any,
		trigger: any,
		workspaceId: number
	): Promise<{ executedCount: number; errors: string[] }> {
		const result = { executedCount: 0, errors: [] as string[] }

		// Find the starting node
		const startNode = (wiring.nodes as any[]).find((n: any) => n.id === startNodeId)
		if (!startNode) {
			return result
		}

		// If it's a branch node, evaluate condition and follow appropriate output
		if (startNode.type === 'branch') {
			const branchConfig = nodeConfigs[startNodeId]
			const conditionResult = this.evaluateBranchCondition(branchConfig, data)

			// Find edges from this branch node
			const branchEdges = (wiring.edges as any[]).filter(
				(e: any) => e.source === startNodeId
			)

			// Follow edges based on condition result
			for (const edge of branchEdges) {
				const shouldFollow = conditionResult
					? edge.sourceHandle === 'true'
					: edge.sourceHandle === 'false'

				if (shouldFollow) {
					// Continue traversal with the same data (branch nodes pass data through)
					const subResult = await this.traverseAndExecuteForAllWorkspaces(
						wiring,
						nodeConfigs,
						edge.target,
						data, // Pass data through
						trigger,
						workspaceId
					)
					result.executedCount += subResult.executedCount
					result.errors.push(...subResult.errors)
				}
			}
			return result
		}

		// If it's an event node, execute it
		const eventMatch = startNodeId.match(/^event-(\d+)/)
		if (eventMatch) {
			const eventId = parseInt(eventMatch[1])
			const event = await this.eventService.getEventById(eventId)

			if (!event || !event.enabled) {
				return result // Event not found or disabled
			}

			// Get effective event schema based on node configuration
			let effectiveEvent = event
			const eventNodeConfig = nodeConfigs[startNodeId]

			if (
				event.event_code === 'show_notification' &&
				eventNodeConfig?.notification_id
			) {
				const notification = await this.prisma.notification.findUnique({
					where: { id: parseInt(eventNodeConfig.notification_id) },
				})
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
				result.errors.push(
					`Validation failed for event ${eventId}: ${validation.error}`
				)
				return result
			}

			// Execute event handler (not in test mode - real execution)
			try {
				console.log(`[WiringExecutor] Workspace ${workspaceId}: Executing event ${eventId} (${event.event_code})`)

				if (event.event_code === 'show_notification') {
					try {
						const users = await this.prisma.user.findMany({
							select: { id: true },
						})

						console.log(`[WiringExecutor] Workspace ${workspaceId}: Found ${users.length} users for notifications`)

						if (users.length === 0) {
							console.warn(`[WiringExecutor] Workspace ${workspaceId}: No users found - skipping notification creation`)
							result.errors.push('No users found for notification creation')
							return result
						}

						let userSuccessCount = 0
						for (const user of users) {
							try {
								await this.executeEvent(
									event,
									eventNodeConfig,
									data, // Use the data passed through from trigger/branch
									user.id,
									false, // isTest = false for real execution
									undefined
								)
								console.log(`[WiringExecutor] Workspace ${workspaceId}: Event ${eventId} executed for user ${user.id}`)
								userSuccessCount++
							} catch (userError: any) {
								console.error(`[WiringExecutor] Workspace ${workspaceId}: Failed to execute event ${eventId} for user ${user.id}:`, userError)
								result.errors.push(`Failed for user ${user.id}: ${userError.message}`)
							}
						}

						if (userSuccessCount > 0) {
							result.executedCount++
							console.log(`[WiringExecutor] Workspace ${workspaceId}: Created notifications for ${userSuccessCount}/${users.length} users`)
						}
					} catch (userQueryError: any) {
						console.error(`[WiringExecutor] Workspace ${workspaceId}: Failed to query users:`, userQueryError)
						result.errors.push(`Failed to query users: ${userQueryError.message}`)
					}
				} else {
					// For other event types, execute once
					await this.executeEvent(
						event,
						eventNodeConfig,
						data, // Use the data passed through from trigger/branch
						undefined,
						false, // isTest = false for real execution
						undefined
					)
					console.log(`[WiringExecutor] Workspace ${workspaceId}: Event ${eventId} executed successfully`)
					result.executedCount++
				}
			} catch (error: any) {
				console.error(`[WiringExecutor] Workspace ${workspaceId}: Failed to execute event ${eventId}:`, error)
				result.errors.push(`Failed to execute event ${eventId}: ${error.message}`)
			}
		}

		return result
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

				// Traverse graph and execute events, handling branch nodes
				for (const edge of connectedEdges) {
					// Skip invalid connections
					if (edge.data?.validationError) {
						errors.push(
							`Invalid connection: ${edge.data.validationError}`
						)
						continue
					}

					try {
						// Traverse from this edge, handling branch nodes
						const results = await this.traverseAndExecuteForAllWorkspaces(
							wiring,
							nodeConfigs,
							edge.target,
							triggerData,
							trigger,
							workspace.id
						)
						executedCount += results.executedCount
						errors.push(...results.errors)
					} catch (error: any) {
						console.error(`[WiringExecutor] Workspace ${workspace.id}: Failed to traverse from edge ${edge.id}:`, error)
						errors.push(`Failed to traverse from edge ${edge.id}: ${error.message}`)
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
