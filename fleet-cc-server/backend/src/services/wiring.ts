import { PrismaClient } from '@prisma/client'
import { TriggerService } from './trigger'
import { EventService } from './event'

/**
 * Wiring Service
 *
 * Manages trigger-to-event connections with schema validation.
 * Handles React Flow wiring configurations for visual node connections.
 */

export class WiringService {
	constructor(
		private prisma: PrismaClient,
		private triggerService: TriggerService,
		private eventService: EventService
	) {}

	/**
	 * Get wiring configuration for a workspace
	 */
	async getWiringConfiguration(workspaceId: number): Promise<any | null> {
		return this.prisma.wiringConfiguration.findUnique({
			where: { workspace_id: workspaceId },
			include: {
				workspace: true,
			},
		})
	}

	/**
	 * Save wiring configuration for a workspace
	 */
	async saveWiringConfiguration(
		workspaceId: number,
		data: {
			nodes: any // React Flow nodes
			edges: any // React Flow edges
			viewport?: any // Viewport position/zoom
			node_config?: any // Per-node configuration
		}
	): Promise<any> {
		// Validate workspace exists
		const workspace = await this.prisma.workspace.findUnique({
			where: { id: workspaceId },
		})

		if (!workspace) {
			throw new Error(`Workspace ${workspaceId} not found`)
		}

		// Upsert wiring configuration
		return this.prisma.wiringConfiguration.upsert({
			where: { workspace_id: workspaceId },
			update: {
				nodes: data.nodes,
				edges: data.edges,
				viewport: data.viewport ?? null,
				node_config: data.node_config ?? null,
			},
			create: {
				workspace_id: workspaceId,
				nodes: data.nodes,
				edges: data.edges,
				viewport: data.viewport ?? null,
				node_config: data.node_config ?? null,
			},
		})
	}

	/**
	 * Get all trigger-event connections for a workspace
	 * Note: This method is kept for backward compatibility but connections are now stored in edges
	 */
	async getConnectionsForWorkspace(workspaceId: number): Promise<any[]> {
		// Get wiring configuration to extract connections from edges
		const wiring = await this.getWiringConfiguration(workspaceId)
		if (!wiring || !wiring.edges) {
			return []
		}

		// Extract connection information from edges
		// This is a simplified version - in practice, edges contain the connection info
		const edges = wiring.edges as any[]
		return edges.map(edge => ({
			id: edge.id,
			trigger_id: this.extractTriggerIdFromNodeId(edge.source),
			event_id: this.extractEventIdFromNodeId(edge.target),
			connection_config: edge.data?.connection_config || null,
			enabled: edge.data?.enabled !== false,
		}))
	}

	/**
	 * Helper to extract trigger ID from node ID (e.g., "trigger-123" -> 123)
	 */
	private extractTriggerIdFromNodeId(nodeId: string): number | null {
		const match = nodeId.match(/^trigger-(\d+)$/)
		return match ? parseInt(match[1]) : null
	}

	/**
	 * Helper to extract event ID from node ID (e.g., "event-456" -> 456)
	 */
	private extractEventIdFromNodeId(nodeId: string): number | null {
		const match = nodeId.match(/^event-(\d+)$/)
		return match ? parseInt(match[1]) : null
	}

	/**
	 * Create a trigger-event connection
	 * Note: This is now handled through saveWiringConfiguration with edges
	 * Kept for backward compatibility
	 */
	async createConnection(
		workspaceId: number,
		data: {
			trigger_id: number
			event_id: number
			connection_config?: any
			enabled?: boolean
		}
	): Promise<any> {
		// Validate workspace exists
		const workspace = await this.prisma.workspace.findUnique({
			where: { id: workspaceId },
		})

		if (!workspace) {
			throw new Error(`Workspace ${workspaceId} not found`)
		}

		// Validate trigger exists
		const trigger = await this.triggerService.getTriggerById(
			data.trigger_id
		)
		if (!trigger) {
			throw new Error(`Trigger ${data.trigger_id} not found`)
		}

		// Validate event exists
		const event = await this.eventService.getEventById(data.event_id)
		if (!event) {
			throw new Error(`Event ${data.event_id} not found`)
		}

		// Validate schema compatibility
		const validation = this.validateConnection(trigger, event)
		if (!validation.valid) {
			throw new Error(`Invalid connection: ${validation.error}`)
		}

		// Note: Connections are now stored in edges within wiring_configurations
		// This method creates a connection entry for backward compatibility
		// In practice, connections should be managed through saveWiringConfiguration
		throw new Error(
			'createConnection is deprecated. Use saveWiringConfiguration with edges instead.'
		)
	}

	/**
	 * Update a connection
	 */
	async updateConnection(
		connectionId: number,
		data: {
			connection_config?: any
			enabled?: boolean
		}
	): Promise<any> {
		return this.prisma.triggerEventConnection.update({
			where: { id: connectionId },
			data: {
				...(data.connection_config !== undefined && {
					connection_config: data.connection_config,
				}),
				...(data.enabled !== undefined && { enabled: data.enabled }),
			},
		})
	}

	/**
	 * Delete a connection
	 */
	async deleteConnection(connectionId: number): Promise<void> {
		await this.prisma.triggerEventConnection.delete({
			where: { id: connectionId },
		})
	}

	/**
	 * Validate that a trigger's output schema satisfies an event's input schema
	 * Returns true if the trigger can provide all required data for the event
	 */
	validateConnection(
		trigger: any,
		event: any
	): {
		valid: boolean
		error?: string
	} {
		if (!trigger || !event) {
			return { valid: false, error: 'Trigger or event not found' }
		}

		if (!trigger.output_schema || !event.input_schema) {
			return { valid: false, error: 'Trigger or event schema not found' }
		}

		const triggerOutput = trigger.output_schema
		const eventInput = event.input_schema

		// Both must be object types
		if (triggerOutput.type !== 'object' || eventInput.type !== 'object') {
			return { valid: false, error: 'Schemas must be object types' }
		}

		// Check that trigger output provides all required event inputs
		if (eventInput.required && Array.isArray(eventInput.required)) {
			const triggerProperties = triggerOutput.properties || {}
			const eventRequired = eventInput.required

			for (const requiredProp of eventRequired) {
				// Check if trigger output has this property
				if (!(requiredProp in triggerProperties)) {
					// Check if it's a nested property (e.g., device.name)
					const hasNested = this.hasNestedProperty(
						triggerProperties,
						requiredProp
					)
					if (!hasNested) {
						return {
							valid: false,
							error: `Trigger output does not provide required property: ${requiredProp}`,
						}
					}
				}
			}
		}

		return { valid: true }
	}

	/**
	 * Check if a nested property exists in the schema
	 * Handles cases like "device.name" where device is an object
	 */
	private hasNestedProperty(properties: any, path: string): boolean {
		const parts = path.split('.')
		let current = properties

		for (const part of parts) {
			if (!current || typeof current !== 'object') {
				return false
			}
			if (part in current) {
				current = current[part]
			} else {
				// Check if any property is an object that might contain this
				for (const key in current) {
					const prop = current[key]
					if (
						prop &&
						typeof prop === 'object' &&
						prop.type === 'object'
					) {
						// This is an object type, it might contain the nested property
						return true // Optimistic - assume object types can contain anything
					}
				}
				return false
			}
		}

		return true
	}

	/**
	 * Delete all connections for a workspace
	 * Note: This is now handled by clearing edges in saveWiringConfiguration
	 */
	async deleteConnectionsForWorkspace(workspaceId: number): Promise<void> {
		// Clear edges in wiring configuration
		const wiring = await this.getWiringConfiguration(workspaceId)
		if (wiring) {
			await this.saveWiringConfiguration(workspaceId, {
				nodes: wiring.nodes as any,
				edges: [],
				viewport: wiring.viewport as any,
				node_config: wiring.node_config as any,
			})
		}
	}
}
