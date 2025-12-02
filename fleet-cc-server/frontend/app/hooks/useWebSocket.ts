'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getApiUrl } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

export interface WebSocketMessage {
  type: 'connected' | 'device_update' | 'image_update' | 'metrics_update' | 'notification' | 'heartbeat'
  device?: any
  image?: any
  metrics?: any
  notification?: any
  timestamp: string
}

export function useWebSocket(
  onMessage?: (message: WebSocketMessage) => void,
  channels?: string[]
) {
  const { session } = useAuth()
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000 // 1 second
  const connectingRef = useRef(false)
  const onMessageRef = useRef(onMessage)
  const channelsRef = useRef(channels)
  const tokenRef = useRef<string | null>(session?.access_token || null)

  // Update refs when props change
  useEffect(() => {
    onMessageRef.current = onMessage
    channelsRef.current = channels
    tokenRef.current = session?.access_token || null
  }, [onMessage, channels, session])

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return // Already connected or connecting
    }

    connectingRef.current = true

    try {
      const apiUrl = getApiUrl()
      // Convert http:// to ws:// and https:// to wss://
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/realtime/ws'

      // Build query params
      const params = new URLSearchParams()
      if (channelsRef.current && channelsRef.current.length > 0) {
        params.append('channels', channelsRef.current.join(','))
      }
      if (tokenRef.current) {
        params.append('token', tokenRef.current)
      }

      const url = params.toString()
        ? `${wsUrl}?${params.toString()}`
        : wsUrl

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connection opened')
        connectingRef.current = false
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          if (onMessageRef.current) {
            onMessageRef.current(message)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        // Only log error if we haven't exceeded max reconnect attempts
        if (reconnectAttempts.current < maxReconnectAttempts) {
          console.warn('WebSocket connection error (will retry):', error)
        }
        connectingRef.current = false
        setError(new Error('WebSocket connection error'))
        setConnected(false)
      }

      ws.onclose = (event) => {
        // Only log if it's not a normal closure or we're still trying to reconnect
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          console.log('WebSocket connection closed', event.code, event.reason)
        }
        connectingRef.current = false
        setConnected(false)
        wsRef.current = null

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
          reconnectAttempts.current++
          // Only log reconnection attempts, not every close event
          if (reconnectAttempts.current <= 3) {
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`)
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError(new Error('Failed to reconnect after multiple attempts'))
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      connectingRef.current = false
      setError(error as Error)
      setConnected(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting')
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    console.warn('WebSocket is not connected, cannot send message')
    return false
  }, [])

  useEffect(() => {
    // Small delay to prevent multiple simultaneous connections
    const timeoutId = setTimeout(() => {
      connect()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      disconnect()
    }
  }, [connect, disconnect]) // Reconnect if token changes

  return { connected, error, send, reconnect: connect }
}

