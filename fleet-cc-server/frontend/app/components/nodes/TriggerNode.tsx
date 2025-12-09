'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import styles from './TriggerNode.module.scss'

export interface TriggerNodeData {
	id: number
	trigger_code: string
	trigger_name: string
	description?: string | null
	output_schema?: any
	enabled: boolean
	config?: any // Node-specific configuration
	hasVariableDataTypes?: boolean // Whether data types can vary based on configuration
}

export default function TriggerNode({ data }: NodeProps<TriggerNodeData>) {
	const dataTypes = data.output_schema
		? extractDataTypes(data.output_schema)
		: []
	const hasVariableTypes = data.hasVariableDataTypes || false

	return (
		<div
			className={`${styles.triggerNode} ${
				!data.enabled ? styles.disabled : ''
			}`}>
			<div className={styles.header}>
				<div className={styles.icon}>⚡</div>
				<div className={styles.title}>{data.trigger_name}</div>
			</div>
			{data.description && (
				<div className={styles.description}>{data.description}</div>
			)}
			<div className={styles.dataTypes}>
				<span className={styles.dataTypesLabel}>Emits:</span>
				{hasVariableTypes ? (
					<span
						className={styles.variableIndicator}
						title='Data types may vary based on configuration'>
						Variable
					</span>
				) : (
					<DataTypeIcons types={dataTypes} size='small' />
				)}
			</div>
			<div className={styles.code}>{data.trigger_code}</div>

			{/* Output handle - triggers emit data */}
			<Handle
				type='source'
				position={Position.Right}
				id='output'
				className={styles.outputHandle}
			/>

			{!data.enabled && (
				<div className={styles.disabledBadge}>Disabled</div>
			)}
		</div>
	)
}
