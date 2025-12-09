'use client'

import React from 'react'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import styles from './TriggerSidebar.module.scss'

interface Trigger {
	id: number
	trigger_code: string
	trigger_name: string
	description?: string | null
	output_schema?: any
	enabled: boolean
}

interface TriggerSidebarProps {
	triggers: Trigger[]
	onDragStart: (trigger: Trigger, event: React.DragEvent) => void
}

export default function TriggerSidebar({
	triggers,
	onDragStart,
}: TriggerSidebarProps) {
	const enabledTriggers = triggers.filter(t => t.enabled)

	return (
		<div className={styles.sidebar}>
			<div className={styles.header}>
				<h3>Triggers</h3>
				<p className={styles.description}>
					Drag triggers to the canvas
				</p>
			</div>
			<div className={styles.list}>
				{enabledTriggers.length === 0 ? (
					<div className={styles.empty}>No triggers available</div>
				) : (
					enabledTriggers.map(trigger => {
						const dataTypes = trigger.output_schema
							? extractDataTypes(trigger.output_schema)
							: []
						return (
							<div
								key={trigger.id}
								className={styles.triggerItem}
								draggable
								onDragStart={e => onDragStart(trigger, e)}>
								<div className={styles.triggerHeader}>
									<span className={styles.icon}>⚡</span>
									<span className={styles.name}>
										{trigger.trigger_name}
									</span>
								</div>
								{trigger.description && (
									<div className={styles.description}>
										{trigger.description}
									</div>
								)}
								<div className={styles.dataTypes}>
									<DataTypeIcons
										types={dataTypes}
										size='small'
									/>
								</div>
								<div className={styles.code}>
									{trigger.trigger_code}
								</div>
							</div>
						)
					})
				)}
			</div>
		</div>
	)
}
