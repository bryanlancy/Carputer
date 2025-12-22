'use client'

import { useState } from 'react'
import { LEGEND_DATA } from '../legendData'
import LegendIcon from '../LegendIcon'
import styles from './WiringLegend.module.scss'

export default function WiringLegend() {
	const [isExpanded, setIsExpanded] = useState(false)

	return (
		<div className={styles.legend}>
			<div className={`${styles.headerRow} ${isExpanded ? styles.expanded : styles.collapsed}`}>
				<div className={styles.header}>Legend</div>
				<button
					className={styles.toggleButton}
					onClick={() => setIsExpanded(!isExpanded)}
					aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'}
					title={isExpanded ? 'Collapse legend' : 'Expand legend'}>
					{isExpanded ? '−' : '+'}
				</button>
			</div>
			<div className={`${styles.items} ${isExpanded ? styles.expanded : styles.collapsed}`}>
				{LEGEND_DATA.map(item => (
					<div key={item.id} className={styles.item}>
						<LegendIcon type={item.type} size="small" />
						<span className={styles.label}>{item.label}</span>
					</div>
				))}
			</div>
		</div>
	)
}

