'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import { formatDistanceToNow } from 'date-fns'
import styles from './NotificationFeed.module.scss'

interface Notification {
  id: number
  title: string
  message: string | null
  notification_type: {
    type_code: string
    type_name: string
    severity: string
  }
  device: {
    id: number
    device_id: string
    hostname: string | null
  } | null
  viewed: boolean
  viewed_at: string | null
  created_at: string
}

interface NotificationFeedProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotificationFeed({ isOpen, onClose }: NotificationFeedProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unviewedCount, setUnviewedCount] = useState(0)
  const { session } = useAuth()
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && session) {
      loadNotifications()
      loadUnviewedCount()
    }
  }, [isOpen, session])

  // Close feed when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (feedRef.current && !feedRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const loadNotifications = async () => {
    if (!session?.access_token) return

    try {
      setLoading(true)
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/notifications/user/me/feed?limit=20`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

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
      const response = await fetch(`${apiUrl}/api/notifications/user/me/unread-count`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUnviewedCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error loading unviewed count:', error)
    }
  }

  const markAsViewed = async (notificationId: number) => {
    if (!session?.access_token) return

    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/api/notifications/${notificationId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, viewed: true, viewed_at: new Date().toISOString() } : n
        )
      )
      setUnviewedCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as viewed:', error)
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
          <div className={styles.loading}>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>No notifications</div>
        ) : (
          <div className={styles.notificationList}>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`${styles.notificationItem} ${!notification.viewed ? styles.unviewed : ''}`}
                onClick={() => !notification.viewed && markAsViewed(notification.id)}
              >
                <div className={styles.notificationHeader}>
                  <span className={styles.notificationTitle}>{notification.title}</span>
                  {!notification.viewed && <span className={styles.unviewedBadge}>New</span>}
                </div>
                {notification.message && (
                  <div className={styles.notificationMessage}>{notification.message}</div>
                )}
                <div className={styles.notificationMeta}>
                  <span className={styles.notificationTime}>
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                  {notification.device && (
                    <span className={styles.deviceName}>{notification.device.hostname || notification.device.device_id}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Export function to get unviewed count for navbar badge
export function useNotificationCount() {
  const [count, setCount] = useState(0)
  const { session } = useAuth()

  useEffect(() => {
    if (!session?.access_token) {
      setCount(0)
      return
    }

    const loadCount = async () => {
      try {
        const apiUrl = getApiUrl()
        const response = await fetch(`${apiUrl}/api/notifications/user/me/unread-count`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setCount(data.count || 0)
        }
      } catch (error) {
        console.error('Error loading notification count:', error)
      }
    }

    loadCount()
    // Refresh count every 30 seconds
    const interval = setInterval(loadCount, 30000)
    return () => clearInterval(interval)
  }, [session])

  return count
}
