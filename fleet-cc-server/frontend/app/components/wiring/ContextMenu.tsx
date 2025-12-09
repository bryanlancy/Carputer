'use client'

import React from 'react'
import styles from './ContextMenu.module.scss'

interface ContextMenuProps {
	x: number
	y: number
	type: 'node' | 'edge'
	onDelete: () => void
	onClose: () => void
}

export default function ContextMenu({
	x,
	y,
	type,
	onDelete,
	onClose,
}: ContextMenuProps) {
	React.useEffect(() => {
		const handleClickOutside = () => {
			onClose()
		}

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		// Add event listeners
		document.addEventListener('click', handleClickOutside)
		document.addEventListener('keydown', handleEscape)

		return () => {
			document.removeEventListener('click', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [onClose])

	return (
		<div
			className={styles.contextMenu}
			style={{ left: `${x}px`, top: `${y}px` }}
			onClick={e => e.stopPropagation()}>
			<button
				className={styles.menuItem}
				onClick={e => {
					e.stopPropagation()
					onDelete()
					onClose()
				}}>
				{type === 'node' ? 'Delete Node' : 'Delete Connection'}
			</button>
		</div>
	)
}
