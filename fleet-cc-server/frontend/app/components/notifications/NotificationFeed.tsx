'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiUrl } from '../../utils/api'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { parseMarkdown } from '../../utils/markdown'
import { useWebSocket, WebSocketMessage } from '../../hooks/useWebSocket'
import styles from './NotificationFeed.module.scss'

// Helper function to convert UTC timestamps in message text to local time
// Finds time patterns like "HH:mm:ss" or "HH:mm" that appear to be UTC timestamps
// and converts them to local time format
function convertTimestampsInMessage(
	message: string,
	notificationCreatedAt: string
): string {
	if (!message || !notificationCreatedAt) {
		return message
	}

	// Parse the notification creation time to get the date context
	const baseDate = parseUTCTimestamp(notificationCreatedAt)

	// Pattern to match time strings like "20:27:30" or "20:27" (HH:mm:ss or HH:mm)
	// Only match times that look like they could be timestamps (hours 0-23, minutes 0-59)
	// This is a heuristic - we assume times in the message that match this pattern are UTC timestamps
	const timePattern = /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/g

	return message.replace(timePattern, (match, hours, minutes, seconds) => {
		try {
			// Create a UTC date with the time from the message
			const utcHours = parseInt(hours, 10)
			const utcMinutes = parseInt(minutes, 10)
			const utcSeconds = seconds ? parseInt(seconds, 10) : 0

			// Validate the time components
			if (
				utcHours < 0 ||
				utcHours > 23 ||
				utcMinutes < 0 ||
				utcMinutes > 59 ||
				(seconds && (utcSeconds < 0 || utcSeconds > 59))
			) {
				return match // Invalid time, return original
			}

			// Use the notification's date as the base, but with the time from the message
			const utcDate = new Date(
				Date.UTC(
					baseDate.getUTCFullYear(),
					baseDate.getUTCMonth(),
					baseDate.getUTCDate(),
					utcHours,
					utcMinutes,
					utcSeconds
				)
			)

			// Convert to local time and format
			const localDate = new Date(utcDate)
			const localHours = localDate.getHours().toString().padStart(2, '0')
			const localMinutes = localDate.getMinutes().toString().padStart(2, '0')
			const localSeconds = seconds
				? localDate.getSeconds().toString().padStart(2, '0')
				: ''

			return seconds
				? `${localHours}:${localMinutes}:${localSeconds}`
				: `${localHours}:${localMinutes}`
		} catch (error) {
			// If conversion fails, return original
			return match
		}
	})
}

// Helper function to parse UTC timestamps correctly
// Always treats the timestamp as UTC and converts to local time
function parseUTCTimestamp(timestamp: string | Date): Date {
	// If it's already a Date object, return it
	if (timestamp instanceof Date) {
		return timestamp
	}

	const cleanTimestamp = String(timestamp).trim()

	// If it already ends with Z, parseISO will handle it correctly
	if (cleanTimestamp.endsWith('Z')) {
		return parseISO(cleanTimestamp)
	}

	// If it has a timezone offset (like +05:00 or -05:00), parseISO will handle it
	// But we want to treat the base time as UTC, so we need to extract it
	const offsetMatch = cleanTimestamp.match(/^(.+?)([+-]\d{2}:\d{2})$/);
	if (offsetMatch) {
		// The timestamp has an offset - parseISO will convert it correctly
		// But we want to treat the original time as UTC, so remove offset and add Z
		return parseISO(offsetMatch[1] + 'Z')
	}

	// No timezone info - treat as UTC by appending Z
	// Handle format variations
	let normalizedTimestamp = cleanTimestamp
	if (!normalizedTimestamp.includes('T')) {
		normalizedTimestamp = normalizedTimestamp + 'T00:00:00'
	}
	// Ensure we have seconds
	if (!normalizedTimestamp.match(/\d{2}:\d{2}:\d{2}/)) {
		normalizedTimestamp = normalizedTimestamp.replace(/(\d{2}:\d{2})(\.\d+)?$/, '$1:00$2')
	}
	return parseISO(normalizedTimestamp + 'Z')
}

interface Tag {
	id: number
	name: string
	color?: string | null
	category?: string | null
	inherited?: boolean
}

interface Notification {
	id: number
	notification_id?: number
	name?: string
	title?: string
	message?: string | null
	message_template?: string | null
	notification_type?: 'default' | 'warning' | 'alert' | 'success' | string
	device: {
		id: number
		device_id: string
		hostname: string | null
	} | null
	viewed: boolean
	viewed_at: string | null
	created_at: string
	tags?: Tag[]
}

interface NotificationFeedProps {
	isOpen: boolean
	onClose: () => void
}

// Global state for unviewed count (shared across components)
let globalUnviewedCount = 0
const unviewedCountListeners = new Set<(count: number) => void>()

export function updateGlobalUnviewedCount(count: number) {
	globalUnviewedCount = count
	unviewedCountListeners.forEach(listener => listener(count))
}

export function getUnviewedCount() {
	return globalUnviewedCount
}

export default function NotificationFeed({
	isOpen,
	onClose,
}: NotificationFeedProps) {
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [loading, setLoading] = useState(true)
	const [unviewedCount, setUnviewedCount] = useState(0)
	const [hidingNotificationId, setHidingNotificationId] = useState<
		number | null
	>(null)
	const { session } = useAuth()
	const feedRef = useRef<HTMLDivElement>(null)

	// Handle WebSocket messages for real-time notifications
	const handleWebSocketMessage = useCallback(
		(message: WebSocketMessage) => {
			if (message.type === 'notification' && message.notification) {
				const newNotification = message.notification as Notification
				// Add new notification to the top of the list
				setNotifications(prev => {
					// Check if notification already exists
					const exists = prev.some(n => n.id === newNotification.id)
					if (exists) {
						return prev.map(n =>
							n.id === newNotification.id
								? { ...n, ...newNotification }
								: n
						)
					}
					return [newNotification, ...prev]
				})
				// Reload count from backend to ensure accuracy
				// This ensures we only count notifications that should appear in feed
				// (hidden: false, show_in_feed: true)
				if (session?.access_token) {
					loadUnviewedCount()
				}
			}
		},
		[session?.access_token]
	)

	// Subscribe to WebSocket
	const { connected } = useWebSocket(handleWebSocketMessage, [
		'notifications',
	])

	useEffect(() => {
		if (isOpen && session) {
			loadNotifications()
			loadUnviewedCount()
		}
	}, [isOpen, session])

	// Subscribe to global unviewed count updates
	useEffect(() => {
		const listener = (count: number) => setUnviewedCount(count)
		unviewedCountListeners.add(listener)
		setUnviewedCount(globalUnviewedCount)
		return () => {
			unviewedCountListeners.delete(listener)
		}
	}, [])

	// Close feed when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				feedRef.current &&
				!feedRef.current.contains(event.target as Node)
			) {
				onClose()
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
			return () =>
				document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen, onClose])

	const loadNotifications = async () => {
		if (!session?.access_token) return

		try {
			setLoading(true)
			const apiUrl = getApiUrl()
			const response = await fetch(
				`${apiUrl}/api/notifications/user/me/feed?limit=20`,
				{
					headers: {
						Authorization: `Bearer ${session.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				setNotifications(data)
			}
		} catch (error) {
			console.error('Error loading notifications:', error)
		} finally {
			setLoading(false)
		}
	}

	const loadUnviewedCount = async () => {
		if (!session?.access_token) return

		try {
			const apiUrl = getApiUrl()
			const response = await fetch(
				`${apiUrl}/api/notifications/user/me/unread-count`,
				{
					headers: {
						Authorization: `Bearer ${session.access_token}`,
					},
				}
			)

			if (response.ok) {
				const data = await response.json()
				const newCount = data.count || 0
				setUnviewedCount(newCount)
				updateGlobalUnviewedCount(newCount)
			}
		} catch (error) {
			console.error('Error loading unviewed count:', error)
		}
	}

	const markAsViewed = async (notificationId: number) => {
		if (!session?.access_token) return

		// Optimistically update UI immediately
		setNotifications(prev =>
			prev.map(n =>
				n.id === notificationId
					? {
							...n,
							viewed: true,
							viewed_at: new Date().toISOString(),
					  }
					: n
			)
		)
		const wasUnviewed = notifications.find(
			n => n.id === notificationId && !n.viewed
		)
		if (wasUnviewed) {
			const newCount = Math.max(0, unviewedCount - 1)
			setUnviewedCount(newCount)
			updateGlobalUnviewedCount(newCount)
		}

		try {
			const apiUrl = getApiUrl()
			await fetch(`${apiUrl}/api/notifications/${notificationId}/view`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			})

			// Reload count to ensure accuracy
			loadUnviewedCount()
		} catch (error) {
			console.error('Error marking notification as viewed:', error)
			// Revert optimistic update on error
			loadNotifications()
			loadUnviewedCount()
		}
	}

	const hideFromFeed = async (notificationId: number) => {
		if (!session?.access_token) return

		setHidingNotificationId(notificationId)

		// Check if notification was unviewed before hiding
		const notificationToHide = notifications.find(
			n => n.id === notificationId
		)
		const wasUnviewed = notificationToHide && !notificationToHide.viewed

		try {
			const apiUrl = getApiUrl()
			await fetch(
				`${apiUrl}/api/notifications/user/me/${notificationId}/hide`,
				{
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${session.access_token}`,
					},
				}
			)

			// Remove from local state immediately
			setNotifications(prev => prev.filter(n => n.id !== notificationId))

			// Decrement count if notification was unviewed
			if (wasUnviewed) {
				const newCount = Math.max(0, unviewedCount - 1)
				setUnviewedCount(newCount)
				updateGlobalUnviewedCount(newCount)
			}

			// Reload count to ensure accuracy
			loadUnviewedCount()
		} catch (error) {
			console.error('Error hiding notification:', error)
		} finally {
			setHidingNotificationId(null)
		}
	}

	if (!isOpen) return null

	return (
		<div className={styles.feedContainer} ref={feedRef}>
			<div className={styles.feedHeader}>
				<h3>Notifications</h3>
				<button onClick={onClose} className={styles.closeButton}>
					×
				</button>
			</div>

			<div className={styles.feedContent}>
				{loading ? (
					<div className={styles.loading}>
						Loading notifications...
					</div>
				) : notifications.length === 0 ? (
					<div className={styles.empty}>No notifications</div>
				) : (
					<div className={styles.notificationList}>
						{notifications.map((notification, index) => {
							const notificationType =
								(notification.notification_type ||
									'default') as
									| 'default'
									| 'warning'
									| 'alert'
									| 'success'
							const displayTitle =
								notification.title ||
								notification.name ||
								'Notification'
							// Use rendered message if available, otherwise fall back to template
							const displayMessage =
								notification.message ||
								notification.message_template ||
								null

							// Use a unique key combining id and index to handle potential duplicates
							const uniqueKey = notification.id
								? `notification-${notification.id}-${index}`
								: `notification-${index}-${Date.now()}`

							return (
								<div
									key={uniqueKey}
									className={`${styles.notificationItem} ${
										styles[
											`notificationType_${notificationType}`
										]
									} ${
										!notification.viewed
											? styles.unviewed
											: ''
									}`}>
									<div
										className={styles.notificationContent}
										onClick={() =>
											!notification.viewed &&
											markAsViewed(notification.id)
										}>
										<div
											className={
												styles.notificationHeader
											}>
											<span
												className={
													styles.notificationTitle
												}>
												{displayTitle}
											</span>
											<div
												className={
													styles.notificationBadges
												}>
												{!notification.viewed && (
													<span
														className={
															styles.unviewedBadge
														}>
														New
													</span>
												)}
												{notification.tags &&
													notification.tags.length >
														0 && (
														<div
															className={
																styles.tags
															}>
															{notification.tags.map(
																tag => (
																	<span
																		key={
																			tag.id
																		}
																		className={
																			styles.tag
																		}
																		style={
																			tag.color
																				? {
																						backgroundColor:
																							tag.color +
																							'20',
																						color: tag.color,
																						borderColor:
																							tag.color,
																				  }
																				: {}
																		}
																		title={
																			tag.inherited
																				? 'Inherited tag'
																				: ''
																		}>
																		{
																			tag.name
																		}
																	</span>
																)
															)}
														</div>
													)}
											</div>
										</div>
										{displayMessage && (
											<div
												className={
													styles.notificationMessage
												}
												dangerouslySetInnerHTML={{
													__html: parseMarkdown(
														convertTimestampsInMessage(
															displayMessage,
															notification.created_at
														)
													),
												}}
											/>
										)}
										<div
											className={styles.notificationMeta}>
											<span
												className={
													styles.notificationTime
												}
												title={
													notification.created_at
														? (() => {
																const date = parseUTCTimestamp(notification.created_at)
																return new Intl.DateTimeFormat(undefined, {
																	year: 'numeric',
																	month: 'numeric',
																	day: 'numeric',
																	hour: '2-digit',
																	minute: '2-digit',
																	second: '2-digit',
																	timeZoneName: 'short'
																}).format(date)
														  })()
														: undefined
												}>
												{notification.created_at
													? formatDistanceToNow(
															parseUTCTimestamp(notification.created_at),
															{ addSuffix: true }
													  )
													: 'Just now'}
											</span>
											{notification.device && (
												<span
													className={
														styles.deviceName
													}>
													{notification.device
														.hostname ||
														notification.device
															.device_id}
												</span>
											)}
										</div>
									</div>
									<button
										className={styles.deleteButton}
										onClick={e => {
											e.stopPropagation()
											hideFromFeed(notification.id)
										}}
										disabled={
											hidingNotificationId ===
											notification.id
										}
										title='Hide from feed'
										aria-label='Hide notification'>
										{hidingNotificationId ===
										notification.id
											? '⋯'
											: '×'}
									</button>
								</div>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}

// Export function to get unviewed count for navbar badge
export function useNotificationCount() {
	const [count, setCount] = useState(globalUnviewedCount)
	const { session } = useAuth()

	useEffect(() => {
		if (!session?.access_token) {
			setCount(0)
			updateGlobalUnviewedCount(0)
			return
		}

		let cancelled = false

		const loadCount = async () => {
			if (cancelled) return

			try {
				const apiUrl = getApiUrl()
				const response = await fetch(
					`${apiUrl}/api/notifications/user/me/unread-count`,
					{
						headers: {
							Authorization: `Bearer ${session.access_token}`,
						},
					}
				)

				if (cancelled) return

				if (response.ok) {
					const data = await response.json()
					const newCount = data.count || 0
					setCount(newCount)
					updateGlobalUnviewedCount(newCount)
				}
			} catch (error) {
				if (!cancelled) {
					console.error('Error loading notification count:', error)
				}
			}
		}

		loadCount()
		// Refresh count every 30 seconds (only if WebSocket is not connected)
		const interval = setInterval(loadCount, 30000)

		// Subscribe to global updates
		const listener = (newCount: number) => setCount(newCount)
		unviewedCountListeners.add(listener)

		return () => {
			cancelled = true
			clearInterval(interval)
			unviewedCountListeners.delete(listener)
		}
	}, [session?.access_token]) // Only depend on the access token, not the whole session object

	return count
}
