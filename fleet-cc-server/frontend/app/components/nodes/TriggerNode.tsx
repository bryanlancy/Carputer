'use client'

import { useState, useMemo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import { generateFakeDataFromSchema } from '../../utils/fakeDataGenerator'
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
	nodesRefForTest?: React.MutableRefObject<any[] | null> // Current nodes for extracting node_config
	hasPendingChanges?: boolean // Whether this node has unsaved changes
}

export default function TriggerNode({
	data,
	workspaceId,
	nodesRefForTest,
	hasPendingChanges = false,
}: TriggerNodeProps) {
	const { session } = useAuth()
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<string | null>(null)
	const [showTestDataEditor, setShowTestDataEditor] = useState(false)
	const [testDataJson, setTestDataJson] = useState('')
	const [testDataError, setTestDataError] = useState<string | null>(null)

	const dataTypes = data.output_schema
		? extractDataTypes(data.output_schema)
		: []
	const hasVariableTypes = data.hasVariableDataTypes || false

	// Generate default test data from schema with trigger context
	const defaultTestData = useMemo(() => {
		if (data.output_schema) {
			return generateFakeDataFromSchema(
				data.output_schema,
				undefined,
				data.trigger_code,
				data.trigger_name
			)
		}
		return {
			device: {
				id: 1,
				device_id: 'DEV-001',
				hostname: 'test-device',
				status: 'online',
			},
			timestamp: new Date().toISOString(),
		}
	}, [data.output_schema, data.trigger_code, data.trigger_name])

	// Initialize test data JSON when opening editor
	const openTestDataEditor = () => {
		try {
			const currentData = testDataJson ? JSON.parse(testDataJson) : defaultTestData
			setTestDataJson(JSON.stringify(currentData, null, 2))
			setTestDataError(null)
		} catch (err) {
			setTestDataJson(JSON.stringify(defaultTestData, null, 2))
			setTestDataError(null)
		}
		setShowTestDataEditor(true)
	}

	const handleTest = async (testDataOverride?: any) => {
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
		setShowTestDataEditor(false)

		try {
			const apiUrl = getApiUrl()
			const body: any = {}

			// If test data was provided (either from editor or default), include it
			const testData = testDataOverride !== undefined
				? testDataOverride
				: (testDataJson ? JSON.parse(testDataJson) : undefined)

			if (testData) {
				body.testData = testData
			}

			// Extract current node_config from frontend nodes (current selections, not saved)
			// This allows testing with current dropdown selections before saving
			if (nodesRefForTest?.current) {
				const nodeConfig: Record<string, any> = {}
				nodesRefForTest.current.forEach((node: any) => {
					if (node.data?.config && Object.keys(node.data.config).length > 0) {
						nodeConfig[node.id] = node.data.config
					}
				})
				if (Object.keys(nodeConfig).length > 0) {
					body.node_config = nodeConfig
				}
			}

			const response = await fetch(
				`${apiUrl}/api/admin/wiring/${workspaceId}/triggers/${data.id}/test`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session.access_token}`,
					},
					body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
				}
			)

			if (response.ok) {
				const result = await response.json()
				const successCount =
					result.executedEvents?.filter((e: any) => e.success)
						.length || 0
				const totalCount = result.executedEvents?.length || 0
				const errors = result.executedEvents
					?.filter((e: any) => !e.success && e.error)
					.map((e: any) => `${e.event?.event_name || 'Unknown'}: ${e.error}`)
					.join('; ') || ''

				if (successCount === 0 && totalCount > 0) {
					setTestResult(
						`Test: ${successCount}/${totalCount} actions executed. Errors: ${errors || 'Unknown error'}`
					)
				} else {
					setTestResult(
						`Test: ${successCount}/${totalCount} actions executed${errors ? `. Errors: ${errors}` : ''}`
					)
				}
				setTimeout(() => setTestResult(null), 8000)
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

	const handleTestClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		openTestDataEditor()
	}

	const handleTestWithData = () => {
		try {
			const parsed = JSON.parse(testDataJson)
			setTestDataError(null)
			handleTest(parsed)
		} catch (err: any) {
			setTestDataError(`Invalid JSON: ${err.message}`)
		}
	}

	const handleQuickTest = (e: React.MouseEvent) => {
		e.stopPropagation()
		handleTest() // Use default generated data
	}

	return (
		<div
			className={`${styles.triggerNode} ${
				!data.enabled ? styles.disabled : ''
			}`}>
			{hasPendingChanges && (
				<div className={styles.pendingChangeIndicator} title="Unsaved changes" />
			)}
			<div className={styles.header}>
				<div className={styles.icon}>⚡</div>
				<div className={styles.title}>{data.trigger_name}</div>
				{workspaceId && data.enabled && (
					<div className={styles.testButtons}>
						<button
							onClick={handleTestClick}
							disabled={testing}
							className={styles.testButton}
							title="Test with custom data"
							type='button'>
							Test
						</button>
						<button
							onClick={handleQuickTest}
							disabled={testing}
							className={styles.quickTestButton}
							title="Quick test with default data"
							type='button'>
							⚡
						</button>
					</div>
				)}
			</div>
			{testResult && (
				<div className={styles.testResult}>{testResult}</div>
			)}
			{showTestDataEditor && (
				<div className={styles.testDataEditor}>
					<div className={styles.editorHeader}>
						<h4>Edit Test Data</h4>
						<button
							onClick={() => {
								setShowTestDataEditor(false)
								setTestDataError(null)
							}}
							className={styles.closeButton}>
							×
						</button>
					</div>
					<textarea
						value={testDataJson}
						onChange={e => {
							setTestDataJson(e.target.value)
							setTestDataError(null)
						}}
						className={styles.jsonEditor}
						placeholder="Enter JSON test data..."
					/>
					{testDataError && (
						<div className={styles.errorMessage}>{testDataError}</div>
					)}
					<div className={styles.editorActions}>
						<button
							onClick={handleTestWithData}
							disabled={testing || !!testDataError}
							className={styles.runTestButton}>
							Run Test
						</button>
						<button
							onClick={() => {
								setTestDataJson(JSON.stringify(defaultTestData, null, 2))
								setTestDataError(null)
							}}
							className={styles.resetButton}>
							Reset to Default
						</button>
					</div>
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
