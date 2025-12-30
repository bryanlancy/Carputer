'use client'

import { useState, useEffect } from 'react'
import { parseISO } from 'date-fns'
import { getApiUrl } from '../utils/api'
import styles from './page.module.scss'

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

interface UserNotification {
  id: number
  title: string
  message: string | null
  viewed: boolean
  viewed_at: Date | null
  created_at: Date
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
}

export default function NotificationsHistoryPage() {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unviewedOnly, setUnviewedOnly] = useState(false)

  useEffect(() => {
    loadNotifications()
  }, [unviewedOnly])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const token = localStorage.getItem('auth_token') // Get token from your auth system

      const params = new URLSearchParams()
      if (unviewedOnly) {
        params.append('unviewedOnly', 'true')
      }

      const response = await fetch(
        `${apiUrl}/api/notifications/user/me?${params.toString()}`,
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
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

  const markAsViewed = async (notificationId: number) => {
    try {
      const apiUrl = getApiUrl()
      const token = localStorage.getItem('auth_token')

      const response = await fetch(
        `${apiUrl}/api/notifications/${notificationId}/view`,
        {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
        }
      )

      if (response.ok) {
        loadNotifications()
      }
    } catch (error) {
      console.error('Error marking notification as viewed:', error)
    }
  }

  const markAllAsViewed = async () => {
    try {
      const apiUrl = getApiUrl()
      const token = localStorage.getItem('auth_token')

      const response = await fetch(`${apiUrl}/api/notifications/user/me/view-all`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      })

      if (response.ok) {
        loadNotifications()
      }
    } catch (error) {
      console.error('Error marking all as viewed:', error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Notification History</h1>
        <div className={styles.actions}>
          <label>
            <input
              type="checkbox"
              checked={unviewedOnly}
              onChange={(e) => setUnviewedOnly(e.target.checked)}
            />
            Unviewed only
          </label>
          <button onClick={markAllAsViewed}>Mark all as viewed</button>
        </div>
      </div>

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.empty}>No notifications</div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${styles.notification} ${
                !notification.viewed ? styles.unviewed : ''
              }`}
            >
              <div className={styles.content}>
                <div className={styles.headerRow}>
                  <h3>{notification.title}</h3>
                  {!notification.viewed && (
                    <span className={styles.badge}>New</span>
                  )}
                </div>
                {notification.message && (
                  <p className={styles.message}>{notification.message}</p>
                )}
                <div className={styles.meta}>
                  <span className={styles.type}>
                    {notification.notification_type.type_name}
                  </span>
                  {notification.device && (
                    <span className={styles.device}>
                      Device: {notification.device.hostname || notification.device.device_id}
                    </span>
                  )}
                  <span className={styles.date}>
                    {(() => {
                      const timestamp = String(notification.created_at)
                      const date = parseUTCTimestamp(timestamp)
                      // Use Intl.DateTimeFormat for explicit timezone handling
                      return new Intl.DateTimeFormat(undefined, {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                      }).format(date)
                    })()}
                  </span>
                </div>
              </div>
              {!notification.viewed && (
                <button
                  className={styles.viewButton}
                  onClick={() => markAsViewed(notification.id)}
                >
                  Mark as viewed
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}


