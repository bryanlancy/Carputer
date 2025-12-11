'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import TemplateEditor from '../admin/TemplateEditor'
import styles from './NotificationRuleManager.module.scss'

interface NotificationRule {
  id: number
  name: string
  description: string | null
  message_template?: string | null
  trigger_type: 'date_time' | 'backend_event' | 'user_driven'
  notification_type_code: string
  enabled: boolean
  priority: number
  trigger_config?: any
  target_users?: string[] | null
  target_roles?: string[] | null
}

interface NotificationType {
  type_code: string
  type_name: string
}

export default function NotificationRuleManager() {
  const { session } = useAuth()
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [types, setTypes] = useState<NotificationType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    message_template: '',
    trigger_type: 'backend_event' as 'date_time' | 'backend_event' | 'user_driven',
    notification_type_code: '',
    enabled: true,
    priority: 0,
    trigger_config: {} as any,
    target_users: [] as string[],
    target_roles: [] as string[],
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = getApiUrl()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const [rulesRes, typesRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/notifications/rules`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/admin/notifications`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json()
        setRules(rulesData)
      } else {
        setError(`Failed to load rules: ${rulesRes.statusText}`)
      }

      if (typesRes.ok) {
        const typesData = await typesRes.json()
        setTypes(typesData)
      }
    } catch (err: any) {
      setError(`Error loading data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Rule name is required')
      return
    }

    if (!formData.notification_type_code) {
      setError('Notification type is required')
      return
    }

    try {
      const apiUrl = getApiUrl()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const url = editingRule
        ? `${apiUrl}/api/admin/notifications/rules/${editingRule.id}`
        : `${apiUrl}/api/admin/notifications/rules`

      // Ensure trigger_config is always an object (not null or undefined)
      const triggerConfig = formData.trigger_config && typeof formData.trigger_config === 'object'
        ? formData.trigger_config
        : {}

      // Only include description if it has a value, otherwise omit it (undefined)
      const requestBody: any = {
        name: formData.name.trim(),
        trigger_type: formData.trigger_type,
        trigger_config: triggerConfig,
        notification_type_code: formData.notification_type_code,
        target_users: formData.target_users.length > 0 ? formData.target_users : null,
        target_roles: formData.target_roles.length > 0 ? formData.target_roles : null,
        enabled: formData.enabled,
        priority: Number(formData.priority) || 0,
      }

      // Only include description if it has a value
      if (formData.description && formData.description.trim()) {
        requestBody.description = formData.description.trim()
      }

      // Only include message_template if it has a value
      if (formData.message_template && formData.message_template.trim()) {
        requestBody.message_template = formData.message_template.trim()
      }

      console.log('Creating rule with data:', requestBody)

      const response = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        await loadData()
        setShowForm(false)
        setEditingRule(null)
        resetForm()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Rule creation error:', errorData)

        // Show validation errors if available
        let errorMessage = errorData.error || `Failed to ${editingRule ? 'update' : 'create'} notification rule`

        if (errorData.details && Array.isArray(errorData.details)) {
          const validationErrors = errorData.details.map((d: any) =>
            `${d.path}: ${d.message}`
          ).join(', ')
          errorMessage = `Validation error: ${validationErrors}`
        } else if (errorData.details) {
          errorMessage = `Validation error: ${JSON.stringify(errorData.details)}`
        }

        setError(errorMessage)
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const handleEdit = (rule: NotificationRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      message_template: rule.message_template || '',
      trigger_type: rule.trigger_type,
      notification_type_code: rule.notification_type_code,
      enabled: rule.enabled,
      priority: rule.priority,
      trigger_config: rule.trigger_config || {},
      target_users: rule.target_users || [],
      target_roles: rule.target_roles || [],
    })
    setShowForm(true)
  }

  const handleDelete = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this notification rule?')) {
      return
    }

    try {
      const apiUrl = getApiUrl()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch(`${apiUrl}/api/admin/notifications/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        await loadData()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(errorData.error || 'Failed to delete notification rule')
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      message_template: '',
      trigger_type: 'backend_event',
      notification_type_code: '',
      enabled: true,
      priority: 0,
      trigger_config: {},
      target_users: [],
      target_roles: [],
    })
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingRule(null)
    resetForm()
  }

  if (loading) {
    return <div className={styles.loading}>Loading notification rules...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <button
          onClick={() => {
            setEditingRule(null)
            resetForm()
            setShowForm(true)
          }}
          className={styles.addButton}
        >
          + Add New Rule
        </button>
      </div>

      {showForm && (
        <div className={styles.formOverlay}>
          <div className={styles.formContainer}>
            <h3>{editingRule ? 'Edit' : 'Create'} Notification Rule</h3>
            {error && (
              <div className={styles.formError}>
                {error}
                <button onClick={() => setError(null)} className={styles.dismissError}>×</button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>
                  Rule Name <span className={styles.required}>*</span>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Device Offline Alert"
                  />
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>
                  Description
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Optional description of this rule"
                  />
                </label>
              </div>

              <div className={styles.formGroup}>
                <TemplateEditor
                  value={formData.message_template || ''}
                  onChange={(value) => setFormData({ ...formData, message_template: value })}
                  triggerType={formData.trigger_type}
                />
              </div>

              <div className={styles.formGroup}>
                <label>
                  Trigger Type <span className={styles.required}>*</span>
                  <select
                    value={formData.trigger_type}
                    onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as any })}
                    required
                  >
                    <option value="backend_event">Backend Event</option>
                    <option value="date_time">Date/Time (Scheduled)</option>
                    <option value="user_driven">User Driven</option>
                  </select>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>
                  Notification Type <span className={styles.required}>*</span>
                  <select
                    value={formData.notification_type_code}
                    onChange={(e) => setFormData({ ...formData, notification_type_code: e.target.value })}
                    required
                  >
                    <option value="">Select a notification type</option>
                    {types.map((type) => (
                      <option key={type.type_code} value={type.type_code}>
                        {type.type_name} ({type.type_code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>
                  Priority
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                  <small>Higher numbers execute first (default: 0)</small>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.saveButton}>
                  {editingRule ? 'Update' : 'Create'} Rule
                </button>
                <button type="button" onClick={handleCancel} className={styles.cancelButton}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className={styles.empty}>
          <p>No notification rules found. Create your first rule to get started.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
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
                  <td>
                    <span className={styles.triggerType}>{rule.trigger_type}</span>
                  </td>
                  <td>{rule.notification_type_code}</td>
                  <td>{rule.priority}</td>
                  <td>
                    <span className={rule.enabled ? styles.enabled : styles.disabled}>
                      {rule.enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleEdit(rule)}
                      className={styles.editButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

