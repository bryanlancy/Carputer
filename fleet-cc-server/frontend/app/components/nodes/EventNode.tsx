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

export default function EventNode({ data }: NodeProps<EventNodeData>) {
	const nodeId = useNodeId()
	const { setNodes } = useReactFlow()
	const [selectedMessage, setSelectedMessage] = useState<string>(
		data.config?.message_code || ''
	)
	const [messages, setMessages] = useState<
		Array<{ id: number; message_code: string; message_name: string }>
	>(data.availableMessages || [])
	const [commands, setCommands] = useState<
		Array<{ value: string; label: string }>
	>(data.availableCommands || [])
	const [notificationTypes, setNotificationTypes] = useState<
		Array<{
			id: number
			name: string
			variable_schema?: any
		}>
	>(data.availableNotificationTypes || [])
	const [selectedCommand, setSelectedCommand] = useState<string>(
		data.config?.command || ''
	)
	const [selectedNotificationType, setSelectedNotificationType] =
		useState<string>(data.config?.notification_id || '')

	// Load data based on event type
	useEffect(() => {
		if (data.event_code === 'send_email' && messages.length === 0) {
			loadMessages()
		} else if (
			data.event_code === 'execute_command' &&
			commands.length === 0
		) {
			loadCommands()
		} else if (
			data.event_code === 'show_notification' &&
			notificationTypes.length === 0
		) {
			loadNotificationTypes()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.event_code])

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
	}

	// Determine data types based on configuration
	// For variable types, use the selected item's schema if available
	let effectiveInputSchema = data.input_schema
	let effectiveDataTypes: DataType[] = []
	let hasVariableTypes = false
	let isConfigured = false

	if (data.event_code === 'send_email') {
		hasVariableTypes = true
		if (selectedMessage) {
			isConfigured = true
			// Find the selected message and use its variable_schema
			const selectedMsg = messages.find(
				m => m.message_code === selectedMessage
			)
			// For now, assume email messages require device data (can be enhanced later)
			effectiveDataTypes = ['Device']
		}
	} else if (data.event_code === 'execute_command') {
		hasVariableTypes = true
		if (selectedCommand) {
			isConfigured = true
			// Commands always require device data
			effectiveDataTypes = ['Device', 'Command']
		}
		} else if (data.event_code === 'show_notification') {
		hasVariableTypes = true
		if (selectedNotificationType) {
			isConfigured = true
			// Find the selected notification type and use its variable_schema if available
			const selectedType = notificationTypes.find(
				nt => nt.id.toString() === selectedNotificationType
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
		effectiveDataTypes = data.input_schema
			? extractDataTypes(data.input_schema)
			: []
		hasVariableTypes = data.hasVariableDataTypes || false
		isConfigured = true // Non-variable types are always "configured"
	}

	return (
		<div
			className={`${styles.eventNode} ${
				!data.enabled ? styles.disabled : ''
			}`}>
			<div className={styles.header}>
				<div className={styles.icon}>🎯</div>
				<div className={styles.title}>{data.event_name}</div>
			</div>
			{data.description && (
				<div className={styles.description}>{data.description}</div>
			)}
			<div className={styles.handlerType}>{data.handler_type}</div>
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
			{data.event_code === 'send_email' && messages.length > 0 && (
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
			{data.event_code === 'execute_command' && commands.length > 0 && (
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
			{data.event_code === 'show_notification' &&
				notificationTypes.length > 0 && (
					<div className={styles.configSection}>
						<label className={styles.configLabel}>
							Notification:
							<select
								value={selectedNotificationType}
								onChange={e =>
									handleNotificationTypeChange(e.target.value)
								}
								className={styles.configSelect}
								onClick={e => e.stopPropagation()}>
								<option value=''>
									Select a notification...
								</option>
								{notificationTypes.map(nt => (
									<option key={nt.id} value={nt.id.toString()}>
										{nt.name || `Notification ${nt.id}`}
									</option>
								))}
							</select>
						</label>
					</div>
				)}

			<div className={styles.code}>{data.event_code}</div>

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

			{!data.enabled && (
				<div className={styles.disabledBadge}>Disabled</div>
			)}
		</div>
	)
}
