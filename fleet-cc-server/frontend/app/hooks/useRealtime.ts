'use client'

import { useEffect, useRef, useState } from 'react'
import { getApiUrl } from '../utils/api'

export interface RealtimeMessage {
  type: 'connected' | 'device_update' | 'notification' | 'heartbeat'
  device?: any
  notification?: any
  timestamp: string
}

export function useRealtime(onMessage?: (message: RealtimeMessage) => void) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const apiUrl = getApiUrl()
    const eventSource = new EventSource(`${apiUrl}/api/realtime/devices`)

    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('SSE connection opened')
      setConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const message: RealtimeMessage = JSON.parse(event.data)
        if (onMessage) {
          onMessage(message)
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      setError(new Error('Realtime connection failed'))
      setConnected(false)
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [onMessage])

  return { connected, error }
}

