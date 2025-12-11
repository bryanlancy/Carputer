'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import { generateSchemaFromTemplate } from '../../utils/templateSchemaGenerator'
import TemplateEditor from '../admin/TemplateEditor'
import ConfirmModal from '../ui/ConfirmModal'
import styles from './NotificationTypeManager.module.scss'

interface Notification {
	id: number
	name: string
	description: string | null
	enabled: boolean
	notification_type?: string
	variable_schema?: any
	// Fields from notification_rules
	target_users?: any
	message_template?: string | null
	priority?: number
	show_in_feed?: boolean
	show_popup?: boolean
}

export default function NotificationTypeManager() {
	const { session } = useAuth()
	const [types, setTypes] = useState<Notification[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [editingType, setEditingType] = useState<Notification | null>(null)
	const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		enabled: true,
		notification_type: 'default' as
			| 'warning'
			| 'alert'
			| 'default'
			| 'success',
		// Fields from notification_rules
		target_users: null as any,
		message_template: '',
		priority: 0,
		variable_schema: null as any,
		show_in_feed: true,
		show_popup: false,
	})

	useEffect(() => {
		loadTypes()
	}, [])

	const loadTypes = async () => {
		setLoading(true)
		setError(null)
		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setError('Authentication required')
				return
			}

			const response = await fetch(`${apiUrl}/api/admin/notifications`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (response.ok) {
				const data = await response.json()
				setTypes(data)
			} else if (response.status === 401 || response.status === 403) {
				setError('Unauthorized. Please check your permissions.')
			} else {
				setError(
					`Failed to load notification types: ${response.statusText}`
				)
			}
		} catch (err: any) {
			setError(`Error loading notification types: ${err.message}`)
		} finally {
			setLoading(false)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setError('Authentication required')
				return
			}

			const url = editingType
				? `${apiUrl}/api/admin/notifications/${editingType.id}`
				: `${apiUrl}/api/admin/notifications`

			const response = await fetch(url, {
				method: editingType ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: formData.name,
					...(formData.description && formData.description.trim()
						? { description: formData.description.trim() }
						: {}),
					enabled: formData.enabled,
					notification_type: formData.notification_type || 'default',
					target_users: formData.target_users || null,
					message_template: formData.message_template || null,
					priority: formData.priority || 0,
					variable_schema: formData.variable_schema || null,
					show_in_feed:
						formData.show_in_feed !== undefined
							? formData.show_in_feed
							: true,
					show_popup: formData.show_popup || false,
				}),
			})

			if (response.ok) {
				await loadTypes()
				setShowForm(false)
				setEditingType(null)
				setFormData({
					name: '',
					description: '',
					enabled: true,
					notification_type: 'default',
					target_users: null,
					message_template: '',
					priority: 0,
					variable_schema: null,
					show_in_feed: true,
					show_popup: false,
				})
			} else {
				const errorData = await response
					.json()
					.catch(() => ({ error: 'Unknown error' }))
				setError(
					errorData.error ||
						`Failed to ${
							editingType ? 'update' : 'create'
						} notification type`
				)
			}
		} catch (err: any) {
			setError(`Error: ${err.message}`)
		}
	}

	const handleEdit = (type: Notification) => {
		setEditingType(type)
		setFormData({
			name: type.name,
			description: type.description || '',
			enabled: type.enabled,
			notification_type: (type.notification_type as any) || 'default',
			target_users: type.target_users || null,
			message_template: type.message_template || '',
			priority: type.priority || 0,
			variable_schema: type.variable_schema || null,
			show_in_feed:
				(type as any).show_in_feed !== undefined
					? (type as any).show_in_feed
					: true,
			show_popup:
				(type as any).show_popup !== undefined
					? (type as any).show_popup
					: false,
		})
		setShowForm(true)
	}

	// Auto-generate variable schema when message template changes
	const handleMessageTemplateChange = (value: string) => {
		const newSchema = generateSchemaFromTemplate(value)
		setFormData({
			...formData,
			message_template: value,
			variable_schema: newSchema,
		})
	}

	const handleDelete = async (id: number) => {
		setDeleteConfirmId(id)
		setShowDeleteConfirm(true)
		setDeleteError(null) // Reset error when opening modal
	}

	const confirmDelete = async () => {
		if (!deleteConfirmId || deleting) return

		setDeleting(true)
		setDeleteError(null)

		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setDeleteError('Authentication required')
				setDeleting(false)
				return
			}

			const response = await fetch(
				`${apiUrl}/api/admin/notifications/${deleteConfirmId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			)

			if (response.ok) {
				// Success - close modal and reload types
				setShowDeleteConfirm(false)
				setDeleteConfirmId(null)
				setDeleteError(null)
				await loadTypes()
			} else {
				// Error - show error message in modal
				const errorData = await response
					.json()
					.catch(() => ({ error: 'Unknown error' }))
				setDeleteError(
					errorData.error || 'Failed to delete notification type'
				)
			}
		} catch (err: any) {
			setDeleteError(`Error: ${err.message}`)
		} finally {
			setDeleting(false)
		}
	}

	const handleDeleteCancel = () => {
		setShowDeleteConfirm(false)
		setDeleteConfirmId(null)
		setDeleteError(null)
		setDeleting(false)
	}

	const handleCancel = () => {
		setShowForm(false)
		setEditingType(null)
		setFormData({
			name: '',
			description: '',
			enabled: true,
			notification_type: 'default',
			target_users: null,
			message_template: '',
			priority: 0,
			variable_schema: null,
			show_in_feed: true,
			show_popup: false,
		})
	}

	const handleTest = async (notificationId: number, e?: React.MouseEvent) => {
		e?.preventDefault()
		e?.stopPropagation()

		setError(null)

		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setError('Authentication required')
				return
			}

			const response = await fetch(
				`${apiUrl}/api/admin/notifications/${notificationId}/test`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			)

			if (response.ok) {
				// Success - notification will appear in user's feed
				// Could show a success message here
				setError(null)
			} else {
				const errorData = await response.json().catch(() => ({
					error: 'Failed to test notification',
				}))
				setError(errorData.error || 'Failed to test notification')
			}
		} catch (err: any) {
			setError(`Error: ${err.message}`)
		}
	}

	if (loading) {
		return (
			<div className={styles.loading}>Loading notification types...</div>
		)
	}

	return (
		<div className={styles.container}>
			<div className={styles.actions}>
				<button
					onClick={() => {
						setEditingType(null)
						setFormData({
							name: '',
							description: '',
							enabled: true,
							notification_type: 'default',
							target_users: null,
							message_template: '',
							priority: 0,
							variable_schema: null,
							show_in_feed: true,
							show_popup: false,
						})
						setShowForm(true)
					}}
					className={styles.addButton}>
					+ Add New Type
				</button>
			</div>

			{showForm && (
				<div className={styles.formOverlay}>
					<div className={styles.formContainer}>
						<h3>
							{editingType
								? 'Edit Notification'
								: 'Create Notification'}
						</h3>
						{error && (
							<div className={styles.formError}>
								{error}
								<button
									onClick={() => setError(null)}
									className={styles.dismissError}>
									×
								</button>
							</div>
						)}
						<form onSubmit={handleSubmit}>
							<div className={styles.formGroup}>
								<label>
									Name{' '}
									<span className={styles.required}>*</span>
									<input
										type='text'
										value={formData.name}
										onChange={e =>
											setFormData({
												...formData,
												name: e.target.value,
											})
										}
										required
										placeholder='e.g., Device Online'
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
										rows={3}
										placeholder='Optional description of this notification type'
									/>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Notification Type{' '}
									<span className={styles.required}>*</span>
									<select
										value={formData.notification_type}
										onChange={e =>
											setFormData({
												...formData,
												notification_type: e.target
													.value as
													| 'default'
													| 'warning'
													| 'alert'
													| 'success',
											})
										}
										required>
										<option value='default'>Default</option>
										<option value='warning'>Warning</option>
										<option value='alert'>Alert</option>
										<option value='success'>Success</option>
									</select>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Target Users (JSON)
									<textarea
										value={
											formData.target_users
												? JSON.stringify(
														formData.target_users,
														null,
														2
												  )
												: ''
										}
										onChange={e => {
											try {
												const parsed = e.target.value
													? JSON.parse(e.target.value)
													: null
												setFormData({
													...formData,
													target_users: parsed,
												})
											} catch (err) {
												// Invalid JSON, keep the text for user to fix
											}
										}}
										rows={4}
										placeholder='["user-id-1", "user-id-2"] or ["admin", "operator"] or null for all users'
										className={styles.jsonInput}
									/>
									<small>
										Array of user IDs or role names. Leave
										empty/null for all users.
									</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<TemplateEditor
									value={formData.message_template}
									onChange={handleMessageTemplateChange}
									triggerType='backend_event'
									notificationType={
										formData.notification_type
									}
								/>
							</div>

							<div className={styles.formGroup}>
								<label>
									Priority
									<input
										type='number'
										value={formData.priority}
										onChange={e =>
											setFormData({
												...formData,
												priority:
													parseInt(e.target.value) ||
													0,
											})
										}
										min='0'
										placeholder='0'
									/>
									<small>
										Priority level (higher numbers = higher
										priority)
									</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Variable Schema (JSON) - Auto-generated from
									template
									<textarea
										value={
											formData.variable_schema
												? JSON.stringify(
														formData.variable_schema,
														null,
														2
												  )
												: 'null'
										}
										onChange={e => {
											try {
												const parsed =
													e.target.value &&
													e.target.value !== 'null'
														? JSON.parse(
																e.target.value
														  )
														: null
												setFormData({
													...formData,
													variable_schema: parsed,
												})
											} catch (err) {
												// Invalid JSON, keep the text for user to fix
											}
										}}
										rows={8}
										className={`${styles.jsonInput} ${styles.readOnly}`}
										readOnly
									/>
									<small>
										Auto-generated from message template.
										Variables used in the template will be
										reflected here.
									</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Display Options{' '}
									<span className={styles.required}>*</span>
									<div className={styles.radioGroup}>
										<label className={styles.radioLabel}>
											<input
												type='radio'
												name='displayOption'
												value='feed'
												checked={
													formData.show_in_feed &&
													!formData.show_popup
												}
												onChange={() =>
													setFormData({
														...formData,
														show_in_feed: true,
														show_popup: false,
													})
												}
											/>
											<span>Show in Feed Only</span>
										</label>
										<label className={styles.radioLabel}>
											<input
												type='radio'
												name='displayOption'
												value='popup'
												checked={
													!formData.show_in_feed &&
													formData.show_popup
												}
												onChange={() =>
													setFormData({
														...formData,
														show_in_feed: false,
														show_popup: true,
													})
												}
											/>
											<span>Show Popup Only</span>
										</label>
										<label className={styles.radioLabel}>
											<input
												type='radio'
												name='displayOption'
												value='both'
												checked={
													formData.show_in_feed &&
													formData.show_popup
												}
												onChange={() =>
													setFormData({
														...formData,
														show_in_feed: true,
														show_popup: true,
													})
												}
											/>
											<span>Show Both</span>
										</label>
									</div>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.checkboxLabel}>
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
								<button
									type='submit'
									className={styles.saveButton}>
									{editingType ? 'Update' : 'Create'} Type
								</button>
								<button
									type='button'
									onClick={handleCancel}
									className={styles.cancelButton}>
									Cancel
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{types.length === 0 ? (
				<div className={styles.empty}>
					<p>
						No notification types found. Create your first
						notification type to get started.
					</p>
				</div>
			) : (
				<div className={styles.tableContainer}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>ID</th>
								<th>Name</th>
								<th>Priority</th>
								<th>Required Data Types</th>
								<th>Enabled</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{types.map(type => {
								const dataTypes = type.variable_schema
									? extractDataTypes(type.variable_schema)
									: []
								return (
									<tr key={type.id}>
										<td className={styles.codeCell}>
											{type.id}
										</td>
										<td>{type.name}</td>
										<td>{type.priority || 0}</td>
										<td>
											{dataTypes.length > 0 ? (
												<DataTypeIcons
													types={dataTypes}
													size='small'
												/>
											) : (
												<span
													className={
														styles.noDataTypes
													}>
													None
												</span>
											)}
										</td>
										<td>
											<span
												className={
													type.enabled
														? styles.enabled
														: styles.disabled
												}>
												{type.enabled ? 'Yes' : 'No'}
											</span>
										</td>
										<td>
											<button
												onClick={() => handleEdit(type)}
												className={styles.editButton}>
												Edit
											</button>
											<button
												onClick={e =>
													handleTest(type.id, e)
												}
												className={styles.testButton}
												type='button'
												style={{ minWidth: '80px' }}>
												Test
											</button>
											<button
												onClick={() =>
													handleDelete(type.id)
												}
												className={styles.deleteButton}>
												Delete
											</button>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			<ConfirmModal
				isOpen={showDeleteConfirm}
				title='Delete Notification Type'
				message={
					<div>
						{deleteError ? (
							<>
								<p
									style={{
										color: '#ef4444',
										marginBottom: '1rem',
									}}>
									{deleteError}
								</p>
								<p>
									Are you sure you want to delete this
									notification type? This action cannot be
									undone.
								</p>
							</>
						) : (
							<p>
								Are you sure you want to delete this
								notification type? This action cannot be undone.
							</p>
						)}
					</div>
				}
				onConfirm={confirmDelete}
				onCancel={handleDeleteCancel}
				confirmText={deleting ? 'Deleting...' : 'Delete'}
				cancelText='Cancel'
				variant='danger'
				confirmDisabled={deleting}
			/>
		</div>
	)
}
