'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
import TagPill from './TagPill'
import styles from './TagSelector.module.scss'

interface Tag {
	id: number
	name: string
	color?: string | null
	description?: string | null
	category?: string | null
}

interface TagSelectorProps {
	selectedTagIds: number[]
	onChange: (tagIds: number[]) => void
	label?: string
}

export default function TagSelector({
	selectedTagIds,
	onChange,
	label = 'Tags',
}: TagSelectorProps) {
	const { session } = useAuth()
	const [availableTags, setAvailableTags] = useState<Tag[]>([])
	const [loading, setLoading] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [showDropdown, setShowDropdown] = useState(false)
	const [creatingTag, setCreatingTag] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Load available tags
	useEffect(() => {
		loadTags()
	}, [])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	const loadTags = async () => {
		try {
			setLoading(true)
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				return
			}

			const response = await fetch(
				`${apiUrl}/api/admin/tags?search=${encodeURIComponent(
					searchQuery || ''
				)}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			)

			if (response.ok) {
				const tags = await response.json()
				setAvailableTags(tags)
			}
		} catch (err) {
			console.error('Failed to load tags:', err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			loadTags()
		}, 300)

		return () => clearTimeout(timeoutId)
	}, [searchQuery])

	const selectedTags = availableTags.filter(tag =>
		selectedTagIds.includes(tag.id)
	)

	const unselectedTags = availableTags.filter(
		tag => !selectedTagIds.includes(tag.id)
	)

	const filteredTags = searchQuery
		? unselectedTags.filter(tag =>
				tag.name.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: unselectedTags

	const handleAddTag = (tagId: number) => {
		if (!selectedTagIds.includes(tagId)) {
			onChange([...selectedTagIds, tagId])
		}
		setSearchQuery('')
		setShowDropdown(false)
		inputRef.current?.focus()
	}

	const handleRemoveTag = (tagId: number) => {
		onChange(selectedTagIds.filter(id => id !== tagId))
	}

	const handleCreateTag = async () => {
		if (!searchQuery.trim()) {
			return
		}

		try {
			setCreatingTag(true)
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				return
			}

			const response = await fetch(`${apiUrl}/api/admin/tags`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: searchQuery.trim(),
				}),
			})

			if (response.ok) {
				const newTag = await response.json()
				onChange([...selectedTagIds, newTag.id])
				setSearchQuery('')
				setShowDropdown(false)
				await loadTags()
			} else {
				const errorData = await response.json().catch(() => ({
					error: 'Failed to create tag',
				}))
				console.error('Failed to create tag:', errorData.error)
			}
		} catch (err) {
			console.error('Error creating tag:', err)
		} finally {
			setCreatingTag(false)
		}
	}

	const canCreateTag =
		searchQuery.trim() &&
		!filteredTags.some(
			tag => tag.name.toLowerCase() === searchQuery.toLowerCase()
		) &&
		!selectedTags.some(
			tag => tag.name.toLowerCase() === searchQuery.toLowerCase()
		)

	return (
		<div className={styles.container} ref={containerRef}>
			<label className={styles.label}>{label}</label>
			<div className={styles.selectedTags}>
				{selectedTags.map(tag => (
					<TagPill
						key={tag.id}
						tag={tag}
						onRemove={() => handleRemoveTag(tag.id)}
					/>
				))}
			</div>
			<div className={styles.inputContainer}>
				<input
					ref={inputRef}
					type='text'
					className={styles.input}
					placeholder='Search or create tags...'
					value={searchQuery}
					onChange={e => {
						setSearchQuery(e.target.value)
						setShowDropdown(true)
					}}
					onFocus={() => setShowDropdown(true)}
				/>
				{showDropdown && (
					<div className={styles.dropdown}>
						{loading ? (
							<div className={styles.loading}>Loading...</div>
						) : filteredTags.length > 0 ? (
							<div className={styles.tagList}>
								{filteredTags.map(tag => (
									<button
										key={tag.id}
										type='button'
										className={styles.tagOption}
										onClick={() => handleAddTag(tag.id)}>
										<TagPill tag={tag} readonly />
										{tag.description && (
											<span
												className={
													styles.tagDescription
												}>
												{tag.description}
											</span>
										)}
									</button>
								))}
							</div>
						) : canCreateTag ? (
							<button
								type='button'
								className={styles.createTagOption}
								onClick={handleCreateTag}
								disabled={creatingTag}>
								{creatingTag
									? 'Creating...'
									: `Create "${searchQuery.trim()}"`}
							</button>
						) : (
							<div className={styles.empty}>
								No tags found. Type a name to create a new tag.
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
