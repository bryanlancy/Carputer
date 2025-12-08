'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '../../utils/api'
import styles from './page.module.scss'

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

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState<'types' | 'rules'>('types')
  const [types, setTypes] = useState<NotificationType[]>([])
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const token = localStorage.getItem('auth_token') // Get token from your auth system

      if (activeTab === 'types') {
        const response = await fetch(`${apiUrl}/api/admin/notifications/types`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
        })
        if (response.ok) {
          const data = await response.json()
          setTypes(data)
        }
      } else {
        const response = await fetch(`${apiUrl}/api/admin/notifications/rules`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
        })
        if (response.ok) {
          const data = await response.json()
          setRules(data)
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
      <h1>Notification Management</h1>

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
        <div>Loading...</div>
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
      <h2>Notification Types</h2>
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
      <h2>Notification Rules</h2>
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


