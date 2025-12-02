'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '../utils/api'
import styles from './AdminNotificationSettings.module.scss'

interface NotificationType {
  id: number
  type_code: string
  type_name: string
  description: string | null
  severity: 'info' | 'warning' | 'error' | 'critical'
  enabled: boolean
}

interface NotificationRule {
  id: number
  name: string
  description: string | null
  trigger_type: 'date_time' | 'backend_event' | 'user_driven'
  notification_type_code: string
  enabled: boolean
  priority: number
}

export default function AdminNotificationSettings() {
  const [activeTab, setActiveTab] = useState<'types' | 'rules'>('types')
  const [types, setTypes] = useState<NotificationType[]>([])
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only load data if we have a token
    const token = localStorage.getItem('auth_token')
    if (token) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const token = localStorage.getItem('auth_token')

      if (!token) {
        console.error('No auth token found')
        setLoading(false)
        return
      }

      if (activeTab === 'types') {
        const response = await fetch(`${apiUrl}/api/admin/notifications/types`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setTypes(data)
        } else if (response.status === 401 || response.status === 403) {
          console.error('Unauthorized access to admin endpoints')
        }
      } else {
        const response = await fetch(`${apiUrl}/api/admin/notifications/rules`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setRules(data)
        } else if (response.status === 401 || response.status === 403) {
          console.error('Unauthorized access to admin endpoints')
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h2>Notification Management</h2>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'types' ? styles.active : ''}
          onClick={() => setActiveTab('types')}
        >
          Notification Types
        </button>
        <button
          className={activeTab === 'rules' ? styles.active : ''}
          onClick={() => setActiveTab('rules')}
        >
          Notification Rules
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : activeTab === 'types' ? (
        <NotificationTypesList types={types} onUpdate={loadData} />
      ) : (
        <NotificationRulesList rules={rules} onUpdate={loadData} />
      )}
    </div>
  )
}

function NotificationTypesList({
  types,
  onUpdate,
}: {
  types: NotificationType[]
  onUpdate: () => void
}) {
  return (
    <div className={styles.list}>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Severity</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type.id}>
              <td>{type.type_code}</td>
              <td>{type.type_name}</td>
              <td>{type.severity}</td>
              <td>{type.enabled ? 'Yes' : 'No'}</td>
              <td>
                <button>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NotificationRulesList({
  rules,
  onUpdate,
}: {
  rules: NotificationRule[]
  onUpdate: () => void
}) {
  return (
    <div className={styles.list}>
      <button className={styles.addButton}>Add New Rule</button>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Trigger Type</th>
            <th>Notification Type</th>
            <th>Priority</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{rule.trigger_type}</td>
              <td>{rule.notification_type_code}</td>
              <td>{rule.priority}</td>
              <td>{rule.enabled ? 'Yes' : 'No'}</td>
              <td>
                <button>Edit</button>
                <button>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

