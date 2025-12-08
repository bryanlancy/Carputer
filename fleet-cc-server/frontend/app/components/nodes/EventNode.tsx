'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import styles from './EventNode.module.scss'

export interface EventNodeData {
  id: number
  event_code: string
  event_name: string
  description?: string | null
  input_schema?: any
  handler_type: string
  enabled: boolean
}

export default function EventNode({ data }: NodeProps<EventNodeData>) {
  return (
    <div className={`${styles.eventNode} ${!data.enabled ? styles.disabled : ''}`}>
      <div className={styles.header}>
        <div className={styles.icon}>🎯</div>
        <div className={styles.title}>{data.event_name}</div>
      </div>
      {data.description && (
        <div className={styles.description}>{data.description}</div>
      )}
      <div className={styles.code}>{data.event_code}</div>
      <div className={styles.handlerType}>{data.handler_type}</div>

      {/* Input handle - events receive data */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={styles.inputHandle}
      />

      {!data.enabled && (
        <div className={styles.disabledBadge}>Disabled</div>
      )}
    </div>
  )
}

