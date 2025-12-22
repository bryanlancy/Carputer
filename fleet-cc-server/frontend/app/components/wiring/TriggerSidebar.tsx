'use client'

import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
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
	workspaceId?: number | null
}

export default function TriggerSidebar({
	triggers,
	onDragStart,
	workspaceId,
}: TriggerSidebarProps) {
	const { session } = useAuth()
	const [testingTriggerId, setTestingTriggerId] = useState<number | null>(null)
	const [testResult, setTestResult] = useState<string | null>(null)
	const [collapsed, setCollapsed] = useState(false)
	const enabledTriggers = triggers.filter(t => t.enabled)

	const handleTest = async (triggerId: number) => {
		if (!workspaceId) {
			setTestResult('Please select a workspace first')
			return
		}

		setTestingTriggerId(triggerId)
		setTestResult(null)

		try {
			const apiUrl = getApiUrl()
			const token = session?.access_token

			if (!token) {
				setTestResult('Authentication required')
				return
			}

			const response = await fetch(
				`${apiUrl}/api/admin/wiring/${workspaceId}/triggers/${triggerId}/test`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				const successCount = data.executedEvents?.filter(
					(e: any) => e.success
				).length || 0
				const totalCount = data.executedEvents?.length || 0
				setTestResult(
					`Test completed: ${successCount}/${totalCount} actions executed successfully`
				)
				// Clear result after 5 seconds
				setTimeout(() => setTestResult(null), 5000)
			} else {
				const errorData = await response.json().catch(() => ({
					error: 'Failed to test trigger',
				}))
				setTestResult(errorData.error || 'Failed to test trigger')
			}
		} catch (err: any) {
			setTestResult(`Error: ${err.message}`)
		} finally {
			setTestingTriggerId(null)
		}
	}

	return (
		<div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
			<div className={styles.header}>
				<div className={styles.headerContent}>
					<h3>Triggers</h3>
					<button
						onClick={() => setCollapsed(!collapsed)}
						className={styles.collapseButton}
						title={collapsed ? 'Expand' : 'Collapse'}
						aria-label={collapsed ? 'Expand' : 'Collapse'}>
						{collapsed ? '▶' : '◀'}
					</button>
				</div>
				{!collapsed && (
					<p className={styles.description}>
						Drag triggers to the canvas
					</p>
				)}
			</div>
			{!collapsed && (
				<>
					{testResult && (
						<div className={styles.testResult}>
							{testResult}
							<button
								onClick={() => setTestResult(null)}
								className={styles.dismissResult}>
								×
							</button>
						</div>
					)}
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
				</>
			)}
		</div>
	)
}
