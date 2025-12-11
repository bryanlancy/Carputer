'use client'

import React, { useCallback, useMemo, useRef, useEffect } from 'react'
import ReactFlow, {
	Node,
	Edge,
	Connection,
	addEdge,
	useNodesState,
	useEdgesState,
	Controls,
	Background,
	MiniMap,
	BackgroundVariant,
	NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import TriggerNode, { TriggerNodeData } from '../nodes/TriggerNode'
import EventNode, { EventNodeData } from '../nodes/EventNode'
import { validateConnection } from '../../utils/schemaValidation'
import ContextMenu from './ContextMenu'
import EdgeWithTooltip from './EdgeWithTooltip'
import styles from './WiringCanvas.module.scss'

export interface WiringCanvasProps {
	triggers: Array<{
		id: number
		trigger_code: string
		trigger_name: string
		description?: string | null
		output_schema?: any
		enabled: boolean
	}>
	events: Array<{
		id: number
		event_code: string
		event_name: string
		description?: string | null
		input_schema?: any
		handler_type: string
		enabled: boolean
		availableMessages?: Array<{
			id: number
			message_code: string
			message_name: string
		}>
		availableCommands?: Array<{
			value: string
			label: string
		}>
		availableNotificationTypes?: Array<{
			id: number
			name: string
			variable_schema?: any
		}>
	}>
	initialNodes?: Node[]
	initialEdges?: Edge[]
	onNodesChange?: (nodes: Node[]) => void
	onEdgesChange?: (edges: Edge[]) => void
	onConnect?: (connection: Connection) => void
	readOnly?: boolean
	nodesRef?: React.MutableRefObject<Node[] | null>
	edgesRef?: React.MutableRefObject<Edge[] | null>
	onValidationChange?: (hasInvalidConnections: boolean) => void
	workspaceId?: number | null
}

// Define edgeTypes outside component
const edgeTypes = {
	default: EdgeWithTooltip,
}

export default function WiringCanvas({
	triggers,
	events,
	initialNodes = [],
	initialEdges = [],
	onNodesChange,
	onEdgesChange,
	onConnect: onConnectProp,
	readOnly = false,
	nodesRef,
	edgesRef,
	onValidationChange,
	workspaceId,
}: WiringCanvasProps) {
	const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
	const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges)
	// Use internal ref to track latest nodes for validation (separate from prop nodesRef)
	const internalNodesRef = useRef(nodes)

	// Store workspaceId in a ref so nodeTypes can access it without causing re-renders
	const workspaceIdRef = useRef(workspaceId)
	useEffect(() => {
		workspaceIdRef.current = workspaceId
	}, [workspaceId])

	// Create nodeTypes with workspaceId - use useMemo to keep reference stable
	// Access workspaceId via ref to avoid React Flow warning about unstable nodeTypes
	const nodeTypes = useMemo(
		() => ({
			trigger: (props: NodeProps<TriggerNodeData>) => (
				<TriggerNode {...props} workspaceId={workspaceIdRef.current} />
			),
			event: EventNode,
		}),
		[]
	) // Empty deps array - workspaceId accessed via ref
	const [contextMenu, setContextMenu] = React.useState<{
		x: number
		y: number
		type: 'node' | 'edge'
		nodeId?: string
		edgeId?: string
	} | null>(null)

	// Track previous initialNodes to detect workspace changes
	const prevInitialNodesRef = useRef<Node[]>([])

	// Update nodes when initialNodes change (only when loading a different workspace)
	useEffect(() => {
		// Only update if initialNodes actually changed (different workspace loaded)
		const prevIds = new Set(
			prevInitialNodesRef.current.map(n => n.id).sort()
		)
		const currentIds = new Set(initialNodes.map(n => n.id).sort())
		const hasChanged =
			prevIds.size !== currentIds.size ||
			Array.from(currentIds).some(id => !prevIds.has(id))

		if (hasChanged) {
			setNodes(initialNodes)
			prevInitialNodesRef.current = initialNodes
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialNodes]) // Only depend on initialNodes to avoid resetting on every node change

	// Handle drop from sidebars
	const onDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault()

			const reactFlowBounds = (
				event.currentTarget as HTMLElement
			).getBoundingClientRect()
			const position = {
				x: event.clientX - reactFlowBounds.left,
				y: event.clientY - reactFlowBounds.top,
			}

			// Check if it's a trigger
			const triggerData = event.dataTransfer.getData(
				'application/reactflow-trigger'
			)
			if (triggerData) {
				const trigger = JSON.parse(triggerData)
				const newNode: Node<TriggerNodeData> = {
					id: `trigger-${trigger.id}-${Date.now()}`,
					type: 'trigger',
					position,
					data: trigger,
				}
				setNodes(nds => [...nds, newNode])
				return
			}

			// Check if it's an action
			const actionData = event.dataTransfer.getData(
				'application/reactflow-action'
			)
			if (actionData) {
				const action = JSON.parse(actionData)
				// Check if this action has variable data types
				const hasVariableDataTypes =
					action.event_code === 'show_notification' ||
					action.event_code === 'send_email' ||
					action.event_code === 'execute_command'

				// Find the action in events array to get available data
				const fullAction = events.find(e => e.id === action.id)

				const newNode: Node<EventNodeData> = {
					id: `event-${action.id}-${Date.now()}`,
					type: 'event',
					position,
					data: {
						...action,
						hasVariableDataTypes,
						config: {},
						// Include availableMessages if this is Send Email action
						...(action.event_code === 'send_email' &&
							fullAction?.availableMessages && {
								availableMessages: fullAction.availableMessages,
							}),
						// Include availableCommands if this is Execute Command action
						...(action.event_code === 'execute_command' &&
							fullAction?.availableCommands && {
								availableCommands: fullAction.availableCommands,
							}),
						// Include availableNotificationTypes if this is Show Notification action
						...(action.event_code === 'show_notification' &&
							fullAction?.availableNotificationTypes && {
								availableNotificationTypes:
									fullAction.availableNotificationTypes,
							}),
					},
				}
				setNodes(nds => [...nds, newNode])
				return
			}
		},
		[setNodes, events]
	)

	const onDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.dataTransfer.dropEffect = 'move'
	}, [])

	// Update edges when initialEdges change
	useMemo(() => {
		if (initialEdges.length > 0) {
			setEdges(initialEdges)
		}
	}, [initialEdges, setEdges])

	// Validate all edges and mark invalid ones
	const validateAllEdges = useCallback(() => {
		setEdges(eds => {
			return eds.map(edge => {
				// Extract trigger and event IDs from node IDs
				const triggerMatch = edge.source.match(/^trigger-(\d+)/)
				const eventMatch = edge.target.match(/^event-(\d+)/)

				if (!triggerMatch || !eventMatch) {
					return {
						...edge,
						style: { stroke: '#ef4444' },
						animated: false,
					}
				}

				const triggerId = parseInt(triggerMatch[1])
				const eventId = parseInt(eventMatch[1])

				const trigger = triggers.find(t => t.id === triggerId)
				// Use internalNodesRef to get the latest nodes state (including config changes)
				const eventNode = internalNodesRef.current.find(
					n => n.id === edge.target
				)
				const event = events.find(e => e.id === eventId)

				if (!trigger || !event || !eventNode) {
					return {
						...edge,
						style: { stroke: '#ef4444' },
						animated: false,
					}
				}

				// Get effective event schema based on node configuration
				let effectiveEvent = event
				const eventData = eventNode.data as any

				// For show_notification, use the selected notification type's variable_schema
				if (
					eventData.event_code === 'show_notification' &&
					eventData.config?.notification_id
				) {
					const fullEvent = events.find(e => e.id === eventId)
					if (fullEvent?.availableNotificationTypes) {
						const selectedType =
							fullEvent.availableNotificationTypes.find(
								(nt: any) =>
									nt.id.toString() ===
									eventData.config.notification_id.toString()
							)
						if (selectedType?.variable_schema) {
							effectiveEvent = {
								...event,
								input_schema: selectedType.variable_schema,
							}
						} else {
							effectiveEvent = {
								...event,
								input_schema: {
									type: 'object',
									properties: {},
									required: [],
								},
							}
						}
					}
				} else if (
					eventData.event_code === 'send_email' &&
					eventData.config?.message_code
				) {
					// For send_email, use the selected message's variable_schema
					const fullEvent = events.find(e => e.id === eventId)
					if (fullEvent?.availableMessages) {
						// Messages typically require device data, but we could enhance this later
						// For now, we'll use a schema that requires device
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
				} else if (
					eventData.event_code === 'execute_command' &&
					eventData.config?.command
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

				const validation = validateConnection(trigger, effectiveEvent)
				if (!validation.valid) {
					return {
						...edge,
						style: { stroke: '#ef4444' },
						animated: false,
						data: {
							...edge.data,
							validationError: validation.error,
						},
					}
				}

				return {
					...edge,
					style: { stroke: '#22c55e' },
					animated: true,
					data: {
						...edge.data,
						validationError: undefined,
					},
				}
			})
		})
	}, [triggers, events, setEdges])

	// Update internal nodes ref and prop ref when nodes change, and trigger validation
	useEffect(() => {
		internalNodesRef.current = nodes
		if (nodesRef) {
			nodesRef.current = nodes
		}
		// Trigger validation when nodes change (including config changes)
		// This ensures validation runs when node configs are updated via updateNodeConfig
		if (edges.length > 0) {
			const timeoutId = setTimeout(() => {
				validateAllEdges()
			}, 100)
			return () => clearTimeout(timeoutId)
		}
	}, [nodes, edges.length, validateAllEdges, nodesRef])

	useEffect(() => {
		if (edgesRef) {
			edgesRef.current = edges
		}
	}, [edges, edgesRef])

	// Check for invalid edges and notify parent
	useEffect(() => {
		if (onValidationChange) {
			const hasInvalid = edges.some(
				edge => edge.style?.stroke === '#ef4444'
			)
			onValidationChange(hasInvalid)
		}
	}, [edges, onValidationChange])

	// Handle node changes
	const handleNodesChange = useCallback(
		(changes: any) => {
			onNodesChangeInternal(changes)
			// Re-validate edges after node changes (especially config changes)
			// Use a longer timeout to ensure state has updated
			setTimeout(() => {
				validateAllEdges()
			}, 150)
		},
		[onNodesChangeInternal, validateAllEdges]
	)

	// Don't automatically notify parent on every node change - this causes infinite loops
	// Parent can read from nodesRef when needed (e.g., when saving)
	// If parent needs updates, they should be debounced/throttled at the parent level

	// Handle edge changes
	const handleEdgesChange = useCallback(
		(changes: any) => {
			onEdgesChangeInternal(changes)
			if (onEdgesChange) {
				onEdgesChange(edges)
			}
		},
		[edges, onEdgesChange, onEdgesChangeInternal]
	)

	// Handle node context menu
	const onNodeContextMenu = useCallback(
		(event: React.MouseEvent, node: Node) => {
			event.preventDefault()
			setContextMenu({
				x: event.clientX,
				y: event.clientY,
				type: 'node',
				nodeId: node.id,
			})
		},
		[]
	)

	// Handle edge context menu
	const onEdgeContextMenu = useCallback(
		(event: React.MouseEvent, edge: Edge) => {
			event.preventDefault()
			setContextMenu({
				x: event.clientX,
				y: event.clientY,
				type: 'edge',
				edgeId: edge.id,
			})
		},
		[]
	)

	// Handle context menu delete
	const handleContextMenuDelete = useCallback(() => {
		if (!contextMenu) return

		if (contextMenu.type === 'node' && contextMenu.nodeId) {
			setNodes(nds => nds.filter(n => n.id !== contextMenu.nodeId))
			// Also remove connected edges
			setEdges(eds =>
				eds.filter(
					e =>
						e.source !== contextMenu.nodeId &&
						e.target !== contextMenu.nodeId
				)
			)
		} else if (contextMenu.type === 'edge' && contextMenu.edgeId) {
			setEdges(eds => eds.filter(e => e.id !== contextMenu.edgeId))
		}

		setContextMenu(null)
	}, [contextMenu, setNodes, setEdges])

	// Validate connection before allowing it
	const onConnect = useCallback(
		(params: Connection) => {
			if (!params.source || !params.target) {
				return
			}

			// Extract trigger and event IDs from node IDs (format: trigger-{id}-{timestamp} or event-{id}-{timestamp})
			const triggerMatch = params.source.match(/^trigger-(\d+)/)
			const eventMatch = params.target.match(/^event-(\d+)/)

			if (!triggerMatch || !eventMatch) {
				console.error('Invalid node ID format')
				return
			}

			const triggerId = parseInt(triggerMatch[1])
			const eventId = parseInt(eventMatch[1])

			const trigger = triggers.find(t => t.id === triggerId)
			const event = events.find(e => e.id === eventId)

			if (!trigger || !event) {
				console.error('Trigger or event not found')
				return
			}

			// Allow all connections - validation will happen in validateAllEdges
			// Get the event node from the nodes array
			const eventNode = nodes.find(n => n.id === params.target)

			if (!eventNode) {
				// Node not found, cancel connection
				return
			}

			// Get effective event schema based on node configuration
			let effectiveEvent = event
			if (eventNode?.data) {
				const eventData = eventNode.data as any
				// For show_notification, use the selected notification type's variable_schema
				if (
					eventData.event_code === 'show_notification' &&
					eventData.config?.notification_id
				) {
					// Find the notification type from the events array (which includes availableNotificationTypes)
					const fullEvent = events.find(e => e.id === eventId)
					if (fullEvent?.availableNotificationTypes) {
						const selectedType =
							fullEvent.availableNotificationTypes.find(
								(nt: any) =>
									nt.id.toString() ===
									eventData.config.notification_id.toString()
							)
						if (selectedType?.variable_schema) {
							// Use the notification type's variable_schema as the effective input schema
							effectiveEvent = {
								...event,
								input_schema: selectedType.variable_schema,
							}
						} else {
							// No variable_schema means no requirements
							effectiveEvent = {
								...event,
								input_schema: {
									type: 'object',
									properties: {},
									required: [],
								},
							}
						}
					}
				}
				// For send_email, use the selected message's variable_schema
				else if (
					eventData.event_code === 'send_email' &&
					eventData.config?.message_code
				) {
					const fullEvent = events.find(e => e.id === eventId)
					if (fullEvent?.availableMessages) {
						// Messages typically require device data, but we could enhance this later
						// For now, we'll use a schema that requires device
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
				}
				// For execute_command, always requires device
				else if (
					eventData.event_code === 'execute_command' &&
					eventData.config?.command
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
			}

			// Validate the connection with effective schema
			const validation = validateConnection(trigger, effectiveEvent)

			// Always allow the connection, but mark it appropriately
			const newEdge = {
				...params,
				animated: validation.valid,
				style: { stroke: validation.valid ? '#22c55e' : '#ef4444' },
				data: {
					validationError: validation.valid
						? undefined
						: validation.error,
				},
			}
			setEdges(eds => addEdge(newEdge, eds))

			// Call parent callback if provided
			if (onConnectProp) {
				onConnectProp(params)
			}
		},
		[triggers, events, nodes, onConnectProp, setEdges]
	)

	return (
		<div
			className={styles.wiringCanvas}
			onDrop={onDrop}
			onDragOver={onDragOver}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={handleNodesChange}
				onEdgesChange={handleEdgesChange}
				onConnect={readOnly ? undefined : onConnect}
				onNodeContextMenu={onNodeContextMenu}
				onEdgeContextMenu={onEdgeContextMenu}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				fitView
				className={styles.flow}
				deleteKeyCode={null} // Disable default delete key
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={12}
					size={1}
				/>
				<Controls />
				<MiniMap />
			</ReactFlow>
			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					type={contextMenu.type}
					onDelete={handleContextMenuDelete}
					onClose={() => setContextMenu(null)}
				/>
			)}
		</div>
	)
}
