'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../../utils/api'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import TagSelector from '../ui/TagSelector'
import styles from './ActionManager.module.scss'

interface Action {
	id: number
	event_code: string
	event_name: string
	description?: string | null
	input_schema?: any
	handler_type: string
	enabled: boolean
	created_at?: string
	updated_at?: string
	tags?: Array<{ id: number; name: string; color?: string | null }>
}

export default function ActionManager() {
	const { session } = useAuth()
	const [actions, setActions] = useState<Action[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [editingAction, setEditingAction] = useState<Action | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [formData, setFormData] = useState({
		event_code: '',
		event_name: '',
		description: '',
		input_schema: {},
		handler_type: 'notification',
		enabled: true,
		tagIds: [] as number[],
	})

	useEffect(() => {
		loadActions()
	}, [])

	const loadActions = async () => {
		try {
			setLoading(true)
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/events`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setActions(data)
			} else {
				setError('Failed to load actions')
			}
		} catch (err: any) {
			console.error('Failed to load actions:', err)
			setError('Failed to load actions')
		} finally {
			setLoading(false)
		}
	}

	const handleEdit = (action: Action) => {
		setEditingAction(action)
		setFormData({
			event_code: action.event_code,
			event_name: action.event_name,
			description: action.description || '',
			input_schema: action.input_schema || {},
			handler_type: action.handler_type,
			enabled: action.enabled,
			tagIds: action.tags?.map(tag => tag.id) || [],
		})
		setShowForm(true)
	}

	const handleDelete = async (actionId: number) => {
		if (!confirm('Are you sure you want to delete this action?')) {
			return
		}

		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/events/${actionId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				await loadActions()
			} else {
				const errorData = await response.json()
				setError(errorData.error || 'Failed to delete action')
			}
		} catch (err: any) {
			console.error('Failed to delete action:', err)
			setError('Failed to delete action')
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		try {
			const apiUrl = getApiUrl()
			const requestBody: any = {
				event_code: formData.event_code.trim(),
				event_name: formData.event_name.trim(),
				input_schema: formData.input_schema,
				handler_type: formData.handler_type,
				enabled: formData.enabled,
				tagIds: formData.tagIds || [],
			}

			if (formData.description && formData.description.trim()) {
				requestBody.description = formData.description.trim()
			}

			let response
			if (editingAction) {
				// Update existing action
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/events/${editingAction.id}`,
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
				// Create new action
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/events`,
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
				setEditingAction(null)
				setFormData({
					event_code: '',
					event_name: '',
					description: '',
					input_schema: {},
					handler_type: 'notification',
					enabled: true,
				})
				await loadActions()
			} else {
				const errorData = await response.json()
				setError(
					errorData.error ||
						errorData.details?.[0]?.message ||
						'Failed to save action'
				)
			}
		} catch (err: any) {
			console.error('Failed to save action:', err)
			setError('Failed to save action')
		}
	}

	const resetForm = () => {
		setFormData({
			event_code: '',
			event_name: '',
			description: '',
			input_schema: {},
			handler_type: 'notification',
			enabled: true,
			tagIds: [],
		})
		setEditingAction(null)
		setShowForm(false)
	}

	if (loading) {
		return <div className={styles.loading}>Loading actions...</div>
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Action Management</h2>
				<p className={styles.description}>
					Manage actions that can be triggered in the wiring system.
					Actions require specific input data to execute.
				</p>
			</div>

			{error && (
				<div className={styles.error}>
					{error}
					<button
						onClick={() => setError(null)}
						className={styles.dismissError}>
						×
					</button>
				</div>
			)}

			<div className={styles.actions}>
				<button
					onClick={() => {
						resetForm()
						setShowForm(true)
					}}
					className={styles.addButton}>
					+ Add Action
				</button>
			</div>

			{showForm && (
				<div className={styles.formOverlay}>
					<div className={styles.formContainer}>
						<h3>
							{editingAction ? 'Edit Action' : 'Create Action'}
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
						<form onSubmit={handleSubmit} className={styles.form}>
							<div className={styles.formGroup}>
								<label>
									Action Code *
									<input
										type='text'
										value={formData.event_code}
										onChange={e =>
											setFormData({
												...formData,
												event_code: e.target.value,
											})
										}
										required
										disabled={!!editingAction}
										placeholder='e.g., show_notification'
									/>
									<small>
										Unique identifier for this action
										(cannot be changed after creation)
									</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Action Name *
									<input
										type='text'
										value={formData.event_name}
										onChange={e =>
											setFormData({
												...formData,
												event_name: e.target.value,
											})
										}
										required
										placeholder='e.g., Show Notification'
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
										placeholder='Optional description of what this action does'
										rows={3}
									/>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Handler Type *
									<select
										value={formData.handler_type}
										onChange={e =>
											setFormData({
												...formData,
												handler_type: e.target.value,
											})
										}
										required>
										<option value='notification'>
											Notification
										</option>
										<option value='email'>Email</option>
										<option value='command'>Command</option>
										<option value='webhook'>Webhook</option>
										<option value='custom'>Custom</option>
									</select>
									<small>
										The type of handler that will execute
										this action
									</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Input Schema * (JSON)
									<textarea
										value={JSON.stringify(
											formData.input_schema,
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
													input_schema: parsed,
												})
											} catch (err) {
												// Invalid JSON, keep the text for user to fix
											}
										}}
										required
										placeholder='{"type": "object", "properties": {...}, "required": [...]}'
										rows={10}
										className={styles.jsonInput}
									/>
									<small>
										JSON Schema defining what data this
										action requires
									</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<TagSelector
									selectedTagIds={formData.tagIds}
									onChange={tagIds =>
										setFormData({
											...formData,
											tagIds,
										})
									}
									label='Tags'
								/>
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
								<button
									type='submit'
									className={styles.saveButton}>
									{editingAction ? 'Update' : 'Create'} Action
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
				</div>
			)}

			<div className={styles.tableContainer}>
				<table className={styles.table}>
					<thead>
						<tr>
							<th>Code</th>
							<th>Name</th>
							<th>Handler Type</th>
							<th>Required Data Types</th>
							<th>Enabled</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{actions.length === 0 ? (
							<tr>
								<td colSpan={6} className={styles.empty}>
									No actions found. Create one to get started.
								</td>
							</tr>
						) : (
							actions.map(action => {
								const dataTypes = action.input_schema
									? extractDataTypes(action.input_schema)
									: []
								return (
									<tr key={action.id}>
										<td>{action.event_code}</td>
										<td>{action.event_name}</td>
										<td>{action.handler_type}</td>
										<td>
											<DataTypeIcons
												types={dataTypes}
												size='small'
											/>
										</td>
										<td>{action.enabled ? 'Yes' : 'No'}</td>
										<td>
											<button
												onClick={() =>
													handleEdit(action)
												}
												className={styles.editButton}>
												Edit
											</button>
											<button
												onClick={() =>
													handleDelete(action.id)
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
