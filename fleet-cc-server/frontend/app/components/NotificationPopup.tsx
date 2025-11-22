'use client'

import { useEffect } from 'react'
import styles from './NotificationPopup.module.scss'

interface NotificationPopupProps {
  notification: {
    id: string
    title: string
    message: string
    type: 'online' | 'offline'
    timestamp: Date
  }
  onClose: () => void
}

export function NotificationPopup({ notification, onClose }: NotificationPopupProps) {
  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`${styles.notification} ${styles[notification.type]}`}>
      <div className={styles.icon}>
        {notification.type === 'online' ? '✓' : '⚠'}
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{notification.title}</div>
        <div className={styles.message}>{notification.message}</div>
      </div>
      <button className={styles.close} onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}

