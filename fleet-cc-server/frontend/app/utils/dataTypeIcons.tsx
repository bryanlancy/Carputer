'use client'

import React from 'react'
import { DataType } from './dataTypeExtractor'
import styles from './dataTypeIcons.module.scss'

interface DataTypeIconProps {
	type: DataType
	size?: 'small' | 'medium' | 'large'
	showLabel?: boolean
}

/**
 * Get icon for a data type
 */
function getIconForType(type: DataType): string {
	switch (type) {
		case 'User':
			return '👤'
		case 'Date/Time':
			return '🕐'
		case 'Device':
			return '📱'
		case 'Command':
			return '⚡'
		default:
			return '❓'
	}
}

/**
 * Get label for a data type
 */
function getLabelForType(type: DataType): string {
	return type
}

/**
 * DataTypeIcon component
 * Displays an icon for a data type with optional tooltip
 */
export function DataTypeIcon({
	type,
	size = 'medium',
	showLabel = false,
}: DataTypeIconProps) {
	const icon = getIconForType(type)
	const label = getLabelForType(type)

	return (
		<span
			className={`${styles.dataTypeIcon} ${styles[size]}`}
			title={label}
			aria-label={label}>
			<span className={styles.icon}>{icon}</span>
			{showLabel && <span className={styles.label}>{label}</span>}
		</span>
	)
}

/**
 * DataTypeIcons component
 * Displays multiple data type icons
 */
interface DataTypeIconsProps {
	types: DataType[]
	size?: 'small' | 'medium' | 'large'
	showLabel?: boolean
}

export function DataTypeIcons({
	types,
	size = 'medium',
	showLabel = false,
}: DataTypeIconsProps) {
	if (types.length === 0) {
		return null
	}

	return (
		<div className={styles.dataTypeIcons}>
			{types.map((type, index) => (
				<DataTypeIcon
					key={index}
					type={type}
					size={size}
					showLabel={showLabel}
				/>
			))}
		</div>
	)
}
