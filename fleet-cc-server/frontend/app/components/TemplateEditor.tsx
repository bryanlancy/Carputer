'use client'

import { useState } from 'react'
import { parseMarkdown } from '../utils/markdown'
import { formatDate } from '../utils/dateFormat'
import styles from './TemplateEditor.module.scss'

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  availableVariables?: string[]
  triggerType?: 'date_time' | 'backend_event' | 'user_driven'
  notificationType?: 'default' | 'warning' | 'alert' | 'success'
}

export default function TemplateEditor({
  value,
  onChange,
  availableVariables = [],
  triggerType,
  notificationType = 'default',
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
            Use {'{{variable}}'} syntax to insert dynamic values. Supports markdown: **bold**, *italic*, `code`. Timestamps: {'{{timestamp|"Hello" dd yy HH:mm:ss}}'}
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
            <strong>Examples:</strong>
            <br />
            • Device {'{{device.hostname}}'} is now {'{{device.status}}'}
            <br />
            • Timestamp: {'{{timestamp|"Hello" dd yy HH:mm:ss}}'}
            <br />
            • Markdown: **bold**, *italic*, `code`
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
          <div
            className={`${styles.previewText} ${styles[`previewType_${notificationType}`]}`}
            dangerouslySetInnerHTML={{
              __html: parseMarkdown(
                value.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
                  try {
                    // Handle format pipes (e.g., {{timestamp|"Hello" dd yy HH:mm:ss}})
                    if (expression.includes('|')) {
                      const [variablePath, ...pipeParts] = expression.split('|').map((s: string) => s.trim())

                      // Get sample value
                      const sampleValues: Record<string, any> = {
                        'device.id': '1',
                        'device.device_id': 'DEV-001',
                        'device.hostname': 'carputer-01',
                        'device.status': 'online',
                        'timestamp': new Date(),
                        'date': new Date(),
                        'time': new Date(),
                        'event.type': 'device.online',
                        'user.id': 'user-123',
                        'user.email': 'user@example.com',
                        'user.name': 'John Doe',
                      }

                      let value = sampleValues[variablePath] || new Date() // Default to current date for timestamp

                      // Process format pipes - everything after the first | is the format string
                      if (pipeParts.length > 0) {
                        // Join all pipe parts (in case there are multiple |, though typically just one)
                        const formatString = pipeParts.join('|').trim()
                        value = formatDate(value, formatString)
                      }

                      return String(value)
                    }

                    // Simple variable access
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
                    return sampleValues[expression.trim()] || `[${expression.trim()}]`
                  } catch (error) {
                    return `[${expression.trim()}]`
                  }
                })
              )
            }}
          />
        </div>
      )}
    </div>
  )
}

