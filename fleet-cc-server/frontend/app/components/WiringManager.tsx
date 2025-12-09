'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../utils/api'
import WiringCanvas from './WiringCanvas'
import TriggerSidebar from './wiring/TriggerSidebar'
import ActionSidebar from './wiring/ActionSidebar'
import { Node, Edge } from 'reactflow'
import styles from './WiringManager.module.scss'

interface Workspace {
	id: number
	name: string
	description?: string | null
}

interface Trigger {
	id: number
	trigger_code: string
	trigger_name: string
	description?: string | null
	output_schema?: any
	enabled: boolean
}

interface Event {
	id: number
	event_code: string
	event_name: string
	description?: string | null
	input_schema?: any
	handler_type: string
	enabled: boolean
}

interface WiringConfiguration {
	nodes: any[]
	edges: any[]
	viewport?: any
}

export default function WiringManager() {
	const { session } = useAuth()
	const [workspaces, setWorkspaces] = useState<Workspace[]>([])
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<
		number | null
	>(null)
	const [triggers, setTriggers] = useState<Trigger[]>([])
	const [events, setEvents] = useState<Event[]>([])
	const [messages, setMessages] = useState<
		Array<{ id: number; message_code: string; message_name: string }>
	>([])
	const [wiringConfig, setWiringConfig] =
		useState<WiringConfiguration | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
	const [newWorkspaceName, setNewWorkspaceName] = useState('')
	const nodesRef = useRef<Node[] | null>(null)
	const edgesRef = useRef<Edge[] | null>(null)

	useEffect(() => {
		loadWorkspaces()
		loadTriggers()
		loadEvents()
		loadMessages()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (selectedWorkspaceId) {
			loadWiringConfig(selectedWorkspaceId)
		} else {
			setWiringConfig(null)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedWorkspaceId])

	const loadWorkspaces = async () => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/workspaces`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setWorkspaces(data)
				if (data.length > 0 && !selectedWorkspaceId) {
					setSelectedWorkspaceId(data[0].id)
				}
			}
		} catch (err: any) {
			console.error('Failed to load workspaces:', err)
			setError('Failed to load workspaces')
		} finally {
			setLoading(false)
		}
	}

	const createWorkspace = async () => {
		if (!newWorkspaceName.trim()) {
			setError('Workspace name is required')
			return
		}

		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/workspaces`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session?.access_token}`,
					},
					body: JSON.stringify({
						name: newWorkspaceName.trim(),
						description: '',
					}),
				}
			)

			if (response.ok) {
				const workspace = await response.json()
				setNewWorkspaceName('')
				setShowCreateWorkspace(false)
				await loadWorkspaces()
				setSelectedWorkspaceId(workspace.id)
			} else {
				const errorData = await response.json()
				setError(errorData.error || 'Failed to create workspace')
			}
		} catch (err: any) {
			console.error('Failed to create workspace:', err)
			setError('Failed to create workspace')
		}
	}

	const loadTriggers = async () => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/triggers`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setTriggers(data)
			}
		} catch (err: any) {
			console.error('Failed to load triggers:', err)
		}
	}

	const loadEvents = async () => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/events`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setEvents(data)
			}
		} catch (err: any) {
			console.error('Failed to load events:', err)
		}
	}

	const loadMessages = async () => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/messages?enabled=true&message_type=email`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setMessages(
					data.map((m: any) => ({
						id: m.id,
						message_code: m.message_code,
						message_name: m.message_name,
					}))
				)
			}
		} catch (err: any) {
			console.error('Failed to load messages:', err)
		}
	}

	const loadWiringConfig = async (workspaceId: number) => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/wiring/${workspaceId}`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				if (data.wiring) {
					setWiringConfig({
						nodes: data.wiring.nodes || [],
						edges: data.wiring.edges || [],
						viewport: data.wiring.viewport,
					})
				} else {
					// Start with empty config
					setWiringConfig({
						nodes: [],
						edges: [],
						viewport: null,
					})
				}
			} else {
				// Start with empty config if no wiring exists
				setWiringConfig({
					nodes: [],
					edges: [],
					viewport: null,
				})
			}
		} catch (err: any) {
			console.error('Failed to load wiring config:', err)
			// Start with empty config on error
			setWiringConfig({
				nodes: [],
				edges: [],
				viewport: null,
			})
		}
	}

	const saveWiringConfig = async () => {
		if (!selectedWorkspaceId) {
			setError('Please select a workspace')
			return
		}

		setSaving(true)
		setError(null)
		setSuccess(null)

		try {
			const apiUrl = getApiUrl()

			// Get current nodes and edges from the canvas refs
			const configToSave = {
				nodes: nodesRef.current || wiringConfig?.nodes || [],
				edges: edgesRef.current || wiringConfig?.edges || [],
				viewport: wiringConfig?.viewport,
			}

			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/wiring/${selectedWorkspaceId}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${session?.access_token}`,
					},
					body: JSON.stringify(configToSave),
				}
			)

			if (response.ok) {
				setSuccess('Wiring configuration saved successfully')
				setTimeout(() => setSuccess(null), 3000)
			} else {
				const errorData = await response.json()
				setError(
					errorData.error || 'Failed to save wiring configuration'
				)
			}
		} catch (err: any) {
			console.error('Failed to save wiring config:', err)
			setError('Failed to save wiring configuration')
		} finally {
			setSaving(false)
		}
	}

	const handleNodesChange = (nodes: Node[]) => {
		setWiringConfig(prev => ({
			...prev!,
			nodes,
		}))
	}

	const handleEdgesChange = (edges: Edge[]) => {
		setWiringConfig(prev => ({
			...prev!,
			edges,
		}))
	}

	if (loading) {
		return <div className={styles.loading}>Loading...</div>
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2>Wiring Configuration</h2>
				<p className={styles.description}>
					Connect triggers to events by dragging connections between
					nodes. Triggers emit data that events consume.
				</p>
			</div>

			<div className={styles.workspaceSelector}>
				<label htmlFor='workspace-select'>Workspace:</label>
				<select
					id='workspace-select'
					value={selectedWorkspaceId || ''}
					onChange={e =>
						setSelectedWorkspaceId(
							e.target.value ? parseInt(e.target.value) : null
						)
					}
					className={styles.select}>
					<option value=''>Select a workspace...</option>
					{workspaces.map(workspace => (
						<option key={workspace.id} value={workspace.id}>
							{workspace.name}
						</option>
					))}
				</select>
				<button
					onClick={() => setShowCreateWorkspace(true)}
					className={styles.createButton}>
					+ New Workspace
				</button>
			</div>

			{showCreateWorkspace && (
				<div className={styles.createWorkspaceForm}>
					<h3>Create New Workspace</h3>
					<input
						type='text'
						value={newWorkspaceName}
						onChange={e => setNewWorkspaceName(e.target.value)}
						placeholder='Workspace name'
						className={styles.workspaceInput}
						onKeyPress={e => {
							if (e.key === 'Enter') {
								createWorkspace()
							}
						}}
					/>
					<div className={styles.createActions}>
						<button
							onClick={createWorkspace}
							className={styles.saveButton}>
							Create
						</button>
						<button
							onClick={() => {
								setShowCreateWorkspace(false)
								setNewWorkspaceName('')
							}}
							className={styles.cancelButton}>
							Cancel
						</button>
					</div>
				</div>
			)}

			{error && <div className={styles.error}>{error}</div>}

			{success && <div className={styles.success}>{success}</div>}

			{selectedWorkspaceId && (
				<>
					<div className={styles.wiringContainer}>
						<TriggerSidebar
							triggers={triggers}
							onDragStart={(trigger, event) => {
								// Store trigger data in drag event
								event.dataTransfer.setData(
									'application/reactflow-trigger',
									JSON.stringify(trigger)
								)
								event.dataTransfer.effectAllowed = 'move'
							}}
						/>
						<div className={styles.canvasContainer}>
							<WiringCanvas
								triggers={triggers}
								events={events.map(e => ({
									...e,
									availableMessages:
										e.event_code === 'send_email'
											? messages
											: undefined,
								}))}
								initialNodes={wiringConfig?.nodes || []}
								initialEdges={wiringConfig?.edges || []}
								onNodesChange={handleNodesChange}
								onEdgesChange={handleEdgesChange}
								nodesRef={nodesRef}
								edgesRef={edgesRef}
							/>
						</div>
						<ActionSidebar
							actions={events}
							onDragStart={(action, event) => {
								// Store action data in drag event
								event.dataTransfer.setData(
									'application/reactflow-action',
									JSON.stringify(action)
								)
								event.dataTransfer.effectAllowed = 'move'
							}}
						/>
					</div>

					<div className={styles.actions}>
						<button
							onClick={saveWiringConfig}
							disabled={saving}
							className={styles.saveButton}>
							{saving ? 'Saving...' : 'Save Configuration'}
						</button>
					</div>
				</>
			)}

			{!selectedWorkspaceId && (
				<div className={styles.emptyState}>
					<p>
						Please select or create a workspace to configure wiring.
					</p>
				</div>
			)}
		</div>
	)
}
