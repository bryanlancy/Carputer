import { Request, Response, NextFunction } from 'express'
import { filterResponse, filterMultiResourceResponse } from '../services/responseFilter'

/**
 * Check if an endpoint pattern matches the requested path
 */
function matchesEndpoint(pattern: string, path: string): boolean {
	// Convert pattern to regex
	// Replace :id, :userId, etc. with regex patterns
	const regexPattern = pattern
		.replace(/:[^/]+/g, '[^/]+') // Replace :param with [^/]+
		.replace(/\//g, '\\/') // Escape slashes
		.replace(/\*/g, '.*') // Replace * with .*

	const regex = new RegExp(`^${regexPattern}$`)
	return regex.test(path)
}

/**
 * Check if API key has permission to access an endpoint
 */
function hasEndpointPermission(
	apiKey: any,
	requestPath: string,
	method: string
): boolean {
	if (!apiKey.permissions || apiKey.permissions.length === 0) {
		// No permissions defined, deny access
		return false
	}

	// Check each permission
	for (const permission of apiKey.permissions) {
		const allowedEndpoints = permission.allowed_endpoints

		if (!allowedEndpoints || !Array.isArray(allowedEndpoints)) {
			continue
		}

		// Check if any endpoint pattern matches
		for (const endpoint of allowedEndpoints) {
			if (typeof endpoint === 'string') {
				if (matchesEndpoint(endpoint, requestPath)) {
					return true
				}
			} else if (typeof endpoint === 'object' && endpoint.path) {
				// Support object format: { path: '/api/devices', method: 'GET' }
				const endpointPath = endpoint.path
				const endpointMethod = endpoint.method?.toUpperCase() || 'GET'

				if (
					matchesEndpoint(endpointPath, requestPath) &&
					(!endpoint.method || endpointMethod === method.toUpperCase())
				) {
					return true
				}
			}
		}
	}

	return false
}

/**
 * Get the resource type from the request path
 */
function getResourceTypeFromPath(path: string): string | null {
	// Extract resource type from path patterns like /api/devices, /api/users, etc.
	const match = path.match(/^\/api\/([^/]+)/)
	if (match) {
		return match[1]
	}
	return null
}

/**
 * Get allowed fields for a resource type from API key permissions
 */
function getAllowedFields(
	apiKey: any,
	resourceType: string
): Record<string, string[]> | null {
	if (!apiKey.permissions || apiKey.permissions.length === 0) {
		return null
	}

	// Find permission for this resource type
	for (const permission of apiKey.permissions) {
		if (permission.resource_type === resourceType) {
			return permission.allowed_fields || null
		}
	}

	return null
}

/**
 * Middleware to check API key permissions for endpoint access
 */
export function checkApiKeyPermissions(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	// Skip if no API key (may be authenticated via JWT)
	if (!req.apiKey) {
		return next()
	}

	const requestPath = req.path
	const method = req.method

	// Check endpoint permission
	if (!hasEndpointPermission(req.apiKey, requestPath, method)) {
		res.status(403).json({
			error: 'API key does not have permission to access this endpoint',
		})
		return
	}

	// Store original json method to intercept responses
	const originalJson = res.json.bind(res)

	res.json = function (data: any) {
		// Get resource type from path
		const resourceType = getResourceTypeFromPath(requestPath)

		if (resourceType) {
			const allowedFields = getAllowedFields(req.apiKey!, resourceType)

			if (allowedFields) {
				// Filter response based on allowed fields
				const filtered = filterResponse(data, resourceType, allowedFields)
				return originalJson(filtered)
			}
		}

		// If we can't determine resource type, try multi-resource filtering
		if (req.apiKey!.permissions && req.apiKey!.permissions.length > 0) {
			// Try to find any permission with allowed_fields
			for (const permission of req.apiKey!.permissions) {
				if (permission.allowed_fields) {
					const filtered = filterMultiResourceResponse(
						data,
						permission.allowed_fields
					)
					return originalJson(filtered)
				}
			}
		}

		// No field restrictions, return original data
		return originalJson(data)
	}

	next()
}

