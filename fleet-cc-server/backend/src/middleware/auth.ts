import { Request, Response, NextFunction } from 'express'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { getSessionActivityService } from '../services/sessionActivity'

// Extend Express Request to include user
declare global {
	namespace Express {
		interface Request {
			user?: {
				id: string
				email: string
				supabase_user_id: string
				roles: string[]
			}
		}
	}
}

// In Docker, use the service name; locally, use localhost
function getSupabaseUrl(): string {
	if (process.env.SUPABASE_URL) {
		return process.env.SUPABASE_URL
	}
	return process.env.DOCKER_ENV === 'true'
		? 'http://auth:9999'
		: 'http://localhost:9999'
}

const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.JWT_SECRET ||
	'dummy-key-for-development'
const jwtSecret = process.env.JWT_SECRET || supabaseKey

let supabase: SupabaseClient | null = null
let cachedSupabaseUrl: string | null = null

function getSupabaseClient(): SupabaseClient {
	const currentUrl = getSupabaseUrl()
	// Recreate client if URL changed or doesn't exist
	if (!supabase || cachedSupabaseUrl !== currentUrl) {
		console.log(`Creating Supabase client with URL: ${currentUrl}`)
		supabase = createClient(currentUrl, supabaseKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
			},
		})
		cachedSupabaseUrl = currentUrl
	}
	return supabase
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
	const authHeader = req.headers.authorization
	if (!authHeader) {
		return null
	}

	const parts = authHeader.split(' ')
	if (parts.length !== 2 || parts[0] !== 'Bearer') {
		return null
	}

	return parts[1]
}

/**
 * Verify JWT token and extract user information
 * For self-hosted GoTrue, tokens are JWTs signed with JWT_SECRET
 */
export async function verifyToken(token: string): Promise<any | null> {
	try {
		// Verify JWT token directly (GoTrue tokens are JWTs)
		const decoded = jwt.verify(token, jwtSecret) as any

		// Ensure the token has the required fields
		if (!decoded.sub) {
			console.warn('Token missing sub (user ID)')
			return null
		}

		return decoded
	} catch (jwtError: any) {
		// JWT verification failed - token is invalid or expired
		if (jwtError.name === 'TokenExpiredError') {
			console.warn('Token expired')
		} else if (jwtError.name === 'JsonWebTokenError') {
			console.warn('Invalid token format:', jwtError.message)
		} else {
			console.error('Token verification error:', jwtError.message)
		}
		return null
	}
}

/**
 * Authentication middleware
 * Extracts user from JWT token and attaches to request
 */
export async function authenticate(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	try {
		const token = extractToken(req)

		if (!token) {
			// No token provided - continue without user (for backward compatibility)
			console.log(
				`[Auth] No token provided for ${req.method} ${req.path}`
			)
			return next()
		}

		console.log(`[Auth] Verifying token for ${req.method} ${req.path}`)
		const decoded = await verifyToken(token)

		if (!decoded) {
			// Invalid token - continue without user (for backward compatibility)
			console.log(
				`[Auth] Token verification failed for ${req.method} ${req.path}`
			)
			return next()
		}

		console.log(
			`[Auth] Token verified successfully, user ID: ${decoded.sub}`
		)

		const supabaseUserId = decoded.sub

		// Check if session is expired due to inactivity
		const sessionActivityService = getSessionActivityService()
		if (sessionActivityService.isSessionExpired(supabaseUserId)) {
			console.log(
				`[Auth] Session expired due to inactivity for user ${supabaseUserId}`
			)
			// Return 401 to force frontend to handle logout
			res.status(401).json({ error: 'Session expired due to inactivity' })
			return
		}

		// Get user from database (sync from Supabase if needed)
		const prisma = req.prisma
		if (!prisma) {
			return next()
		}
		let user = await prisma.user.findUnique({
			where: { supabase_user_id: supabaseUserId },
			include: {
				user_roles: true,
			},
		})

		// Sync user from Supabase if not found
		if (!user) {
			const client = getSupabaseClient()
			const { data: supabaseUser } = await client.auth.admin.getUserById(
				supabaseUserId
			)

			if (supabaseUser?.user) {
				user = await prisma.user.create({
					data: {
						id: supabaseUser.user.id,
						supabase_user_id: supabaseUser.user.id,
						email: supabaseUser.user.email || '',
						full_name:
							supabaseUser.user.user_metadata?.full_name || null,
						avatar_url:
							supabaseUser.user.user_metadata?.avatar_url || null,
					},
					include: {
						user_roles: true,
					},
				})
			}
		}

		if (user) {
			req.user = {
				id: user.id,
				email: user.email,
				supabase_user_id: user.supabase_user_id,
				roles: user.user_roles.map(ur => ur.role),
			}

			// Update last activity timestamp
			sessionActivityService.updateActivity(supabaseUserId)
		}

		next()
	} catch (error) {
		console.error('Authentication error:', error)
		// Continue without user on error (for backward compatibility)
		next()
	}
}

/**
 * Optional authentication middleware
 * Only sets user if token is provided, doesn't fail if missing
 */
export const optionalAuth = authenticate

/**
 * Required authentication middleware
 * Returns 401 if user is not authenticated
 */
export function requireAuth(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	if (!req.user) {
		res.status(401).json({ error: 'Authentication required' })
		return
	}

	// Update activity on authenticated requests (for routes using requireAuth)
	const sessionActivityService = getSessionActivityService()
	sessionActivityService.updateActivity(req.user.supabase_user_id)

	next()
}
