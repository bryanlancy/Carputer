'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'
import styles from './NotificationSettings.module.scss'

interface NotificationPreferences {
  id: number
  user_id: string
  auto_read: boolean
  enabled_notification_types: string[] | null
  urgency_filters: string[] | null
}

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const apiUrl = getApiUrl()
      const token = localStorage.getItem('auth_token') // Get token from your auth system

      if (!token) {
        // No token - use default preferences (user not logged in)
        setPreferences({
          id: 0,
          user_id: '',
          auto_read: false,
          enabled_notification_types: null,
          urgency_filters: null,
        } as NotificationPreferences)
        setLoading(false)
        return
      }

      const response = await fetch(`${apiUrl}/api/notifications/user/me/preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
      } else if (response.status === 401) {
        // Unauthorized - use default preferences (silently)
        setPreferences({
          id: 0,
          user_id: '',
          auto_read: false,
          enabled_notification_types: null,
          urgency_filters: null,
        } as NotificationPreferences)
      } else {
        // Failed to load - use default preferences
        setPreferences({
          id: 0,
          user_id: '',
          auto_read: false,
          enabled_notification_types: null,
          urgency_filters: null,
        } as NotificationPreferences)
      }
    } catch (error) {
      // Network error or other issue - use default preferences
      // On error, create default preferences object so UI can still render
      setPreferences({
        id: 0,
        user_id: '',
        auto_read: false,
        enabled_notification_types: null,
        urgency_filters: null,
      } as NotificationPreferences)
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      alert('Please log in to save preferences')
      return
    }

    if (!preferences) return

    setSaving(true)
    try {
      const apiUrl = getApiUrl()

      const response = await fetch(`${apiUrl}/api/notifications/user/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          auto_read: preferences.auto_read,
          enabled_notification_types: preferences.enabled_notification_types,
          urgency_filters: preferences.urgency_filters,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
        alert('Preferences saved successfully')
      } else if (response.status === 401) {
        alert('Please log in to save preferences')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Failed to save preferences: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('Error saving preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>
  }

  // Use default preferences if none loaded (for unauthenticated users)
  const displayPreferences = preferences || {
    id: 0,
    user_id: '',
    auto_read: false,
    enabled_notification_types: null,
    urgency_filters: null,
  } as NotificationPreferences

  return (
    <div className={styles.container}>
      <h2>Notification Preferences</h2>

      <div className={styles.section}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={displayPreferences.auto_read}
            onChange={(e) =>
              setPreferences({ ...displayPreferences, auto_read: e.target.checked })
            }
          />
          <div className={styles.labelContent}>
            <span className={styles.labelText}>Auto-read notifications</span>
            <p className={styles.helpText}>
              When enabled, notifications will be automatically marked as viewed and won't show popups,
              but will still appear in your notification history.
            </p>
          </div>
        </label>
      </div>

      <div className={styles.actions}>
        <button
          onClick={savePreferences}
          disabled={saving}
          className={styles.saveButton}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

