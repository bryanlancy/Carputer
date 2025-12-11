'use client'

import { ReactNode } from 'react'
import styles from './ConfirmModal.module.scss'

interface ConfirmModalProps {
	isOpen: boolean
	title: string
	message: string | ReactNode
	onConfirm: () => void
	onCancel: () => void
	confirmText?: string
	cancelText?: string
	variant?: 'danger' | 'warning' | 'info'
	confirmDisabled?: boolean
}

export default function ConfirmModal({
	isOpen,
	title,
	message,
	onConfirm,
	onCancel,
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	variant = 'info',
	confirmDisabled = false,
}: ConfirmModalProps) {
	if (!isOpen) return null

	const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget) {
			onCancel()
		}
	}

	return (
		<div className={styles.overlay} onClick={handleBackdropClick}>
			<div className={styles.modal}>
				<div className={styles.header}>
					<h3 className={styles.title}>{title}</h3>
					<button
						className={styles.closeButton}
						onClick={onCancel}
						aria-label='Close'>
						×
					</button>
				</div>
				<div className={styles.content}>
					{typeof message === 'string' ? <p>{message}</p> : message}
				</div>
				<div className={styles.actions}>
					<button
						className={`${styles.button} ${styles.cancelButton}`}
						onClick={onCancel}>
						{cancelText}
					</button>
					<button
						className={`${styles.button} ${styles.confirmButton} ${styles[variant]}`}
						onClick={onConfirm}
						disabled={confirmDisabled}>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	)
}
