'use client'

import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'
import { useState } from 'react'
import styles from './EdgeWithTooltip.module.scss'

export default function EdgeWithTooltip({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style,
	data,
}: EdgeProps) {
	const [showTooltip, setShowTooltip] = useState(false)
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	})

	const validationError = data?.validationError

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={style}
				onMouseEnter={() => validationError && setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
			/>
			{showTooltip && validationError && (
				<g>
					<foreignObject
						x={labelX - 150}
						y={labelY - 40}
						width={300}
						height={80}
						className={styles.tooltipContainer}>
						<div className={styles.tooltip}>
							<div className={styles.tooltipHeader}>Invalid Connection</div>
							<div className={styles.tooltipContent}>{validationError}</div>
						</div>
					</foreignObject>
				</g>
			)}
		</>
	)
}

