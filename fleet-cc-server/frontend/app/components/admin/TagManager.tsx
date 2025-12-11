'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import ConfirmModal from '../ui/ConfirmModal'
import styles from './TagManager.module.scss'

interface Tag {
	id: number
	name: string
	description: string | null
	color: string | null
	category: string | null
	_count?: {
		tag_associations: number
	}
}

export default function TagManager() {
	const { session } = useAuth()
	const [tags, setTags] = useState<Tag[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showForm, setShowForm] = useState(false)
	const [editingTag, setEditingTag] = useState<Tag | null>(null)
	const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		color: '#3b82f6',
		category: '',
	})

	useEffect(() => {
		loadTags()
	}, [])

	const loadTags = async () => {
		setLoading(true)
		setError(null)
		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setError('Authentication required')
				return
			}

			const url = searchTerm
				? `${apiUrl}/api/admin/tags?search=${encodeURIComponent(
						searchTerm
				  )}`
				: `${apiUrl}/api/admin/tags`

			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (response.ok) {
				const data = await response.json()
				setTags(data)
			} else if (response.status === 401 || response.status === 403) {
				setError('Unauthorized. Please check your permissions.')
			} else {
				setError(`Failed to load tags: ${response.statusText}`)
			}
		} catch (err: any) {
			setError(`Error loading tags: ${err.message}`)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			loadTags()
		}, 300)

		return () => clearTimeout(timeoutId)
	}, [searchTerm])

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

			const url = editingTag
				? `${apiUrl}/api/admin/tags/${editingTag.id}`
				: `${apiUrl}/api/admin/tags`

			const response = await fetch(url, {
				method: editingTag ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: formData.name.trim(),
					description: formData.description.trim() || null,
					color: formData.color || null,
					category: formData.category.trim() || null,
				}),
			})

			if (response.ok) {
				await loadTags()
				setShowForm(false)
				setEditingTag(null)
				setFormData({
					name: '',
					description: '',
					color: '#3b82f6',
					category: '',
				})
			} else {
				const errorData = await response.json().catch(() => ({
					error: 'Unknown error',
				}))
				setError(
					errorData.error ||
						`Failed to ${editingTag ? 'update' : 'create'} tag`
				)
			}
		} catch (err: any) {
			setError(`Error: ${err.message}`)
		}
	}

	const handleEdit = (tag: Tag) => {
		setEditingTag(tag)
		setFormData({
			name: tag.name,
			description: tag.description || '',
			color: tag.color || '#3b82f6',
			category: tag.category || '',
		})
		setShowForm(true)
	}

	const handleDelete = (id: number) => {
		setDeleteConfirmId(id)
		setShowDeleteConfirm(true)
	}

	const confirmDelete = async () => {
		if (!deleteConfirmId) return

		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setError('Authentication required')
				setShowDeleteConfirm(false)
				setDeleteConfirmId(null)
				return
			}

			const response = await fetch(
				`${apiUrl}/api/admin/tags/${deleteConfirmId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			)

			if (response.ok) {
				await loadTags()
			} else {
				const errorData = await response.json().catch(() => ({
					error: 'Unknown error',
				}))
				setError(errorData.error || 'Failed to delete tag')
			}
		} catch (err: any) {
			setError(`Error: ${err.message}`)
		} finally {
			setShowDeleteConfirm(false)
			setDeleteConfirmId(null)
		}
	}

	const handleCancel = () => {
		setShowForm(false)
		setEditingTag(null)
		setFormData({
			name: '',
			description: '',
			color: '#3b82f6',
			category: '',
		})
	}

	if (loading) {
		return <div className={styles.loading}>Loading tags...</div>
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Tag Management</h2>
				<p className={styles.subtitle}>
					Manage tags that can be used to categorize and organize
					notifications
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
				<div className={styles.searchBox}>
					<input
						type='text'
						placeholder='Search tags...'
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
						className={styles.searchInput}
					/>
				</div>
				<button
					onClick={() => {
						setEditingTag(null)
						setFormData({
							name: '',
							description: '',
							color: '#3b82f6',
							category: '',
						})
						setShowForm(true)
					}}
					className={styles.addButton}>
					+ Add New Tag
				</button>
			</div>

			{showForm && (
				<div className={styles.formOverlay}>
					<div className={styles.formContainer}>
						<h3>{editingTag ? 'Edit Tag' : 'Create Tag'}</h3>
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
										placeholder='e.g., test, success, warning'
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
										placeholder='Optional description of this tag'
									/>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Color
									<div className={styles.colorInputGroup}>
										<input
											type='color'
											value={formData.color}
											onChange={e =>
												setFormData({
													...formData,
													color: e.target.value,
												})
											}
											className={styles.colorPicker}
										/>
										<input
											type='text'
											value={formData.color}
											onChange={e =>
												setFormData({
													...formData,
													color: e.target.value,
												})
											}
											placeholder='#3b82f6'
											pattern='^#[0-9A-Fa-f]{6}$'
											className={styles.colorText}
										/>
									</div>
									<small>Hex color code for UI display</small>
								</label>
							</div>

							<div className={styles.formGroup}>
								<label>
									Category
									<input
										type='text'
										value={formData.category}
										onChange={e =>
											setFormData({
												...formData,
												category: e.target.value,
											})
										}
										placeholder='e.g., system, status, priority'
									/>
									<small>
										Optional category for grouping tags
									</small>
								</label>
							</div>

							<div className={styles.formActions}>
								<button
									type='submit'
									className={styles.saveButton}>
									{editingTag ? 'Update' : 'Create'} Tag
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

			{tags.length === 0 ? (
				<div className={styles.empty}>
					<p>
						No tags found.{' '}
						{searchTerm
							? 'Try a different search term.'
							: 'Create your first tag to get started.'}
					</p>
				</div>
			) : (
				<div className={styles.tableContainer}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>Name</th>
								<th>Description</th>
								<th>Color</th>
								<th>Category</th>
								<th>Usage</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{tags.map(tag => (
								<tr key={tag.id}>
									<td className={styles.tagName}>
										{tag.name}
									</td>
									<td>{tag.description || '-'}</td>
									<td>
										{tag.color && (
											<span
												className={styles.colorBadge}
												style={{
													backgroundColor:
														tag.color + '20',
													color: tag.color,
													borderColor: tag.color,
												}}>
												{tag.color}
											</span>
										)}
									</td>
									<td>{tag.category || '-'}</td>
									<td>
										{tag._count?.tag_associations || 0}{' '}
										{tag._count?.tag_associations === 1
											? 'association'
											: 'associations'}
									</td>
									<td>
										<button
											onClick={() => handleEdit(tag)}
											className={styles.editButton}>
											Edit
										</button>
										<button
											onClick={() => handleDelete(tag.id)}
											className={styles.deleteButton}
											disabled={
												(tag._count?.tag_associations ||
													0) > 0
											}
											title={
												(tag._count?.tag_associations ||
													0) > 0
													? 'Cannot delete tag with associations'
													: 'Delete tag'
											}>
											Delete
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<ConfirmModal
				isOpen={showDeleteConfirm}
				title='Delete Tag'
				message='Are you sure you want to delete this tag? This action cannot be undone.'
				onConfirm={confirmDelete}
				onCancel={() => {
					setShowDeleteConfirm(false)
					setDeleteConfirmId(null)
				}}
				confirmText='Delete'
				cancelText='Cancel'
				variant='danger'
			/>
		</div>
	)
}
