'use client'

import styles from './TagPill.module.scss'

interface TagPillProps {
	tag: {
		id: number
		name: string
		color?: string | null
	}
	onRemove?: () => void
	readonly?: boolean
}

export default function TagPill({
	tag,
	onRemove,
	readonly = false,
}: TagPillProps) {
	const pillColor = tag.color || '#9e9e9e'

	return (
		<span
			className={`${styles.pill} ${readonly ? styles.readonly : ''}`}
			style={{
				backgroundColor: `${pillColor}20`,
				borderColor: pillColor,
				color: pillColor,
			}}>
			{tag.name}
			{!readonly && onRemove && (
				<button
					type='button'
					className={styles.removeButton}
					onClick={e => {
						e.preventDefault()
						e.stopPropagation()
						onRemove()
					}}
					aria-label={`Remove ${tag.name} tag`}>
					×
				</button>
			)}
		</span>
	)
}
