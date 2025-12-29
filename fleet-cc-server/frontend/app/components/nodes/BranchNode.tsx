'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Handle, Position, NodeProps, useNodeId, useReactFlow } from 'reactflow'
import {
	extractSchemaFields,
	SchemaField,
	getFieldType,
	groupFieldsByParent,
	formatParentName,
} from '../../utils/schemaFieldExtractor'
import styles from './BranchNode.module.scss'

export interface BranchNodeData {
	config?: {
		logicType?: string
		fieldPath?: string
		operator?: string
		comparisonValue?: string
		timestampOption?: string // For timestamp fields: year, month, day, hour, etc.
	}
}

interface BranchNodeProps extends NodeProps<BranchNodeData> {
	triggers?: Array<{
		id: number
		trigger_code: string
		output_schema?: any
	}>
	events?: Array<{
		id: number
		event_code: string
		input_schema?: any
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
	hasPendingChanges?: boolean
}

// Comparison operators by field type
const OPERATORS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
	string: [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not_equals', label: 'Not Equals' },
		{ value: 'contains', label: 'Contains' },
		{ value: 'starts_with', label: 'Starts With' },
		{ value: 'ends_with', label: 'Ends With' },
	],
	number: [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not_equals', label: 'Not Equals' },
		{ value: 'greater_than', label: 'Greater Than' },
		{ value: 'less_than', label: 'Less Than' },
		{ value: 'greater_than_or_equal', label: 'Greater Than Or Equal' },
		{ value: 'less_than_or_equal', label: 'Less Than Or Equal' },
	],
	boolean: [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not_equals', label: 'Not Equals' },
	],
	'date-time': [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not_equals', label: 'Not Equals' },
		{ value: 'before', label: 'Before' },
		{ value: 'after', label: 'After' },
	],
}

export default function BranchNode({
	data,
	triggers = [],
	events = [],
	hasPendingChanges = false,
}: BranchNodeProps) {
	const nodeId = useNodeId()
	const { getNode, getEdges, setNodes } = useReactFlow()

	// Get current node data from React Flow
	// We need to re-read this on every render to get the latest state from React Flow
	const currentNode = nodeId ? getNode(nodeId) : null
	const currentNodeData = currentNode?.data || data
	// Get config directly from node data
	const currentConfig = currentNodeData?.config || {}

	// State for configuration
	// Initialize from data prop config if available (from initialNodes), otherwise use defaults
	// The data prop should have the merged config when nodes are loaded
	const initialConfig = data?.config || {}
	const [logicType, setLogicType] = useState<string>(initialConfig.logicType || 'if_else')
	const [fieldPath, setFieldPath] = useState<string>(initialConfig.fieldPath || '')
	const [operator, setOperator] = useState<string>(initialConfig.operator || '')
	const [comparisonValue, setComparisonValue] = useState<string>(initialConfig.comparisonValue || '')
	const [timestampOption, setTimestampOption] = useState<string>(initialConfig.timestampOption || '')

	// Get input schema from connected source node
	const inputSchema = useMemo(() => {
		if (!nodeId) return null

		const edges = getEdges()
		const incomingEdge = edges.find(edge => edge.target === nodeId)

		if (!incomingEdge) return null

		const sourceNode = getNode(incomingEdge.source)
		if (!sourceNode) return null

		const sourceData = sourceNode.data as any

		// Check if it's a trigger node
		if (sourceNode.type === 'trigger' && sourceData.output_schema) {
			return sourceData.output_schema
		}

		// Check if it's a branch node - pass through the schema from its input
		if (sourceNode.type === 'branch') {
			// For branch nodes, we'd need to get the schema from their input
			// For now, return null to indicate schema needs to come from connected source
			// This could be enhanced later to support chaining
			return null
		}

		// Check if it's an event node
		if (sourceNode.type === 'event' && sourceData.input_schema) {
			// For event nodes, we need to handle variable schemas similar to WiringCanvas
			if (sourceData.event_code === 'show_notification' && sourceData.config?.notification_id) {
				const eventId = sourceData.id
				const event = events.find(e => e.id === eventId)
				if (event?.availableNotificationTypes) {
					const selectedType = event.availableNotificationTypes.find(
						(nt: any) => nt.id.toString() === sourceData.config.notification_id.toString()
					)
					if (selectedType?.variable_schema) {
						return selectedType.variable_schema
					}
				}
			} else if (sourceData.event_code === 'send_email' && sourceData.config?.message_code) {
				// Email events typically require device data
				return {
					type: 'object',
					properties: {
						device: { type: 'object' },
					},
					required: ['device'],
				}
			} else if (sourceData.event_code === 'execute_command' && sourceData.config?.command) {
				// Commands always require device
				return {
					type: 'object',
					properties: {
						device: { type: 'object' },
					},
					required: ['device'],
				}
			}
			return sourceData.input_schema
		}

		return null
	}, [nodeId, getEdges, getNode, events])

	// Extract available fields from input schema
	const availableFields = useMemo(() => {
		if (!inputSchema) return []
		const fields = extractSchemaFields(inputSchema)

		// Find all timestamp fields
		const timestampFields = fields.filter(field =>
			field.type === 'date-time' || field.format === 'date-time' ||
			field.format === 'date' || field.format === 'time' ||
			field.path.toLowerCase().includes('timestamp') ||
			field.path.toLowerCase().includes('date') ||
			field.path.toLowerCase().includes('time')
		)

		// Add timestamp subfields only once (use the first timestamp field found, typically 'timestamp')
		const allFields = [...fields]
		if (timestampFields.length > 0) {
			// Find the primary timestamp field (prefer 'timestamp' if it exists)
			const primaryTimestampField = timestampFields.find(f =>
				f.path.toLowerCase() === 'timestamp'
			) || timestampFields[0]

			// Create timestamp subfields for the primary timestamp field
			const timestampOptions = [
				{ key: 'year', label: 'Year', type: 'number' as const },
				{ key: 'month', label: 'Month', type: 'number' as const },
				{ key: 'day', label: 'Day', type: 'number' as const },
				{ key: 'hour', label: 'Hour', type: 'number' as const },
				{ key: 'minute', label: 'Minute', type: 'number' as const },
				{ key: 'second', label: 'Second', type: 'number' as const },
				{ key: 'dayOfWeek', label: 'Day of Week', type: 'number' as const },
				{ key: 'dayOfYear', label: 'Day of Year', type: 'number' as const },
				{ key: 'week', label: 'Week', type: 'number' as const },
				{ key: 'quarter', label: 'Quarter', type: 'number' as const },
			]

			timestampOptions.forEach(option => {
				allFields.push({
					path: `${primaryTimestampField.path}.${option.key}`,
					label: `${option.label}`, // Just show the subfield name, not the parent field
					type: option.type,
				})
			})
		}

		return allFields
	}, [inputSchema])

	// Group fields by parent for organized dropdown
	const groupedFields = useMemo(() => {
		return groupFieldsByParent(availableFields)
	}, [availableFields])

	// Get selected field info
	const selectedField = useMemo(() => {
		if (!fieldPath || !inputSchema) return null

		const field = availableFields.find(f => f.path === fieldPath)
		if (!field) return null

		// Check if it's a timestamp subfield
		const pathParts = fieldPath.split('.')
		if (pathParts.length > 1) {
			const lastPart = pathParts[pathParts.length - 1]
			const timestampSubfields = ['year', 'month', 'day', 'hour', 'minute', 'second', 'dayOfWeek', 'dayOfYear', 'week', 'quarter']
			if (timestampSubfields.includes(lastPart)) {
				return {
					...field,
					isTimestampSubfield: true,
					timestampOption: lastPart,
				}
			}
		}

		return field
	}, [fieldPath, inputSchema, availableFields])

	// Get available operators for selected field type
	const availableOperators = useMemo(() => {
		if (!selectedField) return []
		// Timestamp subfields use number operators
		if ((selectedField as any).isTimestampSubfield) {
			return OPERATORS_BY_TYPE.number
		}
		return OPERATORS_BY_TYPE[selectedField.type] || OPERATORS_BY_TYPE.string
	}, [selectedField])

	// Get help text for timestamp comparisons
	const timestampHelpText = useMemo(() => {
		if (!selectedField || !(selectedField as any).isTimestampSubfield) return null
		const option = (selectedField as any).timestampOption

		const helpTexts: Record<string, string> = {
			year: 'Enter a year (e.g., 2024)',
			month: 'Enter a month number (1-12, where 1=January, 12=December)',
			day: 'Enter a day number (1-31)',
			hour: 'Enter an hour (0-23, where 0=midnight, 23=11 PM)',
			minute: 'Enter a minute (0-59)',
			second: 'Enter a second (0-59)',
			dayOfWeek: 'Enter a day of week (0-6, where 0=Sunday, 6=Saturday)',
			dayOfYear: 'Enter a day of year (1-365 or 1-366 for leap years)',
			week: 'Enter a week number (1-52 or 1-53)',
			quarter: 'Enter a quarter (1-4, where 1=Q1, 4=Q4)',
		}

		return helpTexts[option] || null
	}, [selectedField])

	// Sync state with config when it loads
	// Track the last config string we synced from
	const lastSyncedConfigRef = useRef<string>('')

	// Sync state with config when it becomes available
	// Get the actual config to use (from React Flow node or props)
	const effectiveConfig = currentNode?.data?.config || data?.config || currentConfig

	// Create a stable string representation of the config for comparison
	const configString = useMemo(() => {
		return JSON.stringify(effectiveConfig || {})
	}, [
		effectiveConfig?.logicType,
		effectiveConfig?.fieldPath,
		effectiveConfig?.operator,
		effectiveConfig?.comparisonValue,
		effectiveConfig?.timestampOption,
	])

	useEffect(() => {
		// Check if we have a valid config with actual values
		const hasConfig = effectiveConfig && Object.keys(effectiveConfig).length > 0

		if (!hasConfig) {
			return
		}

		// Check if config has changed by comparing string representations
		const lastConfigString = lastSyncedConfigRef.current
		if (configString === lastConfigString) {
			return
		}

		// Update ref to track what we've synced
		lastSyncedConfigRef.current = configString

		// Sync state from config - always update if config has the value
		if (effectiveConfig.logicType !== undefined) {
			setLogicType(effectiveConfig.logicType)
		}
		if (effectiveConfig.fieldPath !== undefined && effectiveConfig.fieldPath !== '') {
			setFieldPath(effectiveConfig.fieldPath)
		}
		if (effectiveConfig.operator !== undefined) {
			setOperator(effectiveConfig.operator)
		}
		if (effectiveConfig.comparisonValue !== undefined) {
			setComparisonValue(effectiveConfig.comparisonValue)
		}
		if (effectiveConfig.timestampOption !== undefined) {
			setTimestampOption(effectiveConfig.timestampOption)
		}
	}, [configString, effectiveConfig, fieldPath])

	// Reset operator when field changes
	useEffect(() => {
		if (selectedField && availableOperators.length > 0) {
			// If current operator is not available for new field type, reset it
			if (!availableOperators.find(op => op.value === operator)) {
				setOperator(availableOperators[0].value)
				updateNodeConfig({ operator: availableOperators[0].value })
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedField])

	const updateNodeConfig = (updates: Record<string, string>) => {
		if (nodeId) {
			setNodes(nds => {
				return nds.map(node =>
					node.id === nodeId
						? {
								...node,
								data: {
									...node.data,
									config: {
										...(node.data?.config || {}),
										...updates,
									},
								},
						  }
						: node
				)
			})
		}
	}

	const handleLogicTypeChange = (value: string) => {
		setLogicType(value)
		updateNodeConfig({ logicType: value })
	}

	const handleFieldChange = (value: string) => {
		setFieldPath(value)

		// Check if it's a timestamp subfield and extract the option
		let timestampOptionValue = ''
		if (value.includes('.')) {
			const pathParts = value.split('.')
			const lastPart = pathParts[pathParts.length - 1]
			const timestampSubfields = ['year', 'month', 'day', 'hour', 'minute', 'second', 'dayOfWeek', 'dayOfYear', 'week', 'quarter']
			if (timestampSubfields.includes(lastPart)) {
				timestampOptionValue = lastPart
			}
		}

		setTimestampOption(timestampOptionValue)

		// Update both fieldPath and timestampOption in a single call to avoid race conditions
		updateNodeConfig({
			fieldPath: value,
			timestampOption: timestampOptionValue,
		})

		// Reset operator when field changes - will be handled by useEffect above
	}

	const handleOperatorChange = (value: string) => {
		setOperator(value)
		updateNodeConfig({ operator: value })
	}

	const handleComparisonValueChange = (value: string) => {
		setComparisonValue(value)
		updateNodeConfig({ comparisonValue: value })
	}

	const isConfigured = fieldPath && operator && comparisonValue !== ''

	return (
		<div className={styles.branchNode}>
			{hasPendingChanges && (
				<div className={styles.pendingChangeIndicator} title="Unsaved changes" />
			)}
			<div className={styles.header}>
				<div className={styles.icon}>⑂</div>
				<div className={styles.title}>Branch</div>
			</div>

			{/* Configuration UI */}
			<div className={styles.configSection}>
				<label className={styles.configLabel}>
					Logic Type:
					<select
						value={logicType}
						onChange={e => handleLogicTypeChange(e.target.value)}
						className={styles.configSelect}
						onClick={e => e.stopPropagation()}>
						<option value='if_else'>If/Else</option>
					</select>
				</label>
			</div>

			{inputSchema ? (
				<>
					<div className={styles.configSection}>
						<label className={styles.configLabel}>
							Field:
							<select
								value={fieldPath || ''}
								onChange={e => handleFieldChange(e.target.value)}
								className={styles.configSelect}
								onClick={e => e.stopPropagation()}>
								<option value=''>Select a field...</option>
								{Array.from(groupedFields.entries())
									.filter(([, fields]) => fields && fields.length > 0)
									.sort(([a], [b]) => {
										// Sort: Root fields first, then Timestamp, then alphabetically
										if (a === 'Root') return -1
										if (b === 'Root') return 1
										if (a === 'Timestamp') return -1
										if (b === 'Timestamp') return 1
										return a.localeCompare(b)
									})
									.map(([parent, fields]) => {
										// Debug: Log if fields array is empty
										if (!fields || fields.length === 0) {
											return null
										}
										return (
											<optgroup key={parent} label={formatParentName(parent)}>
												{fields
													.sort((a, b) => {
														// Extract just the field name for sorting (after parent prefix)
														const aName = a.path.split('.').pop() || ''
														const bName = b.path.split('.').pop() || ''
														return aName.localeCompare(bName)
													})
													.map(field => {
														// For nested fields, show just the field name (remove parent prefix from display)
														// e.g., "Device > Device ID" becomes "Device ID" when in "Device" group
														let displayLabel = field.label

														// Special handling for Timestamp group
														if (parent === 'Timestamp') {
															// For timestamp subfields, show just the option name
															const pathParts = field.path.split('.')
															const optionName = pathParts[pathParts.length - 1]
															displayLabel = optionName
																.replace(/([A-Z])/g, ' $1')
																.replace(/^./, str => str.toUpperCase())
																.trim()
														} else if (parent !== 'Root' && field.path.startsWith(parent + '.')) {
															// Extract the part after the parent prefix
															const afterParent = field.path.substring(parent.length + 1)
															// Format just that part
															const parts = afterParent.split('.')
															displayLabel = parts
																.map(part =>
																	part
																		.replace(/([A-Z])/g, ' $1')
																		.replace(/^./, str => str.toUpperCase())
																		.trim()
																)
																.join(' > ')
														}
														return (
															<option key={field.path} value={field.path}>
																{displayLabel}
															</option>
														)
													})}
											</optgroup>
										)
									})}
							</select>
						</label>
					</div>

					{selectedField && (
						<>
							<div className={styles.configSection}>
								<label className={styles.configLabel}>
									Operator:
									<select
										value={operator}
										onChange={e => handleOperatorChange(e.target.value)}
										className={styles.configSelect}
										onClick={e => e.stopPropagation()}>
										<option value=''>Select operator...</option>
										{availableOperators.map(op => (
											<option key={op.value} value={op.value}>
												{op.label}
											</option>
										))}
									</select>
								</label>
							</div>

							<div className={styles.configSection}>
								<label className={styles.configLabel}>
									Value:
									<input
										type={
											selectedField.type === 'number' || (selectedField as any).isTimestampSubfield
												? 'number'
												: selectedField.type === 'date-time' && !(selectedField as any).isTimestampSubfield
												? 'datetime-local'
												: 'text'
										}
										value={comparisonValue}
										onChange={e => handleComparisonValueChange(e.target.value)}
										className={styles.configInput}
										onClick={e => e.stopPropagation()}
										placeholder={
											timestampHelpText
												? timestampHelpText
												: `Enter ${selectedField.type} value...`
										}
									/>
									{timestampHelpText && (
										<div className={styles.helpText}>{timestampHelpText}</div>
									)}
								</label>
							</div>
						</>
					)}
				</>
			) : (
				<div className={styles.noInputMessage}>
					Connect an input to configure logic
				</div>
			)}

			{/* Input handle */}
			<Handle
				type='target'
				position={Position.Left}
				id='input'
				className={styles.inputHandle}
			/>

			{/* Output handles - True and False paths */}
			<Handle
				type='source'
				position={Position.Right}
				id='output-true'
				className={styles.outputHandleTrue}
				style={{ top: '40%' }}
			/>
			<Handle
				type='source'
				position={Position.Right}
				id='output-false'
				className={styles.outputHandleFalse}
				style={{ top: '60%' }}
			/>

			{/* Labels for output handles */}
			<div className={styles.outputLabels}>
				<div className={styles.outputLabelTrue}>True</div>
				<div className={styles.outputLabelFalse}>False</div>
			</div>
		</div>
	)
}

