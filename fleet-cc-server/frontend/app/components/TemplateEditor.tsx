'use client'

import { useState } from 'react'
import styles from './TemplateEditor.module.scss'

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  availableVariables?: string[]
  triggerType?: 'date_time' | 'backend_event' | 'user_driven'
}

export default function TemplateEditor({
  value,
  onChange,
  availableVariables = [],
  triggerType,
}: TemplateEditorProps) {
  const [showHints, setShowHints] = useState(false)

  // Default variables based on trigger type
  const defaultVariables: Record<string, string[]> = {
    backend_event: [
      'device.id',
      'device.device_id',
      'device.hostname',
      'device.status',
      'timestamp',
      'event.type',
    ],
    date_time: [
      'timestamp',
      'date',
      'time',
    ],
    user_driven: [
      'user.id',
      'user.email',
      'user.name',
      'timestamp',
    ],
  }

  const variables = availableVariables.length > 0
    ? availableVariables
    : (triggerType ? defaultVariables[triggerType] || [] : [])

  const insertVariable = (variable: string) => {
    const cursorPos = (document.activeElement as HTMLTextAreaElement)?.selectionStart || value.length
    const newValue = value.slice(0, cursorPos) + `{{${variable}}}` + value.slice(cursorPos)
    onChange(newValue)
    setShowHints(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label>
          Message Template
          <span className={styles.helpText}>
            Use {'{{variable}}'} syntax to insert dynamic values
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowHints(!showHints)}
          className={styles.hintsButton}
        >
          {showHints ? 'Hide' : 'Show'} Variables
        </button>
      </div>

      {showHints && variables.length > 0 && (
        <div className={styles.variablesPanel}>
          <div className={styles.variablesHeader}>Available Variables:</div>
          <div className={styles.variablesList}>
            {variables.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className={styles.variableButton}
              >
                {variable}
              </button>
            ))}
          </div>
          <div className={styles.example}>
            <strong>Example:</strong> Device {'{{device.hostname}}'} is now {'{{device.status}}'}
          </div>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter message template with {{variable}} placeholders..."
        className={styles.textarea}
        rows={4}
      />

      {value && (
        <div className={styles.preview}>
          <div className={styles.previewLabel}>Preview (with sample data):</div>
          <div className={styles.previewText}>
            {value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
              // Simple preview replacement
              const sampleValues: Record<string, string> = {
                'device.id': '1',
                'device.device_id': 'DEV-001',
                'device.hostname': 'carputer-01',
                'device.status': 'online',
                'timestamp': new Date().toLocaleString(),
                'date': new Date().toLocaleDateString(),
                'time': new Date().toLocaleTimeString(),
                'event.type': 'device.online',
                'user.id': 'user-123',
                'user.email': 'user@example.com',
                'user.name': 'John Doe',
              }
              return sampleValues[varName.trim()] || `[${varName.trim()}]`
            })}
          </div>
        </div>
      )}
    </div>
  )
}

