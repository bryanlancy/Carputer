'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../../utils/api'
import styles from './ApiKeyManager.module.scss'

interface ApiKeyPermission {
	id?: number
	resource_type: string
	allowed_endpoints?: string[] | null
	allowed_fields?: Record<string, string[]> | null
}

interface ApiKey {
	id: number
	key_prefix: string
	user_id: string
	user?: {
		id: string
		email: string
		full_name?: string | null
	}
	description?: string | null
	revoked_at?: string | null
	last_used_at?: string | null
	created_at: string
	updated_at: string
	permissions: ApiKeyPermission[]
}

interface ApiKeyManagerProps {
	onUnauthorized?: () => void
}

// Resource types and their available fields
const RESOURCE_TYPES = [
	{ value: 'devices', label: 'Devices' },
	{ value: 'users', label: 'Users' },
	{ value: 'commands', label: 'Commands' },
	{ value: 'notifications', label: 'Notifications' },
	{ value: 'metrics', label: 'Metrics' },
]

const RESOURCE_FIELDS: Record<string, string[]> = {
	devices: [
		'id',
		'device_id',
		'mac_address',
		'hostname',
		'vin',
		'hardware_rev',
		'build_id',
		'current_version',
		'current_build_id',
		'current_ip',
		'status',
		'last_seen',
		'created_at',
		'updated_at',
	],
	users: [
		'id',
		'email',
		'full_name',
		'avatar_url',
		'supabase_user_id',
		'created_at',
		'updated_at',
	],
	commands: [
		'id',
		'device_id',
		'command',
		'parameters',
		'status',
		'result',
		'error',
		'created_at',
		'updated_at',
		'completed_at',
	],
	notifications: [
		'id',
		'name',
		'description',
		'enabled',
		'notification_type',
		'priority',
		'created_at',
		'updated_at',
	],
	metrics: ['timestamp', 'device_count', 'online_count', 'offline_count'],
}

const COMMON_ENDPOINTS = [
	{ value: '/api/devices', label: 'All Devices' },
	{ value: '/api/devices/:id', label: 'Device by ID' },
	{ value: '/api/users', label: 'All Users' },
	{ value: '/api/users/:id', label: 'User by ID' },
	{ value: '/api/commands', label: 'All Commands' },
	{ value: '/api/commands/:id', label: 'Command by ID' },
	{ value: '/api/notifications', label: 'All Notifications' },
	{ value: '/api/metrics', label: 'Metrics' },
]

export default function ApiKeyManager({
	onUnauthorized,
}: ApiKeyManagerProps = {}) {
	const { session } = useAuth()
	const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [showKeyPopup, setShowKeyPopup] = useState(false)
	const [newKey, setNewKey] = useState<string | null>(null)
	const [formData, setFormData] = useState({
		description: '',
		permissions: [] as ApiKeyPermission[],
	})

	useEffect(() => {
		loadApiKeys()
	}, [])

	const loadApiKeys = async () => {
		try {
			setLoading(true)
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/api-keys`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setApiKeys(data)
			} else if (response.status === 403) {
				setError('You do not have permission to access API keys')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
			} else {
				const errorData = await response.json().catch(() => ({}))
				setError(errorData.error || 'Failed to load API keys')
			}
		} catch (err: any) {
			console.error('Failed to load API keys:', err)
			setError('Failed to load API keys')
		} finally {
			setLoading(false)
		}
	}

	const handleEdit = (key: ApiKey) => {
		setEditingKey(key)
		setFormData({
			description: key.description || '',
			permissions: key.permissions.map(p => ({
				...p,
				allowed_endpoints: p.allowed_endpoints || [],
				allowed_fields: p.allowed_fields || {},
			})),
		})
		setShowForm(true)
	}

	const handleRevoke = async (keyId: number) => {
		if (!confirm('Are you sure you want to revoke this API key?')) {
			return
		}

		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/api-keys/${keyId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				await loadApiKeys()
			} else if (response.status === 403) {
				setError('You do not have permission to revoke API keys')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
			} else {
				const errorData = await response.json().catch(() => ({}))
				setError(errorData.error || 'Failed to revoke API key')
			}
		} catch (err: any) {
			console.error('Failed to revoke API key:', err)
			setError('Failed to revoke API key')
		}
	}

	const handleDelete = async (keyId: number) => {
		if (
			!confirm(
				'Are you sure you want to delete this API key? This action cannot be undone.'
			)
		) {
			return
		}

		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/api-keys/${keyId}?delete=true`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				await loadApiKeys()
			} else if (response.status === 403) {
				setError('You do not have permission to delete API keys')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
			} else {
				const errorData = await response.json().catch(() => ({}))
				setError(errorData.error || 'Failed to delete API key')
			}
		} catch (err: any) {
			console.error('Failed to delete API key:', err)
			setError('Failed to delete API key')
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		try {
			const apiUrl = getApiUrl()
			const requestBody = {
				description: formData.description.trim() || null,
				permissions: formData.permissions,
			}

			let response
			if (editingKey) {
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/api-keys/${editingKey.id}`,
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
				response = await authenticatedFetch(
					`${apiUrl}/api/admin/api-keys`,
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
				const data = await response.json()
				if (!editingKey && data.key) {
					// New key created - close form and show key popup
					setFormData({
						description: '',
						permissions: [],
					})
					setEditingKey(null)
					setShowForm(false)
					setNewKey(data.key)
					setShowKeyPopup(true)
					await loadApiKeys()
				} else {
					// Update successful
					await loadApiKeys()
					if (editingKey) {
						resetForm()
					}
				}
			} else if (response.status === 403) {
				setError('You do not have permission to modify API keys')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
			} else {
				const errorData = await response.json().catch(() => ({}))
				setError(
					errorData.error ||
						errorData.details?.[0]?.message ||
						'Failed to save API key'
				)
			}
		} catch (err: any) {
			console.error('Failed to save API key:', err)
			setError('Failed to save API key')
		}
	}

	const resetForm = () => {
		setFormData({
			description: '',
			permissions: [],
		})
		setEditingKey(null)
		setShowForm(false)
		setNewKey(null)
	}

	const addPermission = () => {
		setFormData({
			...formData,
			permissions: [
				...formData.permissions,
				{
					resource_type: 'devices',
					allowed_endpoints: [],
					allowed_fields: {},
				},
			],
		})
	}

	const removePermission = (index: number) => {
		setFormData({
			...formData,
			permissions: formData.permissions.filter((_, i) => i !== index),
		})
	}

	const updatePermission = (
		index: number,
		updates: Partial<ApiKeyPermission>
	) => {
		const newPermissions = [...formData.permissions]
		newPermissions[index] = { ...newPermissions[index], ...updates }
		setFormData({ ...formData, permissions: newPermissions })
	}

	const toggleField = (
		permissionIndex: number,
		resourceType: string,
		field: string
	) => {
		const permission = formData.permissions[permissionIndex]
		const currentFields = permission.allowed_fields?.[resourceType] || []
		const newFields = currentFields.includes(field)
			? currentFields.filter(f => f !== field)
			: [...currentFields, field]

		updatePermission(permissionIndex, {
			allowed_fields: {
				...(permission.allowed_fields || {}),
				[resourceType]: newFields,
			},
		})
	}

	const selectAllFields = (permissionIndex: number, resourceType: string) => {
		const permission = formData.permissions[permissionIndex]
		const allFields = RESOURCE_FIELDS[resourceType] || []
		updatePermission(permissionIndex, {
			allowed_fields: {
				...(permission.allowed_fields || {}),
				[resourceType]: allFields,
			},
		})
	}

	const deselectAllFields = (
		permissionIndex: number,
		resourceType: string
	) => {
		const permission = formData.permissions[permissionIndex]
		updatePermission(permissionIndex, {
			allowed_fields: {
				...(permission.allowed_fields || {}),
				[resourceType]: [],
			},
		})
	}

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			// You could show a toast notification here instead of alert
			alert('API key copied to clipboard!')
		} catch (err) {
			console.error('Failed to copy to clipboard:', err)
			alert('Failed to copy to clipboard')
		}
	}

	if (loading) {
		return <div className={styles.loading}>Loading API keys...</div>
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>API Key Management</h2>
				<p className={styles.description}>
					Create and manage API keys for programmatic access to the
					API. Configure permissions to control which endpoints and
					fields each key can access.
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

			{showKeyPopup && newKey && (
				<div className={styles.formOverlay}>
					<div className={styles.formContainer}>
						<h3>API Key Created!</h3>
						<p className={styles.keyWarning}>
							This is the only time you'll see this key. Copy it
							now and store it securely.
						</p>
						<div className={styles.keyDisplay}>
							<code>{newKey}</code>
							<button
								onClick={() => copyToClipboard(newKey)}
								className={styles.copyButton}>
								Copy
							</button>
						</div>
						<div className={styles.formActions}>
							<button
								type='button'
								onClick={() => {
									setShowKeyPopup(false)
									setNewKey(null)
								}}
								className={styles.saveButton}>
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			<div className={styles.actions}>
				<button
					onClick={() => {
						resetForm()
						setShowForm(true)
					}}
					className={styles.addButton}>
					+ Create API Key
				</button>
			</div>

			{showForm && (
				<div className={styles.formOverlay}>
					<div className={styles.formContainer}>
						<h3>
							{editingKey ? 'Edit API Key' : 'Create API Key'}
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
									Description
									<input
										type='text'
										value={formData.description}
										onChange={e =>
											setFormData({
												...formData,
												description: e.target.value,
											})
										}
										placeholder='e.g., Production API key for monitoring'
									/>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Permissions *
									<small>
										Configure which resources, endpoints,
										and fields this API key can access
									</small>
								</label>
								{formData.permissions.map(
									(permission, index) => (
										<div
											key={index}
											className={styles.permissionCard}>
											<div
												className={
													styles.permissionHeader
												}>
												<select
													value={
														permission.resource_type
													}
													onChange={e =>
														updatePermission(
															index,
															{
																resource_type:
																	e.target
																		.value,
																allowed_fields:
																	{},
															}
														)
													}
													className={
														styles.resourceSelect
													}>
													{RESOURCE_TYPES.map(
														type => (
															<option
																key={type.value}
																value={
																	type.value
																}>
																{type.label}
															</option>
														)
													)}
												</select>
												<button
													type='button'
													onClick={() =>
														removePermission(index)
													}
													className={
														styles.removeButton
													}>
													Remove
												</button>
											</div>

											<div
												className={
													styles.permissionSection
												}>
												<label>
													Allowed Endpoints
													<small>
														Select endpoints this
														key can access for{' '}
														{
															permission.resource_type
														}
													</small>
													<div
														className={
															styles.endpointList
														}>
														{COMMON_ENDPOINTS.filter(
															ep =>
																ep.value.startsWith(
																	`/api/${permission.resource_type}`
																) ||
																ep.value ===
																	'/api/metrics'
														).map(endpoint => (
															<label
																key={
																	endpoint.value
																}
																className={
																	styles.checkboxLabel
																}>
																<input
																	type='checkbox'
																	checked={(
																		permission.allowed_endpoints ||
																		[]
																	).includes(
																		endpoint.value
																	)}
																	onChange={e => {
																		const current =
																			permission.allowed_endpoints ||
																			[]
																		const newEndpoints =
																			e
																				.target
																				.checked
																				? [
																						...current,
																						endpoint.value,
																				  ]
																				: current.filter(
																						ep =>
																							ep !==
																							endpoint.value
																				  )
																		updatePermission(
																			index,
																			{
																				allowed_endpoints:
																					newEndpoints,
																			}
																		)
																	}}
																/>
																{endpoint.label}
															</label>
														))}
													</div>
												</label>
											</div>

											<div
												className={
													styles.permissionSection
												}>
												<label>
													Allowed Fields
													<small>
														Select which fields can
														be accessed for{' '}
														{
															permission.resource_type
														}
													</small>
													<div
														className={
															styles.fieldActions
														}>
														<button
															type='button'
															onClick={() =>
																selectAllFields(
																	index,
																	permission.resource_type
																)
															}
															className={
																styles.selectAllButton
															}>
															Select All
														</button>
														<button
															type='button'
															onClick={() =>
																deselectAllFields(
																	index,
																	permission.resource_type
																)
															}
															className={
																styles.deselectAllButton
															}>
															Deselect All
														</button>
													</div>
													<div
														className={
															styles.fieldList
														}>
														{RESOURCE_FIELDS[
															permission
																.resource_type
														]?.map(field => (
															<label
																key={field}
																className={
																	styles.checkboxLabel
																}>
																<input
																	type='checkbox'
																	checked={(
																		permission
																			.allowed_fields?.[
																			permission
																				.resource_type
																		] || []
																	).includes(
																		field
																	)}
																	onChange={() =>
																		toggleField(
																			index,
																			permission.resource_type,
																			field
																		)
																	}
																/>
																{field}
															</label>
														))}
													</div>
												</label>
											</div>
										</div>
									)
								)}
								<button
									type='button'
									onClick={addPermission}
									className={styles.addPermissionButton}>
									+ Add Permission
								</button>
							</div>

							<div className={styles.formActions}>
								<button
									type='submit'
									className={styles.saveButton}
									disabled={
										formData.permissions.length === 0
									}>
									{editingKey ? 'Update' : 'Create'} API Key
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
							<th>Key Prefix</th>
							<th>Description</th>
							<th>User</th>
							<th>Status</th>
							<th>Last Used</th>
							<th>Created</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{apiKeys.length === 0 ? (
							<tr>
								<td colSpan={7}>
									<div className={styles.empty}>
										<p>
											No API keys found. Create one to get
											started.
										</p>
									</div>
								</td>
							</tr>
						) : (
							apiKeys.map(key => (
								<tr key={key.id}>
									<td>
										<code className={styles.keyPrefix}>
											{key.key_prefix}...
										</code>
									</td>
									<td>{key.description || '-'}</td>
									<td>{key.user?.email || '-'}</td>
									<td>
										<span
											className={
												key.revoked_at
													? styles.revoked
													: styles.active
											}>
											{key.revoked_at
												? 'Revoked'
												: 'Active'}
										</span>
									</td>
									<td>
										{key.last_used_at
											? new Date(
													key.last_used_at
											  ).toLocaleDateString()
											: 'Never'}
									</td>
									<td>
										{new Date(
											key.created_at
										).toLocaleDateString()}
									</td>
									<td>
										<button
											onClick={() => handleEdit(key)}
											className={styles.editButton}
											disabled={!!key.revoked_at}>
											Edit
										</button>
										<button
											onClick={() => handleRevoke(key.id)}
											className={styles.revokeButton}
											disabled={!!key.revoked_at}>
											{key.revoked_at
												? 'Revoked'
												: 'Revoke'}
										</button>
										{!key.last_used_at && (
											<button
												onClick={() =>
													handleDelete(key.id)
												}
												className={styles.deleteButton}
												title='Delete API key (only available for unused keys)'>
												🗑️
											</button>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
