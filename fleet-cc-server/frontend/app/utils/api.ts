import { supabase } from './supabase'

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
		const { data: { session } } = await supabase.auth.getSession()
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
 */
export async function authenticatedFetch(
	url: string,
	options: RequestInit = {}
): Promise<Response> {
	const headers = await getAuthHeaders()

	return fetch(url, {
		...options,
		headers: {
			...headers,
			...options.headers,
		},
	})
}

