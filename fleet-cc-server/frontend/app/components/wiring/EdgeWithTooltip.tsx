'use client'

import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'
import { useState } from 'react'
import { DataType } from '../../utils/dataTypeExtractor'
import LegendIcon from './LegendIcon'
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
	const dataTypes = (data?.dataTypes as DataType[]) || []

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={style}
				onMouseEnter={() => validationError && setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
			/>
			{/* Data type icons at edge center */}
			{dataTypes.length > 0 && (
				<g>
					<foreignObject
						x={labelX - (dataTypes.length * 18 + (dataTypes.length - 1) * 4) / 2}
						y={labelY - 50}
						width={dataTypes.length * 18 + (dataTypes.length - 1) * 4}
						height={60}
						className={styles.labelContainer}>
						<div className={styles.labelIcons}>
							{dataTypes.map((type, index) => (
								<LegendIcon
									key={index}
									type={type}
									size="small"
									className={styles.edgeIcon}
								/>
							))}
						</div>
					</foreignObject>
				</g>
			)}
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

