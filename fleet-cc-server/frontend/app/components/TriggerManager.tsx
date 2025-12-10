'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../utils/api'
import { extractDataTypes } from '../utils/dataTypeExtractor'
import { DataTypeIcons } from '../utils/dataTypeIcons'
import styles from './TriggerManager.module.scss'

interface Trigger {
	id: number
	trigger_code: string
	trigger_name: string
	description?: string | null
	output_schema?: any
	enabled: boolean
	created_at?: string
	updated_at?: string
}

export default function TriggerManager() {
	const { session } = useAuth()
	const [triggers, setTriggers] = useState<Trigger[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [formData, setFormData] = useState({
		trigger_code: '',
		trigger_name: '',
		description: '',
		output_schema: {},
		enabled: true,
	})

	useEffect(() => {
		loadTriggers()
	}, [])

	const loadTriggers = async () => {
		try {
			setLoading(true)
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/triggers`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setTriggers(data)
			} else {
				setError('Failed to load triggers')
			}
		} catch (err: any) {
			console.error('Failed to load triggers:', err)
			setError('Failed to load triggers')
		} finally {
			setLoading(false)
		}
	}

	const handleEdit = (trigger: Trigger) => {
		setEditingTrigger(trigger)
		setFormData({
			trigger_code: trigger.trigger_code,
			trigger_name: trigger.trigger_name,
			description: trigger.description || '',
			output_schema: trigger.output_schema || {},
			enabled: trigger.enabled,
		})
		setShowForm(true)
	}

	const handleDelete = async (triggerId: number) => {
		if (!confirm('Are you sure you want to delete this trigger?')) {
			return
		}

		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/triggers/${triggerId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				await loadTriggers()
			} else {
				const errorData = await response.json()
				setError(errorData.error || 'Failed to delete trigger')
			}
		} catch (err: any) {
			console.error('Failed to delete trigger:', err)
			setError('Failed to delete trigger')
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		try {
			const apiUrl = getApiUrl()
			const requestBody: any = {
				trigger_code: formData.trigger_code.trim(),
				trigger_name: formData.trigger_name.trim(),
				output_schema: formData.output_schema,
				enabled: formData.enabled,
			}

			if (formData.description && formData.description.trim()) {
				requestBody.description = formData.description.trim()
			}

			let response
			if (editingTrigger) {
				// Update existing trigger
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/triggers/${editingTrigger.id}`,
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
				// Create new trigger
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/triggers`,
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
				setEditingTrigger(null)
				setFormData({
					trigger_code: '',
					trigger_name: '',
					description: '',
					output_schema: {},
					enabled: true,
				})
				await loadTriggers()
			} else {
				const errorData = await response.json()
				setError(
					errorData.error ||
						errorData.details?.[0]?.message ||
						'Failed to save trigger'
				)
			}
		} catch (err: any) {
			console.error('Failed to save trigger:', err)
			setError('Failed to save trigger')
		}
	}

	const resetForm = () => {
		setFormData({
			trigger_code: '',
			trigger_name: '',
			description: '',
			output_schema: {},
			enabled: true,
		})
		setEditingTrigger(null)
		setShowForm(false)
	}

	if (loading) {
		return <div className={styles.loading}>Loading triggers...</div>
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Trigger Management</h2>
				<p className={styles.description}>
					Manage triggers that can be used in the wiring system.
					Triggers emit data when events occur.
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
					+ Add Trigger
				</button>
			</div>

			{showForm && (
				<div className={styles.formOverlay}>
					<div className={styles.formContainer}>
						<h3>
							{editingTrigger ? 'Edit Trigger' : 'Create Trigger'}
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
								Trigger Code *
								<input
									type='text'
									value={formData.trigger_code}
									onChange={e =>
										setFormData({
											...formData,
											trigger_code: e.target.value,
										})
									}
									required
									disabled={!!editingTrigger}
									placeholder='e.g., device.online'
								/>
								<small>
									Unique identifier for this trigger (cannot
									be changed after creation)
								</small>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Trigger Name *
								<input
									type='text'
									value={formData.trigger_name}
									onChange={e =>
										setFormData({
											...formData,
											trigger_name: e.target.value,
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
									placeholder='Optional description of what this trigger does'
									rows={3}
								/>
							</label>
						</div>

						<div className={styles.formGroup}>
							<label>
								Output Schema * (JSON)
								<textarea
									value={JSON.stringify(
										formData.output_schema,
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
												output_schema: parsed,
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
									JSON Schema defining what data this trigger
									emits
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
								{editingTrigger ? 'Update' : 'Create'} Trigger
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
							<th>Data Types</th>
							<th>Enabled</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{triggers.length === 0 ? (
							<tr>
								<td colSpan={5}>
									<div className={styles.empty}>
										No triggers found. Create one to get
										started.
									</div>
								</td>
							</tr>
						) : (
							triggers.map(trigger => {
								const dataTypes = trigger.output_schema
									? extractDataTypes(trigger.output_schema)
									: []
								return (
									<tr key={trigger.id}>
										<td>{trigger.trigger_code}</td>
										<td>{trigger.trigger_name}</td>
										<td>
											<DataTypeIcons
												types={dataTypes}
												size='small'
											/>
										</td>
										<td>
											{trigger.enabled ? 'Yes' : 'No'}
										</td>
										<td>
											<button
												onClick={() =>
													handleEdit(trigger)
												}
												className={styles.editButton}>
												Edit
											</button>
											<button
												onClick={() =>
													handleDelete(trigger.id)
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
