'use client'

import { useState, useEffect } from 'react'
import { Handle, Position, NodeProps, useNodeId, useReactFlow } from 'reactflow'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
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

	// Load messages if this is a Send Email action
	useEffect(() => {
		if (data.event_code === 'send_email' && messages.length === 0) {
			loadMessages()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.event_code]) // messages.length intentionally omitted to prevent re-fetching

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

	const handleMessageChange = (messageCode: string) => {
		setSelectedMessage(messageCode)
		// Update node data with selected message
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
										message_code: messageCode,
									},
								},
						  }
						: node
				)
			)
		}
	}

	// Determine data types - can be variable if hasVariableDataTypes is true
	const dataTypes = data.input_schema
		? extractDataTypes(data.input_schema)
		: []
	const hasVariableTypes =
		data.hasVariableDataTypes ||
		data.event_code === 'show_notification' ||
		data.event_code === 'send_email'

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

			<div className={styles.code}>{data.event_code}</div>

			{/* Input handle - events receive data */}
			<Handle
				type='target'
				position={Position.Left}
				id='input'
				className={styles.inputHandle}
			/>

			{!data.enabled && (
				<div className={styles.disabledBadge}>Disabled</div>
			)}
		</div>
	)
}
