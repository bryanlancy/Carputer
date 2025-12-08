'use client'

import { useCallback, useMemo, useRef, useEffect } from 'react'
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
import styles from './WiringCanvas.module.scss'

const nodeTypes = {
  trigger: TriggerNode,
  event: EventNode,
}

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

  // Convert triggers and events to nodes if not already provided
  const defaultNodes = useMemo(() => {
    const triggerNodes: Node<TriggerNodeData>[] = triggers.map((trigger, index) => ({
      id: `trigger-${trigger.id}`,
      type: 'trigger',
      position: { x: 100, y: 100 + index * 150 },
      data: trigger,
    }))

    const eventNodes: Node<EventNodeData>[] = events.map((event, index) => ({
      id: `event-${event.id}`,
      type: 'event',
      position: { x: 500, y: 100 + index * 150 },
      data: event,
    }))

    return [...triggerNodes, ...eventNodes]
  }, [triggers, events])

  // Use provided initial nodes or default nodes
  const finalNodes = useMemo(() => {
    if (initialNodes.length > 0) {
      return initialNodes
    }
    return defaultNodes
  }, [initialNodes, defaultNodes])

  // Update nodes when initialNodes change
  useMemo(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes)
    } else if (defaultNodes.length > 0 && nodes.length === 0) {
      setNodes(defaultNodes)
    }
  }, [initialNodes, defaultNodes, nodes.length, setNodes])

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
      // Get updated nodes after applying changes
      setTimeout(() => {
        if (onNodesChange) {
          onNodesChange(nodes)
        }
      }, 0)
    },
    [nodes, onNodesChange, onNodesChangeInternal]
  )

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

  // Validate connection before allowing it
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) {
        return
      }

      // Extract trigger and event IDs from node IDs
      const triggerId = params.source.replace('trigger-', '')
      const eventId = params.target.replace('event-', '')

      const trigger = triggers.find((t) => t.id === parseInt(triggerId))
      const event = events.find((e) => e.id === parseInt(eventId))

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
      setEdges((eds) => addEdge({ ...params, animated: true }, eds))

      // Call parent callback if provided
      if (onConnectProp) {
        onConnectProp(params)
      }
    },
    [triggers, events, onConnectProp, setEdges]
  )

  return (
    <div className={styles.wiringCanvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        nodeTypes={nodeTypes}
        fitView
        className={styles.flow}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

