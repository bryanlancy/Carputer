'use client'

import { useState, useEffect, useCallback } from 'react'
import { parseISO } from 'date-fns'
import { useWebSocket, WebSocketMessage } from '../../hooks/useWebSocket'
import { NotificationPopup } from './NotificationPopup'
import { getApiUrl, authenticatedFetch } from '../../utils/api'
import styles from './NotificationPopupManager.module.scss'

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
	const offsetMatch = cleanTimestamp.match(/^(.+?)([+-]\d{2}:\d{2})$/)
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
		normalizedTimestamp = normalizedTimestamp.replace(
			/(\d{2}:\d{2})(\.\d+)?$/,
			'$1:00$2'
		)
	}
	return parseISO(normalizedTimestamp + 'Z')
}

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

interface PopupNotification {
	id: string
	notificationId: number | null // Original notification ID from backend (UserNotification.id)
	title: string
	message: string
	type: 'default' | 'warning' | 'alert' | 'success'
	timestamp: Date
}

export default function NotificationPopupManager() {
	const [popups, setPopups] = useState<PopupNotification[]>([])

	// Handle WebSocket messages for popup notifications
	const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
		if (message.type === 'notification' && message.notification) {
			// message.notification should be the actual notification object
			// Create a plain object copy to avoid issues with getters/setters or non-enumerable properties
			let notification = message.notification as any

			// If notification is actually the whole message (has 'notification' property), get the nested one
			if (
				notification &&
				typeof notification === 'object' &&
				'notification' in notification
			) {
				notification = notification.notification
			}

			// Create plain copy
			notification = JSON.parse(JSON.stringify(notification)) as any

			// Access show_popup property
			const showPopup =
				notification.show_popup ?? notification.showPopup ?? false

			// Only show popup if show_popup is true (check for boolean true or string 'true' or number 1)
			if (showPopup === true || showPopup === 'true' || showPopup === 1) {
				const rawMessage =
					notification.message ||
					notification.message_template ||
					''
				const createdAt = notification.created_at || ''

				const popupNotification: PopupNotification = {
					id: `${notification.id}-${Date.now()}`,
					notificationId: notification.id
						? Number(notification.id)
						: null,
					title: notification.name || 'Notification',
					// Convert UTC timestamps in message to local time
					message: convertTimestampsInMessage(rawMessage, createdAt),
					type: (notification.notification_type || 'default') as
						| 'default'
						| 'warning'
						| 'alert'
						| 'success',
					timestamp: notification.created_at
						? parseUTCTimestamp(notification.created_at)
						: new Date(),
				}

				setPopups(prev => [...prev, popupNotification])
			}
		}
	}, [])

	// Subscribe to WebSocket
	useWebSocket(handleWebSocketMessage, ['notifications'])

	const handleClose = useCallback((id: string) => {
		setPopups(prev => prev.filter(p => p.id !== id))
	}, [])

	const handleManualClose = useCallback(
		async (id: string, notificationId: number | null) => {
			// Mark notification as read if we have a notification ID
			// Note: We don't remove from state here - that's handled by onClose after animation
			if (notificationId !== null) {
				try {
					const apiUrl = getApiUrl()
					const response = await authenticatedFetch(
						`${apiUrl}/api/notifications/${notificationId}/view`,
						{
							method: 'POST',
						}
					)

					if (!response.ok) {
						console.error(
							'Failed to mark notification as read:',
							response.statusText
						)
					}
				} catch (error) {
					console.error('Error marking notification as read:', error)
				}
			}
		},
		[]
	)

	if (popups.length === 0) return null

	return (
		<div className={styles.container}>
			{popups.map((popup, index) => (
				<div key={popup.id} className={styles.popupWrapper}>
					<NotificationPopup
						notification={{
							id: popup.id,
							title: popup.title,
							message: popup.message,
							type: mapNotificationTypeToPopupType(popup.type),
							timestamp: popup.timestamp,
						}}
						onClose={() => handleClose(popup.id)}
						onManualClose={() =>
							handleManualClose(popup.id, popup.notificationId)
						}
					/>
				</div>
			))}
		</div>
	)
}

// Map notification_type to popup type
function mapNotificationTypeToPopupType(
	notificationType: 'default' | 'warning' | 'alert' | 'success'
): 'online' | 'offline' | 'info' | 'success' | 'warning' | 'error' {
	switch (notificationType) {
		case 'success':
			return 'success'
		case 'warning':
			return 'warning'
		case 'alert':
			return 'error'
		default:
			return 'info'
	}
}
