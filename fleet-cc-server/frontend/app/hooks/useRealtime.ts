'use client'

import { useEffect, useRef, useState } from 'react'
import { getApiUrl } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

export interface RealtimeMessage {
	type: 'connected' | 'device_update' | 'notification' | 'heartbeat'
	device?: any
	notification?: any
	timestamp: string
}

export function useRealtime(onMessage?: (message: RealtimeMessage) => void) {
	const { session, isAuthenticated } = useAuth()
	const [connected, setConnected] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const eventSourceRef = useRef<EventSource | null>(null)

	useEffect(() => {
		// Only connect if user is authenticated
		if (!isAuthenticated || !session?.access_token) {
			// Disconnect if not authenticated
			if (eventSourceRef.current) {
				eventSourceRef.current.close()
				eventSourceRef.current = null
				setConnected(false)
			}
			return
		}

		const apiUrl = getApiUrl()
		// Note: EventSource doesn't support custom headers, so authentication
		// must be handled via query params or cookies. For now, the backend
		// should reject unauthenticated connections via requireAuth middleware.
		const eventSource = new EventSource(`${apiUrl}/api/realtime/devices`)

		eventSourceRef.current = eventSource

		eventSource.onopen = () => {
			console.log('SSE connection opened')
			setConnected(true)
			setError(null)
		}

		eventSource.onmessage = event => {
			try {
				const message: RealtimeMessage = JSON.parse(event.data)
				if (onMessage) {
					onMessage(message)
				}
			} catch (error) {
				console.error('Failed to parse SSE message:', error)
			}
		}

		eventSource.onerror = error => {
			console.error('SSE connection error:', error)
			setError(new Error('Realtime connection failed'))
			setConnected(false)
		}

		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close()
				eventSourceRef.current = null
			}
		}
	}, [onMessage, isAuthenticated, session?.access_token])

	return { connected, error }
}
