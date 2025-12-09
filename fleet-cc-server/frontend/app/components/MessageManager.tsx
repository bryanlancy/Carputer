'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../utils/api'
import TemplateEditor from './TemplateEditor'
import { extractDataTypes } from '../utils/dataTypeExtractor'
import { DataTypeIcons } from '../utils/dataTypeIcons'
import styles from './MessageManager.module.scss'

interface Message {
	id: number
	message_code: string
	message_name: string
	description?: string | null
	message_type: string
	subject_template?: string | null
	body_template: string
	variable_schema?: any
	enabled: boolean
	created_at?: string
	updated_at?: string
}

export default function MessageManager() {
	const { session } = useAuth()
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [editingMessage, setEditingMessage] = useState<Message | null>(null)
	const [formData, setFormData] = useState({
		message_code: '',
		message_name: '',
		description: '',
		message_type: 'email',
		subject_template: '',
		body_template: '',
		variable_schema: {},
		enabled: true,
	})

	useEffect(() => {
		loadMessages()
	}, [])

	const loadMessages = async () => {
		try {
			setLoading(true)
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/messages`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setMessages(data)
			} else {
				setError('Failed to load messages')
			}
		} catch (err: any) {
			console.error('Failed to load messages:', err)
			setError('Failed to load messages')
		} finally {
			setLoading(false)
		}
	}

	const handleEdit = (message: Message) => {
		setEditingMessage(message)
		setFormData({
			message_code: message.message_code,
			message_name: message.message_name,
			description: message.description || '',
			message_type: message.message_type,
			subject_template: message.subject_template || '',
			body_template: message.body_template,
			variable_schema: message.variable_schema || {},
			enabled: message.enabled,
		})
		setShowForm(true)
	}

	const handleDelete = async (messageId: number) => {
		if (!confirm('Are you sure you want to delete this message?')) {
			return
		}

		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/messages/${messageId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				await loadMessages()
			} else {
				const errorData = await response.json()
				setError(errorData.error || 'Failed to delete message')
			}
		} catch (err: any) {
			console.error('Failed to delete message:', err)
			setError('Failed to delete message')
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		try {
			const apiUrl = getApiUrl()
			const requestBody: any = {
				message_code: formData.message_code.trim(),
				message_name: formData.message_name.trim(),
				message_type: formData.message_type,
				body_template: formData.body_template.trim(),
				variable_schema: formData.variable_schema,
				enabled: formData.enabled,
			}

			if (formData.description && formData.description.trim()) {
				requestBody.description = formData.description.trim()
			}

			if (
				formData.message_type === 'email' &&
				formData.subject_template &&
				formData.subject_template.trim()
			) {
				requestBody.subject_template = formData.subject_template.trim()
			}

			let response
			if (editingMessage) {
				// Update existing message
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/messages/${editingMessage.id}`,
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${session?.access_token}`,
						},
						body: JSON.stringify(requestBody),
					}
				)
			} else {
				// Create new message
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/messages`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${session?.access_token}`,
						},
						body: JSON.stringify(requestBody),
					}
				)
			}

			if (response.ok) {
				setShowForm(false)
				setEditingMessage(null)
				setFormData({
					message_code: '',
					message_name: '',
					description: '',
					message_type: 'email',
					subject_template: '',
					body_template: '',
					variable_schema: {},
					enabled: true,
				})
				await loadMessages()
			} else {
				const errorData = await response.json()
				setError(
					errorData.error ||
						errorData.details?.[0]?.message ||
						'Failed to save message'
				)
			}
		} catch (err: any) {
			console.error('Failed to save message:', err)
			setError('Failed to save message')
		}
	}

	const resetForm = () => {
		setFormData({
			message_code: '',
			message_name: '',
			description: '',
			message_type: 'email',
			subject_template: '',
			body_template: '',
			variable_schema: {},
			enabled: true,
		})
		setEditingMessage(null)
		setShowForm(false)
	}

	// Extract data types from variable schema
	const getDataTypesForMessage = (message: Message): string[] => {
		if (message.variable_schema) {
			return extractDataTypes(message.variable_schema)
		}
		// Fallback: extract from body template variables
		// This is a simple heuristic - in practice, variable_schema should be set
		return []
	}

	if (loading) {
		return <div className={styles.loading}>Loading messages...</div>
	}

	return (
		<div className={styles.container}>
			{error && <div className={styles.error}>{error}</div>}

			<div className={styles.actions}>
				<button
					onClick={() => {
						resetForm()
						setShowForm(true)
					}}
					className={styles.addButton}>
					+ Add Message
				</button>
			</div>

			{showForm && (
				<div className={styles.formContainer}>
					<form onSubmit={handleSubmit} className={styles.form}>
						<h3>
							{editingMessage ? 'Edit Message' : 'Create Message'}
						</h3>

						<div className={styles.formGroup}>
							<label>
								Message Code *
								<input
									type='text'
									value={formData.message_code}
									onChange={e =>
										setFormData({
											...formData,
											message_code: e.target.value,
										})
									}
									required
									disabled={!!editingMessage}
									placeholder='e.g., device_online_email'
								/>
								<small>
									Unique identifier for this message (cannot
									be changed after creation)
								</small>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Message Name *
								<input
									type='text'
									value={formData.message_name}
									onChange={e =>
										setFormData({
											...formData,
											message_name: e.target.value,
										})
									}
									required
									placeholder='e.g., Device Online Email'
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Description
								<textarea
									value={formData.description}
									onChange={e =>
										setFormData({
											...formData,
											description: e.target.value,
										})
									}
									placeholder='Optional description of this message'
									rows={3}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Message Type *
								<select
									value={formData.message_type}
									onChange={e =>
										setFormData({
											...formData,
											message_type: e.target.value,
										})
									}
									required>
									<option value='email'>Email</option>
									<option value='sms'>SMS</option>
									<option value='webhook'>Webhook</option>
									<option value='custom'>Custom</option>
								</select>
							</label>
						</div>

						{formData.message_type === 'email' && (
							<div className={styles.formGroup}>
								<label>
									Subject Template
									<TemplateEditor
										value={formData.subject_template || ''}
										onChange={value =>
											setFormData({
												...formData,
												subject_template: value,
											})
										}
										triggerType={null}
									/>
									<small>
										Use {'{{variable}}'} syntax for dynamic
										values
									</small>
								</label>
							</div>
						)}

						<div className={styles.formGroup}>
							<label>
								Body Template *
								<TemplateEditor
									value={formData.body_template}
									onChange={value =>
										setFormData({
											...formData,
											body_template: value,
										})
									}
									triggerType={null}
								/>
								<small>
									Use {'{{variable}}'} syntax for dynamic
									values. Variables used will affect data
									requirements.
								</small>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Variable Schema (JSON)
								<textarea
									value={JSON.stringify(
										formData.variable_schema,
										null,
										2
									)}
									onChange={e => {
										try {
											const parsed = JSON.parse(
												e.target.value
											)
											setFormData({
												...formData,
												variable_schema: parsed,
											})
										} catch (err) {
											// Invalid JSON, keep the text for user to fix
										}
									}}
									placeholder='{"type": "object", "properties": {...}, "required": [...]}'
									rows={8}
									className={styles.jsonInput}
								/>
								<small>
									JSON Schema defining what data this message
									requires (optional - will be inferred from
									template)
								</small>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								<input
									type='checkbox'
									checked={formData.enabled}
									onChange={e =>
										setFormData({
											...formData,
											enabled: e.target.checked,
										})
									}
								/>
								Enabled
							</label>
						</div>

						<div className={styles.formActions}>
							<button type='submit' className={styles.saveButton}>
								{editingMessage ? 'Update' : 'Create'} Message
							</button>
							<button
								type='button'
								onClick={resetForm}
								className={styles.cancelButton}>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className={styles.list}>
				<table>
					<thead>
						<tr>
							<th>Code</th>
							<th>Name</th>
							<th>Type</th>
							<th>Required Data Types</th>
							<th>Enabled</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{messages.length === 0 ? (
							<tr>
								<td colSpan={6} className={styles.empty}>
									No messages found. Create one to get
									started.
								</td>
							</tr>
						) : (
							messages.map(message => {
								const dataTypes =
									getDataTypesForMessage(message)
								return (
									<tr key={message.id}>
										<td>{message.message_code}</td>
										<td>{message.message_name}</td>
										<td>{message.message_type}</td>
										<td>
											{dataTypes.length > 0 ? (
												<DataTypeIcons
													types={dataTypes}
													size='small'
												/>
											) : (
												<span
													className={styles.variable}>
													Variable
												</span>
											)}
										</td>
										<td>
											{message.enabled ? 'Yes' : 'No'}
										</td>
										<td>
											<button
												onClick={() =>
													handleEdit(message)
												}
												className={styles.editButton}>
												Edit
											</button>
											<button
												onClick={() =>
													handleDelete(message.id)
												}
												className={styles.deleteButton}>
												Delete
											</button>
										</td>
									</tr>
								)
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
