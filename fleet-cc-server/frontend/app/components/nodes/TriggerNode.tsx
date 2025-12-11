'use client'

import { useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
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

interface TriggerNodeProps extends NodeProps<TriggerNodeData> {
	workspaceId?: number | null
}

export default function TriggerNode({ data, workspaceId }: TriggerNodeProps) {
	const { session } = useAuth()
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<string | null>(null)
	const dataTypes = data.output_schema
		? extractDataTypes(data.output_schema)
		: []
	const hasVariableTypes = data.hasVariableDataTypes || false

	const handleTest = async (e: React.MouseEvent) => {
		e.stopPropagation()
		
		if (!workspaceId) {
			setTestResult('Please select a workspace first')
			setTimeout(() => setTestResult(null), 3000)
			return
		}

		if (!session?.access_token) {
			setTestResult('Authentication required')
			setTimeout(() => setTestResult(null), 3000)
			return
		}

		setTesting(true)
		setTestResult(null)

		try {
			const apiUrl = getApiUrl()
			const response = await fetch(
				`${apiUrl}/api/admin/wiring/${workspaceId}/triggers/${data.id}/test`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${session.access_token}`,
					},
				}
			)

			if (response.ok) {
				const result = await response.json()
				const successCount = result.executedEvents?.filter(
					(e: any) => e.success
				).length || 0
				const totalCount = result.executedEvents?.length || 0
				setTestResult(
					`Test: ${successCount}/${totalCount} actions executed`
				)
				setTimeout(() => setTestResult(null), 5000)
			} else {
				const errorData = await response.json().catch(() => ({
					error: 'Failed to test trigger',
				}))
				setTestResult(errorData.error || 'Test failed')
				setTimeout(() => setTestResult(null), 5000)
			}
		} catch (err: any) {
			setTestResult(`Error: ${err.message}`)
			setTimeout(() => setTestResult(null), 5000)
		} finally {
			setTesting(false)
		}
	}

	return (
		<div
			className={`${styles.triggerNode} ${
				!data.enabled ? styles.disabled : ''
			}`}>
			<div className={styles.header}>
				<div className={styles.icon}>⚡</div>
				<div className={styles.title}>{data.trigger_name}</div>
				{workspaceId && data.enabled && (
					<button
						onClick={handleTest}
						disabled={testing}
						className={styles.testButton}
						title="Test this trigger node's connections"
						type="button">
						{testing ? '...' : 'Test'}
					</button>
				)}
			</div>
			{testResult && (
				<div className={styles.testResult}>
					{testResult}
				</div>
			)}
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
