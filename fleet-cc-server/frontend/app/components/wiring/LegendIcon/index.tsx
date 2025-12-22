'use client'

import { useState } from 'react'
import { DataType } from '../../../utils/dataTypeExtractor'
import { getLegendItemByType } from '../legendData'
import styles from './LegendIcon.module.scss'

interface LegendIconProps {
	type: DataType
	size?: 'small' | 'medium' | 'large'
	className?: string
}

export default function LegendIcon({
	type,
	size = 'medium',
	className,
}: LegendIconProps) {
	const [showTooltip, setShowTooltip] = useState(false)
	const legendItem = getLegendItemByType(type)

	if (!legendItem) {
		return null
	}

	return (
		<span
			className={`${styles.legendIcon} ${styles[size]} ${className || ''}`}
			onMouseEnter={() => setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
			aria-label={legendItem.label}>
			<span className={styles.icon}>{legendItem.icon}</span>
			{showTooltip && (
				<div className={styles.tooltip}>
					{legendItem.label}
				</div>
			)}
		</span>
	)
}

