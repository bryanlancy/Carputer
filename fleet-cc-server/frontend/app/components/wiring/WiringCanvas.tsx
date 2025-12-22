'use client'

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
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
import BranchNode, { BranchNodeData } from '../nodes/BranchNode'
import { validateConnection } from '../../utils/schemaValidation'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import ContextMenu from './ContextMenu'
import EdgeWithTooltip from './EdgeWithTooltip'
import WiringLegend from './WiringLegend'
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
	nodesRefForTest?: React.MutableRefObject<Node[] | null> // For passing current nodes to test
	nodesWithChanges?: Set<string> // Nodes that have pending changes
}

// Define edgeTypes outside component
const edgeTypes = {
	default: EdgeWithTooltip,
}

// Global ref store for node type dynamic values - defined outside component
// This allows node type functions to access dynamic values without being recreated
const nodeTypeRefs = {
	workspaceId: { current: null as number | null | undefined },
	nodesRefForTest: { current: undefined as React.MutableRefObject<Node[] | null> | undefined },
	nodesWithChanges: { current: new Set<string>() as Set<string> },
	triggers: { current: [] as Array<any> },
	events: { current: [] as Array<any> },
}

// Define node type functions outside component for maximum stability
// Using function declarations (not arrow functions) for better stability
// These functions are created once and never recreated, which is what React Flow requires
function createTriggerNode(props: NodeProps<TriggerNodeData>) {
	return (
		<TriggerNode
			{...props}
			workspaceId={nodeTypeRefs.workspaceId.current}
			nodesRefForTest={nodeTypeRefs.nodesRefForTest.current}
			hasPendingChanges={nodeTypeRefs.nodesWithChanges.current.has(props.id)}
		/>
	)
}

function createEventNode(props: NodeProps<EventNodeData>) {
	return (
		<EventNode
			{...props}
			hasPendingChanges={nodeTypeRefs.nodesWithChanges.current.has(props.id)}
		/>
	)
}

function createBranchNode(props: NodeProps<BranchNodeData>) {
	return (
		<BranchNode
			{...props}
			triggers={nodeTypeRefs.triggers.current}
			events={nodeTypeRefs.events.current}
			hasPendingChanges={nodeTypeRefs.nodesWithChanges.current.has(props.id)}
		/>
	)
}

// Define nodeTypes object outside component - functions are stable function declarations
// This ensures React Flow sees a stable reference that never changes
const nodeTypes = {
	trigger: createTriggerNode,
	event: createEventNode,
	branch: createBranchNode,
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
	nodesRefForTest,
	nodesWithChanges,
}: WiringCanvasProps) {
	const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
	const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges)
	// Use internal ref to track latest nodes for validation (separate from prop nodesRef)
	const internalNodesRef = useRef(nodes)
	// Use internal ref to track latest edges for change detection
	const internalEdgesRef = useRef(edges)

	// Store workspaceId in a ref so nodeTypes can access it without causing re-renders
	const workspaceIdRef = useRef(workspaceId)
	useEffect(() => {
		workspaceIdRef.current = workspaceId
	}, [workspaceId])

	// Store nodesWithChanges in a ref to avoid recreating nodeTypes
	const nodesWithChangesRef = useRef<Set<string>>(new Set())

	// Update ref when nodesWithChanges changes
	useEffect(() => {
		if (nodesWithChanges) {
			nodesWithChangesRef.current = nodesWithChanges
		} else {
			nodesWithChangesRef.current = new Set()
		}
	}, [nodesWithChanges])

	// Store nodesRefForTest in a ref to avoid recreating nodeTypes when it changes
	const nodesRefForTestRef = useRef(nodesRefForTest)
	useEffect(() => {
		nodesRefForTestRef.current = nodesRefForTest
	}, [nodesRefForTest])

	// Store triggers and events in refs for LogicNode
	const triggersRef = useRef(triggers)
	const eventsRef = useRef(events)
	useEffect(() => {
		triggersRef.current = triggers
	}, [triggers])
	useEffect(() => {
		eventsRef.current = events
	}, [events])

	// Update global refs that node type functions use
	// This allows nodeTypes to access dynamic values without being recreated
	useEffect(() => {
		nodeTypeRefs.workspaceId.current = workspaceIdRef.current
		nodeTypeRefs.nodesRefForTest.current = nodesRefForTestRef.current
		nodeTypeRefs.triggers.current = triggersRef.current
		nodeTypeRefs.events.current = eventsRef.current
		nodeTypeRefs.nodesWithChanges.current = nodesWithChangesRef.current
	}, [workspaceId, nodesRefForTest, triggers, events, nodesWithChanges])

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
			// First, filter out orphaned edges (edges that reference non-existent nodes)
			const validEdges = eds.filter(edge => {
				// Use internalNodesRef to get the latest nodes state (including config changes)
				const sourceNode = internalNodesRef.current.find(
					n => n.id === edge.source
				)
				const targetNode = internalNodesRef.current.find(
					n => n.id === edge.target
				)

				// Remove edges that reference non-existent nodes
				if (!sourceNode || !targetNode) {
					return false
				}

				// Allow edges involving branch nodes
				if (sourceNode.type === 'branch' || targetNode.type === 'branch') {
					return true
				}

				// For trigger->event edges, validate node IDs
				const triggerMatch = edge.source.match(/^trigger-(\d+)/)
				const eventMatch = edge.target.match(/^event-(\d+)/)

				if (!triggerMatch || !eventMatch) {
					return false // Remove edges with invalid node ID format
				}

				const triggerId = parseInt(triggerMatch[1])
				const eventId = parseInt(eventMatch[1])

				const trigger = triggers.find(t => t.id === triggerId)
				const event = events.find(e => e.id === eventId)

				// Remove edges that reference non-existent triggers/events
				if (!trigger || !event) {
					return false
				}

				return true
			})

			// Then validate the remaining edges
			return validEdges.map(edge => {
				// Use internalNodesRef to get the latest nodes state (including config changes)
				const sourceNode = internalNodesRef.current.find(
					n => n.id === edge.source
				)!
				const targetNode = internalNodesRef.current.find(
					n => n.id === edge.target
				)!

				// Skip validation for edges involving branch nodes - they're always valid
				if (sourceNode.type === 'branch' || targetNode.type === 'branch') {
					// Extract data types from source node if it's a trigger
					let dataTypes: string[] = []
					if (sourceNode.type === 'trigger' && sourceNode.data?.output_schema) {
						dataTypes = extractDataTypes(sourceNode.data.output_schema)
					}
					return {
						...edge,
						style: { stroke: '#22c55e' },
						animated: true,
						data: {
							...edge.data,
							validationError: undefined,
							dataTypes,
						},
					}
				}

				// Extract trigger and event IDs from node IDs
				const triggerMatch = edge.source.match(/^trigger-(\d+)/)
				const eventMatch = edge.target.match(/^event-(\d+)/)

				if (!triggerMatch || !eventMatch) {
					// This shouldn't happen after filtering, but handle it anyway
					return {
						...edge,
						style: { stroke: '#ef4444' },
						animated: false,
						data: {
							...edge.data,
							validationError: 'Invalid connection',
						},
					}
				}

				const triggerId = parseInt(triggerMatch[1])
				const eventId = parseInt(eventMatch[1])

				const trigger = triggers.find(t => t.id === triggerId)!
				const event = events.find(e => e.id === eventId)!

				// Get effective event schema based on node configuration
				let effectiveEvent = event
				const eventData = targetNode.data as any

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

				// Extract data types from trigger's output schema
				const dataTypes = trigger.output_schema
					? extractDataTypes(trigger.output_schema)
					: []

				if (!validation.valid) {
					return {
						...edge,
						style: { stroke: '#ef4444' },
						animated: false,
						data: {
							...edge.data,
							validationError: validation.error,
							dataTypes,
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
						dataTypes,
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
		// Always validate, even if edges.length is 0, to clear invalid state
		const timeoutId = setTimeout(() => {
			validateAllEdges()
		}, 100)
		return () => clearTimeout(timeoutId)
	}, [nodes, edges.length, validateAllEdges, nodesRef])

	useEffect(() => {
		internalEdgesRef.current = edges
		if (edgesRef) {
			edgesRef.current = edges
		}
		// Trigger validation when edges change to clean up any orphaned edges
		const timeoutId = setTimeout(() => {
			validateAllEdges()
		}, 100)
		return () => clearTimeout(timeoutId)
	}, [edges, edgesRef, validateAllEdges])

	// Check for invalid edges and notify parent
	useEffect(() => {
		if (onValidationChange) {
			const hasInvalid = edges.some(
				edge => edge.style?.stroke === '#ef4444'
			)
			onValidationChange(hasInvalid)
		}
	}, [edges, onValidationChange])

	// Debounce timer ref for notifying parent
	const notifyParentTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Handle node changes
	const handleNodesChange = useCallback(
		(changes: any) => {
			onNodesChangeInternal(changes)
			// Re-validate edges after node changes (especially config changes)
			// Use a longer timeout to ensure state has updated
			setTimeout(() => {
				validateAllEdges()
			}, 150)

			// Notify parent of node changes (debounced to avoid infinite loops)
			// Only notify if onNodesChange is provided
			if (onNodesChange) {
				// Clear any pending notification
				if (notifyParentTimeoutRef.current) {
					clearTimeout(notifyParentTimeoutRef.current)
				}
				// Schedule notification after nodes state has updated
				// Use internalNodesRef which gets updated in the useEffect above
				notifyParentTimeoutRef.current = setTimeout(() => {
					const currentNodes = internalNodesRef.current
					if (currentNodes && onNodesChange) {
						onNodesChange(currentNodes)
					}
				}, 300)
			}
		},
		[onNodesChangeInternal, validateAllEdges, onNodesChange]
	)

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (notifyParentTimeoutRef.current) {
				clearTimeout(notifyParentTimeoutRef.current)
			}
		}
	}, [])

	// Handle edge changes
	const handleEdgesChange = useCallback(
		(changes: any) => {
			onEdgesChangeInternal(changes)
			// Use a timeout to ensure edges state has updated before notifying parent
			// Use internalEdgesRef which gets updated in the useEffect above
			setTimeout(() => {
				if (onEdgesChange) {
					const currentEdges = internalEdgesRef.current
					if (currentEdges) {
						onEdgesChange(currentEdges)
					}
				}
			}, 100)
		},
		[onEdgesChange, onEdgesChangeInternal]
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
			const nodeIdToDelete = contextMenu.nodeId
			// Capture current state before deletion
			const currentNodes = [...nodes]
			const currentEdges = [...edges]

			// Update state
			setNodes(nds => nds.filter(n => n.id !== nodeIdToDelete))
			// Also remove connected edges
			setEdges(eds =>
				eds.filter(
					e =>
						e.source !== nodeIdToDelete &&
						e.target !== nodeIdToDelete
				)
			)

			// Calculate updated state immediately
			const updatedNodes = currentNodes.filter(n => n.id !== nodeIdToDelete)
			const updatedEdges = currentEdges.filter(
				e =>
					e.source !== nodeIdToDelete &&
					e.target !== nodeIdToDelete
			)

			// Manually notify parent (direct setNodes doesn't trigger React Flow's onNodesChange)
			// Use a small timeout to ensure state has been processed
			setTimeout(() => {
				if (onNodesChange) {
					onNodesChange(updatedNodes)
				}
				if (onEdgesChange) {
					onEdgesChange(updatedEdges)
				}
			}, 50)
		} else if (contextMenu.type === 'edge' && contextMenu.edgeId) {
			const edgeIdToDelete = contextMenu.edgeId
			// Capture current state before deletion
			const currentEdges = [...edges]

			// Update state
			setEdges(eds => eds.filter(e => e.id !== edgeIdToDelete))

			// Calculate updated state immediately
			const updatedEdges = currentEdges.filter(e => e.id !== edgeIdToDelete)

			// Manually notify parent
			setTimeout(() => {
				if (onEdgesChange) {
					onEdgesChange(updatedEdges)
				}
			}, 50)
		}

		setContextMenu(null)
	}, [contextMenu, setNodes, setEdges, nodes, edges, onNodesChange, onEdgesChange])

	// Validate connection before allowing it
	const onConnect = useCallback(
		(params: Connection) => {
			if (!params.source || !params.target) {
				return
			}

			const sourceNode = nodes.find(n => n.id === params.source)
			const targetNode = nodes.find(n => n.id === params.target)

			if (!sourceNode || !targetNode) {
				return
			}

			// Allow connections to/from branch nodes without validation
			if (sourceNode.type === 'branch' || targetNode.type === 'branch') {
				// Extract data types from source node if it's a trigger
				let dataTypes: string[] = []
				if (sourceNode.type === 'trigger' && sourceNode.data?.output_schema) {
					dataTypes = extractDataTypes(sourceNode.data.output_schema)
				}
				const newEdge = {
					...params,
					animated: true,
					style: { stroke: '#22c55e' },
					data: {
						dataTypes,
					},
				}
				setEdges(eds => addEdge(newEdge, eds))
				if (onConnectProp) {
					onConnectProp(params)
				}
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

			// Extract data types from trigger's output schema
			const dataTypes = trigger.output_schema
				? extractDataTypes(trigger.output_schema)
				: []

			// Always allow the connection, but mark it appropriately
			const newEdge = {
				...params,
				animated: validation.valid,
				style: { stroke: validation.valid ? '#22c55e' : '#ef4444' },
				data: {
					validationError: validation.valid
						? undefined
						: validation.error,
					dataTypes,
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

	// Handle adding branch node
	const handleAddBranchNode = useCallback(() => {
		const newNode: Node<BranchNodeData> = {
			id: `branch-${Date.now()}`,
			type: 'branch',
			position: { x: 400, y: 200 }, // Default position
			data: {
				config: {
					logicType: 'if_else',
				},
			},
		}
		setNodes(nds => [...nds, newNode])
	}, [setNodes])

	return (
		<div
			className={styles.wiringCanvas}
			onDrop={onDrop}
			onDragOver={onDragOver}>
			<WiringLegend />
			{!readOnly && (
				<div className={styles.toolbar}>
					<button
						onClick={handleAddBranchNode}
						className={styles.toolbarButton}
						title="Add Branch Node">
						Branch ⑂
					</button>
				</div>
			)}
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

