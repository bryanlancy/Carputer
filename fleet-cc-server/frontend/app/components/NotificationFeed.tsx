'use client'

import { useNotifications } from '../contexts/NotificationContext'
import { NotificationPopup } from './NotificationPopup'
import styles from './NotificationFeed.module.scss'

export function NotificationFeed() {
  const { notifications, removeNotification } = useNotifications()

  // Always render the container, even if empty, to ensure it's in the DOM
  return (
    <div className={styles.container} data-testid="notification-feed">
      {notifications.map((notification) => (
        <NotificationPopup
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

