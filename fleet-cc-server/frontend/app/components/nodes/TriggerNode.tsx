'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import styles from './TriggerNode.module.scss'

export interface TriggerNodeData {
  id: number
  trigger_code: string
  trigger_name: string
  description?: string | null
  output_schema?: any
  enabled: boolean
}

export default function TriggerNode({ data }: NodeProps<TriggerNodeData>) {
  return (
    <div className={`${styles.triggerNode} ${!data.enabled ? styles.disabled : ''}`}>
      <div className={styles.header}>
        <div className={styles.icon}>⚡</div>
        <div className={styles.title}>{data.trigger_name}</div>
      </div>
      {data.description && (
        <div className={styles.description}>{data.description}</div>
      )}
      <div className={styles.code}>{data.trigger_code}</div>

      {/* Output handle - triggers emit data */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={styles.outputHandle}
      />

      {!data.enabled && (
        <div className={styles.disabledBadge}>Disabled</div>
      )}
    </div>
  )
}

