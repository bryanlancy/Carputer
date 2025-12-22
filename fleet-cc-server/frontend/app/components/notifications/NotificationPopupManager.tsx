'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWebSocket, WebSocketMessage } from '../../hooks/useWebSocket'
import { NotificationPopup } from './NotificationPopup'
import styles from './NotificationPopupManager.module.scss'

interface PopupNotification {
	id: string
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
			if (notification && typeof notification === 'object' && 'notification' in notification) {
				notification = notification.notification
			}

			// Create plain copy
			notification = JSON.parse(JSON.stringify(notification)) as any

			// Access show_popup property
			const showPopup = notification.show_popup ?? notification.showPopup ?? false

			// Only show popup if show_popup is true (check for boolean true or string 'true' or number 1)
			if (showPopup === true || showPopup === 'true' || showPopup === 1) {
				const popupNotification: PopupNotification = {
					id: `${notification.id}-${Date.now()}`,
					title: notification.name || 'Notification',
					message:
						notification.message ||
						notification.message_template ||
						'',
					type: (notification.notification_type || 'default') as
						| 'default'
						| 'warning'
						| 'alert'
						| 'success',
					timestamp: new Date(notification.created_at || Date.now()),
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

	if (popups.length === 0) return null

	return (
		<div className={styles.container}>
			{popups.map((popup, index) => (
				<div
					key={popup.id}
					className={styles.popupWrapper}>
					<NotificationPopup
						notification={{
							id: popup.id,
							title: popup.title,
							message: popup.message,
							type: mapNotificationTypeToPopupType(popup.type),
							timestamp: popup.timestamp,
						}}
						onClose={() => handleClose(popup.id)}
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
