'use client'

import { useNotifications } from '../contexts/NotificationContext'
import { NotificationPopup } from './NotificationPopup'
import styles from './NotificationFeed.module.scss'

export function NotificationFeed() {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
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

