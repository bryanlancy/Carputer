'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../utils/api'
import styles from './NotificationTypeManager.module.scss'

interface NotificationType {
  id: number
  type_code: string
  type_name: string
  description: string | null
  severity: 'info' | 'warning' | 'error' | 'critical'
  enabled: boolean
}

export default function NotificationTypeManager() {
  const { session } = useAuth()
  const [types, setTypes] = useState<NotificationType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingType, setEditingType] = useState<NotificationType | null>(null)
  const [formData, setFormData] = useState({
    type_code: '',
    type_name: '',
    description: '',
    severity: 'info' as 'info' | 'warning' | 'error' | 'critical',
    enabled: true,
  })

  useEffect(() => {
    loadTypes()
  }, [])

  const loadTypes = async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = getApiUrl()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch(`${apiUrl}/api/admin/notifications/types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTypes(data)
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized. Please check your permissions.')
      } else {
        setError(`Failed to load notification types: ${response.statusText}`)
      }
    } catch (err: any) {
      setError(`Error loading notification types: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      const apiUrl = getApiUrl()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const url = editingType
        ? `${apiUrl}/api/admin/notifications/types/${editingType.type_code}`
        : `${apiUrl}/api/admin/notifications/types`

      const response = await fetch(url, {
        method: editingType ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type_code: formData.type_code,
          type_name: formData.type_name,
          ...(formData.description && formData.description.trim() ? { description: formData.description.trim() } : {}),
          severity: formData.severity,
          enabled: formData.enabled,
        }),
      })

      if (response.ok) {
        await loadTypes()
        setShowForm(false)
        setEditingType(null)
        setFormData({
          type_code: '',
          type_name: '',
          description: '',
          severity: 'info',
          enabled: true,
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(errorData.error || `Failed to ${editingType ? 'update' : 'create'} notification type`)
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const handleEdit = (type: NotificationType) => {
    setEditingType(type)
    setFormData({
      type_code: type.type_code,
      type_name: type.type_name,
      description: type.description || '',
      severity: type.severity,
      enabled: type.enabled,
    })
    setShowForm(true)
  }

  const handleDelete = async (typeCode: string) => {
    if (!confirm(`Are you sure you want to delete notification type "${typeCode}"?`)) {
      return
    }

    try {
      const apiUrl = getApiUrl()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch(`${apiUrl}/api/admin/notifications/types/${typeCode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        await loadTypes()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(errorData.error || 'Failed to delete notification type')
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingType(null)
    setFormData({
      type_code: '',
      type_name: '',
      description: '',
      severity: 'info',
      enabled: true,
    })
  }

  if (loading) {
    return <div className={styles.loading}>Loading notification types...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <button
          onClick={() => {
            setEditingType(null)
            setFormData({
              type_code: '',
              type_name: '',
              description: '',
              severity: 'info',
              enabled: true,
            })
            setShowForm(true)
          }}
          className={styles.addButton}
        >
          + Add New Type
        </button>
      </div>

      {showForm && (
        <div className={styles.formOverlay}>
          <div className={styles.formContainer}>
            <h3>{editingType ? 'Edit' : 'Create'} Notification Type</h3>
            {error && (
              <div className={styles.formError}>
                {error}
                <button onClick={() => setError(null)} className={styles.dismissError}>×</button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>
                  Type Code <span className={styles.required}>*</span>
                  <input
                    type="text"
                    value={formData.type_code}
                    onChange={(e) => setFormData({ ...formData, type_code: e.target.value })}
                    required
                    disabled={!!editingType}
                    placeholder="e.g., device.online"
                  />
                  <small>Unique identifier (cannot be changed after creation)</small>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>
                  Type Name <span className={styles.required}>*</span>
                  <input
                    type="text"
                    value={formData.type_name}
                    onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
                    required
                    placeholder="e.g., Device Online"
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
                    placeholder="Optional description of this notification type"
                  />
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>
                  Severity
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                    <option value="critical">Critical</option>
                  </select>
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
                  {editingType ? 'Update' : 'Create'} Type
                </button>
                <button type="button" onClick={handleCancel} className={styles.cancelButton}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {types.length === 0 ? (
        <div className={styles.empty}>
          <p>No notification types found. Create your first notification type to get started.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
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
                  <td className={styles.codeCell}>{type.type_code}</td>
                  <td>{type.type_name}</td>
                  <td>
                    <span className={`${styles.severity} ${styles[type.severity]}`}>
                      {type.severity}
                    </span>
                  </td>
                  <td>
                    <span className={type.enabled ? styles.enabled : styles.disabled}>
                      {type.enabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleEdit(type)}
                      className={styles.editButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(type.type_code)}
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

