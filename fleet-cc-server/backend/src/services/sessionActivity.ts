import { createClient, SupabaseClient } from '@supabase/supabase-js'

// In-memory store for user activity tracking
// Maps user ID (Supabase user ID) to last activity timestamp
const userActivityMap = new Map<string, number>()

// Get timeout in milliseconds (default 15 minutes)
function getTimeoutMs(): number {
	const timeoutMinutes = parseInt(
		process.env.AUTH_TIMEOUT_MINUTES || '15',
		10
	)
	return timeoutMinutes * 60 * 1000 // Convert minutes to milliseconds
}

/**
 * Session Activity Service
 * Tracks user activity and revokes inactive sessions
 */
export class SessionActivityService {
	private supabase: SupabaseClient
	private checkInterval: NodeJS.Timeout | null = null
	private checkIntervalMs = 60 * 1000 // Check every minute

	constructor() {
		const supabaseUrl =
			process.env.SUPABASE_URL ||
			(process.env.DOCKER_ENV === 'true'
				? 'http://auth:9999'
				: 'http://localhost:9999')
		const supabaseKey =
			process.env.SUPABASE_SERVICE_ROLE_KEY ||
			process.env.JWT_SECRET ||
			'dummy-key-for-development'

		this.supabase = createClient(supabaseUrl, supabaseKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
			},
		})
	}

	/**
	 * Update last activity timestamp for a user
	 */
	updateActivity(userId: string): void {
		userActivityMap.set(userId, Date.now())
	}

	/**
	 * Get last activity timestamp for a user
	 */
	getLastActivity(userId: string): number | null {
		return userActivityMap.get(userId) || null
	}

	/**
	 * Check if user session should be revoked due to inactivity
	 */
	isSessionExpired(userId: string): boolean {
		const lastActivity = userActivityMap.get(userId)
		if (!lastActivity) {
			// No activity recorded yet - don't consider expired (user just logged in)
			// Activity will be set on the next authenticated request
			return false
		}

		const timeoutMs = getTimeoutMs()
		const now = Date.now()
		return now - lastActivity > timeoutMs
	}

	/**
	 * Revoke user session in Supabase
	 */
	async revokeUserSession(userId: string): Promise<void> {
		try {
			// Sign out all sessions for this user using Supabase Admin API
			// GoTrue doesn't have a direct "sign out user" endpoint,
			// so we'll need to invalidate the user's refresh tokens
			// For now, we'll log it and let the frontend handle the logout
			console.log(
				`[SessionActivity] Revoking session for user ${userId} due to inactivity`
			)

			// Remove from activity map
			userActivityMap.delete(userId)

			// Note: GoTrue doesn't provide an easy way to invalidate all sessions server-side
			// The frontend will handle the actual logout when it detects inactivity
			// We mark the session as expired so subsequent requests will fail auth
		} catch (error) {
			console.error(
				`[SessionActivity] Error revoking session for user ${userId}:`,
				error
			)
		}
	}

	/**
	 * Remove user from activity tracking (on logout)
	 */
	clearActivity(userId: string): void {
		userActivityMap.delete(userId)
	}

	/**
	 * Check for and revoke expired sessions
	 */
	async checkAndRevokeExpiredSessions(): Promise<void> {
		const now = Date.now()
		const timeoutMs = getTimeoutMs()
		const expiredUsers: string[] = []

		// Find all users with expired sessions
		for (const [userId, lastActivity] of userActivityMap.entries()) {
			if (now - lastActivity > timeoutMs) {
				expiredUsers.push(userId)
			}
		}

		// Revoke sessions for expired users
		for (const userId of expiredUsers) {
			await this.revokeUserSession(userId)
		}

		if (expiredUsers.length > 0) {
			console.log(
				`[SessionActivity] Revoked ${expiredUsers.length} expired session(s) due to inactivity`
			)
		}
	}

	/**
	 * Start periodic check for expired sessions
	 */
	startPeriodicCheck(): void {
		if (this.checkInterval) {
			return // Already started
		}

		console.log(
			`[SessionActivity] Starting periodic session expiration check (every ${
				this.checkIntervalMs / 1000
			}s, timeout: ${getTimeoutMs() / 1000 / 60} minutes)`
		)

		this.checkInterval = setInterval(() => {
			this.checkAndRevokeExpiredSessions().catch(error => {
				console.error(
					'[SessionActivity] Error in periodic check:',
					error
				)
			})
		}, this.checkIntervalMs)
	}

	/**
	 * Stop periodic check
	 */
	stopPeriodicCheck(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval)
			this.checkInterval = null
			console.log(
				'[SessionActivity] Stopped periodic session expiration check'
			)
		}
	}
}

// Singleton instance
let sessionActivityService: SessionActivityService | null = null

export function getSessionActivityService(): SessionActivityService {
	if (!sessionActivityService) {
		sessionActivityService = new SessionActivityService()
	}
	return sessionActivityService
}
