'use client'

import React, { useState } from 'react'
import { extractDataTypes } from '../../utils/dataTypeExtractor'
import { DataTypeIcons } from '../../utils/dataTypeIcons'
import styles from './ActionSidebar.module.scss'

interface Action {
	id: number
	event_code: string
	event_name: string
	description?: string | null
	input_schema?: any
	handler_type: string
	enabled: boolean
}

interface ActionSidebarProps {
	actions: Action[]
	onDragStart: (action: Action, event: React.DragEvent) => void
}

export default function ActionSidebar({
	actions,
	onDragStart,
}: ActionSidebarProps) {
	const [collapsed, setCollapsed] = useState(false)
	const enabledActions = actions.filter(a => a.enabled)

	return (
		<div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
			<div className={styles.header}>
				<div className={styles.headerContent}>
					<h3>Actions</h3>
					<button
						onClick={() => setCollapsed(!collapsed)}
						className={styles.collapseButton}
						title={collapsed ? 'Expand' : 'Collapse'}
						aria-label={collapsed ? 'Expand' : 'Collapse'}>
						{collapsed ? '◀' : '▶'}
					</button>
				</div>
				{!collapsed && (
					<p className={styles.description}>Drag actions to the canvas</p>
				)}
			</div>
			{!collapsed && (
				<div className={styles.list}>
				{enabledActions.length === 0 ? (
					<div className={styles.empty}>No actions available</div>
				) : (
					enabledActions.map(action => {
						// Check if action has variable data types
						const hasVariableTypes =
							action.event_code === 'show_notification' ||
							action.event_code === 'send_email' ||
							action.event_code === 'execute_command'

						const dataTypes = action.input_schema
							? extractDataTypes(action.input_schema)
							: []

						return (
							<div
								key={action.id}
								className={styles.actionItem}
								draggable
								onDragStart={e => onDragStart(action, e)}>
								<div className={styles.actionHeader}>
									<span className={styles.icon}>🎯</span>
									<span className={styles.name}>
										{action.event_name}
									</span>
								</div>
								{action.description && (
									<div className={styles.description}>
										{action.description}
									</div>
								)}
								<div className={styles.handlerType}>
									{action.handler_type}
								</div>
								<div className={styles.dataTypes}>
									{hasVariableTypes ? (
										<span
											className={styles.variableIndicator}
											title='Data types may vary based on configuration'>
											Variable
										</span>
									) : (
										<DataTypeIcons
											types={dataTypes}
											size='small'
										/>
									)}
								</div>
								<div className={styles.code}>
									{action.event_code}
								</div>
							</div>
						)
					})
				)}
				</div>
			)}
		</div>
	)
}
