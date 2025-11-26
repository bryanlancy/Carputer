'use client'

import { useEffect } from 'react'
import styles from './NotificationPopup.module.scss'

interface NotificationPopupProps {
  notification: {
    id: string
    title: string
    message: string
    type: 'online' | 'offline' | 'info' | 'success' | 'warning' | 'error'
    timestamp: Date
  }
  onClose: () => void
}

const getIcon = (type: string): string => {
  switch (type) {
    case 'online':
    case 'success':
      return '✓'
    case 'offline':
    case 'error':
      return '✕'
    case 'warning':
      return '⚠'
    case 'info':
      return 'ℹ'
    default:
      return '•'
  }
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
        {getIcon(notification.type)}
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

