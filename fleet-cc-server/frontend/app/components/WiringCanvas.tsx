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
} from 'reactflow'
import 'reactflow/dist/style.css'
import TriggerNode, { TriggerNodeData } from './nodes/TriggerNode'
import EventNode, { EventNodeData } from './nodes/EventNode'
import { validateConnection } from '../utils/schemaValidation'
import ContextMenu from './wiring/ContextMenu'
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
	}>
	initialNodes?: Node[]
	initialEdges?: Edge[]
	onNodesChange?: (nodes: Node[]) => void
	onEdgesChange?: (edges: Edge[]) => void
	onConnect?: (connection: Connection) => void
	readOnly?: boolean
	nodesRef?: React.MutableRefObject<Node[] | null>
	edgesRef?: React.MutableRefObject<Edge[] | null>
}

// Define nodeTypes outside component to avoid React Flow warning
// This must be a stable reference that doesn't change between renders
const nodeTypes = {
	trigger: TriggerNode,
	event: EventNode,
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
}: WiringCanvasProps) {
	const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
	const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges)
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
					action.event_code === 'send_email'

				// Find the action in events array to get availableMessages
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

	// Update refs when nodes/edges change
	useEffect(() => {
		if (nodesRef) {
			nodesRef.current = nodes
		}
	}, [nodes, nodesRef])

	useEffect(() => {
		if (edgesRef) {
			edgesRef.current = edges
		}
	}, [edges, edgesRef])

	// Handle node changes
	const handleNodesChange = useCallback(
		(changes: any) => {
			onNodesChangeInternal(changes)
			// Don't call onNodesChange here - it causes infinite loops
			// Parent will get updates via nodesRef or by reading nodes state when needed
		},
		[onNodesChangeInternal]
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

			// Validate the connection
			const validation = validateConnection(trigger, event)
			if (!validation.valid) {
				alert(`Invalid connection: ${validation.error}`)
				return
			}

			// Add the edge
			setEdges(eds => addEdge({ ...params, animated: true }, eds))

			// Call parent callback if provided
			if (onConnectProp) {
				onConnectProp(params)
			}
		},
		[triggers, events, onConnectProp, setEdges]
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
