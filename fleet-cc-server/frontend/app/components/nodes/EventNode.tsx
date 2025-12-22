'use client'

import { useState, useEffect } from 'react'
import { Handle, Position, NodeProps, useNodeId, useReactFlow } from 'reactflow'
import { extractDataTypes, DataType } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import { getApiUrl, getAuthHeaders } from '../../utils/api'
import styles from './EventNode.module.scss'

export interface EventNodeData {
	id: number
	event_code: string
	event_name: string
	description?: string | null
	input_schema?: any
	handler_type: string
	enabled: boolean
	config?: any // Node-specific configuration
	hasVariableDataTypes?: boolean // Whether data types can vary based on configuration
	availableMessages?: Array<{
		id: number
		message_code: string
		message_name: string
	}> // For Send Email action
	availableCommands?: Array<{
		value: string
		label: string
	}> // For Execute Command action
	availableNotificationTypes?: Array<{
		id: number
		name: string
		variable_schema?: any
	}> // For Show Notification action
}

interface EventNodeProps extends NodeProps<EventNodeData> {
	hasPendingChanges?: boolean // Whether this node has unsaved changes
}

export default function EventNode({
	data,
	hasPendingChanges = false,
}: EventNodeProps) {
	const nodeId = useNodeId()
	const { setNodes, getNode } = useReactFlow()

	// Get current node data from React Flow to ensure we have the latest config
	const currentNode = nodeId ? getNode(nodeId) : null
	const currentNodeData = currentNode?.data || data

	const [selectedMessage, setSelectedMessage] = useState<string>(
		currentNodeData.config?.message_code || ''
	)
	const [messages, setMessages] = useState<
		Array<{ id: number; message_code: string; message_name: string }>
	>(currentNodeData.availableMessages || [])
	const [commands, setCommands] = useState<
		Array<{ value: string; label: string }>
	>(currentNodeData.availableCommands || [])
	// Use availableNotificationTypes from props if available, otherwise use local state
	const [notificationTypes, setNotificationTypes] = useState<
		Array<{
			id: number
			name: string
			variable_schema?: any
		}>
	>(currentNodeData.availableNotificationTypes || [])
	const [selectedCommand, setSelectedCommand] = useState<string>(
		currentNodeData.config?.command || ''
	)
	const [selectedNotificationType, setSelectedNotificationType] =
		useState<string>(currentNodeData.config?.notification_id || '')
	const [forceUpdate, setForceUpdate] = useState(0) // Force re-render when config changes

	// Sync with prop changes to ensure we have the latest notification types
	useEffect(() => {
		const currentData = nodeId ? getNode(nodeId)?.data : data
		if (currentData?.availableNotificationTypes && currentData.availableNotificationTypes.length > 0) {
			setNotificationTypes(currentData.availableNotificationTypes)
		}
	}, [data.availableNotificationTypes, nodeId, getNode])

	// Sync selected values with current node data only on initial mount
	// Subsequent changes should come from user interaction, not from syncing
	useEffect(() => {
		// Only sync if state is empty and config has values (initial load from saved config)
		if (!selectedMessage && currentNodeData.config?.message_code) {
			setSelectedMessage(currentNodeData.config.message_code)
		}
		if (!selectedCommand && currentNodeData.config?.command) {
			setSelectedCommand(currentNodeData.config.command)
		}
		if (!selectedNotificationType && currentNodeData.config?.notification_id) {
			setSelectedNotificationType(currentNodeData.config.notification_id)
		}
		// Only run once on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Load data based on event type
	useEffect(() => {
		const currentData = nodeId ? getNode(nodeId)?.data : data
		if (currentData?.event_code === 'send_email' && messages.length === 0) {
			loadMessages()
		} else if (
			currentData?.event_code === 'execute_command' &&
			commands.length === 0
		) {
			loadCommands()
		} else if (
			currentData?.event_code === 'show_notification' &&
			notificationTypes.length === 0
		) {
			loadNotificationTypes()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.event_code, nodeId, getNode])

	// Update selected notification from saved config when notification types are loaded
	// Only run once when notification types become available
	useEffect(() => {
		if (
			currentNodeData.event_code === 'show_notification' &&
			currentNodeData.config?.notification_id &&
			!selectedNotificationType &&
			notificationTypes.length > 0
		) {
			// Restore saved notification selection if not already set
			setSelectedNotificationType(currentNodeData.config.notification_id)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [notificationTypes.length])

	const loadMessages = async () => {
		try {
			const apiUrl = getApiUrl()
			const headers = await getAuthHeaders()

			const response = await fetch(
				`${apiUrl}/api/admin/messages?enabled=true&message_type=email`,
				{
					headers,
				}
			)

			if (response.ok) {
				const data = await response.json()
				setMessages(
					data.map((m: any) => ({
						id: m.id,
						message_code: m.message_code,
						message_name: m.message_name,
					}))
				)
			}
		} catch (err) {
			console.error('Failed to load messages:', err)
		}
	}

	const loadCommands = async () => {
		try {
			const apiUrl = getApiUrl()
			const headers = await getAuthHeaders()

			const response = await fetch(
				`${apiUrl}/api/admin/wiring/commands/list`,
				{
					headers,
				}
			)

			if (response.ok) {
				const data = await response.json()
				setCommands(data)
			}
		} catch (err) {
			console.error('Failed to load commands:', err)
		}
	}

	const loadNotificationTypes = async () => {
		try {
			const apiUrl = getApiUrl()
			const headers = await getAuthHeaders()

			const response = await fetch(
				`${apiUrl}/api/admin/notifications`,
				{
					headers,
				}
			)

			if (response.ok) {
				const data = await response.json()
				setNotificationTypes(
					data.map((nt: any) => ({
						id: nt.id,
						name: nt.name || `Notification ${nt.id}`,
						variable_schema: nt.variable_schema,
					}))
				)
			}
		} catch (err) {
			console.error('Failed to load notification types:', err)
		}
	}

	const updateNodeConfig = (key: string, value: string) => {
		if (nodeId) {
			setNodes(nds =>
				nds.map(node =>
					node.id === nodeId
						? {
								...node,
								data: {
									...node.data,
									config: {
										...node.data.config,
										[key]: value,
									},
								},
						  }
						: node
				)
			)
			// Force a re-render by updating the nodes - this will trigger change detection
			// The parent's handleNodesChange will be called via React Flow's onNodesChange
		}
	}

	const handleMessageChange = (messageCode: string) => {
		setSelectedMessage(messageCode)
		updateNodeConfig('message_code', messageCode)
	}

	const handleCommandChange = (command: string) => {
		setSelectedCommand(command)
		updateNodeConfig('command', command)
	}

	const handleNotificationTypeChange = (notificationId: string) => {
		setSelectedNotificationType(notificationId)
		updateNodeConfig('notification_id', notificationId)
		// Force a re-render to ensure requirements are recalculated with new selection
		setForceUpdate(prev => prev + 1)
	}

	// Get current node data to ensure we have the latest config
	// Use forceUpdate to ensure we get fresh data when selection changes
	const currentData = nodeId ? getNode(nodeId)?.data : data
	const currentConfig = currentData?.config || {}
	// Prefer the state value if it's been set (more recent), otherwise use config
	const currentSelectedNotification = selectedNotificationType || currentConfig.notification_id || ''

	// Determine data types based on configuration
	// For variable types, use the selected item's schema if available
	let effectiveInputSchema = currentData?.input_schema || data.input_schema
	let effectiveDataTypes: DataType[] = []
	let hasVariableTypes = false
	let isConfigured = false

	if (currentData?.event_code === 'send_email') {
		hasVariableTypes = true
		if (currentConfig.message_code || selectedMessage) {
			isConfigured = true
			// Find the selected message and use its variable_schema
			const selectedMsg = messages.find(
				m => m.message_code === (currentConfig.message_code || selectedMessage)
			)
			// For now, assume email messages require device data (can be enhanced later)
			effectiveDataTypes = ['Device']
		}
	} else if (currentData?.event_code === 'execute_command') {
		hasVariableTypes = true
		if (currentConfig.command || selectedCommand) {
			isConfigured = true
			// Commands always require device data
			effectiveDataTypes = ['Device', 'Command']
		}
	} else if (currentData?.event_code === 'show_notification') {
		hasVariableTypes = true
		if (currentSelectedNotification) {
			isConfigured = true
			// Find the selected notification type from local state or props
			// Check both local state and data.availableNotificationTypes
			const allNotificationTypes = currentData?.availableNotificationTypes || data.availableNotificationTypes || notificationTypes
			const selectedType = allNotificationTypes.find(
				nt => nt.id.toString() === currentSelectedNotification.toString()
			)
			if (selectedType?.variable_schema) {
				effectiveInputSchema = selectedType.variable_schema
				effectiveDataTypes = extractDataTypes(
					selectedType.variable_schema
				)
			} else {
				// If no variable_schema, the notification doesn't require any data
				effectiveDataTypes = []
			}
		}
	} else {
		// Non-variable types use the base input_schema
		effectiveDataTypes = (currentData?.input_schema || data.input_schema)
			? extractDataTypes(currentData?.input_schema || data.input_schema)
			: []
		hasVariableTypes = (currentData?.hasVariableDataTypes || data.hasVariableDataTypes) || false
		isConfigured = true // Non-variable types are always "configured"
	}

	const displayData = currentData || data

	return (
		<div
			className={`${styles.eventNode} ${
				!displayData.enabled ? styles.disabled : ''
			}`}>
			{hasPendingChanges && (
				<div className={styles.pendingChangeIndicator} title="Unsaved changes" />
			)}
			<div className={styles.header}>
				<div className={styles.icon}>🎯</div>
				<div className={styles.title}>{displayData.event_name}</div>
			</div>
			{displayData.description && (
				<div className={styles.description}>{displayData.description}</div>
			)}
			<div className={styles.handlerType}>{displayData.handler_type}</div>
			<div className={styles.dataTypes}>
				<span className={styles.dataTypesLabel}>Requires:</span>
				{hasVariableTypes && !isConfigured ? (
					<span
						className={styles.variableIndicator}
						title='Please configure this action to see required data types'>
						Variable (Not Configured)
					</span>
				) : hasVariableTypes && isConfigured ? (
					<DataTypeIcons types={effectiveDataTypes} size='small' />
				) : (
					<DataTypeIcons types={effectiveDataTypes} size='small' />
				)}
			</div>

			{/* Configuration UI for Send Email */}
			{displayData.event_code === 'send_email' && messages.length > 0 && (
				<div className={styles.configSection}>
					<label className={styles.configLabel}>
						Message:
						<select
							value={selectedMessage}
							onChange={e => handleMessageChange(e.target.value)}
							className={styles.configSelect}
							onClick={e => e.stopPropagation()}>
							<option value=''>Select a message...</option>
							{messages.map(msg => (
								<option key={msg.id} value={msg.message_code}>
									{msg.message_name}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			{/* Configuration UI for Execute Command */}
			{displayData.event_code === 'execute_command' && commands.length > 0 && (
				<div className={styles.configSection}>
					<label className={styles.configLabel}>
						Command:
						<select
							value={selectedCommand}
							onChange={e => handleCommandChange(e.target.value)}
							className={styles.configSelect}
							onClick={e => e.stopPropagation()}>
							<option value=''>Select a command...</option>
							{commands.map(cmd => (
								<option key={cmd.value} value={cmd.value}>
									{cmd.label}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			{/* Configuration UI for Show Notification */}
			{displayData.event_code === 'show_notification' && (
				<div className={styles.configSection}>
					<label className={styles.configLabel}>
						Notification:
						<select
							value={currentSelectedNotification || selectedNotificationType}
							onChange={e =>
								handleNotificationTypeChange(e.target.value)
							}
							className={styles.configSelect}
							onClick={e => e.stopPropagation()}>
							<option value=''>
								Select a notification...
							</option>
							{(displayData.availableNotificationTypes || data.availableNotificationTypes || notificationTypes).map(nt => (
								<option key={nt.id} value={nt.id.toString()}>
									{nt.name || `Notification ${nt.id}`}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			<div className={styles.code}>{displayData.event_code}</div>

			{/* Input handle - events receive data */}
			{/* Disable handle if variable types are not configured */}
			<Handle
				type='target'
				position={Position.Left}
				id='input'
				className={`${styles.inputHandle} ${
					hasVariableTypes && !isConfigured
						? styles.disabledHandle
						: ''
				}`}
				style={{
					opacity: hasVariableTypes && !isConfigured ? 0.3 : 1,
					cursor:
						hasVariableTypes && !isConfigured
							? 'not-allowed'
							: 'crosshair',
				}}
			/>

			{!displayData.enabled && (
				<div className={styles.disabledBadge}>Disabled</div>
			)}
		</div>
	)
}
