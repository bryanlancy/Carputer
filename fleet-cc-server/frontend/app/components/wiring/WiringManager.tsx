'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../../utils/api'
import WiringCanvas from './WiringCanvas'
import TriggerSidebar from './TriggerSidebar'
import ActionSidebar from './ActionSidebar'
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

interface WiringManagerProps {
	onUnauthorized?: () => void
}

export default function WiringManager({
	onUnauthorized,
}: WiringManagerProps = {}) {
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
	const [commands, setCommands] = useState<
		Array<{ value: string; label: string }>
	>([])
	const [notificationTypes, setNotificationTypes] = useState<
		Array<{
			id: number
			name: string
			variable_schema?: any
		}>
	>([])
	const [wiringConfig, setWiringConfig] =
		useState<WiringConfiguration | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [hasInvalidConnections, setHasInvalidConnections] = useState(false)
	const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
	const [newWorkspaceName, setNewWorkspaceName] = useState('')
	const nodesRef = useRef<Node[] | null>(null)
	const edgesRef = useRef<Edge[] | null>(null)
	const [hasPendingChanges, setHasPendingChanges] = useState(false)
	const [nodesWithChanges, setNodesWithChanges] = useState<Set<string>>(new Set())
	const [currentNodesForSidebar, setCurrentNodesForSidebar] = useState<Node[]>([])
	const savedConfigRef = useRef<WiringConfiguration | null>(null)

	useEffect(() => {
		loadWorkspaces()
		loadTriggers()
		loadEvents()
		loadMessages()
		loadCommands()
		loadNotificationTypes()
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
				// Deduplicate workspaces by name (keep the first occurrence)
				const uniqueWorkspaces = Array.from(
					new Map(data.map((w: Workspace) => [w.name, w])).values()
				)
				setWorkspaces(uniqueWorkspaces)
				if (uniqueWorkspaces.length > 0 && !selectedWorkspaceId) {
					setSelectedWorkspaceId(uniqueWorkspaces[0].id)
				}
			} else if (response.status === 403) {
				setError('You do not have permission to access wiring')
				onUnauthorized?.()
			} else if (response.status === 401) {
				setError('Authentication required')
				onUnauthorized?.()
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

	const loadCommands = async () => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/wiring/commands/list`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setCommands(data)
			}
		} catch (err: any) {
			console.error('Failed to load commands:', err)
		}
	}

	const loadNotificationTypes = async () => {
		try {
			const apiUrl = getApiUrl()
			const response = await authenticatedFetch(
				`${apiUrl}/api/admin/notifications`,
				{
					headers: {
						Authorization: `Bearer ${session?.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setNotificationTypes(
					data.map((nt: any) => ({
						id: nt.id,
						name: nt.name,
						variable_schema: nt.variable_schema,
					}))
				)
			}
		} catch (err: any) {
			console.error('Failed to load notification types:', err)
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
				const nodeConfig = data.wiring.node_config || {}
				// Merge node_config into each node's data.config
				const nodesWithConfig = (data.wiring.nodes || []).map((node: any) => {
					if (nodeConfig[node.id]) {
						return {
							...node,
							data: {
								...node.data,
								config: {
									...(node.data?.config || {}),
									...nodeConfig[node.id],
								},
							},
						}
					}
					return node
				})

				const config = {
					nodes: nodesWithConfig,
					edges: data.wiring.edges || [],
					viewport: data.wiring.viewport,
					node_config: nodeConfig,
				}
				setWiringConfig(config)
				savedConfigRef.current = config
				setHasPendingChanges(false)
				setNodesWithChanges(new Set())
				setCurrentNodesForSidebar(config.nodes || [])
				} else {
					// Start with empty config
					const config = {
						nodes: [],
						edges: [],
						viewport: null,
						node_config: null,
					}
					setWiringConfig(config)
					savedConfigRef.current = config
					setHasPendingChanges(false)
					setCurrentNodesForSidebar(config.nodes || [])
				}
			} else {
				// Start with empty config if no wiring exists
				const config = {
					nodes: [],
					edges: [],
					viewport: null,
					node_config: null,
				}
				setWiringConfig(config)
				savedConfigRef.current = config
				setHasPendingChanges(false)
				setNodesWithChanges(new Set())
				setCurrentNodesForSidebar(config.nodes || [])
			}
		} catch (err: any) {
			console.error('Failed to load wiring config:', err)
			// Start with empty config on error
			const config = {
				nodes: [],
				edges: [],
				viewport: null,
				node_config: null,
			}
			setWiringConfig(config)
			savedConfigRef.current = config
			setHasPendingChanges(false)
			setCurrentNodesForSidebar(config.nodes || [])
		}
	}

	const saveWiringConfig = async () => {
		if (!selectedWorkspaceId) {
			setError('Please select a workspace')
			return
		}

		if (hasInvalidConnections) {
			setError(
				'Cannot save: There are invalid connections. Please fix them before saving.'
			)
			return
		}

		setSaving(true)
		setError(null)
		setSuccess(null)

		try {
			const apiUrl = getApiUrl()

			// Get current nodes and edges from the canvas refs
			// Add a small delay to ensure refs are updated after any recent node changes
			// This is necessary because setNodes in React Flow is async
			await new Promise(resolve => setTimeout(resolve, 100))

			const nodes = nodesRef.current || wiringConfig?.nodes || []
			const edges = edgesRef.current || wiringConfig?.edges || []

			// Extract node_config from nodes (node-specific configurations like notification_id, message_code, command)
			const nodeConfig: Record<string, any> = {}
			nodes.forEach((node: any) => {
				if (node.data?.config && Object.keys(node.data.config).length > 0) {
					nodeConfig[node.id] = node.data.config
				}
			})

			const configToSave = {
				nodes,
				edges,
				viewport: wiringConfig?.viewport,
				node_config: Object.keys(nodeConfig).length > 0 ? nodeConfig : null,
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
				// Update saved config ref and clear pending changes
				savedConfigRef.current = configToSave
				setHasPendingChanges(false)
				// Reload to get the updated config from server
				await loadWiringConfig(selectedWorkspaceId)
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

	// Check if there are pending changes by comparing current state with saved state
	const checkForPendingChanges = useCallback(
		(currentNodes: Node[], currentEdges: Edge[]) => {
			const saved = savedConfigRef.current
			if (!saved) {
				setHasPendingChanges(false)
				setNodesWithChanges(new Set())
				return
			}

			// Extract current node_config
			const currentNodeConfig: Record<string, any> = {}
			currentNodes.forEach((node: any) => {
				if (node.data?.config && Object.keys(node.data.config).length > 0) {
					currentNodeConfig[node.id] = node.data.config
				}
			})

			// Create a map of saved nodes by ID for quick lookup
			const savedNodesMap = new Map(
				(saved.nodes || []).map((n: any) => [n.id, n])
			)

			// Track which nodes have changes
			const changedNodeIds = new Set<string>()

			// Check each current node for changes
			currentNodes.forEach((node: any) => {
				const savedNode = savedNodesMap.get(node.id)
				if (!savedNode) {
					// New node
					changedNodeIds.add(node.id)
				} else {
					// Check if position changed
					if (
						savedNode.position?.x !== node.position?.x ||
						savedNode.position?.y !== node.position?.y
					) {
						changedNodeIds.add(node.id)
					}
					// Check if config changed
					const savedConfig = saved.node_config?.[node.id] || {}
					const currentConfig = node.data?.config || {}
					if (JSON.stringify(savedConfig) !== JSON.stringify(currentConfig)) {
						changedNodeIds.add(node.id)
					}
				}
			})

			// Check for deleted nodes - compare by ID sets for more reliable detection
			const savedNodeIds = new Set((saved.nodes || []).map((n: any) => n.id))
			const currentNodeIds = new Set(currentNodes.map((n: any) => n.id))
			const nodesDeleted = savedNodeIds.size > currentNodeIds.size ||
				Array.from(savedNodeIds).some(id => !currentNodeIds.has(id))

			// Compare edges
			const edgesChanged =
				JSON.stringify(
					currentEdges.map(e => ({
						id: e.id,
						source: e.source,
						target: e.target,
						data: e.data,
					}))
				) !==
				JSON.stringify(
					(saved.edges || []).map((e: any) => ({
						id: e.id,
						source: e.source,
						target: e.target,
						data: e.data,
					}))
				)

			// If edges changed, mark all connected nodes as changed
			if (edgesChanged) {
				currentEdges.forEach(edge => {
					changedNodeIds.add(edge.source)
					changedNodeIds.add(edge.target)
				})
			}

		setNodesWithChanges(changedNodeIds)
		setHasPendingChanges(changedNodeIds.size > 0 || edgesChanged || nodesDeleted)
		},
		[]
	)

	const handleNodesChange = useCallback((nodes: Node[]) => {
		// Update nodes ref immediately for change detection
		nodesRef.current = nodes
		// Update state for TriggerSidebar to re-render and check used triggers
		setCurrentNodesForSidebar(nodes)
		// Don't update wiringConfig state here - it causes re-renders that trigger loops
		// The nodes are already tracked in nodesRef, and TriggerSidebar will read from state
		// Only check for pending changes
		checkForPendingChanges(nodes, edgesRef.current || [])
	}, [checkForPendingChanges])

	const handleEdgesChange = (edges: Edge[]) => {
		setWiringConfig(prev => ({
			...prev!,
			edges,
		}))
		checkForPendingChanges(nodesRef.current || [], edges)
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

			{selectedWorkspaceId && (
				<div className={styles.contentWrapper}>
					{error && <div className={styles.error}>{error}</div>}

					{success && <div className={styles.success}>{success}</div>}

					<div className={styles.wiringContainer}>
						<TriggerSidebar
							triggers={triggers}
							workspaceId={selectedWorkspaceId}
							currentNodes={currentNodesForSidebar}
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
									availableCommands:
										e.event_code === 'execute_command'
											? commands
											: undefined,
									availableNotificationTypes:
										e.event_code === 'show_notification'
											? notificationTypes
											: undefined,
								}))}
								initialNodes={wiringConfig?.nodes || nodesRef.current || []}
								initialEdges={wiringConfig?.edges || []}
								onNodesChange={handleNodesChange}
								onEdgesChange={handleEdgesChange}
								nodesRef={nodesRef}
								edgesRef={edgesRef}
								onValidationChange={setHasInvalidConnections}
								workspaceId={selectedWorkspaceId}
								nodesRefForTest={nodesRef}
								nodesWithChanges={nodesWithChanges}
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
						{hasInvalidConnections && (
							<div className={styles.error}>
								⚠️ Invalid connections detected. Please fix them
								before saving.
							</div>
						)}
						<button
							onClick={saveWiringConfig}
							disabled={saving || hasInvalidConnections || !hasPendingChanges}
							className={styles.saveButton}
							title={
								!hasPendingChanges
									? 'No changes to save'
									: hasInvalidConnections
									? 'Fix invalid connections before saving'
									: 'Save configuration'
							}>
							{saving ? 'Saving...' : 'Save Configuration'}
						</button>
					</div>
				</div>
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
