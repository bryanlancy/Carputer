'use client'

import { useState, useRef, useEffect } from 'react'
import { parseMarkdown } from '../../utils/markdown'
import { formatDate } from '../../utils/dateFormat'
import { getApiUrl, authenticatedFetch } from '../../utils/api'
import { useAuth } from '../../contexts/AuthContext'
import styles from './TemplateEditor.module.scss'

interface TemplateEditorProps {
	value: string
	onChange: (value: string) => void
	availableVariables?: string[]
	triggerType?: 'date_time' | 'backend_event' | 'user_driven'
	notificationType?: 'default' | 'warning' | 'alert' | 'success'
}

interface DefaultDevice {
	id: number
	device_id: string
	hostname: string | null
	vin: string | null
	hardware_rev: string | null
	build_id: string | null
	current_version: string | null
	current_build_id: string | null
	current_ip: string | null
	uptime: number | string | null
	services_status: Record<string, boolean> | null
	status: string
	last_seen: string | null
}

export default function TemplateEditor({
	value,
	onChange,
	availableVariables = [],
	triggerType,
	notificationType = 'default',
}: TemplateEditorProps) {
	const { session } = useAuth()
	const [showHints, setShowHints] = useState(false)
	const [defaultDevice, setDefaultDevice] = useState<DefaultDevice | null>(null)
	const [deviceLoading, setDeviceLoading] = useState(true)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const cursorPositionRef = useRef<number>(0)

	// Fetch default device data on mount
	useEffect(() => {
		const fetchDefaultDevice = async () => {
			try {
				const apiUrl = getApiUrl()
				const response = await authenticatedFetch(
					`${apiUrl}/api/admin/defaults/device`,
					{
						headers: {
							Authorization: `Bearer ${session?.access_token}`,
						},
					}
				)

				if (response.ok) {
					const device = await response.json()
					setDefaultDevice(device)
				} else {
					// If fetch fails, continue with hardcoded fallback values
					console.warn('Failed to fetch default device, using fallback values')
				}
			} catch (error) {
				// If fetch fails, continue with hardcoded fallback values
				console.warn('Error fetching default device, using fallback values:', error)
			} finally {
				setDeviceLoading(false)
			}
		}

		fetchDefaultDevice()
	}, [session])

	// Default variables based on trigger type
	const defaultVariables: Record<string, string[]> = {
		backend_event: [
			'device.id',
			'device.device_id',
			'device.hostname',
			'device.status',
			'timestamp',
			'event.type',
		],
		date_time: ['timestamp', 'date', 'time'],
		user_driven: ['user.id', 'user.email', 'user.name', 'timestamp'],
	}

	const variables =
		availableVariables.length > 0
			? availableVariables
			: triggerType
			? defaultVariables[triggerType] || []
			: []

	const handleTextareaFocus = () => {
		if (textareaRef.current) {
			cursorPositionRef.current = textareaRef.current.selectionStart
		}
	}

	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value)
		if (textareaRef.current) {
			cursorPositionRef.current = textareaRef.current.selectionStart
		}
	}

	const handleTextareaClick = () => {
		if (textareaRef.current) {
			cursorPositionRef.current = textareaRef.current.selectionStart
		}
	}

	const handleTextareaKeyUp = () => {
		if (textareaRef.current) {
			cursorPositionRef.current = textareaRef.current.selectionStart
		}
	}

	const insertVariable = (variable: string) => {
		const cursorPos = cursorPositionRef.current
		const newValue =
			value.slice(0, cursorPos) +
			`{{${variable}}}` +
			value.slice(cursorPos)
		onChange(newValue)
		setShowHints(false)

		// Restore focus and set cursor position after the inserted variable
		setTimeout(() => {
			if (textareaRef.current) {
				textareaRef.current.focus()
				const newCursorPos = cursorPos + `{{${variable}}}`.length
				textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
				cursorPositionRef.current = newCursorPos
			}
		}, 0)
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<label>
					Message Template
					<span className={styles.helpText}>
						Use {'{{variable}}'} syntax to insert dynamic values.
						Supports markdown: **bold**, *italic*, `code`.
						Timestamps: {'{{timestamp|"Hello" dd yy HH:mm:ss}}'}
					</span>
				</label>
				<button
					type='button'
					onClick={() => setShowHints(!showHints)}
					className={styles.hintsButton}>
					{showHints ? 'Hide' : 'Show'} Variables
				</button>
			</div>

			{showHints && variables.length > 0 && (
				<div className={styles.variablesPanel}>
					<div className={styles.variablesHeader}>
						Available Variables:
					</div>
					<div className={styles.variablesList}>
						{variables.map(variable => (
							<button
								key={variable}
								type='button'
								onClick={() => insertVariable(variable)}
								className={styles.variableButton}>
								{variable}
							</button>
						))}
					</div>
					<div className={styles.example}>
						<strong>Examples:</strong>
						<br />• Device {'{{device.hostname}}'} is now{' '}
						{'{{device.status}}'}
						<br />• Timestamp:{' '}
						{'{{timestamp|"Hello" dd yy HH:mm:ss}}'}
						<br />• Markdown: **bold**, *italic*, `code`
					</div>
				</div>
			)}

			<textarea
				ref={textareaRef}
				value={value}
				onChange={handleTextareaChange}
				onFocus={handleTextareaFocus}
				onClick={handleTextareaClick}
				onKeyUp={handleTextareaKeyUp}
				placeholder='Enter message template with {{variable}} placeholders...'
				className={styles.textarea}
				rows={4}
			/>

			{value && (
				<div className={styles.preview}>
					<div className={styles.previewLabel}>
						Preview (with sample data):
					</div>
					<div
						className={`${styles.previewText} ${
							styles[`previewType_${notificationType}`]
						}`}
						dangerouslySetInnerHTML={{
							__html: parseMarkdown(
								value.replace(
									/\{\{([^}]+)\}\}/g,
									(match, expression) => {
										try {
											// Handle format pipes (e.g., {{timestamp|"Hello" dd yy HH:mm:ss}})
											if (expression.includes('|')) {
												const [
													variablePath,
													...pipeParts
												] = expression
													.split('|')
													.map((s: string) =>
														s.trim()
													)

												// Get sample value from default device or fallback
												const getSampleValue = (path: string): any => {
													// Use default device data if available
													if (defaultDevice) {
														if (path === 'device.id') return String(defaultDevice.id)
														if (path === 'device.device_id') return defaultDevice.device_id || 'default-device'
														if (path === 'device.hostname') return defaultDevice.hostname || 'default-carputer'
														if (path === 'device.status') return defaultDevice.status || 'online'
														if (path === 'device.vin') return defaultDevice.vin || ''
														if (path === 'device.hardware_rev') return defaultDevice.hardware_rev || ''
														if (path === 'device.build_id') return defaultDevice.build_id || ''
														if (path === 'device.current_version') return defaultDevice.current_version || ''
														if (path === 'device.current_build_id') return defaultDevice.current_build_id || ''
														if (path === 'device.current_ip') return defaultDevice.current_ip || ''
														if (path === 'device.uptime') return defaultDevice.uptime ? String(defaultDevice.uptime) : ''
														if (path === 'device.last_seen' && defaultDevice.last_seen) return new Date(defaultDevice.last_seen)
													}
													// Fallback to hardcoded values
													const fallbackValues: Record<string, any> = {
														'device.id': '1',
														'device.device_id': 'DEV-001',
														'device.hostname': 'carputer-01',
														'device.status': 'online',
														timestamp: new Date(),
														date: new Date(),
														time: new Date(),
														'event.type': 'device.online',
														'user.id': 'user-123',
														'user.email': 'user@example.com',
														'user.name': 'John Doe',
													}
													return fallbackValues[path] || new Date() // Default to current date for timestamp
												}

												let value = getSampleValue(variablePath)

												// Process format pipes - everything after the first | is the format string
												if (pipeParts.length > 0) {
													// Join all pipe parts (in case there are multiple |, though typically just one)
													const formatString =
														pipeParts
															.join('|')
															.trim()
													value = formatDate(
														value,
														formatString
													)
												}

												return String(value)
											}

											// Simple variable access
											const getSampleValue = (path: string): string => {
												// Use default device data if available
												if (defaultDevice) {
													if (path === 'device.id') return String(defaultDevice.id)
													if (path === 'device.device_id') return defaultDevice.device_id || 'default-device'
													if (path === 'device.hostname') return defaultDevice.hostname || 'default-carputer'
													if (path === 'device.status') return defaultDevice.status || 'online'
													if (path === 'device.vin') return defaultDevice.vin || ''
													if (path === 'device.hardware_rev') return defaultDevice.hardware_rev || ''
													if (path === 'device.build_id') return defaultDevice.build_id || ''
													if (path === 'device.current_version') return defaultDevice.current_version || ''
													if (path === 'device.current_build_id') return defaultDevice.current_build_id || ''
													if (path === 'device.current_ip') return defaultDevice.current_ip || ''
													if (path === 'device.uptime') return defaultDevice.uptime ? String(defaultDevice.uptime) : ''
													if (path === 'device.last_seen' && defaultDevice.last_seen) {
														return new Date(defaultDevice.last_seen).toLocaleString()
													}
												}
												// Fallback to hardcoded values
												const fallbackValues: Record<string, string> = {
													'device.id': '1',
													'device.device_id': 'DEV-001',
													'device.hostname': 'carputer-01',
													'device.status': 'online',
													timestamp: new Date().toLocaleString(),
													date: new Date().toLocaleDateString(),
													time: new Date().toLocaleTimeString(),
													'event.type': 'device.online',
													'user.id': 'user-123',
													'user.email': 'user@example.com',
													'user.name': 'John Doe',
												}
												return fallbackValues[path] || `[${path}]`
											}
											return getSampleValue(expression.trim())
										} catch (error) {
											return `[${expression.trim()}]`
										}
									}
								)
							),
						}}
					/>
				</div>
			)}
		</div>
	)
}
