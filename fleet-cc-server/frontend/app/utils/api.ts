import { supabase } from './supabase'

/**
 * Safely parse JSON from a Response
 * Returns null if parsing fails or response is empty
 */
async function safeJsonParse(response: Response): Promise<any | null> {
	try {
		const contentType = response.headers.get('content-type')
		if (!contentType || !contentType.includes('application/json')) {
			return null
		}

		const text = await response.text()
		if (!text || text.trim().length === 0) {
			return null
		}

		return JSON.parse(text)
	} catch (error) {
		console.warn('Failed to parse JSON from response:', error)
		return null
	}
}

/**
 * Get the API URL, auto-detecting from the current hostname if needed
 * This ensures the frontend can connect to the backend when accessed from different machines
 */
export function getApiUrl(): string {
	if (typeof window === 'undefined') {
		// Server-side: use environment variable or default
		return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
	}

	// Client-side: auto-detect from current location
	const envApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
	const currentHost = window.location.hostname
	const currentProtocol = window.location.protocol

	// If env URL uses localhost but we're on a different host, replace it
	if (
		envApiUrl.includes('localhost') &&
		currentHost !== 'localhost' &&
		currentHost !== '127.0.0.1'
	) {
		// Replace localhost with current host, preserve port
		const port = envApiUrl.match(/:(\d+)/)?.[1] || '3001'
		return `${currentProtocol}//${currentHost}:${port}`
	}

	return envApiUrl
}

/**
 * Get authentication headers for API requests
 * Returns headers with Bearer token if user is authenticated
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
	}

	try {
		const {
			data: { session },
		} = await supabase.auth.getSession()
		if (session?.access_token) {
			headers['Authorization'] = `Bearer ${session.access_token}`
		}
	} catch (error) {
		console.error('Failed to get auth session:', error)
	}

	return headers
}

/**
 * Make an authenticated API request
 * Automatically includes auth token in headers
 * Also dispatches an event to reset the inactivity timer on successful requests
 * Handles 401 responses by triggering logout
 */
export async function authenticatedFetch(
	url: string,
	options: RequestInit = {}
): Promise<Response> {
	const headers = await getAuthHeaders()

	const response = await fetch(url, {
		...options,
		headers: {
			...headers,
			...options.headers,
		},
	})

	// Handle 401 Unauthorized - session expired or invalid
	if (response.status === 401 && typeof window !== 'undefined') {
		// Check if we sent an auth token (meaning we thought we were authenticated)
		// If we did and got 401, the backend has revoked our session
		const hadAuthToken =
			headers['Authorization'] || headers['authorization']

		if (hadAuthToken) {
			// We had a token but backend rejected it - session was revoked
			// Verify we actually have a session before triggering logout
			// This avoids false positives if the token was removed between header creation and request
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession()

				if (session) {
					// We have a session but backend rejected it - session was revoked
					console.warn(
						'[API] Received 401 with active session - backend revoked session'
					)
					window.dispatchEvent(
						new CustomEvent('sessionExpired', {
							detail: { reason: 'backend_revoked' },
						})
					)
				}
			} catch (error) {
				// If we can't check session, still dispatch event as a precaution
				console.warn(
					'[API] Received 401 with auth token, error checking session:',
					error
				)
				window.dispatchEvent(
					new CustomEvent('sessionExpired', {
						detail: { reason: 'backend_revoked' },
					})
				)
			}
		}
		// If no auth token was sent, this is expected (e.g., login page) - don't trigger logout
	}

	// Reset inactivity timer on successful API calls (represents user activity)
	// Only reset on successful responses (2xx status codes)
	if (response.ok && typeof window !== 'undefined') {
		// Dispatch custom event that AuthContext can listen to
		window.dispatchEvent(new CustomEvent('apiActivity'))
	}

	return response
}
