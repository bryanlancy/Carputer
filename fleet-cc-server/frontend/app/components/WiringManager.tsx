'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl, authenticatedFetch } from '../utils/api'
import WiringCanvas from './WiringCanvas'
import { Node, Edge } from 'reactflow'
import styles from './WiringManager.module.scss'

interface NotificationRule {
  id: number
  name: string
  enabled: boolean
}

interface Trigger {
  id: number
  trigger_code: string
  trigger_name: string
  description?: string | null
  output_schema?: any
  enabled: boolean
}

interface Event {
  id: number
  event_code: string
  event_name: string
  description?: string | null
  input_schema?: any
  handler_type: string
  enabled: boolean
}

interface WiringConfiguration {
  nodes: any[]
  edges: any[]
  viewport?: any
}

export default function WiringManager() {
  const { session } = useAuth()
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null)
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [wiringConfig, setWiringConfig] = useState<WiringConfiguration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const nodesRef = useRef<Node[] | null>(null)
  const edgesRef = useRef<Edge[] | null>(null)

  useEffect(() => {
    loadRules()
    loadTriggers()
    loadEvents()
  }, [])

  useEffect(() => {
    if (selectedRuleId) {
      loadWiringConfig(selectedRuleId)
    }
  }, [selectedRuleId])

  const loadRules = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(
        `${apiUrl}/api/admin/notifications/rules`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setRules(data)
        if (data.length > 0 && !selectedRuleId) {
          setSelectedRuleId(data[0].id)
        }
      }
    } catch (err: any) {
      console.error('Failed to load rules:', err)
      setError('Failed to load notification rules')
    } finally {
      setLoading(false)
    }
  }

  const loadTriggers = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(
        `${apiUrl}/api/admin/triggers`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setTriggers(data)
      }
    } catch (err: any) {
      console.error('Failed to load triggers:', err)
    }
  }

  const loadEvents = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(
        `${apiUrl}/api/admin/events`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (err: any) {
      console.error('Failed to load events:', err)
    }
  }

  const loadWiringConfig = async (ruleId: number) => {
    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(
        `${apiUrl}/api/admin/wiring/${ruleId}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.wiring) {
          setWiringConfig({
            nodes: data.wiring.nodes || [],
            edges: data.wiring.edges || [],
            viewport: data.wiring.viewport,
          })
        } else {
          setWiringConfig(null)
        }
      }
    } catch (err: any) {
      console.error('Failed to load wiring config:', err)
      setWiringConfig(null)
    }
  }

  const saveWiringConfig = async () => {
    if (!selectedRuleId) {
      setError('Please select a notification rule')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const apiUrl = getApiUrl()

      // Get current nodes and edges from the canvas refs
      const configToSave = {
        nodes: nodesRef.current || wiringConfig?.nodes || [],
        edges: edgesRef.current || wiringConfig?.edges || [],
        viewport: wiringConfig?.viewport,
      }

      const response = await authenticatedFetch(
        `${apiUrl}/api/admin/wiring/${selectedRuleId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(configToSave),
        }
      )

      if (response.ok) {
        setSuccess('Wiring configuration saved successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save wiring configuration')
      }
    } catch (err: any) {
      console.error('Failed to save wiring config:', err)
      setError('Failed to save wiring configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleNodesChange = (nodes: Node[]) => {
    setWiringConfig((prev) => ({
      ...prev!,
      nodes,
    }))
  }

  const handleEdgesChange = (edges: Edge[]) => {
    setWiringConfig((prev) => ({
      ...prev!,
      edges,
    }))
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Wiring Configuration</h2>
        <p className={styles.description}>
          Connect triggers to events by dragging connections between nodes. Triggers emit data that events consume.
        </p>
      </div>

      <div className={styles.ruleSelector}>
        <label htmlFor="rule-select">Notification Rule:</label>
        <select
          id="rule-select"
          value={selectedRuleId || ''}
          onChange={(e) => setSelectedRuleId(parseInt(e.target.value))}
          className={styles.select}
        >
          <option value="">Select a rule...</option>
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.name} {!rule.enabled && '(Disabled)'}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {success && (
        <div className={styles.success}>{success}</div>
      )}

      {selectedRuleId && (
        <>
          <div className={styles.canvasContainer}>
            <WiringCanvas
              triggers={triggers}
              events={events}
              initialNodes={wiringConfig?.nodes || []}
              initialEdges={wiringConfig?.edges || []}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              nodesRef={nodesRef}
              edgesRef={edgesRef}
            />
          </div>

          <div className={styles.actions}>
            <button
              onClick={saveWiringConfig}
              disabled={saving}
              className={styles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </>
      )}

      {!selectedRuleId && (
        <div className={styles.emptyState}>
          <p>Please select a notification rule to configure its wiring.</p>
        </div>
      )}
    </div>
  )
}

