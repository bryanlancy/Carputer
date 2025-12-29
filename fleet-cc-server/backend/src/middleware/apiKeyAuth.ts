import { Request, Response, NextFunction } from 'express'
import { verifyApiKey } from '../services/apiKeyService'
// Note: ApiKey type will be available after running `npx prisma generate`
type ApiKey = any // Will be Prisma.ApiKeyGetPayload<{ include: { permissions: true } }> after prisma generate

// Extend Express Request to include API key
declare global {
	namespace Express {
		interface Request {
			apiKey?: ApiKey & {
				permissions?: any[]
			}
		}
	}
}

/**
 * Extract API key from request headers
 * Supports both Authorization: Bearer <key> and X-API-Key header
 */
function extractApiKey(req: Request): string | null {
	// Try Authorization header first
	const authHeader = req.headers.authorization
	if (authHeader) {
		const parts = authHeader.split(' ')
		if (parts.length === 2 && parts[0] === 'Bearer') {
			const token = parts[1]
			// Check if it looks like a UUID (API key format)
			// UUIDs are 36 characters with dashes
			if (token.length === 36 && token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
				return token
			}
		}
	}

	// Try X-API-Key header
	const apiKeyHeader = req.headers['x-api-key']
	if (apiKeyHeader && typeof apiKeyHeader === 'string') {
		return apiKeyHeader
	}

	return null
}

/**
 * API Key Authentication Middleware
 * Verifies API key and attaches it to the request
 * This middleware should run after JWT auth but before permission checks
 */
export async function authenticateApiKey(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	// Skip if user is already authenticated via JWT
	if (req.user) {
		return next()
	}

	const apiKey = extractApiKey(req)

	if (!apiKey) {
		// No API key provided, continue (may be authenticated via JWT)
		return next()
	}

	try {
		const verifiedKey = await verifyApiKey(apiKey)

		if (!verifiedKey) {
			res.status(401).json({ error: 'Invalid or revoked API key' })
			return
		}

		// Load permissions for the API key
		const { getApiKeyPermissions } = await import('../services/apiKeyService')
		const permissions = await getApiKeyPermissions(verifiedKey.id)

		// Attach API key with permissions to request
		req.apiKey = {
			...verifiedKey,
			permissions,
		}

		next()
	} catch (error) {
		console.error('API key authentication error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
}

/**
 * Require API key authentication
 * Returns 401 if no valid API key is provided
 */
export function requireApiKey(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	if (!req.apiKey) {
		res.status(401).json({ error: 'API key required' })
		return
	}
	next()
}

